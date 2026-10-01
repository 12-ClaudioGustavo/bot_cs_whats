const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Regista ou actualiza um cliente no banco de dados.
 * SEMPRE escopado a um tenant — um mesmo número de telefone pode existir
 * como cliente de VÁRIOS tenants diferentes, sem se misturar.
 */
async function upsertClient(tenantId, phone, data = {}) {
  const db = getSupabase();
  if (!db) return null;
  if (!tenantId) { logger.error('upsertClient chamado sem tenantId.'); return null; }

  try {
    const { data: existing } = await db
      .from('clients')
      .select('id, total_conversations')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle();

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
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    } else {
      // Cria novo cliente
      const { data: created, error } = await db
        .from('clients')
        .insert({
          tenant_id: tenantId,
          phone,
          ...data,
          first_contact_at: new Date().toISOString(),
          last_contact_at: new Date().toISOString(),
          total_conversations: 1,
        })
        .select()
        .single();

      if (error) throw error;
      logger.info(`Novo cliente registado: ${phone} (tenant ${tenantId})`);
      return created;
    }
  } catch (err) {
    logger.error(`Erro ao upsert cliente ${phone} (tenant ${tenantId}): ${err.message}`);
    return null;
  }
}

/**
 * Busca cliente por telefone, dentro do tenant.
 */
async function getClientByPhone(tenantId, phone) {
  const db = getSupabase();
  if (!db) return null;
  if (!tenantId) { logger.error('getClientByPhone chamado sem tenantId.'); return null; }

  try {
    const { data, error } = await db
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    logger.error(`Erro ao buscar cliente ${phone} (tenant ${tenantId}): ${err.message}`);
    return null;
  }
}

/**
 * Actualiza nome do cliente, dentro do tenant.
 */
async function updateClientName(tenantId, phone, name) {
  const db = getSupabase();
  if (!db || !tenantId) return;

  try {
    await db
      .from('clients')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('phone', phone);
  } catch (err) {
    logger.error(`Erro ao actualizar nome do cliente (tenant ${tenantId}): ${err.message}`);
  }
}

module.exports = { upsertClient, getClientByPhone, updateClientName };
