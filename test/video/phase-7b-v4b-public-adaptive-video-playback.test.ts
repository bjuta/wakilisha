import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const migrationFile = readdirSync("supabase/migrations")
  .filter((name) =>
    name.endsWith(
      "_phase_7b_v4b_public_adaptive_video_playback.sql",
    ),
  )
  .sort()
  .at(-1);

if (!migrationFile) {
  throw new Error("Phase 7B V4B migration is missing.");
}

const migration = read(
  "supabase/migrations/" + migrationFile,
);
const verifier = read(
  "scripts/control-plane/verify-phase-7b-v4b-public-adaptive-video-playback.sql",
);
const design = read(
  "docs/engineering/phase-7b-v4b-public-adaptive-video-playback.md",
);
const model = read(
  "src/services/video/videoPublicModel.ts",
);
const service = read(
  "src/services/video/videoPublicService.ts",
);
const watching = read(
  "src/components/video/PublicVideoWatchingSurface.tsx",
);
const canvas = read(
  "src/components/video/VideoPlaybackCanvas.tsx",
);
const packageJson = read("package.json");

describe(
  "Phase 7B V4B public adaptive Video playback",
  () => {
    it(
      "extends the canonical public reader without replacing MP4 delivery",
      () => {
        expect(migration).toContain(
          "create or replace function public.get_public_video_publication",
        );
        expect(migration).toContain(
          "'delivery', v_delivery",
        );
        expect(migration).toContain(
          "'adaptive_delivery', v_adaptive_delivery",
        );
        expect(migration).toContain(
          "variant_row.variant_role = 'video_transcode'",
        );
        expect(migration).toContain(
          "if v_delivery is null then",
        );
        expect(migration).not.toContain(
          "create or replace function public.get_public_video_index",
        );
      },
    );

    it(
      "resolves HLS only from the complete selected V4A package",
      () => {
        expect(migration).toContain(
          "from media.variant_selections selection_row",
        );
        expect(migration).toContain(
          "source_revision.original_file_object_id",
        );
        expect(migration).toContain(
          "variant_row.generator_version =",
        );
        expect(migration).toContain(
          "'phase7b-v4a-v1'",
        );
        expect(migration).toContain(
          "'video-adaptive-v1'",
        );
        expect(migration).toContain(
          "having count(*) = 5",
        );

        for (const role of [
          "video_hls_master",
          "video_hls_360p_playlist",
          "video_hls_360p_media",
          "video_hls_720p_playlist",
          "video_hls_720p_media",
        ]) {
          expect(migration).toContain(role);
          expect(verifier).toContain(role);
        }
      },
    );

    it(
      "keeps adaptive delivery optional in the existing public model",
      () => {
        expect(model).toContain(
          "export interface PublicVideoAdaptiveDelivery",
        );
        expect(model).toContain(
          'kind: "hls"',
        );
        expect(model).toContain(
          'mimeType: "application/vnd.apple.mpegurl"',
        );
        expect(model).toContain(
          'profileVersion: "video-adaptive-v1"',
        );
        expect(model).toContain(
          "adaptiveDelivery: PublicVideoAdaptiveDelivery | null",
        );
        expect(model).toContain(
          "decodeAdaptiveDelivery(input.adaptive_delivery)",
        );
        expect(service).not.toContain(
          "get_public_video_adaptive",
        );
      },
    );

    it(
      "keeps one canonical playback canvas with MP4 fallback",
      () => {
        expect(watching).toContain(
          "adaptiveUrl: publication.adaptiveDelivery?.url || null",
        );
        expect(watching).toContain(
          "adaptiveMimeType:",
        );
        expect(canvas).toContain(
          'adaptiveUrl?: string | null',
        );
        expect(canvas).toContain(
          'adaptiveMimeType?: string | null',
        );
        expect(canvas).toContain(
          'element.canPlayType(adaptiveMimeType)',
        );
        expect(canvas).toContain(
          'void import("hls.js")',
        );
        expect(canvas).toContain(
          "Hls.isSupported()",
        );
        expect(canvas).toContain(
          "hls.loadSource(adaptiveUrl)",
        );
        expect(canvas).toContain(
          "hls.attachMedia(element)",
        );
        expect(canvas).toContain(
          "if (data.fatal)",
        );
        expect(canvas).toContain(
          "fallbackToMp4()",
        );
        expect(canvas).toContain(
          "element.src = source.url",
        );
        expect(canvas).toContain(
          'data-wk-video-delivery={deliveryMode}',
        );
        expect(canvas).toContain(
          "document.fullscreenEnabled",
        );
        expect(canvas).toContain(
          "webkitRequestFullscreen",
        );
        expect(canvas).toContain(
          "webkitEnterFullscreen",
        );
        expect(canvas).toContain(
          "webkitbeginfullscreen",
        );
        expect(canvas).toContain(
          "webkitendfullscreen",
        );
        expect(canvas).not.toContain(
          "export function AdaptiveVideoPlayer",
        );
      },
    );

    it(
      "preserves captions and the shared HTMLVideoElement chapter target",
      () => {
        expect(canvas).toContain("<track");
        expect(canvas).toContain(
          "syncCaptionTracks",
        );
        expect(canvas).toContain(
          "activeCueLines",
        );
        expect(watching).toContain(
          "const videoRef = useRef<HTMLVideoElement>(null)",
        );
        expect(watching).toContain(
          "element.currentTime = startSeconds",
        );
        expect(watching).toContain(
          "videoRef={videoRef}",
        );
      },
    );

    it(
      "pins the bounded HLS client and keeps it out of ordinary startup",
      () => {
        expect(packageJson).toContain(
          '"hls.js": "1.7.1"',
        );
        expect(canvas).not.toMatch(
          /^import Hls from "hls\.js";/m,
        );
        expect(canvas).toContain(
          'void import("hls.js")',
        );
      },
    );

    it(
      "keeps the permanent verifier read-only",
      () => {
        const lower = verifier.toLowerCase();
        expect(verifier).toContain(
          "set local transaction read only;",
        );
        expect(verifier).toContain(
          "PASS: Phase 7B V4B public adaptive Video read authority is intact.",
        );

        for (const forbidden of [
          "insert into ",
          "update ",
          "delete from ",
          "alter table ",
          "drop table ",
          "create table ",
          "create or replace function ",
        ]) {
          expect(lower).not.toContain(forbidden);
        }
      },
    );

    it(
      "does not add public copy punctuation or new transcript/correction scope",
      () => {
        for (const source of [canvas, watching]) {
          expect(source).not.toContain("—");
          expect(source).not.toContain(" -- ");
        }
        expect(design).toContain(
          "- add transcript presentation",
        );
        expect(design).toContain(
          "- add Video correction UI/history",
        );
      },
    );
  },
);
