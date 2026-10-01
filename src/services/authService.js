const { getSupabase } = require('./supabase');
const crypto = require('crypto');
const logger = require('../utils/logger');

// JWT_SECRET é OBRIGATÓRIO — o servidor recusa arrancar sem ele
if (!process.env.JWT_SECRET) {
  logger.error('❌ JWT_SECRET não definido no .env! Defina uma chave secreta forte antes de iniciar o servidor.');
  logger.error('❌ Exemplo: JWT_SECRET=use_um_valor_gerado_com_openssl_rand_-base64_32');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Rate limiting simples em memória (por IP)
const loginAttempts = new Map(); // { ip: { count, resetAt } }
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Verifica e regista tentativas de login por IP
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry) {
    if (now < entry.resetAt) {
      if (entry.count >= RATE_LIMIT_MAX) {
        const waitSec = Math.ceil((entry.resetAt - now) / 1000);
        return { blocked: true, waitSeconds: waitSec };
      }
      entry.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  return { blocked: false };
}

/**
 * Limpa contagem de tentativas após login bem-sucedido
 */
function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

/**
 * Gera um token JWT assinado com HMAC-SHA256
 */
function generateToken(payload, expiresInDays = 7) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (86400 * expiresInDays),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Valida e decodifica um token JWT
 * Aceita via: Authorization: Bearer <token> OU cookie de sessão
 */
function verifyToken(tokenOrHeader) {
  if (!tokenOrHeader) return null;
  try {
    const token = tokenOrHeader.startsWith('Bearer ')
      ? tokenOrHeader.slice(7)
      : tokenOrHeader;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    // Comparação em tempo constante para evitar timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Gera hash PBKDF2 seguro para uma palavra-passe
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifica se a palavra-passe corresponde ao hash guardado
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const calculatedHash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  // Comparação em tempo constante para evitar timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash));
  } catch {
    return false;
  }
}

/**
 * Regista um novo utilizador no Supabase com hash PBKDF2
 */
async function registerUser({ tenantId, email, password, fullName, role = 'agent' }) {
  const db = getSupabase();
  if (!db) return null;

  if (!email || !password || password.length < 8) {
    return null;
  }

  try {
    const passwordHash = hashPassword(password);

    const { data: user, error } = await db
      .from('tenant_users')
      .insert({ tenant_id: tenantId, email, full_name: fullName, password_hash: passwordHash, role })
      .select('id, tenant_id, email, full_name, role')
      .single();

    if (error) throw error;
    logger.info(`Novo utilizador registado: ${email} (Role: ${role})`);
    return user;
  } catch (err) {
    logger.error(`Erro ao registar utilizador ${email}: ${err.message}`);
    return null;
  }
}

/**
 * Autentica o utilizador e devolve o token JWT
 * Toda a autenticação é feita via tabela tenant_users no Supabase
 */
async function loginUser({ email, password, ip = 'unknown' }) {
  const db = getSupabase();
  const { logAuditEvent } = require('./auditService');
  if (!db) return { success: false, error: 'Banco de dados não disponível.' };

  // Rate limiting por IP
  const rateCheck = checkRateLimit(ip);
  if (rateCheck.blocked) {
    logger.warn(`Login bloqueado por rate limit — IP: ${ip}, Email: ${email}`);
    await logAuditEvent({
      userEmail: email,
      action: 'security.rate_limit',
      category: 'security',
      details: { waitSeconds: rateCheck.waitSeconds },
      ipAddress: ip,
    });
    return {
      success: false,
      error: `Demasiadas tentativas. Aguarde ${rateCheck.waitSeconds} segundos.`,
    };
  }

  if (!email || !password) {
    return { success: false, error: 'E-mail e palavra-passe são obrigatórios.' };
  }

  try {
    // Busca o utilizador no Supabase (inclui admin@cspace.com)
    const { data: user, error } = await db
      .from('tenant_users')
      .select('id, tenant_id, email, full_name, password_hash, role, is_active, tenants(name, slug)')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      logger.warn(`Tentativa de login falhada — Email não encontrado: ${email}`);
      await logAuditEvent({
        userEmail: email,
        action: 'auth.failed',
        category: 'security',
        details: { reason: 'Email não encontrado' },
        ipAddress: ip,
      });
      return { success: false, error: 'Credenciais inválidas.' };
    }

    if (!user.is_active) {
      await logAuditEvent({
        tenantId: user.tenant_id,
        userId: user.id,
        userEmail: user.email,
        action: 'auth.inactive_account',
        category: 'security',
        details: { reason: 'Conta inativa' },
        ipAddress: ip,
      });
      return { success: false, error: 'Conta desativada. Contacte o administrador.' };
    }

    // Verifica a palavra-passe contra o hash no banco
    if (!verifyPassword(password, user.password_hash)) {
      logger.warn(`Tentativa de login falhada — Senha incorreta para: ${email}`);
      await logAuditEvent({
        tenantId: user.tenant_id,
        userId: user.id,
        userEmail: user.email,
        action: 'auth.failed',
        category: 'security',
        details: { reason: 'Senha incorreta' },
        ipAddress: ip,
      });
      return { success: false, error: 'Credenciais inválidas.' };
    }

    // Login bem-sucedido — limpa rate limit
    clearRateLimit(ip);

    const token = generateToken({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    });

    logger.info(`Login bem-sucedido: ${email} (${user.role})`);
    await logAuditEvent({
      tenantId: user.tenant_id,
      userId: user.id,
      userEmail: user.email,
      action: 'user.login',
      category: 'auth',
      details: { role: user.role, tenantName: user.tenants?.name },
      ipAddress: ip,
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        tenantName: user.tenants?.name || 'C-Space Tenant',
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      }
    };
  } catch (err) {
    logger.error(`Erro de autenticação para ${email}: ${err.message}`);
    return { success: false, error: 'Erro interno do servidor.' };
  }
}

module.exports = { generateToken, verifyToken, hashPassword, verifyPassword, registerUser, loginUser };
