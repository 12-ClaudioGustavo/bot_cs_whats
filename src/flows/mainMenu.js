const config = require('../config');
const { getBusinessHoursText } = require('../utils/timeChecker');

/**
 * Retorna a mensagem de boas-vindas + menu principal
 */
function getWelcomeMessage(clientName = null) {
  const name = clientName ? `, *${clientName}*` : '';
  return (
    `╔══════════════════════════╗\n` +
    `║  🖥️  *${config.company.name}*  ║\n` +
    `║  Soluções em TI & Software  ║\n` +
    `╚══════════════════════════╝\n\n` +
    `Olá${name}! 👋 Seja bem-vindo(a) ao nosso atendimento automatizado!\n\n` +
    `Como posso ajudá-lo(a) hoje? Seleccione uma opção:\n\n` +
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
 * Retorna a mensagem do menu principal (sem boas-vindas)
 */
function getMainMenuMessage() {
  return (
    `🏠 *Menu Principal*\n\n` +
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
 * Retorna informações sobre a empresa
 */
function getAboutMessage() {
  return (
    `🏢 *Sobre a ${config.company.name}*\n\n` +
    `Somos uma empresa angolana especializada em soluções de Tecnologia da Informação e Desenvolvimento de Software.\n\n` +
    `💡 *A Nossa Missão:*\n` +
    `Transformar ideias em soluções digitais inovadoras, contribuindo para a digitalização e crescimento das empresas angolanas.\n\n` +
    `🎯 *Os Nossos Valores:*\n` +
    `• Inovação constante\n` +
    `• Qualidade e excelência\n` +
    `• Compromisso com o cliente\n` +
    `• Transparência e ética\n\n` +
    `📍 *Localização:* ${config.company.address}\n` +
    `📞 *Telefone:* ${config.company.phone}\n` +
    `📧 *Email:* ${config.company.email}\n` +
    `🌐 *Website:* ${config.company.website}\n` +
    `⏰ *Horário:* ${getBusinessHoursText()}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Digite *0* para voltar ao menu principal`
  );
}

/**
 * Retorna mensagem de fora do horário de atendimento
 */
function getOutOfHoursMessage(nextAvailable) {
  return (
    `🌙 *Fora do Horário de Atendimento*\n\n` +
    `Obrigado por entrar em contacto com a *${config.company.name}*!\n\n` +
    `No momento, o nosso horário de atendimento é:\n` +
    `⏰ *${getBusinessHoursText()}*\n\n` +
    `Estaremos disponíveis ${nextAvailable}.\n\n` +
    `📝 A sua mensagem foi registada e entraremos em contacto assim que possível.\n\n` +
    `_Para assuntos urgentes, envie um email para:_\n` +
    `📧 ${config.company.email}`
  );
}

/**
 * Retorna mensagem de inactividade/timeout
 */
function getTimeoutMessage() {
  return (
    `⏱️ _A sua sessão expirou por inactividade._\n\n` +
    getMainMenuMessage()
  );
}

/**
 * Processa a selecção do menu principal
 * Retorna o próximo fluxo baseado na opção escolhida
 */
function processMenuSelection(input) {
  const option = input.trim();
  const routes = {
    '1': 'about',
    '2': 'catalog',
    '3': 'appointment',
    '4': 'faq',
    '5': 'support',
    '6': 'human',
  };
  return routes[option] || null;
}

module.exports = {
  getWelcomeMessage,
  getMainMenuMessage,
  getAboutMessage,
  getOutOfHoursMessage,
  getTimeoutMessage,
  processMenuSelection,
};
