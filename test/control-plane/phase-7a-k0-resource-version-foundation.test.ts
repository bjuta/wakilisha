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
        "_phase_7a_k0_resource_version_foundation.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 7A K0 Resource Version migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-7a-k0-resource-version-foundation.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-7a-k0-resource-version-foundation.md",
  "utf8",
);

const invariants = readFileSync(
  "docs/engineering/phase-7a-k0-resource-version-foundation-design-notes.md",
  "utf8",
);

describe(
  "Phase 7A K0 Resource Version foundation",
  () => {
    it(
      "creates controlled Resource Version authority without a generic content store",
      () => {
        expect(migration)
          .toContain(
            "create table editorial.resource_version_types",
          );
        expect(migration)
          .toContain(
            "create table editorial.resource_version_type_kinds",
          );
        expect(migration)
          .toContain(
            "create table editorial.resource_versions",
          );

        for (const forbidden of [
          "content_json",
          "content_payload",
          "generic_content",
          "universal_content",
        ]) {
          expect(migration)
            .not.toContain(forbidden);
        }
      },
    );

    it(
      "reuses the typed domain version UUID as global Resource Version identity",
      () => {
        expect(design)
          .toContain(
            "use the existing typed domain version UUID as the Resource Version UUID",
          );
        expect(invariants)
          .toContain(
            "editorial.resource_versions.id` must equal the existing typed domain version UUID",
          );

        for (const versionType of [
          "article_version",
          "playlist_version",
          "audio_publication_version",
        ]) {
          expect(migration)
            .toContain(`'${versionType}'`);
          expect(verifier)
            .toContain(`'${versionType}'`);
        }
      },
    );

    it(
      "backfills Article Playlist and Audio through one exact registration contract",
      () => {
        expect(migration)
          .toContain(
            "create or replace function editorial.register_resource_version",
          );
        expect(migration)
          .toContain(
            "from editorial.article_versions version_row",
          );
        expect(migration)
          .toContain(
            "from editorial.playlist_versions version_row",
          );
        expect(migration)
          .toContain(
            "from audio.publication_versions version_row",
          );
        expect(migration)
          .toContain(
            "Resource Version registration does not match typed",
          );
      },
    );

    it(
      "keeps future typed versions synchronized in the same transaction",
      () => {
        expect(migration)
          .toContain(
            "create or replace function editorial.register_typed_resource_version",
          );

        for (const trigger of [
          "article_versions_register_resource_version",
          "playlist_versions_register_resource_version",
          "audio_publication_versions_register_resource_version",
        ]) {
          expect(migration)
            .toContain(trigger);
          expect(verifier)
            .toContain(trigger);
        }
      },
    );

    it(
      "does not perform K1 lifecycle-pointer convergence early",
      () => {
        expect(design)
          .toContain(
            "leave `editorial.resources.current_*_version_id` unchanged in K0",
          );
        expect(design)
          .toContain(
            "leave Playlist and Audio typed lifecycle pointers unchanged in K0",
          );

        expect(migration)
          .not.toMatch(
            /alter\s+table\s+editorial\.resources/i,
          );
        expect(migration)
          .not.toMatch(
            /update\s+editorial\.resources[\s\S]{0,500}current_(?:working|submitted|approved|published)_version_id\s*=/i,
          );
        expect(migration)
          .not.toMatch(
            /update\s+editorial\.(?:playlist_resources|audio_publication_resources)[\s\S]{0,500}current_(?:working|submitted|approved|published)_version_id\s*=/i,
          );
      },
    );

    it(
      "makes the global version envelope immutable and non-browser writable",
      () => {
        expect(migration)
          .toContain("resource_versions_immutable");
        expect(migration)
          .toContain("Resource Versions are immutable.");
        expect(migration)
          .toContain(
            "alter table editorial.resource_versions enable row level security",
          );
        expect(migration)
          .toContain(
            "from public, anon, authenticated, service_role",
          );
      },
    );

    it(
      "keeps K0 out of Video and review-event implementation",
      () => {
        expect(design)
          .toContain("create Video authority yet");
        expect(design)
          .toContain("create another review-event implementation");

        expect(migration)
          .not.toContain("create schema video");
        expect(migration)
          .not.toContain("video_review_events");
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
            "PHASE_7A_K0_RESOURCE_VERSION_FOUNDATION_PASS",
          );
      },
    );
  },
);
