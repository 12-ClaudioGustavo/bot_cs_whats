'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUI } from '@/components/ui-provider';

interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  tenant_id: string;
  tenants?: {
    id: string;
    name: string;
    slug: string;
    type?: 'company' | 'personal';
    status: string;
  };
}

export default function AdminUsersPage() {
  const { confirm, toast } = useUI();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        setError('Acesso negado. Apenas o Super Admin pode gerir a lista global de utilizadores.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data || []);
    } catch (_) {
      setError('Erro ao carregar lista de utilizadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleUserStatus = (user: TenantUser) => {
    const actionName = user.is_active ? 'desativar' : 'ativar';
    confirm({
      title: 'Alterar Estado',
      message: `Tem a certeza que deseja ${actionName} o utilizador "${user.full_name || user.email}"?`,
      confirmLabel: 'Confirmar',
      danger: true,
      onConfirm: () => {
        (async () => {
          try {
            const res = await fetch(`/api/admin/users/${user.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: !user.is_active }),
            });

            if (res.ok) {
              toast('success', 'Estado alterado', `Utilizador ${actionName}do com sucesso.`);
              loadUsers();
            } else {
              toast('error', 'Erro', 'Erro ao alterar estado do utilizador.');
            }
          } catch (_) {
            toast('error', 'Erro de ligação', 'Não foi possível ligar ao servidor.');
          }
        })();
      },
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      (u.tenants?.name && u.tenants.name.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    const isPersonal = u.tenants?.type === 'personal';
    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'company' && !isPersonal) ||
      (typeFilter === 'personal' && isPersonal);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);

    return matchesSearch && matchesRole && matchesType && matchesStatus;
  });

  const totalActive = users.filter((u) => u.is_active).length;
  const totalInactive = users.filter((u) => !u.is_active).length;
  const totalSuperAdmins = users.filter((u) => u.role === 'super_admin').length;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="bg-purple-100 border border-purple-200 text-purple-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">Super Admin</span>;
      case 'owner':
      case 'admin':
        return <span className="bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Admin</span>;
      default:
        return <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">Operador / Agente</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Gestão Global de Utilizadores</h1>
          <p className="text-xs text-slate-600">Visão unificada de todos os utilizadores da plataforma em todas as empresas e contas pessoais</p>
        </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{users.length}</div>
            <div className="text-xs font-semibold text-slate-500">Total Utilizadores</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalActive}</div>
            <div className="text-xs font-semibold text-slate-500">Utilizadores Ativos</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalSuperAdmins}</div>
            <div className="text-xs font-semibold text-slate-500">Super Admins</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalInactive}</div>
            <div className="text-xs font-semibold text-slate-500">Inativos / Bloqueados</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, email ou empresa..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="all">Todas as Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin / Owner</option>
            <option value="agent">Operador / Agente</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="all">Empresa & Pessoal</option>
            <option value="company">Empresas</option>
            <option value="personal">Pessoais</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="all">Todos os Estados</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </select>
        </div>
      </div>

      {/* Users Responsive Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Utilizadores Registados ({filteredUsers.length})</div>
        </div>

        {/* Mobile View: Cards */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              A carregar utilizadores...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhum utilizador encontrado.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isPersonal = u.tenants?.type === 'personal';
              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                        {(u.full_name || u.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{u.full_name || 'Sem nome'}</h4>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    {getRoleBadge(u.role)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Workspace</span>
                      <span className="font-semibold text-slate-800">{u.tenants?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo</span>
                      <span className="font-medium text-slate-700">{isPersonal ? 'Pessoal' : 'Empresa'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Estado</span>
                      <span className={`font-bold ${u.is_active ? 'text-emerald-600' : 'text-red-600'}`}>
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Registo</span>
                      <span className="text-slate-600">{new Date(u.created_at).toLocaleDateString('pt-PT')}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleToggleUserStatus(u)}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                        u.is_active
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {u.is_active ? 'Desativar Utilizador' : 'Ativar Utilizador'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4">Utilizador</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Workspace / Tenant</th>
                <th className="p-4">Tipo de Conta</th>
                <th className="p-4">Role / Nível</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Data Registo</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                    A carregar utilizadores...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Nenhum utilizador encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isPersonal = u.tenants?.type === 'personal';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                            {(u.full_name || u.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="text-slate-900 font-bold block">{u.full_name || 'Sem nome'}</span>
                            {u.phone && <span className="text-[10px] font-normal text-slate-500">{u.phone}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-700">{u.email}</td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-900">{u.tenants?.name || '—'}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPersonal ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          {isPersonal ? 'Pessoal' : 'Empresa'}
                        </span>
                      </td>
                      <td className="p-4">{getRoleBadge(u.role)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full border font-bold text-[10px] uppercase ${
                          u.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          {u.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            u.is_active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {u.is_active ? 'Desativar' : 'Ativar'}
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
    </div>
  );
}
