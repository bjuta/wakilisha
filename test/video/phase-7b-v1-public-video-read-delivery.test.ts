import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

const migration = read(
  "supabase/migrations/20260831111643_phase_7b_v1_public_video_read_delivery_authority.sql",
);
const verifier = read(
  "scripts/control-plane/verify-phase-7b-v1-public-video-read-delivery.sql",
);
const behavior = read(
  "scripts/control-plane/verify-phase-7b-v1-public-video-read-delivery-behavior.sql",
);
const databaseTypes = read("src/types/database.types.ts");
const edge = read(
  "supabase/functions/video-public-delivery/index.ts",
);
const model = read("src/services/video/videoPublicModel.ts");
const service = read("src/services/video/videoPublicService.ts");
const surface = read(
  "src/components/video/PublicVideoWatchingSurface.tsx",
);
const playbackCanvas = read(
  "src/components/video/VideoPlaybackCanvas.tsx",
);
const indexPage = read("src/pages/video/page.tsx");
const detailPage = read("src/pages/video/detail/page.tsx");
const lazyPublic = read("src/router/lazyPublic.tsx");
const router = read("src/router/config.tsx");

describe("Phase 7B V1 public Video read and delivery", () => {
  it("reads only current public immutable Video versions and public derivatives", () => {
    expect(migration).toContain(
      "create or replace function public.get_public_video_publication",
    );
    expect(migration).toContain(
      "resource_row.current_published_version_id",
    );
    expect(migration).toContain(
      "version_row.version_kind = 'published'",
    );
    expect(migration).toContain(
      "video.assert_publishable_publication_version",
    );
    expect(migration).toContain(
      "variant_row.variant_role = 'video_transcode'",
    );
    expect(migration).toContain(
      "https://media.wakilisha.africa/derivatives/",
    );
    expect(migration).not.toContain(
      "'url', file_row.storage_path",
    );
  });

  it("exposes public readers but keeps protected caption targets service-only", () => {
    expect(migration).toContain(
      "grant execute on function public.get_public_video_publication(text,text)",
    );
    expect(migration).toContain(
      "grant execute on function public.get_public_video_index(integer)",
    );
    expect(migration).toContain(
      "revoke all on function public.get_public_video_caption_delivery_target(uuid,integer)\n  from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.get_public_video_caption_delivery_target(uuid,integer)\n  to service_role;",
    );
    expect(migration).toContain(
      "usage_row.resolution_mode = 'exact_revision'",
    );
    expect(migration).toContain(
      "usage_row.usage_role = 'video_caption'",
    );
  });

  it("keeps a rollback-only anonymous behavior proof", () => {
    expect(behavior).toContain("set local role anon;");
    expect(behavior).toContain("public.get_public_video_publication");
    expect(behavior).toContain("public.get_public_video_index");
    expect(behavior).toContain(
      "PHASE_7B_V1_PUBLIC_VIDEO_READ_DELIVERY_BEHAVIOR_PASS",
    );
    expect(behavior).toContain("rollback;");
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toMatch(/^-- Permanent read-only verifier/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7B_V1_PUBLIC_VIDEO_READ_DELIVERY_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("proxies governed VTT bytes without exposing private storage paths to the browser", () => {
    expect(edge).toContain(
      '"get_public_video_caption_delivery_target"',
    );
    expect(edge).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edge).toContain("MEDIA_PRIVATE_DELIVERY_SECRET");
    expect(edge).toContain(
      "https://media.wakilisha.africa/__private/media-file/",
    );
    expect(edge).toContain(
      '"Content-Type": "text/vtt; charset=utf-8"',
    );
    expect(edge).toContain(
      "`${expires}\\n${storagePath}`",
    );
    expect(edge).toContain('mimeType !== "text/vtt"');
    expect(edge).not.toContain("mediaResponse.headers");
    expect(edge).toContain('"Access-Control-Allow-Origin": "*"');
    expect(service).toContain(
      "/functions/v1/video-public-delivery",
    );
    expect(service).not.toContain("private-files/captions");
    expect(surface).not.toContain("private-files/captions");
  });

  it("renders responsive native Video with governed captions and chapter seeking", () => {
    expect(playbackCanvas).toContain("<video");
    expect(playbackCanvas).toContain("playsInline");
    expect(playbackCanvas).toContain('preload="metadata"');
    expect(playbackCanvas).toContain("<track");
    expect(playbackCanvas).toContain("srcLang={caption.languageTag}");
    expect(playbackCanvas).toContain("captions.find((caption) => caption.isDefault)");
    expect(surface).toContain("publicVideoCaptionUrl");
    expect(surface).toContain("element.currentTime = startSeconds");
    expect(surface).toContain("Publication record");
    expect(model).toContain('"captions" | "subtitles" | "forced_subtitles"');
  });

  it("seals the generated public RPC surface", () => {
    expect(databaseTypes).toContain(
      "get_public_video_caption_delivery_target",
    );
    expect(databaseTypes).toContain("get_public_video_index");
    expect(databaseTypes).toContain("get_public_video_publication");
  });

  it("mounts public Video as a standalone-only route family", () => {
    expect(lazyPublic).toContain("PublicVideoPage");
    expect(lazyPublic).toContain("PublicVideoDetailPage");
    expect(lazyPublic).toContain("PublicShowsPage");
    expect(router).toContain('{ path: "/video"');
    expect(router).toContain('{ path: "/video/:slug"');
    expect(router).not.toContain('{ path: "/video/:showSlug/:episodeSlug"');
    expect(router).toContain('{ path: "/shows"');
    expect(router).toContain('{ path: "/shows/:showSlug"');
    expect(router).toContain('{ path: "/shows/:showSlug/:episodeSlug"');
    expect(indexPage).toContain('url="https://wakilisha.africa/video"');
    expect(detailPage).toContain('value.publicationKind !== "standalone"');
    expect(detailPage).toContain('return <Navigate to="/404" replace />');
  });

  it("preserves the historical V1 mistake while current behavior rejects it", () => {
    expect(migration).toContain(
      "'/video/' || v_show.slug || '/' || v_episode.slug",
    );
    expect(behavior).toContain(
      "'/shows/phase-7b-v1-show/phase-7b-v1-episode'",
    );
    expect(behavior).toContain(
      "episodic Video leaked through standalone /video identity",
    );
  });
});
