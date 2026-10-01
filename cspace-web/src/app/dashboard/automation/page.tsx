'use client';

import { useState, useEffect } from 'react';
import { useUI } from '@/components/ui-provider';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

// ─── Types ─────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  trigger: string;
  response: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
  price?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sort_order?: number;
}

interface BotConfig {
  welcomeMsg: string;
  aboutMsg: string;
  fallbackMsg: string;
  outOfHoursMsg: string;
  menuItems: MenuItem[];
  services: Service[];
  faqs: FAQ[];
}

const defaultConfig: BotConfig = {
  welcomeMsg: 'Olá! Seja bem-vindo(a) à nossa empresa. Como podemos ajudar hoje?\n\nEscreva o número da opção desejada:',
  aboutMsg: 'Somos uma empresa dedicada a oferecer os melhores produtos e serviços com qualidade, agilidade e excelente atendimento.',
  fallbackMsg: 'Não compreendi a sua mensagem. Por favor, escolha uma das opções disponíveis ou escreva "menu" para ver as opções.',
  outOfHoursMsg: 'Estamos fora do nosso horário de atendimento. Deixe a sua mensagem e responderemos assim que possível.',
  menuItems: [],
  services: [],
  faqs: [],
};

// ─── Tabs ────────────────────────────────────────────────────────────────────
type Tab = 'messages' | 'about' | 'menu' | 'services' | 'faq';

