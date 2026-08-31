import type { DependencyType } from './cpm';

export type PlanningActivityStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export type PlanningActivity = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  plannedStartDate: string;
  plannedEndDate: string;
  durationDays: number;
  status: PlanningActivityStatus;
  position: number;
};

export type PlanningActivityBudgetLink = {
  id: string;
  activityId: string;
  budgetItemId: string;
  budgetItemDescription: string;
};

export type PlanningDependency = {
  id: string;
  predecessorId: string;
  successorId: string;
  dependencyType: DependencyType;
  lagDays: number;
};

export type CreatePlanningActivityInput = {
  projectId: string;
  parentId: string | null;
  name: string;
  plannedStartDate: string;
  plannedEndDate: string;
  durationDays: number;
  createdBy: string;
};

export type CreatePlanningDependencyInput = {
  predecessorId: string;
  successorId: string;
  dependencyType: DependencyType;
  lagDays: number;
  createdBy: string;
};

export type BudgetItemOption = {
  id: string;
  description: string;
};

export { type DependencyType };
