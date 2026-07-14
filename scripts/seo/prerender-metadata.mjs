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
const DB_METADATA_OUTPUT_PATH = path.join(DIST_DIR, "seo-metadata-manifest.json");

let DB_METADATA_BY_PATH = new Map();
let ARTICLE_IMAGE_BY_PATH = new Map();
let ARTICLE_METADATA_BY_PATH = new Map();
let ARTIST_METADATA_BY_PATH = new Map();
let RELEASE_METADATA_BY_PATH = new Map();
let TRACK_METADATA_BY_PATH = new Map();
let CHART_METADATA_BY_PATH = new Map();

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
  "/briefings": {
    title: "Email briefings and newsletters",
    description: "Subscribe to WAKILISHA briefings and newsletters covering charts, artists, field guides, labels, scenes, language, memory, and African creative life.",
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

async function fetchDbMetadataManifest() {
  const explicitUrl = envValue("SEO_METADATA_MANIFEST_URL");
  const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const metadataUrl = explicitUrl || (supabaseUrl ? `${supabaseUrl}/functions/v1/seo-sitemap-admin?action=metadata` : "");

  if (!metadataUrl) {
    console.warn("SEO metadata manifest skipped: no SEO_METADATA_MANIFEST_URL or VITE_PUBLIC_SUPABASE_URL.");
    return new Map();
  }

  try {
    const response = await fetch(metadataUrl, {
      headers: {
        Accept: "application/json",
        ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
      },
    });

    if (!response.ok) {
      console.warn(`SEO metadata manifest skipped: ${response.status} ${response.statusText}`);
      return new Map();
    }

    const payload = await response.json();
    const metadata = payload?.data?.metadata || payload?.metadata || {};
    const entries = Object.entries(metadata).map(([routePath, value]) => [cleanPath(routePath), value]);
    fs.writeFileSync(DB_METADATA_OUTPUT_PATH, JSON.stringify(metadata, null, 2) + "\n");

    console.log(`SEO metadata manifest loaded: ${entries.length.toLocaleString()} entries.`);
    return new Map(entries);
  } catch (error) {
    console.warn(`SEO metadata manifest skipped: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
}


function publicContentHeaders(anonKey) {
  return {
    Accept: "application/json",
    ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
  };
}

function articlePathFromSlug(slug) {
  const clean = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
  return clean ? `/magazine/${clean}` : "";
}

function publicArticleImage(article) {
  if (!article || typeof article !== "object") return "";

  const seo = article.seo && typeof article.seo === "object" ? article.seo : {};
  const meta = article.metadata && typeof article.metadata === "object" ? article.metadata : {};

  return firstNonEmpty(
    article.image,
    article.imageUrl,
    article.heroUrl,
    article.heroImageUrl,
    article.hero_image_url,
    article.featuredImageUrl,
    article.featured_image_url,
    article.coverImageUrl,
    article.cover_image_url,
    article.thumbnailUrl,
    article.thumbnail_url,
    seo.image,
    seo.imageUrl,
    seo.ogImage,
    seo.og_image,
    meta.image,
    meta.imageUrl,
    meta.heroUrl,
    meta.hero_image_url,
    meta.featured_image_url,
  );
}

async function fetchArticleImageManifest() {
  const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const explicitBase = envValue("VITE_PUBLIC_API_BASE").replace(/\/+$/, "");
  const apiBase = explicitBase || (supabaseUrl ? `${supabaseUrl}/functions/v1/public-content-read` : "");

  if (!apiBase) {
    explicitBase = envValue("VITE_PUBLIC_API_BASE").replace(/\/+$/, "");
  console.warn("Article image manifest skipped: no VITE_PUBLIC_API_BASE or VITE_PUBLIC_SUPABASE_URL.");
    return new Map();
  }

  try {
    const response = await fetch(`${apiBase}/magazine?limit=1000`, {
      headers: publicContentHeaders(anonKey),
    });

    if (!response.ok) {
      console.warn(`Article image manifest skipped: ${response.status} ${response.statusText}`);
      return new Map();
    }

    const payload = await response.json();
    const stories =
      payload?.data?.stories ||
      payload?.stories ||
      payload?.data ||
      [];

    const imageByPath = new Map();

    for (const story of Array.isArray(stories) ? stories : []) {
      const slug = firstNonEmpty(story.slug, story.path, story.url);
      const pagePath = articlePathFromSlug(slug);
      const image = publicArticleImage(story);
      if (pagePath && image) imageByPath.set(cleanPath(pagePath), image);
    }

    console.log(`Article image manifest loaded: ${imageByPath.size.toLocaleString()} article images.`);
    return imageByPath;
  } catch (error) {
    console.warn(`Article image manifest skipped: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
}

async function fetchArticleMetadataManifest() {
  const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const explicitBase = envValue("VITE_PUBLIC_API_BASE").replace(/\/+$/, "");
  const apiBase = explicitBase || (supabaseUrl ? `${supabaseUrl}/functions/v1/public-content-read` : "");

  if (!apiBase) {
    console.warn("Article metadata manifest skipped: no VITE_PUBLIC_API_BASE or VITE_PUBLIC_SUPABASE_URL.");
    return new Map();
  }

  try {
    const response = await fetch(`${apiBase}/magazine?limit=1000`, {
      headers: publicContentHeaders(anonKey),
    });

    if (!response.ok) {
      console.warn(`Article metadata manifest skipped: ${response.status} ${response.statusText}`);
      return new Map();
    }

    const payload = await response.json();
    const stories =
      payload?.data?.stories ||
      payload?.stories ||
      payload?.data ||
      [];

    const metadataByPath = new Map();

    for (const story of Array.isArray(stories) ? stories : []) {
      const slug = firstNonEmpty(story.slug, story.path, story.url);
      const pagePath = articlePathFromSlug(slug);
      if (!pagePath) continue;

      metadataByPath.set(cleanPath(pagePath), {
        id: firstNonEmpty(story.id),
        slug: firstNonEmpty(story.slug),
        title: firstNonEmpty(story.title),
        description: firstNonEmpty(story.dek, story.description, story.excerpt),
        author: firstNonEmpty(story.author, story.authorName, story.byline),
        authorSlug: firstNonEmpty(story.authorSlug, story.author_slug),
        date: firstNonEmpty(story.date, story.publishedAt, story.datePublished),
        modifiedAt: firstNonEmpty(story.modifiedAt, story.updatedAt, story.dateModified),
        image: publicArticleImage(story),
      });
    }

    console.log(`Article metadata manifest loaded: ${metadataByPath.size.toLocaleString()} article rows.`);
    return metadataByPath;
  } catch (error) {
    console.warn(`Article metadata manifest skipped: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
}

function mergeDbMetadata(model, pagePath) {
  const db = DB_METADATA_BY_PATH.get(cleanPath(pagePath));
  if (!db || typeof db !== "object") return model;

  // Only DB-backed entries should override local static SEO copy.
  // Static sitemap rows from the Edge Function do not have a source table/id and
  // are intentionally generic, so keep the richer local metadata for those.
  if (!db.sourceTable || !db.sourceId) return model;

  return {
    ...model,
    ...Object.fromEntries(
      Object.entries(db).filter(([, value]) => value !== null && value !== undefined && value !== "")
    ),
  };
}

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


function socialUrlListFromArtist(artist) {
  const urls = [
    artist.sameAs,
    artist.website,
    artist.websiteUrl,
    artist.spotifyUrl,
    artist.appleMusicUrl,
    artist.youtubeChannel,
    artist.youtubeUrl,
    artist.instagram,
    artist.instagramUrl,
    artist.twitter,
    artist.twitterUrl,
    artist.xUrl,
    artist.tiktok,
    artist.tiktokUrl,
    artist.facebook,
    artist.facebookUrl,
  ];

  return urls
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter((value) => /^https?:\/\//i.test(value));
}

async function fetchArtistMetadataManifest() {
  const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const explicitBase = envValue("VITE_PUBLIC_API_BASE").replace(/\/+$/, "");
  const apiBase = explicitBase || (supabaseUrl ? `${supabaseUrl}/functions/v1/public-content-read` : "");

  if (!apiBase) {
    console.warn("Artist metadata manifest skipped: no VITE_PUBLIC_API_BASE or VITE_PUBLIC_SUPABASE_URL.");
    return new Map();
  }

  try {
    const response = await fetch(`${apiBase}/artists?limit=3000`, {
      headers: publicContentHeaders(anonKey),
    });

    if (!response.ok) {
      console.warn(`Artist metadata manifest skipped: ${response.status} ${response.statusText}`);
      return new Map();
    }

    const payload = await response.json();
    const artists =
      payload?.data?.artists ||
      payload?.artists ||
      payload?.data ||
      [];

    const metadataByPath = new Map();

    for (const artist of Array.isArray(artists) ? artists : []) {
      const slug = firstNonEmpty(artist.slug, artist.path, artist.url);
      const cleanSlug = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
      if (!cleanSlug) continue;

      metadataByPath.set(cleanPath(`/artists/${cleanSlug}`), {
        id: firstNonEmpty(artist.id),
        slug: cleanSlug,
        name: firstNonEmpty(artist.name, artist.title),
        description: firstNonEmpty(artist.bio, artist.fullBio, artist.description),
        country: firstNonEmpty(artist.country, artist.countryCode, artist.country_code),
        image: firstNonEmpty(artist.imageUrl, artist.profileImageUrl, artist.image, artist.photoUrl, artist.avatarUrl),
        genres: Array.isArray(artist.genres) ? artist.genres.filter(Boolean) : [],
        sameAs: socialUrlListFromArtist(artist),
        trackCount: artist.trackCount,
        releaseCount: artist.releaseCount,
        isChartArtist: artist.isChartArtist,
        isRising: artist.isRising,
      });
    }

    console.log(`Artist metadata manifest loaded: ${metadataByPath.size.toLocaleString()} artist rows.`);
    return metadataByPath;
  } catch (error) {
    console.warn(`Artist metadata manifest skipped: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
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

  const brandedPattern = new RegExp(`\\s*[|–—-]\\s*${SITE_NAME}$`, "i");
  if (brandedPattern.test(clean)) {
    return clean.replace(brandedPattern, ` | ${SITE_NAME}`).trim();
  }

  return `${clean} | ${SITE_NAME}`;
}

function schemaEntityName(model) {
  const explicit = String(model.entityName || "").trim();
  if (explicit) return explicit;

  const clean = String(model.title || "").trim();
  const brandedPattern = new RegExp(`\\s*[|–—-]\\s*${SITE_NAME}$`, "i");
  return clean.replace(brandedPattern, "").trim() || SITE_NAME;
}

function canonicalUrl(pagePath) {
  const clean = cleanPath(pagePath);
  return `${SITE_URL}${clean === "/" ? "/" : clean}`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const clean = String(value ?? "").trim();
    if (clean) return clean;
  }
  return "";
}

function absoluteImageUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${SITE_URL}${value}`;
  return `${SITE_URL}/${value.replace(/^\/+/, "")}`;
}

function socialImageForModel(model) {
  const articleImage = ARTICLE_IMAGE_BY_PATH.get(cleanPath(model.canonicalPath));

  return absoluteImageUrl(firstNonEmpty(
    articleImage,
    model.image,
    model.imageUrl,
    model.heroUrl,
    model.heroImageUrl,
    model.hero_image_url,
    model.featuredImageUrl,
    model.featured_image_url,
    model.coverImageUrl,
    model.cover_image_url,
    model.thumbnailUrl,
    model.thumbnail_url,
    model.artworkUrl,
    model.artwork_url,
    model.posterUrl,
    model.poster_url,
    DEFAULT_IMAGE,
  ));
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


function compactSchema(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactSchema(item))
      .filter((item) => item !== undefined && item !== "" && !(Array.isArray(item) && item.length === 0));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compactSchema(item)])
      .filter(([, item]) => {
        if (item === undefined || item === "") return false;
        if (Array.isArray(item) && item.length === 0) return false;
        if (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) return false;
        return true;
      });

    return Object.fromEntries(entries);
  }

  return value;
}

function slugifySchema(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function schemaArtistEntity(name, slug) {
  const cleanName = firstNonEmpty(name);
  const cleanSlug = firstNonEmpty(slug, cleanName ? slugifySchema(cleanName) : "");

  if (!cleanName) return undefined;

  return compactSchema({
    "@type": "MusicGroup",
    name: cleanName,
    url: cleanSlug ? canonicalUrl(`/artists/${cleanSlug}`) : undefined,
  });
}

function schemaArtistEntitiesFromCredits(credits, fallbackName, fallbackSlug) {
  const artists = Array.isArray(credits) ? credits : [];
  const primary = artists.filter((artist) => artist?.isPrimary || artist?.role === "primary" || artist?.role === "primary_artist");
  const selected = primary.length ? primary : artists;

  const entities = selected
    .map((artist) => schemaArtistEntity(artist?.name, artist?.slug))
    .filter(Boolean);

  if (entities.length) return entities.length === 1 ? entities[0] : entities;

  return schemaArtistEntity(fallbackName, fallbackSlug);
}

function isoDurationFromSecondsOrMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";

  const totalSeconds = number > 10000 ? Math.round(number / 1000) : Math.round(number);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${seconds || (!hours && !minutes) ? `${seconds}S` : ""}`;
}

function publicContentApiBase() {
  const supabaseUrl = envValue("VITE_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const explicitBase = envValue("VITE_PUBLIC_API_BASE").replace(/\/+$/, "");
  return explicitBase || (supabaseUrl ? `${supabaseUrl}/functions/v1/public-content-read` : "");
}

async function fetchPublicContentJson(apiBase, anonKey, pagePath) {
  const response = await fetch(`${apiBase}${pagePath}`, {
    headers: publicContentHeaders(anonKey),
  });

  if (!response.ok) return null;
  return response.json();
}

function structuredDataTargetPaths(section) {
  return [...new Set([...readSitemapPaths(), ...DB_METADATA_BY_PATH.keys()].filter(isCanonicalPublicPath))]
    .map(cleanPath)
    .filter((pagePath) => pagePath.startsWith(`/${section}/`));
}

async function promisePool(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });

  await Promise.all(workers);
}

async function fetchReleaseMetadataManifest() {
  const apiBase = publicContentApiBase();
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const metadataByPath = new Map();

  if (!apiBase) {
    console.warn("Release metadata manifest skipped: no public content API base.");
    return metadataByPath;
  }

  const paths = structuredDataTargetPaths("releases").filter((pagePath) => pagePath.split("/").filter(Boolean).length === 3);

  await promisePool(paths, 6, async (pagePath) => {
    try {
      const payload = await fetchPublicContentJson(apiBase, anonKey, pagePath);
      const release = payload?.data?.release || payload?.release;
      if (!release) return;

      const parts = pagePath.split("/").filter(Boolean);
      const artistSlugFromPath = parts[1];

      metadataByPath.set(cleanPath(pagePath), {
        title: firstNonEmpty(release.title),
        artist: firstNonEmpty(release.artist),
        artistSlug: slugifySchema(firstNonEmpty(release.artist)) || artistSlugFromPath,
        releaseDate: firstNonEmpty(release.releaseDate, release.datePublished, release.year),
        image: firstNonEmpty(release.artworkUrl, release.imageUrl, release.coverImageUrl),
        releaseType: firstNonEmpty(release.releaseType),
        labelName: firstNonEmpty(release.labelName),
        trackCount: release.trackCount,
        tracks: Array.isArray(release.tracks) ? release.tracks : [],
      });
    } catch {
      return;
    }
  });

  console.log(`Release metadata manifest loaded: ${metadataByPath.size.toLocaleString()} release rows.`);
  return metadataByPath;
}

async function fetchTrackMetadataManifest() {
  const apiBase = publicContentApiBase();
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const metadataByPath = new Map();

  if (!apiBase) {
    console.warn("Track metadata manifest skipped: no public content API base.");
    return metadataByPath;
  }

  const paths = [
    ...new Set(
      [
        ...readSitemapPaths(),
        ...DB_METADATA_BY_PATH.keys(),
      ]
        .filter(isCanonicalPublicPath)
        .map(cleanPath),
    ),
  ].filter((pagePath) => {
    const parts = pagePath.split("/").filter(Boolean);

    return (
      (parts[0] === "tracks" && parts.length >= 3) ||
      (parts[0] === "releases" && parts.length >= 4)
    );
  });

  await promisePool(paths, 6, async (pagePath) => {
    try {
      const payload = await fetchPublicContentJson(apiBase, anonKey, pagePath);
      const data = payload?.data || payload;
      const track = data?.track;
      if (!track) return;

      const parts = pagePath.split("/").filter(Boolean);
      const artistSlugFromPath = parts[1];
      const primaryArtist = data?.artist || {};
      const release = data?.release || {};

      metadataByPath.set(cleanPath(pagePath), {
        title: firstNonEmpty(track.title),
        image: firstNonEmpty(track.artworkUrl, release.artworkUrl),
        duration: firstNonEmpty(track.durationMs, track.duration),
        isrc: firstNonEmpty(track.isrc, track.isrcCode),
        artists: Array.isArray(data?.artists) ? data.artists : [],
        primaryArtistName: firstNonEmpty(primaryArtist.name),
        primaryArtistSlug: firstNonEmpty(primaryArtist.slug, artistSlugFromPath),
        releaseTitle: firstNonEmpty(release.title),
        releaseSlug: firstNonEmpty(release.slug),
        releaseDate: firstNonEmpty(release.releaseDate),
        releaseType: firstNonEmpty(release.releaseType),
      });
    } catch {
      return;
    }
  });

  console.log(`Track metadata manifest loaded: ${metadataByPath.size.toLocaleString()} track rows.`);
  return metadataByPath;
}

async function fetchChartMetadataManifest() {
  const apiBase = publicContentApiBase();
  const anonKey = envValue("VITE_PUBLIC_SUPABASE_ANON_KEY");
  const metadataByPath = new Map();

  if (!apiBase) {
    console.warn("Chart metadata manifest skipped: no public content API base.");
    return metadataByPath;
  }

  const paths = structuredDataTargetPaths("charts").filter((pagePath) => pagePath.split("/").filter(Boolean).length >= 4);

  await promisePool(paths, 4, async (pagePath) => {
    try {
      const payload = await fetchPublicContentJson(apiBase, anonKey, pagePath);
      const data = payload?.data || payload;
      const program = data?.program || {};
      const edition = data?.edition || {};
      const entries = Array.isArray(data?.entries) ? data.entries : [];

      if (!entries.length) return;

      metadataByPath.set(cleanPath(pagePath), {
        name: firstNonEmpty(program.publicLabel, program.shortLabel, edition.label),
        date: firstNonEmpty(edition.date, edition.periodStart),
        entries,
      });
    } catch {
      return;
    }
  });

  console.log(`Chart metadata manifest loaded: ${metadataByPath.size.toLocaleString()} chart rows.`);
  return metadataByPath;
}


function pageSchema(model, url) {
  const entityName = schemaEntityName(model);
  const base = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: formatPageTitle(model.title),
    description: model.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  if (model.kind === "article") {
    const articleMeta = ARTICLE_METADATA_BY_PATH.get(cleanPath(model.canonicalPath)) || {};
    const image = socialImageForModel(model);
    const authorName = firstNonEmpty(model.author, model.authorName, model.byline, articleMeta.author, "WAKILISHA Editorial");
    const authorSlug = firstNonEmpty(model.authorSlug, model.author_slug, articleMeta.authorSlug);
    const publishedAt = firstNonEmpty(model.publishedAt, model.datePublished, model.date, articleMeta.date);
    const modifiedAt = firstNonEmpty(model.modifiedAt, model.updatedAt, model.dateModified, articleMeta.modifiedAt, publishedAt);
    const article = {
      ...base,
      "@type": "Article",
      "@id": `${url}#article`,
      headline: entityName,
      description: firstNonEmpty(model.description, articleMeta.description),
      image: image ? [image] : undefined,
      author: {
        "@type": "Person",
        name: authorName,
        ...(authorSlug ? { url: canonicalUrl(`/authors/${authorSlug}`) } : {}),
      },
      datePublished: publishedAt || undefined,
      dateModified: modifiedAt || undefined,
      publisher: { "@id": `${SITE_URL}/#organization` },
      mainEntityOfPage: url,
    };

    return Object.fromEntries(Object.entries(article).filter(([, value]) => value !== undefined && value !== ""));
  }
  if (model.kind === "artist") {
    const artistMeta = ARTIST_METADATA_BY_PATH.get(cleanPath(model.canonicalPath)) || {};
    const image = firstNonEmpty(model.image, artistMeta.image, socialImageForModel(model));
    const description = firstNonEmpty(model.description, artistMeta.description);
    const genres = Array.isArray(artistMeta.genres) ? artistMeta.genres.filter(Boolean) : [];
    const sameAs = Array.isArray(artistMeta.sameAs) ? artistMeta.sameAs.filter(Boolean) : [];
    const country = firstNonEmpty(model.country, artistMeta.country);
    const artistEntity = {
      "@type": "MusicGroup",
      "@id": `${url}#artist`,
      name: firstNonEmpty(model.entityName, model.title, artistMeta.name, entityName),
      url,
      description,
      image: image || undefined,
      genre: genres.length ? genres : undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      homeLocation: country ? { "@type": "Country", name: country } : undefined,
      interactionStatistic: [
        Number.isFinite(Number(artistMeta.trackCount))
          ? {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/ListenAction",
              userInteractionCount: Number(artistMeta.trackCount),
              name: "Tracks on WAKILISHA",
            }
          : undefined,
        Number.isFinite(Number(artistMeta.releaseCount))
          ? {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/DiscoverAction",
              userInteractionCount: Number(artistMeta.releaseCount),
              name: "Releases on WAKILISHA",
            }
          : undefined,
      ].filter(Boolean),
    };

    const cleanArtistEntity = Object.fromEntries(
      Object.entries(artistEntity).filter(([, value]) => {
        if (value === undefined || value === "") return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
    );

    return {
      ...base,
      "@type": "ProfilePage",
      image: image || undefined,
      about: cleanArtistEntity,
      mainEntity: cleanArtistEntity,
    };
  }
  if (model.kind === "track") {
    const trackMeta = TRACK_METADATA_BY_PATH.get(cleanPath(model.canonicalPath)) || {};
    const parts = cleanPath(model.canonicalPath).split("/").filter(Boolean);
    const artistSlugFromPath = parts[1];
    const image = firstNonEmpty(model.image, trackMeta.image, socialImageForModel(model));
    const byArtist = schemaArtistEntitiesFromCredits(trackMeta.artists, trackMeta.primaryArtistName, trackMeta.primaryArtistSlug || artistSlugFromPath);
    const releaseArtistSlug = firstNonEmpty(trackMeta.primaryArtistSlug, artistSlugFromPath);
    const recording = compactSchema({
      "@type": "MusicRecording",
      "@id": `${url}#recording`,
      name: firstNonEmpty(model.entityName, model.title, trackMeta.title, entityName),
      url,
      description: model.description,
      image: image || undefined,
      byArtist,
      inAlbum: trackMeta.releaseTitle ? {
        "@type": "MusicAlbum",
        name: trackMeta.releaseTitle,
        url: trackMeta.releaseSlug && releaseArtistSlug ? canonicalUrl(`/releases/${releaseArtistSlug}/${trackMeta.releaseSlug}`) : undefined,
        datePublished: trackMeta.releaseDate || undefined,
      } : undefined,
      duration: isoDurationFromSecondsOrMs(trackMeta.duration),
      isrcCode: trackMeta.isrc || undefined,
    });

    return compactSchema({
      ...base,
      image: image || undefined,
      about: recording,
      mainEntity: recording,
    });
  }
  if (model.kind === "release") {
    const releaseMeta = RELEASE_METADATA_BY_PATH.get(cleanPath(model.canonicalPath)) || {};
    const image = firstNonEmpty(model.image, releaseMeta.image, socialImageForModel(model));
    const byArtist = schemaArtistEntity(releaseMeta.artist, releaseMeta.artistSlug);
    const tracks = Array.isArray(releaseMeta.tracks) ? releaseMeta.tracks : [];
    const album = compactSchema({
      "@type": "MusicAlbum",
      "@id": `${url}#album`,
      name: firstNonEmpty(model.entityName, model.title, releaseMeta.title, entityName),
      url,
      description: firstNonEmpty(model.description),
      image: image || undefined,
      byArtist,
      datePublished: releaseMeta.releaseDate || undefined,
      numTracks: Number.isFinite(Number(releaseMeta.trackCount)) ? Number(releaseMeta.trackCount) : undefined,
      recordLabel: releaseMeta.labelName ? { "@type": "Organization", name: releaseMeta.labelName } : undefined,
      track: tracks.map((track) => compactSchema({
        "@type": "MusicRecording",
        name: firstNonEmpty(track.title),
        position: Number.isFinite(Number(track.trackNumber)) ? Number(track.trackNumber) : undefined,
        byArtist: track.artist ? { "@type": "MusicGroup", name: track.artist } : byArtist,
        image: firstNonEmpty(track.artworkUrl, image) || undefined,
        duration: isoDurationFromSecondsOrMs(firstNonEmpty(track.duration, track.durationMs)),
      })).filter((track) => track.name),
    });

    return compactSchema({
      ...base,
      "@type": "WebPage",
      image: image || undefined,
      about: album,
      mainEntity: album,
    });
  }
  if (model.kind === "chart" || model.kind === "collection") {
    const chartMeta = CHART_METADATA_BY_PATH.get(cleanPath(model.canonicalPath)) || {};
    const entries = Array.isArray(chartMeta.entries) ? chartMeta.entries : [];
    const itemList = compactSchema({
      "@type": "ItemList",
      "@id": `${url}#itemlist`,
      name: firstNonEmpty(chartMeta.name, entityName),
      datePublished: chartMeta.date || undefined,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: entries.length || undefined,
      itemListElement: entries.map((entry) => {
        const artistSlug = Array.isArray(entry.artistSlugs) ? entry.artistSlugs[0] : "";
        const artistName = Array.isArray(entry.artistNames) ? entry.artistNames.join(", ") : "";
        const trackUrl = artistSlug && entry.trackSlug ? canonicalUrl(`/tracks/${artistSlug}/${entry.trackSlug}`) : undefined;

        return compactSchema({
          "@type": "ListItem",
          position: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : undefined,
          url: trackUrl,
          item: {
            "@type": "MusicRecording",
            name: firstNonEmpty(entry.trackTitle),
            url: trackUrl,
            image: firstNonEmpty(entry.artworkUrl) || undefined,
            byArtist: artistName ? { "@type": "MusicGroup", name: artistName } : undefined,
          },
        });
      }).filter((item) => item.position && item.item?.name),
    });

    return compactSchema({
      ...base,
      "@type": "CollectionPage",
      mainEntity: itemList.itemListElement?.length ? itemList : undefined,
    });
  }
  if (model.kind === "profile") return { ...base, "@type": "ProfilePage", about: { "@type": "Person", name: entityName } };

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

  if (section === "releases" && parts.length >= 4) {
    const artist = titleCase(parts[1]);
    const track = titleCase(parts[3]);
    return {
      title: `${track} by ${artist}`,
      description: firstSentence(`Explore ${track} by ${artist} on WAKILISHA, including release context, credits, chart context, and music metadata.`),
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
    .replace(/\n?\s*<meta\s+name="(?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image|twitter:image:alt|twitter:site)"[^>]*>/gi, "")
    .replace(/\n?\s*<meta\s+property="(?:og:site_name|og:title|og:description|og:type|og:url|og:image|og:image:secure_url|og:image:width|og:image:height|og:image:alt)"[^>]*>/gi, "")
    .replace(/\n?\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\n?\s*<script\s+id="wk-jsonld-primary"[^>]*>[\s\S]*?<\/script>/gi, "");
}

function seoBlockForPath(pagePath) {
  const model = mergeDbMetadata(modelFromPath(pagePath), pagePath);
  const url = canonicalUrl(model.canonicalPath);
  const title = formatPageTitle(model.title);
  const image = socialImageForModel(model);
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
    <meta property="og:image:secure_url" content="${escapeAttr(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeAttr(schemaEntityName(model))}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@wakilisha" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(model.description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    <meta name="twitter:image:alt" content="${escapeAttr(schemaEntityName(model))}" />
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

function isCanonicalPublicPath(pagePath) {
  const clean = cleanPath(pagePath);
  const parts = clean.split("/").filter(Boolean);

  if (parts[0] === "tracks") {
    return parts.length >= 3;
  }

  return true;
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
    .filter((page) => !page.includes("/admin") && !page.includes("/auth") && !page.includes("/preview"))
    .filter(isCanonicalPublicPath);

  const extraPaths = readExtraRouteManifest();
  return [...new Set(["/", ...paths, ...extraPaths, ...EXTRA_NOINDEX_PATHS.map(cleanPath)])];
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error("dist/index.html was not found. Run vite build first.");
  }

  DB_METADATA_BY_PATH = await fetchDbMetadataManifest();
  ARTICLE_IMAGE_BY_PATH = await fetchArticleImageManifest();
  ARTICLE_METADATA_BY_PATH = await fetchArticleMetadataManifest();
  ARTIST_METADATA_BY_PATH = await fetchArtistMetadataManifest();
  RELEASE_METADATA_BY_PATH = await fetchReleaseMetadataManifest();
  TRACK_METADATA_BY_PATH = await fetchTrackMetadataManifest();
  CHART_METADATA_BY_PATH = await fetchChartMetadataManifest();

  const baseHtml = fs.readFileSync(INDEX_PATH, "utf8");
  const paths = [...new Set([...readSitemapPaths(), ...DB_METADATA_BY_PATH.keys()].filter(isCanonicalPublicPath))];

  let written = 0;

  for (const pagePath of paths) {
    const outputPath = publicPathToFile(pagePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, htmlForPath(baseHtml, pagePath));
    written += 1;
  }

  console.log(`SEO prerender complete: ${written.toLocaleString()} HTML files written.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
