import {
  describe,
  expect,
  it,
} from "vitest";
import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

function read(
  relativePath: string,
): string {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

function findMigration(): string {
  const directory =
    path.join(
      root,
      "docs/engineering/replay-baseline/legacy-migrations",
    );

  const matches =
    fs.readdirSync(
      directory,
    )
      .filter(
        (name) =>
          name.endsWith(
            "_registry_artist_structural_proximity.sql",
          ),
      );

  expect(matches).toHaveLength(1);

  return read(
    `docs/engineering/replay-baseline/legacy-migrations/${matches[0]}`,
  );
}

describe(
  "Registry Artist structural proximity",
  () => {
    const migration =
      findMigration();

    const publicRead =
      read(
        "supabase/functions/public-content-read/index.ts",
      );

    it(
      "derives proximity from canonical structural credit authorities",
      () => {
        expect(
          migration,
        ).toContain(
          "registry_track_artists",
        );

        expect(
          migration,
        ).toContain(
          "registry_release_artists",
        );

        expect(
          migration,
        ).not.toContain(
          "from public.registry_entity_relationships",
        );

        expect(
          migration,
        ).not.toContain(
          "from public.registry_artist_relationships",
        );
      },
    );

    it(
      "keeps structural proximity distinct from reviewed cultural relationships",
      () => {
        expect(
          migration,
        ).toContain(
          "get_public_artist_structural_proximity",
        );

        expect(
          migration,
        ).toContain(
          "'public_read'",
        );

        expect(
          migration,
        ).toContain(
          "does not create or replace reviewed cultural relationships",
        );
      },
    );

    it(
      "makes public Artist detail consume structural proximity instead of sparse relationship tables",
      () => {
        const start =
          publicRead.indexOf(
            "const relatedArtistsMap",
          );

        const end =
          publicRead.indexOf(
            "const followerCount",
            start,
          );

        expect(
          start,
        ).toBeGreaterThan(
          -1,
        );

        expect(
          end,
        ).toBeGreaterThan(
          start,
        );

        const relatedBlock =
          publicRead.slice(
            start,
            end,
          );

        expect(
          relatedBlock,
        ).toContain(
          "get_public_artist_structural_proximity",
        );

        expect(
          relatedBlock,
        ).not.toContain(
          "registry_entity_relationships",
        );

        expect(
          relatedBlock,
        ).not.toContain(
          "registry_artist_relationships",
        );
      },
    );

    it(
      "preserves the existing public Artist response shape and eight-item page limit",
      () => {
        expect(
          publicRead,
        ).toContain(
          "sharedTracksAll",
        );

        expect(
          publicRead,
        ).toContain(
          "featuresThem",
        );

        expect(
          publicRead,
        ).toContain(
          "theyFeature",
        );

        const start =
          publicRead.indexOf(
            "const relatedArtists =",
          );

        const end =
          publicRead.indexOf(
            "const followerCount",
            start,
          );

        expect(
          start,
        ).toBeGreaterThan(
          -1,
        );

        expect(
          end,
        ).toBeGreaterThan(
          start,
        );

        const compact =
          publicRead
            .slice(
              start,
              end,
            )
            .replace(
              /\s+/g,
              " ",
            );

        expect(
          compact,
        ).toContain(
          ".slice( 0, 8, );",
        );
      },
    );
  },
);
