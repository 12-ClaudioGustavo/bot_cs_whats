const { createAppointment } = require('../services/appointmentService');
const { notifyNewAppointment } = require('../services/notificationService');
const { getServices } = require('./catalog');
const { isValidFutureDate, isValidTime, toSupabaseDate } = require('../utils/messageFormatter');
const config = require('../config');
const logger = require('../utils/logger');

// Passos do fluxo de agendamento
const STEPS = {
  ASK_NAME: 'ask_name',
  ASK_SERVICE: 'ask_service',
  ASK_DATE: 'ask_date',
  ASK_TIME: 'ask_time',
  ASK_NOTES: 'ask_notes',
  CONFIRM: 'confirm',
};

/**
 * Mensagem inicial do agendamento
 */
function getStartMessage() {
  return (
    `📅 *Agendar Reunião / Serviço*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Vamos agendar a sua consulta! São apenas *5 passos simples*.\n\n` +
    `👤 Primeiro, qual é o seu *nome completo*?\n\n` +
    `_Digite o seu nome ou 0 para cancelar_`
  );
}

/**
 * Mensagem de selecção de serviço
 */
async function getServiceSelectionMessage() {
  const services = await getServices();

  let msg = `✅ Nome registado!\n\n`;
  msg += `🛠️ Qual serviço pretende agendar?\n\n`;

  services.forEach((s, i) => {
    msg += `${s.icon || '🔹'} *${i + 1}.* ${s.name}\n`;
  });

  msg += `\n_Digite o número do serviço desejado_`;

  return { msg, services };
}

/**
 * Mensagem de selecção de data
 */
function getDateMessage(serviceName) {
  return (
    `✅ Serviço: *${serviceName}*\n\n` +
    `📆 Qual a data pretendida?\n\n` +
    `_Digite no formato: *DD/MM/AAAA*_\n` +
    `_Exemplo: ${getExampleDate()}_\n\n` +
    `ℹ️ Apenas dias úteis (${config.company.phone})`
  );
}

/**
 * Mensagem de selecção de hora
 */
function getTimeMessage(date) {
  return (
    `✅ Data: *${date}*\n\n` +
    `🕐 Qual o horário preferido?\n\n` +
    `_Digite no formato: *HH:MM*_\n` +
    `_Exemplo: 09:00, 14:30_\n\n` +
    `⏰ Horário de atendimento: ${config.businessHours.hourStart}h às ${config.businessHours.hourEnd}h`
  );
}

/**
 * Mensagem de notas opcionais
 */
function getNotesMessage() {
  return (
    `📝 Deseja adicionar alguma *observação* ou descrição sobre o projecto?\n\n` +
    `_Descreva brevemente o que precisa, ou envie_\n` +
    `_"não" para prosseguir sem observações_`
  );
}

/**
 * Mensagem de confirmação do agendamento
 */
function getConfirmMessage(data) {
  return (
    `📋 *Resumo do Agendamento*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *Nome:* ${data.clientName}\n` +
    `🛠️ *Serviço:* ${data.serviceName}\n` +
    `📅 *Data:* ${data.scheduledDate}\n` +
    `🕐 *Hora:* ${data.scheduledTime}\n` +
    `📝 *Notas:* ${data.notes || 'Nenhuma'}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Confirmar agendamento?\n\n` +
    `✅ *1* — Sim, confirmar\n` +
    `❌ *2* — Não, cancelar`
  );
}

/**
 * Mensagem de sucesso do agendamento
 */
