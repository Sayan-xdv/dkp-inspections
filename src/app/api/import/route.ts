import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  // Verify user is sales or admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['sales', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { rows, filename } = body as { rows: Array<Record<string, unknown>>; filename: string };

  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get existing CRM codes
  const { data: existingApts } = await admin
    .from('apartments')
    .select('crm_code');
  const existingCodes = new Set((existingApts ?? []).map(a => a.crm_code));

  // Get projects for contractor lookup
  const { data: projects } = await admin
    .from('projects')
    .select('name, id, contractor_id');
  const projectMap = new Map(
    (projects ?? []).map(p => [p.name.toUpperCase(), { id: p.id, contractor_id: p.contractor_id }])
  );

  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  const errors: Array<{ row: number; error: string }> = [];

  // Create import batch
  const { data: batch } = await admin
    .from('import_batches')
    .insert({
      uploaded_by: profile.id,
      filename: filename || 'upload.xlsx',
      total_rows: rows.length,
    })
    .select('id')
    .single();

  const toInsert = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string | number | null>;

    const crm_code = String(row.crm_code || '').trim();
    if (!crm_code) {
      errors.push({ row: i + 1, error: 'Нет кода CRM' });
      continue;
    }

    if (existingCodes.has(crm_code)) {
      duplicates++;
      continue;
    }

    const projectName = String(row.project_name || '').trim();
    const projectInfo = projectMap.get(projectName.toUpperCase());

    const receiptDate = new Date().toISOString().split('T')[0];
    let deadline = row.contract_expiry ? String(row.contract_expiry) : null;
    if (!deadline) {
      const d = new Date();
      d.setDate(d.getDate() + 10);
      deadline = d.toISOString().split('T')[0];
    }

    toInsert.push({
      crm_code,
      project_name: projectName,
      project_id: projectInfo?.id ?? null,
      address: String(row.address || ''),
      building_number: row.building_number ? String(row.building_number) : null,
      apartment_number: String(row.apartment_number || ''),
      area_sqm: row.area_sqm ? Number(row.area_sqm) : null,
      finish_type: row.finish_type ? String(row.finish_type) : null,
      ovp_status: row.ovp_status ? String(row.ovp_status) : null,
      client_name: row.client_name ? String(row.client_name) : null,
      contract_number: row.contract_number ? String(row.contract_number) : null,
      contract_date: row.contract_date ? String(row.contract_date) : null,
      contract_amount: row.contract_amount ? Number(row.contract_amount) : null,
      contract_expiry: row.contract_expiry ? String(row.contract_expiry) : null,
      sale_scheme: row.sale_scheme ? String(row.sale_scheme) : null,
      status: 'pending_keys' as const,
      receipt_date: receiptDate,
      deadline,
      import_batch_id: batch?.id ?? null,
    });

    existingCodes.add(crm_code);
  }

  // Bulk insert
  if (toInsert.length > 0) {
    const { error: insertError } = await admin
      .from('apartments')
      .insert(toInsert);

    if (insertError) {
      errors.push({ row: 0, error: insertError.message });
    } else {
      imported = toInsert.length;
    }
  }

  skipped = rows.length - imported - duplicates - errors.length;

  // Update batch
  if (batch?.id) {
    await admin
      .from('import_batches')
      .update({
        imported_rows: imported,
        skipped_rows: skipped,
        duplicate_rows: duplicates,
        errors,
      })
      .eq('id', batch.id);
  }

  return NextResponse.json({ imported, duplicates, skipped, errors });
}
