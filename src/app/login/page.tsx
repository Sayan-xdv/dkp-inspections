'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Неверный email или пароль');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 dashboard-grid-bg">
      <div className="w-full max-w-md stagger-in">
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] overflow-hidden">
          <div className="px-8 pt-10 pb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-600 to-indigo-700 shadow-[0_4px_16px_-4px_rgba(99,102,241,0.5)]">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900">
              Экспертизы ДКП
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              Платформа управления экспертизами качества
            </p>
          </div>

          <div className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] uppercase tracking-wider font-medium text-gray-500">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[11px] uppercase tracking-wider font-medium text-gray-500">
                  Пароль
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full gap-2 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.4)]"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Войти
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Платформа экспертиз ДКП · «Самолёт»
        </p>
      </div>
    </div>
  );
}
