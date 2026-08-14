import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("Article taxonomy term creation contract", () => {
  it("keeps one canonical SQL function signature", () => {
    const migration = read(
      "docs/engineering/replay-baseline/legacy-migrations/20260802171000_taxonomy_term_rpc_authority.sql",
    );

    expect(migration).toContain(
      "drop function if exists",
    );
    expect(migration).toContain(
      "public.create_taxonomy_term(",
    );
    expect(migration).toContain(
      "to authenticated, service_role",
    );
    expect(migration).toContain(
      "set search_path = public, auth",
    );
    expect(migration).toContain(
      "notify pgrst, 'reload schema'",
    );
  });

  it("verifies signature, grants, capability checks, and search path", () => {
    const verifier = read(
      "scripts/control-plane/verify-taxonomy-term-rpc-authority.sql",
    );

    expect(verifier).toContain(
      "Expected exactly one create_taxonomy_term function",
    );
    expect(verifier).toContain(
      "Legacy four-argument create_taxonomy_term overload remains",
    );
    expect(verifier).toContain(
      "Authenticated role cannot execute create_taxonomy_term",
    );
    expect(verifier).toContain(
      "Anonymous role can execute create_taxonomy_term",
    );
    expect(verifier).toContain(
      "manage_categories",
    );
  });

  it("calls the canonical seven-argument RPC explicitly", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx",
    );

    expect(panel).toContain(
      'supabase.rpc("create_taxonomy_term", {',
    );
    expect(panel).toContain(
      "p_seo_title: null",
    );
    expect(panel).toContain(
      "p_seo_description: null",
    );
    expect(panel).toContain(
      "p_seo_keywords: null",
    );
  });

  it("does not add local taxonomy strings after registry failure", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx",
    );

    expect(panel).not.toContain(
      "Fallback: add as plain string even if creation failed",
    );
    expect(panel).not.toContain(
      "onCategoriesChange([...categories, name]);",
    );
    expect(panel).not.toContain(
      "onTagsChange([...tags, name]);",
    );
    expect(panel).toContain(
      "if (!created) return;",
    );
    expect(panel).toContain(
      "was not added because registry creation failed.",
    );
  });

  it("shows creation failure beside the correct picker", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx",
    );

    expect(panel).toContain(
      'taxonomyCreationError?.taxonomy === "category"',
    );
    expect(panel).toContain(
      'taxonomyCreationError?.taxonomy === "post_tag"',
    );
    expect(panel).toContain(
      "taxonomyCreationError.message",
    );
  });
});
