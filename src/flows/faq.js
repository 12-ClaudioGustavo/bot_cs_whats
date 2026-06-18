const { getSupabase } = require('../services/supabase');
const logger = require('../utils/logger');

/**
 * Busca todas as FAQs activas
 */
async function getFAQs() {
  const db = getSupabase();
  if (!db) return getDefaultFAQs();

  try {
    const { data, error } = await db
      .from('faqs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data && data.length > 0 ? data : getDefaultFAQs();
  } catch (err) {
    logger.error(`Erro ao buscar FAQs: ${err.message}`);
    return getDefaultFAQs();
  }
}

/**
 * Incrementa contador de visualizações de uma FAQ
 */
async function incrementFAQView(faqId) {
  const db = getSupabase();
  if (!db || !faqId) return;

  try {
    await db.rpc('increment_faq_view', { faq_id: faqId }).catch(() => {
      // Fallback se RPC não existir
      db.from('faqs').update({ view_count: db.raw('view_count + 1') }).eq('id', faqId);
    });
  } catch (err) {
    // Silenciosamente ignora erros de contagem
  }
}

/**
 * Mensagem com lista de FAQs
 */
async function getFAQListMessage() {
  const faqs = await getFAQs();

  let msg = `❓ *Dúvidas Frequentes*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Seleccione a sua dúvida:\n\n`;

  faqs.forEach((faq, i) => {
    msg += `*${i + 1}.* ${faq.question}\n`;
  });

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Digite o *número* da dúvida\n`;
  msg += `ou *0* para voltar ao menu`;

  return { msg, faqs };
}

/**
 * Retorna a resposta de uma FAQ específica
 */
function getFAQAnswerMessage(faq) {
  return (
    `❓ *${faq.question}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${faq.answer}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔙 *Listar* — ver todas as dúvidas\n` +
    `0️⃣  Voltar ao menu principal`
  );
}

/**
 * Processa o fluxo de FAQ
 */
async function processFAQFlow(input, state) {
  const { step, data } = state;
  const text = input.trim().toLowerCase();

  // Lista de FAQs
  if (step === 'initial' || text === 'listar') {
    const { msg, faqs } = await getFAQListMessage();
    return { reply: msg, nextStep: 'select', dataUpdate: { faqsCache: faqs } };
  }

  // Selecção de FAQ
  if (step === 'select') {
    const faqs = data.faqsCache || await getFAQs();
    const idx = parseInt(input.trim()) - 1;

    if (isNaN(idx) || idx < 0 || idx >= faqs.length) {
      let retry = `⚠️ Opção inválida. Escolha entre 1 e ${faqs.length}:\n\n`;
      faqs.forEach((f, i) => { retry += `*${i + 1}.* ${f.question}\n`; });
      retry += `\nou *0* para voltar ao menu`;
      return { reply: retry, nextStep: 'select' };
    }

    const chosen = faqs[idx];
    await incrementFAQView(chosen.id);

    return {
      reply: getFAQAnswerMessage(chosen),
      nextStep: 'view',
    };
  }

  // Após ver resposta: listar ou voltar ao menu
  if (step === 'view') {
    if (text === 'listar') {
      const { msg, faqs } = await getFAQListMessage();
      return { reply: msg, nextStep: 'select', dataUpdate: { faqsCache: faqs } };
    }
    // Qualquer outra coisa → menu principal
    return { reply: null, nextStep: 'done', resetFlow: true };
  }

  const { msg, faqs } = await getFAQListMessage();
  return { reply: msg, nextStep: 'select', dataUpdate: { faqsCache: faqs } };
}

/**
 * FAQs padrão (fallback sem banco de dados)
 */
function getDefaultFAQs() {
  return [
    { id: null, question: 'Quais serviços a empresa oferece?', answer: 'Oferecemos: Desenvolvimento de Software, Desenvolvimento Web, Apps Mobile, Integração de APIs, Suporte Técnico, Consultoria em TI, Manutenção de Sistemas e Treinamento. Seleccione *2* no menu para ver o catálogo completo.' },
    { id: null, question: 'Como solicitar um orçamento?', answer: 'Pode solicitar um orçamento agendando uma reunião (opção 3 do menu) ou contactando-nos directamente. O orçamento é *gratuito e sem compromisso*!' },
    { id: null, question: 'Quanto tempo demora o desenvolvimento?', answer: '⚡ Sites simples: 2-4 semanas\n🔧 Sistemas médios: 1-3 meses\n🏗️ Projectos complexos: 3-6+ meses\n\nApós análise, fornecemos um cronograma detalhado.' },
    { id: null, question: 'Oferecem suporte após entrega?', answer: 'Sim! Oferecemos:\n✅ Garantia de 3 meses\n📋 Suporte básico por email/WhatsApp\n🔰 Planos de suporte premium\n🤝 Contratos de manutenção mensais' },
    { id: null, question: 'Que tecnologias utilizam?', answer: 'Frontend: React, Next.js, Vue.js, React Native\nBackend: Node.js, Python, PHP\nBD: PostgreSQL, MySQL, MongoDB, Supabase\nCloud: AWS, DigitalOcean, Vercel' },
    { id: null, question: 'Como funciona o processo de desenvolvimento?', answer: '1️⃣ Reunião de levantamento\n2️⃣ Proposta e orçamento\n3️⃣ Contrato e kick-off\n4️⃣ Design e protótipo\n5️⃣ Desenvolvimento por sprints\n6️⃣ Testes e QA\n7️⃣ Entrega e deploy\n8️⃣ Suporte pós-entrega' },
    { id: null, question: 'Têm experiência com projectos angolanos?', answer: 'Sim! Somos uma empresa angolana com experiência no mercado local. Já trabalhámos com clientes em Luanda, Benguela, Huambo e outras províncias. Conhecemos as particularidades do mercado angolano! 🇦🇴' },
  ];
}

module.exports = { getFAQListMessage, processFAQFlow };
