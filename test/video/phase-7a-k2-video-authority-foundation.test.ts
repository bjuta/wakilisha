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
        "_phase_7a_k2_video_authority_foundation.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 7A K2 Video authority foundation migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-7a-k2-video-authority-foundation.sql",
  "utf8",
);

const audit = readFileSync(
  "docs/engineering/phase-7a-k2-video-authority-foundation-implementation-audit.md",
  "utf8",
);

const reconciliation = readFileSync(
  "docs/engineering/phase-7a-video-schema-resource-lifecycle-reconciliation.md",
  "utf8",
);

describe(
  "Phase 7A K2 Video authority foundation",
  () => {
    it(
      "creates typed Video authority without creating a competing Show hierarchy",
      () => {
        expect(migration).toContain("create schema video;");

        for (const relation of [
          "video.sources",
          "video.publications",
          "video.caption_tracks",
          "video.publication_chapters",
          "video.publication_versions",
          "video.publication_version_caption_tracks",
          "video.publication_version_chapters",
          "editorial.video_publication_resources",
          "editorial.video_episode_shared_links",
        ]) {
          expect(migration).toContain(`create table ${relation}`);
        }

        expect(migration).not.toContain("video_series");
        expect(migration).not.toContain("video_show");
        expect(migration).toContain("references editorial.show_episodes(resource_id)");
        expect(audit).toContain(
          "`show` and `show_episode` remain canonical cross-media collection identity.",
        );
      },
    );

    it(
      "makes Video the first native K1 lifecycle consumer with no typed pointer mirror",
      () => {
        const bindingStart = migration.indexOf(
          "create table editorial.video_publication_resources (",
        );
        const bindingEnd = migration.indexOf(
          "create table editorial.video_episode_shared_links (",
          bindingStart,
        );
        const binding = migration.slice(bindingStart, bindingEnd);

        expect(bindingStart).toBeGreaterThan(-1);
        expect(bindingEnd).toBeGreaterThan(bindingStart);
        expect(binding).toContain("resource_id uuid primary key");
        expect(binding).toContain("resource_kind text not null");
        expect(binding).toContain("publication_id uuid not null unique");

        for (const legacyPointer of [
          "current_working_version_id",
          "current_submitted_version_id",
          "current_approved_version_id",
          "current_published_version_id",
        ]) {
          expect(binding).not.toContain(legacyPointer);
        }

        expect(reconciliation).toContain(
          "Video lifecycle position is stored only on the canonical Resource primitive",
        );
        expect(audit).toContain(
          "The K2 permanent verifier checks this absence as a platform invariant.",
        );
        expect(verifier).toContain(
          "Video renewed typed lifecycle-pointer mirrors",
        );
      },
    );

    it(
      "registers typed Video versions into the global Resource Version envelope",
      () => {
        expect(migration).toContain("'video_publication_version'");
        expect(migration).toContain(
          "('video_publication_version', 'standalone_video')",
        );
        expect(migration).toContain(
          "('video_publication_version', 'video_episode')",
        );
        expect(migration).toContain(
          "video_publication_versions_register_resource_version",
        );
        expect(migration).toContain(
          "execute function editorial.register_typed_resource_version();",
        );
        expect(migration).toContain(
          "elsif p_target_version_type = 'video_publication_version' then",
        );
        expect(migration).toContain(
          "from video.publication_versions version",
        );
        expect(verifier).toContain(
          "a typed Video version is missing its exact Resource Version envelope",
        );
      },
    );

    it(
      "reuses shared Discovery storage without inventing Video SEO or taxonomy stores",
      () => {
        expect(migration).toContain(
          "resource_version_editorial_metadata_target_version_type_check",
        );
        expect(migration).toContain(
          "resource_version_taxonomy_terms_target_version_type_check",
        );
        expect(migration).toContain(
          "editorial.materialize_video_resource_version_editorial_metadata()",
        );
        expect(migration).toContain(
          "editorial.copy_resource_version_editorial_metadata(",
        );
        expect(migration).not.toContain("video_seo");
        expect(migration).not.toContain("video_tags");
        expect(audit).toContain(
          "K2 does not add:\n\n- `video_seo`\n- `video_tags`",
        );
      },
    );

    it(
      "keeps source identity separate from the Video cultural object",
      () => {
        expect(migration).toContain(
          "source_kind in ('native_media', 'external_provider')",
        );
        expect(migration).toContain(
          "video_sources_native_identity_key",
        );
        expect(migration).toContain(
          "video_sources_provider_identity_key",
        );
        expect(migration).toContain("('youtube', 'YouTube'");
        expect(migration).toContain("('vimeo', 'Vimeo'");
        expect(migration).toContain("video_sources_immutable");
        expect(migration).toContain(
          "Native Video source requires one exact verified revision of the same Video asset.",
        );
      },
    );

    it(
      "extends canonical Media usage authority for Video instead of creating a Video file store",
      () => {
        for (const role of [
          "video_master",
          "video_poster",
          "video_caption",
          "video_transcript",
        ]) {
          expect(migration).toContain(`'${role}'`);
        }

        expect(migration).toContain(
          "drop constraint usage_links_target_authority_check",
        );
        expect(migration).toContain(
          "drop constraint usage_links_target_kind_check",
        );
        expect(migration).toContain(
          "'video_publication'",
        );
        expect(verifier).toContain(
          "usage_links_target_authority_check",
        );
        expect(verifier).toContain(
          "usage_links_target_kind_check",
        );
        expect(migration).toContain(
          "p_target_authority = 'video'",
        );
        expect(migration).toContain(
          "p_target_kind = 'video_publication'",
        );
        expect(migration).toContain(
          "p_target_version_kind <> 'video_publication_version'",
        );
        expect(migration).toContain(
          "resolution_mode <> 'exact_revision'",
        );
        expect(migration).toContain(
          "media_video_singleton_active_usage_key",
        );
        expect(migration).not.toContain("create table video.file");
        expect(migration).not.toContain("create table video.upload");
        expect(migration).not.toContain("create table video.transcript");
      },
    );

    it(
      "enforces native source and video_master agreement as deferred cross-table authority",
      () => {
        expect(migration).toContain(
          "video.assert_selected_source_media_usage_integrity()",
        );
        expect(migration).toContain(
          "video_publications_selected_source_usage_integrity",
        );
        expect(migration).toContain(
          "media_usage_video_master_selection_integrity",
        );
        expect(migration).toContain(
          "deferrable initially deferred",
        );
        expect(migration).toContain(
          "Selected native Video source and active video_master Media usage must agree exactly.",
        );
        expect(verifier).toContain(
          "native Video source and video_master usage diverged",
        );
      },
    );

    it(
      "keeps caption semantics typed while Media owns exact files",
      () => {
        for (const kind of [
          "captions",
          "subtitles",
          "forced_subtitles",
        ]) {
          expect(migration).toContain(`'${kind}'`);
        }

        expect(migration).toContain(
          "Video caption track requires one exact verified Caption Media revision.",
        );
        expect(migration).toContain(
          "video_caption_tracks_one_default_key",
        );
        expect(migration).toContain(
          "video_publication_version_one_default_caption_key",
        );
      },
    );

    it(
      "keeps chapter meaning typed and proves ordered contiguous timing",
      () => {
        expect(migration).toContain(
          "video.assert_chapter_sequence_integrity()",
        );
        expect(migration).toContain(
          "Video chapter numbers must be contiguous from 1.",
        );
        expect(migration).toContain(
          "Video chapter start times must increase strictly.",
        );
        expect(migration).toContain(
          "video_publication_version_chapter_sequence_integrity",
        );
      },
    );

    it(
      "reserves governed command vocabulary without exposing premature Video RPCs",
      () => {
        for (const command of [
          "video.source.register",
          "video.publication.create",
          "video.publication.metadata.update",
          "video.publication.source.set",
          "video.publication.show_episode.bind",
          "video.publication.poster.set",
          "video.publication.captions.replace",
          "video.publication.transcript.set",
          "video.publication.chapters.replace",
          "video.publication.version.snapshot_working",
        ]) {
          expect(migration).toContain(`'${command}'`);
        }

        expect(migration).not.toMatch(
          /create\s+or\s+replace\s+function\s+public\.[a-z0-9_]*video[a-z0-9_]*/i,
        );
        expect(migration).not.toContain("video_review_events");
        expect(migration).not.toContain("create table video.review_events");
      },
    );

    it(
      "hardens private Video authority and internal privileged helpers",
      () => {
        expect(migration).toContain(
          "revoke all\n  on schema video\n  from public, anon, authenticated, service_role;",
        );
        expect(migration).toContain(
          "alter table video.publications enable row level security;",
        );
        expect(migration).toContain(
          "alter table video.publication_versions enable row level security;",
        );
        expect(migration).toContain(
          "from public, anon, authenticated, service_role;",
        );

        for (const helper of [
          "editorial.current_user_can_view_video",
          "editorial.current_user_can_edit_video",
          "editorial.current_user_can_publish_video",
          "video.enforce_source_integrity",
          "video.assert_selected_source_media_usage_integrity",
        ]) {
          expect(migration).toContain(helper);
        }

        expect(verifier).toContain(
          "privileged Video helper security/search-path contract drifted",
        );
        expect(verifier).toContain(
          "internal Video helper EXECUTE leaked to application roles",
        );
      },
    );

    it(
      "uses valid PostgreSQL ACL syntax for multi-function revokes",
      () => {
        expect(migration).not.toMatch(
          /,\s*function\s+[a-z_][a-z0-9_.]*\s*\(/i,
        );
        expect(migration).toContain(
          "on function editorial.current_user_can_view_video(uuid),\n     editorial.current_user_can_edit_video(uuid),\n     editorial.current_user_can_publish_video(uuid)",
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
          "PHASE_7A_K2_VIDEO_AUTHORITY_FOUNDATION_PASS",
        );
      },
    );
  },
);
