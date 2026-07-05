import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Building2, Key, HardHat, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export default async function SalesDashboard() {
  const supabase = await createClient();

  const { data: apartments } = await supabase
    .from('apartments')
    .select('status');

  const counts = {
    total: apartments?.length ?? 0,
    pending: apartments?.filter(a => ['pending_keys', 'keys_unavailable'].includes(a.status)).length ?? 0,
    working: apartments?.filter(a => ['assigned', 'in_progress', 'keys_available'].includes(a.status)).length ?? 0,
    done: apartments?.filter(a => ['completed', 'uploaded_to_crm'].includes(a.status)).length ?? 0,
    rejected: apartments?.filter(a => a.status === 'rejected').length ?? 0,
  };

  return (
    <div>
      <PageHeader title="Дашборд продаж" subtitle="Сводка по квартирам в работе" />

      {counts.total === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] stagger-in">
          <EmptyState
            icon={FileSpreadsheet}
            title="Пока нет квартир"
            description="Загрузите Excel из CRM, чтобы наполнить реестр и начать работу."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Всего квартир" value={counts.total} icon={Building2} accent="indigo" staggerDelay={80} />
            <KpiCard label="Ожидают ключей" value={counts.pending} icon={Key} accent="amber" staggerDelay={160} />
            <KpiCard label="В работе" value={counts.working} icon={HardHat} accent="purple" staggerDelay={240} />
            <KpiCard label="Готово" value={counts.done} icon={CheckCircle2} accent="emerald" staggerDelay={320} />
          </div>

          {counts.rejected > 0 && (
            <div
              className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] stagger-in"
              style={{ animationDelay: '400ms' }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900">
                  <span className="font-mono-tabular">{counts.rejected}</span> квартир(ы) возвращены подрядчиками
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Требуется обеспечить доступ — передайте в офис заселения.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
