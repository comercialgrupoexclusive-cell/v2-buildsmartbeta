import type { SupabaseBudgetRepository } from './repository';
import type { Budget, BudgetItem, BudgetMarkup, CreateBudgetItemInput, CreateBudgetMarkupInput } from './types';

export type BudgetItemNode = BudgetItem & { children: BudgetItemNode[] };

/** Pure function: nó folha = quantidade × preço unitário; nó pai = soma dos filhos. */
export function computeNodeTotal(node: BudgetItemNode): number {
  if (node.children.length === 0) return node.quantity * node.unitPrice;
  return node.children.reduce((sum, child) => sum + computeNodeTotal(child), 0);
}

/** Pure function: monta a árvore livre de BudgetItem a partir da lista plana. */
export function buildItemTree(items: BudgetItem[]): BudgetItemNode[] {
  const nodes = new Map<string, BudgetItemNode>(items.map((item) => [item.id, { ...item, children: [] }]));
  const roots: BudgetItemNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export class BudgetService {
  constructor(private readonly repository: SupabaseBudgetRepository) {}

  async getOrCreateActiveBudget(projectId: string, createdBy: string, defaultName: string): Promise<Budget> {
    const existing = await this.repository.getActiveBudget(projectId);
    if (existing) return existing;
    return this.repository.createBudget(projectId, defaultName, createdBy);
  }

  async listItems(budgetId: string): Promise<BudgetItem[]> {
    return this.repository.listItems(budgetId);
  }

  async addItem(input: CreateBudgetItemInput): Promise<BudgetItem> {
    if (!input.description.trim()) throw new Error('Descrição é obrigatória.');
    return this.repository.addItem(input);
  }

  async removeItem(itemId: string): Promise<void> {
    return this.repository.removeItem(itemId);
  }

  async listMarkups(budgetId: string): Promise<BudgetMarkup[]> {
    return this.repository.listMarkups(budgetId);
  }

  async addMarkup(input: CreateBudgetMarkupInput): Promise<BudgetMarkup> {
    if (!input.name.trim()) throw new Error('Nome do markup é obrigatório.');
    return this.repository.addMarkup(input);
  }

  async removeMarkup(markupId: string): Promise<void> {
    return this.repository.removeMarkup(markupId);
  }

  async approve(budgetId: string): Promise<Budget> {
    return this.repository.approve(budgetId);
  }

  async getFinalTotal(budgetId: string): Promise<{ direct: number; final: number }> {
    return this.repository.getFinalTotal(budgetId);
  }
}
