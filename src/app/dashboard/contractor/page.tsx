'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/apartments/status-badge';
import { Upload, AlertTriangle, CheckCircle2, HardHat, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Apartment, RejectionReason } from '@/lib/types/database';

export default function ContractorPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [tab, setTab] = useState<'assigned' | 'in_progress'>('assigned');
  const [completedToday, setCompletedToday] = useState(0);

  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingAptId, setRejectingAptId] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [crmSearch, setCrmSearch] = useState('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    if (!profile?.contractor_id) return;
    setLoading(true);

    const { data } = await supabase
      .from('apartments')
      .select('*')
      .eq('contractor_id', profile.contractor_id)
      .in('status', ['assigned', 'in_progress'])
      .order('deadline', { ascending: true, nullsFirst: false });

    setApartments(data ?? []);

    // Count completed today
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('apartments')
      .select('*', { count: 'exact', head: true })
      .eq('contractor_id', profile.contractor_id)
      .eq('status', 'completed')
      .gte('completed_at', today);
    setCompletedToday(count ?? 0);

    setLoading(false);
  }, [profile?.contractor_id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    supabase.from('rejection_reasons').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setReasons(data ?? []));
  }, []);

  function getDeadlineColor(deadline: string | null): string {
    if (!deadline) return 'text-gray-400';
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-600 font-bold';
    if (days <= 2) return 'text-red-500';
    if (days <= 5) return 'text-yellow-600';
    return 'text-green-600';
  }

  function getDeadlineText(deadline: string | null): string {
    if (!deadline) return 'Без срока';
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `Просрочено на ${Math.abs(days)} дн.`;
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return `${days} дн.`;
  }

  async function handleFileUpload(aptId: string, crm_code: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Файл слишком большой (макс. 10 МБ)');
        return;
      }

      setUploading(aptId);
      const month = new Date().toISOString().slice(0, 7);
      const path = `reports/${month}/${crm_code.replace(/[/\\]/g, '_')}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('inspection-reports')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        toast.error('Ошибка загрузки: ' + uploadError.message);
        setUploading(null);
        return;
      }

      const { error: updateError } = await supabase
        .from('apartments')
        .update({
          status: 'completed',
          report_file_path: path,
          report_uploaded_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', aptId);

      if (updateError) {
        toast.error('Ошибка обновления: ' + updateError.message);
      } else {
        toast.success('Экспертиза загружена');
        loadData();
      }
      setUploading(null);
    };
    input.click();
  }

  async function rejectApartment() {
    if (!rejectingAptId || !selectedReason) return;
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'rejected',
        rejection_reason_id: selectedReason,
        rejection_note: rejectionNote || null,
      })
      .eq('id', rejectingAptId);

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success('Квартира возвращена');
      setRejectDialogOpen(false);
      setRejectionNote('');
      setSelectedReason('');
      loadData();
    }
  }

  async function markInProgress(aptId: string) {
    await supabase
      .from('apartments')
      .update({ status: 'in_progress' })
      .eq('id', aptId)
      .eq('status', 'assigned');
  }

  if (profileLoading) {
    return <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>;
  }

  const filteredApts = apartments.filter(a => a.status === tab).filter(a =>
    !crmSearch.trim() || a.crm_code?.toLowerCase().includes(crmSearch.trim().toLowerCase())
  );
  const assignedCount = apartments.filter(a => a.status === 'assigned').length;
  const inProgressCount = apartments.filter(a => a.status === 'in_progress').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Мои задания</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Новые</p>
            <p className="text-2xl font-bold text-indigo-600">{assignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">В работе</p>
            <p className="text-2xl font-bold text-purple-600">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-gray-500">Готово сегодня</p>
            <p className="text-2xl font-bold text-green-600">{completedToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button variant={tab === 'assigned' ? 'default' : 'outline'} size="sm" onClick={() => setTab('assigned')}>
          <HardHat size={16} className="mr-1" /> Новые ({assignedCount})
        </Button>
        <Button variant={tab === 'in_progress' ? 'default' : 'outline'} size="sm" onClick={() => setTab('in_progress')}>
          <Clock size={16} className="mr-1" /> В работе ({inProgressCount})
        </Button>
      </div>

      {/* CRM search */}
      <div className="mb-4">
        <Input
          placeholder="Поиск по коду CRM"
          value={crmSearch}
          onChange={e => setCrmSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 h-48 animate-pulse bg-gray-50" /></Card>
          ))}
        </div>
      ) : filteredApts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <CheckCircle2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p>Нет квартир в этой категории</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredApts.map((apt) => (
            <Card key={apt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{apt.project_name}</CardTitle>
                  <StatusBadge status={apt.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p className="text-xs text-gray-400">Код CRM: {apt.crm_code}</p>
                  <p>{apt.address}</p>
                  <div className="flex gap-4">
                    <span>Дом: <strong>{apt.building_number}</strong></span>
                    <span>Кв: <strong>{apt.apartment_number}</strong></span>
                    <span>{apt.area_sqm} м²</span>
                  </div>
                  <p>Отделка: {apt.finish_type}</p>
                  <p className={getDeadlineColor(apt.deadline)}>
                    Срок: {apt.deadline ? new Date(apt.deadline).toLocaleDateString('ru') : '—'} ({getDeadlineText(apt.deadline)})
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={uploading === apt.id}
                    onClick={() => {
                      markInProgress(apt.id);
                      handleFileUpload(apt.id, apt.crm_code);
                    }}
                  >
                    {uploading === apt.id ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <Upload size={14} className="mr-1" />
                    )}
                    Загрузить PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-orange-600 border-orange-300"
                    onClick={() => {
                      setRejectingAptId(apt.id);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <AlertTriangle size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rejection dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Не могу попасть в квартиру</DialogTitle>
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
            <Button onClick={rejectApartment} disabled={!selectedReason}>Отправить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
