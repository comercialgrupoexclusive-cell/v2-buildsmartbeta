import type { BudgetRepository } from './repository';
import type {
  Budget, BudgetItem, BudgetMarkup, BudgetRevision, CostItem,
  CreateBudgetItemInput, CreateBudgetMarkupInput, CreateCostItemInput,
} from './types';

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
  constructor(private readonly repository: BudgetRepository) {}

  /**
   * Retorna o Budget DRAFT ativo do Project. Se não houver DRAFT mas já existir
   * histórico (ex: o único Budget está APPROVED), retorna o mais recente em vez
   * de criar um novo silenciosamente - criar uma nova revisão é ação explícita
   * do usuário (ver createRevision), nunca implícita no simples carregar a tela.
   * Só cria um Budget novo quando o Project realmente não tem nenhum ainda.
   */
  async getOrCreateActiveBudget(projectId: string, createdBy: string, defaultName: string): Promise<Budget> {
    const draft = await this.repository.getActiveBudget(projectId);
    if (draft) return draft;

    const revisions = await this.repository.listRevisions(projectId);
    if (revisions.length > 0) {
      const [latest] = revisions;
      return this.repository.getBudget(latest!.id);
    }

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

  async getProjectOrganizationId(projectId: string): Promise<string> {
    return this.repository.getProjectOrganizationId(projectId);
  }

  async listCostItems(organizationId: string): Promise<CostItem[]> {
    return this.repository.listCostItems(organizationId);
  }

  async createCostItem(input: CreateCostItemInput): Promise<CostItem> {
    if (!input.description.trim()) throw new Error('Descrição é obrigatória.');
    if (!input.unit.trim()) throw new Error('Unidade é obrigatória.');
    return this.repository.createCostItem(input);
  }

  async listRevisions(projectId: string): Promise<BudgetRevision[]> {
    return this.repository.listRevisions(projectId);
  }

  async createRevision(sourceBudgetId: string, name: string): Promise<Budget> {
    if (!name.trim()) throw new Error('Nome da revisão é obrigatório.');
    return this.repository.duplicateBudget(sourceBudgetId, name);
  }
}
