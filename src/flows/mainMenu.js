const config = require('../config');
const { getBusinessHoursText } = require('../utils/timeChecker');
const botConfigService = require('../services/botConfigService');

/**
 * Retorna a mensagem de boas-vindas + menu principal
 */
async function getWelcomeMessage(tenantId, clientName = null) {
  const name = clientName ? `, *${clientName}*` : '';
  let welcomeCustom = null;
  let companyName = config.company.name;

  if (tenantId) {
    try {
      const botConf = await botConfigService.getBotConfig(tenantId);
      if (botConf?.welcomeMsg) welcomeCustom = botConf.welcomeMsg;
      if (botConf?.company?.name) companyName = botConf.company.name;
    } catch (_) {}
  }

  if (welcomeCustom) {
    return (
      `Olá${name}! 👋\n\n` +
      `${welcomeCustom}\n\n` +
      getMainMenuMessage()
    );
  }

  return (
    `╔══════════════════════════╗\n` +
    `║  🏢  *${companyName}*  ║\n` +
    `╚══════════════════════════╝\n\n` +
    `Olá${name}! 👋 Seja bem-vindo(a) ao nosso atendimento automatizado!\n\n` +
    getMainMenuMessage()
  );
}

/**
 * Retorna a mensagem do menu principal (sem boas-vindas)
 */
function getMainMenuMessage() {
  return (
    `🏠 *Menu Principal*\n\n` +
    `1️⃣  Sobre a Empresa\n` +
    `2️⃣  Catálogo de Serviços / Produtos\n` +
    `3️⃣  Agendar Reunião / Reserva\n` +
    `4️⃣  Dúvidas Frequentes (FAQ)\n` +
    `5️⃣  Suporte Técnico\n` +
    `6️⃣  Falar com um Atendente\n\n` +
    `_Digite o número da opção desejada_ 👇`
  );
}

/**
 * Retorna informações e apresentação da empresa
 */
async function getAboutMessage(tenantId) {
  let aboutCustom = null;
  let companyName = config.company.name;
  let phone = config.company.phone;
  let email = config.company.email;
  let address = config.company.address;
  let website = config.company.website;

  if (tenantId) {
    try {
      const botConf = await botConfigService.getBotConfig(tenantId);
      if (botConf?.aboutMsg) aboutCustom = botConf.aboutMsg;
      if (botConf?.company) {
        if (botConf.company.name) companyName = botConf.company.name;
        if (botConf.company.phone) phone = botConf.company.phone;
        if (botConf.company.email) email = botConf.company.email;
        if (botConf.company.address) address = botConf.company.address;
        if (botConf.company.website) website = botConf.company.website;
      }
    } catch (_) {}
  }

  if (aboutCustom) {
    return (
      `🏢 *Sobre a ${companyName}*\n\n` +
      `${aboutCustom}\n\n` +
      `📍 *Localização:* ${address || 'Não especificada'}\n` +
      `📞 *Telefone:* ${phone || 'Não especificado'}\n` +
      `📧 *Email:* ${email || 'Não especificado'}\n` +
      (website ? `🌐 *Website:* ${website}\n` : '') +
      `⏰ *Horário:* ${getBusinessHoursText()}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Digite *0* para voltar ao menu principal`
    );
  }

  return (
    `🏢 *Sobre a ${companyName}*\n\n` +
    `Somos uma empresa especializada em prestação de serviços e soluções de elevada qualidade.\n\n` +
    `💡 *A Nossa Missão:*\n` +
    `Transformar ideias em soluções inovadoras, garantindo a satisfação total dos nossos clientes.\n\n` +
    `🎯 *Os Nossos Valores:*\n` +
    `• Qualidade e excelência\n` +
    `• Compromisso com o cliente\n` +
    `• Transparência e inovação\n\n` +
    `📍 *Localização:* ${address}\n` +
    `📞 *Telefone:* ${phone}\n` +
    `📧 *Email:* ${email}\n` +
    `🌐 *Website:* ${website}\n` +
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
    `Obrigado por entrar em contacto!\n\n` +
    `No momento, o nosso horário de atendimento é:\n` +
    `⏰ *${getBusinessHoursText()}*\n\n` +
    `Estaremos disponíveis ${nextAvailable}.\n\n` +
    `📝 A sua mensagem foi registada e entraremos em contacto assim que possível.`
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
