'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  position?: string;
  createdAt: string;
}

interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  status: string;
  type: 'company' | 'personal';
  nif?: string;
  sector?: string;
  address?: string;
  city?: string;
  website?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
}

interface SubscriptionInfo {
  status: string;
  periodEnd: string;
  plan?: {
    code: string;
    name: string;
    price_kz: number;
    max_whatsapp_accounts: number;
    monthly_message_limit: number;
    max_users: number;
  };
}

type TabType = 'personal' | 'company' | 'plan' | 'security';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getPasswordStrength(pwd: string) {
  if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (s <= 1) return { score: s, label: 'Muito fraca', color: 'bg-red-500' };
  if (s === 2) return { score: s, label: 'Fraca', color: 'bg-orange-500' };
  if (s === 3) return { score: s, label: 'Média', color: 'bg-yellow-500' };
  if (s === 4) return { score: s, label: 'Forte', color: 'bg-green-500' };
  return { score: s, label: 'Muito forte', color: 'bg-emerald-500' };
}

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  agent: 'Agente',
  super_admin: 'Super Admin',
};

const sectorOptions = [
  'Tecnologia & TI', 'Saúde & Medicina', 'Educação', 'Finanças & Contabilidade',
  'Comércio & Retalho', 'Construção & Imobiliário', 'Alimentação & Restauração',
  'Transporte & Logística', 'Marketing & Publicidade', 'Consultoria', 'Outro',
];

const planColors: Record<string, { bg: string; text: string; border: string }> = {
  free: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  starter: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  business: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
  enterprise: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
};

