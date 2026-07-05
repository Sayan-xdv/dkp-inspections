import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Keepalive: Vercel Cron дёргает раз в сутки, чтобы Supabase
// free-tier не ушёл в INACTIVE (пауза наступает после ~7 дней
// без запросов; INACTIVE на free-tier стирает таблицы).
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { count, error } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, projects: count, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
