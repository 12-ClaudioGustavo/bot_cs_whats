const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Guarda uma mensagem no histórico de conversas
 */
async function saveMessage(phone, direction, message, messageType = 'text', flowContext = null) {
  const db = getSupabase();
  if (!db) return;

  try {
    // Busca client_id pelo phone
    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('phone', phone)
      .single();

    await db.from('conversations').insert({
      client_id: client?.id || null,
      phone,
      direction,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      message_type: messageType,
      flow_context: flowContext,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`Erro ao guardar mensagem: ${err.message}`);
  }
}

/**
 * Busca histórico de conversas de um cliente
 */
async function getConversationHistory(phone, limit = 20) {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('conversations')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao buscar histórico: ${err.message}`);
    return [];
  }
}

module.exports = { saveMessage, getConversationHistory };
