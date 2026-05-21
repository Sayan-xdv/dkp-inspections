'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send, Loader2, Mail, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface NotificationTarget {
  contractor_id: string | null;
  contractor_name: string;
  count: number;
  apartment_ids: string[];
}

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: NotificationTarget[];
  initialContractorId?: string | null;
}

function buildBody(target: NotificationTarget): string {
  if (!target.contractor_id) {
    return `Уважаемые партнёры,\n\nДоводим до сведения подрядчиков информацию о текущих задачах. Просим обратить внимание на сроки выполнения экспертиз и обеспечить своевременную сдачу отчётов.\n\nС уважением,\nДепартамент ДКП «Самолёт»`;
  }
  return `Уважаемый партнёр «${target.contractor_name}»,\n\nУ вас числится ${target.count} ${pluralize(
    target.count,
    'просроченная экспертиза',
    'просроченные экспертизы',
    'просроченных экспертиз'
  )}. Просим сдать отчёты в течение 3 рабочих дней.\n\nС уважением,\nДепартамент ДКП «Самолёт»`;
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function NotificationDialog({
  open,
  onOpenChange,
  targets,
  initialContractorId,
}: NotificationDialogProps) {
  const router = useRouter();
  const [contractorKey, setContractorKey] = useState<string>('all');
  const [subject, setSubject] = useState('Напоминание о просроченных экспертизах');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const current = targets.find((t) => (t.contractor_id ?? 'all') === contractorKey) ?? targets[0];

  useEffect(() => {
    if (!open) return;
    const key = initialContractorId ?? 'all';
    setContractorKey(key);
  }, [open, initialContractorId]);

  useEffect(() => {
    if (!current) return;
    setBody(buildBody(current));
    setSubject(
      current.contractor_id
        ? `Напоминание о просроченных экспертизах — ${current.contractor_name}`
        : 'Информационная рассылка подрядчикам'
    );
  }, [contractorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!current) return;
    setSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: current.contractor_id ? 'overdue_reminder' : 'custom',
          recipient_contractor_id: current.contractor_id,
          apartment_ids: current.apartment_ids,
          subject,
          body,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'send failed');
      }
      toast.success(
        current.contractor_id
          ? `Уведомление отправлено: ${current.contractor_name}`
          : 'Рассылка отправлена всем подрядчикам',
        { description: `${current.count > 0 ? `Квартир в письме: ${current.count}` : 'Без вложений'}` }
      );
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error('Не удалось отправить', { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <Mail className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">Рассылка подрядчикам</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Имитация почтового уведомления · письма не уходят за пределы платформы
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-medium text-gray-500">Получатель</label>
            <Select value={contractorKey} onValueChange={(v) => setContractorKey(v ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.contractor_id ?? 'all'} value={t.contractor_id ?? 'all'}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span>{t.contractor_name}</span>
                      {t.count > 0 && (
                        <span className="text-[10px] font-mono-tabular text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {t.count} просрочено
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-medium text-gray-500">Тема</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-medium text-gray-500">Текст письма</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              className="text-sm font-mono leading-relaxed"
            />
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <ChevronDown className="w-3 h-3" />
              Текст редактируем — поправьте при необходимости
            </p>
          </div>

          {current.contractor_id && current.count > 0 && (
            <div className="rounded-lg bg-amber-50/60 border border-amber-200/60 px-3 py-2.5 text-xs text-amber-800">
              <span className="font-medium">Просрочено квартир:</span>{' '}
              <span className="font-mono-tabular font-semibold">{current.count}</span>
              {current.apartment_ids.length > 0 && (
                <span className="text-amber-700/70 ml-2">
                  · приложен список из {current.apartment_ids.length} ID
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/40 flex sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Отмена
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
