'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/apartments/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';
import { CrmSearch, filterByCrmCode } from '@/components/apartments/crm-search';
import { getWaitingDays, getWaitingColor } from '@/lib/workflow/waiting';
import { HardHat, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Apartment, Contractor } from '@/lib/types/database';

interface ContractorStats {
  id: string;
  name: string;
  assigned: number;
  in_progress: number;
  completed: number;
  rejected: number;
  total: number;
}

const TH_CLASS = 'text-[10px] uppercase tracking-wider text-gray-400 font-medium';

export default function ContractorsOverviewPage() {
  const [contractors, setContractors] = useState<ContractorStats[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedContractor, setSelectedContractor] = useState('all');
  const [loading, setLoading] = useState(true);
  const [crmSearch, setCrmSearch] = useState('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    // Get all contractors
    const { data: contractorsList } = await supabase
      .from('contractors')
      .select('*')
      .eq('is_active', true)
      .order('name');

    // Get all apartments with contractor
    const { data: allApts } = await supabase
      .from('apartments')
      .select('*')
      .not('contractor_id', 'is', null);

    const apts = allApts ?? [];

    // Calculate stats per contractor
    const stats: ContractorStats[] = (contractorsList ?? []).map((c: Contractor) => {
      const mine = apts.filter(a => a.contractor_id === c.id);
      return {
        id: c.id,
        name: c.name,
        assigned: mine.filter(a => a.status === 'assigned').length,
        in_progress: mine.filter(a => a.status === 'in_progress').length,
        completed: mine.filter(a => a.status === 'completed' || a.status === 'uploaded_to_crm').length,
        rejected: mine.filter(a => a.status === 'rejected').length,
        total: mine.length,
      };
    });

    setContractors(stats);

    // Filter apartments for detail view
    let filtered = apts.filter(a =>
      ['assigned', 'in_progress', 'rejected'].includes(a.status)
    );
    if (selectedContractor !== 'all') {
      filtered = filtered.filter(a => a.contractor_id === selectedContractor);
    }
    filtered.sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      if (a.deadline) return -1;
      return 1;
    });

    setApartments(filtered);
    setLoading(false);
  }, [selectedContractor]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredApartments = filterByCrmCode(apartments, crmSearch);

  const totalAssigned = contractors.reduce((s, c) => s + c.assigned, 0);
  const totalInProgress = contractors.reduce((s, c) => s + c.in_progress, 0);
  const totalCompleted = contractors.reduce((s, c) => s + c.completed, 0);
  const totalRejected = contractors.reduce((s, c) => s + c.rejected, 0);

  return (
    <div>
      <PageHeader title="Обзор подрядчиков" subtitle="Нагрузка и статусы по компаниям" />

      {/* Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Назначено" value={totalAssigned} accent="indigo" icon={Clock} staggerDelay={0} />
        <KpiCard label="В работе" value={totalInProgress} accent="purple" icon={HardHat} staggerDelay={70} />
        <KpiCard label="Готово" value={totalCompleted} accent="emerald" icon={CheckCircle2} staggerDelay={140} />
        <KpiCard label="Возвраты" value={totalRejected} accent="red" icon={AlertTriangle} staggerDelay={210} />
      </div>

      {/* Contractor stats table */}
      <div
        className="stagger-in mb-6 rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ animationDelay: '280ms' }}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Статистика по подрядчикам</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH_CLASS}>Подрядчик</TableHead>
              <TableHead className={`${TH_CLASS} text-center`}>Назначено</TableHead>
              <TableHead className={`${TH_CLASS} text-center`}>В работе</TableHead>
              <TableHead className={`${TH_CLASS} text-center`}>Готово</TableHead>
              <TableHead className={`${TH_CLASS} text-center`}>Возвраты</TableHead>
              <TableHead className={`${TH_CLASS} text-center`}>Всего</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonTableRows rows={4} cols={6} />
            ) : (
              contractors.map(c => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-indigo-50/40 transition-colors"
                  onClick={() => setSelectedContractor(c.id)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-center">
                    {c.assigned > 0 ? <Badge variant="secondary" className="font-mono-tabular">{c.assigned}</Badge> : <span className="text-gray-300 font-mono-tabular">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.in_progress > 0 ? <Badge className="bg-purple-100 text-purple-700 font-mono-tabular">{c.in_progress}</Badge> : <span className="text-gray-300 font-mono-tabular">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.completed > 0 ? <Badge className="bg-green-100 text-green-700 font-mono-tabular">{c.completed}</Badge> : <span className="text-gray-300 font-mono-tabular">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.rejected > 0 ? <Badge className="bg-orange-100 text-orange-700 font-mono-tabular">{c.rejected}</Badge> : <span className="text-gray-300 font-mono-tabular">0</span>}
                  </TableCell>
                  <TableCell className="text-center font-medium font-mono-tabular">{c.total}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail: active assignments */}
      <div
        className="stagger-in rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ animationDelay: '360ms' }}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold text-gray-900">Активные задания</h2>
            <div className="flex items-center gap-3">
              <CrmSearch value={crmSearch} onChange={setCrmSearch} className="w-[200px]" />
              <Select value={selectedContractor} onValueChange={(v) => setSelectedContractor(v ?? 'all')}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все подрядчики</SelectItem>
                  {contractors.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH_CLASS}>Код CRM</TableHead>
                <TableHead className={TH_CLASS}>Проект</TableHead>
                <TableHead className={TH_CLASS}>Адрес</TableHead>
                <TableHead className={TH_CLASS}>Кв.</TableHead>
                <TableHead className={TH_CLASS}>Подрядчик</TableHead>
                <TableHead className={TH_CLASS}>Статус</TableHead>
                <TableHead className={TH_CLASS}>Ожидание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows rows={6} cols={7} />
              ) : filteredApartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={HardHat}
                      title="Нет активных заданий"
                      description="Назначенные и находящиеся в работе квартиры появятся здесь"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredApartments.map(apt => (
                  <TableRow key={apt.id}>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500 font-mono-tabular">{apt.crm_code}</TableCell>
                    <TableCell className="font-medium">{apt.project_name}</TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.apartment_number}</TableCell>
                    <TableCell>
                      {contractors.find(c => c.id === apt.contractor_id)?.name ?? '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={apt.status} /></TableCell>
                    <TableCell className={`font-mono-tabular ${getWaitingColor(apt.receipt_date)}`}>
                      {getWaitingDays(apt.receipt_date)} дн.
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
