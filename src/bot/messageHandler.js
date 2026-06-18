const { isWithinBusinessHours, getNextAvailableText } = require('../utils/timeChecker');
const { getState, setState, resetState, isInactive, setHumanMode, isHumanActive } = require('../utils/stateManager');
const { isMenuCommand, extractPhone } = require('../utils/messageFormatter');
const { upsertClient, getClientByPhone } = require('../services/clientService');
const { saveMessage } = require('../services/conversationService');
const { notifyNewClient, notifyHumanRequest, notifySupportRequest } = require('../services/notificationService');
const config = require('../config');
const logger = require('../utils/logger');

// Flows
const mainMenu = require('../flows/mainMenu');
const catalog = require('../flows/catalog');
const appointment = require('../flows/appointment');
const faq = require('../flows/faq');
const support = require('../flows/support');
const humanSupport = require('../flows/humanSupport');

/**
 * Handler principal de mensagens recebidas
 */
async function handleMessage(sock, message) {
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

    logger.info(`📩 Mensagem de ${phone}: "${text.substring(0, 50)}..."`);

    // Salva mensagem no histórico
    await saveMessage(phone, 'incoming', text, 'text', null);

    // Regista/actualiza cliente no banco de dados
    const clientResult = await upsertClient(phone);

    // Notifica admin se for novo cliente
    if (clientResult && clientResult.total_conversations === 1) {
      notifyNewClient(phone, clientResult.name).catch(() => {});
    }

    // ─── MODO HUMANO ACTIVO ───────────────────────────────────────────
    if (isHumanActive(phone)) {
      if (humanSupport.isBotResumeCommand(text)) {
        setHumanMode(phone, false);
        resetState(phone);
        const reply = humanSupport.getBotResumeMessage();
        await sendMessage(sock, jid, reply);
        await saveMessage(phone, 'outgoing', reply);
      }
      // Bot em silêncio durante atendimento humano
      return;
    }

    // ─── FORA DO HORÁRIO ──────────────────────────────────────────────
    if (!isWithinBusinessHours()) {
      const reply = mainMenu.getOutOfHoursMessage(getNextAvailableText());
      await sendMessage(sock, jid, reply);
      await saveMessage(phone, 'outgoing', reply);
      return;
    }

    // ─── TIMEOUT DE INACTIVIDADE ──────────────────────────────────────
    if (isInactive(phone, config.bot.inactivityTimeout)) {
      resetState(phone);
    }

    // ─── COMANDO DE MENU (digita "menu", "0", etc.) ──────────────────
    if (isMenuCommand(text)) {
      resetState(phone);
      const client = await getClientByPhone(phone);
      const reply = mainMenu.getWelcomeMessage(client?.name);
      await sendMessage(sock, jid, reply);
      await saveMessage(phone, 'outgoing', reply);
      return;
    }

    // ─── PROCESSA FLUXO ACTUAL ────────────────────────────────────────
    const state = getState(phone);
    await processFlow(sock, jid, phone, text, state);

  } catch (err) {
    logger.error(`Erro ao processar mensagem: ${err.message}`);
    logger.error(err.stack);
  }
}

/**
 * Processa o fluxo de conversa actual do utilizador
 */
