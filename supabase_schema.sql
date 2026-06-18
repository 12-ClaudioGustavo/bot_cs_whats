-- =============================================
-- SCHEMA SUPABASE - BOT WHATSAPP TI
-- Execute este SQL no editor do Supabase
-- =============================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------
-- TABELA: clients (Clientes/Contactos)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  notes TEXT,
  first_contact_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contact_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_conversations INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------
-- TABELA: conversations (Histórico de Mensagens)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
  flow_context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------
-- TABELA: services (Catálogo de Serviços)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_range TEXT,
  duration_estimate TEXT,
  category TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------
-- TABELA: appointments (Agendamentos)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  client_name TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  scheduled_date DATE,
  scheduled_time TIME,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  attended_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------
-- TABELA: faqs (Perguntas Frequentes)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  keywords TEXT[],
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------
-- TABELA: bot_sessions (Estado do Bot por Utilizador)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  current_flow TEXT DEFAULT 'main_menu',
  current_step TEXT DEFAULT 'initial',
  session_data JSONB DEFAULT '{}',
  is_human_active BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DADOS INICIAIS - CATÁLOGO DE SERVIÇOS
-- =============================================
INSERT INTO services (name, description, price_range, duration_estimate, category, icon, sort_order) VALUES
  ('Desenvolvimento de Software', 'Criação de sistemas personalizados para a sua empresa, desde aplicações de gestão a plataformas web completas.', 'Sob consulta', '1 a 6 meses', 'desenvolvimento', '💻', 1),
  ('Desenvolvimento Web', 'Sites profissionais, landing pages, e-commerce e portais web modernos e responsivos.', 'Kz 150.000 - 800.000', '2 a 8 semanas', 'desenvolvimento', '🌐', 2),
  ('Aplicações Mobile', 'Apps para Android e iOS com design intuitivo e performance optimizada.', 'Kz 300.000 - 1.500.000', '2 a 5 meses', 'desenvolvimento', '📱', 3),
  ('Integração de APIs', 'Ligação entre sistemas, integração com plataformas externas e automação de processos.', 'Kz 80.000 - 400.000', '1 a 4 semanas', 'desenvolvimento', '🔗', 4),
  ('Suporte Técnico', 'Assistência técnica especializada para resolução de problemas de software e sistemas.', 'Kz 15.000/hora', 'Sob demanda', 'suporte', '🛠️', 5),
  ('Consultoria em TI', 'Análise e consultoria estratégica para tomada de decisões tecnológicas na sua empresa.', 'Kz 25.000/hora', 'Sob demanda', 'consultoria', '🎯', 6),
  ('Manutenção de Sistemas', 'Manutenção preventiva e correctiva de sistemas já existentes, garantindo disponibilidade e segurança.', 'Kz 50.000/mês', 'Contínuo', 'suporte', '⚙️', 7),
  ('Treinamento e Capacitação', 'Formação técnica para equipas em tecnologias específicas e boas práticas de desenvolvimento.', 'Kz 30.000/sessão', '1 a 5 dias', 'formacao', '📚', 8)
ON CONFLICT DO NOTHING;

