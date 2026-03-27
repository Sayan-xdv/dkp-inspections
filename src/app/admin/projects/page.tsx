'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project, Contractor } from '@/lib/types/database';
import { toast } from 'sonner';
import { Plus, FolderKanban, Loader2 } from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [contractorId, setContractorId] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [projectsRes, contractorsRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*, contractor:contractors(*)')
        .order('name'),
      supabase
        .from('contractors')
        .select('*')
        .eq('is_active', true)
        .order('name'),
    ]);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (contractorsRes.data) setContractors(contractorsRes.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!projectName.trim()) {
      toast.error('Введите название проекта');
      return;
    }
    if (!contractorId) {
      toast.error('Выберите подрядчика');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from('projects').insert({
        name: projectName.trim(),
        contractor_id: contractorId,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Проект добавлен');
      setDialogOpen(false);
      setProjectName('');
      setContractorId('');
      fetchData();
    } catch {
      toast.error('Ошибка создания проекта');
    } finally {
      setCreating(false);
    }
  };

  const handleContractorChange = async (projectId: string, newContractorId: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ contractor_id: newContractorId })
      .eq('id', projectId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Подрядчик обновлён');
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Проекты</h1>
          <p className="text-muted-foreground">Привязка проектов к подрядчикам</p>
        </div>
        <Button onClick={() => { setProjectName(''); setContractorId(''); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить проект
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый проект</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Название проекта</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Введите название"
                />
              </div>
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
            <FolderKanban className="h-5 w-5" />
            Список проектов
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
                  <TableHead>Название</TableHead>
                  <TableHead>Подрядчик</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <Select
                        value={project.contractor_id}
                        onValueChange={(value) =>
                          value && handleContractorChange(project.id, value)
                        }
                      >
                        <SelectTrigger className="w-[250px]">
                          <span>
                            {contractors.find(c => c.id === project.contractor_id)?.name ?? 'Не назначен'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {contractors.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={project.is_active ? 'default' : 'outline'}>
                        {project.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Проекты не найдены
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
