const pino = require('pino');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let logger;

if (IS_PRODUCTION) {
  // Produção (Render): escreve directamente para stdout sem worker thread.
  // pino-pretty com 'target' usa uma worker thread que perde logs em
  // ambientes containerizados onde stdout não é TTY.
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // Formata manualmente para ser legível no Render sem pino-pretty
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: () => ({}),
    },
    timestamp: () => `,"time":"${new Date().toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })}"`,
    messageKey: 'msg',
    // Escreve directamente para stdout — sem buffer, sem worker thread
    stream: process.stdout,
  });

  // Wrapper para formato mais legível nos logs do Render
  const _orig = logger;
  const fmt = (level, msg) => {
    const time = new Date().toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    process.stdout.write(`[${time}] ${level.toUpperCase()}: 🤖 ${msg}\n`);
  };

  logger = {
    info:  (msg) => fmt('info',  msg),
    warn:  (msg) => fmt('warn',  msg),
    error: (msg) => fmt('error', msg),
    debug: (msg) => fmt('debug', msg),
    trace: (msg) => {},
    fatal: (msg) => fmt('fatal', msg),
    child: () => logger,
  };

} else {
  // Desenvolvimento: usa pino-pretty para leitura fácil no terminal
  const config = require('../config');
  logger = pino({
    level: config.bot.logLevel || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:dd/mm/yyyy HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '🤖 {msg}',
      },
    },
  });
}

module.exports = logger;
