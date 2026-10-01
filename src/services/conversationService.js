const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Guarda uma mensagem no histórico de conversas, escopada ao tenant.
 */
async function saveMessage(tenantId, phone, direction, message, messageType = 'text', flowContext = null) {
  const db = getSupabase();
  if (!db) return;
  if (!tenantId) { logger.error('saveMessage chamado sem tenantId.'); return; }

  try {
    // Busca client_id pelo phone, dentro do mesmo tenant
    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle();

    await db.from('conversations').insert({
      tenant_id: tenantId,
      client_id: client?.id || null,
      phone,
      direction,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      message_type: messageType,
      flow_context: flowContext,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`Erro ao guardar mensagem (tenant ${tenantId}): ${err.message}`);
  }
}

/**
 * Busca histórico de conversas de um cliente, dentro do tenant.
 */
async function getConversationHistory(tenantId, phone, limit = 20) {
  const db = getSupabase();
  if (!db) return [];
  if (!tenantId) return [];

  try {
    const { data, error } = await db
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao buscar histórico (tenant ${tenantId}): ${err.message}`);
    return [];
  }
}

module.exports = { saveMessage, getConversationHistory };
