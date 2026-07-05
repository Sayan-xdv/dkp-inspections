'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/apartments/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';
import { CrmSearch } from '@/components/apartments/crm-search';
import { getWaitingDays, getWaitingColor } from '@/lib/workflow/waiting';
import { Download, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { Apartment, Contractor, Project } from '@/lib/types/database';
import { STATUS_CONFIG } from '@/lib/types/database';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 50;

export default function RegistryPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractorFilter, setContractorFilter] = useState('all');
  const [crmSearch, setCrmSearch] = useState('');

  const supabase = createClient();

  // Load reference data
  useEffect(() => {
    async function loadRefs() {
      const [c, p] = await Promise.all([
        supabase.from('contractors').select('*').order('name'),
        supabase.from('projects').select('*').order('name'),
      ]);
      setContractors(c.data ?? []);
      setProjects(p.data ?? []);
    }
    loadRefs();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('apartments')
      .select('*, contractor:contractors(name)', { count: 'exact' })
      .order('receipt_date', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateFrom) query = query.gte('receipt_date', dateFrom);
    if (dateTo) query = query.lte('receipt_date', dateTo);
    if (projectFilter !== 'all') query = query.eq('project_name', projectFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (contractorFilter !== 'all') query = query.eq('contractor_id', contractorFilter);
    if (crmSearch.trim()) query = query.ilike('crm_code', `%${crmSearch.trim()}%`);

    const { data, count } = await query;
    setApartments(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, dateFrom, dateTo, projectFilter, statusFilter, contractorFilter, crmSearch]);

  useEffect(() => { loadData(); }, [loadData]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      apartments.map(a => ({
        'Дата': a.receipt_date,
        'Проект': a.project_name,
        'Адрес': a.address,
        'Дом': a.building_number,
        'Квартира': a.apartment_number,
        'Площадь': a.area_sqm,
        'Отделка': a.finish_type,
        'Статус ОВП': a.ovp_status,
        'Статус': STATUS_CONFIG[a.status]?.label,
        'Подрядчик': (a.contractor as unknown as { name: string })?.name ?? '',
        'Код CRM': a.crm_code,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, `Реестр_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel файл скачан');
  };

  const uniqueProjects = [...new Set(projects.map(p => p.name))].sort();
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Реестр квартир"
        subtitle="Все квартиры платформы с фильтрами"
        actions={
          <Button variant="outline" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Экспорт Excel
          </Button>
        }
      />

      {/* Filters */}
      <div
        className="mb-6 rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 stagger-in"
        style={{ animationDelay: '80ms' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Код CRM</label>
            <CrmSearch
              value={crmSearch}
              onChange={v => { setCrmSearch(v); setPage(0); }}
              className="max-w-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Дата от</label>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Дата до</label>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Проект</label>
            <Select value={projectFilter} onValueChange={v => { setProjectFilter(v ?? 'all'); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все проекты</SelectItem>
                {uniqueProjects.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Статус</label>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v ?? 'all'); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Подрядчик</label>
            <Select value={contractorFilter} onValueChange={v => { setContractorFilter(v ?? 'all'); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

      {/* Table */}
      <div
        className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden stagger-in"
        style={{ animationDelay: '160ms' }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Код CRM</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Дата</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Проект</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Адрес</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Дом</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Кв.</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">м²</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Отделка</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Статус</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Подрядчик</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Ожидание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows rows={11} cols={11} />
              ) : apartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="p-0">
                    <EmptyState
                      icon={ClipboardList}
                      title="Нет данных"
                      description="Квартиры по заданным фильтрам не найдены"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                apartments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500 font-mono-tabular">{apt.crm_code}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono-tabular">{apt.receipt_date}</TableCell>
                    <TableCell className="font-medium">{apt.project_name}</TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.building_number}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.apartment_number}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.area_sqm}</TableCell>
                    <TableCell>{apt.finish_type}</TableCell>
                    <TableCell><StatusBadge status={apt.status} /></TableCell>
                    <TableCell>{(apt.contractor as unknown as { name: string })?.name ?? '—'}</TableCell>
                    <TableCell className={`font-mono-tabular ${getWaitingColor(apt.receipt_date)}`}>
                      {getWaitingDays(apt.receipt_date)} дн.
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/80">
            <span className="text-sm text-gray-500 font-mono-tabular">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
