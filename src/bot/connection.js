const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode   = require('qrcode-terminal');
const fs       = require('fs');
const path     = require('path');

const config               = require('../config');
const logger               = require('../utils/logger');
const { handleMessage }    = require('./messageHandler');
const { setCurrentQR, setBotStatus } = require('./httpServer');

// Importa auth state do Supabase apenas quando necessário
let useSupabaseAuthState = null;

// Detecta ambiente de produção
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Garante que a pasta de sessões existe (para desenvolvimento local)
const SESSION_PATH = path.resolve(config.bot.sessionPath);
if (!IS_PRODUCTION && !fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

/**
 * Inicia e gere a conexão com o WhatsApp
 */
async function connectToWhatsApp() {
  try {
    let state, saveCreds;

    // ─── Auth State: Supabase (produção) ou ficheiros (local) ─────
    if (IS_PRODUCTION) {
      // Produção: sessão guardada no Supabase
      if (!useSupabaseAuthState) {
        useSupabaseAuthState = require('../services/supabaseAuthState').useSupabaseAuthState;
      }
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) throw new Error('Supabase é obrigatório em produção para guardar a sessão.');

      logger.info('A carregar sessão do Supabase...');
      const authResult = await useSupabaseAuthState(db);
      state     = authResult.state;
      saveCreds = authResult.saveCreds;
    } else {
      // Local: sessão em ficheiros (mais rápido para desenvolvimento)
      const result  = await useMultiFileAuthState(SESSION_PATH);
      state     = result.state;
      saveCreds = result.saveCreds;
    }

    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Baileys versão: ${version.join('.')} | Última: ${isLatest}`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: require('pino')({ level: 'silent' }),
      browser: ['C-Space Bot', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    // ─── EVENTOS DE CONEXÃO ──────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

      // QR Code recebido
      if (qr) {
        setCurrentQR(qr); // Expõe via HTTP /qr
        if (!IS_PRODUCTION) {
          // Em local, também imprime no terminal
          console.log('\n  🤖  BOT WHATSAPP - Escaneie o QR Code abaixo\n');
          qrcode.generate(qr, { small: true });
          console.log('\n  📱 Abra o WhatsApp > Dispositivos vinculados > Vincular dispositivo\n');
        } else {
          logger.info('QR Code gerado! Aceda a /qr no seu browser para escanear.');
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : null;

        setBotStatus('disconnected');

        logger.warn(`Conexão encerrada. Código: ${statusCode}.`);

        // ── Código 440: connectionReplaced ────────────────────────────
        // Outra instância do bot tomou a mesma sessão (ex: dois processos
        // a correr em simultâneo). Reconectar com a mesma sessão causaria
        // loop infinito de 440. A solução é limpar a sessão e gerar novo QR.
        if (statusCode === DisconnectReason.connectionReplaced) {
          logger.error('⚠️  Sessão substituída por outra instância (código 440).');
          logger.error('   Certifica-te de que só existe UMA instância do bot a correr.');

          if (IS_PRODUCTION) {
            try {
              const { getSupabase } = require('../services/supabase');
              await getSupabase()?.from('bot_auth_state').delete().neq('key', 'never');
              logger.info('Sessão limpa do Supabase. A reiniciar para novo QR...');
            } catch (e) { /* ignora */ }
            // Reinicia do zero para gerar novo QR em vez de loop
            reconnectAttempts = 0;
            logger.info('A aguardar 30s para garantir que a outra instância terminou...');
            setTimeout(connectToWhatsApp, 30000);
          } else {
            // Local: avisa e sai para o utilizador corrigir manualmente
            logger.error('Encerra o outro processo e reinicia com: npm start');
            process.exit(1);
          }
          return;
        }

        // ── Logout explícito (401) ────────────────────────────────────
        if (statusCode === DisconnectReason.loggedOut) {
          logger.error('Sessão encerrada (logout). Apague os dados de sessão e reinicie.');
          if (IS_PRODUCTION) {
            try {
              const { getSupabase } = require('../services/supabase');
              await getSupabase()?.from('bot_auth_state').delete().neq('key', 'never');
              logger.info('Sessão limpa do Supabase. Reinicia o serviço para novo QR.');
            } catch (e) { /* ignora */ }
          }
          process.exit(1);
        }

        // ── Outros erros: backoff exponencial ─────────────────────────
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          const delay = Math.min(reconnectAttempts * 5000, 60000);
          logger.info(`Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT} em ${delay / 1000}s...`);
          setTimeout(connectToWhatsApp, delay);
        } else {
          logger.error('Número máximo de tentativas atingido. A encerrar.');
          process.exit(1);
        }
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        setBotStatus('connected');
        console.log('\n  ✅  BOT CONECTADO COM SUCESSO!');
        console.log('  📞  ' + config.company.name);
        console.log('  🚀  Aguardando mensagens...\n');
        logger.info('Bot WhatsApp conectado e pronto para atendimento!');
      }

      if (connection === 'connecting') {
        setBotStatus('starting');
        logger.info('A conectar ao WhatsApp...');
      }
    });

    // ─── GUARDA CREDENCIAIS ──────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ─── MENSAGENS RECEBIDAS ─────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        if (!message.message) continue;
        if (message.key.remoteJid === 'status@broadcast') continue;
        await handleMessage(sock, message);
      }
    });

    return sock;
  } catch (err) {
    logger.error(`Erro ao iniciar conexão: ${err.message}`);
    throw err;
  }
}

function getSocket() { return sock; }

module.exports = { connectToWhatsApp, getSocket };
