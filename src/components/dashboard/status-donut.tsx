'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_CONFIG, type ApartmentStatus } from '@/lib/types/database';

const STATUS_COLOR: Record<ApartmentStatus, string> = {
  pending_keys: '#f59e0b',
  keys_unavailable: '#f43f5e',
  keys_available: '#3b82f6',
  assigned: '#6366f1',
  in_progress: '#a855f7',
  rejected: '#ef4444',
  completed: '#14b8a6',
  uploaded_to_crm: '#10b981',
};

interface StatusDonutProps {
  counts: Record<ApartmentStatus, number>;
  total: number;
}

export function StatusDonut({ counts, total }: StatusDonutProps) {
  const data = (Object.entries(counts) as [ApartmentStatus, number][])
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: STATUS_CONFIG[k].label,
      value: v,
      color: STATUS_COLOR[k],
      key: k,
    }));

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Распределение по статусам</h3>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">8 категорий</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Текущий срез по платформе</p>

      <div className="relative flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'rgba(17, 24, 39, 0.95)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                padding: '6px 10px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono-tabular text-3xl font-semibold text-gray-900">{total}</span>
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">всего</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-gray-600 truncate flex-1">{d.name}</span>
            <span className="font-mono-tabular text-gray-900 font-medium tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
