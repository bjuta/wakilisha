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
    "Phase 7B V4A migration is missing.",
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
  "Phase 7B V4A Media processing-profile convergence",
  () => {
    it(
      "promotes one canonical shared Media processing-profile authority",
      () => {
        expect(migration).toContain(
          "create table media.processing_profiles",
        );
        expect(migration).toContain(
          "create table media.processing_profile_outputs",
        );
        expect(migration).toContain(
          "public.submit_media_processing_profile_v1",
        );
        expect(migration).toContain(
          "public.register_media_processing_profile_outputs_v1",
        );
        expect(design).toContain(
          "Candidate promoted to canonical authority",
        );
        expect(design).toContain(
          "Audio is the first proven consumer.",
        );
        expect(design).toContain(
          "Adaptive Video is the second proven consumer.",
        );
      },
    );

    it(
      "does not create Video-specific processing authority",
      () => {
        expect(migration).not.toMatch(
          /create or replace function\s+public\.submit_video_adaptive_processing_v1/i,
        );
        expect(migration).not.toMatch(
          /create or replace function\s+public\.register_video_adaptive_processing_outputs_v1/i,
        );
        expect(worker).not.toContain(
          "register_video_adaptive_processing_outputs_v1",
        );
        expect(verifier).toContain(
          "competing Video-specific processing authority exists",
        );
      },
    );

    it(
      "migrates Audio candidate authority into compatibility wrappers",
      () => {
        expect(migration).toMatch(
          /create or replace function[\s\S]+public\.submit_audio_delivery_processing_v1[\s\S]+submit_media_processing_profile_v1/i,
        );
        expect(migration).toMatch(
          /create or replace function[\s\S]+public\.register_audio_delivery_processing_outputs_v1[\s\S]+register_media_processing_profile_outputs_v1/i,
        );
        expect(worker).not.toContain(
          "register_audio_delivery_processing_outputs_v1",
        );
        expect(design).toContain(
          "Existing candidate migrated",
        );
      },
    );

    it(
      "preserves accepted Phase 4 base processing functions",
      () => {
        expect(migration).not.toMatch(
          /create or replace function\s+public\.submit_media_processing_command_v1/i,
        );
        expect(migration).not.toMatch(
          /create or replace function\s+public\.register_media_processing_outputs_v1/i,
        );
        expect(worker).toContain(
          "if profile == \"video-v1\":",
        );
        expect(worker).toContain(
          "if profile == \"audio-v1\":",
        );
      },
    );

    it(
      "routes both proven additive profiles through the shared registration primitive",
      () => {
        expect(worker).toContain(
          "\"audio-publication-v1\",",
        );
        expect(worker).toContain(
          "\"video-adaptive-v1\",",
        );
        expect(worker).toContain(
          "\"register_media_processing_profile_outputs_v1\"",
        );
        expect(worker).toContain(
          "\"register_media_processing_outputs_v1\"",
        );
      },
    );

    it(
      "registers exact Audio and adaptive Video profile contracts",
      () => {
        expect(migration).toContain(
          "'audio-publication-v1'",
        );
        expect(migration).toContain(
          "'audio_delivery'",
        );
        expect(migration).toContain(
          "'video-adaptive-v1'",
        );

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
      },
    );

    it(
      "keeps the adaptive package single-file, bounded, and retry-safe",
      () => {
        expect(worker).toContain(
          "independent_segments+single_file",
        );
        expect(worker).toContain(
          "\"#EXT-X-BYTERANGE:\"",
        );
        expect(worker).toContain(
          "\"#EXT-X-VERSION:6\"",
        );
        expect(worker).toContain(
          "\"expr:gte(t,n_forced*4)\"",
        );
        expect(worker).toContain(
          "\"-threads\",",
        );
        expect(worker).toContain(
          "\"+bitexact\",",
        );
        expect(worker).toContain(
          "Adaptive Video HLS playlist leaked a staging filename.",
        );
      },
    );

    it(
      "keeps domain transforms distinct while sharing authority semantics",
      () => {
        expect(design).toContain(
          "Intentionally domain-specific implementation",
        );
        expect(design).toContain(
          "Compounding requires one meaning for the shared processing authority",
        );
        expect(design).toContain(
          "it does not require flattening distinct transforms",
        );
      },
    );

    it(
      "keeps V4A out of public playback, transcript, and correction scope",
      () => {
        expect(design).toContain(
          "does **not** change the public Video read model or player",
        );
        expect(design).toContain(
          "- add or manufacture a transcript",
        );
        expect(design).toContain(
          "- add Video correction submission/history",
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
          "PASS: Phase 7B V4A canonical Media processing-profile and adaptive Video authority is intact.",
        );
      },
    );
  },
);