// ─── FieldGroup component ────────────────────────────────────────────────────
function Field({
  label, value, editing, onChange, type = 'text', placeholder = '', readOnly = false, children
}: {
  label: string; value: string; editing: boolean;
  onChange?: (v: string) => void; type?: string;
  placeholder?: string; readOnly?: boolean; children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {editing && !readOnly ? (
        children ? children : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
          />
        )
      ) : (
        <p className="text-sm font-medium text-slate-900 px-4 py-2.5 bg-slate-50 rounded-xl min-h-[42px] flex items-center">
          {value || <span className="text-slate-400">—</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DashboardProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  // Edição — dados pessoais
  const [editing, setEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPosition, setEditPosition] = useState('');

  // Edição — dados empresa
  const [editTenantName, setEditTenantName] = useState('');
  const [editTenantNif, setEditTenantNif] = useState('');
  const [editTenantSector, setEditTenantSector] = useState('');
  const [editTenantAddress, setEditTenantAddress] = useState('');
  const [editTenantCity, setEditTenantCity] = useState('');
  const [editTenantWebsite, setEditTenantWebsite] = useState('');
  const [editTenantContactPhone, setEditTenantContactPhone] = useState('');
  const [editTenantContactEmail, setEditTenantContactEmail] = useState('');
  const [editTenantType, setEditTenantType] = useState<'company' | 'personal'>('company');

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showCurrPwd, setShowCurrPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pwdStrength = getPasswordStrength(newPassword);
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin';

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setTenant(data.tenant);
        setSubscription(data.subscription);
        if (data.user) {
          setEditFullName(data.user.fullName || '');
          setEditPhone(data.user.phone || '');
          setEditBio(data.user.bio || '');
          setEditPosition(data.user.position || '');
        }
        if (data.tenant) {
          setEditTenantName(data.tenant.name || '');
          setEditTenantNif(data.tenant.nif || '');
          setEditTenantSector(data.tenant.sector || '');
          setEditTenantAddress(data.tenant.address || '');
          setEditTenantCity(data.tenant.city || '');
          setEditTenantWebsite(data.tenant.website || '');
          setEditTenantContactPhone(data.tenant.contactPhone || '');
          setEditTenantContactEmail(data.tenant.contactEmail || '');
          setEditTenantType(data.tenant.type || 'company');
        }
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        fullName: editFullName,
        phone: editPhone,
        bio: editBio,
        position: editPosition,
      };
      if (isOwnerOrAdmin) {
        Object.assign(body, {
          tenantName: editTenantName,
          tenantNif: editTenantNif,
          tenantSector: editTenantSector,
          tenantAddress: editTenantAddress,
          tenantCity: editTenantCity,
          tenantWebsite: editTenantWebsite,
          tenantContactPhone: editTenantContactPhone,
          tenantContactEmail: editTenantContactEmail,
          tenantType: editTenantType,
        });
      }
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        setEditing(false);
        loadProfile();
      } else {
        setSaveMsg({ type: 'error', text: data.error || 'Erro ao atualizar.' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Erro de ligação ao servidor.' });
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Preencha todos os campos.' }); return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'As palavras-passe não coincidem.' }); return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: 'error', text: 'Mínimo 8 caracteres.' }); return;
    }
    setChangingPwd(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdMsg({ type: 'success', text: 'Palavra-passe alterada com sucesso!' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        setPwdMsg({ type: 'error', text: data.error || 'Erro ao alterar.' });
      }
    } catch {
      setPwdMsg({ type: 'error', text: 'Erro de ligação ao servidor.' });
    } finally { setChangingPwd(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">A carregar perfil...</span>
        </div>
      </div>
    );
  }

  const accountType = editTenantType === 'personal' ? 'personal' : 'company';

  // Tabs dinâmicas conforme tipo de conta
  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'personal', label: 'Perfil Pessoal', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    ...(accountType === 'company' ? [
      { key: 'company' as TabType, label: 'Dados da Empresa', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ] : []),
    { key: 'plan', label: accountType === 'company' ? 'Plano & Equipa' : 'Plano Pessoal', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { key: 'security', label: 'Segurança', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  ];

  const plan = subscription?.plan;
  const planTheme = planColors[plan?.code || 'free'] || planColors.free;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Meu Perfil</h1>
        <p className="text-xs text-slate-500">Gerencie as informações da sua conta e da sua {accountType === 'company' ? 'empresa' : 'conta pessoal'}</p>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`h-24 ${accountType === 'company' ? 'bg-gradient-to-r from-slate-900 to-slate-700' : 'bg-gradient-to-r from-indigo-600 to-violet-600'}`} />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-10 text-center sm:text-left">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg ring-4 ring-white flex-shrink-0 ${accountType === 'company' ? 'bg-slate-900' : 'bg-gradient-to-br from-indigo-500 to-violet-600'}`}>
              {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white mix-blend-difference">{user?.fullName || 'Utilizador'}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  accountType === 'company' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}>
                  {roleLabels[user?.role || ''] || user?.role}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{user?.email}</p>
              {user?.position && <p className="text-xs text-slate-400 mt-0.5">{user.position} · {tenant?.name}</p>}
            </div>

            {/* Tipo de conta toggle (só owner/admin) */}
            {isOwnerOrAdmin && (
              <div className="pb-1">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setEditTenantType('company')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${accountType === 'company' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                    </svg>
                    Empresa
                  </button>
                  <button
                    onClick={() => setEditTenantType('personal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${accountType === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Pessoal
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Plano badge inline */}
          {plan && (
            <div className="mt-4 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${planTheme.bg} ${planTheme.text} ${planTheme.border}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {plan.name}
              </span>
              <span className="text-xs text-slate-400">
                {subscription?.periodEnd ? `Válido até ${new Date(subscription.periodEnd).toLocaleDateString('pt-PT')}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Save Message */}
      {saveMsg && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
          saveMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={saveMsg.type === 'success' ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
          {saveMsg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSaveMsg(null); }}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Perfil Pessoal */}
      {activeTab === 'personal' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900">Informações Pessoais</h3>
              <p className="text-xs text-slate-500 mt-0.5">Os seus dados de contacto e apresentação</p>
            </div>
            <button
              onClick={() => { setEditing(!editing); setSaveMsg(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                editing ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={editing ? 'M6 18L18 6M6 6l12 12' : 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'} />
              </svg>
              {editing ? 'Cancelar' : 'Editar'}
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome Completo" value={editFullName} editing={editing} onChange={setEditFullName} placeholder="Nome completo" />
            <Field label="E-mail" value={user?.email || ''} editing={false} onChange={() => {}} readOnly />
            <Field label={accountType === 'company' ? 'Telefone Pessoal / WhatsApp' : 'WhatsApp Pessoal'} value={editPhone} editing={editing} onChange={setEditPhone} placeholder="+244 9xx xxx xxx" type="tel" />
            <Field label="Cargo / Função" value={editPosition} editing={editing} onChange={setEditPosition}
              placeholder={accountType === 'company' ? 'Ex: Director de Vendas, Agente de Suporte...' : 'Ex: Freelancer, Consultor...'} />
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {accountType === 'company' ? 'Bio / Apresentação' : 'Sobre Mim'}
              </label>
              {editing ? (
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  placeholder={accountType === 'company' ? 'Breve apresentação profissional...' : 'Fale um pouco sobre você, seus serviços...'}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all resize-none"
                />
              ) : (
                <p className="text-sm text-slate-700 px-4 py-2.5 bg-slate-50 rounded-xl min-h-[72px]">
                  {editBio || <span className="text-slate-400">Nenhuma bio definida</span>}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Membro desde</label>
              <p className="text-sm font-medium text-slate-700 px-4 py-2.5 bg-slate-50 rounded-xl">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role na Plataforma</label>
              <p className="text-sm font-medium text-slate-700 px-4 py-2.5 bg-slate-50 rounded-xl flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                  {roleLabels[user?.role || ''] || user?.role}
                </span>
              </p>
            </div>
          </div>
          {editing && (
            <div className="px-6 pb-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {saving ? 'A guardar...' : 'Guardar Alterações'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Dados da Empresa */}
      {activeTab === 'company' && accountType === 'company' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900">Dados da Empresa</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOwnerOrAdmin ? 'Informações comerciais e de contacto da sua empresa' : 'Dados da empresa (apenas proprietários e administradores podem editar)'}
              </p>
            </div>
            {isOwnerOrAdmin && (
              <button
                onClick={() => { setEditing(!editing); setSaveMsg(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  editing ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={editing ? 'M6 18L18 6M6 6l12 12' : 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'} />
                </svg>
                {editing ? 'Cancelar' : 'Editar'}
              </button>
            )}
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Razão Social / Nome da Empresa" value={editTenantName} editing={editing && isOwnerOrAdmin} onChange={setEditTenantName} placeholder="Nome da empresa" />
            <Field label="NIF / NIPC" value={editTenantNif} editing={editing && isOwnerOrAdmin} onChange={setEditTenantNif} placeholder="000000000" />
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sector de Actividade</label>
              {editing && isOwnerOrAdmin ? (
                <select
                  value={editTenantSector}
                  onChange={(e) => setEditTenantSector(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all bg-white"
                >
                  <option value="">Selecionar sector...</option>
                  {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium text-slate-900 px-4 py-2.5 bg-slate-50 rounded-xl">
                  {editTenantSector || <span className="text-slate-400">—</span>}
                </p>
              )}
            </div>
            <Field label="Website" value={editTenantWebsite} editing={editing && isOwnerOrAdmin} onChange={setEditTenantWebsite} placeholder="https://www.empresa.ao" type="url" />
            <Field label="Morada / Endereço" value={editTenantAddress} editing={editing && isOwnerOrAdmin} onChange={setEditTenantAddress} placeholder="Rua, nº, bairro..." />
            <Field label="Cidade / Município" value={editTenantCity} editing={editing && isOwnerOrAdmin} onChange={setEditTenantCity} placeholder="Ex: Luanda, Huambo..." />
            <Field label="Telefone de Contacto Geral" value={editTenantContactPhone} editing={editing && isOwnerOrAdmin} onChange={setEditTenantContactPhone} placeholder="+244 2xx xxx xxx" type="tel" />
            <Field label="E-mail de Suporte / Geral" value={editTenantContactEmail} editing={editing && isOwnerOrAdmin} onChange={setEditTenantContactEmail} placeholder="suporte@empresa.ao" type="email" />
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Slug / Identificador</label>
              <p className="text-sm font-mono text-slate-600 px-4 py-2.5 bg-slate-50 rounded-xl">{tenant?.slug || '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status da Conta</label>
              <p className="text-sm font-medium text-slate-900 px-4 py-2.5 bg-slate-50 rounded-xl flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${tenant?.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                {tenant?.status === 'active' ? 'Ativa' : 'Suspensa / Pendente'}
              </p>
            </div>
          </div>
          {editing && isOwnerOrAdmin && (
            <div className="px-6 pb-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {saving ? 'A guardar...' : 'Guardar Dados da Empresa'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Plano */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          {plan ? (
            <>
              <div className={`rounded-2xl border p-6 ${planTheme.bg} ${planTheme.border}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg className={`w-5 h-5 ${planTheme.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <h3 className={`text-lg font-black ${planTheme.text}`}>{plan.name}</h3>
                    </div>
                    <p className={`text-sm ${planTheme.text} opacity-70`}>
                      {subscription?.periodEnd ? `Válido até ${new Date(subscription.periodEnd).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}` : 'Plano ativo'}
                    </p>
                  </div>
                  <div className={`text-right`}>
                    <div className={`text-2xl font-black ${planTheme.text}`}>
                      {plan.price_kz > 0 ? `${plan.price_kz.toLocaleString('pt-PT')} Kz` : 'Gratuito'}
                    </div>
                    {plan.price_kz > 0 && <div className={`text-xs ${planTheme.text} opacity-60`}>/mês</div>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: accountType === 'company' ? 'Nº WhatsApp' : 'WhatsApp Pessoal', value: plan.max_whatsapp_accounts, icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' },
                  { label: 'Mensagens/mês', value: plan.monthly_message_limit.toLocaleString('pt-PT'), icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                  { label: accountType === 'company' ? 'Utilizadores da Equipa' : 'Utilizadores', value: plan.max_users, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                ].map((metric) => (
                  <div key={metric.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-sm">
                    <svg className="w-6 h-6 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metric.icon} />
                    </svg>
                    <div className="text-2xl font-black text-slate-900">{metric.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{metric.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Precisa de mais recursos?</p>
                  <p className="text-xs text-slate-500 mt-0.5">Faça upgrade do seu plano para desbloquear mais mensagens, número e utilizadores.</p>
                </div>
                <a href="/dashboard/billing" className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Fazer Upgrade
                </a>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-sm font-semibold text-slate-700">Sem plano ativo</p>
              <p className="text-xs text-slate-400 mt-1">Ative um plano para desbloquear todas as funcionalidades</p>
              <a href="/dashboard/billing" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all">
                Ver Planos Disponíveis
              </a>
            </div>
          )}
        </div>
      )}

      {/* Tab: Segurança */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          {pwdMsg && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
              pwdMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={pwdMsg.type === 'success' ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
              </svg>
              {pwdMsg.text}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Alterar Palavra-passe</h3>
              <p className="text-xs text-slate-500 mt-0.5">Use uma senha forte com pelo menos 8 caracteres, letras maiúsculas, números e símbolos.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Palavra-passe Atual</label>
                <div className="relative">
                  <input
                    type={showCurrPwd ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCurrPwd(!showCurrPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showCurrPwd ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'} />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nova Palavra-passe</label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showNewPwd ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'} />
                    </svg>
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= pwdStrength.score ? pwdStrength.color : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Força: <span className="font-semibold text-slate-700">{pwdStrength.label}</span></p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar Nova Palavra-passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all ${
                    confirmPassword && newPassword !== confirmPassword ? 'border-red-300 bg-red-50' : 'border-slate-300'
                  }`}
                  placeholder="••••••••"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">As palavras-passe não coincidem</p>
                )}
              </div>
              <button
                onClick={handleChangePassword}
                disabled={changingPwd}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                {changingPwd ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                )}
                {changingPwd ? 'A alterar...' : 'Alterar Palavra-passe'}
              </button>
            </div>
          </div>

          {/* Sessão atual info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="font-bold text-slate-900 mb-3">Sessão Atual</h4>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1m-1 4v-4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Navegador Web</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  Sessão ativa — acesso seguro via HTTPS
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
