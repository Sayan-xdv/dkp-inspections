'use client';

import * as XLSX from 'xlsx';
import {
  CRM_COLUMN_MAP,
  VALID_OVP_STATUSES,
  EMPTY_FINISH_VALUES,
  type ParsedRow,
  type ParseResult,
} from './column-mapping';

function excelDateToISO(excelDate: number | string | null): string | null {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') {
    const d = new Date(excelDate);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }
  // Excel serial date → JS Date
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  return null;
}

export function parseExcelFile(file: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows: ParsedRow[] = [];
  const filtered: ParsedRow[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  let skipped = 0;

  for (let i = 0; i < jsonData.length; i++) {
    const raw = jsonData[i];
    const rowNum = i + 2; // Excel row (1-based + header)

    try {
      // Map columns
      const mapped: Record<string, unknown> = {};
      for (const [excelCol, dbField] of Object.entries(CRM_COLUMN_MAP)) {
        mapped[dbField] = raw[excelCol] ?? '';
      }

      const crm_code = String(mapped.crm_code || '').trim();
      if (!crm_code) {
        errors.push({ row: rowNum, error: 'Нет кода CRM' });
        continue;
      }

      const row: ParsedRow = {
        crm_code,
        project_name: String(mapped.project_name || '').trim(),
        address: String(mapped.address || '').trim(),
        building_number: String(mapped.building_number || '').trim(),
        apartment_number: String(mapped.apartment_number || '').trim(),
        area_sqm: mapped.area_sqm ? parseFloat(String(mapped.area_sqm)) || null : null,
        finish_type: String(mapped.finish_type || '').trim(),
        ovp_status: String(mapped.ovp_status || '').trim(),
        client_name: mapped.client_name ? String(mapped.client_name).trim() : null,
        contract_number: mapped.contract_number ? String(mapped.contract_number).trim() : null,
        contract_date: excelDateToISO(mapped.contract_date as number | string | null),
        contract_amount: mapped.contract_amount ? parseFloat(String(mapped.contract_amount)) || null : null,
        contract_expiry: excelDateToISO(mapped.contract_expiry as number | string | null),
        sale_scheme: mapped.sale_scheme ? String(mapped.sale_scheme).trim() : null,
        object_state: mapped.object_state ? String(mapped.object_state).trim() : null,
      };

      rows.push(row);

      // Filter: valid OVP status + has finish type
      const hasValidOvp = VALID_OVP_STATUSES.includes(row.ovp_status);
      const hasFinish = !EMPTY_FINISH_VALUES.includes(row.finish_type);

      if (hasValidOvp && hasFinish) {
        filtered.push(row);
      } else {
        skipped++;
      }
    } catch (err) {
      errors.push({ row: rowNum, error: String(err) });
    }
  }

  return { rows, filtered, skipped, errors };
}
