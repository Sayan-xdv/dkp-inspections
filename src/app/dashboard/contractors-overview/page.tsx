'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/apartments/status-badge';
import { HardHat, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { Apartment, Contractor } from '@/lib/types/database';

interface ContractorStats {
  id: string;
  name: string;
  assigned: number;
  in_progress: number;
  completed: number;
  rejected: number;
  total: number;
}

export default function ContractorsOverviewPage() {
  const [contractors, setContractors] = useState<ContractorStats[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedContractor, setSelectedContractor] = useState('all');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    // Get all contractors
    const { data: contractorsList } = await supabase
      .from('contractors')
      .select('*')
      .eq('is_active', true)
      .order('name');

    // Get all apartments with contractor
    const { data: allApts } = await supabase
      .from('apartments')
      .select('*')
      .not('contractor_id', 'is', null);

    const apts = allApts ?? [];

    // Calculate stats per contractor
    const stats: ContractorStats[] = (contractorsList ?? []).map((c: Contractor) => {
      const mine = apts.filter(a => a.contractor_id === c.id);
      return {
        id: c.id,
        name: c.name,
        assigned: mine.filter(a => a.status === 'assigned').length,
        in_progress: mine.filter(a => a.status === 'in_progress').length,
        completed: mine.filter(a => a.status === 'completed' || a.status === 'uploaded_to_crm').length,
        rejected: mine.filter(a => a.status === 'rejected').length,
        total: mine.length,
      };
    });

    setContractors(stats);

    // Filter apartments for detail view
    let filtered = apts.filter(a =>
      ['assigned', 'in_progress', 'rejected'].includes(a.status)
    );
    if (selectedContractor !== 'all') {
      filtered = filtered.filter(a => a.contractor_id === selectedContractor);
    }
    filtered.sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      if (a.deadline) return -1;
      return 1;
    });

    setApartments(filtered);
    setLoading(false);
  }, [selectedContractor]);

  useEffect(() => { loadData(); }, [loadData]);

  function getDeadlineColor(deadline: string | null): string {
    if (!deadline) return 'text-gray-400';
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-600 font-bold';
    if (days <= 2) return 'text-red-500';
    if (days <= 5) return 'text-yellow-600';
    return 'text-green-600';
  }

  function getDeadlineText(deadline: string | null): string {
    if (!deadline) return '—';
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} дн. просрочено`;
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return `${days} дн.`;
  }

  const totalAssigned = contractors.reduce((s, c) => s + c.assigned, 0);
  const totalInProgress = contractors.reduce((s, c) => s + c.in_progress, 0);
  const totalCompleted = contractors.reduce((s, c) => s + c.completed, 0);
  const totalRejected = contractors.reduce((s, c) => s + c.rejected, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Обзор подрядчиков</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="mx-auto h-5 w-5 text-indigo-500 mb-1" />
            <p className="text-xs text-gray-500">Назначено</p>
            <p className="text-2xl font-bold text-indigo-600">{totalAssigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <HardHat className="mx-auto h-5 w-5 text-purple-500 mb-1" />
            <p className="text-xs text-gray-500">В работе</p>
            <p className="text-2xl font-bold text-purple-600">{totalInProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-green-500 mb-1" />
            <p className="text-xs text-gray-500">Готово</p>
            <p className="text-2xl font-bold text-green-600">{totalCompleted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-orange-500 mb-1" />
            <p className="text-xs text-gray-500">Возвраты</p>
            <p className="text-2xl font-bold text-orange-600">{totalRejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Contractor stats table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Статистика по подрядчикам</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Подрядчик</TableHead>
                <TableHead className="text-center">Назначено</TableHead>
                <TableHead className="text-center">В работе</TableHead>
                <TableHead className="text-center">Готово</TableHead>
                <TableHead className="text-center">Возвраты</TableHead>
                <TableHead className="text-center">Всего</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractors.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedContractor(c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-center">
                    {c.assigned > 0 ? <Badge variant="secondary">{c.assigned}</Badge> : <span className="text-gray-300">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.in_progress > 0 ? <Badge className="bg-purple-100 text-purple-700">{c.in_progress}</Badge> : <span className="text-gray-300">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.completed > 0 ? <Badge className="bg-green-100 text-green-700">{c.completed}</Badge> : <span className="text-gray-300">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.rejected > 0 ? <Badge className="bg-orange-100 text-orange-700">{c.rejected}</Badge> : <span className="text-gray-300">0</span>}
                  </TableCell>
                  <TableCell className="text-center font-medium">{c.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail: active assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Активные задания</CardTitle>
            <Select value={selectedContractor} onValueChange={(v) => setSelectedContractor(v ?? 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все подрядчики</SelectItem>
                {contractors.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Проект</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Кв.</TableHead>
                  <TableHead>Подрядчик</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Срок</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Нет активных заданий
                    </TableCell>
                  </TableRow>
                ) : (
                  apartments.map(apt => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">{apt.project_name}</TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{apt.address}</TableCell>
                      <TableCell>{apt.apartment_number}</TableCell>
                      <TableCell>
                        {contractors.find(c => c.id === apt.contractor_id)?.name ?? '—'}
                      </TableCell>
                      <TableCell><StatusBadge status={apt.status} /></TableCell>
                      <TableCell className={getDeadlineColor(apt.deadline)}>
                        {apt.deadline ? new Date(apt.deadline).toLocaleDateString('ru') : '—'}
                        <br />
                        <span className="text-xs">{getDeadlineText(apt.deadline)}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
