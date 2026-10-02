'use client';

import { useState, useEffect } from 'react';
import { useUI } from '@/components/ui-provider';

interface TenantUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  is_active?: boolean;
  phone?: string;
}

interface Subscription {
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  plans?: {
    name: string;
    code: string;
    price?: number;
    monthly_message_limit?: number;
    max_whatsapp_accounts?: number;
    max_users?: number;
  };
}

interface WhatsAppSession {
  session_name: string;
  status: string;
  phone_number?: string;
  last_connected_at?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  status: string;
  type?: 'company' | 'personal';
  created_at: string;
  updated_at?: string;
  tenant_users?: TenantUser[];
  subscriptions?: Subscription[];
  clients_count?: number;
  messages_used?: number;
  messages_received?: number;
  whatsapp_session?: WhatsAppSession | null;
}

export default function SuperAdminTenantsPage() {
  const { confirm, toast } = useUI();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'company' | 'personal'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState<'company' | 'personal'>('company');
  const [creating, setCreating] = useState(false);

  // Modal de Perfil Master
  const [selectedProfile, setSelectedProfile] = useState<Tenant | null>(null);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/tenants', { credentials: 'include' });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Acesso negado. Apenas o Super Admin C-Space pode gerir empresas.');
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

  // Resetar página quando filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType]);

  const handleCreateTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const slug = newName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    setCreating(true);

    try {
      const res = await fetch('/api/tenants', {
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

  // Bloquear / Desbloquear Conta
  const handleToggleTenantStatus = (tenant: Tenant) => {
    const isCurrentlyActive = tenant.status === 'active';
    const newStatus = isCurrentlyActive ? 'suspended' : 'active';
    const actionName = isCurrentlyActive ? 'Bloquear/Suspender' : 'Ativar/Desbloquear';

    confirm({
      title: `${actionName} Conta`,
      message: `Tem a certeza que deseja ${actionName.toLowerCase()} a conta "${tenant.name}"?`,
      confirmLabel: actionName,
      danger: isCurrentlyActive,
      onConfirm: () => {
        (async () => {
          try {
            const res = await fetch(`/api/admin/tenants/${tenant.id}/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
              toast('success', 'Conta atualizada', `Conta "${tenant.name}" foi ${newStatus === 'active' ? 'ativada' : 'bloqueada'} com sucesso.`);
              loadTenants();
            } else {
              toast('error', 'Erro', 'Erro ao alterar estado da conta.');
            }
          } catch (_) {
            toast('error', 'Erro de ligação', 'Erro de ligação ao servidor.');
          }
        })();
      },
    });
  };

  // Suspender / Ativar Plano
  const handleToggleSubscriptionStatus = (tenant: Tenant) => {
    const activeSub = tenant.subscriptions && tenant.subscriptions[0];
    const isSubActive = activeSub?.status === 'active';
    const newSubStatus = isSubActive ? 'suspended' : 'active';
    const actionLabel = isSubActive ? 'Suspender Plano' : 'Ativar Plano';

    confirm({
      title: actionLabel,
      message: `Tem a certeza que deseja ${isSubActive ? 'suspender' : 'ativar'} o plano da conta "${tenant.name}"?`,
      confirmLabel: actionLabel,
      danger: isSubActive,
      onConfirm: () => {
        (async () => {
          try {
            const res = await fetch(`/api/admin/tenants/${tenant.id}/subscription`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ status: newSubStatus }),
            });

            if (res.ok) {
              toast('success', 'Plano Atualizado', `O plano de "${tenant.name}" foi ${isSubActive ? 'suspenso' : 'ativado'} com sucesso.`);
              loadTenants();
            } else {
              toast('error', 'Erro', 'Erro ao alterar estado do plano.');
            }
          } catch (_) {
            toast('error', 'Erro de ligação', 'Erro de ligação ao servidor.');
          }
        })();
      },
    });
  };

  // Filtragem e Paginação
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

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTenants = filteredTenants.slice(startIndex, startIndex + itemsPerPage);

  const totalCompanies = tenants.filter((t) => t.type !== 'personal').length;
  const totalPersonals = tenants.filter((t) => t.type === 'personal').length;

  return (
    <div className="space-y-6">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Contas & Empresas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão global de todos os workspaces (Empresariais e Pessoais) registados
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-slate-900/10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar Nova Conta / Empresa
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{tenants.length}</div>
            <div className="text-xs font-medium text-slate-500">Total de Contas</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalCompanies}</div>
            <div className="text-xs font-medium text-slate-500">Empresas (Business)</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalPersonals}</div>
            <div className="text-xs font-medium text-slate-500">Contas Pessoais</div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar por nome, slug ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({tenants.length})
          </button>
          <button
            onClick={() => setFilterType('company')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'company' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Empresas ({totalCompanies})
          </button>
          <button
            onClick={() => setFilterType('personal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pessoais ({totalPersonals})
          </button>
        </div>
      </div>

      {/* Tabela de Workspaces Registados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Workspaces Registados</div>
          <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-3 py-1 rounded-full">
            {filteredTenants.length} Resultados
          </span>
        </div>

        {/* Tabela Desktop */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4">Nome & Proprietário</th>
                <th className="p-4">Tipo & Slug</th>
                <th className="p-4">Plano Ativo</th>
                <th className="p-4">Estado Conta</th>
                <th className="p-4">Estado Plano</th>
                <th className="p-4">Registo</th>
                <th className="p-4 text-center">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      A carregar contas...
                    </div>
                  </td>
                </tr>
              ) : paginatedTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhuma conta encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedTenants.map((t) => {
                  const isPersonal = t.type === 'personal';
                  const activeSub = t.subscriptions && t.subscriptions[0];
                  const planName = activeSub?.plans?.name || 'Starter';
                  const isSubActive = activeSub?.status === 'active';
                  const isTenantActive = t.status === 'active';
                  const owner = t.tenant_users && t.tenant_users[0];

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
                            <span className="text-[11px] font-normal text-slate-500">{owner?.full_name || owner?.email || t.email || t.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-600">
                        <span className="block text-slate-900 font-semibold">{t.slug}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">{isPersonal ? 'Pessoal' : 'Empresa'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {planName}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full border font-bold text-[10px] uppercase ${
                          isTenantActive
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          {isTenantActive ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full border font-bold text-[10px] uppercase ${
                          isSubActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {isSubActive ? 'Plano Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {new Date(t.created_at).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ver Perfil Master */}
                          <button
                            onClick={() => setSelectedProfile(t)}
                            title="Ver Perfil Master da Conta"
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Perfil
                          </button>

                          {/* Bloquear / Desbloquear Conta */}
                          <button
                            onClick={() => handleToggleTenantStatus(t)}
                            title={isTenantActive ? 'Bloquear Conta' : 'Desbloquear Conta'}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                              isTenantActive
                                ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {isTenantActive ? 'Bloquear' : 'Desbloquear'}
                          </button>

                          {/* Suspender / Ativar Plano */}
                          <button
                            onClick={() => handleToggleSubscriptionStatus(t)}
                            title={isSubActive ? 'Suspender Plano' : 'Ativar Plano'}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                              isSubActive
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {isSubActive ? 'Suspender Plano' : 'Ativar Plano'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela com Controlo de Paginação */}
        {!loading && filteredTenants.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-medium">
              Mostrando <span className="font-bold text-slate-900">{startIndex + 1}</span> a{' '}
              <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, filteredTenants.length)}</span> de{' '}
              <span className="font-bold text-slate-900">{filteredTenants.length}</span> empresas
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1"
              >
                Seguinte
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Perfil Master da Conta/Empresa */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-6 shadow-2xl my-8">
            {/* Header do Perfil */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-lg">
                  {selectedProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xl flex items-center gap-2">
                    {selectedProfile.name}
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase ${
                      selectedProfile.status === 'active'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {selectedProfile.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5 font-mono">
                    ID: {selectedProfile.id} • Slug: {selectedProfile.slug}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Secções de Informação Detalhada */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Proprietário / Utilizador Master */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Proprietário / Contacto Principal
                </span>
                {selectedProfile.tenant_users && selectedProfile.tenant_users.length > 0 ? (
                  selectedProfile.tenant_users.map((u) => (
                    <div key={u.id} className="space-y-1">
                      <div className="font-bold text-sm text-slate-900">{u.full_name || 'Sem nome'}</div>
                      <div className="text-xs text-slate-600 font-medium">{u.email}</div>
                      {u.phone && <div className="text-xs text-slate-500 font-mono">{u.phone}</div>}
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                        {u.role}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    {selectedProfile.email || 'Sem e-mail registado'}
                  </div>
                )}
              </div>

              {/* 2. Plano & Subscrição */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Plano Ativo & Faturação
                </span>
                {selectedProfile.subscriptions && selectedProfile.subscriptions.length > 0 ? (
                  (() => {
                    const sub = selectedProfile.subscriptions[0];
                    const plan = sub.plans;
                    return (
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                          <span>{plan?.name || 'Starter'}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {sub.status === 'active' ? 'Ativo' : 'Suspenso'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Limite Mensal: <span className="font-bold text-slate-900">{plan?.monthly_message_limit || 100} msgs</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Max Contas WhatsApp: <span className="font-bold text-slate-900">{plan?.max_whatsapp_accounts || 1}</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs text-slate-500 italic">Sem plano ativo configurado</div>
                )}
              </div>

              {/* 3. Métricas de Uso & Clientes */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Métricas de Uso do Mês
                </span>
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-lg font-black text-slate-900">{selectedProfile.clients_count || 0}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Clientes Captados</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-lg font-black text-emerald-600">{selectedProfile.messages_used || 0}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Msgs Enviadas</div>
                  </div>
                </div>
              </div>

              {/* 4. Estado da Conexão WhatsApp */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Sessão WhatsApp
                </span>
                {selectedProfile.whatsapp_session ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        selectedProfile.whatsapp_session.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="font-bold text-xs text-slate-900">
                        {selectedProfile.whatsapp_session.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                    {selectedProfile.whatsapp_session.phone_number && (
                      <div className="text-xs text-slate-600 font-mono font-medium">
                        +{selectedProfile.whatsapp_session.phone_number}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Nenhum WhatsApp conectado</div>
                )}
              </div>
            </div>

            {/* Rodapé com Botão Fechar */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedProfile(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
              >
                Fechar Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Nova Conta / Empresa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Criar Nova Conta / Empresa</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTenantSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Empresa / Utilizador</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Farmácia Central ou João Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Contacto (Opcional)</label>
                <input
                  type="email"
                  placeholder="contacto@empresa.co.ao"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Workspace</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'company' | 'personal')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium"
                >
                  <option value="company">Empresa (Business)</option>
                  <option value="personal">Pessoa Individual (Personal)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs disabled:opacity-50"
                >
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
