'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Organization = { id: string; name: string };
type Project = {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
};

export default function ProjectsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
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

      const [{ data: orgRows, error: orgError }, { data: projectRows, error: projectError }] = await Promise.all([
        supabase.from('organizations').select('id,name').order('created_at'),
        supabase.from('projects').select('id,organization_id,code,name,status').order('created_at'),
      ]);

      if (orgError || projectError) {
        setMessage(orgError?.message ?? projectError?.message ?? 'Falha ao carregar dados.');
        return;
      }

      const nextOrganizations = (orgRows ?? []) as Organization[];
      setOrganizations(nextOrganizations);
      setProjects((projectRows ?? []) as Project[]);
      setSelectedOrgId((current) => current || nextOrganizations[0]?.id || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar o espaço de trabalho.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOrganization(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc('create_organization', { p_name: orgName.trim() });
      if (error) {
        setMessage(error.message);
        return;
      }
      setOrgName('');
      if (typeof data === 'string') setSelectedOrgId(data);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a organização.');
    }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!selectedOrgId) {
      setMessage('Crie seu espaço de trabalho antes do primeiro projeto.');
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc('create_project', {
        p_organization_id: selectedOrgId,
        p_name: projectName.trim(),
        p_code: projectCode.trim() || null,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setProjectName('');
      setProjectCode('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o projeto.');
    }
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const firstAccess = !loading && organizations.length === 0;
  const visibleProjects = selectedOrgId
    ? projects.filter((project) => project.organization_id === selectedOrgId)
    : projects;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">BuildSmart V2</p>
          <h1 className="text-3xl font-bold">Projetos</h1>
        </div>
        <div className="flex gap-2">
          {!firstAccess ? (
            <Link className="rounded-lg border px-3 py-2 text-sm" href="/tasks/my">
              Minhas tarefas
            </Link>
          ) : null}
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={signOut}>
            Sair
          </button>
        </div>
      </header>

      {firstAccess ? (
        <section className="rounded-2xl border p-6">
          <p className="text-sm font-medium text-gray-500">Primeiro acesso</p>
          <h2 className="mt-1 text-2xl font-semibold">Configure seu espaço de trabalho</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            A organização reúne seus projetos e usuários. Crie a primeira organização; em seguida o BuildSmart libera a criação do primeiro Project.
          </p>
        </section>
      ) : null}

      {message ? <p className="rounded-lg border p-3 text-sm">{message}</p> : null}

      <section className="grid gap-6 md:grid-cols-2">
        <form className="flex flex-col gap-3 rounded-xl border p-5" onSubmit={createOrganization}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Passo 1</p>
            <h2 className="font-semibold">Organização</h2>
          </div>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Nome da empresa ou equipe"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            required
          />
          <button className="w-fit rounded-lg bg-black px-4 py-2 text-white">Criar organização</button>
        </form>

        <form className="flex flex-col gap-3 rounded-xl border p-5" onSubmit={createProject}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Passo 2</p>
            <h2 className="font-semibold">Primeiro projeto</h2>
          </div>
          <select
            className="rounded-lg border px-3 py-2"
            value={selectedOrgId}
            onChange={(event) => setSelectedOrgId(event.target.value)}
            required
            disabled={organizations.length === 0}
          >
            <option value="">Selecione a organização</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Código opcional"
            value={projectCode}
            onChange={(event) => setProjectCode(event.target.value)}
            disabled={organizations.length === 0}
          />
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Nome do projeto"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
            disabled={organizations.length === 0}
          />
          <button
            className="w-fit rounded-lg bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={organizations.length === 0}
          >
            Criar projeto
          </button>
        </form>
      </section>

      <section className="rounded-xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Projetos acessíveis</h2>
          <span className="text-sm text-gray-500">{visibleProjects.length}</span>
        </div>
        <div className="grid gap-3">
          {loading ? <p className="text-sm text-gray-500">Carregando...</p> : null}
          {!loading && visibleProjects.length === 0 ? (
            <p className="text-sm text-gray-500">Seu primeiro projeto aparecerá aqui.</p>
          ) : null}
          {visibleProjects.map((project) => (
            <article className="rounded-lg border p-4" key={project.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-sm text-gray-500">{project.code || 'Sem código'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium">{project.status}</span>
                  <Link className="rounded-lg border px-3 py-2 text-sm" href={`/projects/${project.id}/tasks`}>
                    Tarefas
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
