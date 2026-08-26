import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationFile =
  readdirSync("supabase/migrations")
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k1_resource_lifecycle_convergence.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 7A K1 Resource lifecycle convergence migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-7a-k1-resource-lifecycle-convergence.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-7a-k1-resource-lifecycle-convergence.md",
  "utf8",
);

const reconciliation = readFileSync(
  "docs/engineering/phase-7a-video-schema-resource-lifecycle-reconciliation.md",
  "utf8",
);

const audioM1Verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m1-audio-identity-working-versions.sql",
  "utf8",
);
const audioM2Verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m2-audio-master-delivery.sql",
  "utf8",
);
const audioM3Verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m3-audio-review-publication-identity.sql",
  "utf8",
);

describe(
  "Phase 7A K1 Resource lifecycle convergence",
  () => {
    it(
      "moves shared Resource lifecycle foreign keys onto Resource Version identity",
      () => {
        for (const legacyConstraint of [
          "resources_current_working_version_fkey",
          "resources_current_submitted_version_fkey",
          "resources_current_approved_version_id_fkey",
          "resources_current_published_version_id_fkey",
        ]) {
          expect(migration)
            .toContain(`drop constraint ${legacyConstraint}`);
        }

        for (const sharedConstraint of [
          "resources_current_working_resource_version_fkey",
          "resources_current_submitted_resource_version_fkey",
          "resources_current_approved_resource_version_fkey",
          "resources_current_published_resource_version_fkey",
        ]) {
          expect(migration)
            .toContain(sharedConstraint);
        }

        expect(migration)
          .toContain(
            "references editorial.resource_versions(resource_id, id)",
          );
      },
    );

    it(
      "makes Resource pointers canonical while retaining typed compatibility mirrors",
      () => {
        expect(design)
          .toContain(
            "`editorial.resources` becomes the canonical cross-domain location for current lifecycle position",
          );
        expect(migration)
          .toContain(
            "create or replace function editorial.sync_resource_lifecycle_from_typed_binding()",
          );
        expect(migration)
          .toContain(
            "create or replace function editorial.sync_typed_lifecycle_from_resource()",
          );
        expect(migration)
          .toContain("playlist_resources_sync_shared_lifecycle");
        expect(migration)
          .toContain("audio_publication_resources_sync_shared_lifecycle");
        expect(migration)
          .toContain("resources_sync_typed_lifecycle_compatibility");

        expect(migration)
          .not.toMatch(
            /drop\s+column\s+current_(?:working|submitted|approved|published)_version_id/i,
          );
      },
    );

    it(
      "preserves historical lifecycle meaning instead of normalizing version kinds",
      () => {
        expect(design)
          .toContain(
            "K1 changes pointer **authority**, not historical lifecycle meaning.",
          );
        expect(migration)
          .toContain(
            "Historical working/published version kinds are intentionally not",
          );
        expect(migration)
          .toContain("version_kind = 'submitted'");
        expect(migration)
          .not.toMatch(
            /update\s+editorial\.resource_versions[\s\S]{0,300}version_kind\s*=/i,
          );
      },
    );

    it(
      "backfills Playlist and Audio positions into shared Resource lifecycle authority",
      () => {
        expect(migration)
          .toMatch(
            /update\s+editorial\.resources\s+resource_row[\s\S]+from\s+editorial\.playlist_resources\s+binding/i,
          );
        expect(migration)
          .toMatch(
            /update\s+editorial\.resources\s+resource_row[\s\S]+from\s+editorial\.audio_publication_resources\s+binding/i,
          );
        expect(verifier)
          .toContain("Playlist lifecycle mirror mismatch");
        expect(verifier)
          .toContain("Audio lifecycle mirror mismatch");
      },
    );

    it(
      "ratchets historical Audio verifiers to the new shared lifecycle contract",
      () => {
        for (const historicalVerifier of [
          audioM1Verifier,
          audioM2Verifier,
          audioM3Verifier,
        ]) {
          expect(historicalVerifier)
            .not.toContain(
              "Audio Resources wrote into Article-only generic version pointers",
            );
          expect(historicalVerifier)
            .toContain(
              "Audio Resource lifecycle pointer compatibility mismatch",
            );
        }
      },
    );

    it(
      "does not renew typed lifecycle duplication for Video",
      () => {
        expect(reconciliation)
          .toContain(
            "Video lifecycle position is stored only on the canonical Resource primitive",
          );
        expect(reconciliation)
          .toContain(
            "it must not create a fresh typed lifecycle-pointer mirror",
          );
        expect(migration)
          .not.toContain("create schema video");
        expect(migration)
          .not.toContain("video_publication_resources");
      },
    );

    it(
      "hardens internal lifecycle helpers and keeps them unavailable to application roles",
      () => {
        const pointerStart = migration.indexOf(
          "create or replace function editorial.assert_resource_version_pointer_integrity()",
        );
        const pointerEnd = migration.indexOf(
          "revoke execute",
          pointerStart,
        );
        const pointerFunction = migration.slice(
          pointerStart,
          pointerEnd,
        );

        expect(pointerStart).toBeGreaterThan(-1);
        expect(pointerEnd).toBeGreaterThan(pointerStart);
        expect(pointerFunction).toContain("security definer");
        expect(pointerFunction).toContain(
          "set search_path to 'pg_catalog', 'editorial'",
        );

        for (const helper of [
          "editorial.assert_resource_version_pointer_integrity()",
          "editorial.sync_resource_lifecycle_from_typed_binding()",
          "editorial.sync_typed_lifecycle_from_resource()",
        ]) {
          expect(migration)
            .toContain(`on function ${helper}`);
        }
        expect(migration)
          .toContain(
            "from public, anon, authenticated, service_role",
          );
        expect(design)
          .toContain(
            "The helper performs validation only, never mutation",
          );
        expect(verifier)
          .toContain(
            "Resource lifecycle helper security/search-path contract drifted",
          );
        expect(verifier)
          .toContain(
            "Resource lifecycle internal helper EXECUTE leaked to application roles",
          );
        expect(verifier)
          .toContain(
            "Resource lifecycle foreign-key shape drifted",
          );
      },
    );

    it(
      "keeps the permanent verifier read-only",
      () => {
        const lower = verifier.toLowerCase();

        for (const forbidden of [
          "insert into ",
          "update ",
          "delete from ",
          "create table ",
          "alter table ",
          "drop table ",
          "create or replace function ",
        ]) {
          expect(lower)
            .not.toContain(forbidden);
        }

        expect(verifier)
          .toContain(
            "PHASE_7A_K1_RESOURCE_LIFECYCLE_CONVERGENCE_PASS",
          );
      },
    );
  },
);
