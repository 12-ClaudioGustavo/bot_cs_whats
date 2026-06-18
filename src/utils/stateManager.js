const NodeCache = require('node-cache');
const logger = require('./logger');

// Cache em memória: chave = phone, valor = { flow, step, data, lastActivity, isHumanActive }
const sessionCache = new NodeCache({
  stdTTL: 3600,        // 1 hora de TTL
  checkperiod: 300,    // verificação a cada 5 minutos
  useClones: false,
});

/**
 * Retorna o estado actual de um utilizador
 */
function getState(phone) {
  const state = sessionCache.get(phone);
  if (!state) {
    return createDefaultState();
  }
  return state;
}

/**
 * Actualiza o estado de um utilizador
 */
function setState(phone, updates) {
  const current = getState(phone);
  const newState = {
    ...current,
    ...updates,
    lastActivity: new Date(),
  };
  sessionCache.set(phone, newState);
  return newState;
}

/**
 * Reseta o estado para o menu principal
 */
function resetState(phone) {
  const defaultState = createDefaultState();
  sessionCache.set(phone, defaultState);
  logger.info(`Estado resetado para ${phone}`);
  return defaultState;
}

/**
 * Verifica se o utilizador está inactivo há demasiado tempo
 */
function isInactive(phone, timeoutMinutes = 30) {
  const state = sessionCache.get(phone);
  if (!state || !state.lastActivity) return true;

  const now = new Date();
  const lastActivity = new Date(state.lastActivity);
  const diffMs = now - lastActivity;
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes > timeoutMinutes;
}

/**
 * Activa o modo de atendimento humano para este número
 */
function setHumanMode(phone, active = true) {
  setState(phone, { isHumanActive: active, flow: active ? 'human' : 'main_menu' });
}

/**
 * Verifica se o atendimento humano está activo
 */
function isHumanActive(phone) {
  const state = getState(phone);
  return state.isHumanActive === true;
}

/**
 * Limpa um dado específico do estado
 */
function clearData(phone, key) {
  const state = getState(phone);
  if (state.data && state.data[key] !== undefined) {
    delete state.data[key];
    sessionCache.set(phone, state);
  }
}

/**
 * Estado padrão para novos utilizadores
 */
function createDefaultState() {
  return {
    flow: 'main_menu',
    step: 'initial',
    data: {},
    lastActivity: new Date(),
    isHumanActive: false,
    isNew: true,
  };
}

/**
 * Retorna todos os phones com sessão activa (para debug)
 */
function getActiveSessions() {
  return sessionCache.keys();
}

module.exports = {
  getState,
  setState,
  resetState,
  isInactive,
  setHumanMode,
  isHumanActive,
  clearData,
  getActiveSessions,
};
