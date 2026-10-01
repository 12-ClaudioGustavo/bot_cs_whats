// Bot opera 24/7 — sem restrição de horário
const { getState, setState, resetState, isInactive, setHumanMode, isHumanActive } = require('../utils/stateManager');
const { isMenuCommand, extractPhone } = require('../utils/messageFormatter');
const { upsertClient, getClientByPhone } = require('../services/clientService');
const { saveMessage } = require('../services/conversationService');
const { notifyNewClient, notifyHumanRequest, notifySupportRequest, notifyLimitReached } = require('../services/notificationService');
const { getSupabase } = require('../services/supabase');
const { formatJid } = require('../utils/messageFormatter');
const tenantService = require('../services/tenantService');
const config = require('../config');
const logger = require('../utils/logger');

// Flows
const mainMenu = require('../flows/mainMenu');
const catalog = require('../flows/catalog');
const appointment = require('../flows/appointment');
const faq = require('../flows/faq');
const support = require('../flows/support');
const humanSupport = require('../flows/humanSupport');

// Evita inundar o admin com notificações a cada mensagem recebida depois
// de estourar o limite — um aviso basta a cada 6 horas por tenant.
const ADMIN_LIMIT_NOTICE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const lastLimitNoticeAt = new Map(); // tenantId -> timestamp

/**
 * Handler principal de mensagens recebidas.
 *
 * IMPORTANTE: `sock.tenantId` é definido pelo botManager quando a sessão é
 * criada. É o que garante que cada mensagem é processada, guardada e
 * respondida dentro dos dados do tenant correcto — sem sobrepor
 * conversas entre empresas diferentes que partilham a mesma plataforma.
 */
async function handleMessage(sock, message) {
  const tenantId = sock.tenantId || tenantService.DEFAULT_TENANT_ID;

  try {
    // Extrai informações da mensagem
    const jid = message.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    // Ignora mensagens de grupos
    if (isGroup) return;

    // Ignora mensagens enviadas pelo próprio bot
    if (message.key.fromMe) return;

    const phone = extractPhone(jid);
    const msgContent = message.message;

    // Extrai o texto da mensagem
    const text = extractText(msgContent);
    if (!text) return; // Ignora mensagens sem texto (stickers, etc.)

    logger.info(`📩 [tenant ${tenantId}] Mensagem de ${phone}: "${text.substring(0, 50)}..."`);

    // Salva mensagem no histórico
    await saveMessage(tenantId, phone, 'incoming', text, 'text', null);

    // ─── COMANDOS DE ADMINISTRAÇÃO DIRETA ─────────────────────────────
    const ADMIN_PHONE = await getTenantAdminPhone(tenantId);
    if (ADMIN_PHONE && phone === ADMIN_PHONE && text.startsWith('!')) {
      await processAdminCommand(sock, tenantId, jid, text);
      return;
    }

    // ─── LIMITE DE MENSAGENS DO PLANO ──────────────────────────────────
    // O admin (acima) continua a conseguir operar (!aprovar/!cancelar);
    // só o atendimento automático a clientes é cortado.
    const usage = await tenantService.getUsageStatus(tenantId);
    if (usage.limitReached) {
      await handleLimitReached(sock, tenantId, jid, phone, usage);
      return;
    }

    // Regista/actualiza cliente no banco de dados
    const clientResult = await upsertClient(tenantId, phone);

    // Notifica admin se for novo cliente
    if (clientResult && clientResult.total_conversations === 1) {
      notifyNewClient(tenantId, phone, clientResult.name).catch(() => {});
    }

    // ─── MODO HUMANO ACTIVO ───────────────────────────────────────────
    if (isHumanActive(tenantId, phone)) {
      if (humanSupport.isBotResumeCommand(text)) {
        setHumanMode(tenantId, phone, false);
        resetState(tenantId, phone);
        setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
        const reply = humanSupport.getBotResumeMessage();
        await sendMessage(sock, jid, reply, tenantId);
        await saveMessage(tenantId, phone, 'outgoing', reply);
      }
      // Bot em silêncio durante atendimento humano
      return;
    }

    // ─── TIMEOUT DE INACTIVIDADE ──────────────────────────────────────
    if (isInactive(tenantId, phone, config.bot.inactivityTimeout)) {
      resetState(tenantId, phone);
    }

    // ─── COMANDO DE MENU (digita "menu", "0", etc.) ──────────────────
    if (isMenuCommand(text)) {
      resetState(tenantId, phone);
      setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      const client = await getClientByPhone(tenantId, phone);
      const reply = await mainMenu.getWelcomeMessage(tenantId, client?.name);
      await sendMessage(sock, jid, reply, tenantId);
      await saveMessage(tenantId, phone, 'outgoing', reply);
      return;
    }

    // ─── PROCESSA FLUXO ACTUAL ────────────────────────────────────────
    const state = getState(tenantId, phone);
    await processFlow(sock, tenantId, jid, phone, text, state);

  } catch (err) {
    logger.error(`[tenant ${tenantId}] Erro ao processar mensagem: ${err.message}`);
    logger.error(err.stack);
  }
}

