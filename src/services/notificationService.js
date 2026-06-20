// NOTA: getSocket é importado de forma lazy dentro de sendToAdmin
// para evitar dependência circular entre connection.js e notificationService.js
const { getSupabase } = require('./supabase');
const { formatJid } = require('../utils/messageFormatter');
const config = require('../config');
const logger = require('../utils/logger');

// Número do admin que recebe as notificações
const ADMIN_PHONE = process.env.ADMIN_PHONE || config.human.phone;

/**
 * Envia uma mensagem para o número do admin
 */
async function sendToAdmin(message) {
  try {
    // Require lazy para evitar dependência circular com connection.js
    const { getSocket } = require('../bot/connection');
    const sock = getSocket();
    if (!sock) {
      logger.warn('Notificação ignorada: bot não conectado.');
      return false;
    }
    const jid = formatJid(ADMIN_PHONE);
    await sock.sendMessage(jid, { text: message });
    logger.info(`Notificação enviada para admin (${ADMIN_PHONE})`);
    return true;
  } catch (err) {
    logger.error(`Erro ao enviar notificação: ${err.message}`);
    return false;
  }
}

// ══════════════════════════════════════════════════════
//  NOTIFICAÇÕES EM TEMPO REAL
// ══════════════════════════════════════════════════════

/**
 * Notifica quando um novo cliente entra em contacto pela primeira vez
 */
async function notifyNewClient(phone, name) {
  if (process.env.NOTIFY_NEW_CLIENT !== 'true') return;

  const msg =
    `🆕 *Novo Cliente!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📞 Telefone: ${phone}\n` +
    `👤 Nome: ${name || 'Não identificado ainda'}\n` +
    `🕐 ${new Date().toLocaleString('pt-PT', { timeZone: config.businessHours.timezone })}\n\n` +
    `_Aceda ao painel admin para ver o histórico_`;

  await sendToAdmin(msg);
}

/**
 * Notifica quando um agendamento é criado
 */
async function notifyNewAppointment(data) {
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

  await sendToAdmin(msg);
}

/**
 * Notifica quando alguém pede atendimento humano
 */
async function notifyHumanRequest(phone, clientName) {
  if (process.env.NOTIFY_HUMAN_REQUEST !== 'true') return;

  const msg =
    `👨‍💼 *Pedido de Atendente!*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📞 Número: *${phone}*\n` +
    `👤 Nome: ${clientName || 'Não identificado'}\n` +
    `🕐 ${new Date().toLocaleString('pt-PT', { timeZone: config.businessHours.timezone })}\n\n` +
    `💬 O cliente está à sua espera!\n` +
    `_Abra o WhatsApp e responda directamente ao número acima._`;

  await sendToAdmin(msg);
}

/**
 * Notifica quando alguém abre uma solicitação de suporte técnico
 */
async function notifySupportRequest(phone, clientName, category) {
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

  await sendToAdmin(msg);
}

// ══════════════════════════════════════════════════════
//  RELATÓRIO DIÁRIO AUTOMÁTICO
// ══════════════════════════════════════════════════════

/**
 * Gera e envia o relatório diário
 */
async function sendDailyReport() {
  const db = getSupabase();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  logger.info('A gerar relatório diário...');

  try {
    // ─── Novos clientes hoje ─────────────────────────────
    const { data: newClients } = await db
      .from('clients')
      .select('id, phone, name')
      .gte('first_contact_at', `${todayStr}T00:00:00`)
      .lte('first_contact_at', `${todayStr}T23:59:59`);

    // ─── Mensagens hoje ──────────────────────────────────
    const { data: messages } = await db
      .from('conversations')
      .select('id, direction')
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`);

    const incoming = messages?.filter(m => m.direction === 'incoming').length || 0;
    const outgoing = messages?.filter(m => m.direction === 'outgoing').length || 0;

    // ─── Agendamentos hoje criados ───────────────────────
    const { data: appointments } = await db
      .from('appointments')
      .select('id, client_name, service_name, status')
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`);

    // ─── Agendamentos pendentes total ────────────────────
    const { data: pending } = await db
      .from('appointments')
      .select('id')
      .eq('status', 'pending');

    // ─── Total de clientes ───────────────────────────────
    const { data: totalClientsData } = await db
      .from('clients')
      .select('id', { count: 'exact', head: true });

    const dateLabel = today.toLocaleDateString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: config.businessHours.timezone,
    });

    let report =
      `📊 *Relatório Diário — C-Space*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${dateLabel}\n\n` +

      `👥 *Clientes*\n` +
      `   🆕 Novos hoje: *${newClients?.length || 0}*\n` +
      `   📦 Total geral: *${totalClientsData?.length || '—'}*\n\n` +

      `💬 *Mensagens Hoje*\n` +
      `   📩 Recebidas: *${incoming}*\n` +
      `   📤 Enviadas: *${outgoing}*\n\n` +

      `📅 *Agendamentos*\n` +
      `   🆕 Criados hoje: *${appointments?.length || 0}*\n` +
      `   ⏳ Pendentes: *${pending?.length || 0}*\n`;

    // Lista agendamentos do dia
    if (appointments && appointments.length > 0) {
      report += `\n📋 *Novos agendamentos:*\n`;
      appointments.forEach(a => {
        const icon = a.status === 'confirmed' ? '✅' : '⏳';
        report += `   ${icon} ${a.client_name} — ${a.service_name}\n`;
      });
    }

    report +=
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `_Relatório automático — C-Space Bot_ 🤖`;

    await sendToAdmin(report);
    logger.info('Relatório diário enviado!');
  } catch (err) {
    logger.error(`Erro ao gerar relatório: ${err.message}`);
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

module.exports = {
  sendToAdmin,
  notifyNewClient,
  notifyNewAppointment,
  notifyHumanRequest,
  notifySupportRequest,
  sendDailyReport,
  startDailyReportScheduler,
};
