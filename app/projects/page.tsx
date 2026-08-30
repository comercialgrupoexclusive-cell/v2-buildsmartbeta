'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Project = {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace('/login');
        return;
      }

      const [{ data: organizations, error: organizationError }, { data: projectRows, error: projectError }] = await Promise.all([
        supabase.from('organizations').select('id').limit(1),
        supabase.from('projects').select('id,organization_id,code,name,status').order('created_at'),
      ]);

      if (organizationError || projectError) {
        setMessage(organizationError?.message ?? projectError?.message ?? 'Falha ao carregar dados.');
        return;
      }

      if ((organizations ?? []).length === 0) {
        router.replace('/onboarding');
        return;
      }

      setProjects((projectRows ?? []) as Project[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar seus projetos.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
          <h1 className="text-3xl font-bold">Projetos</h1>
          <p className="mt-1 text-sm text-gray-600">Selecione um Project para continuar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border px-3 py-2 text-sm" href="/tasks/my">Minhas tarefas</Link>
          <Link className="rounded-lg bg-black px-3 py-2 text-sm text-white" href="/projects/new">Novo projeto</Link>
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={signOut}>Sair</button>
        </div>
      </header>

      {message ? <p className="rounded-lg border p-3 text-sm">{message}</p> : null}

      <section className="rounded-xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Projetos acessíveis</h2>
          <span className="text-sm text-gray-500">{projects.length}</span>
        </div>
        <div className="grid gap-3">
          {loading ? <p className="text-sm text-gray-500">Carregando...</p> : null}
          {!loading && projects.length === 0 ? <p className="text-sm text-gray-500">Nenhum projeto disponível.</p> : null}
          {projects.map((project) => (
            <article className="rounded-lg border p-4" key={project.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-gray-500">{project.code || 'Sem código'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium">{project.status}</span>
                  <Link className="rounded-lg border px-3 py-2 text-sm" href={`/projects/${project.id}/tasks`}>Abrir</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
