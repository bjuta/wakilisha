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

describe("published Article working-save isolation", () => {
  const migration = read(
    "supabase/migrations/20260802202500_preserve_published_article_on_working_save.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-published-article-working-save-isolation.sql",
  );
  const workspace = read(
    "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
  );

  it("preserves Article publication status", () => {
    expect(migration).toContain(
      "effective_wp_status := current_article.wp_status",
    );
    expect(migration).toContain(
      "wp_status = effective_wp_status",
    );
    expect(migration).not.toContain(
      "when p_payload ? 'wp_status'",
    );
  });

  it("leaves resource lifecycle to dedicated commands", () => {
    const start = migration.indexOf(
      "update editorial.resources",
    );
    const end = migration.indexOf(
      "where id = current_resource.id;",
      start,
    );
    const block = migration.slice(start, end);

    expect(block).not.toContain("lifecycle_state =");
    expect(block).not.toContain("visibility =");
    expect(block).toContain(
      "current_working_version_id = new_version_id",
    );
  });

  it("does not force Draft from the normal Save button", () => {
    expect(workspace).toContain(
      "const ok = await saveToSupabase({});",
    );
    expect(workspace).not.toContain(
      'const ok = await saveToSupabase({ wp_status: "draft" });',
    );
    expect(workspace).toContain(
      "Working draft saved. Published version remains live.",
    );
  });

  it("routes an explicit Draft transition through unpublish", () => {
    expect(workspace).toContain(
      "if (isLiveOrScheduled) {",
    );
    expect(workspace).toContain(
      "await handleUnpublish();",
    );
  });

  it("ships a rollback-safe runtime verifier", () => {
    expect(verifier).toContain(
      "WK_PUBLISHED_WORKING_SAVE_ROLLBACK",
    );
    expect(verifier).toContain(
      "Manual save demoted the Article status",
    );
    expect(verifier).toContain(
      "Manual save demoted the resource publication gate",
    );
    expect(verifier).toContain(
      "Runtime verifier persisted an Article version",
    );
  });
});
