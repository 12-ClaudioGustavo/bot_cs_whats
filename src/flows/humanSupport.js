const config = require('../config');

/**
 * Mensagem de encaminhamento para atendente humano
 */
function getHumanHandoffMessage() {
  return (
    `👨‍💼 *Transferindo para Atendente*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Está a ser transferido(a) para um dos nossos atendentes!\n\n` +
    `👤 *Atendente:* ${config.human.name}\n` +
    `⏱️ *Tempo de espera:* Alguns minutos\n\n` +
    `📝 *Enquanto aguarda, pode:*\n` +
    `• Descrever o seu problema ou necessidade\n` +
    `• Enviar screenshots ou documentos relevantes\n` +
    `• Informar o seu nome e empresa\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📞 *Contacto directo:*\n` +
    `Telefone: ${config.company.phone}\n` +
    `Email: ${config.company.email}\n\n` +
    `_O bot ficará pausado durante o atendimento humano._\n` +
    `_Para retomar o atendimento automático, envie: *#bot*_`
  );
}

/**
 * Mensagem quando atendimento humano está activo
 */
function getHumanActiveMessage() {
  return (
    `👨‍💼 *Atendimento Humano Activo*\n\n` +
    `Você está em atendimento com *${config.human.name}*.\n\n` +
    `_Para retomar o atendimento automático, envie: *#bot*_`
  );
}

/**
 * Mensagem de retorno ao bot
 */
function getBotResumeMessage() {
  return (
    `🤖 *Atendimento Automático Retomado*\n\n` +
    `O atendimento humano foi encerrado.\n\n` +
    `Como posso ajudá-lo(a) agora?\n\n` +
    `1️⃣  Sobre a Empresa\n` +
    `2️⃣  Catálogo de Serviços\n` +
    `3️⃣  Agendar Reunião/Serviço\n` +
    `4️⃣  Dúvidas Frequentes (FAQ)\n` +
    `5️⃣  Suporte Técnico\n` +
    `6️⃣  Falar com um Atendente\n\n` +
    `_Digite o número da opção desejada_ 👇`
  );
}

/**
 * Verifica se a mensagem é um comando para retomar o bot
 */
function isBotResumeCommand(text) {
  return ['#bot', '#menu', '#voltar', '#inicio'].includes(text?.toLowerCase()?.trim());
}

module.exports = {
  getHumanHandoffMessage,
  getHumanActiveMessage,
  getBotResumeMessage,
  isBotResumeCommand,
};
