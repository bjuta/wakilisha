import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationFile = readdirSync(
  "supabase/migrations",
)
  .filter((name) =>
    name.endsWith(
      "_phase_7b_v4a_adaptive_video_media_foundation.sql",
    ),
  )
  .sort()
  .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 7B V4A adaptive Video migration is missing.",
  );
}

const migration = readFileSync(
  "supabase/migrations/" + migrationFile,
  "utf8",
);

const worker = readFileSync(
  "ops/media-processor/worker.py",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-7b-v4a-adaptive-video-media.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-7b-v4a-adaptive-video-media-foundation.md",
  "utf8",
);

describe(
  "Phase 7B V4A adaptive Video Media foundation",
  () => {
    it(
      "preserves accepted video-v1 and adds an additive adaptive profile",
      () => {
        expect(migration).not.toContain(
          "create or replace function public.submit_media_processing_command_v1",
        );
        expect(migration).not.toContain(
          "create or replace function public.register_media_processing_outputs_v1",
        );
        expect(design).toContain("Preserve");
        expect(worker).toContain(
          "if profile == \"video-v1\":",
        );
        expect(worker).toContain(
          "if profile == \"video-adaptive-v1\":",
        );
        expect(worker).toContain(
          "VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION = \"phase7b-v4a-v1\"",
        );
      },
    );

    it(
      "reuses the accepted Media durable job and registration authorities",
      () => {
        expect(migration).toContain(
          "public.submit_video_adaptive_processing_v1",
        );
        expect(migration).toContain(
          "public.register_video_adaptive_processing_outputs_v1",
        );
        expect(migration).toContain(
          "'media.process_revision'",
        );
        expect(migration).toContain(
          "'media.processing.accepted'",
        );
        expect(migration).toContain(
          "media.insert_verified_file_object_v2",
        );
        expect(migration).toContain(
          "media.variant_selections",
        );
        expect(migration).not.toMatch(
          /create table\s+(media|video)\.(processing|streaming)/i,
        );
      },
    );

    it(
      "requires one exact five-file single-file-byte-range HLS package",
      () => {
        for (const role of [
          "video_hls_master",
          "video_hls_360p_playlist",
          "video_hls_360p_media",
          "video_hls_720p_playlist",
          "video_hls_720p_media",
        ]) {
          expect(migration).toContain(role);
          expect(worker).toContain(role);
          expect(verifier).toContain(role);
        }

        expect(migration).toContain(
          "jsonb_array_length(p_outputs) <> 5",
        );
        expect(migration).toContain(
          "single_file_byte_range",
        );
        expect(worker).toContain(
          "independent_segments+single_file",
        );
        expect(worker).toContain(
          "\"#EXT-X-BYTERANGE:\"",
        );
        expect(worker).toContain(
          "\"#EXT-X-VERSION:6\"",
        );
      },
    );

    it(
      "keeps adaptive rendition bytes retry-safe",
      () => {
        expect(worker).toContain("\"-threads\",");
        expect(worker).toContain("\"1\",");
        expect(worker).toContain("\"-fflags\",");
        expect(worker).toContain("\"+bitexact\",");
        expect(worker).toContain("\"-flags:v\",");
        expect(worker).toContain("\"-flags:a\",");
        expect(worker).toContain("\"-muxdelay\",");
        expect(worker).toContain("\"-muxpreload\",");
        expect(worker).toContain(
          "\"expr:gte(t,n_forced*4)\"",
        );
        expect(worker).toContain(
          "Adaptive Video HLS playlist leaked a staging filename.",
        );
        expect(design).toContain(
          "fails closed",
        );
      },
    );

    it(
      "routes only the new profile through its additive registration adapter",
      () => {
        expect(worker).toContain(
          "\"register_video_adaptive_processing_outputs_v1\"",
        );
        expect(worker).toContain(
          "elif profile == \"video-adaptive-v1\":",
        );
        expect(worker).toContain(
          "\"register_audio_delivery_processing_outputs_v1\"",
        );
        expect(worker).toContain(
          "\"register_media_processing_outputs_v1\"",
        );
      },
    );

    it(
      "requires exact version-bound Video master authority before submission",
      () => {
        expect(migration).toContain(
          "usage.target_authority = 'video'",
        );
        expect(migration).toContain(
          "usage.target_kind = 'video_publication'",
        );
        expect(migration).toContain(
          "usage.target_version_kind = 'video_publication_version'",
        );
        expect(migration).toContain(
          "usage.usage_role = 'video_master'",
        );
        expect(migration).toContain(
          "usage.resolution_mode = 'exact_revision'",
        );
        expect(migration).toContain(
          "'^masters/video/'",
        );
      },
    );

    it(
      "keeps V4A out of public playback, transcript, and correction scope",
      () => {
        expect(design).toContain(
          "- change the public Video read model",
        );
        expect(design).toContain(
          "- add",
        );
        expect(design).toContain(
          "- make HLS the public playback source",
        );
        expect(design).toContain(
          "- add or manufacture a transcript",
        );
        expect(design).toContain(
          "- add Video correction submission or correction history",
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
          "PASS: Phase 7B V4A adaptive Video Media processing authority is intact.",
        );
      },
    );
  },
);
