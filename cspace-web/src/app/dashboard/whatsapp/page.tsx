'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUI } from '@/components/ui-provider';

interface WhatsAppSession {
  id: string;
  session_name: string;
  phone_number?: string;
  status: 'connected' | 'qr' | 'starting' | 'disconnected';
  qr_code_url?: string;
  last_connected_at?: string;
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

// ─── Modal: Criar Nova Sessão ─────────────────────────────────────────────────
function CreateSessionModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-[slideInUp_0.2s_ease]">
        {/* Ícone */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-slate-900 text-center mb-1">Novo Número WhatsApp</h3>
        <p className="text-xs text-slate-500 text-center mb-6">Dê um nome identificativo a este bot — cada número é independente e tem as suas próprias conversas.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nome do Bot / Número
            </label>
            <input
              type="text"
              autoFocus
              placeholder='Ex: "suporte", "vendas", "principal"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {busy ? 'A criar...' : 'Criar Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function WhatsAppConnectionPage() {
  const { toast, confirm } = useUI();
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySession, setBusySession] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadDbSessions = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/whatsapp/sessions`, { credentials: 'include' });
      if (res.ok) setSessions(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadDbSessions();
    const es = new EventSource(`${GATEWAY_URL}/events`, { withCredentials: true });
    es.addEventListener('update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const sessionName = data.sessionName || 'default';
        setSessions((prev) => {
          const exists = prev.some((s) => s.session_name === sessionName);
          if (!exists) return [...prev, { id: sessionName, session_name: sessionName, status: data.status, qr_code_url: data.qrDataUrl, phone_number: data.phoneNumber }];
          return prev.map((s) =>
            s.session_name === sessionName
              ? { ...s, status: data.status, qr_code_url: data.qrDataUrl ?? (data.status === 'connected' ? undefined : s.qr_code_url), phone_number: data.phoneNumber ?? s.phone_number }
              : s
          );
        });
      } catch (_) {}
    });
    es.onerror = () => {};
    return () => es.close();
  }, [loadDbSessions]);

  const handleDisconnect = (sessionName: string) => {
    confirm({
      title: 'Desligar Número',
      message: `Tem a certeza que deseja desligar "${sessionName}"? Terá de ler um novo QR Code para voltar a ligar.`,
      confirmLabel: 'Sim, desligar',
      danger: true,
      onConfirm: async () => {
        setBusySession(sessionName);
        try {
          const res = await fetch(`${GATEWAY_URL}/api/whatsapp/sessions/disconnect`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ sessionName }),
          });
          if (res.ok) {
            setSessions((prev) => prev.filter((s) => s.session_name !== sessionName));
            toast('success', 'Número desligado', `"${sessionName}" foi removido com sucesso.`);
          } else {
            const data = await res.json().catch(() => ({}));
            toast('error', 'Erro ao desligar', data.error || 'Não foi possível desligar esta sessão.');
          }
        } catch (_) {
          toast('error', 'Erro de rede', 'Não foi possível estabelecer ligação ao servidor.');
        } finally { setBusySession(null); }
      },
    });
  };

  const handleCreateSession = async (name: string) => {
    setAddingNew(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/whatsapp/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ sessionName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        toast('warning', 'Limite atingido', data.error || `Limite de números do seu plano atingido (${data.current}/${data.limit}).`);
        return;
      }
      if (!res.ok) {
        toast('error', 'Erro ao criar', data.error || 'Não foi possível iniciar um novo número.');
        return;
      }
      setSessions((prev) => [...prev, { id: name, session_name: name, status: 'starting' }]);
      toast('success', 'Bot criado!', `"${name}" foi criado. Aponte a câmara ao QR Code para ligar.`);
    } catch (_) {
      toast('error', 'Erro de rede', 'Não foi possível criar o número.');
    } finally { setAddingNew(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Conexão WhatsApp</h1>
          <p className="text-xs text-slate-600">
            Cada número WhatsApp é um bot independente — nunca se mistura com outro número ou empresa.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={addingNew}
          className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar número
        </button>
      </div>

      {loading ? (
        <div className="text-center text-xs text-slate-500 py-12">A carregar sessões...</div>
      ) : sessions.length === 0 ? (
        <div className="dashboard-card rounded-3xl p-10 text-center space-y-4 max-w-lg mx-auto">
          <svg className="w-10 h-10 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-sm text-slate-600">Ainda não tem nenhum número WhatsApp ligado.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-colors"
          >
            Ligar o primeiro número
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions.map((session, index) => (
            <SessionCard
              key={`${session.session_name}-${index}`}
              session={session}
              busy={busySession === session.session_name}
              onDisconnect={() => handleDisconnect(session.session_name)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateSession}
        />
      )}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session, busy, onDisconnect }: { session: WhatsAppSession; busy: boolean; onDisconnect: () => void }) {
  const { status, qr_code_url: qrDataUrl, phone_number: phoneNumber, session_name: sessionName } = session;
  return (
    <div className="dashboard-card rounded-3xl p-6 text-center space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{sessionName}</span>
        {status === 'connected' && (
          <span className="px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" /> Conectado
          </span>
        )}
        {status === 'qr' && (
          <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider">Aguardando QR</span>
        )}
        {(status === 'starting' || status === 'disconnected') && (
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
            {status === 'starting' ? 'A iniciar...' : 'Desconectado'}
          </span>
        )}
      </div>

      <div className="w-full aspect-square max-w-[220px] mx-auto bg-white rounded-2xl p-4 flex items-center justify-center border border-slate-200 shadow-inner">
        {status === 'connected' ? (
          <div className="text-center space-y-2">
            <svg className="w-12 h-12 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="font-extrabold text-slate-900 text-xs">WhatsApp Ativo</div>
            {phoneNumber && <div className="text-[10px] font-mono text-slate-600">+{phoneNumber}</div>}
          </div>
        ) : qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR Code — ${sessionName}`} className="w-full h-full object-contain rounded-lg" />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-medium text-slate-600">A gerar QR Code...</span>
          </div>
        )}
      </div>

      {status === 'connected' && (
        <button
          onClick={onDisconnect}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {busy ? 'A desligar...' : 'Desconectar'}
        </button>
      )}
    </div>
  );
}
