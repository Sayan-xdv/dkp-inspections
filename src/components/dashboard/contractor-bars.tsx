'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

export interface ContractorBarRow {
  name: string;
  assigned: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

const CATEGORIES = [
  { key: 'assigned', label: 'Назначено', color: '#6366f1' },
  { key: 'in_progress', label: 'В работе', color: '#a855f7' },
  { key: 'completed', label: 'Готово', color: '#10b981' },
  { key: 'overdue', label: 'Просрочено', color: '#ef4444' },
] as const;

export function ContractorBars({ data }: { data: ContractorBarRow[] }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Сравнение подрядчиков</h3>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{data.length} компаний</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Распределение задач по статусу</p>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'var(--font-display)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17, 24, 39, 0.95)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
              itemStyle={{ color: '#fff', padding: 0 }}
              cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => <span className="text-gray-600">{v}</span>}
            />
            {CATEGORIES.map((c) => (
              <Bar
                key={c.key}
                dataKey={c.key}
                name={c.label}
                fill={c.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
