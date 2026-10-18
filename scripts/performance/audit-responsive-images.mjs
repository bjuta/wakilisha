import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const fail = (message) => {
  console.error(
    `Responsive image audit failed: ${message}`,
  );
  process.exit(1);
};

const helper = read(
  "src/lib/responsiveMedia.ts",
);

const component = read(
  "src/components/media/ResponsiveMediaImage.tsx",
);

const packageJson = read("package.json");

const targets = [
  {
    path:
      "src/pages/magazine/components/MagazineCard.tsx",
    expected: 4,
  },
  {
    path: "src/pages/magazine/page.tsx",
    expected: 2,
  },
  {
    path: "src/pages/mobile/magazine/page.tsx",
    expected: 1,
  },
  {
    path: "src/pages/magazine/article/page.tsx",
    expected: 2,
  },
  {
    path:
      "src/pages/magazine/article/components/ArticleRelated.tsx",
    expected: 1,
  },
  {
    path:
      "src/pages/mobile/magazine/article/page.tsx",
    expected: 2,
  },
];

for (const marker of [
  "media.wakilisha.africa",
  "/__image/w",
  "/uploads/",
  "320",
  "640",
  "1280",
  "1600",
]) {
  if (!helper.includes(marker)) {
    fail(
      `responsive media helper is missing ${marker}`,
    );
  }
}

for (const marker of [
  "srcSet",
  "sizes",
  "failedSource",
  "data-wakilisha-responsive-image",
  "onError",
]) {
  if (!component.includes(marker)) {
    fail(
      `responsive image component is missing ${marker}`,
    );
  }
}

const magazineCard = read(
  "src/pages/magazine/components/MagazineCard.tsx",
);

const mobileMagazine = read(
  "src/pages/mobile/magazine/page.tsx",
);

// The mobile Magazine now composes all non-hero images from its shared card.
// Their responsive load authority remains enforced, not merely counted.
if (
  !mobileMagazine.includes(
    'import { MagazineCard } from "@/pages/magazine/components/MagazineCard";',
  )
  || !mobileMagazine.includes("<MagazineCard")
  || !magazineCard.includes('fetchPriority="low"')
) {
  fail("Mobile Magazine secondary imagery must retain shared low-priority card authority");
}

const articlePage = read(
  "src/pages/magazine/article/page.tsx",
);

for (const marker of [
  'preset="hero"',
  'loading="eager"',
  'fetchPriority="high"',
  'decoding="async"',
  'data-wakilisha-article-hero="true"',
]) {
  if (!articlePage.includes(marker)) {
    fail(
      `Article LCP hero is missing ${marker}`,
    );
  }
}

const articleRelated = read(
  "src/pages/magazine/article/components/ArticleRelated.tsx",
);

for (const marker of [
  'preset="feature"',
  'loading="lazy"',
  'fetchPriority="low"',
  'decoding="async"',
  'aspect-[3/2]',
]) {
  if (!articleRelated.includes(marker)) {
    fail(
      `Article related imagery is missing ${marker}`,
    );
  }
}

const mobileArticlePage = read(
  "src/pages/mobile/magazine/article/page.tsx",
);

for (const marker of [
  'preset="hero"',
  'loading="eager"',
  'fetchPriority="high"',
  'decoding="async"',
  'data-wakilisha-article-hero="true"',
  '<ArticleRelated',
]) {
  if (!mobileArticlePage.includes(marker)) {
    fail(
      `Mobile Article media is missing ${marker}`,
    );
  }
}


for (const marker of [
  "getPrerenderedMobileArticleHeroSource",
  'link[data-wakilisha-lcp-preload="article"]',
  '"data-wakilisha-lcp-path"',
  "prerenderedArticleHeroSource",
  'data-wakilisha-mobile-article-loading-hero="true"',
  'key="mobile-article-hero-shell"',
  'key="mobile-article-hero-media"',
]) {
  if (!mobileArticlePage.includes(marker)) {
    fail(
      `Mobile Article first-visual authority is missing ${marker}`,
    );
  }
}