/**
 * Chamado quando o tenant já estourou o limite mensal de mensagens do
 * plano. O bot deixa de processar o fluxo normal — o cliente recebe UM
 * único aviso (não repete a cada mensagem), e o admin é notificado com
 * um intervalo mínimo entre avisos.
 */
async function handleLimitReached(sock, tenantId, jid, phone, usage) {
  const state = getState(tenantId, phone);

  // Evita reenviar o aviso ao mesmo cliente repetidamente — só uma vez
  // por "sessão" de estado (reseta se o cliente ficar inactivo/voltar).
  if (!state.data?.limitNoticeShown) {
    const notice =
      `⚠️ *Atendimento automático temporariamente indisponível*\n\n` +
      `A nossa empresa atingiu o limite de mensagens do seu plano este mês. ` +
      `A nossa equipa já foi notificada e vai retomar o atendimento em breve.\n\n` +
      `Pedimos desculpa pelo inconveniente.`;

    try {
      await sock.sendMessage(jid, { text: notice });
      await saveMessage(tenantId, phone, 'outgoing', notice);
    } catch (err) {
      logger.error(`[tenant ${tenantId}] Erro ao enviar aviso de limite: ${err.message}`);
    }

    setState(tenantId, phone, { data: { ...state.data, limitNoticeShown: true } });
  }

  // Notifica o admin, no máximo, uma vez a cada N horas por tenant.
  const now = Date.now();
  const last = lastLimitNoticeAt.get(tenantId) || 0;
  if (now - last > ADMIN_LIMIT_NOTICE_COOLDOWN_MS) {
    lastLimitNoticeAt.set(tenantId, now);
    notifyLimitReached(tenantId, usage).catch(() => {});
  }

  logger.warn(`[tenant ${tenantId}] Mensagem de ${phone} ignorada — limite do plano atingido (${usage.messagesUsed}/${usage.messagesLimit}).`);
}

/**
 * Processa o fluxo de conversa actual do utilizador
 */
