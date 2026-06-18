const config = require('../config');

/**
 * Mensagem inicial do suporte técnico
 */
function getSupportStartMessage() {
  return (
    `🛠️ *Suporte Técnico*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Como podemos ajudá-lo(a) hoje?\n\n` +
    `1️⃣  Problema com software/sistema\n` +
    `2️⃣  Erro ou bug reportado\n` +
    `3️⃣  Questão de acesso / login\n` +
    `4️⃣  Lentidão ou performance\n` +
    `5️⃣  Outro problema\n` +
    `6️⃣  Falar com técnico humano\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Digite o número ou *0* para voltar ao menu`
  );
}

/**
 * Respostas automáticas por tipo de problema
 */
const AUTO_RESPONSES = {
  '1': {
    title: '🖥️ Problema com Software/Sistema',
    steps: [
      '🔄 Tente *reiniciar* a aplicação',
      '🗑️ Limpe o *cache* do browser (Ctrl+Shift+Del)',
      '🔌 Verifique a sua *ligação à internet*',
      '🆕 Verifique se há *actualizações* disponíveis',
      '📸 Capture um *screenshot* do erro para análise',
    ],
    followUp: 'Se o problema persistir após estes passos, por favor partilhe o screenshot do erro e entraremos em contacto.',
  },
  '2': {
    title: '🐛 Erro ou Bug Reportado',
    steps: [
      '📸 Tire um *screenshot* do erro completo',
      '📝 Anote os *passos exactos* que levaram ao erro',
      '🕐 Registe a *hora* em que o erro ocorreu',
      '🔁 Verifique se o erro é *reproduzível*',
      '📲 Envie as informações para a nossa equipa técnica',
    ],
    followUp: 'Envie o screenshot e a descrição do problema aqui mesmo e um técnico analisará em até 4 horas úteis.',
  },
  '3': {
    title: '🔐 Questão de Acesso / Login',
    steps: [
      '🔑 Use a opção *"Esqueci a senha"* na tela de login',
      '📧 Verifique o *email* para redefinição de senha',
      '🗑️ Verifique a pasta de *spam* do email',
      '⌨️ Confirme se o *Caps Lock* está desactivado',
      '🌐 Tente noutro *browser* ou dispositivo',
    ],
    followUp: 'Se não conseguir acesso, forneça o seu email de cadastro e faremos o reset manualmente.',
  },
  '4': {
    title: '⚡ Lentidão ou Performance',
    steps: [
      '🌐 Teste a velocidade da sua internet (fast.com)',
      '🔄 Reinicie o *router/modem*',
      '💻 Feche outras abas e aplicações abertas',
      '🗑️ Limpe cache e cookies do browser',
      '📊 Verifique o *uso de RAM* do seu dispositivo',
    ],
    followUp: 'Se a lentidão for no nosso sistema, informe-nos e verificaremos o servidor imediatamente.',
  },
  '5': {
    title: '❓ Outro Problema',
    steps: [],
    followUp: 'Por favor, descreva o seu problema em detalhe e a nossa equipa técnica analisará e responderá em breve.',
  },
};

/**
 * Retorna a resposta automática para o tipo de problema
 */
function getAutoResponseMessage(option) {
  const response = AUTO_RESPONSES[option];
  if (!response) return null;

  let msg = `${response.title}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (response.steps.length > 0) {
    msg += `*Tente estes passos:*\n\n`;
    response.steps.forEach((step, i) => {
      msg += `${i + 1}. ${step}\n`;
    });
    msg += `\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💬 ${response.followUp}\n\n`;
  msg += `*O problema foi resolvido?*\n\n`;
  msg += `✅ *1* — Sim, obrigado!\n`;
  msg += `❌ *2* — Não, preciso de mais ajuda`;

  return msg;
}

/**
 * Mensagem de escalonamento para humano
 */
function getEscalateMessage() {
  return (
    `👨‍💻 *Encaminhando para Suporte Técnico*\n\n` +
    `Um técnico da nossa equipa irá atendê-lo(a) em breve!\n\n` +
    `⏱️ *Tempo de espera estimado:* 15-30 minutos\n\n` +
    `📞 *Ou contacte directamente:*\n` +
    `Telefone: ${config.company.phone}\n` +
    `Email: ${config.company.email}\n\n` +
    `_Descreva o seu problema enquanto aguarda e o técnico já chegará contextualizado._`
  );
}

/**
 * Processa o fluxo de suporte técnico
 */
async function processSupportFlow(input, state) {
  const { step } = state;
  const text = input.trim();

  if (step === 'initial') {
    const autoMsg = getAutoResponseMessage(text);
    if (autoMsg) {
      return { reply: autoMsg, nextStep: 'auto_response', dataUpdate: { supportOption: text } };
    }

    if (text === '6') {
      return { reply: getEscalateMessage(), nextStep: 'escalate', toHuman: true };
    }

    return { reply: getSupportStartMessage(), nextStep: 'initial' };
  }

  if (step === 'auto_response') {
    if (text === '1') {
      return {
        reply: `🎉 Fico feliz em ter ajudado!\n\nSe tiver mais dúvidas, estou aqui. 😊\n\nDigite *0* para voltar ao menu principal.`,
        nextStep: 'done',
        resetFlow: true,
      };
    }
    // text === '2' ou qualquer outra coisa → escalar
    return { reply: getEscalateMessage(), nextStep: 'escalate', toHuman: true };
  }

  return { reply: getSupportStartMessage(), nextStep: 'initial' };
}

module.exports = { getSupportStartMessage, processSupportFlow };
