'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

interface UsageStats {
  messagesUsed: number;
  messagesLimit: number;
  usagePercent: number;
  limitReached: boolean;
  nearLimit: boolean;
  planName: string;
  activePlanId: string | null;
  activePlanCode: string | null;
  activePlanPrice: number;
}

function BillingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isJustRegistered = searchParams.get('registered') === 'true';
  const isBlockedRedirect = searchParams.get('blocked') === 'true';

  const [tenantStatus, setTenantStatus] = useState<string>('active');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const [statsRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/stats`, { credentials: 'include' }),
        fetch(`${API_URL}/api/plans`),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setTenantStatus(data.tenantStatus || 'active');
        setUsage({
          messagesUsed: data.messagesUsed || 0,
          messagesLimit: data.messagesLimit || 0,
          usagePercent: data.usagePercent || 0,
          limitReached: !!data.limitReached,
          nearLimit: !!data.nearLimit,
          planName: data.planName || 'Sem plano',
          activePlanId: data.activePlanId || null,
          activePlanCode: data.activePlanCode || null,
          activePlanPrice: data.activePlanPrice || 0,
        });
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isBlocked = tenantStatus === 'pending_payment' || tenantStatus === 'suspended' || tenantStatus === 'cancelled';
  const isPendingApproval = tenantStatus === 'pending_approval';
  const isActive = tenantStatus === 'active';

  // Determina o botão a mostrar para cada plano
  const getPlanAction = (plan: Plan): { label: string; type: 'current' | 'upgrade' | 'downgrade' | 'activate' } => {
    const isCurrentPlan = Boolean(
      (usage?.activePlanId && (usage.activePlanId === plan.id || usage.activePlanId === plan.code)) ||
      (usage?.activePlanCode && (usage.activePlanCode === plan.code || usage.activePlanCode === plan.id))
    );

    if (isCurrentPlan && isActive) {
      return { label: 'Plano Ativo', type: 'current' };
    }

    if (!isActive || (!usage?.activePlanId && !usage?.activePlanCode)) {
      return { label: 'Escolher Plano', type: 'activate' };
    }

    const currentPrice = usage?.activePlanPrice || 0;
    if (plan.price_kz > currentPrice) {
      return { label: 'Fazer Upgrade', type: 'upgrade' };
    } else if (plan.price_kz < currentPrice) {
      return { label: 'Fazer Downgrade', type: 'downgrade' };
    }

    return { label: 'Plano Ativo', type: 'current' };
  };

  const handlePlanClick = (plan: Plan) => {
    const action = getPlanAction(plan);
    if (action.type === 'current') return; // já é o plano ativo, nada a fazer

    // Para qualquer ação (activate, upgrade, downgrade), vai ao checkout
    const planIdentifier = plan.id || plan.code;
    router.push(`/dashboard/checkout/${planIdentifier}`);
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">Plano & Ativação de Acesso</h1>
        <p className="text-xs text-slate-600">Escolha o seu plano e ative a conta para desbloquear todas as funcionalidades do WhatsApp</p>
      </div>

      {isJustRegistered && (
        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-3">
          <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="block text-sm">Bem-vindo à C-Space!</span>
            <span className="font-normal text-blue-600">A sua conta de empresa foi criada. Escolha um dos planos abaixo para ativar e libertar o acesso total.</span>
          </div>
        </div>
      )}

      {isBlockedRedirect && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-3">
          <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="block text-sm">Acesso bloqueado</span>
            <span className="font-normal text-amber-700">A área que tentou aceder requer uma subscrição ativa. Ative um plano abaixo para desbloquear todas as funcionalidades.</span>
          </div>
        </div>
      )}

      {isPendingApproval && (
        <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-3">
          <svg className="w-6 h-6 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="block text-sm">Pagamento em análise</span>
            <span className="font-normal text-indigo-600">O seu comprovativo foi submetido e está a ser verificado pela nossa equipa. Notificaremos quando o acesso for liberado.</span>
          </div>
        </div>
      )}

      {isBlocked && !isJustRegistered && !isBlockedRedirect && !isPendingApproval && (
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-3">
          <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <span className="block text-sm">Acesso Restrito — Escolha e Ative o seu Plano</span>
            <span className="font-normal text-red-600">A sua conta está pendente de pagamento. Selecione o plano abaixo para continuar.</span>
          </div>
        </div>
      )}

      {message && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{message}</span>
        </div>
      )}

      {/* Uso de mensagens do mês corrente */}
      {!loading && usage && isActive && (usage.messagesLimit > 0) && (
        <div
          className={`dashboard-card space-y-3 ${
            usage.limitReached
              ? 'border-red-300 bg-red-50'
              : usage.nearLimit
              ? 'border-amber-300 bg-amber-50'
              : ''
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Consumo de mensagens este mês</div>
              <div className="text-sm text-slate-900 font-semibold mt-0.5">Plano atual: {usage.planName}</div>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-black ${
                  usage.limitReached ? 'text-red-600' : usage.nearLimit ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {usage.messagesUsed.toLocaleString('pt-PT')}
              </span>
              <span className="text-slate-500 text-sm"> / {usage.messagesLimit.toLocaleString('pt-PT')}</span>
            </div>
          </div>

          <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usage.limitReached ? 'bg-red-500' : usage.nearLimit ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, usage.usagePercent)}%` }}
            />
          </div>

          {usage.limitReached ? (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Limite mensal atingido — considere fazer upgrade de plano.
            </p>
          ) : usage.nearLimit ? (
            <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Já usou {usage.usagePercent}% do limite do plano. Considere fazer upgrade.
            </p>
          ) : (
            <p className="text-xs text-slate-600">Dentro do limite do plano ({usage.usagePercent}% usado).</p>
          )}
        </div>
      )}

      {/* Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-500 text-xs font-medium">A carregar planos disponíveis...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-500 text-xs font-medium">Nenhum plano ativo disponível. Contacte o suporte.</div>
        ) : (
          plans.map((plan, index) => {
            const action = getPlanAction(plan);
            const isCurrent = action.type === 'current';
            const isUpgrade = action.type === 'upgrade';
            const isDowngrade = action.type === 'downgrade';
            const isPopular = plan.code === 'business';

            const cardBorder = isCurrent
              ? 'border-2 border-green-500 shadow-xl shadow-green-100'
              : isPopular
              ? 'border-2 border-slate-900 shadow-xl'
              : '';

            const btnClass = isCurrent
              ? 'w-full py-3 rounded-xl text-center text-sm font-extrabold bg-green-50 border-2 border-green-500 text-green-700 cursor-default'
              : isUpgrade
              ? 'w-full py-3 rounded-xl text-center text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2'
              : isDowngrade
              ? 'w-full py-3 rounded-xl text-center text-sm font-extrabold bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-500 transition-colors flex items-center justify-center gap-2'
              : isPopular
              ? 'w-full py-3 rounded-xl text-center text-sm font-extrabold btn-primary shadow-lg'
              : 'w-full py-3 rounded-xl text-center text-sm font-extrabold btn-secondary';

            return (
              <div
                key={plan.id || plan.code || `plan-${index}`}
                className={`dashboard-card p-8 flex flex-col justify-between relative transition-all ${cardBorder}`}
              >
                {/* Badge: Plano Atual */}
                {isCurrent && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white font-extrabold text-xs uppercase px-4 py-1 rounded-full flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Plano Atual
                  </div>
                )}
                {/* Badge: Mais Popular (só quando não for o atual) */}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-extrabold text-xs uppercase px-4 py-1 rounded-full">
                    Mais Popular
                  </div>
                )}

                <div>
                  <div className="text-lg font-bold text-slate-900 mb-1">{plan.name}</div>
                  <div className="text-xs text-slate-600 mb-6">{plan.description || 'Plano de subscrição mensal'}</div>
                  <div className="text-4xl font-extrabold text-slate-900 mb-6">
                    {plan.price_kz.toLocaleString('pt-PT')} <span className="text-xs text-slate-500 font-normal">Kz / mês</span>
                  </div>
                  <ul className="space-y-3 text-sm text-slate-700 mb-8">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span><b>{plan.max_whatsapp_accounts}</b> {plan.max_whatsapp_accounts === 1 ? 'Conexão WhatsApp' : 'Conexões WhatsApp'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Até <b>{plan.monthly_message_limit.toLocaleString('pt-PT')}</b> mensagens/mês</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span><b>{plan.max_users}</b> Utilizadores na equipa</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => !isCurrent && handlePlanClick(plan)}
                  disabled={isCurrent || isPendingApproval}
                  className={btnClass}
                >
                  {isCurrent ? (
                    <>
                      <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Plano Ativado
                    </>
                  ) : isUpgrade ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Fazer Upgrade
                    </>
                  ) : isDowngrade ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Fazer Downgrade
                    </>
                  ) : isPendingApproval ? (
                    'Aguardando aprovação...'
                  ) : (
                    `Escolher ${plan.name}`
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-600 text-xs">Carregando plano...</div>}>
      <BillingContent />
    </Suspense>
  );
}
