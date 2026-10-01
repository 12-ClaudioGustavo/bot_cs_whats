-- =====================================================================
-- MIGRAÇÃO: SISTEMA DE CHECKOUT MANUAL E PAGAMENTOS
-- =====================================================================

-- 1. ATUALIZAR CHECK CONSTRAINT DE STATUS DO TENANT
-- Primeiro removemos a anterior
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
-- Adicionamos a nova incluindo pending_approval
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'cancelled', 'pending_payment', 'pending_approval'));

-- 2. CRIAR TABELA DE PAGAMENTOS (PAYMENTS)
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  transaction_id TEXT NOT NULL,
  receipt_url TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 3. CRIAR BUCKET DE STORAGE PARA COMPROVATIVOS
-- NOTA: O Supabase Storage usa a tabela storage.buckets e storage.objects.
-- Como esta migração corre no public, inserimos diretamente no storage se tivermos permissão,
-- mas é mais seguro fazer isto via dashboard ou código.
-- Tentaremos criar se possível:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de segurança para o bucket (RLS)
-- Permitir que utilizadores autenticados façam upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
-- Permitir que qualquer pessoa leia (pois vamos mostrar ao admin via URL pública)
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');

-- 4. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