function getSuccessMessage(data) {
  return (
    `🎉 *Agendamento Confirmado!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `O seu agendamento foi registado com sucesso!\n\n` +
    `📋 *Detalhes:*\n` +
    `👤 Nome: *${data.clientName}*\n` +
    `🛠️ Serviço: *${data.serviceName}*\n` +
    `📅 Data: *${data.scheduledDate}*\n` +
    `🕐 Hora: *${data.scheduledTime}*\n\n` +
    `⚡ A nossa equipa entrará em contacto para *confirmar* o agendamento em breve.\n\n` +
    `📞 *${config.company.phone}*\n` +
    `📧 *${config.company.email}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Digite *0* para voltar ao menu principal`
  );
}

/**
 * Processa o fluxo de agendamento passo a passo
 */
async function processAppointmentFlow(input, state, phone) {
  const { step, data } = state;
  const text = input.trim();

  // Passo 1: Nome
  if (step === 'initial' || step === STEPS.ASK_NAME) {
    if (!text || text.length < 2) {
      return { reply: '⚠️ Por favor, informe um nome válido.', nextStep: STEPS.ASK_NAME };
    }
    const { msg, services } = await getServiceSelectionMessage();
    return {
      reply: msg,
      nextStep: STEPS.ASK_SERVICE,
      dataUpdate: { clientName: text, servicesCache: services },
    };
  }

  // Passo 2: Serviço
  if (step === STEPS.ASK_SERVICE) {
    const services = data.servicesCache || await getServices();
    const idx = parseInt(text) - 1;

    if (isNaN(idx) || idx < 0 || idx >= services.length) {
      let retry = `⚠️ Opção inválida. Escolha entre 1 e ${services.length}:\n\n`;
      services.forEach((s, i) => { retry += `*${i + 1}.* ${s.name}\n`; });
      return { reply: retry, nextStep: STEPS.ASK_SERVICE };
    }

    const chosen = services[idx];
    return {
      reply: getDateMessage(chosen.name),
      nextStep: STEPS.ASK_DATE,
      dataUpdate: { serviceId: chosen.id, serviceName: chosen.name },
    };
  }

  // Passo 3: Data
  if (step === STEPS.ASK_DATE) {
    if (!isValidFutureDate(text)) {
      return {
        reply: `⚠️ Data inválida ou passada. Use o formato *DD/MM/AAAA*.\nEx: ${getExampleDate()}`,
        nextStep: STEPS.ASK_DATE,
      };
    }
    return {
      reply: getTimeMessage(text),
      nextStep: STEPS.ASK_TIME,
      dataUpdate: { scheduledDate: text },
    };
  }

  // Passo 4: Hora
  if (step === STEPS.ASK_TIME) {
    if (!isValidTime(text)) {
      return {
        reply: `⚠️ Hora inválida. Use o formato *HH:MM*.\nEx: 09:00, 14:30`,
        nextStep: STEPS.ASK_TIME,
      };
    }
    return {
      reply: getNotesMessage(),
      nextStep: STEPS.ASK_NOTES,
      dataUpdate: { scheduledTime: text },
    };
  }

  // Passo 5: Notas
  if (step === STEPS.ASK_NOTES) {
    const notes = ['não', 'nao', 'n', 'no', '-'].includes(text.toLowerCase()) ? null : text;
    const confirmData = {
      clientName: data.clientName,
      serviceName: data.serviceName,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      notes,
    };
    return {
      reply: getConfirmMessage(confirmData),
      nextStep: STEPS.CONFIRM,
      dataUpdate: { notes },
    };
  }

  // Passo 6: Confirmação
  if (step === STEPS.CONFIRM) {
    if (text === '1') {
      // Salva no banco de dados
      const result = await createAppointment({
        phone,
        clientName: data.clientName,
        serviceId: data.serviceId,
        serviceName: data.serviceName,
        scheduledDate: toSupabaseDate(data.scheduledDate),
        scheduledTime: data.scheduledTime,
        notes: data.notes,
      });

      if (!result.success) {
        logger.error(`Falha ao guardar agendamento: ${result.error}`);
      } else {
        // Notifica admin sobre novo agendamento
        notifyNewAppointment({
          phone,
          clientName: data.clientName,
          serviceName: data.serviceName,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          notes: data.notes,
        }).catch(() => {});
      }

      return {
        reply: getSuccessMessage(data),
        nextStep: 'done',
        resetFlow: true,
      };
    } else {
      return {
        reply: `❌ *Agendamento cancelado.*\n\nDigite *0* para voltar ao menu principal.`,
        nextStep: 'done',
        resetFlow: true,
      };
    }
  }

  return { reply: getStartMessage(), nextStep: STEPS.ASK_NAME };
}

/**
 * Gera um exemplo de data futura no formato DD/MM/AAAA
 */
function getExampleDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('pt-PT').replace(/\//g, '/');
}

module.exports = {
  getStartMessage,
  processAppointmentFlow,
  STEPS,
};
