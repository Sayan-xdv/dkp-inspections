'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RejectionReason } from '@/lib/types/database';
import { toast } from 'sonner';
import { Plus, ListOrdered, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

export default function RejectionReasonsPage() {
  const supabase = createClient();
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const fetchReasons = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rejection_reasons')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      toast.error(error.message);
    } else {
      setReasons(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchReasons();
  }, [fetchReasons]);

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      toast.error('Введите название причины');
      return;
    }
    setCreating(true);
    try {
      const maxOrder = reasons.length > 0
        ? Math.max(...reasons.map((r) => r.sort_order))
        : 0;

      const { error } = await supabase.from('rejection_reasons').insert({
        label: newLabel.trim(),
        sort_order: maxOrder + 1,
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Причина отказа добавлена');
      setDialogOpen(false);
      setNewLabel('');
      fetchReasons();
    } catch {
      toast.error('Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('rejection_reasons')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
      return;
    }
    setReasons((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r))
    );
    toast.success(isActive ? 'Причина активирована' : 'Причина деактивирована');
  };

  const handleSortOrderChange = async (id: string, newOrder: number) => {
    const { error } = await supabase
      .from('rejection_reasons')
      .update({ sort_order: newOrder })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
      return;
    }
    setReasons((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, sort_order: newOrder } : r))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Причины отказа</h1>
          <p className="text-muted-foreground">Управление причинами отклонения экспертиз</p>
        </div>
        <Button onClick={() => { setNewLabel(''); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить причину
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая причина отказа</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reasonLabel">Название</Label>
                <Input
                  id="reasonLabel"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Например: Несоответствие планировки"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Добавить
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Список причин отказа
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Порядок</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[100px]">Активна</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasons.map((reason) => (
                  <TableRow key={reason.id}>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-[70px]"
                        value={reason.sort_order}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            handleSortOrderChange(reason.id, val);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{reason.label}</TableCell>
                    <TableCell>
                      <Badge variant={reason.is_active ? 'default' : 'outline'}>
                        {reason.is_active ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={reason.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(reason.id, checked)
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {reasons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Причины отказа не найдены
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
