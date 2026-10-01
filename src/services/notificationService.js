const { getSupabase } = require('./supabase');
const { formatJid } = require('../utils/messageFormatter');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Envia uma mensagem para o número de notificação/admin DE UM TENANT
 * específico, usando o socket WhatsApp desse mesmo tenant (via botManager).
 * Nunca usa um socket de outro tenant — evita notificações vazarem entre
 * empresas diferentes na plataforma.
 */
async function sendToAdmin(tenantId, message) {
  try {
    const botManager = require('../bot/botManager');
    const sock = botManager.getSocket(tenantId);
    if (!sock) {
      logger.warn(`[tenant ${tenantId}] Notificação ignorada: bot deste tenant não está conectado.`);
      return false;
    }

    const adminPhone = await getTenantNotificationPhone(tenantId);
    if (!adminPhone) {
      logger.warn(`[tenant ${tenantId}] Notificação ignorada: nenhum número de notificação configurado.`);
      return false;
    }

    const jid = formatJid(adminPhone);
    await sock.sendMessage(jid, { text: message });
    logger.info(`[tenant ${tenantId}] Notificação enviada para admin (${adminPhone})`);
    return true;
  } catch (err) {
    logger.error(`[tenant ${tenantId}] Erro ao enviar notificação: ${err.message}`);
    return false;
  }
}

/**
 * Resolve o número para onde este tenant quer receber alertas do bot.
 * Prioridade: tenants.notification_phone > tenants.phone > fallback global.
 */
async function getTenantNotificationPhone(tenantId) {
  try {
    const db = getSupabase();
    if (!db) return process.env.ADMIN_PHONE || config.human.phone;

    const { data } = await db
      .from('tenants')
      .select('notification_phone, phone')
      .eq('id', tenantId)
      .maybeSingle();

    return data?.notification_phone || data?.phone || process.env.ADMIN_PHONE || config.human.phone;
  } catch (_) {
    return process.env.ADMIN_PHONE || config.human.phone;
  }
}

// ══════════════════════════════════════════════════════
//  NOTIFICAÇÕES EM TEMPO REAL (sempre escopadas ao tenant)
// ══════════════════════════════════════════════════════

/**
 * Notifica quando um novo cliente entra em contacto pela primeira vez
 */
async function notifyNewClient(tenantId, phone, name) {
  if (process.env.NOTIFY_NEW_CLIENT !== 'true') return;

  const msg =
    `🆕 *Novo Cliente!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📞 Telefone: ${phone}\n` +
    `👤 Nome: ${name || 'Não identificado ainda'}\n` +
    `🕐 ${new Date().toLocaleString('pt-PT', { timeZone: config.businessHours.timezone })}\n\n` +
    `_Aceda ao painel admin para ver o histórico_`;

  await sendToAdmin(tenantId, msg);
}

/**
 * Notifica quando um agendamento é criado
 */
async function notifyNewAppointment(tenantId, data) {
  if (process.env.NOTIFY_APPOINTMENTS !== 'true') return;

  const msg =
    `📅 *Novo Agendamento!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `👤 Cliente: *${data.clientName}*\n` +
    `📞 Telefone: ${data.phone}\n` +
    `🛠️  Serviço: ${data.serviceName}\n` +
    `📆 Data: *${data.scheduledDate}*\n` +
    `🕐 Hora: *${data.scheduledTime}*\n` +
    (data.notes ? `📝 Nota: ${data.notes}\n` : '') +
    `\n⚙️ *Acções Rápidas:*\n` +
    `Para aprovar, responda com:\n` +
    `!aprovar ${data.id}\n\n` +
    `Para cancelar, responda com:\n` +
    `!cancelar ${data.id}`;

  await sendToAdmin(tenantId, msg);
}

/**
 * Notifica quando alguém pede atendimento humano
 */
async function notifyHumanRequest(tenantId, phone, clientName) {
  if (process.env.NOTIFY_HUMAN_REQUEST !== 'true') return;

  const msg =
    `👨‍💼 *Pedido de Atendente!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📞 Número: *${phone}*\n` +
    `👤 Nome: ${clientName || 'Não identificado'}\n` +
    `🕐 ${new Date().toLocaleString('pt-PT', { timeZone: config.businessHours.timezone })}\n\n` +
    `💬 O cliente está à sua espera!\n` +
    `_Abra o WhatsApp e responda directamente ao número acima._`;

  await sendToAdmin(tenantId, msg);
}

/**
 * Notifica quando alguém abre uma solicitação de suporte técnico
 */
async function notifySupportRequest(tenantId, phone, clientName, category) {
  if (process.env.NOTIFY_SUPPORT !== 'true') return;

  const categories = {
    '1': 'Problema com software/sistema',
    '2': 'Erro ou bug reportado',
    '3': 'Questão de acesso / login',
    '4': 'Lentidão ou performance',
    '5': 'Outro problema',
  };

  const msg =
    `🛠️ *Suporte Técnico Solicitado*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📞 Cliente: ${phone}\n` +
    `👤 Nome: ${clientName || 'Não identificado'}\n` +
    `🔖 Categoria: ${categories[category] || 'Não especificada'}\n` +
    `🕐 ${new Date().toLocaleString('pt-PT', { timeZone: config.businessHours.timezone })}`;

  await sendToAdmin(tenantId, msg);
}

// ══════════════════════════════════════════════════════
//  RELATÓRIO DIÁRIO AUTOMÁTICO (um relatório por tenant)
// ══════════════════════════════════════════════════════

/**
 * Gera e envia o relatório diário de UM tenant específico.
 */
async function sendDailyReportForTenant(tenantId, tenantName) {
  const db = getSupabase();
  if (!db) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // ─── Novos clientes hoje ─────────────────────────────
    const { data: newClients } = await db
      .from('clients')
      .select('id, phone, name')
      .eq('tenant_id', tenantId)
      .gte('first_contact_at', `${todayStr}T00:00:00`)
      .lte('first_contact_at', `${todayStr}T23:59:59`);

    // ─── Mensagens hoje ──────────────────────────────────
    const { data: messages } = await db
      .from('conversations')
      .select('id, direction')
      .eq('tenant_id', tenantId)
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`);

    const incoming = messages?.filter(m => m.direction === 'incoming').length || 0;
    const outgoing = messages?.filter(m => m.direction === 'outgoing').length || 0;

    // ─── Agendamentos hoje criados ───────────────────────
    const { data: appointments } = await db
      .from('appointments')
      .select('id, client_name, service_name, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`);

    // ─── Agendamentos pendentes total ────────────────────
    const { count: pendingCount } = await db
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    // ─── Total de clientes ───────────────────────────────
    const { count: totalClients } = await db
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const dateLabel = today.toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: config.businessHours.timezone,
    });

    let report =
      `📊 *Relatório Diário — ${tenantName || 'A sua empresa'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${dateLabel}\n\n` +

      `👥 *Clientes*\n` +
      `   🆕 Novos hoje: *${newClients?.length || 0}*\n` +
      `   📦 Total geral: *${totalClients ?? '—'}*\n\n` +

      `💬 *Mensagens Hoje*\n` +
      `   📩 Recebidas: *${incoming}*\n` +
      `   📤 Enviadas: *${outgoing}*\n\n` +

      `📅 *Agendamentos*\n` +
      `   🆕 Criados hoje: *${appointments?.length || 0}*\n` +
      `   ⏳ Pendentes: *${pendingCount ?? 0}*\n`;

    if (appointments && appointments.length > 0) {
      report += `\n📋 *Novos agendamentos:*\n`;
      appointments.forEach(a => {
        const icon = a.status === 'confirmed' ? '✅' : '⏳';
        report += `   ${icon} ${a.client_name} — ${a.service_name}\n`;
      });
    }

    report +=
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `_Relatório automático_ 🤖`;

    await sendToAdmin(tenantId, report);
  } catch (err) {
    logger.error(`[tenant ${tenantId}] Erro ao gerar relatório diário: ${err.message}`);
  }
}

