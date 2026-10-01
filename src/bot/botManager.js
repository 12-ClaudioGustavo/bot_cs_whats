/**
 * botManager.js — MOTOR MULTI-BOT
 * ─────────────────────────────────────────────────────────────────
 * Substitui o antigo connection.js (sessão única/global).
 *
 * Mantém um Map de sessões WhatsApp em memória, uma por
 * (tenant_id, session_name), cada uma com o seu próprio socket
 * Baileys, o seu próprio QR Code e o seu próprio estado de conexão.
 *
 * Isto é o que torna possível "cada tenant tem o seu bot, o seu QR,
 * sem sobrepor conversas com outro tenant".
 */
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const pino   = require('pino');

const logger = require('../utils/logger');
const config = require('../config');

const MAX_RECONNECT = 10;
const MAX_REPLACED_RETRIES = 5;

// ─── Estado central: chave = `${tenantId}::${sessionName}` ──────────
const sessions = new Map();

// ─── Listeners de eventos (SSE por tenant, etc.) ─────────────────────
// callback(tenantId, sessionName, payload)
const listeners = new Set();

function onSessionEvent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(tenantId, sessionName, payload) {
  for (const cb of listeners) {
    try { cb(tenantId, sessionName, payload); } catch (_) {}
  }
}

function sessionKey(tenantId, sessionName) {
  return `${tenantId}::${sessionName}`;
}

/**
 * Retorna o socket activo (ou null) de um tenant/sessão.
 */
function getSocket(tenantId, sessionName = 'default') {
  return sessions.get(sessionKey(tenantId, sessionName))?.sock || null;
}

/**
 * Retorna o estado actual { status, qrDataUrl } de uma sessão.
 */
function getSessionState(tenantId, sessionName = 'default') {
  const entry = sessions.get(sessionKey(tenantId, sessionName));
  if (!entry) return { status: 'disconnected', qrDataUrl: null };
  return { status: entry.status, qrDataUrl: entry.qrDataUrl || null };
}

/**
 * Lista todas as sessões actualmente vivas em memória (debug/admin).
 */
function listLiveSessions() {
  return Array.from(sessions.entries()).map(([key, v]) => ({
    key, tenantId: v.tenantId, sessionName: v.sessionName, status: v.status,
  }));
}

/**
 * Inicia (ou reinicia) a sessão WhatsApp de um tenant.
 */
async function startSession(tenantId, sessionName = 'default') {
  if (!tenantId) throw new Error('startSession requer tenantId.');
  const key = sessionKey(tenantId, sessionName);

  const existing = sessions.get(key);
  if (existing && ['connected', 'qr', 'starting'].includes(existing.status)) {
    logger.info(`[${key}] Sessão já activa (status=${existing.status}) — ignorando novo start.`);
    return existing;
  }

  const entry = {
    tenantId,
    sessionName,
    sock: null,
    status: 'starting',
    qrDataUrl: null,
    reconnectAttempts: 0,
    replacedRetries: 0,
    clearAuthState: null,
  };
  sessions.set(key, entry);
  emit(tenantId, sessionName, { status: 'starting', qrDataUrl: null });
  await syncStatus(entry, { status: 'starting' });

  await connect(entry);
  return entry;
}

async function connect(entry) {
  const { tenantId, sessionName } = entry;
  const key = sessionKey(tenantId, sessionName);

  try {
    const { getSupabase } = require('../services/supabase');
    const db = getSupabase();
    if (!db) throw new Error('Supabase é obrigatório para o motor multi-bot (guarda a sessão de cada tenant).');

    const { useSupabaseAuthState } = require('../services/supabaseAuthState');
    const { state, saveCreds, clearAuthState } = await useSupabaseAuthState(db, tenantId, sessionName);
    entry.clearAuthState = clearAuthState;

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: [`C-Space Bot`, 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    entry.sock = sock;
    sock.tenantId = tenantId;
    sock.sessionName = sessionName;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      await handleConnectionUpdate(entry, update);
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      const { handleMessage } = require('./messageHandler');
      for (const message of messages) {
        if (!message.message) continue;
        if (message.key.remoteJid === 'status@broadcast') continue;
        try {
          await handleMessage(sock, message);
        } catch (err) {
          logger.error(`[${key}] Erro ao processar mensagem: ${err.message}`);
        }
      }
    });
  } catch (err) {
    logger.error(`[${key}] Erro ao iniciar conexão: ${err.message}`);
    entry.status = 'disconnected';
    emit(tenantId, sessionName, { status: 'disconnected', qrDataUrl: null, error: err.message });
    await syncStatus(entry, { status: 'disconnected' });
  }
}

