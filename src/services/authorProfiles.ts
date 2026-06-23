import type { MagazineArticle } from '@/services/magazineArticles';
import { supabase } from '@/lib/supabase';

/* ─── Types ─── */

export type AuthorProfile = {
  slug: string;
  displayName: string;
  role: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  articleCount: number;
  location: string;
  areas: string[];
  socialLinks: { label: string; url: string; icon: string }[];
  joinedDate: string;
};

/* ─── Real author data from Supabase ─── */

export type SocialLink = {
  label: string;
  url: string;
  icon: string;
};

export type AuthorRow = {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  url: string | null;
  source_kind: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: string | null;
  location: string | null;
  social_links: SocialLink[] | null;
  joined_date: string | null;
};

let cachedAuthors: AuthorRow[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function bustAuthorCache() {
  cachedAuthors = null;
  cacheTimestamp = 0;
}

export async function fetchAllAuthors(): Promise<AuthorRow[]> {
  // Return fresh cache if available
  if (cachedAuthors && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedAuthors;
  }

  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  // Single attempt — the caller (component) handles retries
  try {
    const result = await supabase
      .from("registry_authors")
      .select("id, slug, name, url, source_kind, bio, avatar_url, cover_url, role, location, social_links, joined_date");
    data = (result.data ?? []).map((row: Record<string, unknown>) => ({ ...row, email: null }));
    error = result.error;
  } catch (err) {
    console.error("fetchAllAuthors: Supabase query threw", err);
    // If we have a stale cache, return it as fallback
    if (cachedAuthors && cachedAuthors.length > 0) {
      console.warn("fetchAllAuthors: returning stale cached data after query failure");
      return cachedAuthors;
    }
    // No cache, no data — throw so the UI can show error + retry
    throw err;
  }

  if (error) {
    console.error("fetchAllAuthors: Supabase returned error", error.message, error);
    if (cachedAuthors && cachedAuthors.length > 0) {
      console.warn("fetchAllAuthors: returning stale cached data after Supabase error");
      return cachedAuthors;
    }
    throw new Error(`Failed to load authors: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Empty table — this is a valid state, cache it and return
    console.warn("fetchAllAuthors: registry_authors returned 0 rows");
    cachedAuthors = [];
    cacheTimestamp = Date.now();
    return [];
  }

  cachedAuthors = data as AuthorRow[];
  cacheTimestamp = Date.now();
  return cachedAuthors;
}

export async function fetchAuthorBySlug(slug: string): Promise<AuthorRow | null> {
  try {
    const authors = await fetchAllAuthors();
    return authors.find((a) => a.slug === slug) ?? null;
  } catch {
    // fetchAllAuthors already logged the error — gracefully return null
    return null;
  }
}

/** Update an author profile directly in registry_authors */
export async function updateAuthorBySlug(
  slug: string,
  payload: Partial<Pick<AuthorRow, "name" | "bio" | "avatar_url" | "cover_url" | "role" | "location" | "social_links" | "joined_date">>
): Promise<boolean> {
  const { error } = await supabase
    .from("registry_authors")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) {
    console.warn("Failed to update author:", error.message);
    return false;
  }
  bustAuthorCache();
  return true;
}

/* ─── Generated placeholders (used only when DB has null) ─── */

function authorDisplayName(row: AuthorRow): string {
  const raw = row.name.trim();
  if (raw.includes("_") || (raw === raw.toLowerCase() && !raw.includes(" "))) {
    return raw
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return raw;
}

function initialsFromName(displayName: string): string {
  return displayName
    .split(' ')
    .map((n) => n[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
}

function generatedAvatarUrl(displayName: string): string {
  const initials = initialsFromName(displayName);
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#1A1F16"/>
      <text x="120" y="132" text-anchor="middle" fill="#85C441" font-family="system-ui,sans-serif" font-size="72" font-weight="900">${initials}</text>
    </svg>`
  )}`;
}

function generatedCoverUrl(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400" viewBox="0 0 1600 400">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a3a0a"/><stop offset="100%" stop-color="#2a5a1a"/></linearGradient></defs>
      <rect width="1600" height="400" fill="url(#g)"/>
      <circle cx="300" cy="120" r="200" fill="#85C441" fill-opacity="0.08"/>
      <circle cx="1300" cy="300" r="250" fill="#85C441" fill-opacity="0.05"/>
    </svg>`
  )}`;
}

function bioForAuthor(displayName: string): string {
  return `${displayName} is a contributor to WAKILISHA Magazine, covering East African music and culture.`;
}

/* ─── Author metadata — DB-first, generated fallback ─── */

export type AuthorMeta = {
  slug: string;
  displayName: string;
  role: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  location: string;
  areas: string[];
  socialLinks: { label: string; url: string; icon: string }[];
  joinedDate: string;
};

/** Normalize social links from DB — ensures each link has label/url/icon */
function normalizeSocialLinks(raw: SocialLink[] | null | undefined): SocialLink[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((link) => link && typeof link.url === 'string' && link.url.trim().length > 0);
}

/** Resolve author metadata: checks registry_authors first, then generates sensible defaults */
export async function resolveAuthorMeta(rawSlug: string): Promise<AuthorMeta & { source: "database" | "generated" }> {
  const slug = rawSlug.trim().toLowerCase().replace(/\s+/g, "-");
  const dbAuthor = await fetchAuthorBySlug(slug);

  if (dbAuthor) {
    const displayName = authorDisplayName(dbAuthor);
    const socialLinks = normalizeSocialLinks(dbAuthor.social_links);

    return {
      slug,
      displayName,
      role: dbAuthor.role || "Contributor",
      bio: dbAuthor.bio || bioForAuthor(displayName),
      avatarUrl: dbAuthor.avatar_url || generatedAvatarUrl(displayName),
      coverUrl: dbAuthor.cover_url || generatedCoverUrl(),
      location: dbAuthor.location || "",
      areas: [],
      socialLinks,
      joinedDate: dbAuthor.joined_date || "",
      source: "database" as const,
    };
  }

  // No DB record — generate from slug
  return {
    ...getAuthorMeta(slug),
    source: "generated" as const,
  };
}

/** Synchronous fallback — generates author metadata purely from the raw author string */
export function getAuthorMeta(rawAuthor: string): AuthorMeta {
  const slug = normalizeAuthorSlug(rawAuthor);
  const displayName = rawAuthor
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    slug,
    displayName,
    role: "Contributor",
    bio: bioForAuthor(displayName),
    avatarUrl: generatedAvatarUrl(displayName),
    coverUrl: generatedCoverUrl(),
    location: "",
    areas: [],
    socialLinks: [],
    joinedDate: "",
  };
}

/* ─── Section → vertical color mapping ─── */
const SECTION_VERTICAL_MAP: Record<string, string> = {
  'Music': 'var(--wk-v-music)',
  'Film': 'var(--wk-v-film)',
  'Fashion': 'var(--wk-v-fashion)',
  'Food': 'var(--wk-v-food)',
  'Language': 'var(--wk-v-language)',
  'Style': 'var(--wk-v-fashion)',
  'Places': 'var(--wk-v-places)',
  'Guides': 'var(--wk-v-intel)',
  'Essays': 'var(--wk-v-intel)',
  'Chart Notes': 'var(--wk-v-music)',
  'Reviews': 'var(--wk-v-music)',
  'Interviews': 'var(--wk-v-music)',
};

export function getVerticalColor(sectionName: string): string {
  return SECTION_VERTICAL_MAP[sectionName] || 'var(--wk-brand)';
}

function normalizeAuthorSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export function getAuthorProfile(authorSlug: string, articles: MagazineArticle[]): AuthorProfile | null {
  const matching = articles.filter(
    (a) => normalizeAuthorSlug(a.author) === authorSlug
  );

  if (matching.length === 0) {
    return null;
  }

  const meta = getAuthorMeta(matching[0].author);

  return {
    ...meta,
    articleCount: matching.length,
  };
}

export function getAllAuthorSlugs(articles: MagazineArticle[]): string[] {
  const slugs = new Set<string>();
  for (const a of articles) {
    slugs.add(normalizeAuthorSlug(a.author));
  }
  return Array.from(slugs).sort();
}