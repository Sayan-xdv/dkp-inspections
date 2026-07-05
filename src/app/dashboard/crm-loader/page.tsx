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
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CrmSearch, filterByCrmCode } from '@/components/apartments/crm-search';
import { Download, FileDown, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { allowedSourceStatuses } from '@/lib/workflow/state-machine';
import type { Apartment, Project } from '@/lib/types/database';

type TabKey = 'completed' | 'uploaded_to_crm';

export default function CrmLoaderPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('completed');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [counts, setCounts] = useState({ completed: 0, uploaded_to_crm: 0 });
  const [crmSearch, setCrmSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    supabase.from('projects').select('*').order('name').then(({ data }) => setProjects(data ?? []));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Get counts
    const { data: allData } = await supabase
      .from('apartments')
      .select('status')
      .in('status', ['completed', 'uploaded_to_crm']);

    setCounts({
      completed: (allData ?? []).filter(a => a.status === 'completed').length,
      uploaded_to_crm: (allData ?? []).filter(a => a.status === 'uploaded_to_crm').length,
    });

    let query = supabase
      .from('apartments')
      .select('*, contractor:contractors(name)')
      .eq('status', tab)
      .order('completed_at', { ascending: false });

    if (projectFilter !== 'all') query = query.eq('project_name', projectFilter);
    if (dateFrom) query = query.gte('completed_at', dateFrom);
    if (dateTo) query = query.lte('completed_at', dateTo + 'T23:59:59');

    const { data } = await query;
    setApartments(data ?? []);
    setSelected(new Set());
    setLoading(false);
  }, [tab, projectFilter, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  async function downloadPdf(apt: Apartment) {
    if (!apt.report_file_path) {
      toast.error('PDF не найден');
      return;
    }
    const { data, error } = await supabase.storage
      .from('inspection-reports')
      .download(apt.report_file_path);

    if (error || !data) {
      toast.error('Ошибка скачивания: ' + (error?.message ?? 'файл не найден'));
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${apt.crm_code.replace(/[/\\]/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadSelectedZip() {
    const selectedApts = apartments.filter(a => selected.has(a.id) && a.report_file_path);
    if (selectedApts.length === 0) { toast.error('Нет файлов для скачивания'); return; }

    setDownloading(true);
    const zip = new JSZip();
    let added = 0;

    for (const apt of selectedApts) {
      const { data } = await supabase.storage
        .from('inspection-reports')
        .download(apt.report_file_path!);
      if (data) {
        zip.file(`${apt.crm_code.replace(/[/\\]/g, '_')}.pdf`, data);
        added++;
      }
    }

    if (added === 0) {
      setDownloading(false);
      toast.error('Файлы отчётов не найдены в хранилище');
      return;
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Экспертизы_${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);

    if (added < selected.size) {
      toast.warning(`Скачано ${added} из ${selected.size} файлов — остальные не найдены в хранилище`);
    } else {
      toast.success(`Скачано файлов: ${added}`);
    }
  }

  async function markUploaded(aptId: string) {
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'uploaded_to_crm',
        uploaded_to_crm_at: new Date().toISOString(),
      })
      .eq('id', aptId)
      .in('status', allowedSourceStatuses('uploaded_to_crm', 'crm_loader'));

    if (error) toast.error('Ошибка: ' + error.message);
    else { toast.success('Отмечено как загруженное'); loadData(); }
  }

  async function bulkMarkUploaded() {
    if (selected.size === 0) return;
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'uploaded_to_crm',
        uploaded_to_crm_at: new Date().toISOString(),
      })
      .in('id', Array.from(selected))
      .in('status', allowedSourceStatuses('uploaded_to_crm', 'crm_loader'));

    if (error) toast.error('Ошибка: ' + error.message);
    else { toast.success(`Отмечено: ${selected.size} квартир`); loadData(); }
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      apartments.map(a => ({
        'Код CRM': a.crm_code,
        'Проект': a.project_name,
        'Адрес': a.address,
        'Дом': a.building_number,
        'Квартира': a.apartment_number,
        'Площадь': a.area_sqm,
        'Отделка': a.finish_type,
        'Подрядчик': (a.contractor as unknown as { name: string })?.name ?? '',
        'Дата экспертизы': a.completed_at ? new Date(a.completed_at).toLocaleDateString('ru') : '',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Экспертизы');
    XLSX.writeFile(wb, `Экспертизы_для_CRM_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel экспортирован');
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const filteredApartments = filterByCrmCode(apartments, crmSearch);

  const toggleAll = () => {
    if (selected.size === filteredApartments.length) setSelected(new Set());
    else setSelected(new Set(filteredApartments.map(a => a.id)));
  };

  const uniqueProjects = [...new Set(projects.map(p => p.name))].sort();

  const colCount = tab === 'completed' ? 8 : 7;
  const headClass = 'text-[10px] uppercase tracking-wider text-gray-400 font-medium';

  return (
    <div>
      <PageHeader
        title="Готовые экспертизы"
        subtitle="Скачивание отчётов и отметка загрузки в CRM"
        actions={
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Экспорт Excel
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4 stagger-in" style={{ animationDelay: '60ms' }}>
        <Button
          variant={tab === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('completed')}
          className="gap-2"
        >
          Готовые
          <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full font-mono-tabular">
            {counts.completed}
          </span>
        </Button>
        <Button
          variant={tab === 'uploaded_to_crm' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('uploaded_to_crm')}
          className="gap-2"
        >
          Загруженные
          <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full font-mono-tabular">
            {counts.uploaded_to_crm}
          </span>
        </Button>
      </div>

      {/* Filters */}
      <div
        className="mb-4 rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-4 stagger-in"
        style={{ animationDelay: '120ms' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Код CRM</label>
            <CrmSearch value={crmSearch} onChange={setCrmSearch} className="max-w-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Дата от</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Дата до</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Проект</label>
            <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v ?? 'all')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все проекты</SelectItem>
                {uniqueProjects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && tab === 'completed' && (
        <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-indigo-700">
            Выбрано: <span className="font-mono-tabular font-medium">{selected.size}</span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadSelectedZip} disabled={downloading}>
              {downloading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileDown size={14} className="mr-1" />}
              Скачать ZIP
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 size={14} className="mr-1" /> Отметить загруженными
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden stagger-in"
        style={{ animationDelay: '180ms' }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {tab === 'completed' && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filteredApartments.length && filteredApartments.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead className={headClass}>Код CRM</TableHead>
                <TableHead className={headClass}>Дата</TableHead>
                <TableHead className={headClass}>Проект</TableHead>
                <TableHead className={headClass}>Адрес</TableHead>
                <TableHead className={headClass}>Кв.</TableHead>
                <TableHead className={headClass}>Подрядчик</TableHead>
                <TableHead className={headClass}>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={colCount} />
              ) : filteredApartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="p-0">
                    <EmptyState
                      icon={Download}
                      title={tab === 'completed' ? 'Нет готовых экспертиз' : 'Нет загруженных экспертиз'}
                      description={
                        crmSearch.trim()
                          ? 'По заданному коду CRM ничего не найдено — проверьте фильтры'
                          : 'Записи появятся здесь, когда подрядчики завершат экспертизы'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredApartments.map(apt => (
                  <TableRow key={apt.id}>
                    {tab === 'completed' && (
                      <TableCell>
                        <Checkbox checked={selected.has(apt.id)} onCheckedChange={() => toggleSelect(apt.id)} />
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap text-xs text-gray-500 font-mono-tabular">{apt.crm_code}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {apt.completed_at ? new Date(apt.completed_at).toLocaleDateString('ru') : '—'}
                    </TableCell>
                    <TableCell className="font-medium">{apt.project_name}</TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.apartment_number}</TableCell>
                    <TableCell>{(apt.contractor as unknown as { name: string })?.name ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {apt.report_file_path && (
                          <Button size="sm" variant="outline" onClick={() => downloadPdf(apt)}>
                            <Download size={14} className="mr-1" /> PDF
                          </Button>
                        )}
                        {tab === 'completed' && (
                          <Button size="sm" onClick={() => markUploaded(apt.id)}>
                            <CheckCircle2 size={14} className="mr-1" /> В CRM
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Отметить загрузку в CRM?"
        description={`Выбрано квартир: ${selected.size}. Действие переводит их в финальный статус.`}
        confirmLabel="Отметить"
        onConfirm={bulkMarkUploaded}
      />
    </div>
  );
}