// ─── MenuItem Modal ──────────────────────────────────────────────────────────
function MenuItemModal({
  item,
  onSave,
  onClose,
}: {
  item: MenuItem | null;
  onSave: (item: MenuItem) => void;
  onClose: () => void;
}) {
  const [trigger, setTrigger] = useState(item?.trigger || '');
  const [response, setResponse] = useState(item?.response || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !response.trim()) return;
    onSave({ id: item?.id || Math.random().toString(36).slice(2), trigger: trigger.trim(), response: response.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg animate-[slideInUp_0.2s_ease]">
        <h3 className="text-lg font-black text-slate-900 mb-1">{item ? 'Editar Resposta' : 'Nova Resposta do Bot'}</h3>
        <p className="text-xs text-slate-500 mb-6">Configure a palavra-chave que ativa a resposta e o texto que o bot enviará.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Palavra-chave / Gatilho</label>
            <input
              type="text"
              autoFocus
              placeholder='Ex: "1", "suporte", "preço"'
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">O bot responde quando o cliente enviar exatamente esta palavra ou número.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Resposta do Bot</label>
            <textarea
              rows={5}
              placeholder="Digite a mensagem que o bot enviará automaticamente..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!trigger.trim() || !response.trim()} className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors disabled:opacity-40">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Service Modal ───────────────────────────────────────────────────────────
function ServiceModal({
  service,
  onSave,
  onClose,
}: {
  service: Service | null;
  onSave: (s: Service) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: service?.id || Math.random().toString(36).slice(2), name: name.trim(), description: description.trim(), price: price.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg animate-[slideInUp_0.2s_ease]">
        <h3 className="text-lg font-black text-slate-900 mb-1">{service ? 'Editar Serviço / Produto' : 'Novo Serviço / Produto'}</h3>
        <p className="text-xs text-slate-500 mb-6">Os serviços e produtos configurados aqui são apresentados no menu do bot para reservas ou consultas.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nome do Serviço ou Produto</label>
            <input
              autoFocus
              type="text"
              placeholder='Ex: "Consultoria em TI" ou "Produto X"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Descrição</label>
            <textarea
              rows={3}
              placeholder="Descreva o serviço ou produto brevemente..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Preço (opcional)</label>
            <input
              type="text"
              placeholder='Ex: "50.000 Kz" ou "Sob Consulta"'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!name.trim()} className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors disabled:opacity-40">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── FAQ Modal ──────────────────────────────────────────────────────────────
function FaqModal({
  faq,
  onSave,
  onClose,
}: {
  faq: FAQ | null;
  onSave: (f: FAQ) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onSave({
      id: faq?.id || Math.random().toString(36).slice(2),
      question: question.trim(),
      answer: answer.trim(),
      sort_order: faq?.sort_order || 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg animate-[slideInUp_0.2s_ease]">
        <h3 className="text-lg font-black text-slate-900 mb-1">{faq ? 'Editar Pergunta Frequente' : 'Nova Pergunta Frequente'}</h3>
        <p className="text-xs text-slate-500 mb-6">Cadastre dúvidas recorrentes dos seus clientes e as respostas automáticas do bot.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Pergunta / Dúvida do Cliente</label>
            <input
              autoFocus
              type="text"
              placeholder='Ex: "Quais são as formas de pagamento?"'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Resposta Detalhada</label>
            <textarea
              rows={5}
              placeholder="Escreva a resposta clara e completa que o bot enviará..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!question.trim() || !answer.trim()} className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors disabled:opacity-40">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AutomationPage() {
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<Tab>('messages');
  const [config, setConfig] = useState<BotConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [menuModal, setMenuModal] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null });
  const [serviceModal, setServiceModal] = useState<{ open: boolean; service: Service | null }>({ open: false, service: null });
  const [faqModal, setFaqModal] = useState<{ open: boolean; faq: FAQ | null }>({ open: false, faq: null });

  // Carregar configuração
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${GATEWAY_URL}/api/bot/config`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setConfig({ ...defaultConfig, ...data });
        }
      } catch (_) {} finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/bot/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast('success', 'Configurações guardadas!', 'O bot foi atualizado com as novas definições.');
      } else {
        const data = await res.json().catch(() => ({}));
        toast('error', 'Erro ao guardar', data.error || 'Não foi possível guardar as alterações.');
      }
    } catch (_) {
      toast('error', 'Erro de rede', 'Não foi possível comunicar com o servidor.');
    } finally { setSaving(false); }
  };

  const handleDeleteMenuItem = (id: string) => {
    confirm({
      title: 'Remover Resposta',
      message: 'Tem a certeza que deseja remover esta resposta automática?',
      confirmLabel: 'Remover',
      danger: true,
      onConfirm: () => {
        setConfig((prev) => ({ ...prev, menuItems: prev.menuItems.filter((m) => m.id !== id) }));
        toast('info', 'Resposta removida');
      },
    });
  };

  const handleDeleteService = (id: string) => {
    confirm({
      title: 'Remover Serviço',
      message: 'Tem a certeza que deseja remover este serviço?',
      confirmLabel: 'Remover',
      danger: true,
      onConfirm: () => {
        setConfig((prev) => ({ ...prev, services: prev.services.filter((s) => s.id !== id) }));
        toast('info', 'Serviço removido');
      },
    });
  };

  const handleDeleteFaq = (id: string) => {
    confirm({
      title: 'Remover FAQ',
      message: 'Tem a certeza que deseja remover esta pergunta frequente?',
      confirmLabel: 'Remover',
      danger: true,
      onConfirm: () => {
        setConfig((prev) => ({ ...prev, faqs: prev.faqs.filter((f) => f.id !== id) }));
        toast('info', 'FAQ removida');
      },
    });
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'messages',
      label: 'Mensagens & Boas-Vindas',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    },
    {
      key: 'about',
      label: 'Apresentação da Empresa',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4m-4 0v4m4-4v4" /></svg>,
    },
    {
      key: 'menu',
      label: 'Respostas Automáticas',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    },
    {
      key: 'services',
      label: 'Serviços & Reservas',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    },
    {
      key: 'faq',
      label: 'Perguntas Frequentes (FAQ)',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Automação & Treino do Bot</h1>
          <p className="text-xs text-slate-600">Configure a apresentação da empresa, catálogo de serviços, reservas e perguntas frequentes (FAQ) que o seu bot WhatsApp vai apresentar</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {saving ? 'A guardar...' : 'Guardar Alterações'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-0 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 -mb-px ${
              tab === t.key
                ? 'border-slate-900 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Mensagens ──────────────────────────────────────── */}
      {tab === 'messages' && (
        <div className="dashboard-card space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mensagem de Boas-Vindas
            </label>
            <textarea
              rows={5}
              value={config.welcomeMsg}
              onChange={(e) => setConfig((p) => ({ ...p, welcomeMsg: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Enviada automaticamente quando um novo cliente envia mensagem ao bot.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mensagem de Fallback (Opção Inválida)
            </label>
            <textarea
              rows={3}
              value={config.fallbackMsg}
              onChange={(e) => setConfig((p) => ({ ...p, fallbackMsg: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Enviada quando o cliente escreve algo que o bot não reconhece.</p>
          </div>

          {/* Preview */}
          <div className="bg-[#e5ddd5] rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Pré-visualização no WhatsApp</p>
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm max-w-xs">
                <p className="text-xs text-slate-900 whitespace-pre-wrap">{config.welcomeMsg}</p>
                <p className="text-[10px] text-slate-400 text-right mt-1">agora</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Apresentação da Empresa ────────────────────────── */}
      {tab === 'about' && (
        <div className="dashboard-card space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Breve Apresentação da Empresa (Sobre Nós)
            </label>
            <textarea
              rows={6}
              value={config.aboutMsg}
              onChange={(e) => setConfig((p) => ({ ...p, aboutMsg: e.target.value }))}
              placeholder="Descreva a história, missão e diferencial da sua empresa..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Esta apresentação é exibida quando o cliente escolhe a opção "1. Sobre a Empresa" no menu.</p>
          </div>

          {/* Preview da Apresentação */}
          <div className="bg-[#e5ddd5] rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Exemplo no WhatsApp ao Selecionar Opção "1"</p>
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm max-w-sm">
                <p className="text-xs text-slate-900 whitespace-pre-wrap">
                  🏢 *Sobre a Nossa Empresa*{"\n\n"}
                  {config.aboutMsg}
                </p>
                <p className="text-[10px] text-slate-400 text-right mt-1">agora</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Respostas Automáticas ──────────────────────────── */}
      {tab === 'menu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Configure os gatilhos (palavras-chave) e as respostas automáticas do bot. Quando um cliente enviar uma das palavras-chave, o bot responde automaticamente.
            </p>
            <button
              onClick={() => setMenuModal({ open: true, item: null })}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-colors whitespace-nowrap ml-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Resposta
            </button>
          </div>

          {config.menuItems.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3">
              <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <p className="text-sm font-bold text-slate-400">Nenhuma resposta automática configurada</p>
              <p className="text-xs text-slate-400">Adicione as opções do menu do bot e as respostas para cada uma.</p>
              <button
                onClick={() => setMenuModal({ open: true, item: null })}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-2 hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar primeira resposta
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.menuItems.map((item, idx) => (
                <div key={item.id} className="dashboard-card p-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700 text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Gatilho:</span>
                      <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-lg text-emerald-700 font-bold">{item.trigger}</code>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{item.response}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setMenuModal({ open: true, item })}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteMenuItem(item.id)}
                      className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title="Remover"
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

      {/* ── Tab: Serviços ───────────────────────────────────────── */}
      {tab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Liste os serviços e produtos da sua empresa. Os clientes podem consultar e reservar diretamente pelo WhatsApp.
            </p>
            <button
              onClick={() => setServiceModal({ open: true, service: null })}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-colors whitespace-nowrap ml-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Serviço / Produto
            </button>
          </div>

          {config.services.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3">
              <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm font-bold text-slate-400">Nenhum serviço ou produto cadastrado</p>
              <p className="text-xs text-slate-400">Adicione os serviços que a sua empresa presta para que o bot os apresente aos clientes.</p>
              <button
                onClick={() => setServiceModal({ open: true, service: null })}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-2 hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar primeiro serviço
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.services.map((service) => (
                <div key={service.id} className="dashboard-card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">{service.name}</h3>
                      {service.price && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 mt-1 inline-block">
                          {service.price}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setServiceModal({ open: true, service })}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {service.description && <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: FAQ (Perguntas Frequentes) ────────────────────────── */}
      {tab === 'faq' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Cadastre as Perguntas Frequentes (FAQ). O bot irá apresentá-las e responder automaticamente quando o cliente escolher "4. Dúvidas Frequentes".
            </p>
            <button
              onClick={() => setFaqModal({ open: true, faq: null })}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-colors whitespace-nowrap ml-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova FAQ
            </button>
          </div>

          {config.faqs.length === 0 ? (
            <div className="dashboard-card p-12 text-center space-y-3">
              <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-bold text-slate-400">Nenhuma FAQ cadastrada</p>
              <p className="text-xs text-slate-400">Cadastre perguntas frequentes para o bot tirar as dúvidas dos seus clientes de forma automática.</p>
              <button
                onClick={() => setFaqModal({ open: true, faq: null })}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-2 hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar primeira FAQ
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.faqs.map((f, idx) => (
                <div key={f.id} className="dashboard-card p-5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-sm">{f.question}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setFaqModal({ open: true, faq: f })}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteFaq(f.id)}
                        className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">{f.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {menuModal.open && (
        <MenuItemModal
          item={menuModal.item}
          onClose={() => setMenuModal({ open: false, item: null })}
          onSave={(item) => {
            const isEdit = !!menuModal.item;
            setConfig((prev) => ({
              ...prev,
              menuItems: isEdit
                ? prev.menuItems.map((m) => (m.id === item.id ? item : m))
                : [...prev.menuItems, item],
            }));
            toast('success', isEdit ? 'Resposta atualizada!' : 'Resposta adicionada!');
          }}
        />
      )}
      {serviceModal.open && (
        <ServiceModal
          service={serviceModal.service}
          onClose={() => setServiceModal({ open: false, service: null })}
          onSave={(service) => {
            const isEdit = !!serviceModal.service;
            setConfig((prev) => ({
              ...prev,
              services: isEdit
                ? prev.services.map((s) => (s.id === service.id ? service : s))
                : [...prev.services, service],
            }));
            toast('success', isEdit ? 'Serviço atualizado!' : 'Serviço adicionado!');
          }}
        />
      )}
      {faqModal.open && (
        <FaqModal
          faq={faqModal.faq}
          onClose={() => setFaqModal({ open: false, faq: null })}
          onSave={(faq) => {
            const isEdit = !!faqModal.faq;
            setConfig((prev) => ({
              ...prev,
              faqs: isEdit
                ? prev.faqs.map((f) => (f.id === faq.id ? faq : f))
                : [...prev.faqs, faq],
            }));
            toast('success', isEdit ? 'FAQ atualizada!' : 'FAQ adicionada!');
          }}
        />
      )}
    </div>
  );
}