if (
  mobileArticlePage.includes(
    "return <SkeletonArticlePage />;",
  )
) {
  fail(
    "Mobile Article first visual regressed to a replace-on-data SkeletonArticlePage return",
  );
}

const mobileArticleHeroShellKeyCount =
  (
    mobileArticlePage.match(
      /key="mobile-article-hero-shell"/g,
    )
    || []
  ).length;

const mobileArticleHeroMediaKeyCount =
  (
    mobileArticlePage.match(
      /key="mobile-article-hero-media"/g,
    )
    || []
  ).length;

if (
  mobileArticleHeroShellKeyCount < 2
  || mobileArticleHeroMediaKeyCount < 2
) {
  fail(
    `Mobile Article loading/ready hero identity is not shared: shell=${mobileArticleHeroShellKeyCount} media=${mobileArticleHeroMediaKeyCount}`,
  );
}

const mobileArticleContentShellKeyCount =
  (
    mobileArticlePage.match(
      /key="mobile-article-content-shell"/g,
    )
    || []
  ).length;

const mobileArticleProgressKeyCount =
  (
    mobileArticlePage.match(
      /key="mobile-article-progress"/g,
    )
    || []
  ).length;

if (
  mobileArticleContentShellKeyCount !== 2
  || mobileArticleProgressKeyCount !== 1
) {
  fail(
    `Mobile Article loading/ready content reconciliation is unstable: content-shell=${mobileArticleContentShellKeyCount} progress=${mobileArticleProgressKeyCount}`,
  );
}

// Both mobile Article states retain their keyed 360px content geometry.
// Workbook v4 deliberately removes the former rounded floating sheet.
if (
  !mobileArticlePage.includes(
    'key="mobile-article-content-shell"\n          className="relative z-10 min-h-[360px] bg-[var(--wk-bg)]"',
  )
  || !mobileArticlePage.includes(
    'className="wk-workbook-article-paper relative z-10 min-h-[360px]"',
  )
  || mobileArticlePage.includes('rounded-t-[24px]')
) {
  fail(
    "Mobile Article loading/ready shells must preserve 360px flat editorial geometry",
  );
}

const mobileArticleReadyRootIndex =
  mobileArticlePage.lastIndexOf(
    '<div data-wk-workbook-screen="article-mobile" className="min-h-screen bg-[var(--wk-bg)]">',
  );

const mobileArticleReadyHeroIndex =
  mobileArticlePage.lastIndexOf(
    '<section key="mobile-article-hero-shell"',
  );

const mobileArticleProgressIndex =
  mobileArticlePage.indexOf(
    "{/* Reading progress */}",
    mobileArticleReadyRootIndex,
  );

if (
  mobileArticleReadyRootIndex < 0
  || mobileArticleReadyHeroIndex < 0
  || mobileArticleProgressIndex < 0
  || mobileArticleReadyHeroIndex
    < mobileArticleReadyRootIndex
  || mobileArticleReadyHeroIndex
    > mobileArticleProgressIndex
) {
  fail(
    "Mobile Article ready hero must remain ahead of progress/schema/content chrome so loading-to-ready reconciliation preserves LCP identity",
  );
}

const mobileReleasePage = read(
  "src/pages/mobile/releases/detail/page.tsx",
);

for (const marker of [
  "<ResponsiveMediaImage",
  'preset="hero"',
  'loading="eager"',
  'fetchPriority="high"',
  'decoding="async"',
  'data-wakilisha-release-hero="true"',
  "getPrerenderedMobileReleaseHeroSource",
  'link[data-wakilisha-lcp-preload="release"]',
  '"data-wakilisha-lcp-path"',
  "prerenderedReleaseHeroSource",
  'data-wakilisha-mobile-release-loading-hero="true"',
  'key="mobile-release-hero-shell"',
  'key="mobile-release-hero-media"',
]) {
  if (!mobileReleasePage.includes(marker)) {
    fail(
      `Mobile Release first-visual authority is missing ${marker}`,
    );
  }
}

