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
    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      if (mode === 'signup' && !result.data.session) {
        setMessage('Conta criada. Confirme o e-mail antes de entrar.');
        return;
      }

      router.push('/projects');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
        <h1 className="text-3xl font-bold">Entrar</h1>
      </div>

      <form className="flex flex-col gap-4">
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

        {message ? <p className="text-sm text-gray-700">{message}</p> : null}

        <div className="flex gap-3">
          <button
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={busy}
            onClick={(event) => submit(event, 'signin')}
            type="submit"
          >
            Entrar
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
