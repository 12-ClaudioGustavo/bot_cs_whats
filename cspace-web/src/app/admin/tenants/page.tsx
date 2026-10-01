'use client';

import { useState, useEffect } from 'react';
import { useUI } from '@/components/ui-provider';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  status: string;
  type?: 'company' | 'personal';
  created_at: string;
  subscriptions?: Array<{
    status: string;
    plans?: {
      name: string;
      code: string;
    };
  }>;
}

export default function SuperAdminTenantsPage() {
  const { confirm, toast } = useUI();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'company' | 'personal'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal para criar tenant
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState<'company' | 'personal'>('company');
  const [creating, setCreating] = useState(false);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tenants', { credentials: 'include' });

      if (!res.ok) {
        const fallbackRes = await fetch('http://localhost:3001/api/tenants', { credentials: 'include' });
        if (!fallbackRes.ok) {
          setError('Acesso negado. Apenas o Super Admin C-Space pode gerir empresas.');
          setLoading(false);
          return;
        }
        const fallbackData = await fallbackRes.json();
        setTenants(fallbackData);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setTenants(data);
    } catch (_) {
      setError('Erro ao carregar lista de contas/empresas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreateTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const slug = newName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    setCreating(true);

    try {
      const res = await fetch('http://localhost:3001/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          slug,
          email: newEmail.trim() || undefined,
          type: newType,
          planCode: 'business',
        }),
      });

      if (res.ok) {
        toast('success', 'Conta criada', 'Empresa/conta criada com sucesso.');
        setShowModal(false);
        setNewName('');
        setNewEmail('');
        setNewType('company');
        loadTenants();
      } else {
        toast('error', 'Erro', 'Erro ao criar conta.');
      }
    } catch (_) {
      toast('error', 'Erro de ligação', 'Erro de ligação ao servidor.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    confirm({
      title: 'Alterar Estado',
      message: `Tem a certeza que deseja alterar o estado de "${tenant.name}" para ${newStatus}?`,
      confirmLabel: 'Confirmar',
      danger: true,
      onConfirm: () => {
        (async () => {
          try {
            const res = await fetch(`http://localhost:3001/api/admin/tenants/${tenant.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
              toast('success', 'Estado alterado', `Estado de "${tenant.name}" alterado com sucesso.`);
              loadTenants();
            } else {
              toast('error', 'Erro', 'Erro ao alterar estado.');
            }
          } catch (_) {
            toast('error', 'Erro de ligação', 'Erro de ligação ao servidor.');
          }
        })();
      },
    });
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(search.toLowerCase()));

    const matchesType =
      filterType === 'all' ||
      (filterType === 'company' && t.type !== 'personal') ||
      (filterType === 'personal' && t.type === 'personal');

    return matchesSearch && matchesType;
  });

  const totalCompanies = tenants.filter((t) => t.type !== 'personal').length;
  const totalPersonals = tenants.filter((t) => t.type === 'personal').length;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Gestão de Contas & Empresas</h1>
          <p className="text-xs text-slate-600">Visão global de todos os workspaces (Empresariais e Pessoais) registados</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Criar Nova Conta / Empresa</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{tenants.length}</div>
            <div className="text-xs font-semibold text-slate-500">Total de Contas</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalCompanies}</div>
            <div className="text-xs font-semibold text-slate-500">Empresas (Business)</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalPersonals}</div>
            <div className="text-xs font-semibold text-slate-500">Contas Pessoais</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, slug ou e-mail..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Tipo filter buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-stretch sm:justify-end overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Todas ({tenants.length})
          </button>
          <button
            onClick={() => setFilterType('company')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'company' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Empresas ({totalCompanies})
          </button>
          <button
            onClick={() => setFilterType('personal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pessoais ({totalPersonals})
          </button>
        </div>
      </div>

      {/* Responsive Table / Cards Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Workspaces Registados</div>
          <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-3 py-1 rounded-full">{filteredTenants.length} Resultados</span>
        </div>

        {/* Mobile View: Cards Layout */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              A carregar contas...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhuma conta encontrada.
            </div>
          ) : (
            filteredTenants.map((t) => {
              const isPersonal = t.type === 'personal';
              const activeSub = t.subscriptions && t.subscriptions[0];
              const planName = activeSub?.plans?.name || 'Starter';

              return (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base text-white ${isPersonal ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                        {isPersonal ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                        {t.email && <p className="text-xs text-slate-500">{t.email}</p>}
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full border font-bold text-[10px] uppercase ${
                      t.status === 'active'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : t.status === 'pending_payment'
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {t.status === 'active' ? 'Ativo' : t.status === 'pending_payment' ? 'Pendente' : 'Suspenso'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Slug</span>
                      <span className="font-mono text-slate-700 font-medium">{t.slug}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo</span>
                      <span className="font-semibold text-slate-800">{isPersonal ? 'Pessoal' : 'Empresa'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Plano</span>
                      <span className="font-semibold text-slate-800">{planName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Registo</span>
                      <span className="text-slate-600">{new Date(t.created_at).toLocaleDateString('pt-PT')}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                        t.status === 'active'
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {t.status === 'active' ? 'Suspender Conta' : 'Ativar Conta'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Full Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4">Nome & Proprietário</th>
                <th className="p-4">Slug Identificador</th>
                <th className="p-4">Tipo de Conta</th>
                <th className="p-4">Plano Ativo</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Data de Registo</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    A carregar contas...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhuma conta encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isPersonal = t.type === 'personal';
                  const activeSub = t.subscriptions && t.subscriptions[0];
                  const planName = activeSub?.plans?.name || 'Starter';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white ${isPersonal ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                            {isPersonal ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-900 font-bold block">{t.name}</span>
                            {t.email && <span className="text-[11px] font-normal text-slate-500">{t.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{t.slug}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                          isPersonal
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          {isPersonal ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                            </svg>
                          )}
                          {isPersonal ? 'Pessoa Individual' : 'Empresa'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {planName}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full border font-bold text-[10px] uppercase ${
                            t.status === 'active'
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : t.status === 'pending_payment'
                              ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                              : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          {t.status === 'active' ? 'Ativo' : t.status === 'pending_payment' ? 'Pendente' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {new Date(t.created_at).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(t)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            t.status === 'active'
                              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {t.status === 'active' ? 'Suspender' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Nova Conta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Criar Nova Conta / Workspace</h3>
                <p className="text-xs text-slate-500">Registo de uma empresa ou conta individual</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenantSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nome da Conta / Empresa</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Manuel Silva ou Tech Solutions Lda"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tipo de Conta</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewType('company')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      newType === 'company'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                      </svg>
                      Empresa
                    </span>
                    <span className="text-[10px] opacity-80">Organização ou Negócio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('personal')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      newType === 'personal'
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Pessoal
                    </span>
                    <span className="text-[10px] opacity-80">Pessoa Individual</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">E-mail do Proprietário (Opcional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="proprietario@exemplo.com"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {creating ? 'A criar...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
