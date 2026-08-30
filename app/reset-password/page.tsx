'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMessage('Este link de redefinição é inválido ou expirou. Solicite um novo.');
          return;
        }
        setReady(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível validar o link de redefinição.');
      }
    })();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || password !== confirmPassword) {
      setMessage('As senhas precisam ser iguais.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace('/login?confirmed=1');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível redefinir sua senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-7 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
        <h1 className="mt-1 text-3xl font-bold">Definir nova senha</h1>
      </div>

      {message ? <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

      {ready ? (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nova senha
            <input
              className="rounded-lg border px-3 py-2 font-normal"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Confirmar nova senha
            <input
              className="rounded-lg border px-3 py-2 font-normal"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <button
            className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      ) : null}
    </main>
  );
}