-- =============================================
-- DADOS INICIAIS - FAQ
-- =============================================
INSERT INTO faqs (question, answer, category, keywords, sort_order) VALUES
  (
    'Quais serviços a empresa oferece?',
    'Oferecemos uma gama completa de serviços de TI:\n\n💻 Desenvolvimento de Software personalizado\n🌐 Desenvolvimento Web e E-commerce\n📱 Aplicações Mobile (Android & iOS)\n🔗 Integração de APIs e sistemas\n🛠️ Suporte Técnico especializado\n🎯 Consultoria em TI\n⚙️ Manutenção de Sistemas\n📚 Treinamento e Capacitação\n\nPara mais detalhes, seleccione *2️⃣ Catálogo de Serviços* no menu principal.',
    'geral',
    ARRAY['serviços', 'oferece', 'faz', 'trabalha'],
    1
  ),
  (
    'Como solicitar um orçamento?',
    'Para solicitar um orçamento é simples:\n\n1️⃣ Agende uma reunião através do nosso bot (opção 3)\n2️⃣ Descreva o seu projecto ou necessidade\n3️⃣ A nossa equipa analisa e envia proposta em até *48 horas úteis*\n\nTambém pode contactar-nos directamente:\n📧 Nosso email\n📞 Nosso número\n\nO orçamento é *gratuito e sem compromisso*! 😊',
    'orcamento',
    ARRAY['orçamento', 'preço', 'quanto', 'custa', 'valor'],
    2
  ),
  (
    'Quanto tempo demora o desenvolvimento de um software?',
    'O prazo varia conforme a complexidade do projecto:\n\n⚡ *Projectos simples* (sites, landing pages): 2 a 4 semanas\n🔧 *Projectos médios* (sistemas de gestão): 1 a 3 meses\n🏗️ *Projectos complexos* (plataformas, ERPs): 3 a 6+ meses\n\nApós análise do seu projecto, fornecemos um cronograma detalhado com todas as etapas e entregas.',
    'prazos',
    ARRAY['tempo', 'prazo', 'demora', 'quanto tempo', 'entrega'],
    3
  ),
  (
    'Oferecem suporte após a entrega do projecto?',
    'Sim! Oferecemos diferentes modalidades de suporte pós-entrega:\n\n✅ *Garantia*: 3 meses de correcção de bugs gratuita\n📋 *Suporte Básico*: Assistência por email e WhatsApp\n🔰 *Suporte Premium*: SLA definido, acesso prioritário, manutenção mensal\n🤝 *Contrato de Manutenção*: Actualizações, backups e monitorização contínua\n\nConverse com a nossa equipa para escolher o plano ideal!',
    'suporte',
    ARRAY['suporte', 'depois', 'após', 'entrega', 'garantia', 'manutenção'],
    4
  ),
  (
    'Que tecnologias utilizam?',
    'Trabalhamos com as tecnologias mais modernas e robustas do mercado:\n\n*Frontend:*\n• React.js, Next.js, Vue.js\n• React Native (mobile)\n\n*Backend:*\n• Node.js, Python, PHP\n• APIs REST e GraphQL\n\n*Banco de Dados:*\n• PostgreSQL, MySQL, MongoDB\n• Supabase, Firebase\n\n*Cloud & DevOps:*\n• AWS, DigitalOcean, Vercel\n• Docker, CI/CD\n\nEscolhemos sempre a melhor tecnologia para cada projecto! 🚀',
    'tecnologia',
    ARRAY['tecnologia', 'linguagem', 'framework', 'usa', 'trabalha com', 'stack'],
    5
  ),
  (
    'Como funciona o processo de desenvolvimento?',
    'O nosso processo de desenvolvimento segue estas etapas:\n\n1️⃣ *Reunião de Levantamento* — Entendemos as suas necessidades\n2️⃣ *Proposta e Orçamento* — Enviamos proposta detalhada\n3️⃣ *Contrato e Kick-off* — Assinatura e início do projecto\n4️⃣ *Design e Protótipo* — Aprovação visual antes do código\n5️⃣ *Desenvolvimento* — Sprints com entregas parciais\n6️⃣ *Testes e QA* — Garantimos a qualidade\n7️⃣ *Entrega e Deploy* — Lançamento do sistema\n8️⃣ *Suporte* — Acompanhamento pós-entrega\n\nO cliente é envolvido em todas as etapas! ✅',
    'processo',
    ARRAY['processo', 'como funciona', 'etapas', 'fases', 'metodologia'],
    6
  ),
  (
    'Têm experiência com projectos para Angola?',
    'Sim! Somos uma empresa angolana com experiência no mercado local.\n\n🇦🇴 Entendemos as particularidades do mercado angolano\n💡 Soluções adaptadas à realidade local\n🤝 Clientes em Luanda, Benguela, Huambo e outras províncias\n📱 Integração com sistemas de pagamento locais (Multicaixa, etc.)\n\nTemos orgulho em contribuir para a digitalização de Angola! 🚀',
    'empresa',
    ARRAY['angola', 'local', 'experiência', 'angolana', 'empresa'],
    7
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- ÍNDICES para melhor performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_phone ON bot_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- Por segurança, habilitamos RLS mas permitimos acesso via service key
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para service role (bot usa service key)
CREATE POLICY "Service role full access on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on faqs" ON faqs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on bot_sessions" ON bot_sessions FOR ALL USING (true) WITH CHECK (true);
