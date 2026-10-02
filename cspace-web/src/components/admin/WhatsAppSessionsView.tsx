'use client';

import { useState, useEffect } from 'react';

interface WhatsAppSession {
  id: string;
  tenant_id: string;
  session_name: string;
  phone_number?: string;
  status: 'connected' | 'qr' | 'starting' | 'disconnected';
  qr_code_url?: string;
  last_connected_at?: string;
  updated_at: string;
  tenants?: {
    name: string;
    slug: string;
    email?: string;
  };
}

export default function WhatsAppSessionsView() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/whatsapp-sessions', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      } else {
        setError('Falha ao carregar instâncias de WhatsApp da base de dados.');
      }
    } catch (_) {
      setError('Erro de conexão ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Instâncias de WhatsApp (Multi-Tenant)</h1>
          <p className="text-xs text-slate-600">Monitorização em tempo real de todas as sessões registradas no banco de dados Supabase</p>
        </div>

        <button
          onClick={loadSessions}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar Estado
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Grid de Resumo de Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="dashboard-card space-y-1">
          <div className="text-xs font-bold text-slate-600 uppercase">Total de Instâncias</div>
          <div className="text-2xl font-black text-slate-900">{sessions.length}</div>
        </div>

        <div className="dashboard-card border-green-200 bg-green-50 space-y-1">
          <div className="text-xs font-bold text-green-700 uppercase">Conectadas</div>
          <div className="text-2xl font-black text-green-700">
            {sessions.filter((s) => s.status === 'connected').length}
          </div>
        </div>

        <div className="dashboard-card border-amber-200 bg-amber-50 space-y-1">
          <div className="text-xs font-bold text-amber-700 uppercase">Aguardando QR / A Iniciar</div>
          <div className="text-2xl font-black text-amber-700">
            {sessions.filter((s) => s.status === 'qr' || s.status === 'starting').length}
          </div>
        </div>
      </div>

      {/* Tabela de Instâncias */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Sessões Registadas no Supabase</div>
          <span className="text-xs text-slate-900 font-semibold bg-slate-100 px-3 py-1 rounded-full">{sessions.length} Registos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4">Empresa / Tenant</th>
                <th className="p-4">Sessão</th>
                <th className="p-4">Número de Telefone</th>
                <th className="p-4">Estado da Conexão</th>
                <th className="p-4">Última Conexão</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">A carregar instâncias da base de dados...</td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma instância de WhatsApp registada ainda.</td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div>{s.tenants?.name || 'Empresa Geral'}</div>
                      <div className="text-[10px] font-mono text-slate-500">{s.tenants?.slug || s.tenant_id}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-600">{s.session_name}</td>
                    <td className="p-4 font-mono font-bold text-slate-900">
                      {s.phone_number ? `+${s.phone_number}` : 'Sem número'}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full border font-bold text-[10px] uppercase inline-flex items-center gap-1.5 ${
                          s.status === 'connected'
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : s.status === 'qr'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {s.status === 'connected' && <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>}
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">
                      {s.last_connected_at ? new Date(s.last_connected_at).toLocaleString('pt-PT') : 'Nunca'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={loadSessions}
                        className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold transition-colors border border-slate-200"
                      >
                        Verificar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
