'use client';

import Link from 'next/link';
import { Component, PropsWithChildren, ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { toCurrency } from '@/lib/format';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast(message, tone = 'success') {
        const item = { id: `${Date.now()}-${Math.random()}`, message, tone };
        setItems((current) => [...current, item]);
        setTimeout(() => {
          setItems((current) => current.filter((entry) => entry.id !== item.id));
        }, 3000);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${
              item.tone === 'error' ? 'bg-rose-700' : 'bg-emerald-700'
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}

export function Header({ app }: { app: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          SnapMatch
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/search">Search</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/profile">{app}</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 text-sm text-slate-500">
        SnapMatch demo workspace
      </div>
    </footer>
  );
}

export class ErrorBoundary extends Component<PropsWithChildren, { hasError: boolean }> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">Something went wrong.</div>;
    }

    return this.props.children;
  }
}

export function LoadingSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-3 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      <span>{label}</span>
    </div>
  );
}

export function TaskCard({
  task,
  hrefBase
}: {
  task: { id: string; statusLabel: string; stylePreference?: string; estimatedPrice?: string; dueAt?: string; editor?: { fullName?: string } | null };
  hrefBase: string;
}) {
  return (
    <Link href={`${hrefBase}/${task.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">Task {task.id}</p>
          <p className="mt-1 text-sm text-slate-600">Status: {task.statusLabel}</p>
          {task.stylePreference ? <p className="text-sm text-slate-600">Style: {task.stylePreference}</p> : null}
        </div>
        <div className="text-right text-sm text-slate-600">
          {task.estimatedPrice ? <p>{toCurrency(Number(task.estimatedPrice))}</p> : null}
          {task.editor?.fullName ? <p>{task.editor.fullName}</p> : null}
        </div>
      </div>
    </Link>
  );
}

export function EditorSelector({
  editors
}: {
  editors: Array<{ id: string; fullName: string; hourlyRate: number; score: number; reasons: string[] }>;
}) {
  return (
    <div className="space-y-3">
      {editors.map((editor) => (
        <article key={editor.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">{editor.fullName}</p>
              <p className="text-sm text-slate-600">{toCurrency(editor.hourlyRate)}/hr</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
              Match {Math.round(editor.score * 100)}%
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{editor.reasons.join(' • ')}</p>
        </article>
      ))}
    </div>
  );
}
