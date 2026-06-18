require('dotenv').config();

const config = {
  // Informações da Empresa
  company: {
    name: process.env.COMPANY_NAME || 'TechSoft Solutions',
    phone: process.env.COMPANY_PHONE || '+244 900 000 000',
    email: process.env.COMPANY_EMAIL || 'contato@techsoft.co.ao',
    website: process.env.COMPANY_WEBSITE || 'https://www.techsoft.co.ao',
    address: process.env.COMPANY_ADDRESS || 'Luanda, Angola',
  },

  // Horário de Funcionamento
  businessHours: {
    daysStart: parseInt(process.env.BUSINESS_DAYS_START) || 1, // Segunda
    daysEnd: parseInt(process.env.BUSINESS_DAYS_END) || 5,     // Sexta
    hourStart: parseInt(process.env.BUSINESS_HOUR_START) || 8,
    hourEnd: parseInt(process.env.BUSINESS_HOUR_END) || 18,
    timezone: process.env.BUSINESS_TIMEZONE || 'Africa/Luanda',
  },

  // Atendente Humano
  human: {
    phone: process.env.HUMAN_ATTENDANT_PHONE || '244900000000',
    name: process.env.HUMAN_ATTENDANT_NAME || 'Equipa de Suporte',
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  // Bot
  bot: {
    inactivityTimeout: parseInt(process.env.INACTIVITY_TIMEOUT_MINUTES) || 30, // minutos
    sessionPath: './sessions',
    logLevel: process.env.LOG_LEVEL || 'info',
    port: parseInt(process.env.PORT) || 3000,
  },
};

module.exports = config;
