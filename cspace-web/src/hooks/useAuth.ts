'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  userId: string;
  email: string;
  role: 'super_admin' | 'owner' | 'admin' | 'agent';
  fullName?: string;
  tenantName?: string;
}

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Verificar sessão ao montar o componente
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setError(null);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      setError('Erro ao verificar sessão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();

    // Verificar sessão periodicamente (a cada 5 minutos)
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkSession]);

  // Login
  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      setUser(data.user);
      setError(null);

      // Redirecionar baseado na role
      if (data.user.role === 'super_admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setLoading(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);
      setError(null);
      router.push('/login');
    } catch (err) {
      setError('Erro ao fazer logout');
    } finally {
      setLoading(false);
    }
  };

  // Refresh session
  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Erro ao renovar sessão:', err);
    }
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'super_admin',
    isAdmin: user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin',
    login,
    logout,
    refreshSession,
    checkSession,
  };
}

// Hook para proteger rotas
export function useRequireAuth(requiredRole?: User['role'] | User['role'][]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(user.role)) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, requiredRole, router]);

  return { user, loading };
}

// Hook para verificar permissões
export function usePermissions() {
  const { user } = useAuth();

  return {
    canAccessAdmin: user?.role === 'super_admin',
    canManageTenant: user?.role === 'owner' || user?.role === 'super_admin',
    canManageUsers: user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin',
    canViewReports: !!user,
    canManageWhatsApp: user?.role !== 'agent',
  };
}
