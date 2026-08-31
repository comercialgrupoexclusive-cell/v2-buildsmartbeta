import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BudgetItemOption, CreatePlanningActivityInput, CreatePlanningDependencyInput,
  PlanningActivity, PlanningActivityBudgetLink, PlanningDependency, PlanningActivityStatus,
} from './types';
import type { DependencyType } from './cpm';

type ActivityRow = {
  id: string; project_id: string; parent_id: string | null; name: string;
  planned_start_date: string; planned_end_date: string; duration_days: number;
  status: PlanningActivityStatus; position: number;
};
type LinkRow = { id: string; activity_id: string; budget_item_id: string; budget_items: { description: string } | null };
type DependencyRow = {
  id: string; predecessor_id: string; successor_id: string; dependency_type: DependencyType; lag_days: number;
};

function mapActivity(row: ActivityRow): PlanningActivity {
  return {
    id: row.id, projectId: row.project_id, parentId: row.parent_id, name: row.name,
    plannedStartDate: row.planned_start_date, plannedEndDate: row.planned_end_date,
    durationDays: row.duration_days, status: row.status, position: row.position,
  };
}

function mapLink(row: LinkRow): PlanningActivityBudgetLink {
  return {
    id: row.id, activityId: row.activity_id, budgetItemId: row.budget_item_id,
    budgetItemDescription: row.budget_items?.description ?? '',
  };
}

function mapDependency(row: DependencyRow): PlanningDependency {
  return {
    id: row.id, predecessorId: row.predecessor_id, successorId: row.successor_id,
    dependencyType: row.dependency_type, lagDays: row.lag_days,
  };
}

export interface PlanningRepository {
  listActivities(projectId: string): Promise<PlanningActivity[]>;
  addActivity(input: CreatePlanningActivityInput): Promise<PlanningActivity>;
  removeActivity(activityId: string): Promise<void>;
  listBudgetLinks(projectId: string): Promise<PlanningActivityBudgetLink[]>;
  linkBudgetItem(activityId: string, budgetItemId: string): Promise<PlanningActivityBudgetLink>;
  unlinkBudgetItem(linkId: string): Promise<void>;
  listBudgetItemOptions(projectId: string): Promise<BudgetItemOption[]>;
  listDependencies(projectId: string): Promise<PlanningDependency[]>;
  addDependency(input: CreatePlanningDependencyInput): Promise<PlanningDependency>;
  removeDependency(dependencyId: string): Promise<void>;
}

export class SupabasePlanningRepository implements PlanningRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listActivities(projectId: string): Promise<PlanningActivity[]> {
    const { data, error } = await this.client
      .from('planning_activities')
      .select('id,project_id,parent_id,name,planned_start_date,planned_end_date,duration_days,status,position')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapActivity(row as ActivityRow));
  }

  async addActivity(input: CreatePlanningActivityInput): Promise<PlanningActivity> {
    const { data, error } = await this.client
      .from('planning_activities')
      .insert({
        project_id: input.projectId, parent_id: input.parentId, name: input.name,
        planned_start_date: input.plannedStartDate, planned_end_date: input.plannedEndDate,
        duration_days: input.durationDays,
      })
      .select('id,project_id,parent_id,name,planned_start_date,planned_end_date,duration_days,status,position')
      .single();
    if (error) throw error;
    return mapActivity(data as ActivityRow);
  }

  async removeActivity(activityId: string): Promise<void> {
    const { error } = await this.client.from('planning_activities').delete().eq('id', activityId);
    if (error) throw error;
  }

  async listBudgetLinks(projectId: string): Promise<PlanningActivityBudgetLink[]> {
    const { data, error } = await this.client
      .from('planning_activity_budget_items')
      .select('id,activity_id,budget_item_id,budget_items(description),planning_activities!inner(project_id)')
      .eq('planning_activities.project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => mapLink(row as unknown as LinkRow));
  }

  async linkBudgetItem(activityId: string, budgetItemId: string): Promise<PlanningActivityBudgetLink> {
    const { data, error } = await this.client
      .from('planning_activity_budget_items')
      .insert({ activity_id: activityId, budget_item_id: budgetItemId })
      .select('id,activity_id,budget_item_id,budget_items(description)')
      .single();
    if (error) throw error;
    return mapLink(data as unknown as LinkRow);
  }

  async unlinkBudgetItem(linkId: string): Promise<void> {
    const { error } = await this.client.from('planning_activity_budget_items').delete().eq('id', linkId);
    if (error) throw error;
  }

  async listBudgetItemOptions(projectId: string): Promise<BudgetItemOption[]> {
    const { data, error } = await this.client
      .from('budget_items')
      .select('id,description,budgets!inner(project_id)')
      .eq('budgets.project_id', projectId)
      .order('description', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: (row as { id: string }).id, description: (row as { description: string }).description }));
  }

  async listDependencies(projectId: string): Promise<PlanningDependency[]> {
    const { data, error } = await this.client
      .from('planning_dependencies')
      .select('id,predecessor_id,successor_id,dependency_type,lag_days,planning_activities!planning_dependencies_predecessor_id_fkey!inner(project_id)')
      .eq('planning_activities.project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => mapDependency(row as unknown as DependencyRow));
  }

  async addDependency(input: CreatePlanningDependencyInput): Promise<PlanningDependency> {
    const { data, error } = await this.client
      .from('planning_dependencies')
      .insert({
        predecessor_id: input.predecessorId, successor_id: input.successorId,
        dependency_type: input.dependencyType, lag_days: input.lagDays,
      })
      .select('id,predecessor_id,successor_id,dependency_type,lag_days')
      .single();
    if (error) throw error;
    return mapDependency(data as DependencyRow);
  }

  async removeDependency(dependencyId: string): Promise<void> {
    const { error } = await this.client.from('planning_dependencies').delete().eq('id', dependencyId);
    if (error) throw error;
  }
}
