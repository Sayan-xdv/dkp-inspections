'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { AppRole, Profile } from '@/lib/types/database';
import {
  Upload,
  ClipboardList,
  Key,
  HardHat,
  Download,
  Users,
  Building2,
  AlertCircle,
  LayoutDashboard,
  FileUp,
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
    { href: '/dashboard/sales/registry', label: 'Реестр', icon: <ClipboardList size={18} /> },
    { href: '/dashboard/sales/upload', label: 'Загрузка Excel', icon: <Upload size={18} /> },
  ],
  settlement: [
    { href: '/dashboard/settlement', label: 'Очередь ключей', icon: <Key size={18} /> },
  ],
  contractor: [
    { href: '/dashboard/contractor', label: 'Мои задания', icon: <HardHat size={18} /> },
  ],
  crm_loader: [
    { href: '/dashboard/crm-loader', label: 'Готовые экспертизы', icon: <Download size={18} /> },
  ],
  admin: [
    { href: '/dashboard/overview', label: 'Аналитика', icon: <LayoutDashboard size={18} /> },
    { href: '/dashboard/sales/upload', label: 'Загрузка Excel', icon: <Upload size={18} /> },
    { href: '/dashboard/sales/registry', label: 'Реестр', icon: <ClipboardList size={18} /> },
    { href: '/dashboard/settlement', label: 'Очередь ключей', icon: <Key size={18} /> },
    { href: '/dashboard/contractors-overview', label: 'Подрядчики', icon: <HardHat size={18} /> },
    { href: '/dashboard/contractor', label: 'Загрузка экспертиз', icon: <FileUp size={18} /> },
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
    <aside className="flex flex-col w-64 bg-white border-r border-gray-200/80 min-h-screen">
      <div className="p-4 border-b border-gray-200/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-indigo-600 to-indigo-700 shadow-[0_2px_8px_-2px_rgba(99,102,241,0.5)]">
            <Building2 className="h-4.5 w-4.5 text-white" size={18} />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight text-gray-900 leading-tight">
              Экспертизы ДКП
            </h1>
            <p className="text-[11px] text-gray-500">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className={cn(active ? 'text-indigo-600' : 'text-gray-400')}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200/80">
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
