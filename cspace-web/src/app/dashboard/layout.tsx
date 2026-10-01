'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import UserDropdown from '@/components/UserDropdown';
import CSVecnaLogo from '@/components/CSVecnaLogo';
import { API_URL } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantStatus, setTenantStatus] = useState<string | null>(null); // null = ainda a carregar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usage, setUsage] = useState<{
    nearLimit: boolean;
    limitReached: boolean;
    messagesUsed: number;
    messagesLimit: number;
    usagePercent: number;
  } | null>(null);

  useEffect(() => {
    async function loadUserAndStatus() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          const u = meData.user;
          setUserName(u.fullName || u.email);
          setTenantName(u.tenantName || 'Minha Empresa');
        }

        const statsRes = await fetch(`${API_URL}/api/dashboard/stats`, {
          credentials: 'include',
        });
        if (statsRes.ok) {
          const data = await statsRes.json();
          setTenantStatus(data.tenantStatus || 'active');
          if (typeof data.messagesLimit === 'number') {
            setUsage({
              nearLimit: !!data.nearLimit,
              limitReached: !!data.limitReached,
              messagesUsed: data.messagesUsed || 0,
              messagesLimit: data.messagesLimit,
              usagePercent: data.usagePercent || 0,
            });
          }
        } else {
          // Se a chamada falhar (ex: 403 bloqueado), definimos como carregado
          setTenantStatus(prev => prev ?? 'active');
        }
      } catch (_) {}
    }
    loadUserAndStatus();
    const interval = setInterval(loadUserAndStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  // ─── Proteção de rota no frontend ─────────────────────────
  // Rotas que exigem subscrição ativa:
  const RESTRICTED_PATHS = [
    '/dashboard/whatsapp',
    '/dashboard/chat',
    '/dashboard/contacts',
    '/dashboard/automation',
  ];

  useEffect(() => {
    // Aguarda o status ser carregado (não redireciona enquanto ainda é null)
    if (tenantStatus === null) return;

    const isBlocked = tenantStatus === 'pending_payment' || tenantStatus === 'suspended' || tenantStatus === 'cancelled';
    const isRestrictedPath = RESTRICTED_PATHS.some(p => pathname.startsWith(p));

    if (isBlocked && isRestrictedPath) {
      router.replace('/dashboard/billing?blocked=true');
    }
  }, [tenantStatus, pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const isBlocked = tenantStatus === 'pending_payment' || tenantStatus === 'suspended' || tenantStatus === 'cancelled';

  const navItems = [
    { label: 'Visão geral', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/dashboard' },
    { label: 'WhatsApp', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z', href: '/dashboard/whatsapp', locked: isBlocked },
    { label: 'Conversas', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', href: '/dashboard/chat', locked: isBlocked },
    { label: 'Contatos', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', href: '/dashboard/contacts', locked: isBlocked },
    { label: 'Automação', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', href: '/dashboard/automation', locked: isBlocked },
    { label: 'Perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', href: '/dashboard/profile' },
    { label: 'Planos', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', href: '/dashboard/billing', highlight: isBlocked },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6">
          <Link href="/dashboard">
            <CSVecnaLogo size="sm" theme="light" showSubtext={true} />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-900"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            if (item.locked) {
              return (
                <button
                  key={item.href}
                  onClick={() => router.push('/dashboard/billing?unlock=true')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-50 transition-colors"
                  title="Funcionalidade bloqueada"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                  </div>
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : item.highlight
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span>{item.label}</span>
                {item.highlight && (
                  <span className="ml-auto w-2 h-2 bg-amber-500 rounded-full"></span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="flex items-center gap-3 px-3 py-1">
            <div className={`w-2 h-2 rounded-full ${isBlocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <span className="text-xs font-medium text-slate-600">
              {isBlocked ? 'Conta bloqueada' : 'Sistema ativo'}
            </span>
          </div>
          <div className="px-3 text-[10px] text-slate-400 font-medium">
            Desenvolvido por <span className="text-slate-700 font-semibold">C-Space Technologies</span>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Alert Banners */}
        {isBlocked && (
          <div className="bg-red-600 px-6 py-3 text-white text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Sua conta precisa de ativação. Escolha um plano para liberar todas as funcionalidades.</span>
            </div>
            <Link
              href="/dashboard/billing"
              className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Ativar agora
            </Link>
          </div>
        )}

        {!isBlocked && usage?.limitReached && (
          <div className="bg-red-600 px-6 py-3 text-white text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">
                Limite de mensagens atingido ({usage.messagesUsed.toLocaleString()}/{usage.messagesLimit.toLocaleString()}).
              </span>
            </div>
            <Link
              href="/dashboard/billing"
              className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Fazer upgrade
            </Link>
          </div>
        )}

        {!isBlocked && !usage?.limitReached && usage?.nearLimit && (
          <div className="bg-amber-500 px-6 py-3 text-white text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">
                Você usou {usage.usagePercent}% das mensagens do plano ({usage.messagesUsed.toLocaleString()}/{usage.messagesLimit.toLocaleString()}).
              </span>
            </div>
            <Link
              href="/dashboard/billing"
              className="bg-white text-amber-700 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Ver planos
            </Link>
          </div>
        )}

        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-900"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="font-medium text-slate-900">{tenantName}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <UserDropdown
              userName={userName || 'Usuário'}
              userRole={tenantStatus ?? 'active'}
              profileLink="/dashboard/profile"
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
