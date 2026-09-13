import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");
const fallbackPath = path.join(distDir, "public-magazine-fallback.json");

function fail(message) {
  throw new Error(`[public-magazine-fallback] ${message}`);
}

function readEnvFileValue(key) {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.resolve(fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [name, ...rest] = trimmed.split("=");
      if (name.trim() !== key) continue;

      return rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }

  return "";
}

function envValue(key) {
  return process.env[key] || readEnvFileValue(key) || "";
}

function cleanStory(story) {
  return {
    id: String(story?.id || ""),
    slug: String(story?.slug || ""),
    title: String(story?.title || ""),
    section: String(story?.section || "Article"),
    dek: String(story?.dek || ""),
    author: String(story?.author || "WAKILISHA Editorial"),
    authorSlug: String(story?.authorSlug || ""),
    date: String(story?.date || ""),
    readingTime: Number(story?.readingTime || 3),
    heroUrl: String(story?.heroUrl || ""),
    tags: Array.isArray(story?.tags) ? story.tags.map(String).slice(0, 12) : [],
  };
}

if (!fs.existsSync(indexPath)) {
  fail(`Missing homepage HTML: ${indexPath}`);
}

const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");

if (!supabaseUrl || !anonKey) {
  fail("Missing VITE_PUBLIC_SUPABASE_URL or VITE_PUBLIC_SUPABASE_ANON_KEY.");
}

const endpoint = `${supabaseUrl}/functions/v1/public-content-read/magazine?limit=24`;

const response = await fetch(endpoint, {
  headers: {
    Accept: "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
});

if (!response.ok) {
  fail(`Magazine fallback API failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
const stories = (payload?.data?.stories || payload?.stories || [])
  .map(cleanStory)
  .filter((story) => story.id && story.slug && story.title);

if (stories.length === 0) {
  fail("Magazine fallback API returned zero stories.");
}

const fallback = {
  generatedAt: new Date().toISOString(),
  stories,
};

const fallbackJson = JSON.stringify(fallback);
fs.writeFileSync(fallbackPath, JSON.stringify(fallback, null, 2) + "\n");

const safeInlineJson = fallbackJson.replace(/</g, "\\u003c");
const inlineScript = `<script id="wk-magazine-fallback" type="application/json">${safeInlineJson}</script>`;

const magazineIndexPath = path.join(
  distDir,
  "magazine",
  "index.html",
);

if (!fs.existsSync(magazineIndexPath)) {
  fail(
    `Missing prerendered Magazine HTML: ${magazineIndexPath}`,
  );
}

const LCP_MEDIA_ORIGIN =
  "https://media.wakilisha.africa";

const LCP_HERO_WIDTHS = [
  640,
  768,
  960,
  1280,
  1600,
];

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function magazineHeroPreload(story) {
  const raw =
    String(
      story?.heroUrl || "",
    ).trim();

  if (!raw) {
    return "";
  }

  let parsed;

  try {
    parsed =
      raw.startsWith("/uploads/")
        ? new URL(
            raw,
            LCP_MEDIA_ORIGIN,
          )
        : new URL(raw);
  } catch {
    return "";
  }

  if (
    parsed.protocol === "https:"
    && parsed.hostname === "media.wakilisha.africa"
    && parsed.pathname.startsWith("/uploads/")
    && /\.(?:jpe?g|png|webp)$/i.test(
      parsed.pathname,
    )
  ) {
    const variant =
      (width) =>
        `${LCP_MEDIA_ORIGIN}/__image/w${width}${parsed.pathname}${parsed.search}`;

    const srcSet =
      LCP_HERO_WIDTHS
        .map(
          (width) =>
            `${variant(width)} ${width}w`,
        )
        .join(", ");

    return `<link rel="preload" as="image" href="${escapeAttr(
      variant(1280),
    )}" imagesrcset="${escapeAttr(
      srcSet,
    )}" imagesizes="100vw" fetchpriority="high" data-wakilisha-lcp-preload="magazine" data-wakilisha-lcp-path="/magazine" />`;
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return "";
  }

  return `<link rel="preload" as="image" href="${escapeAttr(
    parsed.href,
  )}" fetchpriority="high" data-wakilisha-lcp-preload="magazine" data-wakilisha-lcp-path="/magazine" />`;
}

const heroPreload =
  magazineHeroPreload(
    stories[0],
  );

if (!heroPreload) {
  fail(
    "Magazine fallback hero could not produce route-specific LCP preload authority.",
  );
}

function stripMagazineInlineAuthority(html) {
  return html
    .replace(
      /\s*<script id="wk-magazine-fallback" type="application\/json">[\s\S]*?<\/script>/g,
      "",
    )
    .replace(
      /\s*<link\b[^>]*data-wakilisha-lcp-preload=["']magazine["'][^>]*>/gi,
      "",
    );
}

function injectBeforeBody(
  html,
  additions,
  label,
) {
  if (!html.includes("</body>")) {
    fail(
      `${label} is missing </body>.`,
    );
  }

  return html.replace(
    "</body>",
    `${additions.map((item) => `  ${item}`).join("\n")}\n</body>`,
  );
}

const rootHtml =
  injectBeforeBody(
    stripMagazineInlineAuthority(
      fs.readFileSync(
        indexPath,
        "utf8",
      ),
    ),
    [
      inlineScript,
    ],
    "dist/index.html",
  );

fs.writeFileSync(
  indexPath,
  rootHtml,
);

const magazineHtml =
  injectBeforeBody(
    stripMagazineInlineAuthority(
      fs.readFileSync(
        magazineIndexPath,
        "utf8",
      ),
    ),
    [
      heroPreload,
      inlineScript,
    ],
    "dist/magazine/index.html",
  );

fs.writeFileSync(
  magazineIndexPath,
  magazineHtml,
);

console.log(`Magazine fallback generated: ${fallbackPath}`);
console.log(`Magazine fallback stories: ${stories.length}`);
console.log(
  "Magazine prerender first-visual authority: inline fallback + route-specific hero preload.",
);
