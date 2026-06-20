require('dotenv').config();
const { connectToWhatsApp } = require('./connection');
const config = require('../config');
const logger = require('../utils/logger');

// ─── FILTRO DE RUÍDO DO BAILEYS/LIBSIGNAL ────────────────
// Estas mensagens são inofensivas e apenas poluem o terminal
const NOISE_PATTERNS = [
  // libsignal / session crypto
  'Failed to decrypt message',
  'MessageCounterError',
  'Bad MAC',
  'Closing open session',
  'Closing session:',
  'Decrypted message with closed session',
  'SessionEntry',
  '_chains:',
  'chainKey:',
  'chainType:',
  'messageKeys:',
  'registrationId:',
  'currentRatchet:',
  'ephemeralKeyPair:',
  'lastRemoteEphemeralKey:',
  'previousCounter:',
  'rootKey:',
  'indexInfo:',
  'baseKey:',
  'baseKeyType:',
  'remoteIdentityKey:',
  'pubKey:',
  'privKey:',
  'pendingPreKey:',
  'signedKeyId:',
  'preKeyId:',
  // buffers binários
  '<Buffer',
];

const _origError = console.error.bind(console);
const _origWarn  = console.warn.bind(console);
const _origLog   = console.log.bind(console);

function isNoise(args) {
  const str = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  return NOISE_PATTERNS.some(p => str.includes(p));
}

console.error = (...args) => { if (!isNoise(args)) _origError(...args); };
console.warn  = (...args) => { if (!isNoise(args)) _origWarn(...args); };
console.log   = (...args) => { if (!isNoise(args)) _origLog(...args); };
// ─────────────────────────────────────────────────────────

// Banner de início
console.log('\n');
console.log('  🤖  BOT DE ATENDIMENTO WHATSAPP');
console.log('  📍  ' + config.company.name);
console.log('  🚀  A iniciar...');
console.log('\n');

// Verifica configurações mínimas
if (!config.supabase.url || !config.supabase.serviceKey) {
  logger.warn('⚠️  Supabase não configurado no .env — operando sem banco de dados.');
  logger.warn('    Configure SUPABASE_URL e SUPABASE_SERVICE_KEY para persistência.');
  console.log('\n');
}

// Inicia servidor HTTP (obrigatório para Render + expõe QR Code)
const { startHttpServer } = require('./httpServer');
startHttpServer().catch(err => logger.error(`Erro no servidor HTTP: ${err.message}`));

// Inicia agendador do relatório diário
const { startDailyReportScheduler } = require('../services/notificationService');
startDailyReportScheduler();

// Inicia o bot — com delay em produção para evitar conflito de instâncias
// (o Render faz zero-downtime: nova instância sobe ANTES da antiga morrer)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const STARTUP_DELAY = IS_PRODUCTION ? 20000 : 0; // 20s em prod, 0 em local

if (STARTUP_DELAY > 0) {
  logger.info(`⏳ Aguardando ${STARTUP_DELAY / 1000}s antes de conectar (evitar conflito de instâncias)...`);
}

setTimeout(() => {
  connectToWhatsApp().catch(err => {
    logger.error(`Erro fatal ao iniciar o bot: ${err.message}`);
    process.exit(1);
  });
}, STARTUP_DELAY);

// Gestão de encerramentos graceful
process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM. Encerrando bot...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('\nEncerrando bot...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error(`Erro não tratado: ${err.message}`);
  logger.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Promise rejeitada: ${reason}`);
});
