import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G06 planning activities contract", () => {
  it("mantém planning_activities em árvore livre (parent_id auto-referenciado), não etapas fixas", () => {
    const sql = migration("20260831120000_g06_planning_activities.sql");

    expect(sql).toContain("create table public.planning_activities");
    expect(sql).toContain("parent_id uuid references public.planning_activities(id)");
    expect(sql).not.toMatch(/etapa|sub_etapa|sub-etapa/i);
  });

  it("vincula atividade a budget_item por FK, rastreável (critério de Gate do G00)", () => {
    const sql = migration("20260831120000_g06_planning_activities.sql");

    expect(sql).toContain("create table public.planning_activity_budget_items");
    expect(sql).toContain("budget_item_id uuid not null references public.budget_items(id)");
    expect(sql).toContain("unique (activity_id, budget_item_id)");
  });

  it("valida que o budget_item vinculado pertence ao mesmo projeto da atividade", () => {
    const sql = migration("20260831120000_g06_planning_activities.sql");

    expect(sql).toContain("budget item must belong to the same project as the activity");
  });

  it("bloqueia escrita fora do Project autorizado via is_planning_editor", () => {
    const sql = migration("20260831120000_g06_planning_activities.sql");

    expect(sql).toContain("private.is_planning_editor(project_id)");
  });

  it("impede projeto/criador de planning_activities serem trocados depois de criados", () => {
    const sql = migration("20260831120000_g06_planning_activities.sql");

    expect(sql).toContain("planning activity project cannot be changed");
    expect(sql).toContain("planning activity creator cannot be changed");
  });

  it("audita mutações de planning_activities e planning_activity_budget_items", () => {
    const sql = migration("20260831120000_g06_planning_activities.sql");

    expect(sql).toContain("create or replace function private.audit_planning_activity_change()");
    expect(sql).toContain("create trigger planning_activities_audit");
    expect(sql).toContain("create trigger planning_activity_budget_items_audit");
  });
});
