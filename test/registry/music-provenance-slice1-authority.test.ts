import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const identityMigration = read(
  "supabase/migrations/20260929160420_music_provenance_slice1_attestation_identity_authority_v1.sql",
);
const admissionMigration = read(
  "supabase/migrations/20260929160423_music_provenance_slice1_work_contribution_admission_v1.sql",
);
const verifier = read(
  "scripts/control-plane/verify-music-provenance-slice1-authority.sql",
);
const slice2Verifier = read(
  "scripts/control-plane/verify-music-identity-rights-slice2-authority.sql",
);

function between(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

const executor = between(
  admissionMigration,
  "create function platform_private.execute_registry_provenance_admin_v1(",
  "end\n$$;",
);

const groupMembershipRpc = between(
  identityMigration,
  "create function public.admin_admit_registry_artist_person_membership_v1(",
  "end\n$$;",
);

describe("Music provenance Slice 1 authority", () => {
  it("preserves typed attestation semantics instead of overloading Artist claim evidence", () => {
    expect(identityMigration).toContain(
      "platform_private.registry_contribution_attestations",
    );
    expect(identityMigration).toContain(
      "platform_private.registry_contribution_attestation_state_events",
    );
    expect(identityMigration).toContain(
      "platform_private.registry_contribution_attestation_permission_versions",
    );

    for (const mode of [
      "open_response",
      "self_claim",
      "suggested_confirmation",
      "counterparty_confirmation",
      "imported_source",
    ]) {
      expect(identityMigration).toContain(mode);
    }

    for (const state of [
      "asserted",
      "corroborated",
      "confirmed",
      "disputed",
      "withdrawn",
      "superseded",
    ]) {
      expect(identityMigration).toContain(state);
    }

    expect(identityMigration).toContain("candidate_shown");
    expect(identityMigration).toContain("prompt_version");
    expect(identityMigration).toContain("parent_attestation_id");
    expect(identityMigration).toContain("source_use_basis");
    expect(identityMigration).toContain("independence_group_hint");
  });

  it("keeps attestation and sharing history append-only and creator-scoped", () => {
    expect(identityMigration).toContain(
      "reject_registry_provenance_history_mutation_v1",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestations_append_only",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestation_state_events_append_only",
    );
    expect(identityMigration).toContain(
      "registry_contribution_attestation_permissions_append_only",
    );
    expect(identityMigration).toContain("public_display");
    expect(identityMigration).toContain("cmo_rights_contexts");
    expect(identityMigration).toContain("approved_partner_keys");
    expect(identityMigration).toContain(
      "third_party_commercial_reuse",
    );
    expect(identityMigration).toContain("change_kind in ('grant','replace','withdraw')");
  });

  it("extends accepted Person identity links for Registry Artist without creating a parallel bridge", () => {
    expect(identityMigration).toContain(
      "alter table editorial.person_identity_links",
    );
    expect(identityMigration).toContain("registry_artist_id");
    expect(identityMigration).toContain(
      "person_identity_links_active_registry_artist_unique",
    );
    expect(identityMigration).toContain(
      "admin_link_person_registry_artist_v1",
    );
    expect(identityMigration).not.toContain(
      "create table editorial.person_registry_artist_links",
    );
    expect(identityMigration).toContain(
      "Registry Artist identity was incorrectly turned into automatic Person presentation authority.",
    );
  });

  it("keeps Group membership typed and separate from Recording participation", () => {
    expect(identityMigration).toContain(
      "public.registry_artist_person_memberships",
    );
    expect(identityMigration).toContain(
      "Typed Group Artist to Person membership authority",
    );
    expect(groupMembershipRpc).toContain(
      "artist_type not in ('band','group','collective','duo')",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_track_contributions",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_work_contributions",
    );
  });

  it("enables exactly the four already-declared v1 Work/Contribution operation families", () => {
    for (const operation of [
      "registry.work.create",
      "registry.track_work_link.admit",
      "registry.track_contribution.admit",
      "registry.work_contribution.admit",
    ]) {
      expect(admissionMigration).toContain(operation);
    }

    expect(admissionMigration).toContain("operation_version',1");
    expect(admissionMigration).toContain("max_rows_ceiling=1");
    expect(admissionMigration).toContain("max_grant_ttl_seconds=300");
    expect(admissionMigration).toContain("requires_human_approval");
    expect(admissionMigration).toContain("requires_verifier");
    expect(admissionMigration).not.toContain(
      "registry.track_contribution.admit.v2",
    );
    expect(admissionMigration).not.toContain(
      "registry.work_contribution.admit.v2",
    );

    expect(slice2Verifier).toContain(
      "registry.track_contribution.admit",
    );
    expect(slice2Verifier).toContain(
      "registry.work_contribution.admit",
    );
  });

  it("keeps canonical writes behind human exact grants with zero standing authority", () => {
    expect(admissionMigration).toContain(
      "authority_mode','human_exact_grant'",
    );
    expect(admissionMigration).toContain(
      "required_user_capability_key",
    );
    expect(admissionMigration).toContain("'manage_registry'");
    expect(admissionMigration).toContain(
      "system_actor_capability_grant_id",
    );
    expect(admissionMigration).toContain(
      "registry_execution_target_set_fingerprint",
    );
    expect(admissionMigration).toContain(
      "begin_registry_mutation_operation",
    );
    expect(admissionMigration).toContain(
      "registry_operation_write_events",
    );
    expect(admissionMigration).toContain(
      "public.registry_canonical_write_events",
    );
    expect(admissionMigration).toContain(
      "Registry provenance admin gained standing autonomous authority.",
    );
  });

  it("allows unresolved credited_as without manufacturing a Person", () => {
    expect(identityMigration).toContain(
      "registry_contribution_attestations_contributor_presence_check",
    );
    expect(identityMigration).toContain("credited_as is not null");
    expect(admissionMigration).toContain(
      "v_attestation.credited_as",
    );
    expect(executor).not.toContain("insert into editorial.people");
    expect(executor).not.toContain("create_person_for_identity");
  });

  it("does not infer rights or Recording participation from contribution or membership", () => {
    expect(executor).not.toContain(
      "insert into public.registry_rights_claims",
    );
    expect(executor).not.toContain(
      "update public.registry_rights_claims",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_track_contributions",
    );
    expect(groupMembershipRpc).not.toContain(
      "registry_work_contributions",
    );
  });

  it("does not silently promote a self-claim", () => {
    expect(admissionMigration).toContain(
      "WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED",
    );
    expect(admissionMigration).toContain(
      "v_attestation.elicitation_method='self_claim'",
    );
    expect(admissionMigration).toContain(
      "v_state<>'confirmed'",
    );
  });

  it("retains RLS/ACL fail-closed and independent verification", () => {
    expect(identityMigration).toContain(
      "alter table public.registry_artist_person_memberships\n  enable row level security",
    );
    expect(identityMigration).toContain(
      "from public,anon,authenticated,service_role",
    );
    expect(admissionMigration).toContain(
      "verify_registry_provenance_admin_v1",
    );
    expect(admissionMigration).toContain(
      "from public,anon,authenticated,service_role",
    );
    expect(admissionMigration).toContain(
      "Provenance canonical tables leaked direct insert authority.",
    );
    expect(verifier).toContain(
      "MUSIC_PROVENANCE_SLICE1_AUTHORITY_V1_PASS",
    );
  });
});
