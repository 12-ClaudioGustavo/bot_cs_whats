'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CSVecnaLogo from '@/components/CSVecnaLogo';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hero animations
    const ctx = gsap.context(() => {
      gsap.from('.hero-badge', {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: 'power2.out'
      });

      gsap.from('.hero-title', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        delay: 0.2,
        ease: 'power2.out'
      });

      gsap.from('.hero-subtitle', {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.4,
        ease: 'power2.out'
      });

      gsap.from('.hero-cta', {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.6,
        ease: 'power2.out'
      });

      gsap.from('.hero-visual', {
        opacity: 0,
        y: 40,
        duration: 1,
        delay: 0.8,
        ease: 'power2.out'
      });

      // Feature cards animation
      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: '.features-grid',
          start: 'top 80%'
        },
        opacity: 0,
        y: 40,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out'
      });

      // Stats counter animation
      gsap.from('.stat-card', {
        scrollTrigger: {
          trigger: '.stats-section',
          start: 'top 80%'
        },
        opacity: 0,
        scale: 0.9,
        duration: 0.5,
        stagger: 0.1,
        ease: 'back.out(1.7)'
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900" ref={heroRef}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <CSVecnaLogo size="sm" theme="light" showSubtext={true} />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Preços</a>
            <a href="#contact" className="hover:text-slate-900 transition-colors">Contato</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Começar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          <div className="hero-badge inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Plataforma de automação empresarial
          </div>

          <h1 className="hero-title text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Atendimento WhatsApp profissional para sua empresa
          </h1>

          <p className="hero-subtitle text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto">
            Sistema completo de gestão multi-tenant com automação inteligente, atendimento 24/7 e dashboard analítico avançado.
          </p>

          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              Criar conta empresarial
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-900 font-medium rounded-lg border border-slate-300 transition-colors inline-flex items-center justify-center gap-2"
            >
              Ver demonstração
            </a>
          </div>
        </div>

        {/* Visual Dashboard */}
        <div className="hero-visual mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none z-10"></div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="text-xs text-slate-500 font-mono">dashboard.cspace.app</div>
              </div>
            </div>
            <div className="p-8 bg-slate-50">
              <div className="stats-section grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div className="stat-card bg-white rounded-xl p-6 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Mensagens</div>
                  <div className="text-3xl font-bold text-slate-900">24,580</div>
                  <div className="text-xs text-slate-600 mt-2">+18% vs. mês anterior</div>
                </div>
                <div className="stat-card bg-white rounded-xl p-6 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Clientes</div>
                  <div className="text-3xl font-bold text-slate-900">3,120</div>
                  <div className="text-xs text-slate-600 mt-2">99.4% taxa de resposta</div>
                </div>
                <div className="stat-card bg-white rounded-xl p-6 border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Agendamentos</div>
                  <div className="text-3xl font-bold text-slate-900">842</div>
                  <div className="text-xs text-slate-600 mt-2">Automação completa</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-900">Atividade recente</div>
                  <div className="text-xs text-slate-500">Últimas 24h</div>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100"></div>
                      <div className="flex-1 h-4 bg-slate-100 rounded"></div>
                      <div className="w-16 h-4 bg-slate-100 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              Recursos empresariais completos
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Tudo que você precisa para gerenciar atendimento em escala
            </p>
          </div>

          <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Automação inteligente',
                description: 'Fluxos de conversa personalizados com respostas instantâneas e roteamento inteligente'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
                title: 'Multi-tenant nativo',
                description: 'Arquitetura isolada por empresa com gestão completa de equipes e permissões'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Segurança empresarial',
                description: 'Criptografia end-to-end, autenticação JWT e compliance com LGPD'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Analytics avançado',
                description: 'Métricas em tempo real, relatórios customizados e insights de performance'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Atendimento 24/7',
                description: 'Bot sempre disponível com transição suave para agentes humanos quando necessário'
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                title: 'Agendamento integrado',
                description: 'Sistema de marcação automática com sincronização de calendário e lembretes'
              }
            ].map((feature, index) => (
              <div key={index} className="feature-card bg-white p-8 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              Planos transparentes para cada etapa
            </h2>
            <p className="text-lg text-slate-600">Escolha o plano ideal para o seu negócio</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Starter</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold text-slate-900">25.000</span>
                  <span className="text-slate-600">Kz/mês</span>
                </div>
                <p className="text-sm text-slate-600">Para pequenos negócios</p>
              </div>
              <ul className="space-y-3 mb-8">
                {['1 conexão WhatsApp', 'Até 1.000 mensagens/mês', 'Bot básico', '2 agentes'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <svg className="w-5 h-5 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?plan=starter"
                className="block w-full py-3 text-center bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-lg transition-colors"
              >
                Começar
              </Link>
            </div>

            {/* Business */}
            <div className="bg-slate-900 rounded-2xl border-2 border-slate-900 p-8 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-xs font-semibold px-3 py-1 rounded-full">
                Mais popular
              </div>
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-2">Business</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold text-white">65.000</span>
                  <span className="text-slate-400">Kz/mês</span>
                </div>
                <p className="text-sm text-slate-400">Para empresas em crescimento</p>
              </div>
              <ul className="space-y-3 mb-8">
                {['3 conexões WhatsApp', '5.000 mensagens/mês', 'Fluxos customizados', 'Agendamentos', '5 agentes'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <svg className="w-5 h-5 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?plan=business"
                className="block w-full py-3 text-center bg-white hover:bg-slate-100 text-slate-900 font-medium rounded-lg transition-colors"
              >
                Começar
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Enterprise</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold text-slate-900">Custom</span>
                </div>
                <p className="text-sm text-slate-600">Para grandes operações</p>
              </div>
              <ul className="space-y-3 mb-8">
                {['Conexões ilimitadas', 'Mensagens ilimitadas', 'SLA dedicado', 'Integrações custom', 'Suporte prioritário'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <svg className="w-5 h-5 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?plan=enterprise"
                className="block w-full py-3 text-center bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-lg transition-colors"
              >
                Falar com vendas
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-8 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Pronto para automatizar seu atendimento?
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
            Junte-se a centenas de empresas que já transformaram seu atendimento com C-Space
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 font-medium rounded-lg transition-colors"
          >
            Criar conta gratuita
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <CSVecnaLogo size="sm" theme="light" showSubtext={false} />
            <span className="text-sm text-slate-500 font-medium">© 2026 Desenvolvido pela C-Space Technologies</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-600">
            <Link href="/login" className="hover:text-slate-900 transition-colors">Login</Link>
            <Link href="/register" className="hover:text-slate-900 transition-colors">Registro</Link>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Preços</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
