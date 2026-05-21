'use client';

export interface TopProjectRow {
  name: string;
  total: number;
  completed: number;
}

export function TopProjects({ data }: { data: TopProjectRow[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Топ проектов</h3>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">По объёму</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Завершено / в работе</p>

      <div className="space-y-3">
        {data.map((p, i) => {
          const pctTotal = (p.total / max) * 100;
          const pctDone = (p.completed / Math.max(1, p.total)) * 100;
          return (
            <div key={p.name}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-gray-400 font-mono-tabular text-[10px] w-3">{i + 1}</span>
                  <span className="text-gray-800 font-medium truncate">{p.name}</span>
                </div>
                <span className="font-mono-tabular text-gray-900 font-semibold tabular-nums">{p.total}</span>
              </div>
              <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pctTotal}%`,
                    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                    transitionDelay: `${i * 60}ms`,
                  }}
                />
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(pctTotal * pctDone) / 100}%`,
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                    transitionDelay: `${i * 60 + 200}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Завершено
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" /> В работе
        </span>
      </div>
    </div>
  );
}
