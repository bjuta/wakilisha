import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCandidate(): string {
  const migrationDir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k4c_p2_playlist_pointer_writer_convergence.sql",
      ),
    );

  if (matches.length === 1) {
    return fs.readFileSync(
      path.join(migrationDir, matches[0]),
      "utf8",
    );
  }

  expect(matches).toHaveLength(0);
  return fs.readFileSync(
    path.resolve(
      "docs/engineering/work-in-progress/phase-7a-k4c-p2-playlist-pointer-writer-convergence.sql",
    ),
    "utf8",
  );
}

const migration = readCandidate();
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4c-p2-playlist-pointer-writer-convergence.sql",
  ),
  "utf8",
);

describe("Phase 7A K4C-P2 Playlist pointer-writer convergence", () => {
  it("requires production-sealed K1 and K4C-P1 authority", () => {
    expect(migration).toContain(
      "editorial.append_resource_lifecycle_event",
    );
    expect(migration).toContain(
      "editorial.append_resource_review_event",
    );
    expect(migration).toContain(
      "playlist_resources_sync_shared_lifecycle",
    );
    expect(migration).toContain(
      "resources_sync_typed_lifecycle_compatibility",
    );
  });

  it("rewrites exactly the seven remaining governed Playlist pointer writers", () => {
    for (const signature of [
      "public.snapshot_playlist_working_version(uuid,bigint,text,uuid)",
      "public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)",
      "public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)",
      "public.publish_due_playlist_publications(integer)",
      "public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)",
      "public.unpublish_playlist(uuid,bigint,text,text,uuid)",
      "public.archive_playlist(uuid,bigint,text,text,uuid)",
    ]) {
      expect(migration).toContain(signature);
    }

    expect(migration).toContain(
      "Expected exactly 7 governed Playlist typed-pointer writers before K4C-P2",
    );
  });

  it("moves working pointer writes onto canonical Resource authority", () => {
    expect(migration).toContain(
      "update editorial.resources resource_update",
    );
    expect(migration).toContain(
      "set current_working_version_id =",
    );
    expect(migration).toContain(
      "where resource_update.id = v_binding.resource_id;",
    );
    expect(migration).toContain(
      "where resource_update.id = v_identity.resource_id;",
    );
  });

  it("moves published and approved pointer writes onto canonical Resource authority", () => {
    expect(migration).toContain(
      "update editorial.resources resource_pointer",
    );
    expect(migration).toContain(
      "set current_published_version_id =",
    );
    expect(migration).toContain(
      "set current_published_version_id = null",
    );
    expect(migration).toContain(
      "set current_approved_version_id = null",
    );
  });

  it("uses fail-closed pg_get_functiondef substitutions instead of full function rewrites", () => {
    expect(migration).toContain(
      "pg_get_functiondef(v_regprocedure)",
    );
    expect(migration).toContain(
      "expected exactly one old pointer-writer fragment",
    );
    expect(migration).toContain(
      "execute v_definition;",
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+public\.(snapshot_playlist_working_version|publish_playlist_version|publish_due_playlist_publications|unschedule_playlist_publication|unpublish_playlist|archive_playlist|save_resource_version_editorial_metadata)/i,
    );
  });

  it("does not touch Audio pointer compatibility in the shared metadata command", () => {
    expect(migration).not.toContain(
      "update editorial.audio_publication_resources",
    );
    expect(verifier).toContain(
      "update editorial.audio_publication_resources binding",
    );
  });

  it("normalizes replaced public RPCs to the accepted production execution perimeter", () => {
    expect(migration).toContain(
      "Replay baselines can inherit historical default EXECUTE grants",
    );
    expect(migration).toContain(
      "from public, anon;",
    );
    expect(migration).toContain(
      "to authenticated, service_role;",
    );
    expect(migration).toContain(
      "did not preserve the accepted Playlist RPC execution perimeter",
    );
    expect(verifier).toContain(
      "governed Playlist writer execution perimeter changed",
    );
  });

  it("leaves K1 pointer compatibility infrastructure for P3", () => {
    expect(migration).not.toMatch(
      /drop\s+trigger\s+playlist_resources_sync_shared_lifecycle/i,
    );
    expect(migration).not.toMatch(
      /drop\s+trigger\s+resources_sync_typed_lifecycle_compatibility/i,
    );
    expect(migration).not.toMatch(
      /drop\s+column\s+current_(working|submitted|approved|published)_version_id/i,
    );
    expect(migration).toContain(
      "accidentally removed the K1 Resource-to-typed compatibility writer",
    );
  });

  it("proves function-only convergence does not mutate Playlist lifecycle data", () => {
    expect(migration).toContain(
      "phase_7a_k4c_p2_data_baseline",
    );
    expect(migration).toContain(
      "function convergence mutated Playlist lifecycle data",
    );
    expect(migration).toContain(
      "phase_7a_k4c_p2_acl_baseline",
    );
    expect(migration).toContain(
      "changed target function owner, SECURITY DEFINER, or search_path",
    );
  });

  it("preserves P1 event authority and K4B no-typed-Video ratchets", () => {
    expect(migration).toContain(
      "K4C-P1 typed Playlist event-writer retirement has regressed",
    );
    expect(migration).toContain(
      "K4C-P2 renewed Playlist typed event authority",
    );
    expect(migration).toContain(
      "K4C-P2 renewed typed Video event authority",
    );
  });

  it("permanent verifier requires zero governed direct typed-pointer writers", () => {
    expect(verifier).toContain(
      "direct Playlist typed-pointer writer(s) remain",
    );
    expect(verifier).toContain(
      "editorial.sync_typed_lifecycle_from_resource()",
    );
    expect(verifier).toContain(
      "governed_typed_pointer_writer_count",
    );
  });

  it("permanent verifier keeps pointer parity and browser execution perimeter", () => {
    expect(verifier).toContain(
      "Playlist pointer mirror divergence(s) exist",
    );
    expect(verifier).toContain(
      "governed Playlist writer execution perimeter changed",
    );
    expect(verifier).toContain(
      "typed Video event authority reappeared",
    );
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain(
      "set local transaction read only;",
    );
    expect(verifier).toContain(
      "PHASE_7A_K4C_P2_PLAYLIST_POINTER_WRITER_CONVERGENCE_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
