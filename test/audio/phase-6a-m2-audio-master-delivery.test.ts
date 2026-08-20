import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationFile =
  readdirSync("supabase/migrations")
    .filter((name) =>
      name.endsWith(
        "_phase_6a_m2_audio_master_delivery_foundation.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 6A M2 Audio migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const worker = readFileSync(
  "ops/media-processor/worker.py",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m2-audio-master-delivery.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-6a-m2-audio-master-delivery-foundation.md",
  "utf8",
);

describe(
  "Phase 6A M2 Audio master and delivery foundation",
  () => {
    it(
      "keeps accepted audio-v1 authority unchanged and adds a new profile",
      () => {
        expect(migration)
          .not.toContain(
            "create or replace function public.submit_media_processing_command_v1",
          );
        expect(migration)
          .not.toContain(
            "create or replace function public.register_media_processing_outputs_v1",
          );
        expect(design)
          .toContain("Preserve `audio-v1`");
        expect(worker)
          .toContain(
            'if profile == "audio-publication-v1":',
          );
        expect(worker)
          .toContain('"audio_delivery"');
      },
    );

    it(
      "keeps the old preview capped while the new delivery producer is full length",
      () => {
        const previewStart =
          worker.indexOf("def audio_preview(");
        const deliveryStart =
          worker.indexOf("def audio_delivery(");
        const waveformStart =
          worker.indexOf("def waveform_data(");

        expect(previewStart).toBeGreaterThan(-1);
        expect(deliveryStart).toBeGreaterThan(previewStart);
        expect(waveformStart).toBeGreaterThan(deliveryStart);

        const preview = worker.slice(
          previewStart,
          deliveryStart,
        );
        const delivery = worker.slice(
          deliveryStart,
          waveformStart,
        );

        expect(preview).toContain('"-t",');
        expect(preview).toContain('"30",');
        expect(delivery).not.toContain('"-t",');
        expect(delivery).toContain('"128k",');
      },
    );

    it(
      "adds exact Audio master usage without broadening generic Media attachment",
      () => {
        expect(migration)
          .toContain("'audio_master'");
        expect(migration)
          .toContain(
            "public.set_audio_publication_master",
          );
        expect(migration)
          .toContain("'exact_revision'");
        expect(migration)
          .toContain("'^masters/audio/'");
        expect(migration)
          .toContain(
            "guard_audio_master_usage_mutation",
          );
        expect(migration)
          .not.toContain(
            "create or replace function media.validate_usage_target",
          );
        expect(migration)
          .not.toContain(
            "create or replace function public.attach_media_usage",
          );
      },
    );

    it(
      "freezes exact master and delivery identity into immutable Audio versions",
      () => {
        for (const field of [
          "master_media_asset_id",
          "master_media_revision_id",
          "audio_delivery_variant_id",
        ]) {
          expect(migration).toContain(field);
          expect(verifier).toContain(field);
        }

        expect(migration)
          .toContain(
            "audio.current_publication_master",
          );
        expect(migration)
          .toContain(
            "audio.publication_content_fingerprint",
          );
        expect(migration)
          .toContain(
            "audio.insert_current_publication_snapshot",
          );
      },
    );

    it(
      "reuses the accepted Media durable job authority for full-length delivery",
      () => {
        expect(migration)
          .toContain(
            "public.submit_audio_delivery_processing_v1",
          );
        expect(migration)
          .toContain(
            "public.register_audio_delivery_processing_outputs_v1",
          );
        expect(migration)
          .toContain("'media.process_revision'");
        expect(migration)
          .toContain("'media.processing.accepted'");
        expect(migration)
          .not.toContain(
            "create table audio.processing_jobs",
          );
        expect(migration)
          .not.toContain(
            "create table media.audio_processing_jobs",
          );
      },
    );

    it(
      "keeps full-length output exact, immutable, and CDN-backed",
      () => {
        expect(migration)
          .toContain("'audio_delivery'");
        expect(migration)
          .toContain("'audio-publication-v1'");
        expect(migration)
          .toContain("'audio/mpeg'");
        expect(migration)
          .toContain("'audio_delivery.mp3'");
        expect(migration)
          .toContain(
            "https://media.wakilisha.africa/derivatives/",
          );
        expect(worker)
          .toContain(
            'AUDIO_PUBLICATION_PROFILE_GENERATOR_VERSION',
          );
      },
    );

    it(
      "keeps M2 out of Review, RSS, public Audio, and player work",
      () => {
        expect(design)
          .toContain("M2 does not:");
        expect(design)
          .toContain("- create Audio Review or publication commands");
        expect(design)
          .toContain("- create RSS");
        expect(design)
          .toContain("- alter the global player");
        expect(design)
          .toContain("- build the Audio Editor");

        expect(migration)
          .not.toContain("rss_guid");
        expect(migration)
          .not.toContain("publish_audio_version");
        expect(migration)
          .not.toContain("audio_chapters");
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

        expect(verifier)
          .toContain(
            "PASS: Phase 6A M2 Audio master and full-length delivery authority is intact.",
          );
      },
    );
  },
);
