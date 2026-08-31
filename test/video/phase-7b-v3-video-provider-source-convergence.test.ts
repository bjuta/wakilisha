import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

const migration = read(
  "supabase/migrations/20260831173500_phase_7b_v3_video_provider_source_convergence.sql",
);
const verifier = read(
  "scripts/control-plane/verify-phase-7b-v3-video-provider-source-convergence.sql",
);
const providerSource = read("src/components/video/providerSource.ts");
const types = read("src/components/video/types.ts");
const canvas = read("src/components/video/VideoPlaybackCanvas.tsx");
const overlay = read("src/components/video/VideoOverlay.tsx");
const playerState = read("src/components/video/useVideoPlayer.ts");
const artistVideos = read(
  "src/pages/artists/detail/components/ArtistVideos.tsx",
);
const desktopArticle = read("src/pages/magazine/article/page.tsx");
const mobileArticle = read("src/pages/mobile/magazine/article/page.tsx");
const publicContent = read("supabase/functions/public-content-read/index.ts");
const publicContentSpec = read("src/data/api-specs/public-content-read.ts");
const publicContentOpenApi = read("docs/openapi/public-content-read.yaml");

describe("Phase 7B V3 Video provider source convergence", () => {
  it("backfills immutable YouTube source identity without rewriting legacy content", () => {
    expect(migration).toContain("insert into video.sources");
    expect(migration).toContain("'external_provider'");
    expect(migration).toContain("'youtube'");
    expect(migration).toContain(
      "'https://www.youtube.com/watch?v=' || source.provider_object_id",
    );
    expect(migration).toContain(
      "on conflict (provider_key, provider_object_id)",
    );
    expect(migration).toContain("editorial.article_versions");
    expect(migration).toContain("artist.metadata -> 'youtube_videos'");
    expect(migration).not.toContain("update editorial.article_versions");
    expect(migration).not.toContain("update public.registry_artists");
    expect(migration).not.toContain("670");
  });

  it("keeps SQL provider evidence regexes replay-safe", () => {
    for (const source of [migration, verifier]) {
      expect(source).toContain("youtube\\.com/watch\\?");
      expect(source).toContain("youtube(?:-nocookie)?\\.com/embed/");
      expect(source).toContain("youtube\\.com/shorts/");
      expect(source).toContain("youtu\\.be/");
      expect(source).not.toContain("youtube\\\\.com");
      expect(source).not.toContain("watch\\\\?");
      expect(source).not.toContain("youtu\\\\.be");
    }
  });

  it("keeps provider resolution server-owned and service-role-only", () => {
    expect(migration).toContain(
      "public.resolve_video_provider_sources_for_service",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(verifier).toContain("has_function_privilege");
    expect(verifier).toContain("service_role");
    expect(verifier).toContain("v_missing_ids");
  });

  it("centralizes provider URL normalization and iframe construction", () => {
    expect(providerSource).toContain("parseLegacyProviderUrl");
    expect(providerSource).toContain("providerEmbedUrl");
    expect(providerSource).toContain("providerObjectId");
    expect(providerSource).toContain("youtube.com/embed");
    expect(providerSource).toContain("player.vimeo.com/video");
    expect(types).toContain("providerObjectId");
    expect(types).toContain("canonicalSources");
    expect(canvas).toContain("providerEmbedUrl(source)");
    expect(canvas).toContain("data-wk-video-source-id");
    expect(canvas).not.toContain("embedUrl: string");
    expect(overlay).not.toContain("embedUrl:");
    expect(overlay).toContain("providerObjectId: video.providerObjectId");
  });

  it("makes Articles consume canonical provider descriptors without rewriting HTML", () => {
    expect(publicContent).toContain(
      "resolve_video_provider_sources_for_service",
    );
    expect(publicContent).toContain("videoSources: publishedVideoSources");
    expect(desktopArticle).toContain("article?.videoSources ?? []");
    expect(mobileArticle).toContain("article?.videoSources ?? []");
    expect(types).toContain("sourceByKey.get(providerSourceKey(legacySource))");
  });

  it("makes Artist Video playback use source identity while preserving the established UX", () => {
    expect(publicContent).toContain("video.sourceId = source.sourceId");
    expect(artistVideos).toContain("videoSourceId");
    expect(artistVideos).toContain("providerObjectId");
    expect(artistVideos).toContain("<VideoCard");
    expect(artistVideos).toContain("<VideoOverlay");
    expect(overlay).toContain('mode === "pip"');
    expect(overlay).toContain('mode === "lightbox"');
  });

  it("documents canonical provider identity in the public read contract", () => {
    for (const source of [publicContentSpec, publicContentOpenApi]) {
      expect(source).toContain("sourceId");
      expect(source).toContain("providerKey");
      expect(source).toContain("providerObjectId");
      expect(source).toContain("canonicalUrl");
    }
  });

  it("records playback analytics against source and provider identity", () => {
    expect(playerState).toContain("videoSourceId");
    expect(playerState).toContain("providerObjectId");
    expect(playerState).toContain("canonicalUrl");
    expect(playerState).not.toContain("videoUrl:");
  });

  it("keeps changed public Video copy free of forbidden dash punctuation", () => {
    for (const source of [
      providerSource,
      types,
      canvas,
      overlay,
      artistVideos,
    ]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain(" -- ");
    }
  });
});
