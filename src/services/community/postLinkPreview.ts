import { supabase } from "@/lib/supabase";
import {
  getArticle,
  type PublicArticleDetail,
} from "@/services/publicContent/client";

const PUBLIC_ORIGIN = "https://wakilisha.africa";
const CLIENT_CACHE_MS = 10 * 60 * 1000;

const WAKILISHA_HOSTS = new Set([
  "wakilisha.africa",
  "www.wakilisha.africa",
]);

const RESERVED_ROOT_SEGMENTS = new Set([
  "",
  "about",
  "admin",
  "artists",
  "auth",
  "briefing",
  "briefings",
  "categories",
  "charts",
  "contact",
  "faqs",
  "genres",
  "guides",
  "labels",
  "magazine",
  "music",
  "people",
  "player",
  "playlists",
  "privacy",
  "profile",
  "releases",
  "search",
  "settings",
  "start",
  "tags",
  "terms",
  "tracks",
  "u",
]);

export type PostLinkPreview = {
  kind: "wakilisha_article" | "origin_rich";
  sourceUrl: string;
  canonicalUrl: string;
  internalPath: string | null;
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  section: string;
  displayHost: string;
  mediaType:
    | "article"
    | "website"
    | "image"
    | "video"
    | "audio"
    | "product"
    | "profile"
    | "other";
};

type CacheEntry = {
  expiresAt: number;
  pending: Promise<PostLinkPreview | null>;
};

const previewCache = new Map<string, CacheEntry>();

function readSeoString(
  seo: Record<string, unknown> | undefined,
  keys: string[],
): string {
  if (!seo) return "";

  for (const key of keys) {
    const value = seo[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeHttpUrl(
  rawUrl: string,
): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function normalizePostLinkUrl(
  rawUrl: string,
): string | null {
  const parsed = normalizeHttpUrl(rawUrl);
  return parsed ? parsed.toString() : null;
}

export function extractPostLinkFromText(
  rawText: string,
  requireTerminator = false,
): { body: string; linkUrl: string } | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(rawText);
  if (!match || match.index < 0) return null;

  const start = match.index;
  const end = start + match[0].length;

  if (
    requireTerminator &&
    end === rawText.length
  ) {
    return null;
  }

  let rawUrl = match[0];
  let trailing = "";

  while (
    rawUrl.length > 0 &&
    /[.,!?;:]$/.test(rawUrl)
  ) {
    trailing = `${rawUrl.slice(-1)}${trailing}`;
    rawUrl = rawUrl.slice(0, -1);
  }

  const linkUrl = normalizePostLinkUrl(rawUrl);
  if (!linkUrl) return null;

  const before = rawText.slice(0, start);
  const after = `${trailing}${rawText.slice(end)}`;
  const body = `${before}${after}`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    body,
    linkUrl,
  };
}

function wakilishaArticleSlug(
  parsed: URL,
): string | null {
  if (!WAKILISHA_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }

  const segments = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (
    segments.length === 2 &&
    segments[0] === "magazine" &&
    segments[1]
  ) {
    return segments[1];
  }

  if (
    segments.length === 1 &&
    segments[0] &&
    !RESERVED_ROOT_SEGMENTS.has(
      segments[0].toLowerCase(),
    )
  ) {
    return segments[0];
  }

  return null;
}

function articlePreview(
  sourceUrl: string,
  article: PublicArticleDetail,
): PostLinkPreview {
  const canonicalPath =
    `/magazine/${encodeURIComponent(article.slug)}`;

  const canonicalFromSeo =
    readSeoString(
      article.seo,
      [
        "canonical",
        "canonical_url",
        "canonicalUrl",
      ],
    );

  const description =
    readSeoString(
      article.seo,
      [
        "description",
        "meta_description",
        "metaDescription",
        "og_description",
        "ogDescription",
      ],
    ) ||
    article.dek ||
    "";

  const imageUrl =
    readSeoString(
      article.seo,
      [
        "og_image",
        "ogImage",
        "image",
        "image_url",
        "imageUrl",
      ],
    ) ||
    article.heroUrl ||
    "";

  const canonicalUrl =
    canonicalFromSeo &&
    /^https?:\/\//i.test(canonicalFromSeo)
      ? canonicalFromSeo
      : `${PUBLIC_ORIGIN}${canonicalPath}`;

  return {
    kind: "wakilisha_article",
    sourceUrl,
    canonicalUrl,
    internalPath: canonicalPath,
    title: article.title,
    description,
    imageUrl,
    siteName: "WAKILISHA",
    section: article.section || "Article",
    displayHost: "wakilisha.africa",
    mediaType: "article",
  };
}

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  return typeof value === "string"
    ? value.trim()
    : "";
}