/**
 * Gera e envia o relatório diário para TODOS os tenants com um bot
 * actualmente conectado (não faz sentido tentar enviar a quem não tem
 * sessão WhatsApp activa).
 */
async function sendDailyReport() {
  logger.info('A gerar relatórios diários por tenant...');
  try {
    const botManager = require('../bot/botManager');
    const live = botManager.listLiveSessions().filter(s => s.status === 'connected');

    if (live.length === 0) {
      logger.info('Nenhum tenant com bot conectado — relatório diário ignorado.');
      return;
    }

    const db = getSupabase();
    for (const { tenantId } of live) {
      let tenantName = null;
      if (db) {
        const { data } = await db.from('tenants').select('name').eq('id', tenantId).maybeSingle();
        tenantName = data?.name || null;
      }
      await sendDailyReportForTenant(tenantId, tenantName);
    }
    logger.info(`Relatório diário enviado a ${live.length} tenant(s)!`);
  } catch (err) {
    logger.error(`Erro ao gerar relatórios diários: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════
//  AGENDADOR DE RELATÓRIO
// ══════════════════════════════════════════════════════

let reportSchedulerRunning = false;

/**
 * Inicia o agendador que envia o relatório diário à hora configurada
 */
function startDailyReportScheduler() {
  if (reportSchedulerRunning) return;
  reportSchedulerRunning = true;

  const reportHour   = parseInt(process.env.DAILY_REPORT_HOUR)   || 18;
  const reportMinute = parseInt(process.env.DAILY_REPORT_MINUTE) || 0;

  logger.info(`Relatório diário agendado para ${String(reportHour).padStart(2,'0')}:${String(reportMinute).padStart(2,'0')}`);

  // Verifica a cada minuto se é hora de enviar
  setInterval(async () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: config.businessHours.timezone }));
    const h = now.getHours();
    const m = now.getMinutes();

    if (h === reportHour && m === reportMinute) {
      await sendDailyReport();
    }
  }, 60 * 1000); // a cada 1 minuto
}

/**
 * Notifica o admin quando o tenant atinge o limite de mensagens do plano.
 */
async function notifyLimitReached(tenantId, usage) {
  const msg =
    `🚫 *Limite de Mensagens Atingido!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📦 Plano: ${usage.planName}\n` +
    `📊 Uso: *${usage.messagesUsed.toLocaleString('pt-PT')} / ${usage.messagesLimit.toLocaleString('pt-PT')}* mensagens este mês\n\n` +
    `⚠️ O bot deixou de responder automaticamente aos seus clientes até fazer upgrade do plano ou até o início do próximo mês.\n\n` +
    `_Aceda ao painel → Plano & Ativação para fazer upgrade agora._`;

  await sendToAdmin(tenantId, msg);
}

module.exports = {
  sendToAdmin,
  notifyNewClient,
  notifyNewAppointment,
  notifyHumanRequest,
  notifySupportRequest,
  notifyLimitReached,
  sendDailyReport,
  startDailyReportScheduler,
};
