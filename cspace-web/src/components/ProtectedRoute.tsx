'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'super_admin' | 'owner' | 'admin' | 'agent' | Array<'super_admin' | 'owner' | 'admin' | 'agent'>;
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredRole, redirectTo = '/login' }: ProtectedRouteProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!res.ok) {
          router.push(redirectTo);
          return;
        }

        const data = await res.json();

        if (!data.user) {
          router.push(redirectTo);
          return;
        }

        // Verificar role se necessário
        if (requiredRole) {
          const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

          if (!roles.includes(data.user.role)) {
            // Redirecionar para dashboard se não tem permissão
            router.push('/dashboard');
            return;
          }
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push(redirectTo);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [requiredRole, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mb-4"></div>
          <p className="text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}

// Componente para proteger rotas de admin
export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="super_admin" redirectTo="/dashboard">
      {children}
    </ProtectedRoute>
  );
}

// Componente para proteger rotas de dashboard
export function DashboardRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole={['super_admin', 'owner', 'admin', 'agent']}>
      {children}
    </ProtectedRoute>
  );
}

// Componente para rotas que requerem ser owner ou admin
export function ManagerRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole={['super_admin', 'owner', 'admin']}>
      {children}
    </ProtectedRoute>
  );
}
