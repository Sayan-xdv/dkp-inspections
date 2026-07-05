const MS_IN_DAY = 86_400_000;

/** Дней с даты поступления квартиры в систему. */
export function getWaitingDays(receiptDate: string | null): number {
  if (!receiptDate) return 0;
  return Math.floor((Date.now() - new Date(receiptDate).getTime()) / MS_IN_DAY);
}

/** Цвет индикации ожидания: >10 дней — тревожный красный. */
export function getWaitingColor(receiptDate: string | null): string {
  return getWaitingDays(receiptDate) > 10 ? 'text-red-600 font-semibold' : 'text-gray-600';
}
