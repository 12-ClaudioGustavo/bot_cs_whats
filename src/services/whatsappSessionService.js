const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Obtém o ID do tenant padrão (master ou primeiro tenant)
 */
async function getDefaultTenantId() {
  const db = getSupabase();
  if (!db) return '00000000-0000-0000-0000-000000000001';

  try {
    const { data } = await db
      .from('tenants')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    return data?.id || '00000000-0000-0000-0000-000000000001';
  } catch (_) {
    return '00000000-0000-0000-0000-000000000001';
  }
}

/**
 * Atualiza ou insere o estado de uma instância de WhatsApp no Supabase
 */
async function syncSessionStatus({ tenantId, sessionName = 'default', status, qrCodeUrl = null, phoneNumber = null }) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const targetTenantId = tenantId || (await getDefaultTenantId());

    const payload = {
      tenant_id: targetTenantId,
      session_name: sessionName,
      status,
      updated_at: new Date().toISOString(),
    };

    if (qrCodeUrl !== undefined) payload.qr_code_url = qrCodeUrl;
    if (phoneNumber !== undefined) payload.phone_number = phoneNumber;
    if (status === 'connected') payload.last_connected_at = new Date().toISOString();

    const { data, error } = await db
      .from('whatsapp_sessions')
      .upsert(payload, { onConflict: 'tenant_id,session_name' })
      .select('*')
      .single();

    if (error) throw error;
    logger.info(`Instância WhatsApp sincronizada no Supabase — Status: ${status} (Tenant: ${targetTenantId})`);
    return data;
  } catch (err) {
    logger.error(`Erro ao sincronizar sessão WhatsApp na BD: ${err.message}`);
    return null;
  }
}

/**
 * Obtém todas as instâncias registradas no sistema (para Super Admin)
 */
async function getAllSessions() {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('whatsapp_sessions')
      .select('*, tenants(name, slug, email)')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar instâncias do WhatsApp: ${err.message}`);
    return [];
  }
}

/**
 * Obtém as instâncias de WhatsApp de um tenant específico
 */
async function getTenantSessions(tenantId) {
  const db = getSupabase();
  if (!db) return [];

  try {
    const targetTenantId = tenantId || (await getDefaultTenantId());

    const { data, error } = await db
      .from('whatsapp_sessions')
      .select('*')
      .eq('tenant_id', targetTenantId)
      .order('session_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao buscar instâncias do tenant ${tenantId}: ${err.message}`);
    return [];
  }
}

/**
 * Elimina/desconecta uma sessão no banco
 */
async function deleteSession(tenantId, sessionName = 'default') {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db
      .from('whatsapp_sessions')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('session_name', sessionName);

    if (error) throw error;
    logger.info(`Sessão ${sessionName} eliminada da BD para tenant ${tenantId}`);
    return true;
  } catch (err) {
    logger.error(`Erro ao eliminar sessão da BD: ${err.message}`);
    return false;
  }
}

module.exports = {
  syncSessionStatus,
  getAllSessions,
  getTenantSessions,
  deleteSession,
  getDefaultTenantId,
};
