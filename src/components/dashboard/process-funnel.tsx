'use client';

import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface ProcessFunnelProps {
  stages: FunnelStage[];
}

export function ProcessFunnel({ stages }: ProcessFunnelProps) {
  const max = useMemo(() => Math.max(1, ...stages.map((s) => s.value)), [stages]);

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Воронка экспертиз</h3>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Сквозной поток</span>
      </div>
      <p className="text-xs text-gray-500 mb-5">От поступления до загрузки в CRM</p>

      <div className="space-y-3">
        {stages.map((stage, i) => {
          const pct = (stage.value / max) * 100;
          const conversion = i === 0 ? 100 : Math.round((stage.value / Math.max(1, stages[i - 1].value)) * 100);

          return (
            <div key={stage.key} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-medium text-gray-700">{stage.label}</span>
                  {i > 0 && (
                    <span className="text-[10px] text-gray-400 font-mono-tabular">
                      <ChevronRight className="inline w-3 h-3 -mx-0.5" />
                      {conversion}%
                    </span>
                  )}
                </div>
                <span className="font-mono-tabular text-sm font-semibold text-gray-900">{stage.value}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)`,
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
