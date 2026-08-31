import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G06 planning dependencies contract", () => {
  it("suporta os quatro tipos de dependência PDM (FS/SS/FF/SF) com lag", () => {
    const sql = migration("20260831130000_g06_planning_dependencies.sql");

    expect(sql).toContain("create type public.planning_dependency_type as enum ('FS', 'SS', 'FF', 'SF')");
    expect(sql).toContain("lag_days integer not null default 0");
  });

  it("bloqueia dependência que criaria um ciclo antes de persistir", () => {
    const sql = migration("20260831130000_g06_planning_dependencies.sql");

    expect(sql).toContain("dependency would create a cycle");
    expect(sql).toContain("with recursive reachable");
  });

  it("bloqueia dependência que ligaria atividades de projetos diferentes", () => {
    const sql = migration("20260831130000_g06_planning_dependencies.sql");

    expect(sql).toContain("predecessor and successor must belong to the same project");
  });

  it("impede predecessor/successor de serem trocados depois de criados", () => {
    const sql = migration("20260831130000_g06_planning_dependencies.sql");

    expect(sql).toContain("dependency predecessor cannot be changed");
    expect(sql).toContain("dependency successor cannot be changed");
  });

  it("rejeita auto-dependência via constraint de banco", () => {
    const sql = migration("20260831130000_g06_planning_dependencies.sql");

    expect(sql).toContain("check (predecessor_id <> successor_id)");
  });

  it("audita mutações de planning_dependencies", () => {
    const sql = migration("20260831130000_g06_planning_dependencies.sql");

    expect(sql).toContain("create trigger planning_dependencies_audit");
  });
});
