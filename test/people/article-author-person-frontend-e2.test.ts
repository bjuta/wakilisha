import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const producers = [
  "src/components/design-system/editorial/StoryCard.tsx",
  "src/pages/about/page.tsx",
  "src/pages/magazine/page.tsx",
  "src/pages/mobile/magazine/page.tsx",
  "src/pages/mobile/magazine/article/page.tsx",
  "src/pages/magazine/article/components/ArticleFloatHeader.tsx",
  "src/pages/magazine/article/components/ArticleRelated.tsx",
  "src/pages/magazine/components/CuratedGrid.tsx",
  "src/pages/magazine/components/EditorPicks.tsx",
  "src/pages/magazine/components/EditorialPicks.tsx",
  "src/pages/magazine/components/IssueCoverHero.tsx",
  "src/pages/magazine/components/LatestGrid.tsx",
  "src/pages/magazine/components/LeadStories.tsx",
  "src/pages/magazine/components/MagazineCard.tsx",
  "src/pages/magazine/components/SectionPreview.tsx",
  "src/pages/magazine/components/SectionRowBlock.tsx",
  "src/pages/magazine/components/SectionSpotlight.tsx",
  "src/pages/magazine/components/TopStoriesSection.tsx",
  "src/pages/magazine/components/TrendingShelf.tsx",
].map(read).join("\n");

describe("Article Author → Person frontend E2", () => {
  const identity = read("src/components/design-system/editorial/ArticleAuthorIdentity.tsx");
  const floatHeader = read("src/pages/magazine/article/components/ArticleFloatHeader.tsx");
  const about = read("src/pages/about/page.tsx");
  const desktop = read("src/pages/magazine/article/page.tsx");
  const mobile = read("src/pages/mobile/magazine/article/page.tsx");
  const prerender = read("scripts/seo/prerender-metadata.mjs");
  const analytics = read("src/hooks/usePageViewTracking.ts");
  const router = read("src/router/config.tsx");
  const apiSpec = read("src/data/api-specs/public-content-read.ts");

  it("has zero public frontend /authors URL producers", () => {
    expect(producers).not.toContain("/authors/${");
    expect(producers).not.toContain("navigate(`/authors/");
  });

  it("links only from canonical Person authority", () => {
    expect(identity).toContain("if (!personPath)");
    expect(identity).toContain("to={personPath}");
    expect(identity).not.toContain("getAuthorMeta");
  });

  it("removes byline-to-Registry-Author inference", () => {
    expect(floatHeader).not.toContain("resolveAuthorMeta");
    expect(floatHeader).not.toContain("getAuthorMeta");
    expect(floatHeader).toContain("personPath={article.authorPersonPath}");
  });

  it("resolves About contributors to canonical People", () => {
    expect(about).toContain("resolvePublicRegistryAuthorPerson");
    expect(about).toContain("resolved?.canonicalPath ?? null");
    expect(about).not.toContain("profilePath: `/authors/");
  });

  it("does not claim institutional bylines are Person schema entities", () => {
    expect(desktop).toContain("author: article.authorPersonPath ?");
    expect(mobile).toContain("author: article.authorPersonPath ?");
    expect(prerender).toContain("author: authorPersonPath ?");
    expect(prerender).toContain("url: canonicalUrl(authorPersonPath)");
  });

  it("tracks People and keeps /authors as compatibility only", () => {
    expect(analytics).toContain('pageType: "person_detail"');
    expect(analytics).toContain('pageType: "legacy_author_redirect"');
    expect(router).toContain('path: "/authors/:slug", element: <LegacyAuthorPersonRedirect />');
    expect(router).toContain('path: "/u/:username"');
  });

  it("keeps Registry Author API editorial data intact", () => {
    expect(apiSpec).toContain('"/authors/{slug}"');
    expect(router).not.toContain("<AuthorProfilePage />");
  });
});
