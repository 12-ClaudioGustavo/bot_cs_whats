import { cookies } from 'next/headers';

export interface UserSession {
  userId: string;
  tenantId: string;
  email: string;
  role: 'super_admin' | 'owner' | 'admin' | 'agent';
  fullName?: string;
  tenantName?: string;
  iat?: number; // Issued at
  exp?: number; // Expiration
  sessionId?: string; // ID único da sessão
}

export interface SessionMetadata {
  userAgent?: string;
  ip?: string;
  lastActivity: number;
  createdAt: number;
}

/**
 * Decodifica o payload do JWT sem dependências de Node.js crypto
 * Compatível com Edge Runtime do Next.js
 */
export function verifyToken(token: string): UserSession | null {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [, body] = parts;
    const jsonStr = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(jsonStr);

    // Verificar expiração
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Validar campos obrigatórios
    if (!payload.userId || !payload.email || !payload.role) {
      return null;
    }

    return payload as UserSession;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Obtém a sessão atual do usuário
 */
export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cspace_session')?.value;

    if (!token) return null;

    const session = verifyToken(token);

    // Atualizar última atividade se a sessão for válida
    if (session) {
      await updateLastActivity();
    }

    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Define o cookie de sessão com configurações de segurança
 */
export async function setSessionCookie(token: string, rememberMe: boolean = false) {
  try {
    const cookieStore = await cookies();
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 dias ou 7 dias

    cookieStore.set('cspace_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // Armazenar metadata da sessão
    const session = verifyToken(token);
    if (session) {
      await storeSessionMetadata(session);
    }
  } catch (error) {
    console.error('Error setting session cookie:', error);
    throw error;
  }
}

/**
 * Remove o cookie de sessão e limpa metadata
 */
export async function clearSessionCookie() {
  try {
    const cookieStore = await cookies();
    const session = await getSession();

    // Limpar cookie principal
    cookieStore.delete('cspace_session');

    // Limpar cookies de metadata
    cookieStore.delete('cspace_session_meta');
    cookieStore.delete('cspace_refresh_token');

    // Registrar logout (se houver sessão)
    if (session) {
      await logSessionActivity(session.userId, 'logout');
    }
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

/**
 * Armazena metadata da sessão
 */
async function storeSessionMetadata(session: UserSession) {
  try {
    const cookieStore = await cookies();
    const metadata: SessionMetadata = {
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    cookieStore.set('cspace_session_meta', JSON.stringify(metadata), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    await logSessionActivity(session.userId, 'login');
  } catch (error) {
    console.error('Error storing session metadata:', error);
  }
}

/**
 * Atualiza timestamp da última atividade
 */
async function updateLastActivity() {
  try {
    const cookieStore = await cookies();
    const metaCookie = cookieStore.get('cspace_session_meta')?.value;

    if (metaCookie) {
      const metadata: SessionMetadata = JSON.parse(metaCookie);
      metadata.lastActivity = Date.now();

      cookieStore.set('cspace_session_meta', JSON.stringify(metadata), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  } catch (error) {
    // Silenciosamente falhar para não quebrar a aplicação
  }
}

/**
 * Registra atividade da sessão
 */
async function logSessionActivity(userId: string, action: 'login' | 'logout' | 'refresh') {
  try {
    // Aqui você pode integrar com seu sistema de logs/auditoria
    // Por exemplo, enviar para Supabase, Analytics, etc.
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Session Activity] User ${userId}: ${action} at ${new Date().toISOString()}`);
    }
  } catch (error) {
    // Silenciosamente falhar
  }
}

/**
 * Verifica se a sessão está próxima de expirar (menos de 1 hora)
 */
export function isSessionExpiringSoon(session: UserSession | null): boolean {
  if (!session || !session.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = session.exp - now;
  const oneHour = 60 * 60;

  return timeUntilExpiry < oneHour && timeUntilExpiry > 0;
}

/**
 * Obtém tempo restante da sessão em segundos
 */
export function getSessionTimeRemaining(session: UserSession | null): number {
  if (!session || !session.exp) return 0;

  const now = Math.floor(Date.now() / 1000);
  const remaining = session.exp - now;

  return remaining > 0 ? remaining : 0;
}

/**
 * Valida se o usuário tem a role necessária
 */
export function hasRole(session: UserSession | null, requiredRole: UserSession['role'] | UserSession['role'][]): boolean {
  if (!session) return false;

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(session.role);
}

/**
 * Valida se o usuário tem permissão de super admin
 */
export function isSuperAdmin(session: UserSession | null): boolean {
  return session?.role === 'super_admin';
}

/**
 * Valida se o usuário tem permissão de admin (owner ou admin)
 */
export function isAdmin(session: UserSession | null): boolean {
  return session?.role === 'owner' || session?.role === 'admin' || session?.role === 'super_admin';
}

/**
 * Valida se o usuário pertence ao tenant
 */
export function belongsToTenant(session: UserSession | null, tenantId: string): boolean {
  return session?.tenantId === tenantId || session?.role === 'super_admin';
}

/**
 * Formato seguro de sessão para enviar ao cliente (sem informações sensíveis)
 */
export function sanitizeSession(session: UserSession | null): Partial<UserSession> | null {
  if (!session) return null;

  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    fullName: session.fullName,
    tenantName: session.tenantName,
  };
}