async function processFlow(sock, tenantId, jid, phone, text, state) {
  const { flow, step, data } = state;
  let reply = null;

  // ─── MENU PRINCIPAL ───────────────────────────────────────────────
  if (flow === 'main_menu') {
    if (step === 'ask_name') {
      const { updateClientName } = require('../services/clientService');
      const clientName = text.trim();
      await updateClientName(tenantId, phone, clientName);
      reply = await mainMenu.getWelcomeMessage(tenantId, clientName);
      setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      await sendReply(sock, tenantId, jid, phone, reply);
      return;
    }

    if (step === 'initial' || state.isNew) {
      const client = await getClientByPhone(tenantId, phone);
      if (!client?.name || client.name === 'Cliente Sem Nome') {
        reply = `👋 *Bem-vindo(a) ao nosso atendimento!*\n\nAntes de começarmos, por favor diga-nos o seu nome:\n_(Escreva o seu nome abaixo)_ 👇`;
        setState(tenantId, phone, { flow: 'main_menu', step: 'ask_name', isNew: false });
        await sendReply(sock, tenantId, jid, phone, reply);
        return;
      }
      reply = await mainMenu.getWelcomeMessage(tenantId, client.name);
      setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      await sendReply(sock, tenantId, jid, phone, reply);
      return;
    }

    // Selecção do menu
    const route = mainMenu.processMenuSelection(text);
    if (!route) {
      reply = `⚠️ Opção inválida.\n\n` + mainMenu.getMainMenuMessage();
      await sendReply(sock, tenantId, jid, phone, reply);
      return;
    }

    // Roteamento para sub-fluxo
    await routeToFlow(sock, tenantId, jid, phone, route, state);
    return;
  }

  // ─── CATÁLOGO ─────────────────────────────────────────────────────
  if (flow === 'catalog') {
    if (step === 'initial') {
      const { msg, services } = await catalog.getCatalogListMessage(tenantId);
      setState(tenantId, phone, { flow: 'catalog', step: 'select', data: { services } });
      await sendReply(sock, tenantId, jid, phone, msg);
      return;
    }

    if (step === 'select') {
      const services = data.services || [];
      const idx = parseInt(text) - 1;

      if (!isNaN(idx) && idx >= 0 && idx < services.length) {
        const service = services[idx];
        reply = catalog.getServiceDetailMessage(service);
        setState(tenantId, phone, { step: 'detail', data: { ...data, currentService: service } });
        await sendReply(sock, tenantId, jid, phone, reply);
        return;
      }

      // Opção inválida → relista
      const { msg, services: freshServices } = await catalog.getCatalogListMessage(tenantId);
      setState(tenantId, phone, { step: 'select', data: { services: freshServices } });
      await sendReply(sock, tenantId, jid, phone, `⚠️ Opção inválida.\n\n` + msg);
      return;
    }

    if (step === 'detail') {
      if (text === '3') {
        // Agendar este serviço
        const preloadedService = data.currentService;
        setState(tenantId, phone, {
          flow: 'appointment',
          step: 'initial',
          data: { preloadedService },
        });
        await routeToFlow(sock, tenantId, jid, phone, 'appointment', getState(tenantId, phone));
        return;
      }

      if (text.toLowerCase() === 'listar') {
        const { msg, services } = await catalog.getCatalogListMessage(tenantId);
        setState(tenantId, phone, { step: 'select', data: { services } });
        await sendReply(sock, tenantId, jid, phone, msg);
        return;
      }

      // Volta ao menu principal
      resetState(tenantId, phone);
      const client = await getClientByPhone(tenantId, phone);
      reply = await mainMenu.getWelcomeMessage(tenantId, client?.name);
      setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      await sendReply(sock, tenantId, jid, phone, reply);
      return;
    }
  }

  // ─── AGENDAMENTO ──────────────────────────────────────────────────
  if (flow === 'appointment') {
    const result = await appointment.processAppointmentFlow(tenantId, text, state, phone);
    const { reply: flowReply, nextStep, dataUpdate, resetFlow, toHuman } = result;

    if (dataUpdate) {
      setState(tenantId, phone, { step: nextStep, data: { ...data, ...dataUpdate } });
    } else {
      setState(tenantId, phone, { step: nextStep });
    }

    if (resetFlow) resetState(tenantId, phone);
    if (toHuman) setHumanMode(tenantId, phone, true);

    if (flowReply) {
      await sendReply(sock, tenantId, jid, phone, flowReply);
    }
    return;
  }

  // ─── FAQ ──────────────────────────────────────────────────────────
  if (flow === 'faq') {
    const result = await faq.processFAQFlow(tenantId, text, state);
    const { reply: flowReply, nextStep, dataUpdate, resetFlow } = result;

    if (dataUpdate) {
      setState(tenantId, phone, { step: nextStep, data: { ...data, ...dataUpdate } });
    } else {
      setState(tenantId, phone, { step: nextStep });
    }

    if (resetFlow) resetState(tenantId, phone);

    if (flowReply) {
      await sendReply(sock, tenantId, jid, phone, flowReply);
    }
    return;
  }

  // ─── SUPORTE TÉCNICO ──────────────────────────────────────────────
  if (flow === 'support') {
    const result = await support.processSupportFlow(text, state);
    const { reply: flowReply, nextStep, dataUpdate, resetFlow, toHuman } = result;

    if (dataUpdate) {
      setState(tenantId, phone, { step: nextStep, data: { ...data, ...dataUpdate } });
    } else {
      setState(tenantId, phone, { step: nextStep });
    }

    if (resetFlow) resetState(tenantId, phone);
    if (toHuman) {
      setHumanMode(tenantId, phone, true);
      // Notifica admin sobre pedido de suporte escalado
      const client = await getClientByPhone(tenantId, phone);
      notifySupportRequest(tenantId, phone, client?.name, data.supportOption).catch(() => {});
    }

    if (flowReply) {
      await sendReply(sock, tenantId, jid, phone, flowReply);
    }
    return;
  }

  // ─── ATENDIMENTO HUMANO ───────────────────────────────────────────
  if (flow === 'human') {
    setHumanMode(tenantId, phone, true);
    return;
  }

  // Fallback → menu principal
  resetState(tenantId, phone);
  const client = await getClientByPhone(tenantId, phone);
  reply = await mainMenu.getWelcomeMessage(tenantId, client?.name);
  setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
  await sendReply(sock, tenantId, jid, phone, reply);
}

/**
 * Roteia para um novo fluxo a partir do menu principal
 */
