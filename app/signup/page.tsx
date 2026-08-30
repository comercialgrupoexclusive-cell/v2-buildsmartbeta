'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const emailRedirectTo = `${window.location.origin}/onboarding`;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setCreated(true);
      setMessage('Conta criada. Confirme seu e-mail para continuar o primeiro acesso ao BuildSmart.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar sua conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-7 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
        <h1 className="mt-1 text-3xl font-bold">Criar conta</h1>
        <p className="mt-2 text-sm text-gray-600">Crie sua identidade primeiro. Após confirmar o e-mail, o BuildSmart inicia a configuração do seu espaço de trabalho.</p>
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
            disabled={created}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Senha
          <input
            className="rounded-lg border px-3 py-2 font-normal"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
            disabled={created}
          />
        </label>

        {message ? <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

        {!created ? (
          <button
            className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Criando conta...' : 'Criar conta'}
          </button>
        ) : null}
      </form>

      <Link className="text-sm font-medium underline underline-offset-4" href="/login">
        Voltar para entrar
      </Link>
    </main>
  );
}
