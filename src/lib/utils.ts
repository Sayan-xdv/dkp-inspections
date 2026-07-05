import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const CYRILLIC_TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Supabase Storage не принимает не-ASCII символы в ключах объектов
 * (ошибка InvalidKey). CRM-коды кириллические («СМ-2026-…») —
 * транслитерируем и вычищаем остальное.
 */
export function sanitizeStorageKey(value: string): string {
  const transliterated = value
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase();
      if (lower in CYRILLIC_TRANSLIT) {
        const mapped = CYRILLIC_TRANSLIT[lower];
        return ch === lower ? mapped : mapped.toUpperCase();
      }
      return ch;
    })
    .join('');
  const cleaned = transliterated.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  return cleaned.replace(/^[_.]+|[_.]+$/g, '') || 'file';
}
