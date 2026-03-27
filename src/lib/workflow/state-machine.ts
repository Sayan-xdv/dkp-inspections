import type { ApartmentStatus, AppRole } from '@/lib/types/database';

// Valid status transitions
const TRANSITIONS: Record<ApartmentStatus, ApartmentStatus[]> = {
  pending_keys: ['keys_available', 'keys_unavailable'],
  keys_unavailable: ['pending_keys'], // ОЗ found keys
  keys_available: ['assigned'], // auto by trigger
  assigned: ['in_progress'],
  in_progress: ['completed', 'rejected'],
  rejected: ['pending_keys'], // auto-return to settlement queue
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
  ],
  contractor: [
    ['assigned', 'in_progress'],
    ['in_progress', 'completed'],
    ['in_progress', 'rejected'],
  ],
  crm_loader: [
    ['completed', 'uploaded_to_crm'],
  ],
  sales: [],
  admin: [], // admin can do everything
};

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
