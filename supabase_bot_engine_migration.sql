-- =====================================================================
-- MIGRAÇÃO: MOTOR MULTI-BOT (1 sessão WhatsApp + 1 QR por tenant)
-- Execute DEPOIS do supabase_multi_tenant_schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. bot_auth_state — credenciais Baileys por TENANT + SESSÃO
-- ---------------------------------------------------------------------
-- Antes: uma única linha global por "key" (creds, app-state-sync-key--X, etc).
-- Isso significa uma ÚNICA identidade WhatsApp para toda a plataforma.
-- Agora: cada tenant/sessão tem o seu próprio conjunto de chaves.

CREATE TABLE IF NOT EXISTS bot_auth_state (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  session_name TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (tenant_id, session_name, key)
);

-- Se a tabela já existir de uma instalação anterior (single-tenant),
-- adiciona as colunas que faltam e migra os dados para o tenant padrão.
ALTER TABLE bot_auth_state ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE bot_auth_state ADD COLUMN IF NOT EXISTS session_name TEXT NOT NULL DEFAULT 'default';

UPDATE bot_auth_state
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE bot_auth_state ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_auth_state_pkey') THEN
    ALTER TABLE bot_auth_state DROP CONSTRAINT bot_auth_state_pkey;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bot_auth_state_tenant_session_key_pk') THEN
    ALTER TABLE bot_auth_state
      ADD CONSTRAINT bot_auth_state_tenant_session_key_pk PRIMARY KEY (tenant_id, session_name, key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_auth_state_tenant_session ON bot_auth_state(tenant_id, session_name);

ALTER TABLE bot_auth_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service Role Full Access Bot Auth State" ON bot_auth_state;
CREATE POLICY "Service Role Full Access Bot Auth State" ON bot_auth_state FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 2. tenants — número para onde o bot encaminha/avisa o atendimento humano
-- ---------------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_phone TEXT;

-- ---------------------------------------------------------------------
-- 3. whatsapp_sessions — garante coluna de erro/último evento (usada pelo
--    botManager para expor motivo de falha de conexão no painel)
-- ---------------------------------------------------------------------
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS last_error TEXT;

-- ---------------------------------------------------------------------
-- 4. Corrige a policy de subscriptions/plans/whatsapp_sessions/tenant_users
--    (o schema multi-tenant ligou RLS mas não criou policies — sem policy
--    e com RLS ligado, ninguém consegue ler via anon/authenticated key.
--    A API usa sempre a service key, que ignora RLS, então isto só importa
--    se um dia ligares queries directas do browser com a anon key.)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Service Role Full Access Whatsapp Sessions" ON whatsapp_sessions;
CREATE POLICY "Service Role Full Access Whatsapp Sessions" ON whatsapp_sessions FOR ALL USING (true) WITH CHECK (true);
