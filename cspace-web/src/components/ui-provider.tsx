'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ModalConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface UIContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  confirm: (config: ModalConfig) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}

// ─── Toast icons ──────────────────────────────────────────────────────────────
function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') return (
    <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === 'error') return (
    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === 'warning') return (
    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
  return (
    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const toastBg: Record<ToastType, string> = {
  success: 'border-green-200 bg-white',
  error:   'border-red-200 bg-white',
  warning: 'border-amber-200 bg-white',
  info:    'border-blue-200 bg-white',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ModalConfig | null>(null);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const showConfirm = useCallback((config: ModalConfig) => {
    setModal(config);
  }, []);

  const closeModal = () => setModal(null);

  return (
    <UIContext.Provider value={{ toast: addToast, confirm: showConfirm }}>
      {children}

      {/* ── Toast Container (top-right) ───────────────────────── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-xl animate-[slideInRight_0.3s_ease] ${toastBg[t.type]}`}
          >
            <ToastIcon type={t.type} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-tight">{t.title}</p>
              {t.message && <p className="text-xs text-slate-500 mt-0.5">{t.message}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-700 mt-0.5 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-[slideInUp_0.2s_ease]">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${modal.danger ? 'bg-red-100' : 'bg-slate-100'}`}>
              {modal.danger ? (
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center mb-2">{modal.title}</h3>
            <p className="text-sm text-slate-500 text-center mb-8 leading-relaxed">{modal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { modal.onCancel?.(); closeModal(); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                {modal.cancelLabel || 'Cancelar'}
              </button>
              <button
                onClick={() => { modal.onConfirm(); closeModal(); }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-colors ${modal.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                {modal.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}
