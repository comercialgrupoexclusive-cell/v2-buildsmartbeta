import type { PlanningRepository } from './repository';
import type {
  BudgetItemOption, CreatePlanningDependencyInput, PlanningActivity,
  PlanningActivityBudgetLink, PlanningDependency,
} from './types';

export type PlanningActivityNode = PlanningActivity & { children: PlanningActivityNode[] };

/** Pure function: monta a árvore livre de PlanningActivity a partir da lista plana. */
export function buildActivityTree(activities: PlanningActivity[]): PlanningActivityNode[] {
  const nodes = new Map<string, PlanningActivityNode>(activities.map((a) => [a.id, { ...a, children: [] }]));
  const roots: PlanningActivityNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Diferença em dias corridos entre duas datas ISO (`YYYY-MM-DD`). */
export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export class PlanningService {
  constructor(private readonly repository: PlanningRepository) {}

  async listActivities(projectId: string): Promise<PlanningActivity[]> {
    return this.repository.listActivities(projectId);
  }

  async addActivity(input: {
    projectId: string; parentId: string | null; name: string;
    plannedStartDate: string; plannedEndDate: string; createdBy: string;
  }): Promise<PlanningActivity> {
    if (!input.name.trim()) throw new Error('Nome da atividade é obrigatório.');
    const durationDays = daysBetween(input.plannedStartDate, input.plannedEndDate);
    if (durationDays < 0) throw new Error('Data de término não pode ser antes da data de início.');
    return this.repository.addActivity({ ...input, durationDays });
  }

  async removeActivity(activityId: string): Promise<void> {
    return this.repository.removeActivity(activityId);
  }

  async listBudgetLinks(projectId: string): Promise<PlanningActivityBudgetLink[]> {
    return this.repository.listBudgetLinks(projectId);
  }

  async linkBudgetItem(activityId: string, budgetItemId: string): Promise<PlanningActivityBudgetLink> {
    if (!budgetItemId) throw new Error('Selecione um item de orçamento.');
    return this.repository.linkBudgetItem(activityId, budgetItemId);
  }

  async unlinkBudgetItem(linkId: string): Promise<void> {
    return this.repository.unlinkBudgetItem(linkId);
  }

  async listBudgetItemOptions(projectId: string): Promise<BudgetItemOption[]> {
    return this.repository.listBudgetItemOptions(projectId);
  }

  async listDependencies(projectId: string): Promise<PlanningDependency[]> {
    return this.repository.listDependencies(projectId);
  }

  async addDependency(input: CreatePlanningDependencyInput): Promise<PlanningDependency> {
    if (input.predecessorId === input.successorId) throw new Error('Uma atividade não pode depender de si mesma.');
    return this.repository.addDependency(input);
  }

  async removeDependency(dependencyId: string): Promise<void> {
    return this.repository.removeDependency(dependencyId);
  }
}