if (
  mobileReleasePage.includes(
    'backgroundImage: `url(${release.artworkUrl})`',
  )
) {
  fail(
    "Mobile Release LCP hero regressed to CSS-background ownership",
  );
}

if (
  mobileReleasePage.includes(
    'className="flex min-h-screen items-center justify-center bg-[var(--wk-bg)]"',
  )
) {
  fail(
    "Mobile Release first visual regressed to a replace-on-data full-screen loader",
  );
}

const mobileReleaseHeroShellKeyCount =
  (
    mobileReleasePage.match(
      /key="mobile-release-hero-shell"/g,
    )
    || []
  ).length;

const mobileReleaseHeroMediaKeyCount =
  (
    mobileReleasePage.match(
      /key="mobile-release-hero-media"/g,
    )
    || []
  ).length;

const mobileReleaseResponsiveHeroCount =
  (
    mobileReleasePage.match(
      /<ResponsiveMediaImage\b/g,
    )
    || []
  ).length;

if (
  mobileReleaseHeroShellKeyCount < 2
  || mobileReleaseHeroMediaKeyCount < 2
  || mobileReleaseResponsiveHeroCount !== 2
) {
  fail(
    `Mobile Release loading/ready hero identity is unstable: shell=${mobileReleaseHeroShellKeyCount} media=${mobileReleaseHeroMediaKeyCount} responsive=${mobileReleaseResponsiveHeroCount}`,
  );
}

const mobileTopBar = read(
  "src/components/mobile/MobileTopBar.tsx",
);
if (!mobileTopBar.includes('/assets/logos/wakilisha-logo-dark.svg')) {
  fail("The Workbook v4 mobile header must use the approved vector mark.");
}
const mobileNavigation = read(
  "src/components/mobile/MobileAppLayout.tsx",
);
if (mobileNavigation.includes("MobileBottomNav") || mobileNavigation.includes("WAKILISHA_THUNDERBOLT_URL")) {
  fail("Retired mobile tab bar and generated home mark must remain absent.");
}

const artistHero = read(
  "src/pages/artists/detail/components/ArtistDetailHero.tsx",
);

for (const marker of [
  "<ResponsiveMediaImage",
  'preset="hero"',
  'loading="eager"',
  'fetchPriority="high"',
  'decoding="async"',
  'data-wakilisha-artist-hero="true"',
]) {
  if (!artistHero.includes(marker)) {
    fail(
      `Artist LCP hero is missing ${marker}`,
    );
  }
}

if (
  artistHero.includes(
    "backgroundImage:",
  )
  || artistHero.includes(
    "hero-ken-burns",
  )
) {
  fail(
    "Artist LCP hero regressed to CSS-background/long-running transform ownership",
  );
}

for (const marker of [
  "getPrerenderedArticleHeroSource",
  'link[data-wakilisha-lcp-preload="article"]',
  '"data-wakilisha-lcp-path"',
  "prerenderedArticleHeroSource",
  'data-wakilisha-article-loading-hero="true"',
  'key="article-hero-shell"',
  'key="article-hero-media"',
]) {
  if (!articlePage.includes(marker)) {
    fail(
      `Article first-visual loading authority is missing ${marker}`,
    );
  }
}

if (
  articlePage.includes(
    "if (articleLoading) return <SkeletonArticlePage />;",
  )
) {
  fail(
    "Article first visual regressed to a replace-on-data SkeletonArticlePage return",
  );
}

const articleHeroShellKeyCount =
  (
    articlePage.match(
      /key="article-hero-shell"/g,
    )
    || []
  ).length;

