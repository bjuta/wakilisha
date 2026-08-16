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
      "targets only the exact bad DJames relationship",
      () => {
        expect(
          sql.match(
            /update public\.registry_release_artists/g,
          )?.length,
        ).toBe(1);

        expect(sql).toContain(
          "f2e5cf04-5a55-4c6d-94ef-fbe1b3d03660",
        );

        expect(sql).toContain(
          "03099a3e-866f-4f32-b355-62df6b8e0e10",
        );

        expect(sql).toContain(
          "6786722212",
        );

        expect(sql).toContain(
          "get diagnostics v_updated = row_count",
        );

        expect(sql).toContain(
          "if v_updated <> 1",
        );
      },
    );

    it(
      "preserves Matata as the exact Release primary",
      () => {
        expect(sql).toContain(
          "016f4cd5-0faf-42e9-bad9-fadadf581f64",
        );

        expect(sql).toContain(
          "0d121663-dc75-43be-ac18-8e37eb52e36a",
        );

        expect(sql).toContain(
          "ra.artist_slug = 'matata'",
        );

        expect(sql).toContain(
          "ra.credit_order = 1",
        );
      },
    );

    it(
      "changes only DJames role flags and preserves ordering",
      () => {
        expect(sql).toContain(
          "role = 'featured_artist'",
        );

        expect(sql).toContain(
          "is_primary = false",
        );

        expect(sql).toContain(
          "is_featured = true",
        );

        expect(sql).not.toContain(
          "credit_order = 99",
        );

        expect(sql).not.toContain(
          "delete from public.registry_release_artists",
        );
      },
    );
  },
);
