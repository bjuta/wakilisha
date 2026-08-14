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

describe("taxonomy term function body repair", () => {
  const migration = read(
    "docs/engineering/replay-baseline/legacy-migrations/20260802180500_taxonomy_term_function_body_repair.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-taxonomy-term-function-body-repair.sql",
  );

  it("qualifies the duplicate slug and taxonomy columns", () => {
    expect(migration).toContain(
      "existing_term.slug = p_slug",
    );
    expect(migration).toContain(
      "existing_term.taxonomy = p_taxonomy",
    );
    expect(migration).not.toContain(
      "WHERE slug = p_slug",
    );
  });

  it("qualifies the inserted registry id", () => {
    expect(migration).toContain(
      "returning inserted_term.id",
    );
    expect(migration).not.toContain(
      "RETURNING id INTO v_term_id",
    );
  });

  it("uses the capability that belongs to each taxonomy", () => {
    expect(migration).toContain(
      "when 'category' then 'manage_categories'",
    );
    expect(migration).toContain(
      "when 'post_tag' then 'manage_tags'",
    );
    expect(migration).toContain(
      "capability.capability_key =\n              v_required_capability",
    );
  });

  it("keeps the authority and security contract", () => {
    expect(migration).toContain(
      "security definer",
    );
    expect(migration).toContain(
      "set search_path = public, auth",
    );
    expect(migration).toContain(
      "to authenticated, service_role",
    );
    expect(migration).toContain(
      "from public, anon",
    );
    expect(migration).toContain(
      "notify pgrst, 'reload schema'",
    );
  });

  it("ships a rollback-safe authenticated runtime verifier", () => {
    expect(verifier).toContain(
      "WK_TAXONOMY_VERIFIER_ROLLBACK",
    );
    expect(verifier).toContain(
      "request.jwt.claim.sub",
    );
    expect(verifier).toContain(
      "Runtime verifier term escaped its rollback",
    );
    expect(verifier).toContain(
      "'post_tag'",
    );
  });
});
