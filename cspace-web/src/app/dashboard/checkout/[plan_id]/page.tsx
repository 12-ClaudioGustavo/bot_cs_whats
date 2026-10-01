'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUI } from '@/components/ui-provider';
import { API_URL } from '@/lib/api';

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price_kz: number;
  max_whatsapp_accounts: number;
  monthly_message_limit: number;
  max_users: number;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useUI();

  const planId = (params?.plan_id as string) || '';

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionId, setTransactionId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await fetch(`${API_URL}/api/plans`);
        if (res.ok) {
          const plans: Plan[] = await res.json();
          const targetId = decodeURIComponent(planId).toLowerCase();
          const match = plans.find(
            (p) =>
              (p.id && p.id.toLowerCase() === targetId) ||
              (p.code && p.code.toLowerCase() === targetId)
          );
          if (match) {
            setPlan(match);
          }
        }
      } catch (_) {
      } finally {
        setLoading(false);
      }
    }
    if (planId) {
      loadPlan();
    }
  }, [planId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId.trim()) {
      toast('warning', 'Atenção', 'Por favor insira o ID da transação ou número do comprovativo.');
      return;
    }
    if (!receiptFile) {
      toast('warning', 'Atenção', 'Por favor selecione o ficheiro do comprovativo bancário.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('planId', plan?.id || plan?.code || planId);
      formData.append('transactionId', transactionId.trim());
      formData.append('receipt', receiptFile);

      const res = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast('success', 'Pagamento Submetido!', 'O seu comprovativo foi enviado para análise. Notificaremos quando for aprovado.');
        router.push('/dashboard/billing?pending=true');
      } else {
        toast('error', 'Erro no Checkout', data.error || 'Não foi possível submeter o pagamento.');
      }
    } catch (_) {
      toast('error', 'Erro de Conexão', 'Não foi possível comunicar com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedPrice = plan ? Number(plan.price_kz).toLocaleString('pt-PT') : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/billing')}
          className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar a Planos e Faturação
        </button>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Checkout & Ativação de Plano</h1>
        <p className="text-xs text-slate-600">Efetue a transferência bancária e envie o comprovativo para ativar o acesso</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Resumo do Plano */}
        <div className="dashboard-card p-6 space-y-6 flex flex-col justify-between border-2 border-slate-900">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
              Plano Selecionado
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-3">{plan?.name || 'Plano SaaS'}</h2>
            <p className="text-xs text-slate-600 mt-1">{plan?.description || 'Subscrição mensal com renovação manual'}</p>

            <div className="my-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Valor Mensal</span>
              <div className="text-3xl font-black text-slate-900 mt-1">
                {formattedPrice} Kz
                <span className="text-xs text-slate-500 font-normal"> / mês</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><b>{plan?.max_whatsapp_accounts || 1}</b> {plan?.max_whatsapp_accounts === 1 ? 'Conexão WhatsApp' : 'Conexões WhatsApp'}</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Até <b>{plan?.monthly_message_limit ? plan.monthly_message_limit.toLocaleString('pt-PT') : 1000}</b> msgs/mês</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><b>{plan?.max_users || 1}</b> Utilizadores na equipa</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Validade: <b>30 Dias Exatos</b> após aprovação</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Aprovação manual rápida efetuada pelo Administrador C-Space.</span>
          </div>
        </div>

        {/* Instruções de Pagamento e Formulário */}
        <div className="space-y-6">
          {/* Dados Bancários */}
          <div className="dashboard-card p-6 bg-slate-900 text-white space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <h3 className="font-extrabold text-sm">Dados para Transferência (IBAN)</h3>
            </div>
            <div className="space-y-2 text-xs font-mono bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">Banco</span>
                <span className="text-white font-bold">Banco Angolano de Investimentos (BAI)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">Beneficiário</span>
                <span className="text-white font-bold">C-Space Technologies, Lda</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">IBAN</span>
                <span className="text-emerald-400 font-bold text-sm tracking-wider select-all">AO06.0040.0000.1234.5678.9</span>
              </div>
            </div>
          </div>

          {/* Form de Submissão */}
          <form onSubmit={handleSubmit} className="dashboard-card p-6 space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">Submeter Comprovativo de Pagamento</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ID da Transação / N.º de Referência
              </label>
              <input
                type="text"
                required
                placeholder="Ex: TRX-9812489 ou N.º de Operação"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Insira o código ou n.º de referência da transferência efetuada.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Anexar Comprovativo (PDF, JPG, PNG)
              </label>
              <input
                type="file"
                required
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  A submeter pagamento...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Submeter Pagamento para Aprovação
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
