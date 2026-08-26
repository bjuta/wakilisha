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
        "_phase_6a_m3_audio_review_publication_identity.sql",
      ),
    )
    .sort()
    .at(-1);

if (!migrationFile) {
  throw new Error(
    "Phase 6A M3 Audio Review migration is missing.",
  );
}

const migration = readFileSync(
  `supabase/migrations/${migrationFile}`,
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m3-audio-review-publication-identity.sql",
  "utf8",
);

const design = readFileSync(
  "docs/engineering/phase-6a-m3-audio-review-publication-identity.md",
  "utf8",
);

describe(
  "Phase 6A M3 Audio Review and publication identity",
  () => {
    it("adds typed append-only Audio Review authority", () => {
      expect(migration).toContain(
        "create table audio.publication_review_events",
      );
      expect(migration).toContain(
        "audio_publication_review_events_append_only",
      );
      expect(migration).toContain(
        "'audio.publication.review.submit'",
      );
      expect(migration).toContain(
        "'audio.publication.review.decide'",
      );
      expect(migration).toContain(
        "public.submit_audio_publication_for_review",
      );
      expect(migration).toContain(
        "public.review_audio_publication",
      );
    });

    it("publishes only the exact approved immutable version", () => {
      expect(migration).toContain(
        "public.publish_audio_publication_version",
      );
      expect(migration).toContain(
        "current_approved_version_id",
      );
      expect(migration).toContain(
        "audio.copy_publication_version_snapshot",
      );
      expect(migration).toContain(
        "version_kind = 'approved'",
      );
      expect(migration).toContain(
        "version_kind = 'published'",
      );
    });

    it("requires exact full-length Media and current public-safety approval", () => {
      expect(migration).toContain(
        "audio.assert_publishable_version_media",
      );
      expect(migration).toContain("'audio_delivery'");
      expect(migration).toContain("'audio/mpeg'");
      expect(migration).toContain("'approved_public'");
      expect(migration).toContain("'approved_redacted'");
      expect(migration).toContain("'granted'");
      expect(migration).toContain("'not_required'");
      expect(migration).toContain("'released'");
    });

    it("separates lifecycle state from cultural content fingerprints", () => {
      const fingerprintStart = migration.indexOf(
        "create or replace function audio.publication_content_fingerprint",
      );
      const nextFunction = migration.indexOf(
        "create or replace function audio.normalize_publication_status_after_content_change",
        fingerprintStart,
      );
      const fingerprint = migration.slice(
        fingerprintStart,
        nextFunction,
      );

      expect(fingerprint).not.toContain("'status'");
      expect(fingerprint).toContain("'master_media_asset_id'");
      expect(fingerprint).toContain("'master_media_revision_id'");
      expect(fingerprint).toContain("'audio_delivery_variant_id'");
      expect(migration).toContain(
        "audio_submitted_version_stale",
      );
    });

    it("establishes stable RSS GUID and enclosure identity without building RSS delivery", () => {
      expect(migration).toContain(
        "create table audio.publication_feed_identities",
      );
      expect(migration).toContain("'urn:uuid:'");
      expect(migration).toContain(
        "https://wakilisha.africa/audio/enclosures/",
      );
      expect(migration).toContain(
        "create table audio.publication_snapshots",
      );
      expect(migration).toContain(
        "https://media.wakilisha.africa/derivatives/",
      );
      expect(design).toContain(
        "M3 defines the feed identity contract; Phase 6B delivers the public RSS/feed route.",
      );
      expect(migration).not.toContain("create table audio.rss_feeds");
    });

    it("preserves the M3 migration boundary while accepting K1 shared lifecycle authority", () => {
      const genericPointerWrite =
        /update\s+editorial\.resources[\s\S]{0,800}current_(?:working|submitted|approved|published)_version_id\s*=/i;

      expect(genericPointerWrite.test(migration)).toBe(false);
      expect(verifier).toContain(
        "Audio Resource lifecycle pointer compatibility mismatch",
      );
    });

    it("keeps M3 out of public routes, player, transcript, chapter, and Trust UI work", () => {
      expect(design).toContain("M3 does not:");
      expect(design).toContain("- build the Audio Editor");
      expect(design).toContain("- build public Audio routes");
      expect(design).toContain("- attach Chapters or Transcripts");
      expect(design).toContain("- add Audio Trust mutation adapters");
      expect(design).toContain("- alter the global player");
    });

    it("keeps the permanent verifier read-only", () => {
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
        "PASS: Phase 6A M3 Audio Review, exact publication, stable GUID, and enclosure identity verified.",
      );
    });
  },
);
