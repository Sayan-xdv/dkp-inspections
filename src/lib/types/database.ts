export type AppRole = 'sales' | 'settlement' | 'contractor' | 'crm_loader' | 'admin';

export type ApartmentStatus =
  | 'pending_keys'
  | 'keys_unavailable'
  | 'keys_available'
  | 'assigned'
  | 'in_progress'
  | 'rejected'
  | 'completed'
  | 'uploaded_to_crm';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  contractor_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contractor {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  contractor_id: string;
  is_active: boolean;
  created_at: string;
  contractor?: Contractor;
}

export interface RejectionReason {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

export interface Apartment {
  id: string;
  crm_code: string;
  project_name: string;
  project_id: string | null;
  address: string;
  building_number: string | null;
  apartment_number: string;
  area_sqm: number | null;
  finish_type: string | null;
  ovp_status: string | null;
  client_name: string | null;
  contract_number: string | null;
  contract_date: string | null;
  contract_amount: number | null;
  contract_expiry: string | null;
  sale_scheme: string | null;
  object_state: string | null;
  status: ApartmentStatus;
  contractor_id: string | null;
  receipt_date: string;
  deadline: string | null;
  keys_confirmed_at: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  uploaded_to_crm_at: string | null;
  keys_available: boolean | null;
  rejection_reason_id: string | null;
  rejection_note: string | null;
  report_file_path: string | null;
  report_uploaded_at: string | null;
  drive_file_url: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contractor?: Contractor;
  rejection_reason?: RejectionReason;
  project?: Project;
}

export interface ImportBatch {
  id: string;
  uploaded_by: string;
  filename: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  errors: Array<{ row: number; error: string }>;
  created_at: string;
}

export interface StatusHistory {
  id: string;
  apartment_id: string;
  old_status: ApartmentStatus | null;
  new_status: ApartmentStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

// Status display info
export const STATUS_CONFIG: Record<ApartmentStatus, { label: string; color: string; bgColor: string }> = {
  pending_keys: { label: 'Ожидает ключей', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  keys_unavailable: { label: 'Нет ключей', color: 'text-red-700', bgColor: 'bg-red-100' },
  keys_available: { label: 'Ключи есть', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  assigned: { label: 'Назначена', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  in_progress: { label: 'В работе', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  rejected: { label: 'Отказ', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  completed: { label: 'Готово', color: 'text-green-700', bgColor: 'bg-green-100' },
  uploaded_to_crm: { label: 'Загружена в CRM', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
};

// Role display info
export const ROLE_CONFIG: Record<AppRole, { label: string; defaultPath: string }> = {
  sales: { label: 'Продажи', defaultPath: '/dashboard/sales' },
  settlement: { label: 'Офис заселения', defaultPath: '/dashboard/settlement' },
  contractor: { label: 'Подрядчик', defaultPath: '/dashboard/contractor' },
  crm_loader: { label: 'Загрузчик CRM', defaultPath: '/dashboard/crm-loader' },
  admin: { label: 'Администратор', defaultPath: '/dashboard/sales' },
};
