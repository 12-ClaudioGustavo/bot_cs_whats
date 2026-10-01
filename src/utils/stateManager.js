const NodeCache = require('node-cache');
const logger = require('./logger');

// Cache em memória: chave = `${tenantId}::${phone}`, valor = { flow, step, data, lastActivity, isHumanActive }
// O prefixo de tenant garante que dois tenants nunca partilham/sobrepõem
// a conversa de um número de telefone igual (ex: mesmo cliente a falar
// com duas empresas diferentes que usam a plataforma).
const sessionCache = new NodeCache({
  stdTTL: 3600,        // 1 hora de TTL
  checkperiod: 300,    // verificação a cada 5 minutos
  useClones: false,
});

function cacheKey(tenantId, phone) {
  if (!tenantId) throw new Error('stateManager requer tenantId para isolar conversas entre tenants.');
  return `${tenantId}::${phone}`;
}

/**
 * Retorna o estado actual de um utilizador (escopado ao tenant)
 */
function getState(tenantId, phone) {
  const state = sessionCache.get(cacheKey(tenantId, phone));
  if (!state) {
    return createDefaultState();
  }
  return state;
}

/**
 * Actualiza o estado de um utilizador (escopado ao tenant)
 */
function setState(tenantId, phone, updates) {
  const current = getState(tenantId, phone);
  const newState = {
    ...current,
    ...updates,
    lastActivity: new Date(),
  };
  sessionCache.set(cacheKey(tenantId, phone), newState);
  return newState;
}

/**
 * Reseta o estado para o menu principal (escopado ao tenant)
 */
function resetState(tenantId, phone) {
  const defaultState = createDefaultState();
  sessionCache.set(cacheKey(tenantId, phone), defaultState);
  logger.info(`Estado resetado para ${phone} (tenant ${tenantId})`);
  return defaultState;
}

/**
 * Verifica se o utilizador está inactivo há demasiado tempo
 */
function isInactive(tenantId, phone, timeoutMinutes = 30) {
  const state = sessionCache.get(cacheKey(tenantId, phone));
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
function setHumanMode(tenantId, phone, active = true) {
  setState(tenantId, phone, { isHumanActive: active, flow: active ? 'human' : 'main_menu' });
}

/**
 * Verifica se o atendimento humano está activo
 */
function isHumanActive(tenantId, phone) {
  const state = getState(tenantId, phone);
  return state.isHumanActive === true;
}

/**
 * Limpa um dado específico do estado
 */
function clearData(tenantId, phone, key) {
  const state = getState(tenantId, phone);
  if (state.data && state.data[key] !== undefined) {
    delete state.data[key];
    sessionCache.set(cacheKey(tenantId, phone), state);
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
 * Retorna todas as chaves `tenant::phone` com sessão activa (para debug)
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
