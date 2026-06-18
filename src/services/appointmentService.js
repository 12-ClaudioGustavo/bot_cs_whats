const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

/**
 * Cria um novo agendamento
 */
async function createAppointment({ phone, clientName, serviceId, serviceName, scheduledDate, scheduledTime, notes }) {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Banco de dados não disponível' };

  try {
    // Busca client_id
    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('phone', phone)
      .single();

    const { data, error } = await db
      .from('appointments')
      .insert({
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

    logger.info(`Agendamento criado para ${phone}: ${serviceName} em ${scheduledDate}`);
    return { success: true, appointment: data };
  } catch (err) {
    logger.error(`Erro ao criar agendamento: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Lista agendamentos de um cliente
 */
async function getAppointmentsByPhone(phone, limit = 5) {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('appointments')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`Erro ao listar agendamentos: ${err.message}`);
    return [];
  }
}

module.exports = { createAppointment, getAppointmentsByPhone };
