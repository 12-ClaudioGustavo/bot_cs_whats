const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Obtém todos os tenants (para Super-Admin)
 */
async function getAllTenants() {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data: tenants, error } = await db
      .from('tenants')
      .select(`
        *,
        tenant_users (id, email, full_name, role, is_active, phone),
        subscriptions (
          status,
          current_period_start,
          current_period_end,
          plans (name, code, price_kz, monthly_message_limit, max_whatsapp_accounts, max_users)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const monthYear = new Date().toISOString().slice(0, 7);
    const result = await Promise.all(
      (tenants || []).map(async (t) => {
        try {
          const { count: clientsCount } = await db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id);
          const { data: usageLog } = await db.from('usage_logs').select('messages_sent, messages_received').eq('tenant_id', t.id).eq('month_year', monthYear).maybeSingle();
          const { data: waSession } = await db.from('whatsapp_sessions').select('session_name, status, phone_number, last_connected_at').eq('tenant_id', t.id).maybeSingle();

          return {
            ...t,
            clients_count: clientsCount || 0,
            messages_used: usageLog?.messages_sent || 0,
            messages_received: usageLog?.messages_received || 0,
            whatsapp_session: waSession || null,
          };
        } catch (_) {
          return t;
        }
      })
    );

    return result;
  } catch (err) {
    logger.error(`Erro ao buscar tenants: ${err.message}`);
    return [];
  }
}

/**
 * Busca tenant por ID ou Slug
 */
async function getTenantByIdOrSlug(idOrSlug) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const query = db.from('tenants').select('*');
    
    if (isUuid) {
      query.eq('id', idOrSlug);
    } else {
      query.eq('slug', idOrSlug);
    }

    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    logger.error(`Erro ao buscar tenant ${idOrSlug}: ${err.message}`);
    return null;
  }
}

/**
 * Cria um novo tenant pendente de pagamento / escolha de plano
 */
async function createTenant({ name, slug, email, phone, type, status }) {
  const db = getSupabase();
  if (!db) return null;

  try {
    // 1. Cria Tenant com status 'active' (respeitando a constraint tenants_status_check)
    const tenantType = type === 'personal' ? 'personal' : 'company';
    const tenantStatus = status || 'active';
    const { data: tenant, error: tErr } = await db
      .from('tenants')
      .insert({ name, slug, email, phone, status: tenantStatus, type: tenantType })
      .select()
      .single();

    if (tErr) throw tErr;

    // 2. Busca o plano base (Starter)
    const { data: plan } = await db
      .from('plans')
      .select('id')
      .eq('code', 'starter')
      .maybeSingle();

    if (plan) {
      // 3. Cria a Subscrição com status 'pending_payment'
      await db.from('subscriptions').insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        status: 'pending_payment'
      });
    }

    // 4. Cria Automação Padrão
    await db.from('automations').insert({
      tenant_id: tenant.id
    });

    logger.info(`Novo Tenant criado com sucesso (Pendente Pagamento): ${tenant.name} (${tenant.slug})`);
    return tenant;
  } catch (err) {
    logger.error(`Erro ao criar tenant ${name}: ${err.message}`);
    return null;
  }
}

/**
 * Ativa o plano e pagamento do tenant
 */
async function activateTenantPlan(tenantId, planCode = 'business') {
  const db = getSupabase();
  if (!db) return null;

  try {
    // 1. Atualiza status do tenant para active
    await db.from('tenants').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', tenantId);

    // 2. Busca o plano escolhido
    const { data: plan } = await db.from('plans').select('id').eq('code', planCode).maybeSingle();

    if (plan) {
      // Upsert na subscrição para active
      await db.from('subscriptions').upsert({
        tenant_id: tenantId,
        plan_id: plan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    logger.info(`Plano ${planCode} ativado com sucesso para o tenant ${tenantId}`);
    return true;
  } catch (err) {
    logger.error(`Erro ao ativar plano para tenant ${tenantId}: ${err.message}`);
    return false;
  }
}

/**
 * Regista uma nova mensagem no log de uso do mês e verifica limites do plano
 */
async function recordMessageUsage(tenantId = DEFAULT_TENANT_ID, direction = 'outgoing') {
  const db = getSupabase();
  if (!db) return { allowed: true, current: 0, limit: 100 };

  const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // 1. Busca subscrição e limites
    const { data: sub } = await db
      .from('subscriptions')
      .select('plans (monthly_message_limit)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const limit = sub?.plans?.monthly_message_limit || 100;

    // 2. Busca log de uso do mês
    const { data: log } = await db
      .from('usage_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month_year', monthYear)
      .maybeSingle();

    let currentSent = log?.messages_sent || 0;
    let currentRecv = log?.messages_received || 0;

    if (direction === 'outgoing') {
      currentSent += 1;
    } else {
      currentRecv += 1;
    }

    // Upsert no log
    await db.from('usage_logs').upsert({
      tenant_id: tenantId,
      month_year: monthYear,
      messages_sent: currentSent,
      messages_received: currentRecv,
      updated_at: new Date().toISOString()
    });

    const allowed = currentSent <= limit;
    return { allowed, current: currentSent, limit };
  } catch (err) {
    logger.error(`Erro ao registar uso de mensagem para tenant ${tenantId}: ${err.message}`);
    return { allowed: true, current: 0, limit: 100 };
  }
}

/**
 * Lê o estado ACTUAL de consumo do plano de um tenant, SEM incrementar
 * nada (apenas leitura — usado pelo painel para mostrar a barra de uso
 * e os avisos de limite). `recordMessageUsage` é que faz os incrementos
 * reais, chamado apenas quando uma mensagem é de facto enviada/recebida.
 */
async function getUsageStatus(tenantId = DEFAULT_TENANT_ID) {
  const db = getSupabase();
  if (!db) {
    return {
      messagesUsed: 0, messagesLimit: 100, percentUsed: 0,
      limitReached: false, nearLimit: false, planName: 'Indisponível', planCode: null,
    };
  }

  const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const { data: sub } = await db
      .from('subscriptions')
      .select('status, plans (name, code, monthly_message_limit)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const limit = sub?.plans?.monthly_message_limit || 100;
    const planName = sub?.plans?.name || 'Sem plano activo';
    const planCode = sub?.plans?.code || null;

    const { data: log } = await db
      .from('usage_logs')
      .select('messages_sent, messages_received')
      .eq('tenant_id', tenantId)
      .eq('month_year', monthYear)
      .maybeSingle();

    const messagesUsed = log?.messages_sent || 0;
    const percentUsed = limit > 0 ? Math.min(100, Math.round((messagesUsed / limit) * 100)) : 0;

    return {
      messagesUsed,
      messagesLimit: limit,
      percentUsed,
      limitReached: messagesUsed >= limit,
      // "perto do limite" = 80%+ mas ainda não estourou — dá tempo do
      // tenant fazer upgrade antes do bot parar de responder.
      nearLimit: percentUsed >= 80 && messagesUsed < limit,
      planName,
      planCode,
    };
  } catch (err) {
    logger.error(`Erro ao calcular uso do tenant ${tenantId}: ${err.message}`);
    return {
      messagesUsed: 0, messagesLimit: 100, percentUsed: 0,
      limitReached: false, nearLimit: false, planName: 'Desconhecido', planCode: null,
    };
  }
}

/**
 * Busca automações configuradas do tenant
 */
async function getTenantAutomations(tenantId = DEFAULT_TENANT_ID) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from('automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    logger.error(`Erro ao buscar automações do tenant ${tenantId}: ${err.message}`);
    return null;
  }
}

module.exports = {
  DEFAULT_TENANT_ID,
  getAllTenants,
  getTenantByIdOrSlug,
  createTenant,
  activateTenantPlan,
  recordMessageUsage,
  getUsageStatus,
  getTenantAutomations,
};
