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
        "_phase_6a_m1_audio_identity_working_versions.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 6A M1 Audio migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m1-audio-identity-working-versions.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-6a-m1-audio-identity-working-version-foundation.md",
  "utf8",
);

describe(
  "Phase 6A M1 Audio identity and working versions",
  () => {
    it(
      "creates a non-exposed canonical Audio domain",
      () => {
        expect(migration)
          .toContain("create schema audio");
        expect(migration)
          .toContain("create table audio.shows");
        expect(migration)
          .toContain("create table audio.seasons");
        expect(migration)
          .toContain("create table audio.publications");
        expect(migration)
          .toContain(
            "create table audio.publication_versions",
          );
        expect(migration)
          .not.toContain(
            "create table public.wk_audio",
          );
      },
    );

    it(
      "establishes all four Audio Resource kinds and typed bindings",
      () => {
        for (const kind of [
          "audio_show",
          "audio_season",
          "audio_episode",
          "standalone_audio",
        ]) {
          expect(migration)
            .toContain(`'${kind}'`);
          expect(verifier)
            .toContain(`'${kind}'`);
        }

        expect(migration)
          .toContain(
            "editorial.audio_show_resources",
          );
        expect(migration)
          .toContain(
            "editorial.audio_season_resources",
          );
        expect(migration)
          .toContain(
            "editorial.audio_publication_resources",
          );
      },
    );

    it(
      "keeps Audio versions out of Article-only generic Resource pointers",
      () => {
        expect(design)
          .toContain(
            "Audio version UUIDs never enter:",
          );

        const genericPointerWrite =
          /update\s+editorial\.resources[\s\S]{0,600}current_(?:working|submitted|approved|published)_version_id\s*=/i;

        expect(
          genericPointerWrite.test(
            migration,
          ),
        )
          .toBe(false);

        expect(verifier)
          .toContain(
            "Audio Resources wrote into Article-only generic version pointers",
          );
      },
    );

    it(
      "uses immutable publication snapshots with stale-write protection",
      () => {
        expect(migration)
          .toContain(
            "audio_publication_versions_immutable",
          );
        expect(migration)
          .toContain(
            "p_expected_authority_revision",
          );
        expect(migration)
          .toContain(
            "audio_publication_revision_changed",
          );
        expect(migration)
          .toContain(
            "publication_content_fingerprint",
          );
        expect(migration)
          .toContain(
            "reused_existing_snapshot",
          );
      },
    );

    it(
      "reuses shared command receipts and outbox authority",
      () => {
        expect(migration)
          .toContain(
            "platform_private.begin_authenticated_resource_command",
          );
        expect(migration)
          .toContain(
            "platform_private.complete_resource_command",
          );
        expect(migration)
          .toContain(
            "platform_private.reject_resource_command",
          );
        expect(migration)
          .toContain(
            "platform_private.command_types",
          );

        expect(migration)
          .not.toContain(
            "create table audio.command_receipts",
          );
        expect(migration)
          .not.toContain(
            "create table audio.outbox",
          );
      },
    );

    it(
      "matches the established Audio editorial capability pattern",
      () => {
        for (const capability of [
          "view_audio",
          "edit_own_audio",
          "edit_others_audio",
          "publish_audio",
          "delete_audio",
        ]) {
          expect(migration)
            .toContain(`'${capability}'`);
        }

        expect(migration)
          .toContain(
            "('reviewer', 'view_audio')",
          );
        expect(migration)
          .toContain(
            "('writer', 'edit_own_audio')",
          );
      },
    );

    it(
      "keeps M1 out of later Audio publication and Media work",
      () => {
        expect(design)
          .toContain("M1 does not:");
        expect(design)
          .toContain(
            "- add a full-length Audio derivative",
          );
        expect(design)
          .toContain("- submit for Review");
        expect(design)
          .toContain("- generate RSS");
        expect(design)
          .toContain("- alter the global player");

        expect(migration)
          .not.toContain("audio_delivery");
        expect(migration)
          .not.toContain("rss_guid");
        expect(migration)
          .not.toContain("publish_audio_version");
      },
    );

    it(
      "keeps the permanent verifier read-only",
      () => {
        const lower =
          verifier.toLowerCase();

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
            "PASS: Phase 6A M1 Audio identity",
          );
      },
    );
  },
);

