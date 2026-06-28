import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "WAKILISHA";
const SITE_URL = "https://wakilisha.africa";
const DEFAULT_IMAGE = `${SITE_URL}/assets/logos/wakilisha-logo-dark.svg`;
const DEFAULT_DESCRIPTION =
  "WAKILISHA maps African music culture through charts, artists, releases, guides, and stories from the continent and diaspora.";

type SeoRobots = "index, follow" | "noindex, follow" | "noindex, nofollow";

type SeoKind =
  | "home"
  | "collection"
  | "article"
  | "artist"
  | "track"
  | "release"
  | "chart"
  | "guide"
  | "profile"
  | "utility"
  | "legal"
  | "notFound";

interface SeoModel {
  title: string;
  description: string;
  canonicalPath: string;
  robots: SeoRobots;
  ogType: "website" | "article" | "profile" | "music.song" | "music.album";
  kind: SeoKind;
  image?: string;
  entityName?: string;
  jsonLd: Record<string, unknown>[];
}

const STATIC_ROUTES: Record<string, Omit<SeoModel, "canonicalPath" | "jsonLd">> = {
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
  "/library": {
    title: "The WAKILISHA Library",
    description: "The WAKILISHA Library preserves the principles, Inquiries, Field Notes, and institutional memory that guide the work.",
    robots: "noindex, follow",
    ogType: "website",
    kind: "utility",
  },
};

function cleanPath(pathname: string): string {
  const clean = pathname.split("?")[0]?.split("#")[0] || "/";
  const trimmed = clean.replace(/\/+$/, "");
  return trimmed || "/";
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstSentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 158 ? `${clean.slice(0, 155).trim()}...` : clean;
}

function formatPageTitle(title?: string | null): string {
  const clean = String(title || "").trim();

  if (!clean || clean.toUpperCase() === SITE_NAME) {
    return SITE_NAME;
  }

  const brandedPattern = new RegExp(`\\s*[|–—-]\\s*${SITE_NAME}$`, "i");
  if (brandedPattern.test(clean)) {
    return clean.replace(brandedPattern, ` | ${SITE_NAME}`).trim();
  }

  return `${clean} | ${SITE_NAME}`;
}

function schemaEntityName(model: SeoModel): string {
  const explicit = String(model.entityName || "").trim();
  if (explicit) return explicit;

  const clean = String(model.title || "").trim();
  const brandedPattern = new RegExp(`\\s*[|–—-]\\s*${SITE_NAME}$`, "i");
  return clean.replace(brandedPattern, "").trim() || SITE_NAME;
}

function canonicalUrl(path: string): string {
  const clean = cleanPath(path);
  return `${SITE_URL}${clean === "/" ? "/" : clean}`;
}

