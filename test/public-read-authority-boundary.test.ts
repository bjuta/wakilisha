import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260817174500_harden_public_read_authority_boundary.sql",
  ),
  "utf8",
);

describe("public read authority boundary", () => {
  it("keeps privileged helper policies away from anonymous traffic", () => {
    expect(migration).toContain("'public' = ANY (roles)");
    expect(migration).toContain("'anon' = ANY (roles)");
    expect(migration).toContain("current_user_(has_capability|is_administrator)");
    expect(migration).toContain("TO authenticated");
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.current_user_has_capability(text) FROM anon, PUBLIC",
    );
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.current_user_is_administrator() FROM anon, PUBLIC",
    );
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION public.current_user_has_capability");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION public.current_user_is_administrator");
  });

  it("uses the canonical published Guide state for anonymous reads", () => {
    expect(migration).toContain("ALTER POLICY guide_pages_public_read");
    expect(migration).toContain("TO anon, authenticated");
    expect(migration).toContain("USING (status = 'published')");
    expect(migration).not.toContain("USING (status = 'publish')");
  });

  it("keeps active release-track reads public without capability checks", () => {
    expect(migration).toContain('ALTER POLICY "Public users can read tracks for active releases"');
    expect(migration).toContain("r.status = 'active'");
  });

  it("installs a database-level regression guard for policy and privilege DDL", () => {
    expect(migration).toContain("private.assert_rls_privileged_policy_role_boundary");
    expect(migration).toContain("CREATE EVENT TRIGGER wakilisha_rls_privileged_policy_role_boundary");
    expect(migration).toContain(
      "WHEN TAG IN ('CREATE POLICY', 'ALTER POLICY', 'GRANT', 'REVOKE')",
    );
  });
});