async function routeToFlow(sock, tenantId, jid, phone, route, state) {
  let reply = null;

  switch (route) {
    case 'about':
      reply = await mainMenu.getAboutMessage(tenantId);
      resetState(tenantId, phone);
      setState(tenantId, phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      break;

    case 'catalog':
      const { msg: catalogMsg, services } = await catalog.getCatalogListMessage(tenantId);
      reply = catalogMsg;
      setState(tenantId, phone, { flow: 'catalog', step: 'select', data: { services } });
      break;

    case 'appointment':
      reply = appointment.getStartMessage();
      setState(tenantId, phone, { flow: 'appointment', step: 'ask_name', data: {} });
      break;

    case 'faq':
      const { msg: faqMsg, faqs } = await faq.getFAQListMessage(tenantId);
      reply = faqMsg;
      setState(tenantId, phone, { flow: 'faq', step: 'select', data: { faqsCache: faqs } });
      break;

    case 'support':
      reply = support.getSupportStartMessage();
      setState(tenantId, phone, { flow: 'support', step: 'initial', data: {} });
      break;

    case 'human':
      reply = humanSupport.getHumanHandoffMessage();
      setHumanMode(tenantId, phone, true);
      // Notifica admin sobre pedido directo de atendente
      {
        const client = await getClientByPhone(tenantId, phone);
        notifyHumanRequest(tenantId, phone, client?.name).catch(() => {});
      }
      break;

    default:
      reply = mainMenu.getMainMenuMessage();
      break;
  }

  if (reply) {
    await sendReply(sock, tenantId, jid, phone, reply);
  }
}

/**
 * Envia mensagem e salva no histórico
 */
async function sendReply(sock, tenantId, jid, phone, text) {
  await sendMessage(sock, jid, text, tenantId);
  await saveMessage(tenantId, phone, 'outgoing', text);
}

/**
 * Envia mensagem pelo WhatsApp e regista o consumo no plano do tenant
 */
async function sendMessage(sock, jid, text, tenantId) {
  try {
    await sock.sendMessage(jid, { text });

    // Regista o consumo da mensagem no log DESTE tenant (essencial para o
    // limite mensal do plano funcionar correctamente por empresa).
    const effectiveTenantId = tenantId || sock.tenantId || tenantService.DEFAULT_TENANT_ID;
    tenantService.recordMessageUsage(effectiveTenantId, 'outgoing').catch(() => {});
  } catch (err) {
    logger.error(`Erro ao enviar mensagem para ${jid}: ${err.message}`);
  }
}

/**
 * Extrai texto de diferentes tipos de mensagem do WhatsApp
 */
function extractText(msgContent) {
  if (!msgContent) return null;

  return (
    msgContent.conversation ||
    msgContent.extendedTextMessage?.text ||
    msgContent.imageMessage?.caption ||
    msgContent.videoMessage?.caption ||
    msgContent.documentMessage?.caption ||
    null
  );
}

/**
 * Busca o número de telefone do administrador deste tenant
 * (usado para os comandos !aprovar / !cancelar directo pelo WhatsApp).
 */
async function getTenantAdminPhone(tenantId) {
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

/**
 * Processa comandos enviados pelo administrador do tenant
 */
async function processAdminCommand(sock, tenantId, adminJid, text) {
  const parts = text.trim().split(' ');
  const command = parts[0].toLowerCase();
  const id = parts[1];

  if ((command === '!aprovar' || command === '!cancelar') && id) {
    const db = getSupabase();
    if (!db) return;

    const newStatus = command === '!aprovar' ? 'confirmed' : 'cancelled';

    // 1. Atualiza no Supabase (sempre dentro do tenant do bot que recebeu o comando)
    const { data: appointmentData, error } = await db
      .from('appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !appointmentData) {
      await sendMessage(sock, adminJid, `❌ Agendamento não encontrado ou erro ao actualizar: ${id}`, tenantId);
      return;
    }

    // 2. Confirma para o admin
    const statusText = newStatus === 'confirmed' ? '✅ APROVADO' : '❌ CANCELADO';
    await sendMessage(sock, adminJid, `Agendamento de ${appointmentData.client_name} foi ${statusText}!`, tenantId);

    // 3. Notifica o cliente
    const clientJid = formatJid(appointmentData.phone);
    let clientMsg = '';

    if (newStatus === 'confirmed') {
      clientMsg = `✅ *AGENDAMENTO CONFIRMADO!*\n\nOlá ${appointmentData.client_name},\nO seu agendamento para o serviço de *${appointmentData.service_name}* no dia *${appointmentData.scheduled_date}* às *${appointmentData.scheduled_time}* foi confirmado com sucesso.\n\nAguardamos por si!`;
    } else {
      clientMsg = `❌ *AGENDAMENTO CANCELADO*\n\nOlá ${appointmentData.client_name},\nInfelizmente o seu agendamento para *${appointmentData.service_name}* no dia *${appointmentData.scheduled_date}* teve de ser cancelado. Por favor, tente remarcar para outra data ou contacte o nosso suporte.`;
    }

    await sendMessage(sock, clientJid, clientMsg, tenantId);
    await saveMessage(tenantId, appointmentData.phone, 'outgoing', clientMsg);
  } else {
    await sendMessage(sock, adminJid, `⚠️ Comando inválido. Use !aprovar <id> ou !cancelar <id>`, tenantId);
  }
}

module.exports = { handleMessage, sendMessage };
