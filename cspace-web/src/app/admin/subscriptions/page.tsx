'use client';

import { useState, useEffect } from 'react';
import { useUI } from '@/components/ui-provider';

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_kz: number;
  max_whatsapp_accounts: number;
  monthly_message_limit: number;
  max_users: number;
  is_active: boolean;
}

interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  tenants?: {
    name: string;
    slug: string;
    email?: string;
  };
  plans?: {
    name: string;
    code: string;
    price_kz: number;
  };
}

export default function SubscriptionsManagementPage() {
  const { confirm } = useUI();
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans');

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    priceKz: '',
    maxWhatsappAccounts: '1',
    monthlyMessageLimit: '1000',
    maxUsers: '3',
    isActive: true,
  });

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<{ open: boolean; tenantId: string; planCode: string }>({ open: false, tenantId: '', planCode: '' });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load Plans
  const loadPlans = async () => {
    try {
      setPlansLoading(true);
      const res = await fetch('http://localhost:3001/api/admin/plans', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (_) {
      setError('Erro ao carregar planos.');
    } finally {
      setPlansLoading(false);
    }
  };

  // Load Subscriptions
  const loadSubscriptions = async () => {
    try {
      setSubsLoading(true);
      const res = await fetch('http://localhost:3001/api/admin/subscriptions', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (_) {
      setError('Erro ao carregar subscrições.');
    } finally {
      setSubsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
    loadSubscriptions();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      priceKz: '',
      maxWhatsappAccounts: '1',
      monthlyMessageLimit: '1000',
      maxUsers: '3',
      isActive: true,
    });
    setShowPlanModal(true);
  };

  const handleOpenEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      priceKz: plan.price_kz.toString(),
      maxWhatsappAccounts: plan.max_whatsapp_accounts.toString(),
      monthlyMessageLimit: plan.monthly_message_limit.toString(),
      maxUsers: plan.max_users.toString(),
      isActive: plan.is_active,
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const url = editingPlan
        ? `http://localhost:3001/api/admin/plans/${editingPlan.id}`
        : 'http://localhost:3001/api/admin/plans';
      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao guardar plano.');
        return;
      }

      setMessage(editingPlan ? 'Plano atualizado com sucesso!' : 'Novo plano criado com sucesso!');
      setShowPlanModal(false);
      loadPlans();
    } catch (_) {
      setError('Erro de conexão ao servidor.');
    }
  };

  const handleDeletePlan = (id: string, name: string) => {
    confirm({
      title: 'Eliminar Plano',
      message: `Tem a certeza que deseja eliminar o plano "${name}"?`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: () => {
        (async () => {
          try {
            const res = await fetch(`http://localhost:3001/api/admin/plans/${id}`, {
              method: 'DELETE',
              credentials: 'include',
            });
            if (res.ok) {
              setMessage('Plano eliminado com sucesso!');
              loadPlans();
            } else {
              const data = await res.json();
              setError(data.error || 'Não foi possível eliminar o plano.');
            }
          } catch (_) {
            setError('Erro de conexão ao servidor.');
          }
        })();
      },
    });
  };

  const handleOpenAssignModal = (tenantId: string) => {
    setAssignModal({ open: true, tenantId, planCode: plans[0]?.code || 'business' });
  };

  const handleAssignPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal.planCode) return;

    try {
      const res = await fetch('http://localhost:3001/api/admin/subscriptions/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: assignModal.tenantId, planCode: assignModal.planCode.toLowerCase().trim() }),
      });

      if (res.ok) {
        setMessage('Subscrição alterada com sucesso!');
        setAssignModal({ open: false, tenantId: '', planCode: '' });
        loadSubscriptions();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao alterar subscrição.');
      }
    } catch (_) {
      setError('Erro ao comunicar com o servidor.');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Gestão de Planos & Subscrições SaaS</h1>
          <p className="text-xs text-slate-600">Configure os planos comercializados, preços em Kz, limites de WhatsApp e atribuição a empresas</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar Novo Plano
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'plans'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Planos Cadastrados ({plans.length})
        </button>

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'subscriptions'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Subscrições de Clientes ({subscriptions.length})
        </button>
      </div>

      {/* TAB 1: PLANS CRUD */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {plansLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium">A carregar planos da plataforma...</div>
          ) : plans.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-4">
              <svg className="w-12 h-12 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <div className="text-slate-900 font-bold text-base">Nenhum plano cadastrado</div>
              <p className="text-xs text-slate-600">Crie o seu primeiro plano de subscrição para permitir a ativação de contas.</p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Cadastrar Primeiro Plano
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`dashboard-card p-6 flex flex-col justify-between space-y-6 relative transition-all ${
                    plan.is_active ? 'border-slate-900 shadow-lg' : 'opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-900 text-[10px] font-mono uppercase font-extrabold">
                        {plan.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          plan.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {plan.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-600 mt-1 min-h-[32px]">{plan.description || 'Sem descrição.'}</p>

                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="text-2xl font-black text-slate-900">
                        {plan.price_kz.toLocaleString('pt-PT')} <span className="text-xs font-semibold text-slate-500">Kz / mês</span>
                      </div>
                    </div>

                    <ul className="text-xs text-slate-700 space-y-2 mt-4">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span><b>{plan.max_whatsapp_accounts}</b> {plan.max_whatsapp_accounts === 1 ? 'WhatsApp' : 'WhatsApps'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span><b>{plan.monthly_message_limit.toLocaleString('pt-PT')}</b> Mensagens/mês</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span><b>{plan.max_users}</b> Utilizadores Máximos</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => handleOpenEditModal(plan)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar
                    </button>

                    <button
                      onClick={() => handleDeletePlan(plan.id, plan.name)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors border border-red-200"
                      title="Eliminar Plano"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="dashboard-card overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="font-bold text-sm text-slate-900">Subscrições de Empresas Registadas</div>
            <span className="text-xs text-slate-900 font-semibold bg-slate-100 px-3 py-1 rounded-full">{subscriptions.length} Ativas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4">Empresa / Tenant</th>
                  <th className="p-4">Plano Atual</th>
                  <th className="p-4">Preço Mensal</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Validade do Período</th>
                  <th className="p-4 text-right">Ação Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">A carregar subscrições...</td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma subscrição registada.</td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        <div>{sub.tenants?.name || 'Empresa Sem Nome'}</div>
                        <div className="text-[10px] font-mono text-slate-500">{sub.tenants?.slug}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                          {sub.plans?.name || 'Plano Desconhecido'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        {sub.plans?.price_kz ? `${sub.plans.price_kz.toLocaleString('pt-PT')} Kz` : '0 Kz'}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-bold text-[10px] uppercase border border-green-200">
                          {sub.status || 'active'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-PT') : 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenAssignModal(sub.tenant_id)}
                          className="px-3 py-1 rounded-lg bg-slate-100 text-slate-900 hover:bg-slate-200 text-xs font-bold transition-colors border border-slate-200"
                        >
                          Alterar Plano
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PLANO */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-200 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editingPlan ? 'Editar Plano SaaS' : 'Cadastrar Novo Plano SaaS'}
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-900 text-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Nome do Plano</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Plano Business"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Código / Identificador</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlan}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: business"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:opacity-50 disabled:bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Preço Mensal (Kz)</label>
                <input
                  type="number"
                  required
                  value={formData.priceKz}
                  onChange={(e) => setFormData({ ...formData, priceKz: e.target.value })}
                  placeholder="Ex: 65000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">WhatsApps</label>
                  <input
                    type="number"
                    required
                    value={formData.maxWhatsappAccounts}
                    onChange={(e) => setFormData({ ...formData, maxWhatsappAccounts: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Msgs/mês</label>
                  <input
                    type="number"
                    required
                    value={formData.monthlyMessageLimit}
                    onChange={(e) => setFormData({ ...formData, monthlyMessageLimit: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Utilizadores</label>
                  <input
                    type="number"
                    required
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição dos recursos incluídos neste plano..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-slate-900"
                />
                <label htmlFor="isActive" className="text-slate-700 font-medium cursor-pointer">
                  Plano ativo para novas subscrições
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold border border-slate-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold"
                >
                  {editingPlan ? 'Guardar Alterações' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL DE ATRIBUIÇÃO DE PLANO */}
      {assignModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-lg font-extrabold text-slate-900">Alterar Plano da Empresa</h3>
              <button onClick={() => setAssignModal({ open: false, tenantId: '', planCode: '' })} className="text-slate-400 hover:text-slate-900 text-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAssignPlanSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">Selecione o Novo Plano</label>
                <select
                  value={assignModal.planCode}
                  onChange={(e) => setAssignModal({ ...assignModal, planCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:border-slate-900"
                >
                  {plans.length > 0 ? (
                    plans.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name} ({p.code}) — {p.price_kz.toLocaleString('pt-PT')} Kz/mês
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="starter">Starter</option>
                      <option value="business">Business</option>
                      <option value="enterprise">Enterprise</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAssignModal({ open: false, tenantId: '', planCode: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold"
                >
                  Confirmar Alteração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
