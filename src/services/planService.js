const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Lista todos os planos de subscrição
 */
async function getAllPlans() {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('plans')
      .select('*')
      .order('price_kz', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar planos: ${err.message}`);
    return [];
  }
}

/**
 * Lista apenas os planos ativos para exibição pública na Landing Page
 */
async function getPublicPlans() {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('plans')
      .select('id, code, name, description, price_kz, max_whatsapp_accounts, monthly_message_limit, max_users')
      .eq('is_active', true)
      .order('price_kz', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar planos públicos: ${err.message}`);
    return [];
  }
}

/**
 * Cria um novo plano
 */
async function createPlan({ code, name, description, priceKz, maxWhatsappAccounts, monthlyMessageLimit, maxUsers }) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from('plans')
      .insert({
        code: code.toLowerCase().trim(),
        name,
        description: description || '',
        price_kz: parseFloat(priceKz) || 0,
        max_whatsapp_accounts: parseInt(maxWhatsappAccounts) || 1,
        monthly_message_limit: parseInt(monthlyMessageLimit) || 100,
        max_users: parseInt(maxUsers) || 1,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;
    logger.info(`Novo plano criado com sucesso: ${name} (${code})`);
    return data;
  } catch (err) {
    logger.error(`Erro ao criar plano: ${err.message}`);
    throw err;
  }
}

/**
 * Atualiza um plano existente
 */
async function updatePlan(id, { name, description, priceKz, maxWhatsappAccounts, monthlyMessageLimit, maxUsers, isActive }) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (priceKz !== undefined) payload.price_kz = parseFloat(priceKz);
    if (maxWhatsappAccounts !== undefined) payload.max_whatsapp_accounts = parseInt(maxWhatsappAccounts);
    if (monthlyMessageLimit !== undefined) payload.monthly_message_limit = parseInt(monthlyMessageLimit);
    if (maxUsers !== undefined) payload.max_users = parseInt(maxUsers);
    if (isActive !== undefined) payload.is_active = Boolean(isActive);

    const { data, error } = await db
      .from('plans')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    logger.info(`Plano ${id} atualizado com sucesso.`);
    return data;
  } catch (err) {
    logger.error(`Erro ao atualizar plano ${id}: ${err.message}`);
    throw err;
  }
}

/**
 * Elimina um plano (se não estiver em uso)
 */
async function deletePlan(id) {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db.from('plans').delete().eq('id', id);
    if (error) throw error;
    logger.info(`Plano ${id} eliminado com sucesso.`);
    return true;
  } catch (err) {
    logger.error(`Erro ao eliminar plano ${id}: ${err.message}`);
    throw err;
  }
}

/**
 * Lista todas as subscrições ativas das empresas
 */
async function getAllSubscriptions() {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('subscriptions')
      .select('*, tenants(name, slug, email, status), plans(name, code, price_kz)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar subscrições: ${err.message}`);
    return [];
  }
}

/**
 * Atribui ou altera a subscrição de um tenant
 */
async function updateTenantSubscription(tenantId, planCode) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data: plan, error: planErr } = await db
      .from('plans')
      .select('id')
      .eq('code', planCode)
      .single();

    if (planErr || !plan) throw new Error('Plano não encontrado.');

    const { data: existingSub } = await db
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingSub) {
      const { data, error } = await db
        .from('subscriptions')
        .update({
          plan_id: plan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSub.id)
        .select('*, plans(*)')
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await db
        .from('subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_id: plan.id,
          status: 'active',
        })
        .select('*, plans(*)')
        .single();

      if (error) throw error;
      return data;
    }
  } catch (err) {
    logger.error(`Erro ao atualizar subscrição do tenant ${tenantId}: ${err.message}`);
    throw err;
  }
}

/**
 * Verifica se um tenant ainda pode criar mais uma sessão/bot de WhatsApp,
 * de acordo com o limite `max_whatsapp_accounts` do seu plano actual.
 * Retorna { allowed, current, limit, planName }.
 */
async function canCreateSession(tenantId) {
  const db = getSupabase();
  if (!db) return { allowed: true, current: 0, limit: 1, planName: 'Indisponível' };

  try {
    const { data: sub } = await db
      .from('subscriptions')
      .select('status, plans (name, max_whatsapp_accounts)')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Sem subscrição activa → trata como plano gratuito (1 conta)
    const limit = sub?.plans?.max_whatsapp_accounts ?? 1;
    const planName = sub?.plans?.name || 'Sem plano';

    if (sub && sub.status && !['active', 'trialing'].includes(sub.status)) {
      return { allowed: false, current: 0, limit, planName, reason: 'Subscrição não está activa.' };
    }

    const { count } = await db
      .from('whatsapp_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'disconnected');

    const current = count || 0;
    return { allowed: current < limit, current, limit, planName };
  } catch (err) {
    logger.error(`Erro ao verificar limite de sessões do tenant ${tenantId}: ${err.message}`);
    // Em caso de falha na verificação, não bloqueia — mas regista o erro.
    return { allowed: true, current: 0, limit: 1, planName: 'Desconhecido' };
  }
}

module.exports = {
  getAllPlans,
  getPublicPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getAllSubscriptions,
  updateTenantSubscription,
  canCreateSession,
};
