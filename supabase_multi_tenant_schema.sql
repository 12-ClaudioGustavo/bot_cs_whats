-- =====================================================================
-- SCHEMA SUPABASE - PLATAFORMA SAAS MULTI-TENANT C-SPACE WHATSAPP
-- Execute este script no SQL Editor do Supabase para evoluir a estrutura.
-- =====================================================================

-- Extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABELA: tenants (Empresas / Workspaces)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2. TABELA: plans (Planos de Subscrição e Limites)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL CHECK (code IN ('free', 'starter', 'business', 'enterprise')),
  name TEXT NOT NULL,
  description TEXT,
  price_kz NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  max_whatsapp_accounts INTEGER NOT NULL DEFAULT 1,
  monthly_message_limit INTEGER NOT NULL DEFAULT 100,
  max_users INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir planos padrão se não existirem
INSERT INTO plans (code, name, description, price_kz, max_whatsapp_accounts, monthly_message_limit, max_users) VALUES
  ('free', 'Plano Gratuito', 'Ideal para testes e pequenas explorações', 0.00, 1, 100, 1),
  ('starter', 'Plano Starter', 'Perfeito para pequenos negócios e profissionais independentes', 25000.00, 1, 1000, 3),
  ('business', 'Plano Business', 'Para empresas em crescimento que precisam de equipa e múltiplos WhatsApps', 65000.00, 3, 5000, 10),
  ('enterprise', 'Plano Enterprise', 'Solução ilimitada sob medida para grandes empresas', 150000.00, 10, 25000, 30)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. TABELA: subscriptions (Subscrição de cada Tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. TABELA: tenant_users (Utilizadores do Sistema com Roles / RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  auth_user_id UUID, -- id vindo do supabase auth.users se aplicável
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT, -- Para autenticação direta se não usar auth do supabase
  role TEXT DEFAULT 'agent' CHECK (role IN ('super_admin', 'owner', 'admin', 'agent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Inserir utilizador Super Admin padrão da C-Space
INSERT INTO tenant_users (id, tenant_id, email, full_name, role, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000001', 'admin@cspace.com', 'Super Admin C-Space', 'super_admin', '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d:c87796d11b816a30c51d6cbeaa6c29b7a3f8fa89b0d61ad9e144d212724bd64e8fb2cfc1a5b8fdfd4757c5e2d7e937d1e8ef3e4a2a1a8c5f9d4e2a1c0b9a8d7e')
ON CONFLICT (tenant_id, email) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. TABELA: whatsapp_sessions (Conexões do WhatsApp por Tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  session_name TEXT NOT NULL DEFAULT 'default',
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'starting', 'qr', 'connected')),
  qr_code_url TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, session_name)
);

-- ---------------------------------------------------------------------
-- 6. TABELA: usage_logs (Registro de Créditos e Uso Mensal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- formato YYYY-MM
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, month_year)
);

-- ---------------------------------------------------------------------
-- 7. ATUALIZAÇÃO DAS TABELAS LEGADAS (Adição do tenant_id)
-- ---------------------------------------------------------------------

-- Tenant Padrão para Migração de Dados Antigos
INSERT INTO tenants (id, name, slug) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'C-Space Technologies (Default)', 'c-space-default')
ON CONFLICT (slug) DO NOTHING;

-- Tabela: clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE clients SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Tabela: conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE conversations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Tabela: services
ALTER TABLE services ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE services SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Tabela: appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE appointments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Tabela: faqs
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE faqs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Tabela: bot_sessions
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE bot_sessions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- ---------------------------------------------------------------------
-- 8. TABELA: automations (Configurações de Automação por Tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  welcome_message TEXT DEFAULT 'Olá! Bem-vindo à nossa empresa. Como podemos ajudar hoje?',
  out_of_hours_message TEXT DEFAULT 'Estamos fora do nosso horário de atendimento. Deixe a sua mensagem e responderemos assim que possível.',
  business_hours_start TIME DEFAULT '08:00:00',
  business_hours_end TIME DEFAULT '18:00:00',
  enable_ai_bot BOOLEAN DEFAULT TRUE,
  enable_human_takeover BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ---------------------------------------------------------------------
-- 9. ÍNDICES DE DESEMPENHO E MULTI-TENANCY
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant ON faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_tenant ON bot_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_tenant ON whatsapp_sessions(tenant_id);

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) & SEGURANÇA MULTI-TENANT
-- ---------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
-- ---------------------------------------------------------------------
-- 11. TABELA: audit_logs (Logs de Auditoria e Segurança)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  category TEXT DEFAULT 'system' CHECK (category IN ('auth', 'tenant', 'billing', 'session', 'system', 'security')),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT DEFAULT 'unknown',
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Full Access Audit Logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
