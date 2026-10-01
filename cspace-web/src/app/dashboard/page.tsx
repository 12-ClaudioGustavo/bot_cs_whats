'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';

interface Stats {
  status: string;
  totalClients: number;
  totalConversations: number;
  totalAppointments: number;
  messagesUsed: number;
  messagesLimit: number;
  planName: string;
}

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${API_URL}/api/dashboard/stats`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (_) {
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const usagePercentage = stats ? (stats.messagesUsed / stats.messagesLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Visão Geral</h1>
        <p className="text-sm text-slate-600">Métricas e atividade da sua plataforma</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              stats?.status === 'connected'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {loading ? '...' : stats?.status === 'connected' ? 'Conectado' : 'Aguardando'}
            </span>
          </div>
          <div className="stat-label">Status WhatsApp</div>
          <div className="stat-value text-xl">
            {loading ? '...' : stats?.status === 'connected' ? 'Online' : 'Offline'}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="stat-label">Clientes</div>
          <div className="stat-value">{loading ? '...' : stats?.totalClients || 0}</div>
          <div className="stat-change">Base de contatos ativa</div>
        </div>

        <div className="dashboard-card">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="stat-label">Conversas</div>
          <div className="stat-value">{loading ? '...' : stats?.totalConversations || 0}</div>
          <div className="stat-change">Total de interações</div>
        </div>

        <div className="dashboard-card">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="stat-label">Plano</div>
          <div className="stat-value text-xl">{loading ? '...' : stats?.planName || 'Business'}</div>
        </div>
      </div>

      {/* Usage Card */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Uso de mensagens</h3>
            <p className="text-xs text-slate-600 mt-1">
              {loading ? '...' : `${stats?.messagesUsed || 0} de ${stats?.messagesLimit?.toLocaleString() || '5,000'} mensagens utilizadas`}
            </p>
          </div>
          <span className="text-2xl font-bold text-slate-900">
            {loading ? '...' : `${Math.round(usagePercentage)}%`}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              usagePercentage > 80 ? 'bg-red-500' : usagePercentage > 60 ? 'bg-amber-500' : 'bg-slate-900'
            }`}
            style={{ width: `${loading ? 0 : usagePercentage}%` }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Ações rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href="/dashboard/whatsapp"
              className="card card-hover p-5 flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-0.5">Conectar WhatsApp</div>
                <div className="text-xs text-slate-600">Escanear QR Code</div>
              </div>
            </a>

            <a
              href="/dashboard/automation"
              className="card card-hover p-5 flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-0.5">Configurar automação</div>
                <div className="text-xs text-slate-600">Editar mensagens e fluxos</div>
              </div>
            </a>

            <a
              href="/dashboard/contacts"
              className="card card-hover p-5 flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-0.5">Gerenciar contatos</div>
                <div className="text-xs text-slate-600">Ver base de clientes</div>
              </div>
            </a>

            <a
              href="/dashboard/billing"
              className="card card-hover p-5 flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-0.5">Planos e faturação</div>
                <div className="text-xs text-slate-600">Gerenciar assinatura</div>
              </div>
            </a>
          </div>
        </div>

        {/* Info Card */}
        <div className="dashboard-card">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3 className="font-semibold text-slate-900">Segurança</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Seu workspace utiliza isolamento multi-tenant com criptografia de ponta a ponta e Row Level Security.
          </p>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Proteção ativa
          </div>
        </div>
      </div>
    </div>
  );
}