async function processFlow(sock, jid, phone, text, state) {
  const { flow, step, data } = state;
  let reply = null;

  // ─── MENU PRINCIPAL ───────────────────────────────────────────────
  if (flow === 'main_menu') {
    if (step === 'initial' || state.isNew) {
      // Primeiro contacto → boas-vindas
      const client = await getClientByPhone(phone);
      reply = mainMenu.getWelcomeMessage(client?.name);
      setState(phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      await sendReply(sock, jid, phone, reply);
      return;
    }

    // Selecção do menu
    const route = mainMenu.processMenuSelection(text);
    if (!route) {
      reply = `⚠️ Opção inválida.\n\n` + mainMenu.getMainMenuMessage();
      await sendReply(sock, jid, phone, reply);
      return;
    }

    // Roteamento para sub-fluxo
    await routeToFlow(sock, jid, phone, route, state);
    return;
  }

  // ─── CATÁLOGO ─────────────────────────────────────────────────────
  if (flow === 'catalog') {
    if (step === 'initial') {
      const { msg, services } = await catalog.getCatalogListMessage();
      setState(phone, { flow: 'catalog', step: 'select', data: { services } });
      await sendReply(sock, jid, phone, msg);
      return;
    }

    if (step === 'select') {
      const services = data.services || [];
      const idx = parseInt(text) - 1;

      if (!isNaN(idx) && idx >= 0 && idx < services.length) {
        const service = services[idx];
        reply = catalog.getServiceDetailMessage(service);
        setState(phone, { step: 'detail', data: { ...data, currentService: service } });
        await sendReply(sock, jid, phone, reply);
        return;
      }

      // Opção inválida → relista
      const { msg, services: freshServices } = await catalog.getCatalogListMessage();
      setState(phone, { step: 'select', data: { services: freshServices } });
      await sendReply(sock, jid, phone, `⚠️ Opção inválida.\n\n` + msg);
      return;
    }

    if (step === 'detail') {
      if (text === '3') {
        // Agendar este serviço
        const preloadedService = data.currentService;
        setState(phone, {
          flow: 'appointment',
          step: 'initial',
          data: { preloadedService },
        });
        await routeToFlow(sock, jid, phone, 'appointment', getState(phone));
        return;
      }

      if (text.toLowerCase() === 'listar') {
        const { msg, services } = await catalog.getCatalogListMessage();
        setState(phone, { step: 'select', data: { services } });
        await sendReply(sock, jid, phone, msg);
        return;
      }

      // Volta ao menu principal
      resetState(phone);
      const client = await getClientByPhone(phone);
      reply = mainMenu.getWelcomeMessage(client?.name);
      setState(phone, { flow: 'main_menu', step: 'waiting', isNew: false });
      await sendReply(sock, jid, phone, reply);
      return;
    }
  }

  // ─── AGENDAMENTO ──────────────────────────────────────────────────
  if (flow === 'appointment') {
    const result = await appointment.processAppointmentFlow(text, state, phone);
    const { reply: flowReply, nextStep, dataUpdate, resetFlow, toHuman } = result;

    if (dataUpdate) {
      setState(phone, { step: nextStep, data: { ...data, ...dataUpdate } });
    } else {
      setState(phone, { step: nextStep });
    }

    if (resetFlow) resetState(phone);
    if (toHuman) setHumanMode(phone, true);

    if (flowReply) {
      await sendReply(sock, jid, phone, flowReply);
    }
    return;
  }

  // ─── FAQ ──────────────────────────────────────────────────────────
  if (flow === 'faq') {
    const result = await faq.processFAQFlow(text, state);
    const { reply: flowReply, nextStep, dataUpdate, resetFlow } = result;

    if (dataUpdate) {
      setState(phone, { step: nextStep, data: { ...data, ...dataUpdate } });
    } else {
      setState(phone, { step: nextStep });
    }

    if (resetFlow) resetState(phone);

    if (flowReply) {
      await sendReply(sock, jid, phone, flowReply);
    }
    return;
  }

  // ─── SUPORTE TÉCNICO ──────────────────────────────────────────────
  if (flow === 'support') {
    const result = await support.processSupportFlow(text, state);
    const { reply: flowReply, nextStep, dataUpdate, resetFlow, toHuman } = result;

    if (dataUpdate) {
      setState(phone, { step: nextStep, data: { ...data, ...dataUpdate } });
    } else {
      setState(phone, { step: nextStep });
    }

    if (resetFlow) resetState(phone);
    if (toHuman) {
      setHumanMode(phone, true);
      // Notifica admin sobre pedido de suporte escalado
      const client = await getClientByPhone(phone);
      notifySupportRequest(phone, client?.name, data.supportOption).catch(() => {});
    }

    if (flowReply) {
      await sendReply(sock, jid, phone, flowReply);
    }
    return;
  }

  // ─── ATENDIMENTO HUMANO ───────────────────────────────────────────
  if (flow === 'human') {
    setHumanMode(phone, true);
    return;
  }

  // Fallback → menu principal
  resetState(phone);
  const client = await getClientByPhone(phone);
  reply = mainMenu.getWelcomeMessage(client?.name);
  setState(phone, { flow: 'main_menu', step: 'waiting', isNew: false });
  await sendReply(sock, jid, phone, reply);
}

/**
 * Roteia para um novo fluxo a partir do menu principal
 */
async function routeToFlow(sock, jid, phone, route, state) {
  let reply = null;

  switch (route) {
    case 'about':
      reply = mainMenu.getAboutMessage();
      resetState(phone);
      setState(phone, { flow: 'main_menu', step: 'waiting' });
      break;

    case 'catalog':
      const { msg: catalogMsg, services } = await catalog.getCatalogListMessage();
      reply = catalogMsg;
      setState(phone, { flow: 'catalog', step: 'select', data: { services } });
      break;

    case 'appointment':
      reply = appointment.getStartMessage();
      setState(phone, { flow: 'appointment', step: 'ask_name', data: {} });
      break;

    case 'faq':
      const { msg: faqMsg, faqs } = await faq.getFAQListMessage();
      reply = faqMsg;
      setState(phone, { flow: 'faq', step: 'select', data: { faqsCache: faqs } });
      break;

    case 'support':
      reply = support.getSupportStartMessage();
      setState(phone, { flow: 'support', step: 'initial', data: {} });
      break;

    case 'human':
      reply = humanSupport.getHumanHandoffMessage();
      setHumanMode(phone, true);
      // Notifica admin sobre pedido directo de atendente
      {
        const client = await getClientByPhone(phone);
        notifyHumanRequest(phone, client?.name).catch(() => {});
      }
      break;

    default:
      reply = mainMenu.getMainMenuMessage();
      break;
  }

  if (reply) {
    await sendReply(sock, jid, phone, reply);
  }
}

/**
 * Envia mensagem e salva no histórico
 */
async function sendReply(sock, jid, phone, text) {
  await sendMessage(sock, jid, text);
  await saveMessage(phone, 'outgoing', text);
}

/**
 * Envia mensagem pelo WhatsApp
 */
async function sendMessage(sock, jid, text) {
  try {
    await sock.sendMessage(jid, { text });
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

module.exports = { handleMessage, sendMessage };
