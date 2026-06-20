require('dotenv').config();
const { connectToWhatsApp } = require('./connection');
const config = require('../config');
const logger = require('../utils/logger');

// ─── FILTRO DE RUÍDO DO BAILEYS/LIBSIGNAL ────────────────
// Estas mensagens são inofensivas e apenas poluem o terminal.
// O libsignal escreve DIRECTAMENTE em process.stdout/stderr,
// contornando console.log — por isso filtramos ao nível do stream.
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

function isNoiseStr(str) {
  return NOISE_PATTERNS.some(p => str.includes(p));
}

function isNoise(args) {
  try {
    const str = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    return isNoiseStr(str);
  } catch { return false; }
}

// Filtro ao nível do console
const _origError = console.error.bind(console);
const _origWarn  = console.warn.bind(console);
const _origLog   = console.log.bind(console);
console.error = (...args) => { if (!isNoise(args)) _origError(...args); };
console.warn  = (...args) => { if (!isNoise(args)) _origWarn(...args); };
console.log   = (...args) => { if (!isNoise(args)) _origLog(...args); };

// Filtro ao nível do stream (captura escrita directa ao stdout/stderr)
// Necessário para o libsignal que não usa console.log
const _origStdoutWrite = process.stdout.write.bind(process.stdout);
const _origStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = (chunk, encoding, cb) => {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  if (isNoiseStr(str)) {
    if (typeof encoding === 'function') encoding();
    else if (typeof cb === 'function') cb();
    return true;
  }
  return _origStdoutWrite(chunk, encoding, cb);
};

process.stderr.write = (chunk, encoding, cb) => {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  if (isNoiseStr(str)) {
    if (typeof encoding === 'function') encoding();
    else if (typeof cb === 'function') cb();
    return true;
  }
  return _origStderrWrite(chunk, encoding, cb);
};
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
