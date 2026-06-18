const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { handleMessage } = require('./messageHandler');

// Garante que a pasta de sessões existe
const SESSION_PATH = path.resolve(config.bot.sessionPath);
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

/**
 * Inicia e gere a conexão com o WhatsApp
 */
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    logger.info(`Baileys versão: ${version.join('.')} | Última: ${isLatest}`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // Usamos qrcode-terminal para melhor visualização
      logger: require('pino')({ level: 'silent' }), // Silencia logs internos do Baileys
      browser: ['WhatsApp Bot TI', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    // ─── EVENTOS DE CONEXÃO ──────────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      // Exibe QR Code no terminal
      if (qr) {
        console.clear();
        console.log('\n');
        console.log('  🤖  BOT WHATSAPP - Escaneie o QR Code abaixo');
        console.log('\n');
        qrcode.generate(qr, { small: true });
        console.log('\n');
        console.log('  📱 Abra o WhatsApp > Dispositivos vinculados > Vincular dispositivo');
        console.log('\n');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : null;

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn(`Conexão encerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          const delay = Math.min(reconnectAttempts * 5000, 30000);
          logger.info(`Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT} em ${delay / 1000}s...`);
          setTimeout(connectToWhatsApp, delay);
        } else if (statusCode === DisconnectReason.loggedOut) {
          logger.error('❌ Sessão encerrada pelo WhatsApp. Apague a pasta "sessions" e reinicie.');
          process.exit(1);
        } else {
          logger.error('❌ Número máximo de tentativas de reconexão atingido.');
          process.exit(1);
        }
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        console.log('\n');
        console.log('  ✅  BOT CONECTADO COM SUCESSO!');
        console.log('  📞  ' + config.company.name);
        console.log('  🚀  Aguardando mensagens...');
        console.log('\n');
        logger.info('Bot WhatsApp conectado e pronto para atendimento!');
      }

      if (connection === 'connecting') {
        logger.info('A conectar ao WhatsApp...');
      }
    });

    // ─── GUARDA CREDENCIAIS ──────────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ─── MENSAGENS RECEBIDAS ─────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        // Ignora mensagens sem conteúdo
        if (!message.message) continue;

        // Ignora mensagens de status/broadcast
        if (message.key.remoteJid === 'status@broadcast') continue;

        // Processa a mensagem
        await handleMessage(sock, message);
      }
    });

    return sock;
  } catch (err) {
    logger.error(`Erro ao iniciar conexão: ${err.message}`);
    throw err;
  }
}

/**
 * Retorna o socket activo
 */
function getSocket() {
  return sock;
}

module.exports = { connectToWhatsApp, getSocket };
