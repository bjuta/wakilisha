import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const releaseLabelMigration = read(
  "supabase/migrations/20260923130246_music_identity_rights_slice3_release_label_admission_v1.sql",
);
const releaseLabelVerifier = read(
  "scripts/control-plane/verify-music-metadata-release-label-admission-v1.sql",
);
const mediaMigration = read("supabase/migrations/20260923152227_music_identity_rights_slice3_media_asset_binding_admission_v1.sql");
const mediaVerifier = read(
  "scripts/control-plane/verify-music-metadata-media-asset-binding-admission-v1.sql",
);

function between(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Missing start marker: ${startMarker}`);
  }

  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`Missing end marker: ${endMarker}`);
  }

  return source.slice(start, end + endMarker.length);
}

const mediaCandidateFunction = between(
  mediaMigration,
  "create function\nplatform_private.registry_media_asset_binding_candidate_state_v1(",
  "$candidate$;",
);

const mediaExecutorFunction = between(
  mediaMigration,
  "create function\nplatform_private.execute_registry_media_asset_binding_admin_v1(",
  "$execute$;",
);

describe("Music metadata Slice 3 governed promotion admission", () => {
  describe("Release Label admission retained contract", () => {
    it("creates a narrow typed Release-to-Label operation", () => {
      expect(releaseLabelMigration).toContain(
        "admit_registry_release_label_link",
      );
      expect(releaseLabelMigration).toContain(
        "registry.release.label_link.admit",
      );
      expect(releaseLabelMigration).toContain(
        "array['release']::text[]",
      );
      expect(releaseLabelMigration).toContain(
        "requires_existing_target",
      );
      expect(releaseLabelMigration).toContain("max_rows_ceiling");
      expect(releaseLabelMigration).toContain(
        "manage_registry is required.",
      );
    });

    it("keeps Release Label matching exact and non-fuzzy", () => {
      expect(releaseLabelMigration).toContain(
        "metadata->>'record_label'",
      );
      expect(releaseLabelMigration).toContain("[[:space:]]+");
      expect(releaseLabelMigration).toContain(
        "exact_label_match_count",
      );
      expect(releaseLabelMigration).toContain(
        "exact_organization_match_count",
      );
      expect(releaseLabelMigration).toContain(
        "exact_label_candidate",
      );

      expect(releaseLabelMigration).not.toContain("[^[:alnum:]]+");
      expect(releaseLabelMigration).not.toMatch(/similarity\s*\(/i);
      expect(releaseLabelMigration).not.toMatch(/levenshtein/i);
      expect(releaseLabelMigration).not.toMatch(/trigram/i);
    });

    it("retains Release Label governance and permanent verification", () => {
      expect(releaseLabelMigration).toContain(
        "public.admin_admit_registry_release_label_candidate_v1",
      );
      expect(releaseLabelMigration).toContain(
        "verify_registry_release_label_admin_v1",
      );
      expect(releaseLabelMigration).toContain(
        "Release Label admin gained standing autonomous authority",
      );
      expect(releaseLabelVerifier).toContain(
        "MUSIC_METADATA_SLICE3_RELEASE_LABEL_ADMISSION_V1_PASS",
      );
      expect(releaseLabelVerifier).toContain(
        "event.field_name<>'label_id'",
      );
    });
  });

  describe("Track and Artist exact Media asset binding", () => {
    it("creates only the two earned typed operation families", () => {
      expect(mediaMigration).toContain(
        "admit_registry_track_media_asset_binding",
      );
      expect(mediaMigration).toContain(
        "admit_registry_artist_media_asset_binding",
      );
      expect(mediaMigration).toContain(
        "registry.track.media_asset_binding.admit",
      );
      expect(mediaMigration).toContain(
        "registry.artist.media_asset_binding.admit",
      );
      expect(mediaMigration).toContain("array['track']::text[]");
      expect(mediaMigration).toContain("array['artist']::text[]");
      expect(mediaMigration).not.toContain(
        "registry.release.media_asset_binding.admit",
      );
    });

    it("requires one exact active URL match without fuzzy normalization", () => {
      expect(mediaMigration).toContain("asset.url=v_source_url");
      expect(mediaMigration).toContain(
        "exact_active_asset_match_count",
      );
      expect(mediaMigration).toContain(
        "exact_url_reuse_candidate",
      );
      expect(mediaMigration).toContain("track.artwork_url");
      expect(mediaMigration).toContain("artist.public_image_url");

      expect(mediaCandidateFunction).not.toMatch(/similarity\s*\(/i);
      expect(mediaCandidateFunction).not.toMatch(/levenshtein/i);
      expect(mediaCandidateFunction).not.toMatch(/trigram/i);
      expect(mediaCandidateFunction).not.toContain("regexp_replace(");
    });

    it("freezes both subject state and target Media asset state", () => {
      expect(mediaMigration).toContain(
        "registry_subject_state_fingerprint",
      );
      expect(mediaMigration).toContain(
        "registry_media_asset_state_fingerprint_v1",
      );
      expect(mediaMigration).toContain(
        "target_asset_state_fingerprint",
      );
      expect(mediaMigration).toContain(
        "WK_STALE_MEDIA_BINDING_TARGET",
      );
      expect(mediaMigration).toContain(
        "WK_STALE_MEDIA_ASSET_TARGET",
      );
      expect(mediaMigration).toContain(
        "WK_STALE_MEDIA_BINDING_CANDIDATE",
      );
    });

    it("mutates only the typed Media FK and updated_at", () => {
      expect(mediaMigration).toContain(
        "artwork_image_id=v_asset_id",
      );
      expect(mediaMigration).toContain("public_image_id=v_asset_id");
      expect(mediaMigration).toContain(
        "array['artwork_image_id','updated_at']::text[]",
      );
      expect(mediaMigration).toContain(
        "array['public_image_id','updated_at']::text[]",
      );

      expect(mediaMigration).not.toMatch(
        /update\s+public\.registry_tracks[\s\S]*?artwork_url\s*=/i,
      );
      expect(mediaMigration).not.toMatch(
        /update\s+public\.registry_artists[\s\S]*?public_image_url\s*=/i,
      );
      expect(mediaMigration).not.toMatch(
        /insert\s+into\s+public\.registry_media_assets/i,
      );
      expect(mediaMigration).not.toMatch(
        /update\s+public\.registry_media_assets/i,
      );
    });

    it("is specific hard-coded Media binding code, not a generic backfill engine", () => {
      expect(mediaExecutorFunction).not.toContain("p_table");
      expect(mediaExecutorFunction).not.toContain("p_column");
      expect(mediaExecutorFunction).not.toContain("json_patch");
      expect(mediaExecutorFunction).not.toContain("format(");
      expect(mediaExecutorFunction).toContain(
        "if v_subject_type='track'",
      );
      expect(mediaExecutorFunction).toContain(
        "update public.registry_tracks track",
      );
      expect(mediaExecutorFunction).toContain(
        "update public.registry_artists artist",
      );
    });

    it("binds evidence, exact grants, one write event, and verification", () => {
      expect(mediaMigration).toContain(
        "platform_private.registry_evidence_assertions",
      );
      expect(mediaMigration).toContain(
        "platform_private.registry_execution_grants",
      );
      expect(mediaMigration).toContain(
        "platform_private.registry_execution_grant_targets",
      );
      expect(mediaMigration).toContain(
        "platform_private.registry_operation_write_events",
      );
      expect(mediaMigration).toContain(
        "public.registry_canonical_write_events",
      );
      expect(mediaMigration).toContain(
        "admit_track_media_asset_binding",
      );
      expect(mediaMigration).toContain(
        "admit_artist_media_asset_binding",
      );
      expect(mediaMigration).toContain(
        "verify_registry_media_asset_binding_admin_v1",
      );
    });

    it("keeps public wrappers human-gated and private execution closed", () => {
      expect(mediaMigration).toContain(
        "public.admin_admit_registry_track_media_asset_candidate_v1",
      );
      expect(mediaMigration).toContain(
        "public.admin_admit_registry_artist_media_asset_candidate_v1",
      );
      expect(mediaMigration).toContain("to authenticated;");
      expect(mediaMigration).toContain(
        "from public,anon,service_role;",
      );
      expect(mediaMigration).toContain(
        "Media binding admin gained standing autonomous authority",
      );
      expect(mediaMigration).toContain(
        "Media binding private executor leaked execution authority",
      );
    });

    it("has a permanent verifier for future admitted rows", () => {
      expect(mediaVerifier).toContain(
        "MUSIC_METADATA_SLICE3_MEDIA_ASSET_BINDING_ADMISSION_V1_PASS",
      );
      expect(mediaVerifier).toContain(
        "registry_media_asset_binding_admin",
      );
      expect(mediaVerifier).toContain(
        "registry.track.media_asset_binding.admit",
      );
      expect(mediaVerifier).toContain(
        "registry.artist.media_asset_binding.admit",
      );
      expect(mediaVerifier).toContain(
        "retained_registry_metadata",
      );
      expect(mediaVerifier).toContain(
        "operation.verifier_status<>'passed'",
      );
    });
  });
});
