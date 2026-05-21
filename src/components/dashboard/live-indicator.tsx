'use client';

import { useEffect, useState } from 'react';

export function LiveIndicator({ updatedAt }: { updatedAt: Date }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const tick = () => {
      const m = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60000));
      setMinutes(m);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [updatedAt]);

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
      <span className="relative inline-flex w-2 h-2 text-emerald-500">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/40 live-pulse-dot" />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs font-medium text-emerald-700 tracking-tight">
        {minutes === 0 ? 'Обновлено сейчас' : `Обновлено ${minutes} мин назад`}
      </span>
    </div>
  );
}
