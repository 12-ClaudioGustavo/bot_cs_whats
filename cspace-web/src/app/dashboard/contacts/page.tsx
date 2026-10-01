'use client';

import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  phone: string;
  company?: string;
  last_contact_at?: string;
}

interface Message {
  id: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  message_type?: string;
  created_at: string;
}

export default function ContactsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal de Histórico de Conversa
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch(`${API_URL}/api/clients`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setClients(data);
        }
      } catch (_) {
      } finally {
        setLoading(false);
      }
    }
    loadClients();
  }, []);

  const handleOpenChat = async (client: Client) => {
    setSelectedClient(client);
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_URL}/api/conversations/${client.phone}`, {
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

  const filteredClients = clients.filter(
    (c) =>
      (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search)) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Gestão de Contactos</h1>
          <p className="text-xs text-slate-600">Lista de clientes capturados automaticamente pelo bot do WhatsApp</p>
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Pesquisar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">Lista de Clientes Registados</div>
          <span className="text-xs text-slate-900 font-semibold bg-slate-100 px-3 py-1 rounded-full">
            {filteredClients.length} Registados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase font-bold text-[10px] text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Número WhatsApp</th>
                <th className="p-4">Empresa / Organização</th>
                <th className="p-4">Último Contacto</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    A carregar contactos...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Nenhum contacto capturado até ao momento.
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {(c.name || 'C')[0].toUpperCase()}
                      </div>
                      <span>{c.name || 'Cliente Sem Nome'}</span>
                    </td>
                    <td className="p-4 font-mono text-slate-600">+{c.phone}</td>
                    <td className="p-4 text-slate-700">{c.company || 'Particular'}</td>
                    <td className="p-4 text-slate-500">
                      {c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString('pt-PT') : 'Recente'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenChat(c)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs border border-emerald-200 transition-colors inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Ver Conversa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Histórico da Conversa */}
      {selectedClient && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedClient(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-[slideInUp_0.2s_ease]">
            {/* Header do Chat */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                  {(selectedClient.name || 'C')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">{selectedClient.name || 'Cliente WhatsApp'}</h3>
                  <p className="text-[11px] text-slate-300 font-mono">+{selectedClient.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mensagens do Chat estilo WhatsApp */}
            <div className="flex-1 p-6 overflow-y-auto bg-[#efeae2] space-y-3 min-h-[300px]">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-xs font-semibold gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  A carregar mensagens da conversa...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Nenhuma mensagem registada com este cliente ainda.
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

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Histórico completo sincronizado com a base de dados</span>
              <button
                onClick={() => setSelectedClient(null)}
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
