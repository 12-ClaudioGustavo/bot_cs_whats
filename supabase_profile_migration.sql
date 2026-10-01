-- =====================================================================
-- MIGRAÇÃO: ADIÇÃO DE PERFIS DE UTILIZADOR E CAMPOS EMPRESA / PESSOAL
-- Execute este script no Supabase SQL Editor.
-- =====================================================================

-- 1. ADICIONAR CAMPOS DE TIPO E DADOS DA EMPRESA NA TABELA TENANTS
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'company' CHECK (type IN ('company', 'personal'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nif TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 2. ADICIONAR CAMPOS DE PERFIL INDIVIDUAL NA TABELA TENANT_USERS
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'system'));
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-PT';

-- 3. ÍNDICES DE DESEMPENHO
CREATE INDEX IF NOT EXISTS idx_tenants_type ON tenants(type);

-- 4. ATUALIZAR CHECK CONSTRAINT DE STATUS DO TENANT
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'cancelled', 'pending_payment'));

