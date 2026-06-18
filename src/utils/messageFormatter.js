/**
 * Formata o número de telefone para padrão JID do WhatsApp
 * Ex: "244912345678" → "244912345678@s.whatsapp.net"
 */
function formatJid(phone) {
  const clean = phone.replace(/[^0-9]/g, '');
  return clean.includes('@') ? phone : `${clean}@s.whatsapp.net`;
}

/**
 * Extrai o número limpo do JID
 * Ex: "244912345678@s.whatsapp.net" → "244912345678"
 */
function extractPhone(jid) {
  return jid?.split('@')[0] || jid;
}

/**
 * Formata uma data no padrão pt-PT
 */
function formatDate(dateString) {
  if (!dateString) return 'Não definida';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-PT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Verifica se a mensagem é um comando de menu (número ou palavra-chave)
 */
function isMenuCommand(text) {
  const menuTriggers = ['menu', 'início', 'inicio', 'voltar', 'back', '0', 'cancelar', 'cancel'];
  return menuTriggers.includes(text?.toLowerCase()?.trim());
}

/**
 * Limpa e normaliza texto de entrada do utilizador
 */
function normalizeInput(text) {
  return text?.toLowerCase()?.trim() || '';
}

/**
 * Valida se uma string é um número de telemóvel angolano válido
 */
function isValidAngolalPhone(phone) {
  const clean = phone.replace(/[^0-9]/g, '');
  // Aceita 9 dígitos locais ou com código de país (244)
  return /^(244)?[9][0-9]{8}$/.test(clean);
}

/**
 * Valida se uma string parece um email válido
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valida se uma data no formato DD/MM/YYYY é válida e futura
 */
function isValidFutureDate(dateStr) {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date instanceof Date && !isNaN(date) && date >= today;
}

/**
 * Valida se uma hora no formato HH:MM é válida
 */
function isValidTime(timeStr) {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
}

/**
 * Converte DD/MM/YYYY para YYYY-MM-DD (formato Supabase)
 */
function toSupabaseDate(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Trunca texto longo para preview
 */
function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

module.exports = {
  formatJid,
  extractPhone,
  formatDate,
  isMenuCommand,
  normalizeInput,
  isValidAngolalPhone,
  isValidEmail,
  isValidFutureDate,
  isValidTime,
  toSupabaseDate,
  truncate,
};
