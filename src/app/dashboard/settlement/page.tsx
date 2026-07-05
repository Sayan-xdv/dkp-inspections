'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/apartments/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';
import { RejectDialog } from '@/components/apartments/reject-dialog';
import { CrmSearch, filterByCrmCode } from '@/components/apartments/crm-search';
import { Key, Check, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { allowedSourceStatuses } from '@/lib/workflow/state-machine';
import type { Apartment } from '@/lib/types/database';

type TabKey = 'pending_keys' | 'rejected' | 'keys_unavailable';

export default function SettlementPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('pending_keys');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({ pending_keys: 0, rejected: 0, keys_unavailable: 0 });
  const [crmSearch, setCrmSearch] = useState('');

  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingAptId, setRejectingAptId] = useState('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('apartments')
      .select('*')
      .in('status', ['pending_keys', 'rejected', 'keys_unavailable'])
      .order('receipt_date', { ascending: false });

    const all = data ?? [];
    setCounts({
      pending_keys: all.filter(a => a.status === 'pending_keys').length,
      rejected: all.filter(a => a.status === 'rejected').length,
      keys_unavailable: all.filter(a => a.status === 'keys_unavailable').length,
    });
    setApartments(all.filter(a => a.status === tab));
    setSelected(new Set());
    setLoading(false);
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  async function confirmKeys(aptId: string) {
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'keys_available',
        keys_available: true,
        keys_confirmed_at: new Date().toISOString(),
      })
      .eq('id', aptId)
      .in('status', allowedSourceStatuses('keys_available', 'settlement'));

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success('Ключи подтверждены');
      loadData();
    }
  }

  async function bulkConfirmKeys() {
    if (selected.size === 0) return;
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'keys_available',
        keys_available: true,
        keys_confirmed_at: new Date().toISOString(),
      })
      .in('id', Array.from(selected))
      .in('status', allowedSourceStatuses('keys_available', 'settlement'));

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success(`Ключи подтверждены: ${selected.size} квартир`);
      loadData();
    }
  }

  async function rejectKeys(reasonId: string, note: string) {
    if (!rejectingAptId || !reasonId) return;
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'keys_unavailable',
        keys_available: false,
        rejection_reason_id: reasonId,
        rejection_note: note || null,
      })
      .eq('id', rejectingAptId)
      .in('status', allowedSourceStatuses('keys_unavailable', 'settlement'));

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success('Отмечено: ключей нет');
      loadData();
    }
  }

  async function returnToQueue(aptId: string) {
    const { error } = await supabase
      .from('apartments')
      .update({ status: 'pending_keys', rejection_note: null, rejection_reason_id: null })
      .eq('id', aptId)
      .in('status', allowedSourceStatuses('pending_keys', 'settlement'));

    if (error) toast.error('Ошибка: ' + error.message);
    else { toast.success('Возвращено в очередь'); loadData(); }
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'pending_keys', label: 'Ожидают ключей', icon: <Key size={16} /> },
    { key: 'rejected', label: 'Возвраты', icon: <RotateCcw size={16} /> },
    { key: 'keys_unavailable', label: 'Без ключей', icon: <AlertTriangle size={16} /> },
  ];

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const filteredApartments = filterByCrmCode(apartments, crmSearch);

  const toggleAll = () => {
    if (selected.size === filteredApartments.length) setSelected(new Set());
    else setSelected(new Set(filteredApartments.map(a => a.id)));
  };

  const colCount = tab === 'pending_keys' ? 9 : 8;
  const headClass = 'text-[10px] uppercase tracking-wider text-gray-400 font-medium';

  return (
    <div>
      <PageHeader title="Очередь ключей" subtitle="Подтверждение доступа в квартиры" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap stagger-in" style={{ animationDelay: '80ms' }}>
        {tabs.map(t => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.key)}
            className={tab === t.key
              ? 'gap-2 bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'gap-2'}
          >
            {t.icon}
            {t.label}
            <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full font-mono-tabular">
              {counts[t.key]}
            </span>
          </Button>
        ))}
      </div>

      {/* CRM search */}
      <div className="mb-4 stagger-in" style={{ animationDelay: '140ms' }}>
        <CrmSearch value={crmSearch} onChange={setCrmSearch} />
      </div>

      {/* Bulk action */}
      {selected.size > 0 && tab === 'pending_keys' && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-green-700">
            Выбрано: <span className="font-mono-tabular">{selected.size}</span>
          </span>
          <Button size="sm" onClick={bulkConfirmKeys} className="bg-green-600 hover:bg-green-700">
            <Check size={16} className="mr-1" /> Ключи есть для выбранных
          </Button>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden stagger-in"
        style={{ animationDelay: '200ms' }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {tab === 'pending_keys' && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filteredApartments.length && filteredApartments.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead className={headClass}>Код CRM</TableHead>
                <TableHead className={headClass}>Проект</TableHead>
                <TableHead className={headClass}>Адрес</TableHead>
                <TableHead className={headClass}>Дом</TableHead>
                <TableHead className={headClass}>Кв.</TableHead>
                <TableHead className={headClass}>м²</TableHead>
                <TableHead className={headClass}>Статус</TableHead>
                <TableHead className={headClass}>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={colCount} />
              ) : filteredApartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount}>
                    <EmptyState
                      icon={Key}
                      title="Нет квартир в этой категории"
                      description={crmSearch.trim() ? 'Попробуйте изменить запрос поиска' : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredApartments.map((apt) => (
                  <TableRow key={apt.id}>
                    {tab === 'pending_keys' && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(apt.id)}
                          onCheckedChange={() => toggleSelect(apt.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap text-xs text-gray-500 font-mono-tabular">{apt.crm_code}</TableCell>
                    <TableCell className="font-medium">{apt.project_name}</TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                    <TableCell>{apt.building_number}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.apartment_number}</TableCell>
                    <TableCell className="font-mono-tabular">{apt.area_sqm}</TableCell>
                    <TableCell><StatusBadge status={apt.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(tab === 'pending_keys' || tab === 'rejected') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => confirmKeys(apt.id)}
                          >
                            <Check size={14} className="mr-1" /> Ключи есть
                          </Button>
                        )}
                        {tab === 'pending_keys' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => {
                              setRejectingAptId(apt.id);
                              setRejectDialogOpen(true);
                            }}
                          >
                            <X size={14} className="mr-1" /> Нет ключей
                          </Button>
                        )}
                        {tab === 'keys_unavailable' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => returnToQueue(apt.id)}
                          >
                            <RotateCcw size={14} className="mr-1" /> Вернуть в очередь
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

      {/* Rejection dialog */}
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title="Причина отсутствия ключей"
        onConfirm={rejectKeys}
      />
    </div>
  );
}
