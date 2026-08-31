export type BudgetStatus = 'DRAFT' | 'APPROVED';
export type MarkupType = 'PERCENTAGE' | 'FIXED';

export type Budget = {
  id: string;
  projectId: string;
  name: string;
  status: BudgetStatus;
  parentBudgetId: string | null;
};

export type BudgetItem = {
  id: string;
  budgetId: string;
  parentId: string | null;
  costItemId: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  position: number;
};

export type BudgetMarkup = {
  id: string;
  budgetId: string;
  name: string;
  type: MarkupType;
  category: string | null;
  value: number;
};

export type CreateBudgetItemInput = {
  budgetId: string;
  parentId: string | null;
  costItemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CreateBudgetMarkupInput = {
  budgetId: string;
  name: string;
  type: MarkupType;
  value: number;
};

export type CostItemType = 'MATERIAL' | 'LABOR' | 'SERVICE';

export type CostItem = {
  id: string;
  organizationId: string;
  description: string;
  unit: string;
  type: CostItemType;
  unitPrice: number;
};

export type CreateCostItemInput = {
  organizationId: string;
  description: string;
  unit: string;
  type: CostItemType;
  unitPrice: number;
  createdBy: string;
};

export type BudgetRevision = {
  id: string;
  name: string;
  status: BudgetStatus;
  parentBudgetId: string | null;
  createdAt: string;
};