async function resolveOriginPreview(
  sourceUrl: string,
): Promise<PostLinkPreview | null> {
  const { data, error } =
    await supabase.functions.invoke(
      "link-preview-read",
      {
        body: { url: sourceUrl },
      },
    );

  if (error) return null;

  const envelope = asRecord(data);
  const raw = asRecord(envelope?.data);
  if (!raw) return null;

  const title = readString(raw, "title");
  const description = readString(raw, "description");
  const imageUrl = readString(raw, "imageUrl");

  if (!title && !description && !imageUrl) {
    return null;
  }

  const mediaTypeRaw =
    readString(raw, "mediaType");
  const allowedMediaTypes =
    new Set<PostLinkPreview["mediaType"]>([
      "article",
      "website",
      "image",
      "video",
      "audio",
      "product",
      "profile",
      "other",
    ]);

  const mediaType =
    allowedMediaTypes.has(
      mediaTypeRaw as PostLinkPreview["mediaType"],
    )
      ? mediaTypeRaw as PostLinkPreview["mediaType"]
      : "other";

  return {
    kind: "origin_rich",
    sourceUrl,
    canonicalUrl:
      readString(raw, "canonicalUrl") ||
      sourceUrl,
    internalPath: null,
    title:
      title ||
      readString(raw, "siteName") ||
      readString(raw, "displayHost"),
    description,
    imageUrl,
    siteName:
      readString(raw, "siteName") ||
      readString(raw, "displayHost"),
    section:
      readString(raw, "section") ||
      "Website",
    displayHost:
      readString(raw, "displayHost") ||
      new URL(sourceUrl).hostname.replace(/^www\./i, ""),
    mediaType,
  };
}

async function resolveUncached(
  rawUrl: string,
): Promise<PostLinkPreview | null> {
  const parsed = normalizeHttpUrl(rawUrl);
  if (!parsed) return null;

  const sourceUrl = parsed.toString();
  const slug = wakilishaArticleSlug(parsed);

  if (slug) {
    try {
      const article = await getArticle(slug);
      if (article) {
        return articlePreview(sourceUrl, article);
      }
    } catch {
      // Fall through to the origin metadata resolver.
    }
  }

  return resolveOriginPreview(sourceUrl);
}

export function resolvePostLinkPreview(
  rawUrl: string,
): Promise<PostLinkPreview | null> {
  const normalized = normalizePostLinkUrl(rawUrl);
  if (!normalized) return Promise.resolve(null);

  const now = Date.now();
  const cached = previewCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.pending;
  }

  const pending =
    resolveUncached(normalized).catch(() => null);

  previewCache.set(normalized, {
    pending,
    expiresAt: now + CLIENT_CACHE_MS,
  });

  return pending;
}

export function postLinkFallbackLabel(
  rawUrl: string,
  customLabel?: string | null,
): string {
  const explicit = String(customLabel || "").trim();
  if (explicit) return explicit;

  const parsed = normalizeHttpUrl(rawUrl);
  if (!parsed) return "Open Link";

  return parsed.hostname
    .replace(/^www\./i, "")
    .toUpperCase();
}
