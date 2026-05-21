'use client';

import { useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock4, AlertTriangle, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { StatusDonut } from '@/components/dashboard/status-donut';
import { ProcessFunnel } from '@/components/dashboard/process-funnel';
import { IntakeAreaChart } from '@/components/dashboard/intake-area-chart';
import { ContractorBars, type ContractorBarRow } from '@/components/dashboard/contractor-bars';
import { TopProjects, type TopProjectRow } from '@/components/dashboard/top-projects';
import { OverdueTable, type OverdueRow } from '@/components/dashboard/overdue-table';
import {
  NotificationDialog,
  type NotificationTarget,
} from '@/components/dashboard/notification-dialog';
import { PeriodSwitcher, type Period } from '@/components/dashboard/period-switcher';
import { LiveIndicator } from '@/components/dashboard/live-indicator';
import type { ApartmentStatus } from '@/lib/types/database';

interface KpiSeries {
  value: number;
  delta: number;
  sparkline: number[];
}

interface OverviewDashboardViewProps {
  kpi: {
    inWork: KpiSeries;
    done: KpiSeries;
    cycle: KpiSeries;
    overdue: KpiSeries;
  };
  statusCounts: Record<ApartmentStatus, number>;
  total: number;
  doneTotal: number;
  funnel: { key: string; label: string; value: number; color: string }[];
  intakeData: { week: string; intake: number; completed: number }[];
  contractorBars: ContractorBarRow[];
  topProjects: TopProjectRow[];
  overdueRows: OverdueRow[];
  notificationTargets: NotificationTarget[];
  sentLast7d: number;
}

function formatTodayRu(): string {
  const d = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const weekdays = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${weekdays[d.getDay()]}`;
}

export function OverviewDashboardView({
  kpi,
  statusCounts,
  total,
  doneTotal,
  funnel,
  intakeData,
  contractorBars,
  topProjects,
  overdueRows,
  notificationTargets,
  sentLast7d,
}: OverviewDashboardViewProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialContractor, setInitialContractor] = useState<string | null>(null);

  const updatedAt = useMemo(() => new Date(), []);
  const todayLabel = useMemo(() => formatTodayRu(), []);
  const completionRate = total > 0 ? Math.round((doneTotal / total) * 100) : 0;

  function openDialog(contractorId: string | null) {
    setInitialContractor(contractorId);
    setDialogOpen(true);
  }

  return (
    <div className="relative -mx-4 -my-4 sm:-mx-6 sm:-my-6 px-4 py-6 sm:px-6 sm:py-8 dashboard-grid-bg min-h-[calc(100vh-2rem)]">
      {/* ===== Hero ===== */}
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 stagger-in" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-gray-400 font-mono-tabular">
              {todayLabel}
            </span>
            <LiveIndicator updatedAt={updatedAt} />
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 font-display">
              Аналитика ДКП
            </h1>
            <span className="text-sm text-gray-500 font-mono-tabular">·  {total} квартир</span>
          </div>
          <p className="text-sm text-gray-500 max-w-xl">
            Сводка по платформе экспертиз отделки. Конверсия:{' '}
            <span className="text-gray-900 font-mono-tabular font-semibold">{completionRate}%</span>
            {' · '}готово{' '}
            <span className="text-gray-900 font-mono-tabular font-semibold">{doneTotal}</span> из {total}
          </p>
        </div>

        <div className="flex items-center gap-2 stagger-in" style={{ animationDelay: '60ms' }}>
          <PeriodSwitcher value={period} onChange={setPeriod} />
          <Button
            onClick={() => openDialog(null)}
            className="gap-2 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.4)]"
          >
            <Send className="w-4 h-4" />
            Отправить уведомление
          </Button>
        </div>
      </div>

      {/* ===== KPI ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="В работе"
          value={kpi.inWork.value}
          delta={kpi.inWork.delta}
          deltaLabel="нов. за 7 дн"
          sparkline={kpi.inWork.sparkline}
          accent="indigo"
          icon={Briefcase}
          deltaPositive="up"
          staggerDelay={80}
        />
        <KpiCard
          label="Готово за 7 дней"
          value={kpi.done.value}
          delta={kpi.done.delta}
          deltaLabel="к пред. нед."
          sparkline={kpi.done.sparkline}
          accent="emerald"
          icon={CheckCircle2}
          deltaPositive="up"
          staggerDelay={160}
        />
        <KpiCard
          label="Средний цикл"
          value={kpi.cycle.value}
          unit="дн."
          delta={kpi.cycle.delta}
          deltaLabel="к пред. срезу"
          sparkline={kpi.cycle.sparkline}
          accent="amber"
          icon={Clock4}
          deltaPositive="down"
          staggerDelay={240}
        />
        <KpiCard
          label="Просрочка подрядчиков"
          value={kpi.overdue.value}
          delta={kpi.overdue.delta}
          deltaLabel="к пред. срезу"
          sparkline={kpi.overdue.sparkline}
          accent="red"
          icon={AlertTriangle}
          deltaPositive="down"
          staggerDelay={320}
        />
      </div>

      {/* ===== Графики ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="stagger-in" style={{ animationDelay: '380ms' }}>
            <ProcessFunnel stages={funnel} />
          </div>
          <div className="stagger-in" style={{ animationDelay: '440ms' }}>
            <IntakeAreaChart data={intakeData} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="stagger-in h-full" style={{ animationDelay: '420ms' }}>
            <StatusDonut counts={statusCounts} total={total} />
          </div>
          <div className="stagger-in" style={{ animationDelay: '480ms' }}>
            <TopProjects data={topProjects} />
          </div>
        </div>
      </div>

      {/* ===== Подрядчики ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 stagger-in" style={{ animationDelay: '520ms' }}>
          <ContractorBars data={contractorBars} />
        </div>
        <div className="lg:col-span-2 stagger-in" style={{ animationDelay: '560ms' }}>
          <OverdueTable
            rows={overdueRows}
            onNotify={(row) => openDialog(row.contractor_id)}
          />
        </div>
      </div>

      {/* ===== Footer ===== */}
      <div className="mt-6 pt-4 border-t border-gray-200/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-gray-500">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Платформа экспертиз ДКП · «Самолёт»</span>
        </div>
        <div className="text-gray-500">
          Отправлено уведомлений за 7 дней:{' '}
          <span className="font-mono-tabular font-semibold text-gray-900">{sentLast7d}</span>
        </div>
      </div>

      <NotificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        targets={notificationTargets}
        initialContractorId={initialContractor}
      />
    </div>
  );
}
