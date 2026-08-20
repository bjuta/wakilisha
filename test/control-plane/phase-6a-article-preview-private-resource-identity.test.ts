import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260820224500_phase_6a_article_preview_private_resource_identity.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-article-preview-private-resource-identity.sql",
  "utf8",
);
const service = readFileSync(
  "src/services/articles/articleAdminService.ts",
  "utf8",
);
const workspace = readFileSync(
  "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
  "utf8",
);

function lower(value: string) {
  return value.toLowerCase();
}

describe("Phase 6A Article preview private Resource identity repair", () => {
  it("adds a narrow authenticated admin identity RPC without broadening Resource table RLS", () => {
    expect(migration).toContain(
      "public.get_admin_article_resource_identities",
    );
    expect(lower(migration)).toContain("security definer");
    expect(lower(migration)).toContain(
      "set search_path = pg_catalog, public, editorial",
    );
    expect(migration).toContain(
      "current_user_has_capability('view_dashboard')",
    );
    expect(migration).toContain(
      "current_user_is_administrator()",
    );
    expect(lower(migration)).toContain(
      "grant execute on function",
    );
    expect(lower(migration)).toContain(
      "to authenticated",
    );
    expect(lower(migration)).toContain(
      "from anon",
    );

    expect(lower(migration)).not.toMatch(
      /grant\s+select\s+on\s+(table\s+)?editorial\.(resources|article_resources)\s+to\s+authenticated/,
    );
    expect(lower(migration)).not.toMatch(
      /create\s+policy|alter\s+policy/,
    );
  });

  it("loads Article Resource identity through the governed RPC for detail and list reads", () => {
    const calls =
      service.match(
        /get_admin_article_resource_identities/g,
      ) ?? [];

    expect(calls).toHaveLength(2);
    expect(service).not.toContain(
      '.from("wk_resource_owner_index")',
    );
    expect(service).toContain(
      "p_article_ids: [row.id]",
    );
    expect(service).toContain(
      "p_article_ids: articleIds",
    );
  });

  it("keeps exact draft preview nonce generation behind canonical Resource identity", () => {
    expect(workspace).toMatch(
      /handleMagazinePreview\(\)[\s\S]*?if \(!article\.resourceId\)/,
    );
    expect(workspace).toMatch(
      /handleMagazinePreview\(\)[\s\S]*?generatePreviewNonce\(article\.id\)/,
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
  });
});
