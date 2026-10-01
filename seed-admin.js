require('dotenv').config();
const { getSupabase } = require('./src/services/supabase');
const { hashPassword } = require('./src/services/authService');
const logger = require('./src/utils/logger');

async function seedAdmin() {
  const db = getSupabase();
  if (!db) {
    console.error('❌ Supabase não configurado ou sem credenciais no .env.');
    process.exit(1);
  }

  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@cspace.com';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'CSpaceAdmin2026!';

  console.log(`\n⏳ A criar/atualizar credenciais do Super Admin (${adminEmail})...`);

  // 1. Garantir que existe o tenant principal C-Space
  let { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('id')
    .eq('slug', 'cspace-master')
    .maybeSingle();

  if (tenantErr) {
    console.error('❌ Erro ao procurar tenant master:', tenantErr.message);
    process.exit(1);
  }

  if (!tenant) {
    console.log('📌 Criando tenant master (cspace-master)...');
    const { data: newTenant, error: createTenantErr } = await db
      .from('tenants')
      .insert({
        name: 'C-Space Technologies',
        slug: 'cspace-master',
        status: 'active',
      })
      .select('id')
      .single();

    if (createTenantErr) {
      console.error('❌ Erro ao criar tenant master:', createTenantErr.message);
      process.exit(1);
    }
    tenant = newTenant;
  }

  // 2. Gerar Hash PBKDF2 correto para a password do Admin
  const passwordHash = hashPassword(adminPassword);

  // 3. Verificar se o utilizador admin já existe
  const { data: existingUser } = await db
    .from('tenant_users')
    .select('id, email, password_hash')
    .eq('email', adminEmail)
    .maybeSingle();

  if (existingUser) {
    // Atualiza a password_hash e garante que o role é super_admin
    const { error: updateErr } = await db
      .from('tenant_users')
      .update({
        password_hash: passwordHash,
        role: 'super_admin',
        is_active: true,
      })
      .eq('id', existingUser.id);

    if (updateErr) {
      console.error('❌ Erro ao atualizar utilizador admin:', updateErr.message);
      process.exit(1);
    }
    console.log(`✅ Palavra-passe e role do Admin (${adminEmail}) atualizados com sucesso (PBKDF2 SHA-512)!`);
  } else {
    // Cria novo utilizador admin
    const { error: insertErr } = await db.from('tenant_users').insert({
      tenant_id: tenant.id,
      email: adminEmail,
      full_name: 'Super Admin C-Space',
      password_hash: passwordHash,
      role: 'super_admin',
      is_active: true,
    });

    if (insertErr) {
      console.error('❌ Erro ao inserir novo utilizador admin:', insertErr.message);
      process.exit(1);
    }
    console.log(`✅ Super Admin (${adminEmail}) criado com sucesso no Supabase!`);
  }

  console.log('\n======================================================');
  console.log('🎉 Credenciais de AdministradorProntas para Login:');
  console.log(`   E-mail:   ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('======================================================\n');
  process.exit(0);
}

seedAdmin();
