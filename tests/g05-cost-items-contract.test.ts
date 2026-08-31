import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G05 cost items contract", () => {
  it("mantém cost_items pertencente à Organization com RLS", () => {
    const sql = migration("20260831000000_g05_cost_items.sql");

    expect(sql).toContain("create table public.cost_items");
    expect(sql).toContain("organization_id uuid not null references public.organizations(id)");
    expect(sql).toContain("type public.cost_item_type not null");
    expect(sql).toContain("alter table public.cost_items enable row level security");
  });

  it("restringe escrita a quem pode gerenciar a Organization (org_can_manage)", () => {
    const sql = migration("20260831000000_g05_cost_items.sql");

    expect(sql).toContain("using (private.org_can_manage(organization_id))");
    expect(sql).toContain("with check (created_by = (select auth.uid()) and private.org_can_manage(organization_id))");
  });

  it("bloqueia mudar organization_id/created_by depois de criado", () => {
    const sql = migration("20260831000000_g05_cost_items.sql");

    expect(sql).toContain("cost item organization cannot be changed");
    expect(sql).toContain("cost item creator cannot be changed");
  });

  it("audita mutações de cost_items", () => {
    const sql = migration("20260831000000_g05_cost_items.sql");

    expect(sql).toContain("create or replace function private.audit_cost_item_change()");
    expect(sql).toContain("create trigger cost_items_audit");
  });

  it("indexa a FK created_by para evitar alerta de performance", () => {
    const sql = migration("20260831000000_g05_cost_items.sql");

    expect(sql).toContain("create index cost_items_created_by_idx on public.cost_items(created_by)");
  });
});
