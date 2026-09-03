import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

function convergenceMigration(): string {
  const migrations = fs.readdirSync(path.resolve("supabase/migrations"));
  const file = migrations.find((name) =>
    name.endsWith("_show_video_public_route_convergence.sql")
  );

  if (!file) {
    throw new Error(
      "Missing CLI-created show_video_public_route_convergence migration.",
    );
  }

  return read(path.join("supabase/migrations", file));
}

const router = read("src/router/config.tsx");
const lazyPublic = read("src/router/lazyPublic.tsx");
const showModel = read("src/services/shows/showPublicModel.ts");
const showService = read("src/services/shows/showPublicService.ts");
const showIndex = read("src/pages/shows/page.tsx");
const showDetail = read("src/pages/shows/detail/page.tsx");
const showEpisode = read("src/pages/shows/episode/page.tsx");
const videoDetail = read("src/pages/video/detail/page.tsx");
const routeAudit = read("scripts/performance/audit-public-route-splitting.mjs");
const behavior = read(
  "scripts/control-plane/verify-phase-7b-v1-public-video-read-delivery-behavior.sql",
);

describe("shared Show and Video public route convergence", () => {
  it("makes the shared Show hierarchy the only public Episode route", () => {
    expect(router).toContain('{ path: "/shows"');
    expect(router).toContain('{ path: "/shows/:showSlug"');
    expect(router).toContain('{ path: "/shows/:showSlug/:episodeSlug"');
    expect(router).toContain('{ path: "/video/:slug"');
    expect(router).not.toContain('{ path: "/video/:showSlug/:episodeSlug"');

    expect(routeAudit).toContain('const publicShowIndexPath = "/shows"');
    expect(routeAudit).toContain(
      'routePaths.includes("/video/:showSlug/:episodeSlug")',
    );
  });

  it("keeps /video detail strictly standalone", () => {
    expect(videoDetail).toContain('value.publicationKind !== "standalone"');
    expect(videoDetail).toContain("getPublicVideoPublication(slug, null)");
    expect(videoDetail).toContain('return <Navigate to="/404" replace />');
  });

  it("renders a real shared Show directory and cross-media Episode product", () => {
    expect(lazyPublic).toContain("PublicShowsPage");
    expect(showService).toContain("get_public_show_index");
    expect(showIndex).toContain("Watch and listen to WAKILISHA Shows.");
    expect(showDetail).toContain("Watch latest");
    expect(showDetail).toContain("Listen to latest");
    expect(showEpisode).toContain("PublicVideoWatchingSurface");
    expect(showEpisode).toContain("PublicAudioListeningSurface");
    expect(showEpisode).toContain("Audio edition");
  });

  it("models Audio and Video as optional consumers of one shared Episode", () => {
    expect(showModel).toContain("audio: PublicAudioPublication | null");
    expect(showModel).toContain("video: PublicVideoPublication | null");
    expect(showModel).toContain("(!audio && !video)");
    expect(showModel).toContain(
      "video.canonicalPath !== canonicalPath",
    );
  });

  it("promotes shared Show visibility when a governed Video Episode publishes", () => {
    const migration = convergenceMigration();

    expect(migration).toContain(
      "create or replace function editorial.sync_published_video_episode_shared_visibility",
    );
    expect(migration).toContain(
      "video_episode_shared_visibility_sync",
    );
    expect(migration).toContain(
      "show_episode_resource_id",
    );
    expect(migration).toContain(
      "show_resource_id",
    );
    expect(migration).toContain(
      "visibility = 'public'",
    );
    expect(behavior).toContain(
      "published Video Episode did not promote shared Show hierarchy visibility",
    );
  });

  it("preserves mature Video delivery internally while correcting public identity", () => {
    const migration = convergenceMigration();

    expect(migration).toContain(
      "platform_private.get_public_video_publication_phase_7b",
    );
    expect(migration).toContain(
      "create or replace function public.get_public_video_publication",
    );
    expect(migration).toContain(
      "'/shows/' || v_show_slug || '/' || v_episode_slug",
    );
    expect(migration).toContain(
      "'/video/' || (v_payload ->> 'slug')",
    );
    expect(migration).toContain(
      "create or replace function public.get_public_show_episode",
    );
    expect(migration).toContain(
      "create or replace function public.get_public_show(",
    );
    expect(migration).toContain(
      "create or replace function public.get_public_show_index",
    );
  });

  it("backfills existing governed Video Episode hierarchy without republishing Video", () => {
    const migration = convergenceMigration();

    expect(migration).toContain(
      "resource_row.current_published_version_id",
    );
    expect(migration).toContain(
      "version_row.publication_kind = 'episode'",
    );
    expect(migration).not.toContain(
      "copy_publication_version_snapshot",
    );
    expect(migration).not.toContain(
      "publish_video_publication_version(",
    );
  });
});
