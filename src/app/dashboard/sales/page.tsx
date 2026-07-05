import { createClient } from '@/lib/supabase/server';
import { SalesDashboardView } from './sales-view';

export default async function SalesDashboard() {
  const supabase = await createClient();

  const { data: apartments } = await supabase
    .from('apartments')
    .select('status');

  const counts = {
    total: apartments?.length ?? 0,
    pending: apartments?.filter(a => ['pending_keys', 'keys_unavailable'].includes(a.status)).length ?? 0,
    working: apartments?.filter(a => ['assigned', 'in_progress', 'keys_available'].includes(a.status)).length ?? 0,
    done: apartments?.filter(a => ['completed', 'uploaded_to_crm'].includes(a.status)).length ?? 0,
    rejected: apartments?.filter(a => a.status === 'rejected').length ?? 0,
  };

  return <SalesDashboardView counts={counts} />;
}
