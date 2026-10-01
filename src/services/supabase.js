const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      logger.warn('Supabase não configurado. Operando sem banco de dados.');
      return null;
    }
    supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    logger.info('Supabase conectado com sucesso!');
  }
  return supabase;
}

module.exports = { getSupabase };
