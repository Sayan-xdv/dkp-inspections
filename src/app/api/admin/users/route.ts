import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types/database';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  }

  try {
    const { email, password, full_name, role, contractor_id } = await request.json() as {
      email: string;
      password: string;
      full_name: string;
      role: AppRole;
      contractor_id?: string;
    };

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Заполните все обязательные поля' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role,
        contractor_id: role === 'contractor' ? (contractor_id || null) : null,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user_id: authData.user.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
  }

  try {
    const { user_id, role, contractor_id, is_active } = await request.json() as {
      user_id: string;
      role?: AppRole;
      contractor_id?: string | null;
      is_active?: boolean;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) {
      updateData.role = role;
      updateData.contractor_id = role === 'contractor' ? (contractor_id ?? null) : null;
    }
    if (contractor_id !== undefined && role === undefined) {
      updateData.contractor_id = contractor_id;
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}
