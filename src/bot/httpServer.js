const express = require('express');
const QRCode  = require('qrcode');
const path    = require('path');
const config  = require('../config');
const logger  = require('../utils/logger');
const authService = require('../services/authService');
const botManager = require('./botManager');
const multer  = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ─── Clientes SSE conectados, agrupados por tenant ────────
// Map<tenantId, Set<res>> — cada tenant só recebe eventos das SUAS sessões.
const sseClientsByTenant = new Map();

function addSseClient(tenantId, res) {
  if (!sseClientsByTenant.has(tenantId)) sseClientsByTenant.set(tenantId, new Set());
  sseClientsByTenant.get(tenantId).add(res);
}

function removeSseClient(tenantId, res) {
  sseClientsByTenant.get(tenantId)?.delete(res);
}

function broadcastToTenant(tenantId, payload) {
  const clients = sseClientsByTenant.get(tenantId);
  if (!clients || clients.size === 0) return;
  const msg = `event: update\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch (_) { clients.delete(res); }
  }
}

// Liga-se aos eventos do motor multi-bot e reencaminha só para os
// clientes SSE do tenant dono da sessão que mudou de estado.
botManager.onSessionEvent((tenantId, sessionName, payload) => {
  broadcastToTenant(tenantId, { ...payload, sessionName });
});

// ─── Middleware de Autenticação JWT ──────────────────────────
function requireAuth(req, res, next) {
  // Procura token no Header Authorization, Cookie ou Query String
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const idx = c.indexOf('=');
        if (idx === -1) return [c.trim(), ''];
        return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
      })
    );
    token = cookies.cspace_session || cookies.token;
  } else if (req.query.token) {
    token = req.query.token;
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Sessão inválida ou expirada. Efetue login novamente.',
    });
  }

  req.user = payload;
  next();
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Acesso negado. Apenas o Super Admin C-Space pode aceder a esta área.',
      });
    }
    next();
  });
}

// ─── Middleware: Subscrição Ativa ──────────────────────────
// Garante que o tenant tem status 'active' antes de aceder
// a rotas funcionais (WhatsApp, Conversas, Contatos, etc.).
// Deve ser composto APÓS requireAuth (req.user já disponível).
async function requireActiveSubscription(req, res, next) {
  try {
    // Super admins e admins C-Space não têm restrição de subscrição
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }

    const { getSupabase } = require('../services/supabase');
    const db = getSupabase();

    if (!db) {
      // Se a BD não está disponível, deixa passar (fail-open)
      return next();
    }

    const { data: tenant } = await db
      .from('tenants')
      .select('status, subscriptions(current_period_end)')
      .eq('id', req.user.tenantId)
      .maybeSingle();

    let status = tenant?.status || 'active';
    let currentPeriodEnd = null;

    if (tenant?.subscriptions && Array.isArray(tenant.subscriptions)) {
      currentPeriodEnd = tenant.subscriptions[0]?.current_period_end;
    } else if (tenant?.subscriptions) {
      currentPeriodEnd = tenant.subscriptions.current_period_end;
    }

    // Se o plano tiver expirado, atualizar para pendente
    if (status === 'active' && currentPeriodEnd && new Date(currentPeriodEnd) < new Date()) {
      status = 'pending_payment';
      // Tentativa "fire-and-forget" de atualizar no DB, se falhar não importa
      db.from('tenants').update({ status: 'pending_payment' }).eq('id', req.user.tenantId).then();
      db.from('subscriptions').update({ status: 'past_due' }).eq('tenant_id', req.user.tenantId).then();
    }

    if (status === 'pending_payment') {
      return res.status(403).json({
        error: 'A sua conta ainda não foi ativada. Escolha um plano para liberar todas as funcionalidades.',
        code: 'SUBSCRIPTION_PENDING',
        redirectTo: '/dashboard/billing',
      });
    }
    
    if (status === 'pending_approval') {
      return res.status(403).json({
        error: 'O seu pagamento está a ser analisado. Por favor, aguarde.',
        code: 'SUBSCRIPTION_PENDING_APPROVAL',
        redirectTo: '/dashboard/billing',
      });
    }

    if (status === 'suspended') {
      return res.status(403).json({
        error: 'A sua conta foi suspensa. Contacte o suporte ou regularize o seu pagamento.',
        code: 'SUBSCRIPTION_SUSPENDED',
        redirectTo: '/dashboard/billing',
      });
    }

    if (status === 'cancelled') {
      return res.status(403).json({
        error: 'A sua conta foi cancelada.',
        code: 'SUBSCRIPTION_CANCELLED',
        redirectTo: '/dashboard/billing',
      });
    }

    next();
  } catch (err) {
    // Em caso de erro inesperado, não bloqueamos o utilizador
    next();
  }
}

// ─── Servidor HTTP ────────────────────────────────────────
async function startHttpServer() {
  const port = config.bot.port || process.env.PORT || 3001;
  const app  = express();

  // ─── CORS seguro com whitelist ─────────────────────────────
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : []),
  ];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // ─── Headers de Segurança HTTP (Helmet manual) ─────────────
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());
  app.use(express.static('public'));

  // ── Health Check ──────────────────────────────────────
  app.get('/health', async (req, res) => {
    const { getSupabase } = require('../services/supabase');
    const db = getSupabase();
    let dbStatus = 'disconnected';
    if (db) {
      try {
        const { error } = await db.from('tenants').select('id', { head: true, count: 'exact' });
        if (!error) dbStatus = 'connected';
      } catch (_) {}
    }

    const liveSessions = botManager.listLiveSessions();

    res.status(200).json({
      dbStatus,
      company: config.company.name,
      liveSessions: liveSessions.length,
      connectedSessions: liveSessions.filter(s => s.status === 'connected').length,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  });

  // ── SSE — stream de estado em tempo real, ESCOPADO AO TENANT ──
  // Autenticado por token na query string, porque EventSource não permite
  // cabeçalhos custom. Cada tenant só recebe eventos das suas próprias
  // sessões WhatsApp — nunca vê o QR/status de outro tenant.
  app.get('/events', requireAuth, requireActiveSubscription, async (req, res) => {
    const tenantId = req.user.tenantId;

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    addSseClient(tenantId, res);

    // Estado inicial: envia o estado actual de todas as sessões vivas deste tenant
    const sessionName = req.query.sessionName || 'default';
    const initState = botManager.getSessionState(tenantId, sessionName);
    res.write(`event: update\ndata: ${JSON.stringify({ ...initState, sessionName })}\n\n`);

    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSseClient(tenantId, res);
    });
  });

  // ── API: Autenticação & Registro (PÚBLICAS) ─────────────────
  app.post('/api/auth/login', async (req, res) => {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const result = await authService.loginUser({ ...req.body, ip: clientIp });
      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const tenantService = require('../services/tenantService');
      const { companyName, email, password, fullName, phone } = req.body;
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Cria Tenant com status 'pending_payment' (sem escolha de plano no registo)
      const tenant = await tenantService.createTenant({
        name: companyName,
        slug,
        email,
        phone,
      });

      if (!tenant) return res.status(400).json({ error: 'Erro ao criar workspace.' });

      const user = await authService.registerUser({
        tenantId: tenant.id,
        email,
        password,
        fullName: fullName || 'Proprietário',
        role: 'owner',
      });

      const token = authService.generateToken({
        userId: user?.id,
        tenantId: tenant.id,
        email,
        role: 'owner',
      });

      res.json({ success: true, token, tenant, user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Sessão do Utilizador (PROTEGIDA) ──────────────────
  app.get('/api/auth/me', requireAuth, async (req, res) => {
    res.json({ success: true, user: req.user });
  });

  // ── API: Métricas do Dashboard (PROTEGIDA E OTIMIZADA) ──────────────────
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const tenantService = require('../services/tenantService');
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();

      const tenantId = req.user.tenantId || tenantService.DEFAULT_TENANT_ID;

      let totalClients = 0;
      let totalConversations = 0;
      let totalAppointments = 0;
      let tenantStatus = 'active';
      let activePlanId = null;
      let activePlanCode = null;
      let activePlanPrice = 0;

      if (db) {
        // Executa todas as consultas ao Supabase em PARALELO para resposta ultrarrápida
        const [tenantRes, subRes, cCountRes, convCountRes, aCountRes, usage] = await Promise.all([
          db.from('tenants').select('status').eq('id', tenantId).maybeSingle(),
          db.from('subscriptions').select('plan_id, status, plans(id, code, price_kz)').eq('tenant_id', tenantId).maybeSingle(),
          db.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          db.from('conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          db.from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          tenantService.getUsageStatus(tenantId),
        ]);

        if (tenantRes.data) tenantStatus = tenantRes.data.status;

        const subData = subRes.data;
        if (subData) {
          activePlanId = subData.plans?.id || subData.plan_id;
          if (subData.plans) {
            activePlanCode = subData.plans.code;
            activePlanPrice = subData.plans.price_kz || 0;
          } else if (subData.plan_id) {
            const { data: pData } = await db.from('plans').select('id, code, price_kz').eq('id', subData.plan_id).maybeSingle();
            if (pData) {
              activePlanId = pData.id;
              activePlanCode = pData.code;
              activePlanPrice = pData.price_kz || 0;
            }
          }
        }

        totalClients = cCountRes.count || 0;
        totalConversations = convCountRes.count || 0;
        totalAppointments = aCountRes.count || 0;

        const sessionState = botManager.getSessionState(tenantId, 'default');

        return res.json({
          status: sessionState.status,
          tenantStatus,
          totalClients,
          totalConversations,
          totalAppointments,
          messagesUsed: usage.messagesUsed,
          messagesLimit: usage.messagesLimit,
          usagePercent: usage.percentUsed,
          limitReached: usage.limitReached,
          nearLimit: usage.nearLimit,
          planName: usage.planName,
          activePlanId,
          activePlanCode,
          activePlanPrice,
        });
      }

      res.json({
        status: 'disconnected',
        tenantStatus: 'active',
        totalClients: 0,
        totalConversations: 0,
        totalAppointments: 0,
        messagesUsed: 0,
        messagesLimit: 100,
        usagePercent: 0,
        limitReached: false,
        nearLimit: false,
        planName: 'Business',
        activePlanId: null,
        activePlanCode: null,
        activePlanPrice: 0,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Ativação / Pagamento de Plano (PROTEGIDA) ───────────
  app.post('/api/billing/activate-plan', requireAuth, async (req, res) => {
    try {
      const tenantService = require('../services/tenantService');
      const { planCode } = req.body;
      const success = await tenantService.activateTenantPlan(req.user.tenantId, planCode || 'business');
      if (!success) return res.status(400).json({ error: 'Erro ao ativar plano.' });
      res.json({ success: true, message: 'Plano ativado com sucesso!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Conversas (PROTEGIDA) ──────────────────────────────
  app.get('/api/conversations', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.json([]);

      const { data, error } = await db
        .from('conversations')
        .select('*, clients(name, phone, company)')
        .eq('tenant_id', req.user.tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/conversations/:phone', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { getConversationHistory } = require('../services/conversationService');
      const { phone } = req.params;
      const history = await getConversationHistory(req.user.tenantId, phone, 200);
      // Retorna em ordem cronológica (mais antiga para mais recente) para exibir como chat
      res.json(history.reverse());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Clientes (PROTEGIDA) ───────────────────────────────
  app.get('/api/clients', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.json([]);

      const { data, error } = await db
        .from('clients')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .order('last_contact_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Serviços (PROTEGIDA) ───────────────────────────────
  app.get('/api/services', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.json([]);

      const { data, error } = await db
        .from('services')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Agendamentos (PROTEGIDA) ───────────────────────────
  app.get('/api/appointments', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.json([]);

      const { data, error } = await db
        .from('appointments')
        .select('*')
        .eq('tenant_id', req.user.tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Tenants & Métricas Globais (SUPER ADMIN APENAS) ───
  app.get('/api/admin/stats', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      let totalTenants = 0;
      let activeTenants = 0;
      let totalUsers = 0;
      let totalConversations = 0;
      let totalClients = 0;
      let estimatedMRR = 0;

      if (db) {
        // Contagem de tenants clientes (excluindo a empresa master cspace-master)
        const { count: tCount } = await db
          .from('tenants')
          .select('*', { count: 'exact', head: true })
          .neq('slug', 'cspace-master');

        const { count: aCount } = await db
          .from('tenants')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .neq('slug', 'cspace-master');

        // Contagem de utilizadores de empresas (excluindo o super_admin global)
        const { count: uCount } = await db
          .from('tenant_users')
          .select('*', { count: 'exact', head: true })
          .neq('role', 'super_admin');

        const { count: convCount } = await db
          .from('conversations')
          .select('*', { count: 'exact', head: true });

        const { count: cCount } = await db
          .from('clients')
          .select('*', { count: 'exact', head: true });

        totalTenants = tCount || 0;
        activeTenants = aCount || 0;
        totalUsers = uCount || 0;
        totalConversations = convCount || 0;
        totalClients = cCount || 0;

        // MRR Real: Soma o valor exato dos planos ativos na tabela `subscriptions`
        const { data: activeSubs } = await db
          .from('subscriptions')
          .select('plans(price_kz), tenants!inner(slug, status)')
          .eq('status', 'active')
          .eq('tenants.status', 'active')
          .neq('tenants.slug', 'cspace-master');

        if (activeSubs && activeSubs.length > 0) {
          estimatedMRR = activeSubs.reduce((sum, sub) => {
            const price = parseFloat(sub.plans?.price_kz) || 0;
            return sum + price;
          }, 0);
        }
      }

      const liveSessions = botManager.listLiveSessions();

      res.json({
        totalTenants,
        activeTenants,
        totalUsers,
        totalConversations,
        totalClients,
        estimatedMRR,
        connectedBots: liveSessions.filter(s => s.status === 'connected').length,
        systemUptime: process.uptime(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tenants', requireSuperAdmin, async (req, res) => {
    try {
      const tenantService = require('../services/tenantService');
      const tenants = await tenantService.getAllTenants();
      res.json(tenants);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tenants', requireSuperAdmin, async (req, res) => {
    try {
      const tenantService = require('../services/tenantService');
      const newTenant = await tenantService.createTenant(req.body);
      if (!newTenant) return res.status(400).json({ error: 'Erro ao criar tenant' });
      res.json(newTenant);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/tenants/:id/status', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      const { id } = req.params;
      const { status } = req.body;

      if (!db) return res.status(400).json({ error: 'Base de dados indisponível.' });

      const { data, error } = await db
        .from('tenants')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/users — Lista todos os utilizadores do sistema (Super Admin)
  app.get('/api/admin/users', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(503).json({ error: 'Base de dados indisponível.' });

      const { data, error } = await db
        .from('tenant_users')
        .select(`
          id,
          email,
          full_name,
          role,
          phone,
          avatar_url,
          is_active,
          created_at,
          tenant_id,
          tenants (
            id,
            name,
            slug,
            type,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/users/:id/status — Ativar / desativar utilizador
  app.patch('/api/admin/users/:id/status', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      const { id } = req.params;
      const { isActive } = req.body;

      if (!db) return res.status(400).json({ error: 'Base de dados indisponível.' });

      const { data, error } = await db
        .from('tenant_users')
        .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/api/plans', async (req, res) => {
    try {
      const planService = require('../services/planService');
      const plans = await planService.getPublicPlans();
      res.json(plans);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Checkout Manual e Aprovação de Pagamentos ───
  app.post('/api/checkout', requireAuth, upload.single('receipt'), async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(400).json({ error: 'Base de dados indisponível.' });

      const { planId, transactionId } = req.body;
      if (!planId || !transactionId || !req.file) {
        return res.status(400).json({ error: 'Faltam dados obrigatórios ou o comprovativo.' });
      }

      const tenantId = req.user.tenantId;

      // Obter detalhes do plano para saber o valor (suporta UUID ou código)
      const { data: plan, error: planError } = await db
        .from('plans')
        .select('*')
        .or(`id.eq.${planId},code.eq.${planId}`)
        .maybeSingle();
        
      if (planError || !plan) {
        return res.status(404).json({ error: 'Plano não encontrado.' });
      }

      // Fazer upload do ficheiro para Supabase Storage
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${tenantId}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await db.storage
        .from('receipts')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({ error: 'Erro ao fazer upload do comprovativo.', details: uploadError });
      }

      // URL público do ficheiro
      const { data: publicUrlData } = db.storage.from('receipts').getPublicUrl(fileName);
      const receiptUrl = publicUrlData.publicUrl;

      // Inserir na tabela payments
      const { error: paymentError } = await db.from('payments').insert([{
        tenant_id: tenantId,
        plan_id: planId,
        transaction_id: transactionId,
        receipt_url: receiptUrl,
        amount: plan.price_kz,
        status: 'pending'
      }]);

      if (paymentError) throw paymentError;

      // Atualizar status do tenant para pending_approval
      await db.from('tenants').update({ status: 'pending_approval' }).eq('id', tenantId);

      res.status(200).json({ success: true, message: 'Checkout submetido com sucesso.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/payments', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(400).json({ error: 'Base de dados indisponível.' });

      const { data, error } = await db
        .from('payments')
        .select(`
          *,
          tenants(name, email),
          plans(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/payments/:id/approve', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(400).json({ error: 'Base de dados indisponível.' });

      const { id } = req.params;

      // Obter o pagamento
      const { data: payment, error: fetchError } = await db
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError || !payment) throw fetchError || new Error('Pagamento não encontrado');

      // Atualizar pagamento para approved
      await db.from('payments')
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', id);

      // Calcular o fim do período (30 dias exatos a partir de agora)
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Atualizar ou criar subscrição
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', payment.tenant_id)
        .maybeSingle();

      if (existingSub) {
        await db.from('subscriptions')
          .update({
            plan_id: payment.plan_id,
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('tenant_id', payment.tenant_id);
      } else {
        await db.from('subscriptions').insert([{
          tenant_id: payment.tenant_id,
          plan_id: payment.plan_id,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString()
        }]);
      }

      // Atualizar tenant para active
      await db.from('tenants').update({ status: 'active' }).eq('id', payment.tenant_id);

      res.json({ success: true, message: 'Pagamento aprovado. Plano ativado por 30 dias.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/payments/:id/reject', requireSuperAdmin, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(400).json({ error: 'Base de dados indisponível.' });

      const { id } = req.params;

      const { data: payment } = await db.from('payments').select('*').eq('id', id).single();
      if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado' });

      // Atualizar pagamento para rejected
      await db.from('payments')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', id);

      // Volta a colocar tenant em pending_payment
      await db.from('tenants').update({ status: 'pending_payment' }).eq('id', payment.tenant_id);

      res.json({ success: true, message: 'Pagamento rejeitado.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Gestão de Planos & Subscrições (SUPER ADMIN APENAS) ───
  app.get('/api/admin/plans', requireSuperAdmin, async (req, res) => {
    try {
      const planService = require('../services/planService');
      const plans = await planService.getAllPlans();
      res.json(plans);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/plans', requireSuperAdmin, async (req, res) => {
    try {
      const planService = require('../services/planService');
      const plan = await planService.createPlan(req.body);
      res.status(201).json(plan);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/plans/:id', requireSuperAdmin, async (req, res) => {
    try {
      const planService = require('../services/planService');
      const plan = await planService.updatePlan(req.params.id, req.body);
      res.json(plan);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/plans/:id', requireSuperAdmin, async (req, res) => {
    try {
      const planService = require('../services/planService');
      await planService.deletePlan(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/admin/subscriptions', requireSuperAdmin, async (req, res) => {
    try {
      const planService = require('../services/planService');
      const subs = await planService.getAllSubscriptions();
      res.json(subs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/subscriptions/assign', requireSuperAdmin, async (req, res) => {
    try {
      const { tenantId, planCode } = req.body;
      if (!tenantId || !planCode) {
        return res.status(400).json({ error: 'tenantId e planCode são obrigatórios.' });
      }
      const planService = require('../services/planService');
      const sub = await planService.updateTenantSubscription(tenantId, planCode);
      res.json(sub);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── API: Gestão de Instâncias de WhatsApp (BANCO DE DADOS SUPABASE) ───
  app.get('/api/admin/whatsapp-sessions', requireSuperAdmin, async (req, res) => {
    try {
      const whatsappSessionService = require('../services/whatsappSessionService');
      const sessions = await whatsappSessionService.getAllSessions();
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lista as sessões do tenant autenticado, com o estado AO VIVO
  // (o registo na BD pode estar "connected" de um deploy anterior mas o
  // socket já não existir em memória — cruzamos os dois para o painel
  // nunca mostrar um estado mentiroso).
  app.get('/api/whatsapp/sessions', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const whatsappSessionService = require('../services/whatsappSessionService');
      const tenantId = req.user.tenantId || (await whatsappSessionService.getDefaultTenantId());
      const sessions = await whatsappSessionService.getTenantSessions(tenantId);

      const enriched = sessions.map(s => {
        const live = botManager.getSessionState(tenantId, s.session_name);
        return { ...s, status: live.status !== 'disconnected' ? live.status : s.status };
      });

      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cria/liga uma NOVA sessão WhatsApp (novo bot) para o tenant autenticado.
  // Respeita o limite `max_whatsapp_accounts` do plano contratado.
  app.post('/api/whatsapp/sessions', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const whatsappSessionService = require('../services/whatsappSessionService');
      const planService = require('../services/planService');
      const tenantId = req.user.tenantId || (await whatsappSessionService.getDefaultTenantId());
      const sessionName = (req.body.sessionName || 'default').trim();

      const limitCheck = await planService.canCreateSession(tenantId);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          error: `Limite de contas WhatsApp do seu plano (${limitCheck.planName}) atingido: ${limitCheck.current}/${limitCheck.limit}. Faça upgrade do plano para adicionar mais números.`,
          ...limitCheck,
        });
      }

      await botManager.startSession(tenantId, sessionName);
      res.status(201).json({ success: true, sessionName, message: 'Sessão a iniciar — aguarde o QR Code em /events.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Desliga e apaga por completo uma sessão (logout real do WhatsApp,
  // não só marcar como desconectada na BD — evita sockets "fantasma" presos
  // em memória a continuar a receber mensagens depois do utilizador
  // desconectar pelo painel).
  app.post('/api/whatsapp/sessions/disconnect', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const whatsappSessionService = require('../services/whatsappSessionService');
      const tenantId = req.user.tenantId || (await whatsappSessionService.getDefaultTenantId());
      const sessionName = req.body.sessionName || 'default';
      await botManager.stopSession(tenantId, sessionName);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Alternativa REST (DELETE) para a mesma acção acima.
  app.delete('/api/whatsapp/sessions/:sessionName', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const whatsappSessionService = require('../services/whatsappSessionService');
      const tenantId = req.user.tenantId || (await whatsappSessionService.getDefaultTenantId());
      await botManager.stopSession(tenantId, req.params.sessionName);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Automação & Treino do Bot ────────────────────────────
  app.get('/api/bot/config', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const botConfigService = require('../services/botConfigService');
      const tenantId = req.user.tenantId;
      const configData = await botConfigService.getBotConfig(tenantId);
      res.json(configData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/bot/config', requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const botConfigService = require('../services/botConfigService');
      const tenantId = req.user.tenantId;
      await botConfigService.saveBotConfig(tenantId, req.body);
      res.json({ success: true, message: 'Configuração do bot guardada com sucesso.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/audit', requireSuperAdmin, async (req, res) => {
    try {
      const auditService = require('../services/auditService');
      const category = req.query.category || 'all';
      const limit = parseInt(req.query.limit) || 100;
      const logs = await auditService.getAuditLogs({ category, limit });
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Perfil do Utilizador (PROTEGIDA) ───────────────────
  // GET /api/profile — devolve dados do utilizador + dados do tenant
  app.get('/api/profile', requireAuth, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(503).json({ error: 'Base de dados indisponível.' });

      const { data: user, error: uErr } = await db
        .from('tenant_users')
        .select('id, tenant_id, email, full_name, role, phone, avatar_url, bio, position, theme_preference, language, is_active, created_at')
        .eq('id', req.user.userId)
        .single();

      if (uErr || !user) return res.status(404).json({ error: 'Utilizador não encontrado.' });

      const { data: tenant, error: tErr } = await db
        .from('tenants')
        .select('id, name, slug, logo_url, email, phone, status, type, nif, sector, address, city, website, contact_phone, contact_email, created_at')
        .eq('id', req.user.tenantId)
        .single();

      const { data: subscription } = await db
        .from('subscriptions')
        .select('status, current_period_end, plans(code, name, price_kz, max_whatsapp_accounts, monthly_message_limit, max_users)')
        .eq('tenant_id', req.user.tenantId)
        .single();

      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          position: user.position,
          themePreference: user.theme_preference || 'light',
          language: user.language || 'pt-PT',
          createdAt: user.created_at,
        },
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logo_url,
          email: tenant.email,
          phone: tenant.phone,
          status: tenant.status,
          type: tenant.type || 'company',
          nif: tenant.nif,
          sector: tenant.sector,
          address: tenant.address,
          city: tenant.city,
          website: tenant.website,
          contactPhone: tenant.contact_phone,
          contactEmail: tenant.contact_email,
          createdAt: tenant.created_at,
        } : null,
        subscription: subscription ? {
          status: subscription.status,
          periodEnd: subscription.current_period_end,
          plan: subscription.plans,
        } : null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/profile — atualiza dados pessoais e/ou dados da empresa/tenant
  app.put('/api/profile', requireAuth, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const { logAuditEvent } = require('../services/auditService');
      const db = getSupabase();
      if (!db) return res.status(503).json({ error: 'Base de dados indisponível.' });

      // Verificação estrita: E-mail não pode ser alterado
      if (req.body.email !== undefined && req.body.email.trim().toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(400).json({ error: 'O e-mail é a sua chave de acesso à conta e não pode ser alterado.' });
      }

      const { fullName, phone, bio, position, themePreference, language,
              tenantName, tenantNif, tenantSector, tenantAddress, tenantCity,
              tenantWebsite, tenantContactPhone, tenantContactEmail, tenantType } = req.body;

      // Atualizar dados do utilizador
      const userUpdate = {};
      if (fullName !== undefined) userUpdate.full_name = fullName.trim();
      if (phone !== undefined) userUpdate.phone = phone;
      if (bio !== undefined) userUpdate.bio = bio;
      if (position !== undefined) userUpdate.position = position;
      if (themePreference !== undefined && ['light', 'dark', 'system'].includes(themePreference)) {
        userUpdate.theme_preference = themePreference;
      }
      if (language !== undefined) userUpdate.language = language;

      if (Object.keys(userUpdate).length > 0) {
        userUpdate.updated_at = new Date().toISOString();
        const { error: uErr } = await db
          .from('tenant_users')
          .update(userUpdate)
          .eq('id', req.user.userId);
        if (uErr) throw uErr;
      }

      // Atualizar dados do tenant — apenas se owner ou admin
      const canEditTenant = ['owner', 'admin', 'super_admin'].includes(req.user.role);
      if (canEditTenant) {
        const tenantUpdate = {};
        if (tenantName !== undefined) tenantUpdate.name = tenantName.trim();
        if (tenantNif !== undefined) tenantUpdate.nif = tenantNif;
        if (tenantSector !== undefined) tenantUpdate.sector = tenantSector;
        if (tenantAddress !== undefined) tenantUpdate.address = tenantAddress;
        if (tenantCity !== undefined) tenantUpdate.city = tenantCity;
        if (tenantWebsite !== undefined) tenantUpdate.website = tenantWebsite;
        if (tenantContactPhone !== undefined) tenantUpdate.contact_phone = tenantContactPhone;
        if (tenantContactEmail !== undefined) tenantUpdate.contact_email = tenantContactEmail;
        if (tenantType !== undefined && ['company', 'personal'].includes(tenantType)) {
          tenantUpdate.type = tenantType;
        }

        if (Object.keys(tenantUpdate).length > 0) {
          tenantUpdate.updated_at = new Date().toISOString();
          const { error: tErr } = await db
            .from('tenants')
            .update(tenantUpdate)
            .eq('id', req.user.tenantId);
          if (tErr) throw tErr;
        }
      }

      await logAuditEvent({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        userEmail: req.user.email,
        action: 'user.profile_updated',
        category: 'system',
        details: { updatedFields: Object.keys(req.body) },
      });

      res.json({ success: true, message: 'Perfil atualizado com sucesso.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/profile/password — altera a palavra-passe com validação da atual
  app.put('/api/profile/password', requireAuth, async (req, res) => {
    try {
      const { getSupabase } = require('../services/supabase');
      const { logAuditEvent } = require('../services/auditService');
      const db = getSupabase();
      if (!db) return res.status(503).json({ error: 'Base de dados indisponível.' });

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Palavra-passe atual e nova são obrigatórias.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 8 caracteres.' });
      }

      const { data: user } = await db
        .from('tenant_users')
        .select('id, password_hash')
        .eq('id', req.user.userId)
        .single();

      if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });

      const { verifyPassword, hashPassword } = authService;
      if (!verifyPassword(currentPassword, user.password_hash)) {
        await logAuditEvent({
          tenantId: req.user.tenantId,
          userId: req.user.userId,
          userEmail: req.user.email,
          action: 'security.password_change_failed',
          category: 'security',
          details: { reason: 'Palavra-passe atual incorreta' },
        });
        return res.status(400).json({ error: 'Palavra-passe atual incorreta.' });
      }

      const newHash = hashPassword(newPassword);
      await db
        .from('tenant_users')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', req.user.userId);

      await logAuditEvent({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        userEmail: req.user.email,
        action: 'security.password_changed',
        category: 'security',
        details: { success: true },
      });

      res.json({ success: true, message: 'Palavra-passe alterada com sucesso.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Perfil do Administrador (SUPER ADMIN / ADMIN APENAS) ──
  // GET /api/admin/profile — dados do admin + métricas de uso pessoal + logs recentes
  app.get('/api/admin/profile', requireAuth, async (req, res) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const { getSupabase } = require('../services/supabase');
      const db = getSupabase();
      if (!db) return res.status(503).json({ error: 'Base de dados indisponível.' });

      const { data: user } = await db
        .from('tenant_users')
        .select('id, email, full_name, role, phone, avatar_url, bio, position, created_at, updated_at')
        .eq('id', req.user.userId)
        .single();

      // Logs de auditoria recentes do próprio admin
      const { data: recentLogs } = await db
        .from('audit_logs')
        .select('action, category, created_at, details, ip_address')
        .eq('user_id', req.user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Métricas do sistema (para super_admin)
      let systemMetrics = null;
      if (req.user.role === 'super_admin') {
        const { count: totalTenants } = await db
          .from('tenants').select('*', { count: 'exact', head: true }).neq('slug', 'cspace-master');
        const { count: totalUsers } = await db
          .from('tenant_users').select('*', { count: 'exact', head: true }).neq('role', 'super_admin');
        const { count: activeSessions } = await db
          .from('whatsapp_sessions').select('*', { count: 'exact', head: true }).eq('status', 'connected');
        systemMetrics = { totalTenants: totalTenants || 0, totalUsers: totalUsers || 0, activeSessions: activeSessions || 0 };
      }

      res.json({
        user: user ? {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          position: user.position,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        } : null,
        recentActivity: recentLogs || [],
        systemMetrics,
        systemUptime: process.uptime(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/admin/profile — atualiza dados do administrador
  app.put('/api/admin/profile', requireAuth, async (req, res) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const { getSupabase } = require('../services/supabase');
      const { logAuditEvent } = require('../services/auditService');
      const db = getSupabase();
      if (!db) return res.status(503).json({ error: 'Base de dados indisponível.' });

      // Verificação estrita: E-mail não pode ser alterado
      if (req.body.email !== undefined && req.body.email.trim().toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(400).json({ error: 'O e-mail é a sua chave de acesso à conta e não pode ser alterado.' });
      }

      const { fullName, phone, bio } = req.body;
      const updateData = {};
      if (fullName !== undefined) updateData.full_name = fullName.trim();
      if (phone !== undefined) updateData.phone = phone;
      if (bio !== undefined) updateData.bio = bio;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
      }

      updateData.updated_at = new Date().toISOString();
      const { error } = await db
        .from('tenant_users')
        .update(updateData)
        .eq('id', req.user.userId);

      if (error) throw error;

      await logAuditEvent({
        userId: req.user.userId,
        userEmail: req.user.email,
        action: 'admin.profile_updated',
        category: 'system',
        details: { updatedFields: Object.keys(updateData) },
      });

      res.json({ success: true, message: 'Perfil de administrador atualizado.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Rota Raiz da API Gateway ────────────────────────────────
  app.get('/', (req, res) => {
    const live = botManager.listLiveSessions();
    res.json({
      service: 'C-Space WhatsApp Gateway API',
      connectedBots: live.filter(s => s.status === 'connected').length,
      liveSessions: live.length,
      webApp: 'Aceda à plataforma web em http://localhost:3000',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Página do QR (legada/pública) ───────────────────────────
  // NOTA: esta página estática mostrava o QR de uma única sessão global.
  // Com o motor multi-bot, o QR de cada tenant só é exposto de forma
  // autenticada via /events?sessionName=... — usa o painel (Dashboard →
  // WhatsApp) para ligar um número. Mantida apenas por compatibilidade.
  app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/qr.html'));
  });

  // ── Inicia o servidor ──────────────────────────────────────
  app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 Gateway API iniciada na porta ${port}`);
    logger.info(`📱 Aceda ao frontend em: http://localhost:3000`);
    logger.info(`🔌 API disponível em: http://localhost:${port}`);
  });

  return app;
}

module.exports = { startHttpServer, requireAuth, requireSuperAdmin, requireActiveSubscription };
