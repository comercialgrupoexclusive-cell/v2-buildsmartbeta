import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Budget, BudgetItem, BudgetMarkup, BudgetRevision, CostItem,
  CreateBudgetItemInput, CreateBudgetMarkupInput, CreateCostItemInput,
} from './types';

type BudgetRow = { id: string; project_id: string; name: string; status: 'DRAFT' | 'APPROVED'; parent_budget_id: string | null };
type ItemRow = {
  id: string; budget_id: string; parent_id: string | null; cost_item_id: string | null;
  description: string; unit: string | null; quantity: string; unit_price: string; position: number;
};
type MarkupRow = { id: string; budget_id: string; name: string; type: 'PERCENTAGE' | 'FIXED'; category: string | null; value: string };
type CostItemRow = { id: string; organization_id: string; description: string; unit: string; type: 'MATERIAL' | 'LABOR' | 'SERVICE'; unit_price: string };

function mapBudget(row: BudgetRow): Budget {
  return { id: row.id, projectId: row.project_id, name: row.name, status: row.status, parentBudgetId: row.parent_budget_id };
}

function mapItem(row: ItemRow): BudgetItem {
  return {
    id: row.id, budgetId: row.budget_id, parentId: row.parent_id, costItemId: row.cost_item_id,
    description: row.description, unit: row.unit, quantity: Number(row.quantity), unitPrice: Number(row.unit_price),
    position: row.position,
  };
}

function mapMarkup(row: MarkupRow): BudgetMarkup {
  return { id: row.id, budgetId: row.budget_id, name: row.name, type: row.type, category: row.category, value: Number(row.value) };
}

function mapCostItem(row: CostItemRow): CostItem {
  return { id: row.id, organizationId: row.organization_id, description: row.description, unit: row.unit, type: row.type, unitPrice: Number(row.unit_price) };
}

export interface BudgetRepository {
  getActiveBudget(projectId: string): Promise<Budget | null>;
  getBudget(budgetId: string): Promise<Budget>;
  createBudget(projectId: string, name: string, createdBy: string): Promise<Budget>;
  listItems(budgetId: string): Promise<BudgetItem[]>;
  addItem(input: CreateBudgetItemInput): Promise<BudgetItem>;
  removeItem(itemId: string): Promise<void>;
  listMarkups(budgetId: string): Promise<BudgetMarkup[]>;
  addMarkup(input: CreateBudgetMarkupInput): Promise<BudgetMarkup>;
  removeMarkup(markupId: string): Promise<void>;
  approve(budgetId: string): Promise<Budget>;
  getFinalTotal(budgetId: string): Promise<{ direct: number; final: number }>;
  getProjectOrganizationId(projectId: string): Promise<string>;
  listCostItems(organizationId: string): Promise<CostItem[]>;
  createCostItem(input: CreateCostItemInput): Promise<CostItem>;
  listRevisions(projectId: string): Promise<BudgetRevision[]>;
  duplicateBudget(sourceBudgetId: string, name: string): Promise<Budget>;
}

