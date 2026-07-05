'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 border border-red-200/60">
        <AlertTriangle className="h-5 w-5 text-red-500" strokeWidth={1.8} />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight text-gray-900">
        Что-то пошло не так
      </p>
      <p className="mt-1 text-sm text-gray-500 max-w-md">
        Не удалось загрузить данные. Попробуйте обновить страницу — если ошибка повторяется,
        проверьте доступность базы данных.
      </p>
      <Button onClick={reset} variant="outline" className="mt-5 gap-2">
        <RotateCcw className="h-4 w-4" />
        Попробовать снова
      </Button>
    </div>
  );
}
