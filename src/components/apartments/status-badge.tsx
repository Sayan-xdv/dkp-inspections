import { STATUS_CONFIG, type ApartmentStatus } from '@/lib/types/database';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: ApartmentStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.bgColor,
        config.color
      )}
    >
      {config.label}
    </span>
  );
}
