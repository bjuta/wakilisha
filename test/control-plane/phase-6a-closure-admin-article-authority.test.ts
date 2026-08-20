import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260820213500_phase_6a_closure_admin_article_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-closure-admin-article-authority.sql",
  "utf8",
);
const workspace = readFileSync(
  "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
  "utf8",
);
const shell = readFileSync(
  "src/pages/admin/AdminShell.tsx",
  "utf8",
);
const roles = readFileSync(
  "src/services/userRoles.ts",
  "utf8",
);
const indexHtml = readFileSync(
  "index.html",
  "utf8",
);

function lower(value: string) {
  return value.toLowerCase();
}

describe("Phase 6A closure admin and Article authority", () => {
  it("keeps Audio as the existing capability-gated Admin Content destination", () => {
    expect(shell).toContain("/admin/content/audio");
    expect(shell).toContain('can("view_audio")');
    expect(roles).toContain('"view_audio"');
    expect(roles).toMatch(
      /administrator:[\s\S]*?"view_audio"/,
    );
  });

  it("restores the three authenticated administrator reads without opening anon", () => {
    for (const table of [
      "admin_user_invites",
      "admin_audit_events",
      "admin_account_recovery_events",
    ]) {
      expect(lower(migration)).toContain(
        `grant select on table public.${table} to authenticated`,
      );
      expect(lower(migration)).toContain(
        `revoke select on table public.${table} from anon`,
      );
    }

    expect(lower(migration)).not.toContain(
      "create policy",
    );
  });

  it("makes canonical Article Resource and baseline-version provisioning invariant", () => {
    expect(migration).toContain(
      "editorial.ensure_article_resource_identity",
    );
    expect(migration).toContain(
      "wk_articles_provision_resource_identity",
    );
    expect(migration).toContain(
      "editorial.article_resources",
    );
    expect(migration).toContain(
      "editorial.article_versions",
    );
    expect(migration).toContain(
      "'baseline'",
    );
    expect(migration).toContain(
      "current_working_version_id",
    );
  });

  it("repairs existing orphan Articles instead of special-casing one slug", () => {
    expect(migration).toContain(
      "where not exists",
    );
    expect(migration).not.toContain(
      "not-understanding-sheng-is-part-of-the-point",
    );
  });

  it("does not call version-bound preview or recovery automatically without Resource identity", () => {
    expect(workspace).toContain(
      "data.resourceId &&",
    );
    expect(workspace).toContain(
      "if (data.resourceId) {",
    );
    expect(workspace).toMatch(
      /handleGeneratePreviewLink\(\)[\s\S]*?if \(!article\.resourceId\)/,
    );
    expect(workspace).toMatch(
      /handleMagazinePreview\(\)[\s\S]*?if \(!article\.resourceId\)/,
    );
  });

  it("does not add a source-level Cloudflare Insights beacon", () => {
    expect(lower(indexHtml)).not.toMatch(
      /<script[^>]+(?:static\.cloudflareinsights\.com|beacon\.min\.js)/,
    );
  });

  it("keeps the permanent verifier read-only", () => {
    const body = lower(verifier)
      .replace(/raise exception/g, "")
      .replace(/raise notice/g, "");

    expect(body).not.toMatch(/\binsert\s+into\b/);
    expect(body).not.toMatch(/\bupdate\s+[a-z_]/);
    expect(body).not.toMatch(/\bdelete\s+from\b/);
    expect(body).not.toMatch(
      /\bcreate\s+(table|function|trigger|index|policy)\b/,
    );
    expect(verifier).toContain(
      "PASS: Phase 6A closure admin reads and Article identity authority are intact.",
    );
  });
});
