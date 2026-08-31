import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G05 budget markups contract", () => {
  it("mantém budget_markups travado a Budget em DRAFT (mesma regra de budget_items)", () => {
    const sql = migration("20260831000200_g05_budget_markups.sql");

    expect(sql).toContain("create table public.budget_markups");
    expect(sql).toContain("private.is_budget_editor(budget_id) and private.is_budget_draft(budget_id)");
  });

  it("calcula markup percentual sobre o total direto e fixo como valor absoluto", () => {
    const sql = migration("20260831000200_g05_budget_markups.sql");

    expect(sql).toContain("when m.type = 'FIXED' then m.value");
    expect(sql).toContain("public.budget_total(p_budget_id) * (m.value / 100)");
  });

  it("budget_final_total soma total direto e markups", () => {
    const sql = migration("20260831000200_g05_budget_markups.sql");

    expect(sql).toContain("public.budget_total(p_budget_id) + public.budget_markup_amount(p_budget_id)");
  });
});

describe("G05 budget approval contract", () => {
  it("torna a FK auto-referenciada de budget_items diferível (necessário para duplicate_budget)", () => {
    const sql = migration("20260831000300_g05_budget_approval.sql");

    expect(sql).toContain("alter constraint budget_items_parent_id_fkey deferrable initially deferred");
  });

  it("approve_budget só aprova orçamento em DRAFT e roda como security invoker", () => {
    const sql = migration("20260831000300_g05_budget_approval.sql");

    expect(sql).toContain("create or replace function public.approve_budget(p_budget_id uuid)");
    expect(sql).toContain("where id = p_budget_id and status = 'DRAFT'");
    expect(sql).toContain("security invoker");
  });

  it("duplicate_budget só duplica orçamento aprovado, cria revisão DRAFT e copia itens e markups", () => {
    const sql = migration("20260831000300_g05_budget_approval.sql");

    expect(sql).toContain("create or replace function public.duplicate_budget(p_source_budget_id uuid, p_name text)");
    expect(sql).toContain("where id = p_source_budget_id and status = 'APPROVED'");
    expect(sql).toContain("parent_budget_id, created_by");
    expect(sql).toContain("insert into public.budget_items");
    expect(sql).toContain("insert into public.budget_markups");
  });
});
