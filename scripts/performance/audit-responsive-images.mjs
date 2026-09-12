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
    expected: 1,
  },
  {
    path:
      "src/pages/magazine/article/components/ArticleRelated.tsx",
    expected: 2,
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

let responsiveImageCount = 0;

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
  `Responsive image audit passed: ${responsiveImageCount} Magazine + desktop/mobile Article images covered; Article LCP priority enforced.`,
);
