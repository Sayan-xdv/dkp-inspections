// Mapping CRM Excel column headers → database fields
export const CRM_COLUMN_MAP: Record<string, string> = {
  'Код объекта': 'crm_code',
  'Застройка': 'project_name',
  'Адрес строения': 'address',
  'Номер корпуса': 'building_number',
  'Условный номер (число)': 'apartment_number',
  'Площадь по БТИ общая (расчетная)': 'area_sqm',
  'Отделка по проекту': 'finish_type',
  'Статус ОВП': 'ovp_status',
  'Основной клиент (Клиентский договор) (Договор)': 'client_name',
  'Номер договора (Клиентский договор) (Договор)': 'contract_number',
  'Дата договора (Клиентский договор) (Договор)': 'contract_date',
  'Сумма договора (Клиентский договор) (Договор)': 'contract_amount',
  'Срок действия (Клиентский договор) (Договор)': 'contract_expiry',
  'Схема продажи': 'sale_scheme',
  'Состояние объекта': 'object_state',
};

// Valid OVP statuses for filtering
export const VALID_OVP_STATUSES = ['Принята в ОВП', 'Принята ПК'];

// Finish types that indicate the apartment has finish work
export const EMPTY_FINISH_VALUES = ['', 'Без отделки', 'без отделки', null, undefined];

export interface ParsedRow {
  crm_code: string;
  project_name: string;
  address: string;
  building_number: string;
  apartment_number: string;
  area_sqm: number | null;
  finish_type: string;
  ovp_status: string;
  client_name: string | null;
  contract_number: string | null;
  contract_date: string | null;
  contract_amount: number | null;
  contract_expiry: string | null;
  sale_scheme: string | null;
  object_state: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  filtered: ParsedRow[];
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}
