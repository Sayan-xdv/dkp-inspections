'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Contractor, AppRole } from '@/lib/types/database';
import { ROLE_CONFIG } from '@/lib/types/database';
import { toast } from 'sonner';
import { Plus, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

const ROLES = Object.entries(ROLE_CONFIG) as [AppRole, { label: string; defaultPath: string }][];

const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  contractor: 'bg-purple-50 text-purple-700 border-purple-200',
  sales: 'bg-blue-50 text-blue-700 border-blue-200',
  settlement: 'bg-amber-50 text-amber-700 border-amber-200',
  crm_loader: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function UsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<{ id: string; email: string } | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('sales');
  const [contractorId, setContractorId] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, contractorsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('contractors').select('*').eq('is_active', true).order('name'),
    ]);
    if (usersRes.data) setUsers(usersRes.data);
    if (contractorsRes.data) setContractors(contractorsRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('sales');
    setContractorId('');
  };

  const handleCreate = async () => {
    if (!email || !password || !fullName) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          contractor_id: role === 'contractor' ? contractorId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Ошибка создания пользователя');
        return;
      }
      toast.success('Пользователь создан');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole, newContractorId?: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          role: newRole,
          contractor_id: newRole === 'contractor' ? (newContractorId || null) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Ошибка обновления роли');
        return;
      }
      toast.success('Роль обновлена');
      setEditingRole(null);
      fetchData();
    } catch {
      toast.error('Ошибка сети');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_active: isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Ошибка обновления статуса');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: isActive } : u))
      );
      toast.success(isActive ? 'Пользователь активирован' : 'Пользователь деактивирован');
    } catch {
      toast.error('Ошибка сети');
    }
  };

  return (
    <div>
      <PageHeader
        title="Пользователи"
        subtitle="Управление доступом к платформе"
        actions={
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Создать пользователя
          </Button>
        }
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый пользователь</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">ФИО</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div className="space-y-2">
                <Label>Роль</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {role === 'contractor' && (
                <div className="space-y-2">
                  <Label>Подрядчик</Label>
                  <Select value={contractorId} onValueChange={(v) => setContractorId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите подрядчика" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivate(null);
        }}
        title="Деактивировать пользователя?"
        description={`Пользователь ${pendingDeactivate?.email ?? ''} потеряет доступ к платформе.`}
        destructive
        confirmLabel="Деактивировать"
        onConfirm={async () => {
          if (pendingDeactivate) await handleToggleActive(pendingDeactivate.id, false);
        }}
      />

      <div
        className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden stagger-in"
        style={{ animationDelay: '80ms' }}
      >
        {!loading && users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Пользователи не найдены"
            description="Создайте первого пользователя, чтобы выдать доступ к платформе."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Email</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">ФИО</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Роль</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Подрядчик</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Статус</TableHead>
                <TableHead className="w-[100px] text-[10px] uppercase tracking-wider text-gray-400 font-medium">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={6} />
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono-tabular font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>
                      {editingRole === user.id ? (
                        <div className="flex items-center gap-2">
                          <Select
                            defaultValue={user.role}
                            onValueChange={(newRole) =>
                              handleRoleChange(user.id, newRole as AppRole)
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(([value, config]) => (
                                <SelectItem key={value} value={value}>
                                  {config.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRole(null)}
                          >
                            Отмена
                          </Button>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn('cursor-pointer', ROLE_BADGE_CLASSES[user.role])}
                          onClick={() => setEditingRole(user.id)}
                        >
                          {ROLE_CONFIG[user.role]?.label ?? user.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.contractor_id
                        ? contractors.find((c) => c.id === user.contractor_id)?.name ?? '—'
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleToggleActive(user.id, true);
                          } else {
                            setPendingDeactivate({ id: user.id, email: user.email });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'outline'}>
                        {user.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
