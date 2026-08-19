import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(path, "utf8");

describe(
  "Article Author → Person frontend E1",
  () => {
    const migration = read(
      "supabase/migrations/20260819173000_article_author_person_public_paths.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-article-author-person-public-paths.sql",
    );
    const edge = read(
      "supabase/functions/public-content-read/index.ts",
    );
    const router = read(
      "src/router/config.tsx",
    );
    const lazyPublic = read(
      "src/router/lazyPublic.tsx",
    );
    const redirect = read(
      "src/pages/authors/legacy-redirect/page.tsx",
    );
    const compatibility = read(
      "src/services/people/authorCompatibilityService.ts",
    );
    const seo = read(
      "scripts/seo/prerender-metadata.mjs",
    );
    const sitemap = read(
      "supabase/functions/seo-sitemap-admin/index.ts",
    );

    it(
      "projects current primary Article Credits to canonical public Person paths",
      () => {
        expect(migration)
          .toContain(
            "editorial.resolve_credit_person",
          );
        expect(migration)
          .toContain(
            "author_person_path",
          );
        expect(migration)
          .toContain(
            "to service_role",
          );
        expect(migration)
          .not.toContain(
            "insert into editorial.credits",
          );
        expect(migration)
          .not.toContain(
            "update editorial.people",
          );
      },
    );

    it(
      "locks 134 human paths, keeps Staff outside Person, and proves Beautah",
      () => {
        expect(verifier)
          .toContain("v_total <> 134");
        expect(verifier)
          .toContain("Wakilisha Staff");
        expect(verifier)
          .toContain("'/people/beautah'");
        expect(verifier)
          .toContain("<> 31");
      },
    );

    it(
      "emits authorPersonPath instead of deriving Article identity from the byline",
      () => {
        expect(edge)
          .toContain("authorPersonPath:");
        expect(edge)
          .toContain(
            "list_public_article_author_paths",
          );
        expect(edge)
          .not.toContain(
            "authorSlug: authorSlugFromName(authorName)",
          );
        expect(edge)
          .toContain(
            'const articleSlug = String(row.article_slug || "").trim();',
          );
        expect(edge)
          .toContain(
            "authorPaths.get(String(a.slug))",
          );
        expect(edge)
          .not.toContain(
            "authorPaths.get(String(a.id))",
          );
        expect(edge)
          .toContain(
            "const authorPaths = await loadPublicArticleAuthorPathMap(\n        supabase,\n        artSlug,\n      );",
          );
        expect(edge)
          .toContain(
            "...buildArticleResponse(article, authorPaths)",
          );
        expect(edge)
          .toContain(
            'String(article.slug || "")',
          );
        // Production proves publication snapshot UUIDs differ from Article UUIDs.
        // The public Article slug is the stable presentation join key.
        expect(edge)
          .toContain(
            "snapshot slug as the Article presentation join key",
          );
      },
    );

    it(
      "makes /authors/:slug redirect-only through server Person authority",
      () => {
        expect(router)
          .toContain(
            'path: "/authors/:slug", element: <LegacyAuthorPersonRedirect />',
          );
        expect(router)
          .not.toContain(
            "<AuthorProfilePage />",
          );
        expect(lazyPublic)
          .toContain(
            "LegacyAuthorPersonRedirect",
          );
        expect(lazyPublic)
          .not.toContain(
            "../pages/authors/detail/page",
          );
        expect(compatibility)
          .toContain(
            '"resolve_public_registry_author_person"',
          );
        expect(redirect)
          .toContain(
            "resolved?.canonicalPath",
          );
      },
    );

    it(
      "keeps account and admin Registry Author routes separate",
      () => {
        expect(router)
          .toContain(
            'path: "/u/:username"',
          );
        expect(router)
          .toContain(
            '{ path: "authors", element: <AdminAuthorsPage /> }',
          );
        expect(router)
          .toContain(
            '{ path: "authors/:slug", element: <AdminAuthorDetailPage /> }',
          );
      },
    );

    it(
      "removes Author URLs from canonical SEO and sitemap output",
      () => {
        expect(seo)
          .toContain(
            "canonicalUrl(authorPersonPath)",
          );
        expect(seo)
          .not.toContain(
            'canonicalUrl(`/authors/${authorSlug}`)',
          );
        expect(sitemap)
          .not.toContain(
            'makeUrl("/authors")',
          );
        expect(sitemap)
          .not.toContain(
            'makeUrl(`/authors/${row.slug}`)',
          );
      },
    );
  },
);
