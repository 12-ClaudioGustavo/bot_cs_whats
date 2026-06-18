#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════╗
 * ║   🛠️  PAINEL DE ADMINISTRAÇÃO — C-Space Bot     ║
 * ╚══════════════════════════════════════════════════╝
 *
 * Execute: node admin.js
 */

require('dotenv').config();
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// ─── SUPABASE ────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── INTERFACE DE LEITURA ────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

// ─── CORES ───────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const ok   = (msg) => console.log(`${c.green}  ✅ ${msg}${c.reset}`);
const err  = (msg) => console.log(`${c.red}  ❌ ${msg}${c.reset}`);
const info = (msg) => console.log(`${c.cyan}  ℹ️  ${msg}${c.reset}`);
const warn = (msg) => console.log(`${c.yellow}  ⚠️  ${msg}${c.reset}`);
const sep  = ()    => console.log(`${c.gray}  ${'─'.repeat(54)}${c.reset}`);
const nl   = ()    => console.log('');

// ─── MENU PRINCIPAL ───────────────────────────────────
async function mainMenu() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║   🛠️   PAINEL ADMIN — C-Space Technologies Bot        ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════╝${c.reset}\n`);

  console.log(`${c.bold}  📋 SERVIÇOS${c.reset}`);
  console.log(`  ${c.cyan}1${c.reset}. Listar todos os serviços`);
  console.log(`  ${c.cyan}2${c.reset}. Adicionar novo serviço`);
  console.log(`  ${c.cyan}3${c.reset}. Editar serviço`);
  console.log(`  ${c.cyan}4${c.reset}. Activar / Desactivar serviço`);
  console.log(`  ${c.cyan}5${c.reset}. Apagar serviço`);
  nl();
  console.log(`${c.bold}  ❓ FAQ${c.reset}`);
  console.log(`  ${c.cyan}6${c.reset}. Listar todas as FAQs`);
  console.log(`  ${c.cyan}7${c.reset}. Adicionar nova FAQ`);
  console.log(`  ${c.cyan}8${c.reset}. Apagar FAQ`);
  nl();
  console.log(`${c.bold}  📅 AGENDAMENTOS${c.reset}`);
  console.log(`  ${c.cyan}9${c.reset}. Ver agendamentos pendentes`);
  console.log(`  ${c.cyan}10${c.reset}. Ver todos os agendamentos`);
  console.log(`  ${c.cyan}11${c.reset}. Confirmar / Cancelar agendamento`);
  nl();
  console.log(`${c.bold}  👥 CLIENTES${c.reset}`);
  console.log(`  ${c.cyan}12${c.reset}. Listar clientes registados`);
  nl();
  console.log(`  ${c.red}0${c.reset}. Sair`);
  nl();
  sep();

  const choice = await ask(`\n  ${c.bold}Escolha uma opção:${c.reset} `);

  switch (choice.trim()) {
    case '1':  await listServices(); break;
    case '2':  await addService(); break;
    case '3':  await editService(); break;
    case '4':  await toggleService(); break;
    case '5':  await deleteService(); break;
    case '6':  await listFAQs(); break;
    case '7':  await addFAQ(); break;
    case '8':  await deleteFAQ(); break;
    case '9':  await listAppointments('pending'); break;
    case '10': await listAppointments('all'); break;
    case '11': await updateAppointmentStatus(); break;
    case '12': await listClients(); break;
    case '0':
      console.log(`\n${c.green}  👋 Até logo!${c.reset}\n`);
      rl.close();
      process.exit(0);
    default:
      warn('Opção inválida.');
      await pause();
      await mainMenu();
  }
}

// ══════════════════════════════════════════════════════
//  SERVIÇOS
// ══════════════════════════════════════════════════════

async function listServices() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  📋 SERVIÇOS CADASTRADOS${c.reset}\n`);

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('sort_order');

  if (error) { err(error.message); await pause(); return mainMenu(); }

  if (!data || data.length === 0) {
    warn('Nenhum serviço cadastrado ainda.');
    await pause();
    return mainMenu();
  }

  data.forEach((s, i) => {
    const status = s.is_active ? `${c.green}● ACTIVO${c.reset}` : `${c.red}○ INACTIVO${c.reset}`;
    console.log(`  ${c.bold}${i + 1}.${c.reset} ${s.icon || '🔹'} ${c.bold}${s.name}${c.reset}  ${status}`);
    console.log(`     ${c.gray}${s.description.substring(0, 70)}...${c.reset}`);
    console.log(`     💰 ${s.price_range || 'Sob consulta'}  ⏱️ ${s.duration_estimate || 'A definir'}`);
    nl();
  });

  sep();
  await pause();
  return mainMenu();
}

