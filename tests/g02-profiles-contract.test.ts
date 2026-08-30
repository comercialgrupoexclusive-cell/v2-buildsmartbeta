import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("G02 profiles contract", () => {
  it("mantém profiles com RLS restrita ao próprio usuário", () => {
    const sql = migration("20260830210000_g02_profiles.sql");

    expect(sql).toContain("create table public.profiles");
    expect(sql).toContain("full_name text not null check (length(trim(full_name)) > 0)");
    expect(sql).toContain("display_name text");
    expect(sql).toContain("alter table public.profiles enable row level security");
    expect(sql).toContain("using (id = (select auth.uid()))");
  });

  it("mantém upsert_own_profile sem privilégio elevado e exigindo full_name", () => {
    const sql = migration("20260830210000_g02_profiles.sql");

    expect(sql).toContain("create or replace function public.upsert_own_profile");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("full name is required");
    expect(sql).toContain("grant execute on function public.upsert_own_profile(text, text) to authenticated");
  });

  it("signup coleta nome completo obrigatório e apelido opcional", () => {
    const signup = readFileSync(join(process.cwd(), "app", "signup", "page.tsx"), "utf8");

    expect(signup).toContain("full_name: fullName.trim()");
    expect(signup).toContain("display_name: displayName.trim() || null");
    expect(signup).not.toContain('placeholder="Apelido"');
  });

  it("onboarding materializa o profile a partir do user_metadata do signup", () => {
    const onboarding = readFileSync(join(process.cwd(), "app", "onboarding", "page.tsx"), "utf8");

    expect(onboarding).toContain("upsert_own_profile");
    expect(onboarding).toContain("user_metadata?.full_name");
  });
});
