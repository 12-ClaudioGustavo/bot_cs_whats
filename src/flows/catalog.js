const { getSupabase } = require('../services/supabase');
const logger = require('../utils/logger');

/**
 * Busca todos os serviços activos do banco de dados
 */
async function getServices() {
  const db = getSupabase();
  if (!db) return getDefaultServices();

  try {
    const { data, error } = await db
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data && data.length > 0 ? data : getDefaultServices();
  } catch (err) {
    logger.error(`Erro ao buscar serviços: ${err.message}`);
    return getDefaultServices();
  }
}

/**
 * Retorna mensagem com lista de serviços
 */
async function getCatalogListMessage() {
  const services = await getServices();

  let msg = `📋 *Catálogo de Serviços*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Confira os nossos serviços e seleccione para ver detalhes:\n\n`;

  services.forEach((service, i) => {
    msg += `${service.icon || '🔹'} *${i + 1}.* ${service.name}\n`;
  });

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Digite o *número* do serviço para ver detalhes\n`;
  msg += `ou *0* para voltar ao menu`;

  return { msg, services };
}

/**
 * Retorna mensagem com detalhes de um serviço específico
 */
function getServiceDetailMessage(service) {
  return (
    `${service.icon || '💼'} *${service.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📝 *Descrição:*\n${service.description}\n\n` +
    `💰 *Investimento:* ${service.price_range || 'Sob consulta'}\n` +
    `⏱️ *Prazo estimado:* ${service.duration_estimate || 'A definir'}\n` +
    `🏷️ *Categoria:* ${service.category || 'Geral'}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Quer saber mais ou agendar este serviço?\n\n` +
    `3️⃣  Agendar este serviço\n` +
    `🔙 *Listar* — ver todos os serviços\n` +
    `0️⃣  Voltar ao menu principal`
  );
}

/**
 * Serviços padrão (fallback sem banco de dados)
 */
function getDefaultServices() {
  return [
    { id: null, name: 'Desenvolvimento de Software', description: 'Sistemas personalizados para a sua empresa.', price_range: 'Sob consulta', duration_estimate: '1 a 6 meses', category: 'desenvolvimento', icon: '💻' },
    { id: null, name: 'Desenvolvimento Web', description: 'Sites e plataformas web modernas.', price_range: 'Kz 150.000 - 800.000', duration_estimate: '2 a 8 semanas', category: 'desenvolvimento', icon: '🌐' },
    { id: null, name: 'Aplicações Mobile', description: 'Apps para Android e iOS.', price_range: 'Kz 300.000 - 1.500.000', duration_estimate: '2 a 5 meses', category: 'desenvolvimento', icon: '📱' },
    { id: null, name: 'Integração de APIs', description: 'Ligação entre sistemas e automação.', price_range: 'Kz 80.000 - 400.000', duration_estimate: '1 a 4 semanas', category: 'desenvolvimento', icon: '🔗' },
    { id: null, name: 'Suporte Técnico', description: 'Assistência para resolução de problemas.', price_range: 'Kz 15.000/hora', duration_estimate: 'Sob demanda', category: 'suporte', icon: '🛠️' },
    { id: null, name: 'Consultoria em TI', description: 'Consultoria estratégica em tecnologia.', price_range: 'Kz 25.000/hora', duration_estimate: 'Sob demanda', category: 'consultoria', icon: '🎯' },
    { id: null, name: 'Manutenção de Sistemas', description: 'Manutenção preventiva e correctiva.', price_range: 'Kz 50.000/mês', duration_estimate: 'Contínuo', category: 'suporte', icon: '⚙️' },
    { id: null, name: 'Treinamento e Capacitação', description: 'Formação técnica para equipas.', price_range: 'Kz 30.000/sessão', duration_estimate: '1 a 5 dias', category: 'formacao', icon: '📚' },
  ];
}

module.exports = { getCatalogListMessage, getServiceDetailMessage, getServices };
