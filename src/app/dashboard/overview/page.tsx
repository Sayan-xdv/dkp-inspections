import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STATUS_CONFIG, type ApartmentStatus } from '@/lib/types/database';
import { isOverdueByContractor, daysOverdue } from '@/lib/workflow/overdue';
import { OverviewDashboardView } from './dashboard-view';
import type { ContractorBarRow } from '@/components/dashboard/contractor-bars';
import type { OverdueRow } from '@/components/dashboard/overdue-table';
import type { TopProjectRow } from '@/components/dashboard/top-projects';
import type { NotificationTarget } from '@/components/dashboard/notification-dialog';

const MS_IN_DAY = 86_400_000;
const WEEK_MS = 7 * MS_IN_DAY;
const WEEKS = 8;

export const dynamic = 'force-dynamic';

interface ApartmentLite {
  id: string;
  status: ApartmentStatus;
  contractor_id: string | null;
  project_name: string;
  receipt_date: string;
  assigned_at: string | null;
  completed_at: string | null;
  uploaded_to_crm_at: string | null;
  deadline: string | null;
}

interface ContractorLite {
  id: string;
  name: string;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'sales')) {
    redirect('/dashboard');
  }

  const [{ data: aptsData }, { data: contractorsData }, { data: notifData }] = await Promise.all([
    supabase.from('apartments').select(
      'id,status,contractor_id,project_name,receipt_date,assigned_at,completed_at,uploaded_to_crm_at,deadline'
    ),
    supabase.from('contractors').select('id,name').eq('is_active', true).order('name'),
    supabase
      .from('notifications')
      .select('id,sent_at')
      .gte('sent_at', new Date(Date.now() - 7 * MS_IN_DAY).toISOString()),
  ]);

  const apartments: ApartmentLite[] = (aptsData ?? []) as ApartmentLite[];
  const contractors: ContractorLite[] = (contractorsData ?? []) as ContractorLite[];
  const sentLast7d = notifData?.length ?? 0;

  // ===== Распределение по статусам =====
  const statusCounts: Record<ApartmentStatus, number> = {
    pending_keys: 0,
    keys_unavailable: 0,
    keys_available: 0,
    assigned: 0,
    in_progress: 0,
    rejected: 0,
    completed: 0,
    uploaded_to_crm: 0,
  };
  for (const a of apartments) statusCounts[a.status] += 1;

  const total = apartments.length;

  // ===== KPI =====
  const inWork = statusCounts.pending_keys + statusCounts.keys_unavailable +
                 statusCounts.keys_available + statusCounts.assigned + statusCounts.in_progress;
  const doneTotal = statusCounts.completed + statusCounts.uploaded_to_crm;

  const now = Date.now();
  const last7Cutoff = now - 7 * MS_IN_DAY;
  const prev7Cutoff = now - 14 * MS_IN_DAY;

  const completedLast7 = apartments.filter((a) => {
    if (!a.completed_at) return false;
    const t = new Date(a.completed_at).getTime();
    return t >= last7Cutoff;
  }).length;
  const completedPrev7 = apartments.filter((a) => {
    if (!a.completed_at) return false;
    const t = new Date(a.completed_at).getTime();
    return t >= prev7Cutoff && t < last7Cutoff;
  }).length;

  const intakeLast7 = apartments.filter((a) => {
    const t = new Date(a.receipt_date).getTime();
    return t >= last7Cutoff;
  }).length;
  const intakePrev7 = apartments.filter((a) => {
    const t = new Date(a.receipt_date).getTime();
    return t >= prev7Cutoff && t < last7Cutoff;
  }).length;

  // Средний цикл (от receipt_date до completed_at) — дней
  const cyclesAll: number[] = [];
  const cyclesPrev: number[] = [];
  for (const a of apartments) {
    if (!a.completed_at) continue;
    const days = (new Date(a.completed_at).getTime() - new Date(a.receipt_date).getTime()) / MS_IN_DAY;
    cyclesAll.push(days);
    if (new Date(a.completed_at).getTime() < last7Cutoff) cyclesPrev.push(days);
  }
  const avgCycle = cyclesAll.length ? cyclesAll.reduce((s, v) => s + v, 0) / cyclesAll.length : 0;
  const avgCyclePrev = cyclesPrev.length ? cyclesPrev.reduce((s, v) => s + v, 0) / cyclesPrev.length : avgCycle;
  const cycleDelta = +(avgCycle - avgCyclePrev).toFixed(1);

  // Просрочка
  const overdueApts = apartments.filter((a) => isOverdueByContractor(a));
  const overdueCount = overdueApts.length;

  // Сколько квартир было просрочено неделю назад (по assigned_at/completed_at)
  const weekAgoTs = now - 7 * MS_IN_DAY;
  const overdueSevenDaysAgo = apartments.filter((a) => {
    if (!a.assigned_at) return false;
    const assignedTs = new Date(a.assigned_at).getTime();
    if (assignedTs > weekAgoTs) return false;                      // ещё не была назначена
    if ((weekAgoTs - assignedTs) / MS_IN_DAY <= 7) return false;   // SLA ещё не истёк на тот момент
    if (a.completed_at && new Date(a.completed_at).getTime() <= weekAgoTs) return false; // уже была закрыта
    return true;
  }).length;
  const overdueDelta = overdueCount - overdueSevenDaysAgo;

  // ===== Sparklines (8 недель) =====
  const weekBuckets: { start: Date; intake: number; completed: number; overdueCount: number; cycle: number; cycleN: number; inWork: number }[] = [];
  const todayStart = startOfWeek(new Date());
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(todayStart.getTime() - i * WEEK_MS);
    weekBuckets.push({ start, intake: 0, completed: 0, overdueCount: 0, cycle: 0, cycleN: 0, inWork: 0 });
  }
  function weekIndex(d: Date): number {
    const t = d.getTime();
    for (let i = weekBuckets.length - 1; i >= 0; i--) {
      if (t >= weekBuckets[i].start.getTime()) return i;
    }
    return -1;
  }
  for (const a of apartments) {
    const rIdx = weekIndex(new Date(a.receipt_date));
    if (rIdx >= 0) weekBuckets[rIdx].intake += 1;
    if (a.completed_at) {
      const cIdx = weekIndex(new Date(a.completed_at));
      if (cIdx >= 0) {
        weekBuckets[cIdx].completed += 1;
        const cycle = (new Date(a.completed_at).getTime() - new Date(a.receipt_date).getTime()) / MS_IN_DAY;
        weekBuckets[cIdx].cycle += cycle;
        weekBuckets[cIdx].cycleN += 1;
      }
    }
  }
  // inWork sparkline — приближение: intake минус completed накопительно
  let runningInWork = 0;
  for (const w of weekBuckets) {
    runningInWork += w.intake - w.completed;
    w.inWork = Math.max(0, runningInWork);
  }

  const weekLabels = weekBuckets.map((w) => {
    const d = w.start;
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const sparklineIntake = weekBuckets.map((w) => w.intake);
  const sparklineCompleted = weekBuckets.map((w) => w.completed);
  const sparklineCycle = weekBuckets.map((w) => (w.cycleN > 0 ? +(w.cycle / w.cycleN).toFixed(1) : 0));
  const sparklineInWork = weekBuckets.map((w) => w.inWork);
  // overdue sparkline — приближение для MVP: понедельная история просрочек
  // не хранится, тренд интерполируется между прошлым и текущим значением
  const overdueBase = Math.max(0, Math.min(overdueSevenDaysAgo, overdueCount));
  const sparklineOverdue = weekBuckets.map((_, i) => overdueBase + Math.round((overdueCount - overdueBase) * (i / (WEEKS - 1))));

  const intakeData = weekBuckets.map((w, i) => ({
    week: weekLabels[i],
    intake: w.intake,
    completed: w.completed,
  }));

  // ===== Воронка =====
  const funnelStages = [
    { key: 'pending_keys', label: 'Поступило', value: total, color: '#94a3b8' },
    { key: 'keys_available', label: 'Получены ключи',
      value: total - statusCounts.pending_keys - statusCounts.keys_unavailable, color: '#3b82f6' },
    { key: 'assigned', label: 'Назначено подрядчику',
      value: statusCounts.assigned + statusCounts.in_progress + statusCounts.rejected + statusCounts.completed + statusCounts.uploaded_to_crm,
      color: '#6366f1' },
    { key: 'in_progress', label: 'В работе',
      value: statusCounts.in_progress + statusCounts.completed + statusCounts.uploaded_to_crm,
      color: '#a855f7' },
    { key: 'completed', label: 'Готово',
      value: statusCounts.completed + statusCounts.uploaded_to_crm,
      color: '#14b8a6' },
    { key: 'uploaded_to_crm', label: 'Загружено в CRM',
      value: statusCounts.uploaded_to_crm,
      color: '#10b981' },
  ];

  // ===== Контракторы (Group Bar) =====
  const byContractor = new Map<string, ContractorBarRow>();
  for (const c of contractors) {
    byContractor.set(c.id, {
      name: c.name,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    });
  }
  for (const a of apartments) {
    if (!a.contractor_id) continue;
    const row = byContractor.get(a.contractor_id);
    if (!row) continue;
    if (a.status === 'assigned') row.assigned += 1;
    else if (a.status === 'in_progress') row.in_progress += 1;
    else if (a.status === 'completed' || a.status === 'uploaded_to_crm') row.completed += 1;
    if (isOverdueByContractor(a)) row.overdue += 1;
  }
  const contractorBarsData = Array.from(byContractor.values());

  // ===== Top projects =====
  const byProject = new Map<string, TopProjectRow>();
  for (const a of apartments) {
    const key = a.project_name;
    if (!byProject.has(key)) byProject.set(key, { name: key, total: 0, completed: 0 });
    const r = byProject.get(key)!;
    r.total += 1;
    if (a.status === 'completed' || a.status === 'uploaded_to_crm') r.completed += 1;
  }
  const topProjectsData = Array.from(byProject.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // ===== Overdue table =====
  const overdueByContractor = new Map<string, OverdueRow>();
  for (const c of contractors) {
    overdueByContractor.set(c.id, {
      contractor_id: c.id,
      contractor_name: c.name,
      count: 0,
      max_days: 0,
      apartment_ids: [],
    });
  }
  for (const a of overdueApts) {
    if (!a.contractor_id) continue;
    const r = overdueByContractor.get(a.contractor_id);
    if (!r) continue;
    r.count += 1;
    r.apartment_ids.push(a.id);
    const dod = daysOverdue(a);
    if (dod > r.max_days) r.max_days = dod;
  }
  const overdueRows = Array.from(overdueByContractor.values())
    .filter((r) => r.count > 0)
    .sort((a, b) => b.max_days - a.max_days);

  // ===== Notification targets =====
  const notificationTargets: NotificationTarget[] = [
    {
      contractor_id: null,
      contractor_name: 'Все подрядчики (рассылка)',
      count: overdueCount,
      apartment_ids: overdueApts.map((a) => a.id).slice(0, 20),
    },
    ...contractors.map((c) => {
      const row = overdueByContractor.get(c.id);
      return {
        contractor_id: c.id,
        contractor_name: c.name,
        count: row?.count ?? 0,
        apartment_ids: row?.apartment_ids ?? [],
      };
    }),
  ];

  return (
    <OverviewDashboardView
      kpi={{
        inWork: { value: inWork, delta: intakeLast7 - intakePrev7, sparkline: sparklineInWork },
        done: { value: completedLast7, delta: completedLast7 - completedPrev7, sparkline: sparklineCompleted },
        cycle: { value: +avgCycle.toFixed(1), delta: cycleDelta, sparkline: sparklineCycle },
        overdue: { value: overdueCount, delta: overdueDelta, sparkline: sparklineOverdue },
      }}
      statusCounts={statusCounts}
      total={total}
      doneTotal={doneTotal}
      funnel={funnelStages}
      intakeData={intakeData}
      contractorBars={contractorBarsData}
      topProjects={topProjectsData}
      overdueRows={overdueRows}
      notificationTargets={notificationTargets}
      sentLast7d={sentLast7d}
    />
  );
}
