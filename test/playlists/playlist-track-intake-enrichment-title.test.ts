import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

const intake =
  readFileSync(
    "src/pages/admin/registry/tracks/intake/page.tsx",
    "utf8",
  );

const m228 =
  readFileSync(
    "supabase/migrations/20260810022500_phase_5b_top50_track_canonicalization.sql",
    "utf8",
  );

describe(
  "Track Intake enriched title authority",
  () => {
    it(
      "records provider inspection title as evidence",
      () => {
        expect(intake)
          .toContain(
            "const inspectionFields = {",
          );

        expect(intake)
          .toContain(
            "? { title: inspection.title.trim() }",
          );

        expect(intake)
          .toContain(
            "p_fields: inspectionFields,",
          );
      },
    );

    it(
      "allows provider title to become accepted enrichment",
      () => {
        expect(intake)
          .toContain(
            'const enrichmentFieldOrder = [\n  "title",\n  "isrc",',
          );

        expect(m228)
          .toContain(
            "v_allowed constant text[] := array[\n    'title',",
          );
      },
    );

    it(
      "creates new canonical tracks from the accepted enriched title",
      () => {
        expect(m228)
          .toContain(
            "v_row.suggestion_id,\n        v_approved_title,",
          );

        expect(m228)
          .not.toContain(
            "v_row.suggestion_id,\n        v_row.article_title,",
          );
      },
    );

    it(
      "requires all fifty Playlist titles to equal accepted enrichment",
      () => {
        expect(m228)
          .toContain(
            "Expected all 50 Playlist items materialized with accepted enriched titles.",
          );

        expect(m228)
          .toContain(
            "v_title_decisions <> 50",
          );
      },
    );
  },
);
