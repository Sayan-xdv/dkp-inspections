'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/apartments/status-badge';
import { Key, Check, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Apartment, ApartmentStatus, RejectionReason } from '@/lib/types/database';

type TabKey = 'pending_keys' | 'rejected' | 'keys_unavailable';

export default function SettlementPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('pending_keys');
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({ pending_keys: 0, rejected: 0, keys_unavailable: 0 });

  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingAptId, setRejectingAptId] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');

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

  useEffect(() => {
    supabase.from('rejection_reasons').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setReasons(data ?? []));
  }, []);

  async function confirmKeys(aptId: string) {
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'keys_available',
        keys_available: true,
        keys_confirmed_at: new Date().toISOString(),
      })
      .eq('id', aptId);

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
      .in('id', Array.from(selected));

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success(`Ключи подтверждены: ${selected.size} квартир`);
      loadData();
    }
  }

  async function rejectKeys() {
    if (!rejectingAptId || !selectedReason) return;
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'keys_unavailable',
        keys_available: false,
        rejection_reason_id: selectedReason,
        rejection_note: rejectionNote || null,
      })
      .eq('id', rejectingAptId);

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success('Отмечено: ключей нет');
      setRejectDialogOpen(false);
      setRejectionNote('');
      setSelectedReason('');
      loadData();
    }
  }

  async function returnToQueue(aptId: string) {
    const { error } = await supabase
      .from('apartments')
      .update({ status: 'pending_keys', rejection_note: null, rejection_reason_id: null })
      .eq('id', aptId);

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

  const toggleAll = () => {
    if (selected.size === apartments.length) setSelected(new Set());
    else setSelected(new Set(apartments.map(a => a.id)));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Управление ключами</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.key)}
            className="gap-2"
          >
            {t.icon}
            {t.label}
            <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
              {counts[t.key]}
            </span>
          </Button>
        ))}
      </div>

      {/* Bulk action */}
      {selected.size > 0 && tab === 'pending_keys' && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <span className="text-sm text-green-700">Выбрано: {selected.size}</span>
            <Button size="sm" onClick={bulkConfirmKeys} className="bg-green-600 hover:bg-green-700">
              <Check size={16} className="mr-1" /> Ключи есть для выбранных
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tab === 'pending_keys' && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === apartments.length && apartments.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Проект</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Дом</TableHead>
                  <TableHead>Кв.</TableHead>
                  <TableHead>м²</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: tab === 'pending_keys' ? 8 : 7 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : apartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tab === 'pending_keys' ? 8 : 7} className="text-center py-8 text-gray-500">
                      Нет квартир в этой категории
                    </TableCell>
                  </TableRow>
                ) : (
                  apartments.map((apt) => (
                    <TableRow key={apt.id}>
                      {tab === 'pending_keys' && (
                        <TableCell>
                          <Checkbox
                            checked={selected.has(apt.id)}
                            onCheckedChange={() => toggleSelect(apt.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{apt.project_name}</TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                      <TableCell>{apt.building_number}</TableCell>
                      <TableCell>{apt.apartment_number}</TableCell>
                      <TableCell>{apt.area_sqm}</TableCell>
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
        </CardContent>
      </Card>

      {/* Rejection dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Причина отсутствия ключей</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedReason} onValueChange={(v) => setSelectedReason(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Выберите причину" /></SelectTrigger>
              <SelectContent>
                {reasons.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Комментарий (необязательно)"
              value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Отмена</Button>
            <Button onClick={rejectKeys} disabled={!selectedReason}>Подтвердить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
