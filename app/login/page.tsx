'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function routeAuthenticatedUser() {
    const supabase = createBrowserSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    const { data: organizations, error: organizationError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (organizationError) {
      setMessage(organizationError.message);
      return true;
    }

    router.replace((organizations ?? []).length === 0 ? '/onboarding' : '/projects');
    router.refresh();
    return true;
  }

  useEffect(() => {
    void (async () => {
      try {
        const routed = await routeAuthenticatedUser();
        if (!routed) {
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get('confirmed') === '1') {
            setMessage('E-mail confirmado. Entre para continuar.');
          }
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível verificar sua sessão.');
      }
    })();
  // routeAuthenticatedUser intentionally reads the current router instance once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setMessage(error?.message ?? 'Não foi possível entrar.');
        return;
      }

      await routeAuthenticatedUser();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível conectar ao BuildSmart.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-7 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
        <h1 className="mt-1 text-3xl font-bold">Entrar</h1>
        <p className="mt-2 text-sm text-gray-600">Acesse seu espaço de trabalho.</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          E-mail
          <input
            className="rounded-lg border px-3 py-2 font-normal"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Senha
          <input
            className="rounded-lg border px-3 py-2 font-normal"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        {message ? <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

        <button
          className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="border-t pt-5 text-sm text-gray-600">
        Ainda não possui conta?{' '}
        <Link className="font-medium text-black underline underline-offset-4" href="/signup">
          Criar conta
        </Link>
      </div>
    </main>
  );
}
