-- =====================================================================
-- MIGRAÇÃO: ENDURECIMENTO DE RLS (ISOLAMENTO REAL POR TENANT)
-- Execute DEPOIS de supabase_multi_tenant_schema.sql e
-- supabase_bot_engine_migration.sql
-- =====================================================================
--
-- CONTEXTO IMPORTANTE:
-- Hoje toda a aplicação (bot + gateway + painel) fala com o Supabase
-- através do BACKEND NODE, usando a `service_role key`. Essa chave
-- ignora RLS sempre, por desenho do Postgres/Supabase — nenhuma policy
-- muda isso. Então, para quem já usa a service key, RLS não é a
-- protecção principal (o filtro `.eq('tenant_id', ...)` no código é que
-- garante o isolamento do dia a dia).
--
-- O QUE O RLS REALMENTE PROTEGE AQUI: se um dia a `anon key` (a chave
-- pública, usada em código correndo no browser) for exposta — por engano
-- num .env do frontend, por um bug, por alguém copiar a chave errada —
-- SEM RLS bem configurado essa chave consegue ler/escrever TODAS as
-- tabelas de TODOS os tenants directamente do browser, ignorando
-- completamente a tua aplicação. Com RLS activo e SEM políticas abertas
-- ao público, essa chave passa a não conseguir ler nada.
--
-- Encontrei policies antigas (`audit_logs`, e duas que eu próprio criei
-- na migração anterior para `bot_auth_state`/`whatsapp_sessions`) com
-- `USING (true)` SEM restringir a role — isso na prática abre a tabela
-- a QUALQUER chave, incluindo a anon key. Esta migração corrige isso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Corrige as policies antigas demasiado permissivas
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Service Role Full Access Audit Logs"        ON audit_logs;
DROP POLICY IF EXISTS "Service Role Full Access Bot Auth State"    ON bot_auth_state;
DROP POLICY IF EXISTS "Service Role Full Access Whatsapp Sessions" ON whatsapp_sessions;

-- Recria, desta vez restrita explicitamente à service_role.
-- (Tecnicamente redundante — a service_role já ignora RLS por natureza —
-- mas deixa explícito na BD qual é a intenção, e não afecta nenhuma
-- outra role.)
CREATE POLICY "service_role_full_access" ON audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON bot_auth_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON whatsapp_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 2. Activa RLS em TODAS as tabelas com dados de tenant
-- ---------------------------------------------------------------------
-- Tabelas de plataforma/gestão (algumas já tinham RLS activo — ALTER é
-- seguro repetir):
ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_auth_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations         ENABLE ROW LEVEL SECURITY;

-- Tabelas de dados de negócio (do schema base) — provavelmente ainda
-- SEM RLS nenhum activo. Sem estas linhas, a anon key leria os dados de
-- clientes/conversas de TODOS os tenants sem restrição nenhuma.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
    EXECUTE 'ALTER TABLE clients ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    EXECUTE 'ALTER TABLE conversations ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
    EXECUTE 'ALTER TABLE appointments ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
    EXECUTE 'ALTER TABLE services ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faqs') THEN
    EXECUTE 'ALTER TABLE faqs ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Cada uma destas tabelas de negócio recebe a MESMA policy: só a
-- service_role tem acesso. Nenhuma policy para `anon`/`authenticated` =
-- acesso negado por omissão a essas roles (é assim que o RLS funciona:
-- sem uma policy que corresponda à role, a linha nunca é devolvida).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'conversations', 'appointments', 'services', 'faqs'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON %I', t);
      EXECUTE format(
        'CREATE POLICY "service_role_full_access" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Belt-and-suspenders: revoga os grants de tabela do Postgres para
--    anon/authenticated nestas tabelas. RLS já bloqueia as LINHAS, isto
--    bloqueia mesmo o acesso à TABELA — a query falha em vez de
--    simplesmente devolver 0 linhas, o que é mais seguro e mais fácil
--    de detectar caso algo tente aceder por engano.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants', 'plans', 'subscriptions', 'tenant_users', 'whatsapp_sessions',
    'audit_logs', 'bot_auth_state', 'usage_logs', 'automations',
    'clients', 'conversations', 'appointments', 'services', 'faqs'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon', t);
      EXECUTE format('REVOKE ALL ON %I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;

-- NOTA: a única excepção proposital é `plans` — se um dia quiseres
-- mostrar a página de preços/planos directamente do Supabase no site
-- público (sem passar pelo backend), precisas de reabrir leitura
-- pública só a essa tabela. Por agora o painel já serve os planos via
-- `GET /api/plans` no backend, por isso mantemos fechado por omissão.
-- Para reabrir, no futuro:
--   GRANT SELECT ON plans TO anon;
--   CREATE POLICY "public_read_active_plans" ON plans
--     FOR SELECT TO anon USING (is_active = true);
