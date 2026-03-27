'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AppRole, Profile } from '@/lib/types/database';
import {
  Upload,
  ClipboardList,
  Key,
  RotateCcw,
  HardHat,
  Download,
  Users,
  Building2,
  AlertCircle,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<AppRole, NavItem[]> = {
  sales: [
    { href: '/dashboard/sales', label: 'Дашборд', icon: <BarChart3 size={18} /> },
    { href: '/dashboard/sales/upload', label: 'Загрузка Excel', icon: <Upload size={18} /> },
    { href: '/dashboard/sales/registry', label: 'Реестр', icon: <ClipboardList size={18} /> },
  ],
  settlement: [
    { href: '/dashboard/settlement', label: 'Очередь ключей', icon: <Key size={18} /> },
    { href: '/dashboard/settlement/returned', label: 'Возвраты', icon: <RotateCcw size={18} /> },
  ],
  contractor: [
    { href: '/dashboard/contractor', label: 'Мои задания', icon: <HardHat size={18} /> },
  ],
  crm_loader: [
    { href: '/dashboard/crm-loader', label: 'Готовые экспертизы', icon: <Download size={18} /> },
  ],
  admin: [
    { href: '/dashboard/sales', label: 'Дашборд', icon: <BarChart3 size={18} /> },
    { href: '/dashboard/sales/upload', label: 'Загрузка Excel', icon: <Upload size={18} /> },
    { href: '/dashboard/sales/registry', label: 'Реестр', icon: <ClipboardList size={18} /> },
    { href: '/dashboard/settlement', label: 'Очередь ключей', icon: <Key size={18} /> },
    { href: '/dashboard/contractors-overview', label: 'Подрядчики', icon: <HardHat size={18} /> },
    { href: '/dashboard/crm-loader', label: 'Загрузчик CRM', icon: <Download size={18} /> },
    { href: '/admin/users', label: 'Пользователи', icon: <Users size={18} /> },
    { href: '/admin/projects', label: 'Проекты', icon: <Building2 size={18} /> },
    { href: '/admin/rejection-reasons', label: 'Причины отказа', icon: <AlertCircle size={18} /> },
  ],
};

const ROLE_LABELS: Record<AppRole, string> = {
  sales: 'Продажи',
  settlement: 'Офис заселения',
  contractor: 'Подрядчик',
  crm_loader: 'Загрузчик CRM',
  admin: 'Администратор',
};

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV_ITEMS[profile.role] ?? [];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">Экспертизы ДКП</h1>
        <p className="text-xs text-gray-500 mt-1">{ROLE_LABELS[profile.role]}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === item.href
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 text-xs text-gray-500 truncate">
          {profile.full_name || profile.email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-gray-600"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          Выйти
        </Button>
      </div>
    </aside>
  );
}
