import fs from "node:fs";
import path from "node:path";

const SITE_NAME = "WAKILISHA";
const SITE_URL = "https://wakilisha.africa";
const DEFAULT_IMAGE = `${SITE_URL}/assets/logos/wakilisha-logo-dark.svg`;
const DEFAULT_DESCRIPTION =
  "WAKILISHA maps African music culture through charts, artists, releases, guides, and stories from the continent and diaspora.";

const DIST_DIR = path.resolve("dist");
const INDEX_PATH = path.join(DIST_DIR, "index.html");
const SITEMAP_PATH = path.join(DIST_DIR, "sitemap.xml");
const ROUTE_MANIFEST_PATH = path.resolve("public/seo-prerender-routes.txt");

const EXTRA_NOINDEX_PATHS = [
  "/search",
  "/admin",
  "/admin/settings",
  "/admin/settings/seo",
  "/auth",
  "/profile",
  "/player/full",
  "/preview",
];

const STATIC_ROUTES = {
  "/": {
    title: "African music charts, stories and culture",
    description: DEFAULT_DESCRIPTION,
    robots: "index, follow",
    ogType: "website",
    kind: "home",
  },
  "/charts": {
    title: "African music charts",
    description: "Explore WAKILISHA charts across African music scenes, markets, artists, tracks, and releases.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/artists": {
    title: "African artists",
    description: "Discover artists shaping African music, from emerging voices to established names across the continent and diaspora.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/releases": {
    title: "African music releases",
    description: "Browse albums, EPs, singles, and releases from artists across African music culture.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/genres": {
    title: "Genres",
    description: "Explore African music genres, scenes, sounds, and cultural movements on WAKILISHA.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/labels": {
    title: "Labels",
    description: "Explore record labels and music companies connected to African music culture.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/guides": {
    title: "Guides",
    description: "Read WAKILISHA guides for navigating African music scenes, artists, songs, releases, and culture.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/categories": {
    title: "Categories",
    description: "Browse WAKILISHA stories and culture coverage by category.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/tags": {
    title: "Tags",
    description: "Browse WAKILISHA stories and culture coverage by tag.",
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
  },
  "/about": {
    title: "About",
    description: "Learn about WAKILISHA and how it maps African music culture through data, stories, and context.",
    robots: "index, follow",
    ogType: "website",
    kind: "utility",
  },
  "/contact": {
    title: "Contact",
    description: "Contact WAKILISHA for editorial, partnerships, corrections, and platform enquiries.",
    robots: "index, follow",
    ogType: "website",
    kind: "utility",
  },
  "/faqs": {
    title: "FAQs",
    description: "Frequently asked questions about WAKILISHA, charts, registry pages, music coverage, and platform features.",
    robots: "index, follow",
    ogType: "website",
    kind: "utility",
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "Read the WAKILISHA privacy policy.",
    robots: "index, follow",
    ogType: "website",
    kind: "legal",
  },
  "/terms": {
    title: "Terms",
    description: "Read the WAKILISHA terms of use.",
    robots: "index, follow",
    ogType: "website",
    kind: "legal",
  },
  "/api-docs": {
    title: "API Docs",
    description: "Explore WAKILISHA public API documentation.",
    robots: "index, follow",
    ogType: "website",
    kind: "utility",
  },
  "/search": {
    title: "Search",
    description: "Search WAKILISHA artists, tracks, releases, charts, guides, and stories.",
    robots: "noindex, follow",
    ogType: "website",
    kind: "utility",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanPath(input) {
  const clean = String(input || "/").split("?")[0].split("#")[0].replace(/\/+$/, "");
  return clean || "/";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstSentence(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > 158 ? `${clean.slice(0, 155).trim()}...` : clean;
}

function formatPageTitle(title) {
  const clean = String(title || "").trim();
  if (!clean || clean.toUpperCase() === SITE_NAME) return SITE_NAME;
  return `${clean} | ${SITE_NAME}`;
}

function canonicalUrl(pagePath) {
  const clean = cleanPath(pagePath);
  return `${SITE_URL}${clean === "/" ? "/" : clean}`;
}

function breadcrumbItems(pagePath) {
  const clean = cleanPath(pagePath);
  const parts = clean.split("/").filter(Boolean);

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: SITE_NAME,
      item: `${SITE_URL}/`,
    },
  ];

  let running = "";
  parts.forEach((part, index) => {
    running += `/${part}`;
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: titleCase(part),
      item: canonicalUrl(running),
    });
  });

  return items;
}

function pageSchema(model, url) {
  const base = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: formatPageTitle(model.title),
    description: model.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  if (model.kind === "article") return { ...base, "@type": "Article", headline: model.title };
  if (model.kind === "artist") return { ...base, "@type": "ProfilePage", about: { "@type": "MusicGroup", name: model.title } };
  if (model.kind === "track") return { ...base, "@type": "MusicRecording", name: model.title };
  if (model.kind === "release") return { ...base, "@type": "MusicAlbum", name: model.title };
  if (model.kind === "chart" || model.kind === "collection") return { ...base, "@type": "CollectionPage" };
  if (model.kind === "profile") return { ...base, "@type": "ProfilePage" };

  return base;
}

function buildJsonLd(model) {
  const url = canonicalUrl(model.canonicalPath);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: DEFAULT_IMAGE,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      pageSchema(model, url),
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: breadcrumbItems(model.canonicalPath),
      },
    ],
  };
}

function modelFromPath(pagePath) {
  const page = cleanPath(pagePath);

  if (STATIC_ROUTES[page]) {
    return { ...STATIC_ROUTES[page], canonicalPath: page };
  }

  const parts = page.split("/").filter(Boolean);
  const section = parts[0] || "";

  const noIndexSections = new Set(["admin", "auth", "settings", "profile", "preview", "player", "briefing"]);

  if (noIndexSections.has(section) || page.includes("/lyrics/contribute")) {
    return {
      title: parts.length ? titleCase(parts[parts.length - 1] || section) : SITE_NAME,
      description: "This WAKILISHA page is not intended for public search indexing.",
      canonicalPath: page,
      robots: "noindex, nofollow",
      ogType: "website",
      kind: "utility",
    };
  }

  if (section === "magazine" && parts[1]) {
    const title = titleCase(parts[1]);
    return {
      title,
      description: firstSentence(`Read ${title} on WAKILISHA, with context from African music, charts, artists, and culture.`),
      canonicalPath: page,
      robots: "index, follow",
      ogType: "article",
      kind: "article",
    };
  }

  if (section === "artists" && parts[1]) {
    const title = titleCase(parts[1]);
    return {
      title,
      description: firstSentence(`Explore ${title} on WAKILISHA, including music, releases, chart context, and cultural signals.`),
      canonicalPath: page,
      robots: "index, follow",
      ogType: "profile",
      kind: "artist",
    };
  }

  if (section === "tracks" && parts.length >= 3) {
    const artist = titleCase(parts[1]);
    const track = titleCase(parts[2]);
    return {
      title: `${track} by ${artist}`,
      description: firstSentence(`Explore ${track} by ${artist} on WAKILISHA, including chart context, credits, and music metadata.`),
      canonicalPath: page,
      robots: "index, follow",
      ogType: "music.song",
      kind: "track",
    };
  }

  if (section === "releases" && parts.length >= 3) {
    const artist = titleCase(parts[1]);
    const release = titleCase(parts[2]);
    return {
      title: `${release} by ${artist}`,
      description: firstSentence(`Explore ${release} by ${artist} on WAKILISHA, including release context, tracks, credits, and music metadata.`),
      canonicalPath: page,
      robots: "index, follow",
      ogType: "music.album",
      kind: "release",
    };
  }

  if (section === "charts") {
    const title = parts.length > 1 ? titleCase(parts[parts.length - 1] || "Charts") : "Charts";
    return {
      title: `${title} chart`,
      description: firstSentence(`Explore the ${title} chart on WAKILISHA, including ranked tracks, artists, movement, and cultural context.`),
      canonicalPath: page,
      robots: "index, follow",
      ogType: "website",
      kind: "chart",
    };
  }

  if (["genres", "labels", "categories", "tags", "authors", "guides", "u"].includes(section) && parts[1]) {
    const title = titleCase(parts[1]);
    const kind = section === "u" ? "profile" : section === "guides" ? "guide" : "collection";

    return {
      title,
      description: firstSentence(`Explore ${title} on WAKILISHA, with related music, stories, artists, releases, and cultural context.`),
      canonicalPath: page,
      robots: "index, follow",
      ogType: section === "u" ? "profile" : "website",
      kind,
    };
  }

  const fallbackTitle = titleCase(parts[parts.length - 1] || SITE_NAME);

  return {
    title: fallbackTitle,
    description: firstSentence(`${fallbackTitle} on WAKILISHA, mapping African music culture through data, stories, artists, charts, and releases.`),
    canonicalPath: page,
    robots: "index, follow",
    ogType: "website",
    kind: "article",
  };
}

function stripExistingSeo(html) {
  return html
    .replace(/\n?\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\n?\s*<meta\s+name="(?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)"[^>]*>/gi, "")
    .replace(/\n?\s*<meta\s+property="(?:og:site_name|og:title|og:description|og:type|og:url|og:image)"[^>]*>/gi, "")
    .replace(/\n?\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\n?\s*<script\s+id="wk-jsonld-primary"[^>]*>[\s\S]*?<\/script>/gi, "");
}

function seoBlockForPath(pagePath) {
  const model = modelFromPath(pagePath);
  const url = canonicalUrl(model.canonicalPath);
  const title = formatPageTitle(model.title);
  const image = DEFAULT_IMAGE;
  const jsonLd = JSON.stringify(buildJsonLd(model)).replace(/</g, "\\u003c");

  return `    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(model.description)}" />
    <meta name="robots" content="${escapeAttr(model.robots)}" />
    <link rel="canonical" href="${escapeAttr(url)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(model.description)}" />
    <meta property="og:type" content="${escapeAttr(model.ogType)}" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(model.description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    <script id="wk-jsonld-primary" type="application/ld+json">${jsonLd}</script>`;
}

function htmlForPath(baseHtml, pagePath) {
  const stripped = stripExistingSeo(baseHtml);
  const block = seoBlockForPath(pagePath);

  if (!stripped.includes("</head>")) {
    throw new Error("dist/index.html is missing </head>");
  }

  return stripped.replace("</head>", `${block}\n  </head>`);
}

function publicPathToFile(pagePath) {
  const clean = cleanPath(pagePath);
  if (clean === "/") return INDEX_PATH;

  const safe = clean
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part).replace(/[^a-zA-Z0-9._-]/g, "-"))
    .join(path.sep);

  return path.join(DIST_DIR, safe, "index.html");
}

function readExtraRouteManifest() {
  if (!fs.existsSync(ROUTE_MANIFEST_PATH)) return [];

  return fs
    .readFileSync(ROUTE_MANIFEST_PATH, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(cleanPath);
}

function readSitemapPaths() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    throw new Error("dist/sitemap.xml was not found. Build must copy public/sitemap.xml first.");
  }

  const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gims)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  const paths = matches
    .map((loc) => {
      try {
        const url = new URL(loc);
        if (url.hostname !== "wakilisha.africa") return null;
        return cleanPath(url.pathname);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((page) => !page.includes("/admin") && !page.includes("/auth") && !page.includes("/preview"));

  const extraPaths = readExtraRouteManifest();
  return [...new Set(["/", ...paths, ...extraPaths, ...EXTRA_NOINDEX_PATHS.map(cleanPath)])];
}

function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error("dist/index.html was not found. Run vite build first.");
  }

  const baseHtml = fs.readFileSync(INDEX_PATH, "utf8");
  const paths = readSitemapPaths();

  let written = 0;

  for (const pagePath of paths) {
    const outputPath = publicPathToFile(pagePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, htmlForPath(baseHtml, pagePath));
    written += 1;
  }

  console.log(`SEO prerender complete: ${written.toLocaleString()} HTML files written.`);
}

main();
