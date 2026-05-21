'use client';

import { cn } from '@/lib/utils';

export type Period = '7d' | '30d' | '90d';

const OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
];

export function PeriodSwitcher({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-gray-100/80 border border-gray-200">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200',
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
              : 'text-gray-500 hover:text-gray-800'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
