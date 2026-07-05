'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project, Contractor } from '@/lib/types/database';
import { toast } from 'sonner';
import { Plus, FolderKanban, Loader2, Building2 } from 'lucide-react';

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
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';

const headCls = 'text-[10px] uppercase tracking-wider text-gray-400 font-medium';

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
    <>
      <PageHeader
        title="Проекты"
        subtitle="Распределение ЖК по подрядчикам"
        actions={
          <Button onClick={() => { setProjectName(''); setContractorId(''); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить проект
          </Button>
        }
      />
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

      <div
        className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden stagger-in"
        style={{ animationDelay: '80ms' }}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <FolderKanban className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">Список проектов</span>
          {!loading && (
            <span className="ml-1 text-xs text-gray-400 font-mono-tabular">{projects.length}</span>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={headCls}>Название</TableHead>
              <TableHead className={headCls}>Подрядчик</TableHead>
              <TableHead className={headCls}>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonTableRows rows={5} cols={3} />
            ) : (
              projects.map((project) => (
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
                        {contractors.find(c => c.id === project.contractor_id)?.name ? (
                          <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-md px-2 py-0.5 text-xs">
                            {contractors.find(c => c.id === project.contractor_id)?.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Не назначен</span>
                        )}
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
              ))
            )}
          </TableBody>
        </Table>
        {!loading && projects.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Проекты не найдены"
            description="Добавьте проект и привяжите его к подрядчику"
          />
        )}
      </div>
    </>
  );
}
