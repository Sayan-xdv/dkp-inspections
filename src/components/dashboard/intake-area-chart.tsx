'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

interface WeekPoint {
  week: string;
  intake: number;
  completed: number;
}

interface IntakeAreaChartProps {
  data: WeekPoint[];
}

export function IntakeAreaChart({ data }: IntakeAreaChartProps) {
  const totalIntake = data.reduce((s, d) => s + d.intake, 0);
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const efficiency = totalIntake > 0 ? Math.round((totalCompleted / totalIntake) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-start justify-between mb-1 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Поток экспертиз · 8 недель</h3>
          <p className="text-xs text-gray-500 mt-0.5">Поступление и закрытие</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Поступило</div>
            <div className="font-mono-tabular text-sm font-semibold text-indigo-600">{totalIntake}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Закрыто</div>
            <div className="font-mono-tabular text-sm font-semibold text-emerald-600">{totalCompleted}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Конверсия</div>
            <div className="font-mono-tabular text-sm font-semibold text-gray-900">{efficiency}%</div>
          </div>
        </div>
      </div>

      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="area-intake" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="area-completed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={36}
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
              cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => <span className="text-gray-600">{v}</span>}
            />
            <Area
              type="monotone"
              dataKey="intake"
              name="Поступило"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#area-intake)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Закрыто"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#area-completed)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
