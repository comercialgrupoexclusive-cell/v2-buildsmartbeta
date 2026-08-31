'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { SupabasePlanningRepository } from '@/lib/planning/repository';
import { PlanningService, buildActivityTree, type PlanningActivityNode } from '@/lib/planning/service';
import type { BudgetItemOption, DependencyType, PlanningActivityBudgetLink, PlanningDependency } from '@/lib/planning/types';
import { computeCpm, CycleError, type CpmResult } from '@/lib/planning/cpm';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const DEPENDENCY_TYPE_LABEL: Record<DependencyType, string> = {
  FS: 'Fim → Início', SS: 'Início → Início', FF: 'Fim → Fim', SF: 'Início → Fim',
};

function ActivityRow({
  node, depth, links, schedule, onAddChild, onRemove, onLinkClick,
}: {
  node: PlanningActivityNode; depth: number; links: PlanningActivityBudgetLink[]; schedule: Map<string, CpmResult>;
  onAddChild: (parentId: string) => void; onRemove: (id: string) => void; onLinkClick: (activityId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const ownLinks = links.filter((l) => l.activityId === node.id);
  const cpm = schedule.get(node.id);

  return (
    <div>
      <div className="flex items-start gap-2 border-b py-2" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button type="button" className="w-5 shrink-0 text-gray-500" onClick={() => setExpanded((v) => !v)} aria-label="Expandir">
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{node.name}</p>
            {cpm?.isCritical ? (
              <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">crítico</span>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">
            {formatDate(node.plannedStartDate)} – {formatDate(node.plannedEndDate)} · {node.durationDays}d
            {cpm ? ` · folga ${cpm.totalFloat}d` : ''}
          </p>
          {ownLinks.length > 0 ? (
            <p className="mt-0.5 truncate text-xs text-blue-700">
              orçamento: {ownLinks.map((l) => l.budgetItemDescription).join(', ')}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-amber-600">sem item de orçamento vinculado</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => onAddChild(node.id)}>+ sub</button>
            <button type="button" className="rounded border px-2 py-1 text-xs text-red-600" onClick={() => onRemove(node.id)}>x</button>
          </div>
          <button type="button" className="rounded border px-2 py-1 text-xs text-blue-700" onClick={() => onLinkClick(node.id)}>+ item orçamento</button>
        </div>
      </div>
      {expanded && hasChildren
        ? node.children.map((child) => (
            <ActivityRow key={child.id} node={child} depth={depth + 1} links={links} schedule={schedule} onAddChild={onAddChild} onRemove={onRemove} onLinkClick={onLinkClick} />
          ))
        : null}
    </div>
  );
}

export default function PlanningWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [actorId, setActorId] = useState('');
  const [activities, setActivities] = useState<PlanningActivityNode[]>([]);
  const [links, setLinks] = useState<PlanningActivityBudgetLink[]>([]);
  const [budgetItemOptions, setBudgetItemOptions] = useState<BudgetItemOption[]>([]);
  const [dependencies, setDependencies] = useState<PlanningDependency[]>([]);

  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetItemId, setBudgetItemId] = useState('');

  const [linkingActivityId, setLinkingActivityId] = useState<string | null>(null);
  const [linkBudgetItemId, setLinkBudgetItemId] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [predecessorId, setPredecessorId] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [dependencyType, setDependencyType] = useState<DependencyType>('FS');
  const [lagDays, setLagDays] = useState('0');

  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { router.replace('/login'); return; }
      setActorId(authData.user.id);

      const service = new PlanningService(new SupabasePlanningRepository(supabase));
      const [flatActivities, activityLinks, options, deps] = await Promise.all([
        service.listActivities(projectId),
        service.listBudgetLinks(projectId),
        service.listBudgetItemOptions(projectId),
        service.listDependencies(projectId),
      ]);
      setActivities(buildActivityTree(flatActivities));
      setLinks(activityLinks);
      setBudgetItemOptions(options);
      setDependencies(deps);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar planejamento.');
    }
  }, [projectId, router]);

  useEffect(() => { void load(); }, [load]);

  const flatActivities = useMemo(() => {
    const flatten = (nodes: PlanningActivityNode[]): PlanningActivityNode[] =>
      nodes.flatMap((node) => [node, ...flatten(node.children)]);
    return flatten(activities);
  }, [activities]);

  const schedule = useMemo(() => {
    try {
      const result = computeCpm(
        flatActivities.map((a) => ({ id: a.id, durationDays: a.durationDays })),
        dependencies.map((d) => ({ predecessorId: d.predecessorId, successorId: d.successorId, type: d.dependencyType, lagDays: d.lagDays })),
      );
      return new Map(result.map((r) => [r.id, r]));
    } catch (error) {
      if (error instanceof CycleError) return new Map<string, CpmResult>();
      throw error;
    }
  }, [flatActivities, dependencies]);

  function resetActivityForm() {
    setName(''); setStartDate(''); setEndDate(''); setBudgetItemId(''); setAddingUnder(null);
  }

  async function submitActivity(event: FormEvent) {
    event.preventDefault();
    if (!actorId) return;
    try {
      const service = new PlanningService(new SupabasePlanningRepository(createBrowserSupabaseClient()));
      const activity = await service.addActivity({
        projectId, parentId: addingUnder, name, plannedStartDate: startDate, plannedEndDate: endDate, createdBy: actorId,
      });
      if (budgetItemId) await service.linkBudgetItem(activity.id, budgetItemId);
      resetActivityForm();
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao adicionar atividade.'); }
  }

  async function removeActivity(activityId: string) {
    try {
      const service = new PlanningService(new SupabasePlanningRepository(createBrowserSupabaseClient()));
      await service.removeActivity(activityId);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao remover atividade.'); }
  }

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    if (!linkingActivityId) return;
    try {
      const service = new PlanningService(new SupabasePlanningRepository(createBrowserSupabaseClient()));
      await service.linkBudgetItem(linkingActivityId, linkBudgetItemId);
      setLinkingActivityId(null); setLinkBudgetItemId('');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao vincular item de orçamento.'); }
  }

  async function submitDependency(event: FormEvent) {
    event.preventDefault();
    if (!actorId) return;
    try {
      const service = new PlanningService(new SupabasePlanningRepository(createBrowserSupabaseClient()));
      await service.addDependency({
        predecessorId, successorId, dependencyType, lagDays: Number(lagDays) || 0, createdBy: actorId,
      });
      setPredecessorId(''); setSuccessorId(''); setDependencyType('FS'); setLagDays('0');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao criar dependência.'); }
  }

  async function removeDependency(dependencyId: string) {
    try {
      const service = new PlanningService(new SupabasePlanningRepository(createBrowserSupabaseClient()));
      await service.removeDependency(dependencyId);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao remover dependência.'); }
  }

  const projectFinish = flatActivities.length > 0
    ? Math.max(...flatActivities.map((a) => schedule.get(a.id)?.earlyFinish ?? 0))
    : 0;
  const criticalCount = flatActivities.filter((a) => schedule.get(a.id)?.isCritical).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col pb-32">
      <div className="sticky top-0 z-10 border-b bg-white p-4">
        <button type="button" className="mb-2 text-sm text-gray-500" onClick={() => router.push('/projects')}>
          ‹ Projetos
        </button>
        <h1 className="text-xl font-bold">Planejamento</h1>
        {flatActivities.length > 0 ? (
          <p className="mt-1 text-sm text-gray-600">
            Duração total: <span className="font-semibold">{projectFinish}d</span> · {criticalCount} atividade(s) no caminho crítico
          </p>
        ) : null}
      </div>

      {message ? <p className="mx-4 mt-3 rounded-lg border p-3 text-sm text-gray-700">{message}</p> : null}

      <div className="mt-2 flex-1">
        {flatActivities.length === 0 ? (
          <p className="mx-4 mt-6 text-sm text-gray-500">Nenhuma atividade ainda. Adicione a primeira no formulário abaixo.</p>
        ) : (
          activities.map((node) => (
            <ActivityRow
              key={node.id} node={node} depth={0} links={links} schedule={schedule}
              onAddChild={setAddingUnder} onRemove={removeActivity} onLinkClick={setLinkingActivityId}
            />
          ))
        )}
      </div>

      {linkingActivityId ? (
        <div className="mx-4 mt-4 rounded-2xl border p-4">
          <p className="mb-2 text-sm font-medium">Vincular item de orçamento</p>
          <form className="flex flex-col gap-2" onSubmit={submitLink}>
            <select className="rounded-lg border px-3 py-2 text-sm" value={linkBudgetItemId} onChange={(e) => setLinkBudgetItemId(e.target.value)} required>
              <option value="">Selecione um item...</option>
              {budgetItemOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.description}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white" type="submit">Vincular</button>
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setLinkingActivityId(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="mx-4 mt-4">
        <button type="button" className="text-sm font-medium text-gray-600 underline" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Ocultar avançado' : 'Avançado (dependências)'}
        </button>
        {showAdvanced ? (
          <div className="mt-3 rounded-2xl border p-4">
            <p className="mb-2 text-sm font-medium">Dependências</p>
            {dependencies.length === 0 ? <p className="text-xs text-gray-500">Nenhuma dependência ainda.</p> : null}
            <ul className="mb-3 flex flex-col gap-1">
              {dependencies.map((dep) => {
                const predecessor = flatActivities.find((a) => a.id === dep.predecessorId);
                const successor = flatActivities.find((a) => a.id === dep.successorId);
                return (
                  <li key={dep.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {predecessor?.name ?? '?'} → {successor?.name ?? '?'} ({DEPENDENCY_TYPE_LABEL[dep.dependencyType]}
                      {dep.lagDays !== 0 ? `, lag ${dep.lagDays}d` : ''})
                    </span>
                    <button type="button" className="shrink-0 text-red-600" onClick={() => removeDependency(dep.id)}>x</button>
                  </li>
                );
              })}
            </ul>
            <form className="flex flex-col gap-2" onSubmit={submitDependency}>
              <select className="rounded-lg border px-3 py-2 text-sm" value={predecessorId} onChange={(e) => setPredecessorId(e.target.value)} required>
                <option value="">Predecessora...</option>
                {flatActivities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="rounded-lg border px-3 py-2 text-sm" value={successorId} onChange={(e) => setSuccessorId(e.target.value)} required>
                <option value="">Sucessora...</option>
                {flatActivities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div className="flex gap-2">
                <select className="flex-1 rounded-lg border px-3 py-2 text-sm" value={dependencyType} onChange={(e) => setDependencyType(e.target.value as DependencyType)}>
                  {(['FS', 'SS', 'FF', 'SF'] as const).map((type) => (
                    <option key={type} value={type}>{DEPENDENCY_TYPE_LABEL[type]}</option>
                  ))}
                </select>
                <input className="w-20 rounded-lg border px-3 py-2 text-sm" type="number" placeholder="lag" value={lagDays} onChange={(e) => setLagDays(e.target.value)} />
              </div>
              <button className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white" type="submit">Adicionar dependência</button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl border-t bg-white p-4">
        {addingUnder !== null ? <p className="mb-1 text-xs text-gray-500">Adicionando sub-atividade</p> : null}
        <form className="flex flex-col gap-2" onSubmit={submitActivity}>
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Nome da atividade" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex gap-2">
            <input className="flex-1 rounded-lg border px-3 py-2 text-sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <input className="flex-1 rounded-lg border px-3 py-2 text-sm" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <select className="rounded-lg border px-3 py-2 text-sm" value={budgetItemId} onChange={(e) => setBudgetItemId(e.target.value)}>
            <option value="">Item de orçamento (opcional agora)...</option>
            {budgetItemOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.description}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white" type="submit">
              {addingUnder ? 'Adicionar sub-atividade' : '+ Atividade'}
            </button>
            {addingUnder ? (
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAddingUnder(null)}>Cancelar</button>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
