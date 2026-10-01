'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  position?: string;
  createdAt: string;
  updatedAt?: string;
}

interface AuditLog {
  action: string;
  category: string;
  created_at: string;
  details: Record<string, unknown>;
  ip_address: string;
}

interface SystemMetrics {
  totalTenants: number;
  totalUsers: number;
  activeSessions: number;
}

type TabType = 'overview' | 'security' | 'activity';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'bg-slate-200' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Muito fraca', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Fraca', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Média', color: 'bg-yellow-500' };
  if (score === 4) return { score, label: 'Forte', color: 'bg-green-500' };
  return { score, label: 'Muito forte', color: 'bg-emerald-500' };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getCategoryBadge(category: string) {
  const map: Record<string, { label: string; cls: string }> = {
    auth: { label: 'Auth', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    security: { label: 'Segurança', cls: 'bg-red-100 text-red-700 border-red-200' },
    system: { label: 'Sistema', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    tenant: { label: 'Tenant', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    billing: { label: 'Billing', cls: 'bg-green-100 text-green-700 border-green-200' },
    session: { label: 'Sessão', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  };
  const b = map[category] || { label: category, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.cls}`}>
      {b.label}
    </span>
  );
}

export default function AdminProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [uptime, setUptime] = useState<number>(0);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Edição
  const [editing, setEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPwd, setChangingPwd] = useState(false);

  const pwdStrength = getPasswordStrength(newPassword);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setMetrics(data.systemMetrics);
        setUptime(data.systemUptime || 0);
        setLogs(data.recentActivity || []);
        if (data.user) {
          setEditFullName(data.user.fullName || '');
          setEditPhone(data.user.phone || '');
          setEditBio(data.user.bio || '');
        }
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editFullName, phone: editPhone, bio: editBio }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        setEditing(false);
        loadProfile();
      } else {
        setSaveMsg({ type: 'error', text: data.error || 'Erro ao atualizar perfil.' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Erro de ligação ao servidor.' });
    } finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'A confirmação de palavra-passe não coincide.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: 'error', text: 'A palavra-passe deve ter pelo menos 8 caracteres.' });
      return;
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
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdMsg({ type: 'error', text: data.error || 'Erro ao alterar palavra-passe.' });
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
          <span className="text-sm text-slate-500 font-medium">A carregar perfil...</span>
        </div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: 'Visão Geral', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'security', label: 'Segurança', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { key: 'activity', label: 'Atividade Recente', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ];

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrador',
    owner: 'Proprietário',
    agent: 'Agente',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Meu Perfil Admin</h1>
        <p className="text-xs text-slate-500">Gestão das suas informações de administrador e segurança da conta</p>
      </div>

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-lg ring-4 ring-white/20">
              {(user?.fullName || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">{user?.fullName || 'Administrador'}</h2>
            <p className="text-slate-300 text-sm mt-0.5">{user?.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold backdrop-blur-sm">
                <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {roleLabel[user?.role || ''] || user?.role}
              </span>
              {user?.phone && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs">
                  <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {user.phone}
                </span>
              )}
              {user?.createdAt && (
                <span className="text-xs text-slate-400">
                  Membro desde {new Date(user.createdAt).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sistema metrics pills */}
        {metrics && (
          <div className="relative mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Empresas', value: metrics.totalTenants, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'text-indigo-300' },
              { label: 'Utilizadores', value: metrics.totalUsers, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'text-blue-300' },
              { label: 'Sessões Ativas', value: metrics.activeSessions, icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', color: 'text-green-300' },
              { label: 'Uptime', value: formatUptime(uptime), icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-yellow-300' },
            ].map((m) => (
              <div key={m.label} className="text-center bg-white/5 p-3 rounded-xl border border-white/10">
                <svg className={`w-5 h-5 mx-auto mb-1 ${m.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.icon} />
                </svg>
                <div className="text-xl font-black text-white">{m.value}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
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

      {/* Tab: Visão Geral */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Informações Pessoais</h3>
              <button
                onClick={() => setEditing(!editing)}
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
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome Completo</label>
                {editing ? (
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Nome completo"
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-900 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60">{user?.fullName || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail</label>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-200/60">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {user?.email || '—'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Protegido
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span>🔒 O e-mail é a sua chave de acesso e não pode ser alterado.</span>
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefone</label>
                {editing ? (
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="+244 9xx xxx xxx"
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-900 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60">{user?.phone || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role / Permissão</label>
                <div className="px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200">
                      {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Administrador' : 'Agente'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bio / Descrição</label>
                {editing ? (
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                    placeholder="Escreva uma breve descrição sobre si..."
                  />
                ) : (
                  <p className="text-sm text-slate-700 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    {user?.bio || <span className="text-slate-400 italic">Nenhuma descrição adicionada. Clique em "Editar" para adicionar uma bio.</span>}
                  </p>
                )}
              </div>
            </div>
            {editing && (
              <div className="px-6 pb-6">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-all"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'A guardar...' : 'Guardar Alterações'}
                </button>
              </div>
            )}
          </div>
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Alterar Palavra-Passe</span>
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Palavra-passe Atual</label>
                <div className="relative">
                  <input
                    type={showCurrentPwd ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                  >
                    {showCurrentPwd ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nova Palavra-passe</label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                  >
                    {showNewPwd ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Força:</span>
                      <span className="font-bold text-slate-700">{pwdStrength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${pwdStrength.color} transition-all duration-300`} style={{ width: `${(pwdStrength.score / 5) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Confirmar Nova Palavra-passe</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={changingPwd}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {changingPwd && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {changingPwd ? 'A alterar...' : 'Alterar Palavra-passe'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Atividade Recente */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Histórico de Atividades Recentes</h3>
          </div>
          {/* Mobile view */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">Sem atividades registadas.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    {getCategoryBadge(log.category)}
                    <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="font-mono text-xs text-slate-800 font-bold">{log.action}</div>
                  {log.ip_address && <div className="text-[10px] text-slate-500 font-mono">IP: {log.ip_address}</div>}
                </div>
              ))
            )}
          </div>
          {/* Desktop view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Ação</th>
                  <th className="p-4">IP</th>
                  <th className="p-4">Data & Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">Sem registos de atividade recente.</td>
                  </tr>
                ) : (
                  logs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">{getCategoryBadge(log.category)}</td>
                      <td className="p-4 font-mono text-slate-800 font-semibold">{log.action}</td>
                      <td className="p-4 font-mono text-slate-500">{log.ip_address || '—'}</td>
                      <td className="p-4 text-slate-500">{formatDate(log.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
