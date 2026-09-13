import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const read = (path: string) =>
  readFileSync(
    path,
    "utf8",
  );

const artistMigration = read(
  "supabase/migrations/20260823181332_public_artist_search_authority.sql",
);
const artistVerifier = read(
  "scripts/control-plane/verify-public-artist-search-authority.sql",
);
const searchMigrationName =
  readdirSync(
    "supabase/migrations",
  ).find(
    (name) =>
      name.endsWith(
        "_phase_9a2_public_search_projection_authority.sql",
      ),
  );

if (!searchMigrationName) {
  throw new Error(
    "Phase 9A.2 public search projection migration is missing.",
  );
}

const searchMigration = read(
  `supabase/migrations/${searchMigrationName}`,
);
const searchVerifier = read(
  "scripts/control-plane/verify-public-search-authority.sql",
);
const artistHook = read(
  "src/hooks/useArtistSearchData.ts",
);
const trackHook = read(
  "src/hooks/useTrackSearchData.ts",
);
const globalSearch = read(
  "src/components/search/GlobalSearchSurface.tsx",
);

describe(
  "Public Artist Search authority",
  () => {
    it(
      "keeps anonymous Artist Search behind a narrow RPC",
      () => {
        expect(
          artistMigration,
        ).toContain(
          "get_public_registry_artists_for_search",
        );
        expect(
          artistMigration,
        ).toContain(
          "security definer",
        );
        expect(
          artistMigration,
        ).toContain(
          "to anon, authenticated",
        );
        expect(
          artistHook,
        ).toContain(
          '"get_public_registry_artists_for_search"',
        );
        expect(
          artistHook,
        ).not.toContain(
          '.from("registry_artists")',
        );
      },
    );

    it(
      "removes the same direct Artist table read from Track search enrichment",
      () => {
        expect(
          trackHook,
        ).toContain(
          '"get_public_registry_artists_for_search"',
        );
        expect(
          trackHook,
        ).not.toContain(
          '.from("registry_artists")',
        );
      },
    );

    it(
      "does not eagerly load quick Search datasets while the overlay is closed",
      () => {
        expect(
          globalSearch,
        ).toContain(
          "useArtistSearchData(open)",
        );
        expect(
          globalSearch,
        ).toContain(
          "useTrackSearchData(open)",
        );
      },
    );

    it(
      "ships the historical table-boundary verifier",
      () => {
        expect(
          artistVerifier,
        ).toContain(
          "PUBLIC_ARTIST_SEARCH_AUTHORITY_PASS",
        );
        expect(
          artistVerifier,
        ).toContain(
          "not has_table_privilege",
        );
      },
    );
  },
);

describe(
  "Phase 9A.2 public Registry search projection authority",
  () => {
    it(
      "uses one live security-invoker projection instead of a stored duplicate corpus",
      () => {
        expect(
          searchMigration,
        ).toContain(
          "public.public_search_documents_v1",
        );
        expect(
          searchMigration,
        ).toContain(
          "security_invoker = true",
        );
        expect(
          searchMigration,
        ).not.toContain(
          "create table public.public_search_documents",
        );
        expect(
          searchMigration,
        ).not.toContain(
          "create materialized view public.public_search_documents",
        );
        expect(
          searchMigration,
        ).toContain(
          "from public, anon, authenticated",
        );
      },
    );

    it(
      "owns exactly the five Registry discovery domains behind one versioned bounded function",
      () => {
        for (
          const entityType
          of [
            "artist",
            "track",
            "release",
            "genre",
            "label",
          ]
        ) {
          expect(
            searchMigration,
          ).toContain(
            `'${entityType}'::text as entity_type`,
          );
        }

        expect(
          searchMigration,
        ).toContain(
          "public.search_public_registry_v1",
        );
        expect(
          searchMigration,
        ).toContain(
          "security definer",
        );
        expect(
          searchMigration,
        ).toContain(
          "least(",
        );
        expect(
          searchMigration,
        ).toContain(
          "50",
        );
        expect(
          searchMigration,
        ).toContain(
          "score desc",
        );
        expect(
          searchMigration,
        ).toContain(
          "type_rank asc",
        );
        expect(
          searchMigration,
        ).toContain(
          "w.entity_id asc",
        );
        expect(
          searchMigration,
        ).toContain(
          "to anon, authenticated",
        );
      },
    );

    it(
      "puts fuzzy indexes on canonical Registry columns rather than a second search store",
      () => {
        for (
          const marker
          of [
            "idx_registry_tracks_title_trgm",
            "idx_registry_tracks_slug_trgm",
            "idx_registry_releases_title_trgm",
            "idx_registry_releases_slug_trgm",
            "idx_registry_genres_name_trgm",
            "idx_registry_genres_slug_trgm",
            "idx_registry_labels_name_trgm",
            "idx_registry_labels_slug_trgm",
          ]
        ) {
          expect(
            searchMigration,
          ).toContain(
            marker,
          );
        }
      },
    );

    it(
      "ships one permanent SQL verifier for grants, boundedness, uniqueness and cursor separation",
      () => {
        expect(
          searchVerifier,
        ).toContain(
          "PUBLIC_SEARCH_AUTHORITY_PASS",
        );
        expect(
          searchVerifier,
        ).toContain(
          "security_invoker=true",
        );
        expect(
          searchVerifier,
        ).toContain(
          "pg_get_viewdef",
        );
        expect(
          searchVerifier,
        ).toContain(
          "structurally own all five Registry domains",
        );
        expect(
          searchVerifier,
        ).toContain(
          "cursor pages overlap",
        );
        expect(
          searchVerifier,
        ).toContain(
          "exceeded p_limit",
        );
        expect(
          searchVerifier,
        ).toContain(
          "duplicate entity documents",
        );
      },
    );
  },
);
