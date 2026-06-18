-- =============================================
-- MIGRAÇÃO RENDER: Tabela de sessão do bot
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS bot_auth_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bot_auth_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on bot_auth_state"
  ON bot_auth_state FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bot_auth_state_key ON bot_auth_state(key);
