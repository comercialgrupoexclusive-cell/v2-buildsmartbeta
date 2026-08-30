'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { SupabaseTaskRepository } from '@/lib/tasks/repository';
import { TaskService } from '@/lib/tasks/service';
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from '@/lib/tasks/types';

type Member = { user_id: string; role: string };
type Project = { id: string; name: string; code: string | null };

const STATUS_LABEL: Record<TaskStatus, string> = {
  TO_DO: 'A fazer', IN_PROGRESS: 'Em andamento', WAITING: 'Aguardando', COMPLETED: 'Concluída', CANCELED: 'Cancelada',
};
const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' };

export default function TaskWorkspace({ projectId, myTasks = false }: { projectId?: string; myTasks?: boolean }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [actorId, setActorId] = useState('');
  const [view, setView] = useState<'LIST' | 'KANBAN'>('LIST');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { router.replace('/login'); return; }
    setActorId(authData.user.id);
    const service = new TaskService(new SupabaseTaskRepository(supabase));
    try {
      const nextTasks = myTasks ? await service.listMyTasks(authData.user.id) : await service.listProjectTasks(projectId!);
      setTasks(nextTasks);
      if (myTasks) {
        const ids = [...new Set(nextTasks.map((task) => task.projectId))];
        if (ids.length) {
          const { data } = await supabase.from('projects').select('id,name,code').in('id', ids);
          setProjects((data ?? []) as Project[]);
        }
      } else {
        const { data } = await supabase.from('project_memberships').select('user_id,role').eq('project_id', projectId!);
        setMembers((data ?? []) as Member[]);
      }
      setMessage(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar tarefas.'); }
  }, [myTasks, projectId, router]);

  useEffect(() => { void load(); }, [load]);

  async function createTask(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !actorId) return;
    const service = new TaskService(new SupabaseTaskRepository(createBrowserSupabaseClient()));
    try {
      await service.createTask(actorId, {
        projectId, title, priority, assigneeId: assigneeId || null,
        dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null,
      });
      setTitle(''); setPriority('NORMAL'); setAssigneeId(''); setDueAt(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao criar tarefa.'); }
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    const service = new TaskService(new SupabaseTaskRepository(createBrowserSupabaseClient()));
    try { await service.changeStatus(task.id, status); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar status.'); }
  }

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  function taskCard(task: Task) {
    return (
      <article key={task.id} className="rounded-xl border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{task.title}</p>
            {myTasks ? <p className="mt-1 text-xs text-gray-500">{projectById.get(task.projectId)?.name ?? 'Projeto'}</p> : null}
          </div>
          <span className="rounded-full border px-2 py-1 text-xs">{PRIORITY_LABEL[task.priority]}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>{STATUS_LABEL[task.status]}</span>
          <span>·</span><span>{task.dueAt ? new Date(task.dueAt).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TASK_STATUSES.filter((status) => status !== task.status).map((status) => (
            <button key={status} onClick={() => void changeStatus(task, status)} className="rounded-lg border px-2 py-1 text-xs" type="button">{STATUS_LABEL[status]}</button>
          ))}
        </div>
      </article>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-medium text-gray-500">BuildSmart V2 · G04</p><h1 className="text-3xl font-bold">{myTasks ? 'Minhas tarefas' : 'Tarefas do projeto'}</h1></div>
        <nav className="flex gap-2"><Link className="rounded-lg border px-3 py-2 text-sm" href="/projects">Projetos</Link><Link className="rounded-lg border px-3 py-2 text-sm" href="/tasks/my">Minhas tarefas</Link></nav>
      </header>
      {message ? <p className="rounded-lg border p-3 text-sm">{message}</p> : null}

      {!myTasks ? (
        <form onSubmit={createTask} className="grid gap-3 rounded-xl border p-4 md:grid-cols-5">
          <input className="rounded-lg border px-3 py-2 md:col-span-2" placeholder="Nova tarefa" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <select className="rounded-lg border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>{TASK_PRIORITIES.map((item) => <option key={item} value={item}>{PRIORITY_LABEL[item]}</option>)}</select>
          <select className="rounded-lg border px-3 py-2" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Sem responsável</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.user_id === actorId ? 'Eu' : `${member.user_id.slice(0, 8)}…`} · {member.role}</option>)}</select>
          <input className="rounded-lg border px-3 py-2" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <button className="w-fit rounded-lg bg-black px-4 py-2 text-white" type="submit">Criar tarefa</button>
        </form>
      ) : null}

      <div className="flex items-center justify-between"><p className="text-sm text-gray-500">{tasks.length} tarefa(s)</p><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setView('LIST')}>Lista</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setView('KANBAN')}>Kanban</button></div></div>

      {view === 'LIST' ? <section className="grid gap-3">{tasks.map(taskCard)}{tasks.length === 0 ? <p className="text-sm text-gray-500">Nenhuma tarefa neste contexto.</p> : null}</section> : (
        <section className="grid gap-4 overflow-x-auto md:grid-cols-5">
          {TASK_STATUSES.map((status) => <div key={status} className="min-w-64 rounded-xl bg-gray-50 p-3"><div className="mb-3 flex justify-between"><h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2><span className="text-xs text-gray-500">{tasks.filter((task) => task.status === status).length}</span></div><div className="grid gap-3">{tasks.filter((task) => task.status === status).map(taskCard)}</div></div>)}
        </section>
      )}
    </main>
  );
}
