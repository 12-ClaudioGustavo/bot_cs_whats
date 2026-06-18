# 🤖 Bot de Atendimento WhatsApp — TI & Desenvolvimento de Software

Bot completo de atendimento automático para empresa de informática, desenvolvido com Node.js + Baileys + Supabase.

## ✨ Funcionalidades

- 📋 **Menu Principal Interativo** — Navegação por números/opções
- 🛒 **Catálogo de Serviços** — Lista dinâmica do Supabase com detalhes
- 📅 **Agendamento de Reuniões** — Fluxo completo com 5 passos
- ❓ **FAQ Dinâmica** — Perguntas frequentes do banco de dados
- 🛠️ **Suporte Técnico** — Respostas automáticas por categoria de problema
- 👨‍💼 **Atendimento Humano** — Transferência com pausagem do bot
- 💾 **Histórico de Conversas** — Todas as mensagens guardadas no Supabase
- ⏰ **Horário de Funcionamento** — Respostas automáticas fora do horário
- 🔄 **Reconexão Automática** — Resiliente a quedas de conexão

---

## 🚀 Instalação

### 1. Instalar dependências

```bash
cd whats_bot
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o ficheiro `.env` com as suas configurações:

```env
# Supabase (obrigatório para persistência)
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_KEY=sua_chave_service_aqui

# Informações da empresa
COMPANY_NAME=C-Space Technologies
COMPANY_PHONE=+244 974 911 923
COMPANY_EMAIL=c.spacetechnologies2022@gmail.com
```

### 3. Configurar o Supabase

1. Crie um projecto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o ficheiro `supabase_schema.sql`
3. Copie a **URL** e **Service Key** (Project Settings → API)
4. Cole no seu `.env`

### 4. Iniciar o bot

```bash
# Modo normal
npm start

# Modo desenvolvimento (reinicia automaticamente)
npm run dev
```

### 5. Escanear o QR Code

O QR Code aparecerá no terminal. Escaneie com o WhatsApp:
> WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo

---

## 🌳 Estrutura do Projecto

```
whats_bot/
├── src/
│   ├── bot/
│   │   ├── index.js              # Ponto de entrada
│   │   ├── connection.js         # Conexão Baileys
│   │   └── messageHandler.js     # Roteamento de mensagens
│   ├── flows/
│   │   ├── mainMenu.js           # Menu principal
│   │   ├── catalog.js            # Catálogo de serviços
│   │   ├── appointment.js        # Agendamento
│   │   ├── faq.js                # FAQ
│   │   ├── support.js            # Suporte técnico
│   │   └── humanSupport.js       # Transferência humana
│   ├── services/
│   │   ├── supabase.js           # Cliente Supabase
│   │   ├── clientService.js      # Gestão de clientes
│   │   ├── appointmentService.js # Agendamentos
│   │   └── conversationService.js # Histórico
│   ├── utils/
│   │   ├── timeChecker.js        # Horário de funcionamento
│   │   ├── stateManager.js       # Estado por utilizador
│   │   ├── messageFormatter.js   # Formatação e validação
│   │   └── logger.js             # Logs
│   └── config/
│       └── index.js              # Configurações
├── sessions/                     # Sessão WhatsApp (auto-gerado)
├── supabase_schema.sql           # Schema do banco de dados
├── .env                          # Variáveis de ambiente (criar)
├── .env.example                  # Template do .env
└── package.json
```

---

## 🗃️ Banco de Dados (Supabase)

| Tabela | Descrição |
|--------|-----------|
| `clients` | Contactos registados automaticamente |
| `conversations` | Histórico completo de mensagens |
| `appointments` | Agendamentos de serviços |
| `services` | Catálogo de serviços (editável) |
| `faqs` | Perguntas frequentes (editável) |
| `bot_sessions` | Estado das sessões (reservado) |

---

## ⚙️ Configurações

### Horário de Funcionamento

```env
BUSINESS_DAYS_START=1   # 1=Segunda
BUSINESS_DAYS_END=5     # 5=Sexta
BUSINESS_HOUR_START=8   # 08:00
BUSINESS_HOUR_END=18    # 18:00
BUSINESS_TIMEZONE=Africa/Luanda
```

### Atendente Humano

```env
HUMAN_ATTENDANT_PHONE=244900000000  # Número para encaminhar
HUMAN_ATTENDANT_NAME=Equipa de Suporte
```

---

## 💬 Comandos do Bot

| Comando | Acção |
|---------|-------|
| `0` / `menu` / `inicio` | Volta ao menu principal |
| `#bot` | Retoma atendimento automático (saída do modo humano) |
| `listar` | Lista opções no catálogo/FAQ |

---

## 🔒 Sessão WhatsApp

A sessão é guardada automaticamente na pasta `sessions/`. Assim, o bot não pede QR Code em cada reinício.

**Para resetar a sessão (novo número ou logout):**
```bash
rm -rf sessions/
npm start
```

---

## 📊 Adicionar Serviços/FAQs

Edite directamente no Supabase:
- **Serviços**: Tabela `services` — adicione ou edite linhas
- **FAQs**: Tabela `faqs` — adicione ou edite perguntas e respostas

---

## 🌐 Deploy em Produção (Futuro)

### Railway / Render
```bash
# Defina as variáveis de ambiente no painel
# e faça deploy do repositório Git
```

### VPS (Ubuntu)
```bash
npm install -g pm2
pm2 start src/bot/index.js --name whatsapp-bot
pm2 save && pm2 startup
```

---

## 🛟 Suporte

Problemas? Verifique:
1. Node.js >= 18 instalado
2. `.env` configurado correctamente
3. Supabase schema executado
4. Pasta `sessions/` com permissões de escrita

---

*Desenvolvido com ❤️ — Node.js + Baileys + Supabase*
