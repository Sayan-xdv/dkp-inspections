'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { RejectionReason } from '@/lib/types/database';

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel?: string;
  /** Вызывается с выбранной причиной и комментарием; диалог закрывается при успехе. */
  onConfirm: (reasonId: string, note: string) => void | Promise<void>;
}

/** Общий диалог «указать причину отказа/недоступности» — settlement и contractor. */
export function RejectDialog({
  open,
  onOpenChange,
  title,
  submitLabel = 'Подтвердить',
  onConfirm,
}: RejectDialogProps) {
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from('rejection_reasons')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setReasons(data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setReasonId('');
      setNote('');
    }
  }, [open]);

  async function handleConfirm() {
    if (!reasonId) return;
    setBusy(true);
    try {
      await onConfirm(reasonId, note);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select value={reasonId} onValueChange={(v) => setReasonId(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите причину" />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Комментарий (необязательно)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={!reasonId || busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
