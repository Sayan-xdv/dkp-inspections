'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/apartments/status-badge';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Apartment, ApartmentStatus, Contractor, Project } from '@/lib/types/database';
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

    const { data, count } = await query;
    setApartments(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, dateFrom, dateTo, projectFilter, statusFilter, contractorFilter]);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Реестр квартир</h1>
        <Button variant="outline" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-2" />
          Экспорт Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Дом</TableHead>
                  <TableHead>Кв.</TableHead>
                  <TableHead>м²</TableHead>
                  <TableHead>Отделка</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Подрядчик</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : apartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      Нет данных
                    </TableCell>
                  </TableRow>
                ) : (
                  apartments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="whitespace-nowrap">{apt.receipt_date}</TableCell>
                      <TableCell className="font-medium">{apt.project_name}</TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                      <TableCell>{apt.building_number}</TableCell>
                      <TableCell>{apt.apartment_number}</TableCell>
                      <TableCell>{apt.area_sqm}</TableCell>
                      <TableCell>{apt.finish_type}</TableCell>
                      <TableCell><StatusBadge status={apt.status} /></TableCell>
                      <TableCell>{(apt.contractor as unknown as { name: string })?.name ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-gray-500">
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
        </CardContent>
      </Card>
    </div>
  );
}