async function addService() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  ➕ ADICIONAR NOVO SERVIÇO${c.reset}\n`);

  const name = await ask(`  ${c.bold}Nome do serviço:${c.reset} `);
  if (!name.trim()) { warn('Nome não pode ser vazio.'); await pause(); return mainMenu(); }

  const description = await ask(`  ${c.bold}Descrição completa:${c.reset} `);
  const price_range = await ask(`  ${c.bold}Faixa de preço (ex: Kz 150.000 - 500.000):${c.reset} `);
  const duration_estimate = await ask(`  ${c.bold}Prazo estimado (ex: 2 a 4 semanas):${c.reset} `);
  const category = await ask(`  ${c.bold}Categoria (desenvolvimento/suporte/consultoria/formacao):${c.reset} `);
  const icon = await ask(`  ${c.bold}Emoji ícone (ex: 💻 🌐 📱 🛠️ 🎯):${c.reset} `);

  nl();
  console.log(`  ${c.bold}Resumo:${c.reset}`);
  console.log(`  Nome: ${c.cyan}${name}${c.reset}`);
  console.log(`  Preço: ${c.cyan}${price_range || 'Sob consulta'}${c.reset}`);
  console.log(`  Prazo: ${c.cyan}${duration_estimate || 'A definir'}${c.reset}`);
  nl();

  const confirm = await ask(`  ${c.bold}Confirmar? (s/n):${c.reset} `);
  if (confirm.toLowerCase() !== 's') { warn('Cancelado.'); await pause(); return mainMenu(); }

  // Obtém próximo sort_order
  const { data: last } = await supabase
    .from('services')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = (last?.[0]?.sort_order || 0) + 1;

  const { error } = await supabase.from('services').insert({
    name: name.trim(),
    description: description.trim(),
    price_range: price_range.trim() || null,
    duration_estimate: duration_estimate.trim() || null,
    category: category.trim() || 'geral',
    icon: icon.trim() || '🔹',
    is_active: true,
    sort_order: nextOrder,
  });

  if (error) { err(`Erro: ${error.message}`); } else { ok(`Serviço "${name}" adicionado com sucesso!`); }
  await pause();
  return mainMenu();
}

async function editService() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  ✏️  EDITAR SERVIÇO${c.reset}\n`);

  const { data } = await supabase.from('services').select('*').order('sort_order');
  if (!data || data.length === 0) { warn('Nenhum serviço para editar.'); await pause(); return mainMenu(); }

  data.forEach((s, i) => console.log(`  ${c.cyan}${i + 1}${c.reset}. ${s.icon || ''} ${s.name}`));
  nl();

  const choice = await ask(`  ${c.bold}Número do serviço a editar (ou 0 para cancelar):${c.reset} `);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= data.length) { warn('Cancelado.'); await pause(); return mainMenu(); }

  const service = data[idx];
  console.log(`\n  ${c.gray}(Deixe em branco para manter o valor actual)${c.reset}\n`);

  const name = await ask(`  Nome [${service.name}]: `);
  const description = await ask(`  Descrição [${service.description.substring(0, 40)}...]: `);
  const price_range = await ask(`  Preço [${service.price_range || 'Sob consulta'}]: `);
  const duration_estimate = await ask(`  Prazo [${service.duration_estimate || 'A definir'}]: `);
  const icon = await ask(`  Ícone [${service.icon || '🔹'}]: `);

  const updates = {};
  if (name.trim()) updates.name = name.trim();
  if (description.trim()) updates.description = description.trim();
  if (price_range.trim()) updates.price_range = price_range.trim();
  if (duration_estimate.trim()) updates.duration_estimate = duration_estimate.trim();
  if (icon.trim()) updates.icon = icon.trim();

  if (Object.keys(updates).length === 0) { warn('Nada alterado.'); await pause(); return mainMenu(); }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from('services').update(updates).eq('id', service.id);
  if (error) { err(`Erro: ${error.message}`); } else { ok(`Serviço "${service.name}" actualizado!`); }
  await pause();
  return mainMenu();
}

