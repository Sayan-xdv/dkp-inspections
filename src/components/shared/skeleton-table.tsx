import { TableCell, TableRow } from '@/components/ui/table';

interface SkeletonTableRowsProps {
  rows?: number;
  cols: number;
}

/** Скелетон-строки для таблиц — вставлять внутрь <TableBody>. */
export function SkeletonTableRows({ rows = 5, cols }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <div
                className="h-4 rounded bg-gray-100 animate-pulse"
                style={{ animationDelay: `${(i * cols + j) * 40}ms` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Скелетон-сетка карточек. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-2xl border border-gray-200/80 bg-gray-50 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
