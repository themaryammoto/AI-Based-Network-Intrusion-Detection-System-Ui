import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { AlertStatus, Severity, ToastMessage } from '../../types/nids';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    Critical:
      'bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5] border border-[#DC2626]/25',
    High:
      'bg-[#EA580C]/10 text-[#EA580C] dark:bg-[#EA580C]/20 dark:text-[#FDBA74] border border-[#EA580C]/25',
    Medium:
      'bg-[#D97706]/10 text-[#B45309] dark:bg-[#D97706]/20 dark:text-[#FCD34D] border border-[#D97706]/25',
    Low:
      'bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#93C5FD] border border-[#2563EB]/25',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: AlertStatus }) {
  const styles: Record<AlertStatus, string> = {
    New: 'bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5]',
    Investigating: 'bg-[#D97706]/10 text-[#B45309] dark:bg-[#D97706]/20 dark:text-[#FCD34D]',
    Acknowledged: 'bg-[#0891B2]/10 text-[#0891B2] dark:bg-[#0891B2]/20 dark:text-[#67E8F9]',
    Resolved: 'bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#6EE7B7]',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function PredictionBadge({ prediction, label }: { prediction: 'BENIGN' | 'ATTACK'; label?: string }) {
  if (prediction === 'BENIGN') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#6EE7B7] whitespace-nowrap">
        BENIGN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5] whitespace-nowrap">
      {label && label !== 'ATTACK' ? `ATTACK · ${label}` : 'ATTACK'}
    </span>
  );
}

export function Sparkline({
  data,
  color,
  height = 28,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const width = 92;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - 3 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="Loading view">
      <div className="flex items-center justify-between">
        <div className="h-6 w-56 rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-5"
          >
            <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
            <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-5" />
        <div className="h-72 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-5" />
      </div>
      <div className="h-56 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] p-5" />
    </div>
  );
}

export function DemoFooter() {
  return (
    <footer className="mt-8 pt-4 border-t border-[#E2E8F0] dark:border-[#1E354E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
      <p>AI-Based Network Intrusion Detection System · Persistent SOC Backend &amp; Render.com Model Proxy</p>
      <p className="tabular-nums">CIC-IDS2017 Benchmark (2,830,743 flows) + Real-Time Ingestion Engine</p>
    </footer>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />,
    info: <Info className="w-4 h-4 text-[#2563EB] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />,
    danger: <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />,
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-xl bg-white dark:bg-[#112236] border border-[#E2E8F0] dark:border-[#1E354E] shadow-lg px-4 py-3 text-sm text-[#0F172A] dark:text-[#F1F5F9] transition-all"
        >
          <div className="mt-0.5">{iconMap[toast.variant]}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                {toast.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="text-[#64748B] hover:text-[#0F172A] dark:hover:text-white p-0.5 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
