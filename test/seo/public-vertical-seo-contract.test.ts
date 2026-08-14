import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const router =
  readFileSync(
    "src/router/config.tsx",
    "utf8",
  );

const seoEdge =
  readFileSync(
    "supabase/functions/seo-sitemap-admin/index.ts",
    "utf8",
  );

const prerender =
  readFileSync(
    "scripts/seo/prerender-metadata.mjs",
    "utf8",
  );

const seoAudit =
  readFileSync(
    "scripts/seo/audit-prerender-output.mjs",
    "utf8",
  );

const sitemapBuilder =
  readFileSync(
    "scripts/seo/build-public-sitemap-html.mjs",
    "utf8",
  );

const routeManifest =
  readFileSync(
    "public/seo-prerender-routes.txt",
    "utf8",
  );

const adminSeo =
  readFileSync(
    "src/pages/admin/settings/seo/page.tsx",
    "utf8",
  );

describe(
  "public SEO vertical contract",
  () => {
    it(
      "keeps Playlists first class across route, sitemap, metadata, prerender, and audit authority",
      () => {
        expect(router)
          .toContain(
            'path: "/playlists"',
          );

        expect(router)
          .toContain(
            'path: "/playlists/:slug"',
          );

        expect(seoEdge)
          .toContain(
            '{ loc: makeUrl("/playlists"), url_type: "static" }',
          );

        expect(seoEdge)
          .toContain(
            '"list_public_playlists"',
          );

        expect(seoEdge)
          .toContain(
            '"public_playlist"',
          );

        expect(seoEdge)
          .toContain(
            'kind: "playlist"',
          );

        expect(seoEdge)
          .toContain(
            'ogType: "music.playlist"',
          );

        expect(prerender)
          .toContain(
            '"/playlists": {',
          );

        expect(prerender)
          .toContain(
            'model.kind === "playlist"',
          );

        expect(prerender)
          .toContain(
            '"MusicPlaylist"',
          );

        expect(prerender)
          .toContain(
            'Playlist metadata manifest loaded:',
          );

        expect(routeManifest)
          .toContain(
            "/playlists",
          );

        expect(sitemapBuilder)
          .toContain(
            '<a href="/playlists">Playlists</a>',
          );

        expect(seoAudit)
          .toContain(
            '"/playlists: missing from SEO metadata manifest."',
          );

        expect(adminSeo)
          .toContain(
            '"playlist_detail"',
          );

        expect(adminSeo)
          .toContain(
            '"playlist"',
          );
      },
    );

    it(
      "keeps work-backed public People in dynamic SEO metadata and prerender authority without inventing a People collection page",
      () => {
        expect(router)
          .toContain(
            'path: "/people/:slug"',
          );

        expect(router)
          .not.toContain(
            'path: "/people"',
          );

        expect(seoEdge)
          .toContain(
            '.from("wk_resource_index")',
          );

        expect(seoEdge)
          .toContain(
            '"get_public_person"',
          );

        expect(seoEdge)
          .toContain(
            '"list_public_person_work"',
          );

        expect(seoEdge)
          .toContain(
            "workData.length === 0",
          );

        expect(seoEdge)
          .toContain(
            '"public_person"',
          );

        expect(seoEdge)
          .toContain(
            'kind: "person"',
          );

        expect(prerender)
          .toContain(
            'model.kind === "person"',
          );

        expect(prerender)
          .toContain(
            'Person metadata manifest loaded:',
          );

        expect(sitemapBuilder)
          .toContain(
            '"people"',
          );

        expect(adminSeo)
          .toContain(
            '"person_detail"',
          );

        expect(adminSeo)
          .toContain(
            '"person"',
          );
      },
    );

    it(
      "keeps private or personal product surfaces outside this SEO contract",
      () => {
        expect(seoEdge)
          .not.toContain(
            'makeUrl("/following")',
          );

        expect(seoEdge)
          .not.toContain(
            'makeUrl("/start")',
          );

        expect(routeManifest)
          .not.toContain(
            "/following",
          );

        expect(routeManifest)
          .not.toContain(
            "/start",
          );
      },
    );
  },
);
