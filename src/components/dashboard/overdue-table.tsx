'use client';

import { Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface OverdueRow {
  contractor_id: string;
  contractor_name: string;
  count: number;
  max_days: number;
  apartment_ids: string[];
}

interface OverdueTableProps {
  rows: OverdueRow[];
  onNotify: (row: OverdueRow) => void;
}

export function OverdueTable({ rows, onNotify }: OverdueTableProps) {
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                Просрочки у подрядчиков
              </h3>
              {total > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 border border-red-200/60 text-red-600 text-[10px] font-medium">
                  <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.5} />
                  {total}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">SLA 7 дней с момента назначения · отсортировано по просрочке</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-400 font-medium border-y border-gray-100 bg-gray-50/40">
              <th className="text-left px-5 py-2 font-medium">Подрядчик</th>
              <th className="text-right px-3 py-2 font-medium">Квартир</th>
              <th className="text-right px-3 py-2 font-medium">Макс. дней</th>
              <th className="text-right px-5 py-2 font-medium">Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                  Просроченных квартир нет — все подрядчики в SLA ✓
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const severity =
                  row.max_days > 14 ? 'critical' : row.max_days > 7 ? 'high' : 'medium';
                return (
                  <tr key={row.contractor_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-1.5 h-8 rounded-full"
                          style={{
                            background:
                              severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f59e0b' : '#94a3b8',
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{row.contractor_name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {severity === 'critical'
                              ? 'Критическая просрочка'
                              : severity === 'high'
                              ? 'Высокая просрочка'
                              : 'Лёгкая просрочка'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="font-mono-tabular text-sm font-semibold text-gray-900">{row.count}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span
                        className={`font-mono-tabular text-sm font-semibold ${
                          severity === 'critical' ? 'text-red-600' : severity === 'high' ? 'text-amber-600' : 'text-gray-600'
                        }`}
                      >
                        {row.max_days} дн.
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onNotify(row)}
                        className="h-8 gap-1.5 text-xs font-medium border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40"
                      >
                        <Send className="w-3 h-3" />
                        Уведомить
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
