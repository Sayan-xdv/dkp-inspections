import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Key, HardHat, CheckCircle2 } from 'lucide-react';

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

  const cards = [
    { title: 'Всего квартир', value: counts.total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Ожидают ключей', value: counts.pending, icon: Key, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { title: 'В работе', value: counts.working, icon: HardHat, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Готово', value: counts.done, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Дашборд</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {counts.rejected > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <p className="text-orange-700 font-medium">
              {counts.rejected} квартир(ы) возвращены подрядчиками — требуется обеспечить доступ
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
