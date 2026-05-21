import type { Apartment } from '@/lib/types/database';

const SLA_DAYS = 7;
const MS_IN_DAY = 86_400_000;

export function isOverdueByContractor(a: Pick<Apartment, 'status' | 'assigned_at' | 'deadline'>): boolean {
  if (a.status !== 'assigned' && a.status !== 'in_progress') return false;
  if (a.assigned_at) {
    const days = (Date.now() - new Date(a.assigned_at).getTime()) / MS_IN_DAY;
    if (days > SLA_DAYS) return true;
  }
  if (a.deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(a.deadline) < today) return true;
  }
  return false;
}

export function daysOverdue(a: Pick<Apartment, 'status' | 'assigned_at' | 'deadline'>): number {
  if (!isOverdueByContractor(a)) return 0;
  let max = 0;
  if (a.assigned_at) {
    const days = Math.floor((Date.now() - new Date(a.assigned_at).getTime()) / MS_IN_DAY);
    max = Math.max(max, days - SLA_DAYS);
  }
  if (a.deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(a.deadline);
    if (dl < today) {
      max = Math.max(max, Math.floor((today.getTime() - dl.getTime()) / MS_IN_DAY));
    }
  }
  return max;
}

export function daysInSystem(receiptDate: string | null): number {
  if (!receiptDate) return 0;
  return Math.floor((Date.now() - new Date(receiptDate).getTime()) / MS_IN_DAY);
}
