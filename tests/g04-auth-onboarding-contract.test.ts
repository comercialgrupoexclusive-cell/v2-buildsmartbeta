import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('G04 canonical auth and onboarding route', () => {
  it('keeps login focused only on authentication', () => {
    const login = source('app/login/page.tsx');

    expect(login).toContain('signInWithPassword');
    expect(login).not.toContain('signUp(');
    expect(login).toContain('href="/signup"');
    expect(login).toContain("router.replace((organizations ?? []).length === 0 ? '/onboarding' : '/projects')");
  });

  it('keeps account creation on a dedicated route with an explicit environment redirect', () => {
    const signup = source('app/signup/page.tsx');

    expect(signup).toContain('signUp(');
    expect(signup).toContain('window.location.origin');
    expect(signup).toContain('emailRedirectTo');
    expect(signup).toContain("/login?confirmed=1");
  });

  it('keeps first-use setup outside the operational Projects screen', () => {
    const onboarding = source('app/onboarding/page.tsx');
    const projects = source('app/projects/page.tsx');

    expect(onboarding).toContain("rpc('create_organization'");
    expect(onboarding).toContain("rpc('create_project'");
    expect(onboarding).toContain("router.replace('/projects')");

    expect(projects).not.toContain("rpc('create_organization'");
    expect(projects).not.toContain('Criar organização');
    expect(projects).not.toContain('Nome da organização');
    expect(projects).toContain('href="/projects/new"');
    expect(projects).toContain("router.replace('/onboarding')");
  });

  it('keeps later Project creation on its own authenticated route', () => {
    const createProject = source('app/projects/new/page.tsx');

    expect(createProject).toContain("rpc('create_project'");
    expect(createProject).not.toContain("rpc('create_organization'");
    expect(createProject).toContain("router.replace('/onboarding')");
    expect(createProject).toContain("router.replace('/projects')");
  });
});
