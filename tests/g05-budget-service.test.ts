import { describe, expect, it, vi } from "vitest";
import type { BudgetRepository } from "@/lib/budget/repository";
import { BudgetService } from "@/lib/budget/service";
import type { Budget, BudgetRevision } from "@/lib/budget/types";

const draft: Budget = { id: "draft-1", projectId: "project-1", name: "Orçamento", status: "DRAFT", parentBudgetId: null };
const approved: Budget = { id: "approved-1", projectId: "project-1", name: "Orçamento", status: "APPROVED", parentBudgetId: null };

function repository(overrides: Partial<BudgetRepository> = {}): BudgetRepository {
  return {
    getActiveBudget: vi.fn(async () => null),
    getBudget: vi.fn(async () => approved),
    createBudget: vi.fn(async (projectId, name) => ({ id: "new-1", projectId, name, status: "DRAFT", parentBudgetId: null })),
    listItems: vi.fn(async () => []),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    listMarkups: vi.fn(async () => []),
    addMarkup: vi.fn(),
    removeMarkup: vi.fn(),
    approve: vi.fn(),
    getFinalTotal: vi.fn(async () => ({ direct: 0, final: 0 })),
    getProjectOrganizationId: vi.fn(async () => "org-1"),
    listCostItems: vi.fn(async () => []),
    createCostItem: vi.fn(),
    listRevisions: vi.fn(async () => [] as BudgetRevision[]),
    duplicateBudget: vi.fn(),
    ...overrides,
  } as BudgetRepository;
}

describe("BudgetService.getOrCreateActiveBudget", () => {
  it("retorna o DRAFT existente sem criar nada", async () => {
    const repo = repository({ getActiveBudget: vi.fn(async () => draft) });
    const service = new BudgetService(repo);

    const result = await service.getOrCreateActiveBudget("project-1", "user-1", "Orçamento");

    expect(result).toBe(draft);
    expect(repo.createBudget).not.toHaveBeenCalled();
  });

  it("quando não há DRAFT mas já existe histórico (ex: único Budget está APPROVED), reaproveita o mais recente em vez de criar um novo silenciosamente", async () => {
    const repo = repository({
      getActiveBudget: vi.fn(async () => null),
      listRevisions: vi.fn(async (): Promise<BudgetRevision[]> => [
        { id: "approved-1", name: "Orçamento", status: "APPROVED", parentBudgetId: null, createdAt: "2026-08-31T00:00:00.000Z" },
      ]),
      getBudget: vi.fn(async () => approved),
    });
    const service = new BudgetService(repo);

    const result = await service.getOrCreateActiveBudget("project-1", "user-1", "Orçamento");

    expect(result).toBe(approved);
    expect(repo.createBudget).not.toHaveBeenCalled();
  });

  it("só cria um Budget novo quando o Project realmente não tem nenhum ainda", async () => {
    const repo = repository({ getActiveBudget: vi.fn(async () => null), listRevisions: vi.fn(async () => []) });
    const service = new BudgetService(repo);

    await service.getOrCreateActiveBudget("project-1", "user-1", "Orçamento");

    expect(repo.createBudget).toHaveBeenCalledWith("project-1", "Orçamento", "user-1");
  });
});
