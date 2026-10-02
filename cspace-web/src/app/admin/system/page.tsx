'use client';

import { useState, useEffect } from 'react';

interface SystemHealth {
  status: string;
  dbStatus: string;
  uptime: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
  };
  timestamp: string;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000); // Polling 5s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (sec?: number) => {
    if (!sec) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Estado do Sistema & Infraestrutura</h1>
          <p className="text-xs text-slate-600">Desempenho dos serviços de backend Express, Supabase PostgreSQL e Gateway Baileys</p>
        </div>

        <button
          onClick={checkHealth}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Recarregar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Supabase */}
        <div className="dashboard-card space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600">
            <span>Supabase PostgreSQL DB</span>
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
          </div>
          <div className="text-xl font-bold text-green-600 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${health?.dbStatus === 'connected' ? 'bg-green-500 animate-ping' : 'bg-red-500'}`}></span>
            {health?.dbStatus === 'connected' ? 'Conetado & Ativo' : 'A Conectar...'}
          </div>
          <p className="text-xs text-slate-600">Row Level Security (RLS) & Multi-Tenant SQL Schema</p>
        </div>

        {/* Gateway Baileys */}
        <div className="dashboard-card space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600">
            <span>Gateway WhatsApp Express</span>
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </div>
          <div className="text-xl font-bold text-green-600 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${health?.status === 'connected' ? 'bg-green-500 animate-ping' : 'bg-amber-400'}`}></span>
            <span className="capitalize">{health?.status || 'starting'}</span>
          </div>
          <p className="text-xs text-slate-600">Porta 3001 · SSE Stream de Eventos em Tempo Real</p>
        </div>

        {/* System Uptime */}
        <div className="dashboard-card space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600">
            <span>Tempo de Atividade (Uptime)</span>
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
          </div>
          <div className="text-xl font-bold text-blue-600">
            {health?.uptime ? formatUptime(health.uptime) : '0m'}
          </div>
          <p className="text-xs text-slate-600">
            {health?.memoryUsage
              ? `Memória Heap: ${Math.round(health.memoryUsage.heapUsed / 1024 / 1024)} MB / ${Math.round(health.memoryUsage.heapTotal / 1024 / 1024)} MB`
              : 'Servidor Node.js Activo'}
          </p>
        </div>
      </div>
    </div>
  );
}
