import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function migration(): string {
  const dir = path.join(root, "supabase/migrations");
  const file = fs
    .readdirSync(dir)
    .filter((name) =>
      name.endsWith(
        "_creator_claim_person_artist_composition_v1.sql",
      ),
    )
    .sort()
    .at(-1);

  if (!file) {
    throw new Error(
      "Missing creator claim Person-to-Artist composition migration.",
    );
  }

  return read(path.join("supabase/migrations", file));
}

describe("Creator claim Person↔Artist persona composition", () => {
  it("keeps ordinary claim review separate from stronger People identity authority", () => {
    const sql = migration();

    expect(sql).toContain(
      "compose_verified_artist_claim_persona_v1",
    );
    expect(sql).toContain(
      "admin_finalize_verified_artist_claim_persona_v1",
    );
    expect(sql).toContain(
      "artist_claim_verified_persona_composition_v1",
    );

    expect(sql).toContain(
      "current_user_has_capability('manage_registry')",
    );
    expect(sql).toContain(
      "current_user_has_capability('manage_people_identity')",
    );

    expect(sql).toContain(
      "new.claimant_role='artist'",
    );
    expect(sql).toContain(
      "editorial.person_identity_links",
    );
    expect(sql).toContain(
      "person.person_state='active'",
    );
    expect(sql).toContain(
      ")=1",
    );
    expect(sql).toContain(
      "v_claim.claimant_role<>'artist'",
    );
    expect(sql).toContain(
      "'claimant_role<>''artist''' in",
    );
    expect(sql).not.toContain(
      "'claimant_role<>''artist''',",
    );
  });

  it("derives persona authority from the reviewed claim rather than a name match", () => {
    const sql = migration();

    expect(sql).toContain(
      "'registry.person_artist.link'",
    );
    expect(sql).toContain(
      "'artist_claim_review'",
    );
    expect(sql).toContain(
      "'human_reviewed_artist_claim'",
    );
    expect(sql).toContain(
      "v_claim.claimant_user_id",
    );
    expect(sql).toContain(
      "editorial.person_identity_links",
    );
    expect(sql).toContain(
      "public.admin_link_person_registry_artist_v1",
    );

    expect(sql).not.toContain(
      "normalized_name=v_claim",
    );
    expect(sql).not.toContain(
      "display_name=v_claim",
    );
  });

  it("keeps behavioral acceptance rollback-only and transport-exact", () => {
    const behavior = read(
      "scripts/control-plane/verify-creator-claim-persona-composition-behavior.sql",
    );

    expect(behavior.trimStart()).toMatch(/^-- Permanent rollback-only/);
    expect(behavior).toContain("begin;");
    expect(behavior.trimEnd()).toMatch(/rollback;$/);

    expect(behavior).toContain(
      "'registry_artist_identity_review'",
    );
    expect(behavior).toContain(
      "session_user",
    );
    expect(behavior).toContain(
      "CREATOR_CLAIM_PERSONA_STRONG_AUTO_COMPOSITION=PASS",
    );
    expect(behavior).toContain(
      "CREATOR_CLAIM_PERSONA_WEAK_REVIEW_NO_ESCALATION=PASS",
    );
    expect(behavior).toContain(
      "CREATOR_CLAIM_PERSONA_STRONG_LATER_FINALIZATION=PASS",
    );
    expect(behavior).toContain(
      "admin_finalize_verified_artist_claim_persona_v1",
    );
  });

  it("does not leak direct persona mutation to browser or service roles", () => {
    const sql = migration();
    const verifier = read(
      "scripts/control-plane/verify-creator-claim-persona-composition-v1.sql",
    );

    expect(sql).toContain(
      "revoke all on function",
    );
    expect(sql).toContain(
      "from public,anon,authenticated,service_role",
    );
    expect(sql).toContain(
      "to authenticated",
    );

    expect(verifier).toContain(
      "CREATOR_CLAIM_PERSONA_COMPOSITION_V1_PASS",
    );
    expect(verifier).toContain(
      "person_registry_artist_links",
    );
    expect(verifier).toContain(
      "direct persona-link DML leaked",
    );
    expect(verifier).toContain(
      "'claimant_role=''artist''' in",
    );
    expect(verifier).not.toContain(
      "'claimant_role=''artist''',",
    );
  });
});
