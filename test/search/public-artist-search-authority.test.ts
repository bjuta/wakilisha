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
const searchPage = read(
  "src/pages/search/page.tsx",
);
const publicSearchClient = read(
  "src/services/publicSearch/client.ts",
);
const publicSearchHook = read(
  "src/hooks/usePublicRegistrySearch.ts",
);
const publicQueryEdge = read(
  "supabase/functions/public-query-v1/index.ts",
);
const publicQueryNginx = read(
  "ops/nginx/public-query-v1.conf.template",
);
const supabaseConfig = read(
  "supabase/config.toml",
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
      "does not hydrate legacy Search corpora while the global overlay is closed",
      () => {
        expect(
          globalSearch,
        ).toContain(
          "usePublicRegistrySearch(",
        );
        expect(
          globalSearch,
        ).toContain(
          "enabled: open",
        );
        expect(
          globalSearch,
        ).not.toContain(
          "useArtistSearchData",
        );
        expect(
          globalSearch,
        ).not.toContain(
          "useTrackSearchData",
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

describe(
  "Phase 9A.2 same-origin public Search convergence",
  () => {
    it(
      "keeps browser Search on one same-origin versioned GET boundary",
      () => {
        expect(
          publicSearchClient,
        ).toContain(
          '"/api/public/v1/search"',
        );
        expect(
          publicSearchClient,
        ).toContain(
          'method:\n          "GET"',
        );
        expect(
          publicSearchClient,
        ).toContain(
          'credentials:\n          "omit"',
        );
        expect(
          publicSearchClient,
        ).not.toContain(
          "@/lib/supabase",
        );
        expect(
          publicSearchClient,
        ).not.toContain(
          "search_public_registry_v1",
        );
        expect(
          publicSearchHook,
        ).toContain(
          "searchPublicRegistry",
        );
        expect(
          publicSearchHook,
        ).not.toContain(
          "@/lib/supabase",
        );
      },
    );

    it(
      "uses a thin anonymous Edge transport with opaque cursor and safe shared cache semantics",
      () => {
        expect(
          publicQueryEdge,
        ).toContain(
          "SUPABASE_ANON_KEY",
        );
        expect(
          publicQueryEdge,
        ).not.toContain(
          "SERVICE_ROLE",
        );
        expect(
          publicQueryEdge,
        ).toContain(
          '"search_public_registry_v1"',
        );
        expect(
          publicQueryEdge,
        ).toContain(
          "encodeCursor",
        );
        expect(
          publicQueryEdge,
        ).toContain(
          "decodeCursor",
        );
        expect(
          publicQueryEdge,
        ).toContain(
          '"ETag"',
        );
        expect(
          publicQueryEdge,
        ).toContain(
          '"X-Wakilisha-ETag"',
        );
        expect(
          publicQueryEdge.match(
            /"X-Wakilisha-ETag"/g,
          )?.length,
        ).toBe(
          2,
        );
        expect(
          publicQueryEdge,
        ).toContain(
          "const parsed: Partial<SearchCursor>",
        );
        expect(
          publicQueryEdge,
        ).toContain(
          "const rows: SearchRow[]",
        );
        expect(
          publicQueryEdge,
        ).not.toContain(
          "return parsed\n      as SearchCursor",
        );
        expect(
          publicQueryEdge,
        ).not.toContain(
          ") as SearchRow[]",
        );
        expect(
          publicQueryEdge,
        ).toContain(
          "stale-while-revalidate=300",
        );
        expect(
          publicQueryEdge,
        ).toContain(
          "s-maxage=60",
        );
        expect(
          publicQueryEdge,
        ).not.toContain(
          "Access-Control-Allow-Origin",
        );
        expect(
          supabaseConfig,
        ).toContain(
          "[functions.public-query-v1]",
        );
        expect(
          supabaseConfig,
        ).toContain(
          "[functions.public-query-v1]\nverify_jwt = false",
        );
      },
    );

    it(
      "strips user state at the same-origin Nginx cache boundary",
      () => {
        expect(
          publicQueryNginx,
        ).toContain(
          "location = /api/public/v1/search",
        );
        expect(
          publicQueryNginx,
        ).toContain(
          'proxy_set_header Authorization "";',
        );
        expect(
          publicQueryNginx,
        ).toContain(
          'proxy_set_header Cookie "";',
        );
        expect(
          publicQueryNginx,
        ).toContain(
          'proxy_set_header Origin "";',
        );
        expect(
          publicQueryNginx,
        ).toContain(
          "proxy_hide_header ETag;",
        );
        expect(
          publicQueryNginx,
        ).toContain(
          "proxy_hide_header X-Wakilisha-ETag;",
        );
        expect(
          publicQueryNginx,
        ).toContain(
          "add_header ETag $upstream_http_x_wakilisha_etag always;",
        );
        expect(
          publicQueryNginx,
        ).toContain(
          "rewrite ^ /functions/v1/public-query-v1 break;",
        );
        expect(
          publicQueryNginx,
        ).toContain(
          "proxy_pass https://__SUPABASE_PROJECT_REF__.supabase.co;",
        );
      },
    );

    it(
      "moves the representative public Search page off five-domain corpus hydration",
      () => {
        expect(
          searchPage,
        ).toContain(
          "usePublicRegistrySearch(",
        );
        expect(
          searchPage,
        ).toContain(
          "registryTotals.artist",
        );
        expect(
          searchPage,
        ).toContain(
          "registryTotals.track",
        );
        expect(
          searchPage,
        ).not.toContain(
          "useArtistSearchData",
        );
        expect(
          searchPage,
        ).not.toContain(
          "useTrackSearchData",
        );
        expect(
          searchPage,
        ).not.toContain(
          "useGenreSearchData",
        );
        expect(
          searchPage,
        ).not.toContain(
          "useLabelSearchData",
        );
        expect(
          searchPage,
        ).not.toContain(
          "listReleases(",
        );
        expect(
          searchPage,
        ).toContain(
          "registryTrackId={track.id}",
        );
        expect(
          searchPage,
        ).toContain(
          "previewUrl: track.previewUrl",
        );
      },
    );

    it(
      "moves global Search to query-aware bounded Artist and Track calls",
      () => {
        expect(
          globalSearch,
        ).toContain(
          "artist: 5",
        );
        expect(
          globalSearch,
        ).toContain(
          "track: 6",
        );
        expect(
          globalSearch,
        ).toContain(
          "release: 0",
        );
        expect(
          globalSearch,
        ).toContain(
          "previewUrl: track.previewUrl",
        );
        expect(
          globalSearch,
        ).toContain(
          "See All Results",
        );
      },
    );

    it(
      "keeps the query contract bounded and cursor-capable without exposing rank internals to browser consumers",
      () => {
        expect(
          publicSearchHook,
        ).toContain(
          "loadMore",
        );
        expect(
          publicSearchHook,
        ).toContain(
          "nextCursor",
        );
        expect(
          publicSearchClient,
        ).toContain(
          "Math.min(",
        );
        expect(
          publicSearchClient,
        ).toContain(
          "50",
        );
        expect(
          publicSearchClient,
        ).not.toContain(
          "typeRank",
        );
        expect(
          publicSearchClient,
        ).not.toContain(
          "score:",
        );
      },
    );
  },
);
