'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Contractor, AppRole } from '@/lib/types/database';
import { ROLE_CONFIG } from '@/lib/types/database';
import { toast } from 'sonner';
import { Plus, UserCog, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';

const ROLES = Object.entries(ROLE_CONFIG) as [AppRole, { label: string; defaultPath: string }][];

export default function UsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-muted-foreground">Управление пользователями системы</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Создать пользователя
        </Button>
      </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Список пользователей
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Подрядчик</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
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
                          variant="secondary"
                          className="cursor-pointer"
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
                        onCheckedChange={(checked) =>
                          handleToggleActive(user.id, checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'outline'}>
                        {user.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Пользователи не найдены
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