async function toggleService() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  🔄 ACTIVAR / DESACTIVAR SERVIÇO${c.reset}\n`);

  const { data } = await supabase.from('services').select('*').order('sort_order');
  if (!data || data.length === 0) { warn('Nenhum serviço encontrado.'); await pause(); return mainMenu(); }

  data.forEach((s, i) => {
    const status = s.is_active ? `${c.green}ACTIVO${c.reset}` : `${c.red}INACTIVO${c.reset}`;
    console.log(`  ${c.cyan}${i + 1}${c.reset}. ${s.icon || ''} ${s.name}  [${status}]`);
  });
  nl();

  const choice = await ask(`  ${c.bold}Número do serviço (ou 0 para cancelar):${c.reset} `);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= data.length) { warn('Cancelado.'); await pause(); return mainMenu(); }

  const service = data[idx];
  const newStatus = !service.is_active;

  const { error } = await supabase
    .from('services')
    .update({ is_active: newStatus, updated_at: new Date().toISOString() })
    .eq('id', service.id);

  if (error) { err(`Erro: ${error.message}`); }
  else { ok(`"${service.name}" → ${newStatus ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}`); }
  await pause();
  return mainMenu();
}

async function deleteService() {
  console.clear();
  console.log(`\n${c.bold}${c.red}  🗑️  APAGAR SERVIÇO${c.reset}\n`);

  const { data } = await supabase.from('services').select('*').order('sort_order');
  if (!data || data.length === 0) { warn('Nenhum serviço encontrado.'); await pause(); return mainMenu(); }

  data.forEach((s, i) => console.log(`  ${c.cyan}${i + 1}${c.reset}. ${s.icon || ''} ${s.name}`));
  nl();

  const choice = await ask(`  ${c.bold}Número do serviço a apagar (ou 0 para cancelar):${c.reset} `);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= data.length) { warn('Cancelado.'); await pause(); return mainMenu(); }

  const service = data[idx];
  const confirm = await ask(`  ${c.red}${c.bold}Apagar "${service.name}"? Esta acção é IRREVERSÍVEL. (s/n):${c.reset} `);
  if (confirm.toLowerCase() !== 's') { warn('Cancelado.'); await pause(); return mainMenu(); }

  const { error } = await supabase.from('services').delete().eq('id', service.id);
  if (error) { err(`Erro: ${error.message}`); } else { ok(`"${service.name}" apagado.`); }
  await pause();
  return mainMenu();
}

// ══════════════════════════════════════════════════════
//  FAQ
// ══════════════════════════════════════════════════════

async function listFAQs() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  ❓ FAQS CADASTRADAS${c.reset}\n`);

  const { data, error } = await supabase.from('faqs').select('*').order('sort_order');
  if (error) { err(error.message); await pause(); return mainMenu(); }

  if (!data || data.length === 0) { warn('Nenhuma FAQ cadastrada.'); await pause(); return mainMenu(); }

  data.forEach((f, i) => {
    const status = f.is_active ? `${c.green}●${c.reset}` : `${c.red}○${c.reset}`;
    console.log(`  ${status} ${c.bold}${i + 1}.${c.reset} ${f.question}`);
    console.log(`     ${c.gray}${f.answer.substring(0, 80)}...${c.reset}`);
    console.log(`     ${c.gray}Categoria: ${f.category} | Visualizações: ${f.view_count || 0}${c.reset}`);
    nl();
  });

  sep();
  await pause();
  return mainMenu();
}

