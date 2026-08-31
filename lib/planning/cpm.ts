export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export type CpmActivity = {
  id: string;
  durationDays: number;
};

export type CpmDependency = {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
};

export type CpmResult = {
  id: string;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  isCritical: boolean;
};

export class CycleError extends Error {
  constructor() {
    super('A rede de dependências contém um ciclo.');
    this.name = 'CycleError';
  }
}

function topologicalOrder(activityIds: string[], dependencies: CpmDependency[]): string[] {
  const inDegree = new Map<string, number>(activityIds.map((id) => [id, 0]));
  const successorsOf = new Map<string, string[]>(activityIds.map((id) => [id, []]));

  for (const dep of dependencies) {
    successorsOf.get(dep.predecessorId)?.push(dep.successorId);
    inDegree.set(dep.successorId, (inDegree.get(dep.successorId) ?? 0) + 1);
  }

  const queue = activityIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const successorId of successorsOf.get(id) ?? []) {
      const remaining = (inDegree.get(successorId) ?? 0) - 1;
      inDegree.set(successorId, remaining);
      if (remaining === 0) queue.push(successorId);
    }
  }

  if (order.length !== activityIds.length) throw new CycleError();
  return order;
}

/**
 * Forward/backward pass CPM (Critical Path Method) sobre um grafo de
 * atividades e dependências FS/SS/FF/SF com lag. Suporta sub-redes
 * desconectadas: cada componente sem predecessores começa em ES=0.
 */
export function computeCpm(activities: CpmActivity[], dependencies: CpmDependency[]): CpmResult[] {
  const activityIds = activities.map((a) => a.id);
  const durationOf = new Map(activities.map((a) => [a.id, a.durationDays]));
  const order = topologicalOrder(activityIds, dependencies);

  const predecessorsOf = new Map<string, CpmDependency[]>(activityIds.map((id) => [id, []]));
  const successorsOf = new Map<string, CpmDependency[]>(activityIds.map((id) => [id, []]));
  for (const dep of dependencies) {
    predecessorsOf.get(dep.successorId)?.push(dep);
    successorsOf.get(dep.predecessorId)?.push(dep);
  }

  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  for (const id of order) {
    const duration = durationOf.get(id) ?? 0;
    let es = 0;
    for (const dep of predecessorsOf.get(id) ?? []) {
      const predEs = earlyStart.get(dep.predecessorId) ?? 0;
      const predEf = earlyFinish.get(dep.predecessorId) ?? 0;
      if (dep.type === 'FS') es = Math.max(es, predEf + dep.lagDays);
      else if (dep.type === 'SS') es = Math.max(es, predEs + dep.lagDays);
      else if (dep.type === 'FF') es = Math.max(es, predEf + dep.lagDays - duration);
      else es = Math.max(es, predEs + dep.lagDays - duration);
    }
    earlyStart.set(id, es);
    earlyFinish.set(id, es + duration);
  }

  const projectFinish = Math.max(0, ...Array.from(earlyFinish.values()));

  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();

  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i]!;
    const duration = durationOf.get(id) ?? 0;
    const successors = successorsOf.get(id) ?? [];
    let lf = projectFinish;
    if (successors.length > 0) {
      lf = Math.min(
        ...successors.map((dep) => {
          const succLs = lateStart.get(dep.successorId) ?? projectFinish;
          const succLf = lateFinish.get(dep.successorId) ?? projectFinish;
          if (dep.type === 'FS') return succLs - dep.lagDays;
          if (dep.type === 'SS') return succLs - dep.lagDays + duration;
          if (dep.type === 'FF') return succLf - dep.lagDays;
          return succLf - dep.lagDays + duration;
        }),
      );
    }
    lateFinish.set(id, lf);
    lateStart.set(id, lf - duration);
  }

  return activityIds.map((id) => {
    const es = earlyStart.get(id) ?? 0;
    const ef = earlyFinish.get(id) ?? 0;
    const ls = lateStart.get(id) ?? 0;
    const lf = lateFinish.get(id) ?? 0;
    const totalFloat = ls - es;
    return { id, earlyStart: es, earlyFinish: ef, lateStart: ls, lateFinish: lf, totalFloat, isCritical: totalFloat <= 0 };
  });
}