export class SupabaseBudgetRepository implements BudgetRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getActiveBudget(projectId: string): Promise<Budget | null> {
    const { data, error } = await this.client
      .from('budgets')
      .select('id,project_id,name,status,parent_budget_id')
      .eq('project_id', projectId)
      .eq('status', 'DRAFT')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBudget(data as BudgetRow) : null;
  }

  async getBudget(budgetId: string): Promise<Budget> {
    const { data, error } = await this.client
      .from('budgets').select('id,project_id,name,status,parent_budget_id').eq('id', budgetId).single();
    if (error) throw error;
    return mapBudget(data as BudgetRow);
  }

  async createBudget(projectId: string, name: string, createdBy: string): Promise<Budget> {
    const { data, error } = await this.client
      .from('budgets')
      .insert({ project_id: projectId, name, created_by: createdBy })
      .select('id,project_id,name,status,parent_budget_id')
      .single();
    if (error) throw error;
    return mapBudget(data as BudgetRow);
  }

  async listItems(budgetId: string): Promise<BudgetItem[]> {
    const { data, error } = await this.client
      .from('budget_items')
      .select('id,budget_id,parent_id,cost_item_id,description,unit,quantity,unit_price,position')
      .eq('budget_id', budgetId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapItem(row as ItemRow));
  }

  async addItem(input: CreateBudgetItemInput): Promise<BudgetItem> {
    const { data, error } = await this.client
      .from('budget_items')
      .insert({
        budget_id: input.budgetId, parent_id: input.parentId, cost_item_id: input.costItemId ?? null,
        description: input.description, quantity: input.quantity, unit_price: input.unitPrice,
      })
      .select('id,budget_id,parent_id,cost_item_id,description,unit,quantity,unit_price,position')
      .single();
    if (error) throw error;
    return mapItem(data as ItemRow);
  }

  async removeItem(itemId: string): Promise<void> {
    const { error } = await this.client.from('budget_items').delete().eq('id', itemId);
    if (error) throw error;
  }

  async listMarkups(budgetId: string): Promise<BudgetMarkup[]> {
    const { data, error } = await this.client
      .from('budget_markups')
      .select('id,budget_id,name,type,category,value')
      .eq('budget_id', budgetId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapMarkup(row as MarkupRow));
  }

  async addMarkup(input: CreateBudgetMarkupInput): Promise<BudgetMarkup> {
    const { data, error } = await this.client
      .from('budget_markups')
      .insert({ budget_id: input.budgetId, name: input.name, type: input.type, value: input.value })
      .select('id,budget_id,name,type,category,value')
      .single();
    if (error) throw error;
    return mapMarkup(data as MarkupRow);
  }

  async removeMarkup(markupId: string): Promise<void> {
    const { error } = await this.client.from('budget_markups').delete().eq('id', markupId);
    if (error) throw error;
  }

  async approve(budgetId: string): Promise<Budget> {
    const { data, error } = await this.client.rpc('approve_budget', { p_budget_id: budgetId });
    if (error) throw error;
    return mapBudget(data as BudgetRow);
  }

  async getFinalTotal(budgetId: string): Promise<{ direct: number; final: number }> {
    const [{ data: direct, error: directError }, { data: final, error: finalError }] = await Promise.all([
      this.client.rpc('budget_total', { p_budget_id: budgetId }),
      this.client.rpc('budget_final_total', { p_budget_id: budgetId }),
    ]);
    if (directError) throw directError;
    if (finalError) throw finalError;
    return { direct: Number(direct ?? 0), final: Number(final ?? 0) };
  }

  async getProjectOrganizationId(projectId: string): Promise<string> {
    const { data, error } = await this.client.from('projects').select('organization_id').eq('id', projectId).single();
    if (error) throw error;
    return (data as { organization_id: string }).organization_id;
  }

  async listCostItems(organizationId: string): Promise<CostItem[]> {
    const { data, error } = await this.client
      .from('cost_items')
      .select('id,organization_id,description,unit,type,unit_price')
      .eq('organization_id', organizationId)
      .order('description', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapCostItem(row as CostItemRow));
  }

  async createCostItem(input: CreateCostItemInput): Promise<CostItem> {
    const { data, error } = await this.client
      .from('cost_items')
      .insert({
        organization_id: input.organizationId, description: input.description, unit: input.unit,
        type: input.type, unit_price: input.unitPrice, created_by: input.createdBy,
      })
      .select('id,organization_id,description,unit,type,unit_price')
      .single();
    if (error) throw error;
    return mapCostItem(data as CostItemRow);
  }

  async listRevisions(projectId: string): Promise<BudgetRevision[]> {
    const { data, error } = await this.client
      .from('budgets')
      .select('id,name,status,parent_budget_id,created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id, name: row.name, status: row.status, parentBudgetId: row.parent_budget_id, createdAt: row.created_at,
    }));
  }

  async duplicateBudget(sourceBudgetId: string, name: string): Promise<Budget> {
    const { data, error } = await this.client.rpc('duplicate_budget', { p_source_budget_id: sourceBudgetId, p_name: name });
    if (error) throw error;
    return mapBudget(data as BudgetRow);
  }
}
