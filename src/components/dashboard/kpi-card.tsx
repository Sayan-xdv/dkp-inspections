'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis, Area, AreaChart } from 'recharts';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  delta: number;
  deltaLabel?: string;
  deltaPositive?: 'up' | 'down';
  sparkline: number[];
  accent: 'indigo' | 'emerald' | 'amber' | 'red' | 'purple';
  icon: LucideIcon;
  staggerDelay?: number;
}

const ACCENT_CONFIG = {
  indigo: { stroke: '#6366f1', fill: 'url(#grad-indigo)', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  emerald: { stroke: '#10b981', fill: 'url(#grad-emerald)', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  amber: { stroke: '#f59e0b', fill: 'url(#grad-amber)', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  red: { stroke: '#ef4444', fill: 'url(#grad-red)', iconBg: 'bg-red-50', iconColor: 'text-red-600' },
  purple: { stroke: '#a855f7', fill: 'url(#grad-purple)', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
};

function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      setVal(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel = 'к прошлой нед.',
  deltaPositive = 'up',
  sparkline,
  accent,
  icon: Icon,
  staggerDelay = 0,
}: KpiCardProps) {
  const cfg = ACCENT_CONFIG[accent];
  const isNumeric = typeof value === 'number';
  const animatedValue = useCountUp(isNumeric ? value : 0);
  const display = isNumeric
    ? Math.round(animatedValue).toLocaleString('ru-RU')
    : value;

  const goodDirection = deltaPositive === 'up' ? delta >= 0 : delta <= 0;
  const deltaText = `${delta > 0 ? '+' : ''}${typeof delta === 'number' ? delta.toLocaleString('ru-RU') : delta}`;
  const sparkData = sparkline.map((v, i) => ({ i, v }));

  return (
    <div
      className="stagger-in group relative overflow-hidden rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300"
      style={{ animationDelay: `${staggerDelay}ms` }}
    >
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">{label}</p>
          </div>
          <div className={cn('p-2 rounded-lg', cfg.iconBg)}>
            <Icon className={cn('w-4 h-4', cfg.iconColor)} strokeWidth={2.2} />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-mono-tabular text-4xl font-semibold tracking-tight text-gray-900">
            {display}
          </span>
          {unit && <span className="text-sm text-gray-400 font-mono-tabular">{unit}</span>}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className={cn(
            'inline-flex items-center gap-1 text-xs font-mono-tabular font-medium',
            goodDirection ? 'text-emerald-600' : 'text-red-500'
          )}>
            {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>{deltaText}</span>
            <span className="text-gray-400 font-normal ml-1">{deltaLabel}</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-14 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad-indigo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-emerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-purple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={cfg.stroke}
                strokeWidth={1.6}
                fill={cfg.fill}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
