'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface Conversation {
  id: string;
  client_id: string;
  phone: string;
  status: string;
  last_message: string;
  created_at: string;
  clients?: {
    name?: string;
    phone?: string;
    company?: string;
  };
}

interface Message {
  id: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  message_type?: string;
  created_at: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Chat
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch(`${API_URL}/api/conversations`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (_) {
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, []);

  const handleOpenChat = async (phone: string, name: string) => {
    setSelectedPhone(phone);
    setClientName(name);
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_URL}/api/conversations/${phone}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else {
        setMessages([]);
      }
    } catch (_) {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Live Chat & Conversas</h1>
        <p className="text-xs text-slate-600">Histórico de conversas em tempo real do WhatsApp da sua empresa</p>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Conversas Recentes</div>
          <span className="text-xs text-slate-900 font-semibold bg-slate-100 px-3 py-1 rounded-full">{conversations.length} Registadas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Última Mensagem</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Data</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    A carregar conversas...
                  </td>
                </tr>
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Nenhuma conversa registada até ao momento.
                  </td>
                </tr>
              ) : (
                conversations.map((conv) => {
                  const phone = conv.clients?.phone || conv.phone || '';
                  const name = conv.clients?.name || 'Cliente WhatsApp';
                  return (
                    <tr
                      key={conv.id}
                      onClick={() => phone && handleOpenChat(phone, name)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {name[0].toUpperCase()}
                        </div>
                        <span>{name}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-600">+{phone}</td>
                      <td className="p-4 text-slate-700 max-w-xs truncate">{conv.last_message || '—'}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 font-bold text-[10px]">
                          {conv.status || 'bot_active'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {new Date(conv.created_at).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (phone) handleOpenChat(phone, name);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs border border-emerald-200 transition-colors inline-flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                          Abrir Chat
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

      {/* Modal de Conversa Completa */}
      {selectedPhone && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPhone(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-[slideInUp_0.2s_ease]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                  {clientName[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">{clientName}</h3>
                  <p className="text-[11px] text-slate-300 font-mono">+{selectedPhone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPhone(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-[#efeae2] space-y-3 min-h-[300px]">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-xs font-semibold gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  A carregar mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Nenhuma mensagem registada.
                </div>
              ) : (
                messages.map((m) => {
                  const isIncoming = m.direction === 'incoming';
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm text-xs leading-relaxed ${
                          isIncoming
                            ? 'bg-white text-slate-900 rounded-tl-none'
                            : 'bg-emerald-600 text-white rounded-tr-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.message}</p>
                        <span
                          className={`text-[9px] block text-right mt-1 font-mono ${
                            isIncoming ? 'text-slate-400' : 'text-emerald-100'
                          }`}
                        >
                          {new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Histórico de mensagens em tempo real</span>
              <button
                onClick={() => setSelectedPhone(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors"
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
