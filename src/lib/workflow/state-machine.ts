import type { ApartmentStatus, AppRole } from '@/lib/types/database';

// Valid status transitions — спецификация workflow платформы.
// Подрядчик может сдать отчёт или вернуть квартиру сразу из assigned,
// не отмечая промежуточный in_progress (реальный UX мобильной бригады).
const TRANSITIONS: Record<ApartmentStatus, ApartmentStatus[]> = {
  pending_keys: ['keys_available', 'keys_unavailable'],
  keys_unavailable: ['pending_keys'], // ОЗ обеспечил доступ
  keys_available: ['assigned'], // авто-назначение DB-триггером
  assigned: ['in_progress', 'completed', 'rejected'],
  in_progress: ['completed', 'rejected'],
  rejected: ['pending_keys', 'keys_available'], // возврат в работу через ОЗ
  completed: ['uploaded_to_crm'],
  uploaded_to_crm: [],
};

// Which roles can trigger which transitions
const ROLE_TRANSITIONS: Record<AppRole, Array<[ApartmentStatus, ApartmentStatus]>> = {
  settlement: [
    ['pending_keys', 'keys_available'],
    ['pending_keys', 'keys_unavailable'],
    ['keys_unavailable', 'pending_keys'],
    ['rejected', 'pending_keys'],
    ['rejected', 'keys_available'],
  ],
  contractor: [
    ['assigned', 'in_progress'],
    ['assigned', 'completed'],
    ['assigned', 'rejected'],
    ['in_progress', 'completed'],
    ['in_progress', 'rejected'],
  ],
  crm_loader: [
    ['completed', 'uploaded_to_crm'],
  ],
  sales: [],
  admin: [], // admin can do everything
};

/**
 * Статусы, ИЗ которых разрешён переход в `to` для роли `role`.
 * Использовать как optimistic-guard в UPDATE-запросах:
 * `.in('status', allowedSourceStatuses(to, role))` — защита от гонок,
 * когда два пользователя меняют статус одновременно.
 */
export function allowedSourceStatuses(to: ApartmentStatus, role: AppRole): ApartmentStatus[] {
  if (role === 'admin') {
    return (Object.keys(TRANSITIONS) as ApartmentStatus[]).filter((from) =>
      TRANSITIONS[from].includes(to)
    );
  }
  return (ROLE_TRANSITIONS[role] ?? []).filter(([, t]) => t === to).map(([f]) => f);
}

export function canTransition(
  from: ApartmentStatus,
  to: ApartmentStatus,
  role: AppRole
): boolean {
  if (role === 'admin') return TRANSITIONS[from]?.includes(to) ?? false;
  const allowed = ROLE_TRANSITIONS[role] ?? [];
  return allowed.some(([f, t]) => f === from && t === to);
}

export function getAvailableTransitions(
  currentStatus: ApartmentStatus,
  role: AppRole
): ApartmentStatus[] {
  if (role === 'admin') return TRANSITIONS[currentStatus] ?? [];
  const allowed = ROLE_TRANSITIONS[role] ?? [];
  return allowed.filter(([f]) => f === currentStatus).map(([, t]) => t);
}
