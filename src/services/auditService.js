const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Regista um novo evento de auditoria no Supabase
 */
async function logAuditEvent({ tenantId = null, userId = null, userEmail = 'system', action, category = 'system', details = {}, ipAddress = 'unknown', userAgent = '' }) {
  const db = getSupabase();
  if (!db) {
    logger.info(`[Audit Log - Local]: ${action} (${category}) por ${userEmail}`);
    return null;
  }

  try {
    const { data, error } = await db
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action,
        category,
        details: typeof details === 'object' ? details : { message: String(details) },
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select('*')
      .single();

    if (error) throw error;
    logger.info(`[Audit] Evento registado: ${action} [${category}] - ${userEmail}`);
    return data;
  } catch (err) {
    logger.error(`Erro ao gravar audit_log na BD: ${err.message}`);
    return null;
  }
}

/**
 * Obtém logs de auditoria (para Super Admin ou por Tenant)
 */
async function getAuditLogs({ tenantId = null, category = null, limit = 50 }) {
  const db = getSupabase();
  if (!db) return [];

  try {
    let query = db
      .from('audit_logs')
      .select('*, tenants(name, slug)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar audit_logs: ${err.message}`);
    return [];
  }
}

module.exports = {
  logAuditEvent,
  getAuditLogs,
};
