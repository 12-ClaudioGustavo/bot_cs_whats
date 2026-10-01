const { getSupabase } = require('./supabase');
const logger = require('../utils/logger');

const defaultConfig = {
  welcomeMsg: 'Olá! Seja bem-vindo(a) à nossa empresa. Como podemos ajudar hoje?\n\nEscolha uma das opções abaixo:',
  aboutMsg: 'Somos uma empresa dedicada a oferecer as melhores soluções para os nossos clientes com inovação, qualidade e excelência.',
  fallbackMsg: 'Não compreendi a sua mensagem. Por favor, escolha uma das opções disponíveis ou escreva "menu" para ver as opções.',
  outOfHoursMsg: 'Estamos fora do nosso horário de atendimento. Deixe a sua mensagem e responderemos assim que possível.',
  menuItems: [
    { id: '1', trigger: '1', response: 'A nossa empresa oferece soluções completas e atendimento personalizado.' },
    { id: '2', trigger: '2', response: 'Consulte o nosso catálogo de serviços para saber mais.' },
    { id: '3', trigger: '3', response: 'Para agendar uma reunião ou serviço, informe a data e horário pretendidos.' },
    { id: '4', trigger: '4', response: 'Consulte as nossas perguntas frequentes (FAQ).' },
  ],
  services: [],
  faqs: [],
};

/**
 * Procura as FAQs de um tenant
 */
async function getTenantFAQs(tenantId) {
  const db = getSupabase();
  if (!db || !tenantId) return [];

  try {
    const { data, error } = await db
      .from('faqs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`[botConfigService] Erro ao buscar FAQs (tenant ${tenantId}): ${err.message}`);
    return [];
  }
}

/**
 * Procura os Serviços de um tenant
 */
async function getTenantServices(tenantId) {
  const db = getSupabase();
  if (!db || !tenantId) return [];

  try {
    const { data, error } = await db
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    logger.error(`[botConfigService] Erro ao buscar Serviços (tenant ${tenantId}): ${err.message}`);
    return [];
  }
}

/**
 * Procura a configuração completa do bot de um tenant
 */
async function getBotConfig(tenantId) {
  const db = getSupabase();
  if (!db || !tenantId) return defaultConfig;

  try {
    const { data: auto } = await db
      .from('automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const services = await getTenantServices(tenantId);
    const faqs = await getTenantFAQs(tenantId);

    // Dados do tenant para apresentação
    const { data: tenant } = await db
      .from('tenants')
      .select('name, phone, email, website, address, city')
      .eq('id', tenantId)
      .maybeSingle();

    return {
      welcomeMsg: auto?.welcome_message || defaultConfig.welcomeMsg,
      aboutMsg: auto?.about_message || (tenant?.name ? `Bem-vindo à *${tenant.name}*!\n${defaultConfig.aboutMsg}` : defaultConfig.aboutMsg),
      fallbackMsg: auto?.fallback_message || defaultConfig.fallbackMsg,
      outOfHoursMsg: auto?.out_of_hours_message || defaultConfig.outOfHoursMsg,
      menuItems: auto?.menu_items || defaultConfig.menuItems,
      services: services.map(s => ({ id: s.id, name: s.name, description: s.description || '', price: s.price || '' })),
      faqs: faqs.map(f => ({ id: f.id, question: f.question, answer: f.answer, sort_order: f.sort_order || 0 })),
      company: tenant ? {
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        website: tenant.website,
        address: tenant.address,
        city: tenant.city,
      } : null,
    };
  } catch (err) {
    logger.error(`[botConfigService] Erro ao carregar bot config (tenant ${tenantId}): ${err.message}`);
    return defaultConfig;
  }
}

/**
 * Guarda a configuração completa do bot de um tenant
 */
async function saveBotConfig(tenantId, configData) {
  const db = getSupabase();
  if (!db || !tenantId) return false;

  try {
    const { welcomeMsg, aboutMsg, fallbackMsg, outOfHoursMsg, menuItems, services, faqs } = configData;

    // 1. Guarda automations
    const autoPayload = {
      tenant_id: tenantId,
      welcome_message: welcomeMsg,
      about_message: aboutMsg,
      fallback_message: fallbackMsg,
      out_of_hours_message: outOfHoursMsg,
      menu_items: menuItems || [],
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await db.from('automations').select('id').eq('tenant_id', tenantId).maybeSingle();
    if (existing) {
      await db.from('automations').update(autoPayload).eq('tenant_id', tenantId);
    } else {
      await db.from('automations').insert([autoPayload]);
    }

    // 2. Atualiza Serviços se fornecidos
    if (Array.isArray(services)) {
      // Remove serviços antigos e insere novos para sincronizar
      await db.from('services').delete().eq('tenant_id', tenantId);
      if (services.length > 0) {
        const servicesRows = services.map((s, idx) => ({
          tenant_id: tenantId,
          name: s.name,
          description: s.description || '',
          price: s.price || '',
        }));
        await db.from('services').insert(servicesRows);
      }
    }

    // 3. Atualiza FAQs se fornecidas
    if (Array.isArray(faqs)) {
      await db.from('faqs').delete().eq('tenant_id', tenantId);
      if (faqs.length > 0) {
        const faqRows = faqs.map((f, idx) => ({
          tenant_id: tenantId,
          question: f.question,
          answer: f.answer,
          sort_order: idx + 1,
          is_active: true,
        }));
        await db.from('faqs').insert(faqRows);
      }
    }

    return true;
  } catch (err) {
    logger.error(`[botConfigService] Erro ao guardar bot config (tenant ${tenantId}): ${err.message}`);
    throw err;
  }
}

module.exports = {
  getBotConfig,
  saveBotConfig,
  getTenantFAQs,
  getTenantServices,
};
