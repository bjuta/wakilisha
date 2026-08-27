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
        "_phase_7a_k4a_resource_event_authority.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 7A K4A shared Resource event authority migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-7a-k4a-resource-event-authority.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-7a-k3-resource-review-lifecycle-event-convergence-design.md",
  "utf8",
);

describe(
  "Phase 7A K4A shared Resource event authority",
  () => {
    it(
      "creates separate shared lifecycle and review ledgers instead of one generic event bucket",
      () => {
        expect(migration).toContain(
          "create table editorial.resource_lifecycle_events",
        );
        expect(migration).toContain(
          "create table editorial.resource_review_events",
        );
        expect(migration).toContain(
          "create table editorial.resource_lifecycle_actions",
        );
        expect(migration).toContain(
          "create table editorial.resource_review_actions",
        );

        expect(design).toContain(
          "Create two shared append-only Resource event ledgers",
        );
        expect(design).toContain(
          "The two ledgers have different responsibilities",
        );
      },
    );

    it(
      "anchors all shared version identity in the Resource Version envelope",
      () => {
        expect(migration).toContain(
          "references editorial.resources(id)",
        );
        expect(migration).toContain(
          "references editorial.resource_versions(resource_id, id)",
        );

        for (const constraint of [
          "resource_lifecycle_events_version_fkey",
          "resource_review_events_target_version_fkey",
          "resource_review_events_result_version_fkey",
        ]) {
          expect(migration).toContain(constraint);
          expect(verifier).toContain(constraint);
        }

        expect(verifier).toContain(
          "missing or cross-Resource Resource Version",
        );
      },
    );

    it(
      "preserves controlled shared action meaning without rewriting historical status vocabulary",
      () => {
        for (const action of [
          "submitted",
          "changes_requested",
          "approved",
          "scheduled",
          "unscheduled",
          "published",
          "unpublished",
          "archived",
          "restored",
        ]) {
          expect(migration).toContain(`('${action}',`);
        }

        for (const action of [
          "review_started",
          "rejected",
        ]) {
          expect(migration).toContain(`('${action}',`);
        }

        expect(migration).not.toMatch(
          /update\s+(?:editorial\.article_lifecycle_events|editorial\.playlist_lifecycle_events|audio\.publication_lifecycle_events|editorial\.playlist_review_events|audio\.publication_review_events)/i,
        );
      },
    );

    it(
      "backfills every existing typed event source deterministically while preserving source identity",
      () => {
        for (const source of [
          "editorial.article_lifecycle_events",
          "editorial.playlist_lifecycle_events",
          "audio.publication_lifecycle_events",
          "editorial.playlist_review_events",
          "audio.publication_review_events",
        ]) {
          expect(migration).toContain(source);
          expect(verifier).toContain(source);
        }

        for (const sourceAuthority of [
          "article_lifecycle",
          "playlist_lifecycle",
          "audio_publication_lifecycle",
          "playlist_review",
          "audio_publication_review",
        ]) {
          expect(migration).toContain(`'${sourceAuthority}'`);
          expect(verifier).toContain(`'${sourceAuthority}'`);
        }

        expect(migration).toContain(
          "row_number() over (",
        );
        expect(migration).toContain(
          "legacy_source_event_id",
        );
        expect(migration).toContain(
          "canonical.id = source.id",
        );
      },
    );

    it(
      "fingerprints legacy event stores and proves K4A does not mutate them",
      () => {
        expect(migration).toContain(
          "create temporary table phase_7a_k4a_baseline",
        );
        expect(migration).toContain(
          "article_lifecycle_fingerprint",
        );
        expect(migration).toContain(
          "playlist_lifecycle_fingerprint",
        );
        expect(migration).toContain(
          "audio_lifecycle_fingerprint",
        );
        expect(migration).toContain(
          "playlist_review_fingerprint",
        );
        expect(migration).toContain(
          "audio_review_fingerprint",
        );
        expect(migration).toContain(
          "K4A mutated existing typed event history",
        );

        for (const forbidden of [
          "drop table editorial.article_lifecycle_events",
          "drop table editorial.playlist_lifecycle_events",
          "drop table editorial.playlist_review_events",
          "drop table audio.publication_lifecycle_events",
          "drop table audio.publication_review_events",
        ]) {
          expect(migration.toLowerCase()).not.toContain(forbidden);
        }
      },
    );

    it(
      "requires governed command trace for new canonical writes while preserving honest legacy gaps",
      () => {
        expect(migration).toContain(
          "resource_lifecycle_events_new_command_trace_check",
        );
        expect(migration).toContain(
          "resource_review_events_new_command_trace_check",
        );
        expect(migration).toContain(
          "New shared Resource events require command receipt and correlation identity",
        );
        expect(migration).toContain(
          "Shared Resource event command receipt belongs to another Resource",
        );
        expect(migration).toContain(
          "Shared Resource event actor must match command receipt actor",
        );

        expect(migration).toContain(
          "null::uuid as command_receipt_id",
        );
        expect(migration).toContain(
          "'article_lifecycle'::text as legacy_source_authority",
        );
      },
    );

    it(
      "protects canonical event history as append-only internal authority",
      () => {
        expect(migration).toContain(
          "create or replace function editorial.protect_resource_event_history()",
        );
        expect(migration).toContain(
          "create or replace function editorial.assert_resource_event_insert_integrity()",
        );
        expect(migration).toContain(
          "create or replace function editorial.assert_resource_event_sequence_integrity()",
        );
        expect(migration).toContain(
          "Shared Resource event history is append-only",
        );
        expect(migration).toContain(
          "Shared Resource event numbers must be contiguous from 1 for each Resource",
        );

        for (const trigger of [
          "resource_lifecycle_events_append_only",
          "resource_review_events_append_only",
          "resource_lifecycle_events_insert_integrity",
          "resource_review_events_insert_integrity",
          "resource_lifecycle_events_sequence_integrity",
          "resource_review_events_sequence_integrity",
        ]) {
          expect(migration).toContain(trigger);
          expect(verifier).toContain(trigger);
        }

        expect(migration).toContain(
          "set search_path to 'pg_catalog', 'editorial', 'platform_private'",
        );
        expect(migration).toContain(
          "from public, anon, authenticated, service_role",
        );
      },
    );

    it(
      "flushes deferred backfill trigger events before RLS table DDL",
      () => {
        const lifecycleBackfill = migration.indexOf(
          "insert into editorial.resource_lifecycle_events",
        );
        const reviewBackfill = migration.indexOf(
          "insert into editorial.resource_review_events",
        );
        const flushBarrier = migration.indexOf(
          "set constraints all immediate;",
        );
        const deferredRearm = migration.indexOf(
          "set constraints all deferred;",
        );
        const lifecycleRls = migration.indexOf(
          "alter table editorial.resource_lifecycle_events enable row level security;",
        );

        expect(lifecycleBackfill).toBeGreaterThan(-1);
        expect(reviewBackfill).toBeGreaterThan(lifecycleBackfill);
        expect(flushBarrier).toBeGreaterThan(reviewBackfill);
        expect(deferredRearm).toBeGreaterThan(flushBarrier);
        expect(lifecycleRls).toBeGreaterThan(deferredRearm);
      },
    );

    it(
      "keeps direct application access closed and uses RLS as defense in depth",
      () => {
        for (const table of [
          "editorial.resource_lifecycle_actions",
          "editorial.resource_review_actions",
          "editorial.resource_lifecycle_events",
          "editorial.resource_review_events",
        ]) {
          expect(migration).toContain(
            `alter table ${table} enable row level security;`,
          );
        }

        expect(migration).toContain(
          "revoke all\n  on table editorial.resource_lifecycle_actions",
        );
        expect(verifier).toContain(
          "direct shared Resource event table privilege leaked to an application role",
        );
      },
    );

    it(
      "ratchets Video away from typed review and lifecycle ledgers",
      () => {
        expect(design).toContain(
          "Video receives no typed event tables.",
        );
        expect(design).toContain(
          "Video commands write only the shared Resource ledgers.",
        );

        for (const forbidden of [
          "create table video.review_events",
          "create table video.lifecycle_events",
          "create table video.publication_review_events",
          "create table video.publication_lifecycle_events",
        ]) {
          expect(migration.toLowerCase()).not.toContain(forbidden);
        }

        expect(verifier).toContain(
          "Video renewed typed review/lifecycle event authority",
        );
      },
    );

    it(
      "keeps K4A focused on event authority and does not prematurely expose Video lifecycle commands",
      () => {
        expect(migration).not.toMatch(
          /create\s+or\s+replace\s+function\s+public\.[a-z0-9_]*video[a-z0-9_]*/i,
        );
        expect(migration).not.toContain(
          "video.publication.submit",
        );
        expect(migration).not.toContain(
          "video.publication.publish",
        );
        expect(design).toContain(
          "K4B: Video governed lifecycle commands",
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
          expect(lower).not.toContain(forbidden);
        }

        expect(verifier).toContain(
          "set local transaction read only;",
        );
        expect(verifier).toContain(
          "PHASE_7A_K4A_RESOURCE_EVENT_AUTHORITY_PASS",
        );
      },
    );
  },
);
