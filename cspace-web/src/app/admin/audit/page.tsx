'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  tenant_id?: string;
  user_email: string;
  action: string;
  category: 'auth' | 'tenant' | 'billing' | 'session' | 'system' | 'security';
  details: Record<string, any>;
  ip_address: string;
  created_at: string;
  tenants?: {
    name: string;
    slug: string;
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadAuditLogs = async (category = selectedCategory) => {
    try {
      setLoading(true);
      const url = `http://localhost:3001/api/admin/audit?category=${category}&limit=100`;
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs(selectedCategory);
  }, [selectedCategory]);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.user_email.toLowerCase().includes(search.toLowerCase()) ||
      (l.tenants?.name && l.tenants.name.toLowerCase().includes(search.toLowerCase()))
  );

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'auth':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'tenant':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'billing':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'session':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'security':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Logs de Auditoria & Segurança</h1>
          <p className="text-xs text-slate-600">Registo permanente de eventos sensíveis, logins, alterações de planos e alertas de segurança na BD</p>
        </div>

        <button
          onClick={() => loadAuditLogs(selectedCategory)}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Atualizar Logs
        </button>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Todos os Eventos' },
            { id: 'auth', label: 'Autenticação' },
            { id: 'security', label: 'Segurança & Bloqueios' },
            { id: 'tenant', label: 'Empresas' },
            { id: 'billing', label: 'Faturação & Planos' },
            { id: 'session', label: 'Instâncias WhatsApp' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por utilizador ou ação..."
            className="bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none w-48 md:w-64"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Eventos Registados no Supabase (`audit_logs`)</div>
          <span className="text-xs text-slate-900 font-semibold bg-slate-100 px-3 py-1 rounded-full">{filteredLogs.length} Resultados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4">Ação / Evento</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Utilizador / Origem</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Data / Hora</th>
                <th className="p-4 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">A carregar registos da base de dados...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Nenhum evento de auditoria encontrado.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      <span>{log.action}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${getCategoryBadge(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700 font-medium">{log.user_email}</td>
                    <td className="p-4 font-bold text-slate-600">{log.tenants?.name || 'Sistema Central'}</td>
                    <td className="p-4 font-mono text-slate-500">{log.ip_address}</td>
                    <td className="p-4 text-slate-600">
                      {log.created_at ? new Date(log.created_at).toLocaleString('pt-PT') : 'N/A'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold transition-colors border border-slate-200"
                      >
                        Ver JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Modal Details */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                Detalhes do Evento #{selectedLog.id.slice(0, 8)}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-900 text-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div><b>Ação:</b> {selectedLog.action}</div>
              <div><b>Utilizador:</b> {selectedLog.user_email}</div>
              <div><b>IP:</b> {selectedLog.ip_address}</div>
              <div><b>Data:</b> {new Date(selectedLog.created_at).toLocaleString('pt-PT')}</div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Payload do Evento (JSONB)</label>
              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-200 text-xs font-mono text-green-400 overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs border border-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
