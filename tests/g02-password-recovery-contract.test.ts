import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function page(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("G02 password recovery contract", () => {
  it("login expõe rota para recuperação de senha", () => {
    const login = page("app/login/page.tsx");
    expect(login).toContain("/forgot-password");
  });

  it("forgot-password dispara resetPasswordForEmail com redirect para reset-password", () => {
    const forgotPassword = page("app/forgot-password/page.tsx");
    expect(forgotPassword).toContain("resetPasswordForEmail");
    expect(forgotPassword).toContain("/reset-password");
  });

  it("reset-password exige sessão de recuperação antes de trocar a senha", () => {
    const resetPassword = page("app/reset-password/page.tsx");
    expect(resetPassword).toContain("getSession");
    expect(resetPassword).toContain("auth.updateUser({ password })");
  });
});
