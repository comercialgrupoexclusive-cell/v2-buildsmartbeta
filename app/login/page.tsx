'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent, mode: 'signin' | 'signup') {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      if (mode === 'signup' && !result.data.session) {
        setMessage('Conta criada. Confirme seu e-mail e depois entre.');
        return;
      }

      router.push('/projects');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível conectar ao BuildSmart.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
        <h1 className="text-3xl font-bold">Acessar o BuildSmart</h1>
        <p className="mt-2 text-sm text-gray-600">
          No primeiro acesso, crie sua conta. Depois você configurará seu espaço de trabalho e o primeiro projeto.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={(event) => submit(event, 'signin')}>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Aguarde...' : 'Entrar'}
          </button>
          <button
            className="rounded-lg border px-4 py-2 disabled:opacity-50"
            disabled={busy}
            onClick={(event) => submit(event, 'signup')}
            type="button"
          >
            Criar conta
          </button>
        </div>
      </form>
    </main>
  );
}