function breadcrumbItems(path: string) {
  const clean = cleanPath(path);
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

function pageSchema(model: SeoModel, url: string): Record<string, unknown> {
  const entityName = schemaEntityName(model);
  const base = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: formatPageTitle(model.title),
    description: model.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  if (model.kind === "article") return { ...base, "@type": "Article", headline: entityName };
  if (model.kind === "artist") return { ...base, "@type": "ProfilePage", about: { "@type": "MusicGroup", name: entityName } };
  if (model.kind === "track") return { ...base, about: { "@type": "MusicRecording", name: entityName } };
  if (model.kind === "release") return { ...base, about: { "@type": "MusicAlbum", name: entityName } };
  if (model.kind === "chart" || model.kind === "collection") return { ...base, "@type": "CollectionPage" };
  if (model.kind === "profile") return { ...base, "@type": "ProfilePage", about: { "@type": "Person", name: entityName } };

  return base;
}

function buildJsonLd(model: SeoModel): Record<string, unknown>[] {
  const url = canonicalUrl(model.canonicalPath);

  return [
    {
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
    },
  ];
}

function modelFromPath(pathname: string): SeoModel {
  const path = cleanPath(pathname);

  if (STATIC_ROUTES[path]) {
    const base = STATIC_ROUTES[path];
    return { ...base, canonicalPath: path, jsonLd: [] };
  }

  const parts = path.split("/").filter(Boolean);
  const section = parts[0] || "";

  const noIndexSections = new Set([
    "admin",
    "auth",
    "settings",
    "profile",
    "preview",
    "player",
    "briefing",
    "library",
  ]);

  if (noIndexSections.has(section) || path.includes("/lyrics/contribute")) {
    return {
      title: parts.length ? titleCase(parts[parts.length - 1] || section) : SITE_NAME,
      description: "This WAKILISHA page is not intended for public search indexing.",
      canonicalPath: path,
      robots: "noindex, nofollow",
      ogType: "website",
      kind: "utility",
      jsonLd: [],
    };
  }

  if (section === "magazine" && parts[1]) {
    const title = titleCase(parts[1]);
    return {
      title,
      description: firstSentence(`Read ${title} on WAKILISHA, with context from African music, charts, artists, and culture.`),
      canonicalPath: path,
      robots: "index, follow",
      ogType: "article",
      kind: "article",
      jsonLd: [],
    };
  }

  if (section === "artists" && parts[1]) {
    const title = titleCase(parts[1]);
    return {
      title,
      description: firstSentence(`Explore ${title} on WAKILISHA, including music, releases, chart context, and cultural signals.`),
      canonicalPath: path,
      robots: "index, follow",
      ogType: "profile",
      kind: "artist",
      jsonLd: [],
    };
  }

  if (section === "tracks" && parts.length >= 3) {
    const artist = titleCase(parts[1]);
    const track = titleCase(parts[2]);
    return {
      title: `${track} by ${artist}`,
      description: firstSentence(`Explore ${track} by ${artist} on WAKILISHA, including chart context, credits, and music metadata.`),
      canonicalPath: path,
      robots: "index, follow",
      ogType: "music.song",
      kind: "track",
      jsonLd: [],
    };
  }

  if (section === "releases" && parts.length >= 3) {
    const artist = titleCase(parts[1]);
    const release = titleCase(parts[2]);
    return {
      title: `${release} by ${artist}`,
      description: firstSentence(`Explore ${release} by ${artist} on WAKILISHA, including release context, tracks, credits, and music metadata.`),
      canonicalPath: path,
      robots: "index, follow",
      ogType: "music.album",
      kind: "release",
      jsonLd: [],
    };
  }

  if (section === "charts") {
    const title = parts.length > 1 ? titleCase(parts[parts.length - 1] || "Charts") : "Charts";
    return {
      title: `${title} chart`,
      description: firstSentence(`Explore the ${title} chart on WAKILISHA, including ranked tracks, artists, movement, and cultural context.`),
      canonicalPath: path,
      robots: "index, follow",
      ogType: "website",
      kind: "chart",
      jsonLd: [],
    };
  }

  if (["genres", "labels", "categories", "tags", "authors", "guides", "u"].includes(section) && parts[1]) {
    const title = titleCase(parts[1]);
    const kind: SeoKind = section === "u" ? "profile" : section === "guides" ? "guide" : "collection";

    return {
      title,
      description: firstSentence(`Explore ${title} on WAKILISHA, with related music, stories, artists, releases, and cultural context.`),
      canonicalPath: path,
      robots: "index, follow",
      ogType: section === "u" ? "profile" : "website",
      kind,
      jsonLd: [],
    };
  }

  const fallbackTitle = titleCase(parts[parts.length - 1] || SITE_NAME);

  return {
    title: fallbackTitle,
    description: firstSentence(`${fallbackTitle} on WAKILISHA, mapping African music culture through data, stories, artists, charts, and releases.`),
    canonicalPath: path,
    robots: "index, follow",
    ogType: "website",
    kind: "article",
    jsonLd: [],
  };
}

function setMetaByName(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", url);
}

function setJsonLd(models: Record<string, unknown>[]) {
  const id = "wk-jsonld-primary";
  let element = document.getElementById(id) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(models.length === 1 ? models[0] : models);
}

export function titleFromPath(pathname: string): string {
  return modelFromPath(pathname).title;
}

export function setPageTitle(title?: string | null): void {
  document.title = formatPageTitle(title);
}

export function applySeoMetadata(pathname: string): SeoModel {
  const model = modelFromPath(pathname);
  const url = canonicalUrl(model.canonicalPath);
  const title = formatPageTitle(model.title);
  const image = model.image || DEFAULT_IMAGE;
  const jsonLd = buildJsonLd(model);

  document.title = title;

  setMetaByName("description", model.description);
  setMetaByName("robots", model.robots);
  setMetaByName("twitter:card", "summary_large_image");
  setMetaByName("twitter:title", title);
  setMetaByName("twitter:description", model.description);
  setMetaByName("twitter:image", image);

  setMetaByProperty("og:site_name", SITE_NAME);
  setMetaByProperty("og:title", title);
  setMetaByProperty("og:description", model.description);
  setMetaByProperty("og:type", model.ogType);
  setMetaByProperty("og:url", url);
  setMetaByProperty("og:image", image);

  setCanonical(url);
  setJsonLd(jsonLd);

  return { ...model, jsonLd };
}

export function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    applySeoMetadata(location.pathname);
  }, [location.pathname]);

  return null;
}