async function addFAQ() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  ➕ ADICIONAR NOVA FAQ${c.reset}\n`);

  const question = await ask(`  ${c.bold}Pergunta:${c.reset} `);
  if (!question.trim()) { warn('Pergunta não pode ser vazia.'); await pause(); return mainMenu(); }

  console.log(`  ${c.bold}Resposta${c.reset} ${c.gray}(pode usar *negrito*, _itálico_ e quebras de linha com \\n):${c.reset}`);
  const answer = await ask(`  `);
  if (!answer.trim()) { warn('Resposta não pode ser vazia.'); await pause(); return mainMenu(); }

  const category = await ask(`  ${c.bold}Categoria (geral/precos/prazos/suporte/tecnologia/processo):${c.reset} `);

  const { data: last } = await supabase.from('faqs').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = (last?.[0]?.sort_order || 0) + 1;

  const { error } = await supabase.from('faqs').insert({
    question: question.trim(),
    answer: answer.trim().replace(/\\n/g, '\n'),
    category: category.trim() || 'geral',
    is_active: true,
    sort_order: nextOrder,
  });

  if (error) { err(`Erro: ${error.message}`); } else { ok(`FAQ adicionada com sucesso!`); }
  await pause();
  return mainMenu();
}

async function deleteFAQ() {
  console.clear();
  console.log(`\n${c.bold}${c.red}  🗑️  APAGAR FAQ${c.reset}\n`);

  const { data } = await supabase.from('faqs').select('*').order('sort_order');
  if (!data || data.length === 0) { warn('Nenhuma FAQ encontrada.'); await pause(); return mainMenu(); }

  data.forEach((f, i) => console.log(`  ${c.cyan}${i + 1}${c.reset}. ${f.question}`));
  nl();

  const choice = await ask(`  ${c.bold}Número da FAQ a apagar (ou 0 para cancelar):${c.reset} `);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= data.length) { warn('Cancelado.'); await pause(); return mainMenu(); }

  const faq = data[idx];
  const confirm = await ask(`  ${c.red}${c.bold}Apagar esta FAQ? (s/n):${c.reset} `);
  if (confirm.toLowerCase() !== 's') { warn('Cancelado.'); await pause(); return mainMenu(); }

  const { error } = await supabase.from('faqs').delete().eq('id', faq.id);
  if (error) { err(`Erro: ${error.message}`); } else { ok(`FAQ apagada.`); }
  await pause();
  return mainMenu();
}

// ══════════════════════════════════════════════════════
//  AGENDAMENTOS
// ══════════════════════════════════════════════════════

async function listAppointments(filter = 'all') {
  console.clear();
  const title = filter === 'pending' ? 'AGENDAMENTOS PENDENTES' : 'TODOS OS AGENDAMENTOS';
  console.log(`\n${c.bold}${c.cyan}  📅 ${title}${c.reset}\n`);

  let query = supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (filter === 'pending') query = query.eq('status', 'pending');

  const { data, error } = await query;
  if (error) { err(error.message); await pause(); return mainMenu(); }

  if (!data || data.length === 0) {
    info(filter === 'pending' ? 'Nenhum agendamento pendente.' : 'Nenhum agendamento encontrado.');
    await pause();
    return mainMenu();
  }

  const statusColors = {
    pending:   `${c.yellow}PENDENTE${c.reset}`,
    confirmed: `${c.green}CONFIRMADO${c.reset}`,
    cancelled: `${c.red}CANCELADO${c.reset}`,
    completed: `${c.blue}CONCLUÍDO${c.reset}`,
  };

  data.forEach((a, i) => {
    console.log(`  ${c.bold}${i + 1}.${c.reset} ${statusColors[a.status] || a.status}`);
    console.log(`     👤 ${a.client_name || 'N/A'}  📞 ${a.phone}`);
    console.log(`     🛠️  ${a.service_name}`);
    console.log(`     📅 ${a.scheduled_date || '—'}  🕐 ${a.scheduled_time || '—'}`);
    if (a.notes) console.log(`     📝 ${a.notes}`);
    console.log(`     ${c.gray}Criado: ${new Date(a.created_at).toLocaleString('pt-PT')}${c.reset}`);
    nl();
  });

  sep();
  await pause();
  return mainMenu();
}

async function updateAppointmentStatus() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  ✏️  ACTUALIZAR AGENDAMENTO${c.reset}\n`);

  const { data } = await supabase
    .from('appointments')
    .select('*')
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) { info('Nenhum agendamento activo.'); await pause(); return mainMenu(); }

  data.forEach((a, i) => {
    console.log(`  ${c.cyan}${i + 1}${c.reset}. ${a.client_name || 'N/A'} — ${a.service_name} — ${a.scheduled_date || 'Sem data'} [${a.status}]`);
  });
  nl();

  const choice = await ask(`  ${c.bold}Número do agendamento (ou 0 para cancelar):${c.reset} `);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= data.length) { warn('Cancelado.'); await pause(); return mainMenu(); }

  const appointment = data[idx];
  console.log(`\n  Novo estado:`);
  console.log(`  ${c.cyan}1${c.reset}. ✅ Confirmar`);
  console.log(`  ${c.cyan}2${c.reset}. ✔️  Marcar como Concluído`);
  console.log(`  ${c.cyan}3${c.reset}. ❌ Cancelar`);
  nl();

  const statusChoice = await ask(`  ${c.bold}Escolha:${c.reset} `);
  const statusMap = { '1': 'confirmed', '2': 'completed', '3': 'cancelled' };
  const newStatus = statusMap[statusChoice.trim()];

  if (!newStatus) { warn('Opção inválida.'); await pause(); return mainMenu(); }

  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', appointment.id);

  if (error) { err(`Erro: ${error.message}`); }
  else { ok(`Agendamento de ${appointment.client_name} → ${newStatus.toUpperCase()}`); }
  await pause();
  return mainMenu();
}