async function handleConnectionUpdate(entry, { connection, lastDisconnect, qr }) {
  const { tenantId, sessionName, sock } = entry;
  const key = sessionKey(tenantId, sessionName);
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';

  if (qr) {
    entry.status = 'qr';
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2, color: { dark: '#000', light: '#FFF' } });
      entry.qrDataUrl = qrDataUrl;
      emit(tenantId, sessionName, { status: 'qr', qrDataUrl });
      await syncStatus(entry, { status: 'qr', qrCodeUrl: qrDataUrl });
      logger.info(`[${key}] QR Code gerado.`);
    } catch (e) {
      logger.error(`[${key}] Erro ao gerar QR DataURL: ${e.message}`);
    }
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error instanceof Boom
      ? lastDisconnect.error.output.statusCode
      : null;

    entry.status = 'disconnected';
    emit(tenantId, sessionName, { status: 'disconnected', qrDataUrl: null });
    await syncStatus(entry, { status: 'disconnected' });
    logger.warn(`[${key}] Conexão encerrada. Código: ${statusCode}.`);

    // ── 440: sessão substituída noutro lugar ────────────────────
    if (statusCode === DisconnectReason.connectionReplaced) {
      entry.replacedRetries += 1;
      if (entry.replacedRetries >= MAX_REPLACED_RETRIES) {
        logger.error(`[${key}] 5 erros 440 consecutivos. A limpar sessão — será preciso novo QR.`);
        if (entry.clearAuthState) await entry.clearAuthState();
        entry.replacedRetries = 0;
        sessions.delete(sessionKey(tenantId, sessionName));
        return;
      }
      setTimeout(() => connect(entry), 60000);
      return;
    }

    // ── Logout explícito (401) ───────────────────────────────────
    if (statusCode === DisconnectReason.loggedOut) {
      logger.error(`[${key}] Sessão encerrada (logout do WhatsApp).`);
      if (entry.clearAuthState) await entry.clearAuthState();
      sessions.delete(sessionKey(tenantId, sessionName));
      const whatsappSessionService = require('../services/whatsappSessionService');
      await whatsappSessionService.deleteSession(tenantId, sessionName);
      return;
    }

    // ── Outros erros: backoff exponencial, até MAX_RECONNECT ─────
    if (entry.reconnectAttempts < MAX_RECONNECT) {
      entry.reconnectAttempts += 1;
      const delay = Math.min(entry.reconnectAttempts * 5000, 60000);
      logger.info(`[${key}] Reconectando (${entry.reconnectAttempts}/${MAX_RECONNECT}) em ${delay / 1000}s...`);
      setTimeout(() => connect(entry), delay);
    } else {
      logger.error(`[${key}] Máximo de tentativas de reconexão atingido. Sessão parada.`);
      sessions.delete(sessionKey(tenantId, sessionName));
    }
  }

  if (connection === 'open') {
    entry.reconnectAttempts = 0;
    entry.replacedRetries = 0;
    entry.status = 'connected';
    entry.qrDataUrl = null;

    const rawPhone = sock?.user?.id ? sock.user.id.split(':')[0] : null;
    emit(tenantId, sessionName, { status: 'connected', qrDataUrl: null, phoneNumber: rawPhone });
    await syncStatus(entry, { status: 'connected', phoneNumber: rawPhone, qrCodeUrl: null });
    logger.info(`[${key}] ✅ Bot conectado (${rawPhone || 'sem número'}).`);
  }

  if (connection === 'connecting') {
    entry.status = 'starting';
    emit(tenantId, sessionName, { status: 'starting', qrDataUrl: null });
    await syncStatus(entry, { status: 'starting' });
  }
}

async function syncStatus(entry, { status, phoneNumber, qrCodeUrl }) {
  try {
    const whatsappSessionService = require('../services/whatsappSessionService');
    await whatsappSessionService.syncSessionStatus({
      tenantId: entry.tenantId,
      sessionName: entry.sessionName,
      status,
      phoneNumber,
      qrCodeUrl,
    });
  } catch (_) { /* já logado dentro do service */ }
}

/**
 * Termina e apaga completamente a sessão de um tenant (logout real).
 */
async function stopSession(tenantId, sessionName = 'default') {
  const key = sessionKey(tenantId, sessionName);
  const entry = sessions.get(key);
  if (!entry) return false;

  try {
    if (entry.sock) {
      try { await entry.sock.logout(); } catch (_) { /* já pode estar desconectado */ }
      try { entry.sock.end(undefined); } catch (_) {}
    }
    if (entry.clearAuthState) await entry.clearAuthState();
  } finally {
    sessions.delete(key);
  }

  const whatsappSessionService = require('../services/whatsappSessionService');
  await whatsappSessionService.deleteSession(tenantId, sessionName);
  emit(tenantId, sessionName, { status: 'disconnected', qrDataUrl: null });
  logger.info(`[${key}] Sessão parada e credenciais apagadas.`);
  return true;
}

/**
 * No arranque do processo, volta a ligar todas as sessões que estavam
 * activas (status != disconnected) antes do último restart/deploy.
 */
async function bootAllTenants() {
  try {
    const whatsappSessionService = require('../services/whatsappSessionService');
    const all = await whatsappSessionService.getAllSessions();
    const toResume = all.filter(s => s.status && s.status !== 'disconnected');

    if (toResume.length === 0) {
      logger.info('Nenhuma sessão anterior para retomar.');
      return;
    }

    logger.info(`A retomar ${toResume.length} sessão(ões) WhatsApp existente(s)...`);
    for (const s of toResume) {
      // pequeno espaçamento entre arranques para não sobrecarregar no boot
      startSession(s.tenant_id, s.session_name).catch(err =>
        logger.error(`Falha ao retomar sessão ${s.tenant_id}/${s.session_name}: ${err.message}`)
      );
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (err) {
    logger.error(`Erro ao retomar sessões no arranque: ${err.message}`);
  }
}

module.exports = {
  startSession,
  stopSession,
  bootAllTenants,
  getSocket,
  getSessionState,
  listLiveSessions,
  onSessionEvent,
};