const articleHeroMediaKeyCount =
  (
    articlePage.match(
      /key="article-hero-media"/g,
    )
    || []
  ).length;

if (
  articleHeroShellKeyCount < 2
  || articleHeroMediaKeyCount < 2
) {
  fail(
    `Article loading/ready hero identity is not shared: shell=${articleHeroShellKeyCount} media=${articleHeroMediaKeyCount}`,
  );
}

const articleReadyMainIndex =
  articlePage.lastIndexOf(
    '<main className="min-h-screen bg-[var(--wk-bg)]">',
  );

const articleReadyHeroIndex =
  articlePage.lastIndexOf(
    '<section data-wk-workbook-hero="article" key="article-hero-shell"',
  );

const articleMetaIndex =
  articlePage.indexOf(
    "<MetaTags",
    articleReadyMainIndex,
  );

if (
  articleReadyMainIndex < 0
  || articleReadyHeroIndex < 0
  || articleMetaIndex < 0
  || articleReadyHeroIndex
    < articleReadyMainIndex
  || articleReadyHeroIndex
    > articleMetaIndex
) {
  fail(
    "Article ready hero must remain the first visual subtree ahead of metadata/chrome so loading-to-ready reconciliation preserves LCP identity",
  );
}

const artistPage = read(
  "src/pages/artists/detail/page.tsx",
);

for (const marker of [
  "getPrerenderedArtistHeroSource",
  'link[data-wakilisha-lcp-preload="artist"]',
  '"data-wakilisha-lcp-path"',
  "prerenderedArtistHeroSource",
  'key="artist-detail-hero"',
]) {
  if (!artistPage.includes(marker)) {
    fail(
      `Artist first-visual loading authority is missing ${marker}`,
    );
  }
}

if (
  artistPage.includes(
    'className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]"',
  )
) {
  fail(
    "Artist first visual regressed to a replace-on-data full-screen loader",
  );
}

for (const marker of [
  "loading?: boolean",
  'data-wakilisha-artist-loading-hero="true"',
]) {
  if (!artistHero.includes(marker)) {
    fail(
      `Artist hero continuity authority is missing ${marker}`,
    );
  }
}

const artistPosts = read(
  "src/pages/artists/detail/components/ArtistPostsTimeline.tsx",
);

for (const marker of [
  'data-wakilisha-artist-posts-geometry="true"',
  'min-h-[280px]',
  "has not posted yet.",
]) {
  if (!artistPosts.includes(marker)) {
    fail(
      `Artist async geometry is missing ${marker}`,
    );
  }
}

if (
  artistPosts.includes(
    "posts.length === 0\n  ) {\n    return null;",
  )
) {
  fail(
    "Artist Posts empty state still collapses async geometry",
  );
}

let responsiveImageCount = 4;

for (const target of targets) {
  const source = read(target.path);

  const rawImages =
    source.match(/<img\b/g) ?? [];

  if (rawImages.length > 0) {
    fail(
      `${target.path} still contains ${rawImages.length} raw img elements`,
    );
  }

  const responsiveImages =
    source.match(
      /<ResponsiveMediaImage\b/g,
    ) ?? [];

  if (
    responsiveImages.length !==
    target.expected
  ) {
    fail(
      `${target.path} expected ${target.expected} responsive images, found ${responsiveImages.length}`,
    );
  }

  responsiveImageCount +=
    responsiveImages.length;
}

if (
  !packageJson.includes(
    '"performance:audit:images"',
  )
) {
  fail(
    "responsive image audit is not registered in package.json",
  );
}

if (
  !packageJson.includes(
    "npm run performance:audit:images",
  )
) {
  fail(
    "responsive image audit is not part of the build",
  );
}

console.log(
  `Responsive image audit passed: ${responsiveImageCount} Magazine + desktop/mobile Article/Artist/Release/chrome images covered; Article + Artist + Release LCP image ownership, Artist async geometry, and mobile Home mark derivative authority enforced.`,
);
