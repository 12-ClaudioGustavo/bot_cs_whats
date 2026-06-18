const config = require('../config');

/**
 * Verifica se o momento actual está dentro do horário de funcionamento
 */
function isWithinBusinessHours() {
  const now = new Date();

  // Obter hora local com timezone configurado
  const localTime = new Intl.DateTimeFormat('pt-PT', {
    timeZone: config.businessHours.timezone,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);

  const parts = {};
  localTime.forEach(p => { parts[p.type] = p.value; });

  const currentHour = parseInt(parts.hour);
  const currentDay = getDayNumber(parts.weekday);

  const { daysStart, daysEnd, hourStart, hourEnd } = config.businessHours;

  const isDayValid = currentDay >= daysStart && currentDay <= daysEnd;
  const isHourValid = currentHour >= hourStart && currentHour < hourEnd;

  return isDayValid && isHourValid;
}

/**
 * Converte nome curto do dia para número (0=Dom, 1=Seg...)
 */
function getDayNumber(weekdayShort) {
  const map = {
    'dom.': 0, 'seg.': 1, 'ter.': 2, 'qua.': 3,
    'qui.': 4, 'sex.': 5, 'sáb.': 6,
    // fallback inglês
    'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3,
    'thu': 4, 'fri': 5, 'sat': 6,
  };
  return map[weekdayShort?.toLowerCase()] ?? new Date().getDay();
}

/**
 * Retorna string formatada do horário de funcionamento
 */
function getBusinessHoursText() {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const { daysStart, daysEnd, hourStart, hourEnd } = config.businessHours;

  const startDay = days[daysStart] || 'Segunda';
  const endDay = days[daysEnd] || 'Sexta';

  return `${startDay} a ${endDay}, das ${String(hourStart).padStart(2, '0')}h às ${String(hourEnd).padStart(2, '0')}h`;
}

/**
 * Retorna próximo horário de atendimento (texto simples)
 */
function getNextAvailableText() {
  const now = new Date();
  const { daysStart, hourStart } = config.businessHours;

  const currentDay = now.getDay();
  const isWeekend = currentDay === 0 || currentDay === 6;

  if (isWeekend) {
    return `na próxima *Segunda-feira* às *${String(hourStart).padStart(2, '0')}h*`;
  }

  const currentHour = now.getHours();
  if (currentHour < hourStart) {
    return `hoje às *${String(hourStart).padStart(2, '0')}h*`;
  }

  return `amanhã às *${String(hourStart).padStart(2, '0')}h*`;
}

module.exports = { isWithinBusinessHours, getBusinessHoursText, getNextAvailableText };
