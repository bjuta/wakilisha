import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const migration = read(
  "supabase/migrations/20260903060000_phase_7b_v4c_governed_video_quality_selection.sql",
);
const verifier = read(
  "scripts/control-plane/verify-phase-7b-v4c-governed-video-quality-selection.sql",
);
const model = read(
  "src/services/video/videoPublicModel.ts",
);
const watching = read(
  "src/components/video/PublicVideoWatchingSurface.tsx",
);
const canvas = read(
  "src/components/video/VideoPlaybackCanvas.tsx",
);

describe(
  "Phase 7B V4C governed Video quality selection",
  () => {
    it(
      "publishes only governed selected rendition playlists",
      () => {
        expect(migration).toContain(
          "'renditions', jsonb_build_array",
        );
        expect(migration).toContain(
          "'video_hls_360p_playlist'",
        );
        expect(migration).toContain(
          "'video_hls_720p_playlist'",
        );
        expect(migration).toContain(
          "'height', 360",
        );
        expect(migration).toContain(
          "'height', 720",
        );
        expect(migration).toContain(
          "source_revision.original_file_object_id",
        );
        expect(migration).toContain(
          "'phase7b-v4a-v1'",
        );
        expect(migration).toContain(
          "'video-adaptive-v1'",
        );
        expect(migration).not.toContain(
          "video_hls_1080p_playlist",
        );
      },
    );

    it(
      "keeps the public model generic for future governed renditions",
      () => {
        expect(model).toContain(
          "export interface PublicVideoAdaptiveRendition",
        );
        expect(model).toContain(
          "height: number",
        );
        expect(model).toContain(
          "renditions: PublicVideoAdaptiveRendition[]",
        );
        expect(model).toContain(
          "decodeAdaptiveRendition",
        );
        expect(model).toContain(
          "renditions.length !== renditionCount",
        );
      },
    );

    it(
      "passes governed rendition URLs into the canonical Video player",
      () => {
        expect(watching).toContain(
          "adaptiveRenditions:",
        );
        expect(watching).toContain(
          "publication.adaptiveDelivery?.renditions.map",
        );
        expect(canvas).toContain(
          "adaptiveRenditions?: VideoPlaybackRendition[]",
        );
        expect(canvas).not.toContain(
          "video_hls_360p_playlist",
        );
        expect(canvas).not.toContain(
          "video_hls_720p_playlist",
        );
      },
    );

    it(
      "offers Auto plus only delivered resolution choices",
      () => {
        expect(canvas).toContain(
          'useState<"auto" | number>',
        );
        expect(canvas).toContain(
          "<span>Auto</span>",
        );
        expect(canvas).toContain(
          "adaptiveRenditions.map",
        );
        expect(canvas).toContain(
          "selectQuality(rendition.height)",
        );
        expect(canvas).toContain(
          "data-wk-video-quality",
        );
        expect(canvas).not.toContain(
          "<span>1080p</span>",
        );
        expect(canvas).not.toContain(
          "<span>4K</span>",
        );
      },
    );

    it(
      "preserves playback state while switching HLS sources",
      () => {
        expect(canvas).toContain(
          "qualityResumeRef",
        );
        expect(canvas).toContain(
          "time: Number.isFinite(element.currentTime)",
        );
        expect(canvas).toContain(
          "shouldPlay: !element.paused",
        );
        expect(canvas).toContain(
          "playbackRate: element.playbackRate",
        );
        expect(canvas).toContain(
          "muted: element.muted",
        );
        expect(canvas).toContain(
          "syncCaptionTracks()",
        );
        expect(canvas).toContain(
          '"loadedmetadata"',
        );
      },
    );

    it(
      "keeps Auto on the HLS master and manual quality on child playlists",
      () => {
        expect(canvas).toContain(
          'selectedQuality === "auto"',
        );
        expect(canvas).toContain(
          "selectedRendition?.url",
        );
        expect(canvas).toContain(
          "|| source.adaptiveUrl",
        );
        expect(canvas).toContain(
          'void import("hls.js")',
        );
        expect(canvas).toContain(
          "element.canPlayType(adaptiveMimeType)",
        );
        expect(canvas).toContain(
          "fallbackToMp4()",
        );
      },
    );

    it(
      "keeps the verifier permanent and read-only",
      () => {
        const lower = verifier.toLowerCase();
        expect(verifier).toContain(
          "set local transaction read only;",
        );
        expect(verifier).toContain(
          "PASS: Phase 7B V4C governed Video quality selection authority is intact.",
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
      "keeps settings compact through hierarchical drill-down",
      () => {
        expect(canvas).toContain(
          'type SettingsPanel = "root" | "quality" | "captions" | "speed"',
        );
        expect(canvas).toContain(
          'data-wk-video-settings-panel={settingsPanel}',
        );
        expect(canvas).toContain(
          'settingsPanel === "root"',
        );
        expect(canvas).toContain(
          'settingsPanel === "quality"',
        );
        expect(canvas).toContain(
          'settingsPanel === "captions"',
        );
        expect(canvas).toContain(
          'settingsPanel === "speed"',
        );
        expect(canvas).toContain(
          'max-h-[min(20rem,46svh)]',
        );
        expect(canvas).toContain(
          'sm:w-[18rem]',
        );
        expect(canvas).toContain(
          'aria-label="Back to video settings"',
        );
      },
    );

    it(
      "adds no forbidden public copy punctuation",
      () => {
        for (const source of [canvas, watching]) {
          expect(source).not.toContain("—");
          expect(source).not.toContain(" -- ");
        }
      },
    );
  },
);
