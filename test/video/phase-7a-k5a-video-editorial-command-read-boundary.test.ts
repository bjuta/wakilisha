import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs.readdirSync(dir).filter((name) =>
    name.endsWith("_phase_7a_k5a_video_editorial_command_read_boundary.sql")
  );
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

const migration = readMigration();
const languageTagMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260831080826_video_caption_language_private_use_tags.sql",
  ),
  "utf8",
);
const languageTagVerifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-video-caption-language-private-use.sql",
  ),
  "utf8",
);
const verifier = fs.readFileSync(
  path.resolve("scripts/control-plane/verify-phase-7a-k5a-video-editorial-command-read-boundary.sql"),
  "utf8",
);
const service = fs.readFileSync(
  path.resolve("src/services/video/videoAdminService.ts"),
  "utf8",
);
const discoveryTypes = fs.readFileSync(
  path.resolve("src/types/editorialDiscovery.ts"),
  "utf8",
);
const discoveryService = fs.readFileSync(
  path.resolve("src/services/editorial/editorialDiscoveryService.ts"),
  "utf8",
);

describe("Phase 7A K5A Video editorial command/read boundary", () => {
  it("activates the K2-reserved command vocabulary instead of inventing a second set", () => {
    for (const command of [
      "video.publication.create",
      "video.publication.metadata.update",
      "video.source.register",
      "video.publication.source.set",
      "video.publication.show_episode.bind",
      "video.publication.poster.set",
      "video.publication.transcript.set",
      "video.publication.captions.replace",
      "video.publication.chapters.replace",
    ]) {
      expect(migration).toContain(`'${command}'`);
    }
    expect(migration).not.toContain("video.source.create");
  });

  it("keeps private Video tables closed and exposes only governed authenticated RPCs", () => {
    expect(migration).toContain("revoke all on function video.replace_working_media_usage");
    expect(migration).toContain("grant execute on function public.create_video_publication");
    expect(migration).toContain("to authenticated;");
    expect(verifier).toContain("private Video schema/table authority leaked");
  });

  it("composes canonical Media authority without requiring global Media administration", () => {
    expect(migration).toContain("media.asset_governance_versions");
    expect(migration).toContain("media.validate_usage_target");
    expect(migration).toContain("media.usage_links");
    expect(migration).toContain("media.events");
    expect(migration).toContain("editorial.current_user_can_edit_video");
    expect(migration).not.toContain("manage_media_usage");
    for (const role of ["video_master", "video_poster", "video_caption", "video_transcript"]) {
      expect(migration).toContain(`'${role}'`);
    }
  });

  it("uses shared Show Episode authority and does not create a Video series system", () => {
    expect(migration).toContain("editorial.show_episodes");
    expect(migration).toContain("editorial.video_episode_shared_links");
    expect(migration).not.toMatch(/create\s+table\s+video\.(shows|series|video_series)\b/i);
    expect(verifier).toContain("competing Video lifecycle/Show authority exists");
  });

  it("keeps K4B lifecycle authority intact and reads shared event ledgers", () => {
    for (const rpc of [
      "snapshot_video_publication_working_version",
      "submit_video_publication_for_review",
      "review_video_publication",
      "publish_video_publication_version",
    ]) {
      expect(verifier).toContain(rpc);
      expect(service).toContain(rpc);
    }
    expect(migration).toContain("editorial.resource_review_events");
    expect(migration).toContain("editorial.resource_lifecycle_events");
  });

  it("keeps the application service RPC-only and resolves exact Media revisions through the canonical Media read service", () => {
    expect(service).toContain('getAdminMediaAssetById');
    expect(service).toContain('"get_admin_video_publication_workspace"');
    expect(service).toContain('"list_admin_video_publications"');
    expect(service).toContain("current_revision_id");
    expect(service).not.toMatch(/\.from\s*\(/);
  });

  it("extends shared Discovery typing for Video Resource Versions without a Video taxonomy fork", () => {
    expect(discoveryTypes).toContain('"video_publication_version"');
    expect(discoveryService).toContain('targetVersionType !== "video_publication_version"');
    expect(migration).not.toMatch(/create\s+table\s+video\.(categories|tags|taxonomy|seo)\b/i);
  });

  it("does not falsely promote UI primitives in a pre-UI milestone", () => {
    for (const primitive of [
      "AdminModeComposer",
      "EditorialCommentEditor",
      "MediaTransport",
      "MediaTimeline",
      "EditorialCreditPicker",
    ]) {
      expect(migration).not.toContain(primitive);
      expect(service).not.toContain(primitive);
    }
  });

  it("accepts normalized private-use caption language tags without weakening the existing Video boundary", () => {
    const privateUsePattern =
      "^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$";

    expect(languageTagMigration.split(privateUsePattern).length - 1).toBe(3);
    expect(languageTagMigration).toContain("caption_tracks_language_tag_check");
    expect(languageTagMigration).toContain(
      "publication_version_caption_tracks_language_tag_check",
    );
    expect(languageTagMigration).toContain("replace_video_publication_captions");
    expect(languageTagMigration).not.toContain(
      "^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$",
    );
    expect(languageTagVerifier).toContain("und-x-sheng");
    expect(languageTagVerifier).toContain("VIDEO_CAPTION_LANGUAGE_PRIVATE_USE_PASS");
    expect(languageTagVerifier).toMatch(/^-- Permanent read-only verifier/);
    expect(languageTagVerifier).toContain("set local transaction read only;");
    expect(languageTagVerifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain("PHASE_7A_K5A_VIDEO_EDITORIAL_COMMAND_READ_BOUNDARY_PASS");
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
