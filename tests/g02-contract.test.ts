import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G02 identity contract", () => {
  it("mantém Organization, Project, Memberships e Audit com RLS", () => {
    const sql = migration("20260830022545_g02_identity_core.sql");

    expect(sql).toContain("create table public.organizations");
    expect(sql).toContain("create table public.organization_memberships");
    expect(sql).toContain("create table public.projects");
    expect(sql).toContain("create table public.project_memberships");
    expect(sql).toContain("create table public.audit_logs");
    expect(sql).toContain("alter table public.organizations enable row level security");
    expect(sql).toContain("alter table public.projects enable row level security");
    expect(sql).toContain("status public.project_status not null default 'ACTIVE'");
  });

  it("mantém bootstrap atômico sem privilégio elevado", () => {
    const sql = migration("20260830023341_g02_fix_invoker_bootstrap_returning.sql");

    expect(sql).toContain("create or replace function public.create_organization");
    expect(sql).toContain("create or replace function public.create_project");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("v_organization_id uuid := gen_random_uuid()");
    expect(sql).toContain("v_project_id uuid := gen_random_uuid()");
    expect(sql).toContain("grant execute on function public.create_organization(text) to authenticated");
    expect(sql).toContain("grant execute on function public.create_project(uuid, text, text) to authenticated");
  });

  it("mantém bootstrap de Membership sem recursão de RLS", () => {
    const sql = migration("20260830022900_g02_fix_membership_creator_bootstrap.sql");

    expect(sql).toContain("private.is_org_creator(organization_id)");
    expect(sql).toContain("private.is_project_creator(project_id)");
    expect(sql).not.toContain("select 1 from public.organization_memberships existing");
    expect(sql).not.toContain("select 1 from public.project_memberships existing");
  });

  it("mantém Audit automático das entidades centrais", () => {
    const sql = migration("20260830022809_g02_identity_audit_triggers.sql");
    const fix = migration("20260830022815_g02_fix_organization_audit_trigger.sql");

    expect(sql).toContain("create or replace function private.audit_identity_change()");
    expect(sql).toContain("create trigger projects_audit");
    expect(sql).toContain("create trigger project_memberships_audit");
    expect(fix).toContain("after insert or update on public.organizations");
  });
});
