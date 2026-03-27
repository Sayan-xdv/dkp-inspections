import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROLE_CONFIG } from '@/lib/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  const defaultPath = ROLE_CONFIG[profile.role as keyof typeof ROLE_CONFIG]?.defaultPath ?? '/dashboard/sales';
  redirect(defaultPath);
}
