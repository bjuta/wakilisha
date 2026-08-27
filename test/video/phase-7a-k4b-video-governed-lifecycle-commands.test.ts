import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readK4BMigration(): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(dir)
    .filter((name) =>
      name.endsWith("_phase_7a_k4b_video_governed_lifecycle_commands.sql"),
    );

  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

const migration = readK4BMigration();
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4b-video-governed-lifecycle-commands.sql",
  ),
  "utf8",
);

describe("Phase 7A K4B Video governed lifecycle commands", () => {
  it("keeps Resource lifecycle position canonical and does not renew Video status mirrors", () => {
    expect(migration).not.toMatch(
      /alter\s+table\s+video\.publications[\s\S]*add\s+column\s+(status|lifecycle_status)/i,
    );
    expect(migration).not.toMatch(
      /create\s+table\s+video\.publication_review_events\b/i,
    );
    expect(migration).not.toMatch(
      /create\s+table\s+video\.publication_lifecycle_events\b/i,
    );
    expect(migration).toContain("current_working_version_id");
    expect(migration).toContain("current_submitted_version_id");
    expect(migration).toContain("current_approved_version_id");
    expect(migration).toContain("current_published_version_id");
  });

  it("uses PostgreSQL-valid scalar count guards in migration preflight/proof", () => {
    expect(migration).not.toMatch(/group\s+by\s+true/i);
    expect(migration.match(/select count\(\*\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("freezes full Video identity into immutable versions including typed captions, chapters, and Media usage", () => {
    expect(migration).toContain("video.publication_content_snapshot_json");
    expect(migration).toContain("video.publication_content_fingerprint");
    expect(migration).toContain("video.publication_version_caption_tracks");
    expect(migration).toContain("video.publication_version_chapters");
    expect(migration).toContain("video.copy_current_media_usage_to_version");
    expect(migration).toContain("'video_publication_version'");
    expect(migration).toContain("'exact_revision'");
  });

  it("takes Video Episode snapshot identity only from the shared Show hierarchy", () => {
    expect(migration).toContain("editorial.video_episode_shared_links");
    expect(migration).toContain("editorial.show_episodes");
    expect(migration).toContain("editorial.shows");
    expect(migration).not.toMatch(
      /add\s+column\s+(show_slug|episode_slug|episode_title|episode_summary)/i,
    );
  });

  it("requires exact current working identity before submit", () => {
    expect(migration).toContain(
      "public.submit_video_publication_for_review",
    );
    expect(migration).toContain("video_working_version_stale");
    expect(migration).toContain("v_resource.current_working_version_id");
    expect(migration).toContain(
      "video.copy_publication_version_snapshot",
    );
    expect(migration).toContain("'submitted'");
  });

  it("writes submit into both shared lifecycle and review ledgers", () => {
    const submitStart = migration.indexOf(
      "create or replace function public.submit_video_publication_for_review",
    );
    const reviewStart = migration.indexOf(
      "create or replace function public.review_video_publication",
    );
    const submitBody = migration.slice(submitStart, reviewStart);

    expect(submitBody).toContain(
      "insert into editorial.resource_lifecycle_events",
    );
    expect(submitBody).toContain(
      "insert into editorial.resource_review_events",
    );
    expect(submitBody).toContain("current_submitted_version_id");
    expect(submitBody).toContain("current_approved_version_id = null");
  });

  it("targets exact submitted Resource Version and records shared review decisions", () => {
    expect(migration).toContain("public.review_video_publication");
    expect(migration).toContain("video_submitted_version_changed");
    expect(migration).toContain("video_submitted_version_stale");
    expect(migration).toContain("current_submitted_version_id");
    expect(migration).toContain("current_approved_version_id");
    expect(migration).toContain(
      "insert into editorial.resource_review_events",
    );
    expect(migration).toContain("'review_started'");
    expect(migration).toContain("'changes_requested'");
    expect(migration).toContain("'approved'");
  });

  it("does not invent a lifecycle event for review_started", () => {
    const reviewStart = migration.indexOf(
      "create or replace function public.review_video_publication",
    );
    const publishStart = migration.indexOf(
      "create or replace function public.publish_video_publication_version",
    );
    const body = migration.slice(reviewStart, publishStart);

    expect(body).toContain(
      "if p_decision in (\n        'request_changes',\n        'approve'",
    );
  });

  it("publishes only exact approved identity and rechecks current source and Media safety", () => {
    expect(migration).toContain(
      "public.publish_video_publication_version",
    );
    expect(migration).toContain("current_approved_version_id");
    expect(migration).toContain("current_published_version_id");
    expect(migration).toContain("video_approved_version_stale");
    expect(migration).toContain(
      "video.assert_publishable_publication_version",
    );
    expect(migration).toContain("lifecycle_state = 'published'");
    expect(migration).toContain("visibility = 'public'");
  });

  it("preserves prior published identity in shared lifecycle history", () => {
    expect(migration).toContain("'prior_published_version_id'");
    expect(migration).toContain(
      "v_resource.current_published_version_id",
    );
  });

  it("uses the existing governed command receipt substrate for idempotency", () => {
    for (const command of [
      "snapshot_video_publication_working_version",
      "submit_video_publication_for_review",
      "review_video_publication",
      "publish_video_publication_version",
    ]) {
      const idx = migration.indexOf(
        `create or replace function public.${command}`,
      );
      expect(idx).toBeGreaterThan(-1);
    }

    expect(
      migration.match(
        /platform_private\.begin_authenticated_resource_command/g,
      )?.length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      migration.match(
        /platform_private\.complete_resource_command/g,
      )?.length,
    ).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("idempotent_replay");
  });

  it("keeps anonymous mutation closed while enabling governed authenticated RPCs", () => {
    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("to authenticated, service_role;");
  });

  it("keeps the permanent verifier read-only and enforces the K4B ratchets", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K4B_VIDEO_GOVERNED_LIFECYCLE_COMMANDS_PASS",
    );
    expect(verifier).toContain("typed Video event authority exists");
    expect(verifier).toContain("mutable Video lifecycle duplication exists");
    expect(verifier).not.toMatch(
      /\b(insert|update|delete|alter|drop|create|grant|revoke)\b/i,
    );
  });
});
