import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root =
  process.cwd();

const migrationDir =
  path.join(
    root,
    "supabase",
    "migrations",
  );

const matches =
  fs
    .readdirSync(migrationDir)
    .filter(
      (name) =>
        name.endsWith(
          "_phase_7a_k4c_p3_playlist_pointer_compatibility_retirement.sql",
        ),
    );

expect(matches).toHaveLength(1);

const migration =
  fs.readFileSync(
    path.join(
      migrationDir,
      matches[0],
    ),
    "utf8",
  );

const verifier =
  fs.readFileSync(
    path.join(
      root,
      "scripts",
      "control-plane",
      "verify-phase-7a-k4c-p3-playlist-pointer-compatibility-retirement.sql",
    ),
    "utf8",
  );

describe(
  "Phase 7A K4C-P3 Playlist pointer compatibility retirement",
  () => {
    it(
      "requires the production-sealed K4C-P2 authority before retirement",
      () => {
        expect(migration).toContain(
          "4f52dd85356906f9f6fb2e9dcd24551a",
        );
        expect(migration).toContain(
          "1a9a366b7a26d023aa589767a2024651",
        );
        expect(migration).toContain(
          "expected only the K1 Resource-to-typed Playlist writer",
        );
        expect(migration).toContain(
          "Playlist pointer parity drift",
        );
      },
    );

    it(
      "rewrites exactly the seven v_binding Playlist readers onto a canonical Resource row",
      () => {
        const targets = [
          "public.archive_playlist(uuid,bigint,text,text,uuid)",
          "public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)",
          "public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)",
          "public.restore_playlist_from_archive(uuid,bigint,text,text,uuid)",
          "public.schedule_playlist_publication(uuid,bigint,uuid,timestamp with time zone,text,text,uuid)",
          "public.snapshot_playlist_working_version(uuid,bigint,text,uuid)",
          "public.unpublish_playlist(uuid,bigint,text,text,uuid)",
        ];

        for (const target of targets) {
          expect(migration).toContain(target);
        }

        expect(migration).toContain(
          "select binding as binding_row, resource as resource_row",
        );
        expect(migration).toContain(
          "into v_pair",
        );
        expect(migration).toContain(
          "v_binding := v_pair.binding_row;",
        );
        expect(migration).toContain(
          "v_resource := v_pair.resource_row;",
        );
        expect(migration).not.toContain(
          "into v_binding, v_resource",
        );
        expect(migration).toContain(
          "for update of binding, resource;",
        );
        expect(migration).toContain(
          "'v_binding.current_working_version_id'",
        );
        expect(migration).toContain(
          "'v_resource.current_working_version_id'",
        );
      },
    );

    it(
      "uses exact old-fragment counts instead of rejecting pre-existing canonical tokens",
      () => {
        expect(migration).toContain(
          "v_occurrences <> rewrite_row.expected_occurrences",
        );
        expect(migration).toContain(
          "rewrite_row.old_fragment",
        );
        expect(migration).not.toContain(
          "canonical replacement already exists",
        );
        expect(migration).not.toContain(
          "position(\n      rewrite_row.new_fragment",
        );
      },
    );
    it(
      "moves the ten remaining inline Playlist readers without touching Audio metadata compatibility",
      () => {
        const targets = [
          "create_public_playlist_missing_track_submission",
          "copy_playlist_working_trust_to_working_successor",
          "list_current_public_person_work",
          "playlist_working_trust_target",
          "require_exact_working_snapshot_for_curated_submission",
          "get_public_playlist",
          "list_public_playlists",
          "community_get_reaction_state_for_public_targets_legacy_m7",
          "community_resolve_save_target",
          "save_resource_version_editorial_metadata",
        ];

        for (const target of targets) {
          expect(migration).toContain(target);
        }

        expect(migration).toContain(
          "from editorial.resources resource",
        );
        expect(migration).toContain(
          "from editorial.audio_publication_resources binding",
        );
        expect(migration).toContain(
          "Playlist/Audio shared metadata reader boundary",
        );
      },
    );

    it(
      "retires only the Playlist typed synchronization trigger and preserves Audio synchronization",
      () => {
        expect(migration).toContain(
          "drop trigger\n  playlist_resources_sync_shared_lifecycle",
        );
        expect(migration).not.toContain(
          "drop trigger\n  audio_publication_resources_sync_shared_lifecycle",
        );
        expect(migration).not.toContain(
          "drop function editorial.sync_resource_lifecycle_from_typed_binding",
        );
        expect(migration).toContain(
          "audio_publication_resources_sync_shared_lifecycle",
        );
        expect(migration).toContain(
          "resources_sync_typed_lifecycle_compatibility",
        );
      },
    );

    it(
      "narrows Resource-to-typed synchronization to Audio and pins the expected result",
      () => {
        expect(migration).toContain(
          "619a2bd22f9066594f84dada7a119902",
        );
        expect(migration).toContain(
          "editorial.audio_publication_resources",
        );
        expect(migration).toContain(
          "'audio_episode'",
        );
        expect(migration).toContain(
          "'standalone_audio'",
        );
      },
    );

    it(
      "drops exactly the four Playlist compatibility FKs and pointer columns without cascade",
      () => {
        for (const constraint of [
          "playlist_resources_working_version_fkey",
          "playlist_resources_submitted_version_fkey",
          "playlist_resources_approved_version_fkey",
          "playlist_resources_published_version_fkey",
        ]) {
          expect(migration).toContain(
            `drop constraint ${constraint}`,
          );
        }

        for (const column of [
          "current_working_version_id",
          "current_submitted_version_id",
          "current_approved_version_id",
          "current_published_version_id",
        ]) {
          expect(migration).toContain(
            `drop column ${column}`,
          );
        }

        expect(
          migration.toLowerCase(),
        ).not.toContain("cascade");
      },
    );

    it(
      "preserves function owner, security-definer, search-path, ACL and non-pointer data",
      () => {
        expect(migration).toContain(
          "changed function owner, SECURITY DEFINER, search_path, or ACL",
        );
        expect(migration).toContain(
          "playlist_nonpointer_fingerprint",
        );
        expect(migration).toContain(
          "audio_binding_fingerprint",
        );
      },
    );

    it(
      "permanent verifier requires zero Playlist pointer columns and intact Audio compatibility",
      () => {
        expect(verifier).toContain(
          "PHASE_7A_K4C_P3_PLAYLIST_POINTER_COMPATIBILITY_RETIREMENT_PASS",
        );
        expect(verifier).toContain(
          "Playlist typed pointer columns remain",
        );
        expect(verifier).toContain(
          "Audio typed pointer columns changed",
        );
        expect(verifier).toContain(
          "Audio pointer parity drift exists",
        );
        expect(verifier).toContain(
          "619a2bd22f9066594f84dada7a119902",
        );
      },
    );

    it(
      "keeps P1 shared-event authority and K4B no-typed-Video ratchets",
      () => {
        expect(migration).toContain(
          "typed Playlist event authority regressed",
        );
        expect(migration).toContain(
          "renewed typed Video event authority",
        );
        expect(verifier).toContain(
          "typed Playlist event authority regressed",
        );
        expect(verifier).toContain(
          "typed Video event authority regressed",
        );
      },
    );

    it(
      "keeps the permanent verifier read-only",
      () => {
        const lowered =
          verifier.toLowerCase();

        for (const forbidden of [
          "insert into ",
          "update ",
          "delete from ",
          "alter table ",
          "drop table ",
          "drop column ",
          "create table ",
          "create or replace function ",
        ]) {
          expect(lowered).not.toContain(
            forbidden,
          );
        }
      },
    );
  },
);
