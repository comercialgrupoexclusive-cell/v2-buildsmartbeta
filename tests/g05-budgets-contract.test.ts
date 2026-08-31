import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G05 budgets contract", () => {
  it("mantém budgets/budget_items com árvore livre (parent_id auto-referenciado), não etapas fixas", () => {
    const sql = migration("20260831000100_g05_budgets.sql");

    expect(sql).toContain("create table public.budgets");
    expect(sql).toContain("create table public.budget_items");
    expect(sql).toContain("parent_id uuid references public.budget_items(id)");
    expect(sql).not.toMatch(/etapa|sub_etapa|sub-etapa/i);
  });

  it("bloqueia escrita em budget_items quando o Budget não está em DRAFT", () => {
    const sql = migration("20260831000100_g05_budgets.sql");

    expect(sql).toContain("private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id)");
  });

  it("bloqueia reabrir ou renomear um Budget aprovado", () => {
    const sql = migration("20260831000100_g05_budgets.sql");

    expect(sql).toContain("approved budget cannot be reopened");
    expect(sql).toContain("approved budget is immutable");
  });

  it("valida que BudgetItem filho pertence ao mesmo Budget e CostItem à mesma Organization", () => {
    const sql = migration("20260831000100_g05_budgets.sql");

    expect(sql).toContain("parent item must belong to the same budget");
    expect(sql).toContain("cost item must belong to the budget organization");
  });

  it("expõe budget_item_total/budget_total como funções security invoker (respeitam RLS do chamador)", () => {
    const sql = migration("20260831000100_g05_budgets.sql");

    expect(sql).toContain("create or replace function public.budget_item_total(p_item_id uuid)");
    expect(sql).toContain("create or replace function public.budget_total(p_budget_id uuid)");
    expect(sql).toContain("security invoker");
  });

  it("audita mutações de budgets e budget_items", () => {
    const sql = migration("20260831000100_g05_budgets.sql");

    expect(sql).toContain("create or replace function private.audit_budget_change()");
    expect(sql).toContain("create trigger budgets_audit");
    expect(sql).toContain("create trigger budget_items_audit");
  });
});
