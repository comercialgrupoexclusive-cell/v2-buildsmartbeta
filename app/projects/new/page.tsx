'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Organization = { id: string; name: string };

export default function NewProjectPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase.from('organizations').select('id,name').order('created_at');
        if (error) {
          setMessage(error.message);
          return;
        }

        const rows = (data ?? []) as Organization[];
        if (rows.length === 0) {
          router.replace('/onboarding');
          return;
        }

        setOrganizations(rows);
        setOrganizationId(rows[0].id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível preparar a criação do projeto.');
      }
    })();
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !name.trim()) return;

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc('create_project', {
        p_organization_id: organizationId,
        p_name: name.trim(),
        p_code: code.trim() || null,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace('/projects');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o projeto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-7 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">Projetos</p>
        <h1 className="mt-1 text-3xl font-bold">Novo projeto</h1>
        <p className="mt-2 text-sm text-gray-600">Crie um novo Project dentro do seu espaço de trabalho.</p>
      </div>

      {message ? <p className="rounded-lg border p-3 text-sm">{message}</p> : null}

      <form className="flex flex-col gap-4 rounded-2xl border p-5" onSubmit={submit}>
        {organizations.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Organização
            <select className="rounded-lg border px-3 py-2 font-normal" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome do projeto
          <input className="rounded-lg border px-3 py-2 font-normal" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Código <span className="font-normal text-gray-500">(opcional)</span>
          <input className="rounded-lg border px-3 py-2 font-normal" value={code} onChange={(event) => setCode(event.target.value)} />
        </label>

        <button className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50" disabled={busy} type="submit">
          {busy ? 'Criando...' : 'Criar projeto'}
        </button>
      </form>

      <Link className="text-sm font-medium underline underline-offset-4" href="/projects">Voltar para projetos</Link>
    </main>
  );
}
