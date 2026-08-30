import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOne(suffix: string): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs.readdirSync(dir).filter((name) => name.endsWith(suffix));
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

const migration = readOne(
  "_phase_7a_k5b_video_editor_shared_show_catalog.sql",
);
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k5b-video-editor-shared-show-catalog.sql",
  ),
  "utf8",
);
const collection = fs.readFileSync(
  path.resolve("src/pages/admin/content/video/page.tsx"),
  "utf8",
);
const workspace = fs.readFileSync(
  path.resolve(
    "src/pages/admin/content/video/detail/VideoEditorWorkspace.tsx",
  ),
  "utf8",
);
const service = fs.readFileSync(
  path.resolve("src/services/video/videoAdminService.ts"),
  "utf8",
);
const registry = JSON.parse(
  fs.readFileSync(
    path.resolve("scripts/control-plane/primitive-registry.json"),
    "utf8",
  ),
) as {
  primitives: Array<{
    id: string;
    maturity: string;
    consumers: string[];
  }>;
};
const routes = fs.readFileSync(
  path.resolve("src/router/config.tsx"),
  "utf8",
);
const lazyAdmin = fs.readFileSync(
  path.resolve("src/router/lazyAdmin.tsx"),
  "utf8",
);
const shell = fs.readFileSync(
  path.resolve("src/pages/admin/AdminShell.tsx"),
  "utf8",
);
const roles = fs.readFileSync(
  path.resolve("src/services/userRoles.ts"),
  "utf8",
);
const implementationAudit = fs.readFileSync(
  path.resolve(
    "docs/engineering/phase-7a-k5b-video-editor-composition-implementation-audit.md",
  ),
  "utf8",
);

function primitive(id: string) {
  const value = registry.primitives.find((item) => item.id === id);
  expect(value, `missing primitive ${id}`).toBeTruthy();
  return value!;
}

describe("Phase 7A K5B Video Editor composition", () => {
  it("extends only the governed Video admin read boundary for shared Show selection", () => {
    expect(migration).toContain(
      "create or replace function public.list_admin_video_publications()",
    );
    expect(migration).toContain("'shows'");
    expect(migration).toContain("'show_episodes'");
    expect(migration).toContain("editorial.shows");
    expect(migration).toContain("editorial.show_episodes");
    expect(migration).toContain("editorial.video_episode_shared_links");
    expect(migration).toContain("'video_publication_id'");
    expect(migration).not.toMatch(/create\s+table\b/i);
    expect(migration).not.toMatch(/create\s+schema\b/i);
    expect(migration).not.toMatch(/video\.(shows|series|video_series)\b/i);
  });

  it("keeps the K5B verifier read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K5B_VIDEO_EDITOR_SHARED_SHOW_CATALOG_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("mounts Video inside the existing governed Content and Editorial shell", () => {
    expect(routes).toContain(
      '{ path: "video", element: <AdminVideoPage /> }',
    );
    expect(routes).toContain(
      '{ path: "video/:publicationId", element: <AdminVideoDetailPage /> }',
    );
    expect(lazyAdmin).toContain("pages/admin/content/video/page");
    expect(lazyAdmin).toContain("pages/admin/content/video/detail/page");
    expect(shell).toContain('/admin/content/video');
    expect(shell).toContain('requiredCapability: "view_video"');
    for (const capability of [
      "view_video",
      "edit_own_video",
      "edit_others_video",
      "publish_video",
    ]) {
      expect(roles).toContain(`"${capability}"`);
    }
  });

  it("keeps collection and editor surfaces service-bound rather than reading private Video tables", () => {
    expect(collection).toContain("fetchVideoAdminIndex");
    expect(collection).toContain("createVideoPublication");
    expect(collection).not.toContain("@/lib/supabase");
    expect(workspace).toContain("fetchVideoPublicationWorkspace");
    expect(workspace).toContain("@/services/video/videoAdminService");
    expect(workspace).not.toContain("@/lib/supabase");
    expect(workspace).not.toMatch(/\.from\s*\(/);
    expect(service).toContain('"list_admin_video_publications"');
    expect(service).toContain('"get_admin_video_publication_workspace"');
  });

  it("uses shared Show Episode identity instead of introducing Video-owned series authoring", () => {
    expect(collection).toContain("index?.shows");
    expect(collection).toContain("index?.showEpisodes");
    expect(collection).toContain("episode.videoPublicationId");
    expect(collection).toContain("showEpisodeResourceId");
    expect(collection).not.toMatch(/createVideo(Show|Series)/);
    expect(workspace).toContain("workspace.showEpisode");
  });

  it("composes real Video-specific source, accessibility, chapter, discovery, review, and history work", () => {
    for (const symbol of [
      "registerNativeVideoSource",
      "registerExternalVideoSource",
      "setVideoPublicationPoster",
      "setVideoPublicationTranscript",
      "replaceVideoPublicationCaptions",
      "replaceVideoPublicationChapters",
      "EditorialMetadataWorkspace",
      "EditorialDecisionWorkspace",
      "snapshotVideoPublicationWorkingVersion",
      "submitVideoPublicationForReview",
      "publishVideoPublicationVersion",
    ]) {
      expect(workspace).toContain(symbol);
    }
  });

  it("promotes only candidates with real Video second-consumer imports", () => {
    const promoted = [
      ["admin.mode-composer", "AdminModeComposer", collection],
      ["editorial.media-transport", "MediaTransport", workspace],
      ["editorial.media-timeline", "MediaTimeline", workspace],
    ] as const;

    for (const [id, symbol, source] of promoted) {
      expect(source).toContain(symbol);
      expect(primitive(id).maturity).toBe("canonical");
      expect(primitive(id).consumers).toEqual(
        expect.arrayContaining(["admin:audio", "admin:video"]),
      );
    }
  });

  it("records K5B's deliberate Credit/comment deferral without freezing later milestones", () => {
    expect(implementationAudit).toContain("EditorialCommentEditor");
    expect(implementationAudit).toContain("EditorialCreditPicker");
    expect(implementationAudit).toContain("Deliberately not promoted");
    expect(implementationAudit).toContain(
      "These deferrals are authority gaps, not UI omissions to paper over.",
    );
  });

  it("keeps new Video Admin Studio copy free of em dashes", () => {
    expect(collection).not.toContain("—");
    expect(workspace).not.toContain("—");
  });
});
