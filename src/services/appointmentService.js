const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Cria um novo agendamento, escopado ao tenant.
 */
async function createAppointment(tenantId, { phone, clientName, serviceId, serviceName, scheduledDate, scheduledTime, notes }) {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Banco de dados não disponível' };
  if (!tenantId) return { success: false, error: 'tenantId em falta' };

  try {
    // Busca client_id dentro do mesmo tenant
    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle();

    const { data, error } = await db
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        client_id: client?.id || null,
        phone,
        client_name: clientName,
        service_id: serviceId || null,
        service_name: serviceName,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        notes: notes || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Agendamento criado para ${phone} (tenant ${tenantId}): ${serviceName} em ${scheduledDate}`);
    return { success: true, appointment: data };
  } catch (err) {
    logger.error(`Erro ao criar agendamento (tenant ${tenantId}): ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Lista agendamentos de um cliente, dentro do tenant.
 */
async function getAppointmentsByPhone(tenantId, phone, limit = 5) {
  const db = getSupabase();
  if (!db || !tenantId) return [];

  try {
    const { data, error } = await db
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar agendamentos (tenant ${tenantId}): ${err.message}`);
    return [];
  }
}

module.exports = { createAppointment, getAppointmentsByPhone };
