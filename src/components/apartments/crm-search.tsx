'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CrmSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Единый поиск по коду CRM. */
export function CrmSearch({ value, onChange, placeholder = 'Поиск по коду CRM', className }: CrmSearchProps) {
  return (
    <div className={cn('relative max-w-xs', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

/** Фильтрация списка по crm_code (без учёта регистра). */
export function filterByCrmCode<T extends { crm_code?: string | null }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((a) => a.crm_code?.toLowerCase().includes(q));
}
