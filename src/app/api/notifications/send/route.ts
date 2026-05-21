import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SendPayload {
  type: 'overdue_reminder' | 'custom';
  recipient_contractor_id: string | null;
  apartment_ids: string[];
  subject: string;
  body: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: SendPayload;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!payload.subject || !payload.body) {
    return NextResponse.json({ error: 'subject and body required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      type: payload.type,
      recipient_contractor_id: payload.recipient_contractor_id ?? null,
      apartment_ids: payload.apartment_ids ?? [],
      subject: payload.subject,
      body: payload.body,
      sent_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
