const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.bot.logLevel,
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

module.exports = logger;
