const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Regista ou actualiza um cliente no banco de dados
 */
async function upsertClient(phone, data = {}) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data: existing } = await db
      .from('clients')
      .select('id, total_conversations')
      .eq('phone', phone)
      .single();

    if (existing) {
      // Actualiza cliente existente
      const { data: updated, error } = await db
        .from('clients')
        .update({
          ...data,
          last_contact_at: new Date().toISOString(),
          total_conversations: (existing.total_conversations || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', phone)
        .select()
        .single();

      if (error) throw error;
      return updated;
    } else {
      // Cria novo cliente
      const { data: created, error } = await db
        .from('clients')
        .insert({
          phone,
          ...data,
          first_contact_at: new Date().toISOString(),
          last_contact_at: new Date().toISOString(),
          total_conversations: 1,
        })
        .select()
        .single();

      if (error) throw error;
      logger.info(`Novo cliente registado: ${phone}`);
      return created;
    }
  } catch (err) {
    logger.error(`Erro ao upsert cliente ${phone}: ${err.message}`);
    return null;
  }
}

/**
 * Busca cliente por telefone
 */
async function getClientByPhone(phone) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    logger.error(`Erro ao buscar cliente ${phone}: ${err.message}`);
    return null;
  }
}

/**
 * Actualiza nome do cliente
 */
async function updateClientName(phone, name) {
  const db = getSupabase();
  if (!db) return;

  try {
    await db
      .from('clients')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('phone', phone);
  } catch (err) {
    logger.error(`Erro ao actualizar nome do cliente: ${err.message}`);
  }
}

module.exports = { upsertClient, getClientByPhone, updateClientName };
