'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          router.replace('/login');
          return;
        }

        const { data: organizations, error } = await supabase.from('organizations').select('id').limit(1);
        if (error) {
          setMessage(error.message);
          return;
        }

        if ((organizations ?? []).length > 0) {
          router.replace('/projects');
          return;
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o primeiro acesso.');
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function createOrganization(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc('create_organization', { p_name: organizationName.trim() });
      if (error || typeof data !== 'string') {
        setMessage(error?.message ?? 'Não foi possível criar o espaço de trabalho.');
        return;
      }

      setOrganizationId(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o espaço de trabalho.');
    } finally {
      setBusy(false);
    }
  }

  async function createFirstProject(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;

    setBusy(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc('create_project', {
        p_organization_id: organizationId,
        p_name: projectName.trim(),
        p_code: projectCode.trim() || null,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace('/projects');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o primeiro projeto.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6 text-sm text-gray-500">Preparando seu primeiro acesso...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-7 p-6">
      <div>
        <p className="text-sm font-medium text-gray-500">Primeiro acesso</p>
        <h1 className="mt-1 text-3xl font-bold">Configure seu espaço de trabalho</h1>
        <p className="mt-2 text-sm text-gray-600">Essa configuração acontece uma vez. Depois você entra diretamente no BuildSmart.</p>
      </div>

      {message ? <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

      {!organizationId ? (
        <form className="flex flex-col gap-4 rounded-2xl border p-5" onSubmit={createOrganization}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Passo 1 de 2</p>
            <h2 className="mt-1 text-xl font-semibold">Seu espaço de trabalho</h2>
            <p className="mt-1 text-sm text-gray-600">Use o nome da empresa, escritório ou equipe.</p>
          </div>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Nome da organização"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
          />
          <button className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50" disabled={busy} type="submit">
            {busy ? 'Salvando...' : 'Continuar'}
          </button>
        </form>
      ) : (
        <form className="flex flex-col gap-4 rounded-2xl border p-5" onSubmit={createFirstProject}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Passo 2 de 2</p>
            <h2 className="mt-1 text-xl font-semibold">Crie seu primeiro Project</h2>
            <p className="mt-1 text-sm text-gray-600">Você poderá criar outros Projects depois, dentro do sistema.</p>
          </div>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Nome do projeto"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
          />
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Código opcional"
            value={projectCode}
            onChange={(event) => setProjectCode(event.target.value)}
          />
          <button className="rounded-lg bg-black px-4 py-2.5 text-white disabled:opacity-50" disabled={busy} type="submit">
            {busy ? 'Criando...' : 'Entrar no BuildSmart'}
          </button>
        </form>
      )}
    </main>
  );
}
