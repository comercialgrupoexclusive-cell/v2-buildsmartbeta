'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSent(true);
      setMessage('Se esse e-mail tiver uma conta, enviamos um link para redefinir a senha.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o link de recuperação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-7 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
        <h1 className="mt-1 text-3xl font-bold">Esqueci minha senha</h1>
        <p className="mt-2 text-sm text-gray-600">Informe seu e-mail para receber um link de redefinição de senha.</p>
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
            disabled={sent}
          />
        </label>

        {message ? <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

        {!sent ? (
          <button
            className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        ) : null}
      </form>

      <Link className="text-sm font-medium underline underline-offset-4" href="/login">
        Voltar para entrar
      </Link>
    </main>
  );
}
