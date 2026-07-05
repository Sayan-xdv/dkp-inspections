'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/apartments/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonCards } from '@/components/shared/skeleton-table';
import { RejectDialog } from '@/components/apartments/reject-dialog';
import { CrmSearch, filterByCrmCode } from '@/components/apartments/crm-search';
import { getWaitingDays, getWaitingColor } from '@/lib/workflow/waiting';
import { sanitizeStorageKey } from '@/lib/utils';
import { allowedSourceStatuses } from '@/lib/workflow/state-machine';
import { Upload, AlertTriangle, CheckCircle2, HardHat, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Apartment } from '@/lib/types/database';

export default function ContractorPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'assigned' | 'in_progress'>('assigned');
  const [completedToday, setCompletedToday] = useState(0);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingAptId, setRejectingAptId] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [takingId, setTakingId] = useState<string | null>(null);
  const [crmSearch, setCrmSearch] = useState('');

  const supabase = createClient();
  const contractorId = profile?.contractor_id;

  const loadData = useCallback(async () => {
    if (!contractorId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from('apartments')
      .select('*')
      .eq('contractor_id', contractorId)
      .in('status', ['assigned', 'in_progress'])
      .order('deadline', { ascending: true, nullsFirst: false });

    setApartments(data ?? []);

    // Count completed today
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('apartments')
      .select('*', { count: 'exact', head: true })
      .eq('contractor_id', contractorId)
      .eq('status', 'completed')
      .gte('completed_at', today);
    setCompletedToday(count ?? 0);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorId]);

  useEffect(() => { loadData(); }, [loadData]);

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
      const path = `reports/${month}/${sanitizeStorageKey(crm_code)}.pdf`;

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
        .eq('id', aptId)
        .in('status', allowedSourceStatuses('completed', 'contractor'));

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

  async function rejectApartment(reasonId: string, note: string) {
    if (!rejectingAptId) return;
    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'rejected',
        rejection_reason_id: reasonId,
        rejection_note: note || null,
      })
      .eq('id', rejectingAptId)
      .in('status', allowedSourceStatuses('rejected', 'contractor'));

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success('Квартира возвращена');
      loadData();
    }
  }

  async function markInProgress(aptId: string) {
    setTakingId(aptId);
    const { error } = await supabase
      .from('apartments')
      .update({ status: 'in_progress' })
      .eq('id', aptId)
      .eq('status', 'assigned');

    if (error) {
      toast.error('Ошибка: ' + error.message);
    } else {
      toast.success('Взято в работу');
      loadData();
    }
    setTakingId(null);
  }

  if (profileLoading) {
    return (
      <div>
        <PageHeader title="Мои задания" subtitle="Экспертизы вашей компании" />
        <SkeletonCards count={6} />
      </div>
    );
  }

  if (!profile?.contractor_id) {
    return (
      <div>
        <PageHeader title="Мои задания" subtitle="Экспертизы вашей компании" />
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <EmptyState
            icon={AlertTriangle}
            title="Профиль не привязан к подрядчику"
            description="Обратитесь к администратору"
          />
        </div>
      </div>
    );
  }

  const filteredApts = filterByCrmCode(apartments.filter(a => a.status === tab), crmSearch);
  const assignedCount = apartments.filter(a => a.status === 'assigned').length;
  const inProgressCount = apartments.filter(a => a.status === 'in_progress').length;

  return (
    <div>
      <PageHeader title="Мои задания" subtitle="Экспертизы вашей компании" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Новые" value={assignedCount} icon={HardHat} accent="indigo" staggerDelay={0} />
        <KpiCard label="В работе" value={inProgressCount} icon={Clock} accent="purple" staggerDelay={70} />
        <KpiCard label="Готово сегодня" value={completedToday} icon={CheckCircle2} accent="emerald" staggerDelay={140} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 stagger-in" style={{ animationDelay: '210ms' }}>
        <Button variant={tab === 'assigned' ? 'default' : 'outline'} size="sm" onClick={() => setTab('assigned')}>
          <HardHat size={16} className="mr-1" /> Новые ({assignedCount})
        </Button>
        <Button variant={tab === 'in_progress' ? 'default' : 'outline'} size="sm" onClick={() => setTab('in_progress')}>
          <Clock size={16} className="mr-1" /> В работе ({inProgressCount})
        </Button>
      </div>

      {/* CRM search */}
      <div className="mb-4">
        <CrmSearch value={crmSearch} onChange={setCrmSearch} />
      </div>

      {/* Cards */}
      {loading ? (
        <SkeletonCards count={6} />
      ) : filteredApts.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <EmptyState icon={CheckCircle2} title="Нет квартир в этой категории" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-in" style={{ animationDelay: '280ms' }}>
          {filteredApts.map((apt) => (
            <Card
              key={apt.id}
              className="rounded-2xl border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{apt.project_name}</CardTitle>
                  <StatusBadge status={apt.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p className="text-xs text-gray-400">
                    Код CRM: <span className="font-mono-tabular">{apt.crm_code}</span>
                  </p>
                  <p>{apt.address}</p>
                  <div className="flex gap-4">
                    <span>Дом: <strong className="font-mono-tabular">{apt.building_number}</strong></span>
                    <span>Кв: <strong className="font-mono-tabular">{apt.apartment_number}</strong></span>
                    <span className="font-mono-tabular">{apt.area_sqm} м²</span>
                  </div>
                  <p>Отделка: {apt.finish_type}</p>
                  {getWaitingDays(apt.receipt_date) > 10 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-600">
                      ⚠ <span className="font-mono-tabular">{getWaitingDays(apt.receipt_date)}</span> дн.
                    </span>
                  ) : (
                    <p className={getWaitingColor(apt.receipt_date)}>
                      Ожидание: <span className="font-mono-tabular">{getWaitingDays(apt.receipt_date)}</span> дн.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {apt.status === 'assigned' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      disabled={takingId === apt.id}
                      onClick={() => markInProgress(apt.id)}
                    >
                      {takingId === apt.id ? (
                        <Loader2 size={14} className="mr-1 animate-spin" />
                      ) : (
                        <HardHat size={14} className="mr-1" />
                      )}
                      Взять в работу
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={uploading === apt.id}
                      onClick={() => handleFileUpload(apt.id, apt.crm_code)}
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rejection dialog */}
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title="Не могу попасть в квартиру"
        submitLabel="Отправить"
        onConfirm={rejectApartment}
      />
    </div>
  );
}
