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
    expected: 7,
  },
  {
    path: "src/pages/magazine/article/page.tsx",
    expected: 2,
  },
  {
    path:
      "src/pages/magazine/article/components/ArticleRelated.tsx",
    expected: 2,
  },
  {
    path:
      "src/pages/mobile/magazine/article/page.tsx",
    expected: 3,
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
  'preset="thumbnail"',
  'loading="lazy"',
  'fetchPriority="low"',
  'decoding="async"',
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
  'preset="thumbnail"',
  'loading="eager"',
  'fetchPriority="high"',
  'decoding="async"',
  'data-wakilisha-article-hero="true"',
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

if (
  !mobileArticlePage.includes(
    'className="relative z-10 min-h-[360px] rounded-t-[24px] bg-[var(--wk-bg)]"',
  )
) {
  fail(
    "Mobile Article content shell must preserve its 360px minimum geometry through loading-to-ready reconciliation",
  );
}

const mobileArticleReadyRootIndex =
  mobileArticlePage.lastIndexOf(
    '<div className="min-h-screen bg-[var(--wk-bg)]">',
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

const mobileAppLayout = read(
  "src/components/mobile/MobileAppLayout.tsx",
);

for (const marker of [
  "WAKILISHA_THUNDERBOLT_URL",
  "<ResponsiveMediaImage",
  "src={WAKILISHA_THUNDERBOLT_URL}",
  'preset="thumbnail"',
  'loading="eager"',
  'fetchPriority="low"',
  'decoding="async"',
  'data-wakilisha-mobile-home-mark="true"',
]) {
  if (!mobileAppLayout.includes(marker)) {
    fail(
      `Mobile Home mark media is missing ${marker}`,
    );
  }
}

if (
  /<img[\s\S]{0,240}src=\{WAKILISHA_THUNDERBOLT_URL\}/.test(
    mobileAppLayout,
  )
) {
  fail(
    "Mobile Home mark regressed to a raw original img",
  );
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
    '<section key="article-hero-shell"',
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

let responsiveImageCount = 2;

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
  `Responsive image audit passed: ${responsiveImageCount} Magazine + desktop/mobile Article/Artist/chrome images covered; Article + Artist LCP image ownership, Artist async geometry, and mobile Home mark derivative authority enforced.`,
);
