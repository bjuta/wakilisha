import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const service = fs.readFileSync(
  path.join(
    root,
    "src/services/articles/articleAdminService.ts",
  ),
  "utf8",
);

const workspace = fs.readFileSync(
  path.join(
    root,
    "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
  ),
  "utf8",
);

const listPage = fs.readFileSync(
  path.join(
    root,
    "src/pages/admin/content/articles/page.tsx",
  ),
  "utf8",
);

const migration = fs.readFileSync(
  path.join(
    root,
    "docs/engineering/replay-baseline/legacy-migrations/20260730152000_add_owner_to_resource_index.sql",
  ),
  "utf8",
);

const correctiveMigration = fs.readFileSync(
  path.join(
    root,
    "docs/engineering/replay-baseline/legacy-migrations/20260731100000_restore_resource_index_privacy.sql",
  ),
  "utf8",
);

describe("Article owner authority", () => {
  it("keeps ownership out of the anonymous resource index", () => {
    expect(migration).toContain(
      "resources.owner_id",
    );

    expect(correctiveMigration).toContain(
      "drop view public.wk_resource_index",
    );

    expect(correctiveMigration).toContain(
      "create view public.wk_resource_owner_index",
    );

    expect(correctiveMigration).toContain(
      "from public, anon, authenticated",
    );

    expect(correctiveMigration).toContain(
      "to authenticated, service_role",
    );
  });

  it("carries canonical resource ownership into Article reads", () => {
    expect(service).toContain(
      "ownerId: string | null;",
    );

    expect(service).toContain(
      '.select("resource_id, owner_id")',
    );

    expect(service).toContain(
      '.from("wk_resource_owner_index")',
    );

    expect(service).not.toContain(
      '.from("wk_resource_index")',
    );

    expect(service).toContain(
      '.select("canonical_record_id, resource_id, owner_id")',
    );

    expect(service).toContain(
      "ownerId: canonicalIdentity?.owner_id ?? null",
    );

    expect(service).toContain(
      "ownerId: identity?.ownerId ?? null",
    );
  });

  it("uses account ids instead of byline text for ownership", () => {
    expect(workspace).toContain(
      'userCanEditOwn = adminUser.can("edit_own_articles")',
    );

    expect(workspace).toContain(
      "article?.ownerId === adminUser.id",
    );

    expect(workspace).toContain(
      "(userCanEditOwn && isOwner)",
    );

    expect(workspace).not.toContain(
      "const articleAuthor",
    );

    expect(workspace).not.toContain(
      "const currentUserName",
    );

    expect(workspace).not.toContain(
      "currentUserName.includes(articleAuthor)",
    );
  });

  it("filters the Article list through canonical ownership", () => {
    expect(listPage).toContain(
      "article.ownerId === adminUser.id",
    );

    expect(listPage).not.toContain(
      "articleAuthor.includes(currentUserName)",
    );
  });
});