// ══════════════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════════════

async function listClients() {
  console.clear();
  console.log(`\n${c.bold}${c.cyan}  👥 CLIENTES REGISTADOS${c.reset}\n`);

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('last_contact_at', { ascending: false })
    .limit(30);

  if (error) { err(error.message); await pause(); return mainMenu(); }

  if (!data || data.length === 0) { info('Nenhum cliente registado ainda.'); await pause(); return mainMenu(); }

  console.log(`  ${c.gray}Total: ${data.length} clientes${c.reset}\n`);

  data.forEach((cl, i) => {
    console.log(`  ${c.bold}${i + 1}.${c.reset} 📞 ${cl.phone}  ${cl.name ? `👤 ${cl.name}` : ''}`);
    console.log(`     ${c.gray}Último contacto: ${new Date(cl.last_contact_at).toLocaleString('pt-PT')} | Conversas: ${cl.total_conversations}${c.reset}`);
  });

  sep();
  await pause();
  return mainMenu();
}

// ─── UTILITÁRIO ───────────────────────────────────────
async function pause() {
  nl();
  await ask(`  ${c.gray}Pressione ENTER para continuar...${c.reset}`);
}

// ─── INÍCIO ───────────────────────────────────────────
mainMenu().catch(e => {
  console.error(`\n${c.red}Erro fatal: ${e.message}${c.reset}\n`);
  process.exit(1);
});
