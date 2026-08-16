import {
  describe,
  expect,
  it,
} from "vitest";
import {
  readFileSync,
} from "node:fs";

const migrationPath =
  "supabase/migrations/20260816200500_correct_valle_release_featured_credit.sql";

const sql =
  readFileSync(
    migrationPath,
    "utf8",
  );

describe(
  "Valle Release credit correction",
  () => {
    it(
      "targets Valle through canonical natural authority only",
      () => {
        expect(sql).toContain(
          "release.slug = 'valle-single'",
        );

        expect(sql).toContain(
          "release.title = 'Valle - Single'",
        );

        expect(sql).toContain(
          "release.metadata ->> 'apple_music_album_id' = '6786722212'",
        );

        expect(sql).toContain(
          "release.metadata ->> 'source' = 'apple_music_ingest'",
        );

        expect(sql).toContain(
          "v_release_id",
        );

        expect(sql).not.toMatch(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        );
      },
    );

    it(
      "preserves Matata as the canonical Release primary",
      () => {
        expect(sql).toContain(
          "artist.slug = 'matata'",
        );

        expect(sql).toContain(
          "relationship.artist_slug = 'matata'",
        );

        expect(sql).toContain(
          "relationship.artist_name_text = 'Matata'",
        );

        expect(sql).toContain(
          "relationship.credit_order = 1",
        );

        expect(sql).toContain(
          "relationship.confidence = 90",
        );
      },
    );

    it(
      "changes only the one guarded DJames role and flags",
      () => {
        expect(
          sql.match(
            /update public\.registry_release_artists relationship/g,
          )?.length,
        ).toBe(1);

        expect(sql).toContain(
          "relationship.artist_slug = 'djames'",
        );

        expect(sql).toContain(
          "relationship.artist_name_text = 'DJames'",
        );

        expect(sql).toContain(
          "relationship.artist_id is null",
        );

        expect(sql).toContain(
          "relationship.metadata ->> 'resolved_by' = 'text_only'",
        );

        expect(sql).toContain(
          "role = 'featured_artist'",
        );

        expect(sql).toContain(
          "is_primary = false",
        );

        expect(sql).toContain(
          "is_featured = true",
        );

        expect(sql).toContain(
          "get diagnostics v_updated = row_count",
        );

        expect(sql).toContain(
          "if v_updated <> 1",
        );

        expect(sql).not.toContain(
          "delete from public.registry_release_artists",
        );
      },
    );
  },
);
