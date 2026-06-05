import { supabase } from '@/lib/supabase';
import { rewriteWpImageUrl, rewriteWpImageUrls } from '@/services/wpImageRewrite';
import { decodeHtmlEntities } from '@/utils/decodeHtmlEntities';

/* ─── Types ─── */

export type MediaAsset = {
  id: string;
  entityType: string;
  entitySlug: string;
  role: string;
  url: string;
  altText: string | null;
  source: string | null;
};

export type MagazineArticle = {
  id: string;
  slug: string;
  title: string;
  section: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
  dek: string;
  body: string[];
  contentHtml: string;
  tags: string[];
  relatedEntities: { type: string; name: string; slug: string }[];
  isFeatured: boolean;
  readCount: number;
  mediaAssets: MediaAsset[];
};

export type RepairedStory = {
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
};

/* ─── Helpers ─── */
function normalizeTaxonomyTerms(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((t) => {
        if (typeof t === 'string') return t;
        if (t && typeof t === 'object') {
          const term = t as Record<string, unknown>;
          return (
            (typeof term.name === 'string' && term.name) ||
            (typeof term.label === 'string' && term.label) ||
            (typeof term.term === 'string' && term.term) ||
            ''
          );
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return normalizeTaxonomyTerms(parsed);
    } catch {
      return [raw];
    }
  }
  return typeof raw === 'string' ? [raw] : [];
}

function stripHtml(html: string | null): string {
  if (!html) return '';
  // Remove WordPress shortcodes and their content
  const noShortcodes = html.replace(/\[\/?vc_[^\]]*\]/g, '').replace(/\[[^\]]*\]/g, '');
  // Remove HTML tags
  const text = noShortcodes.replace(/<[^>]*>/g, ' ');
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

function generateExcerpt(html: string | null, maxChars = 160): string {
  const text = stripHtml(html);
  if (text.length <= maxChars) return text;
  // Try to break at the last sentence end or space near maxChars
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastSpace = truncated.lastIndexOf(' ');
  const breakPoint = lastPeriod > maxChars * 0.6 ? lastPeriod + 1 : lastSpace > 0 ? lastSpace : maxChars;
  return truncated.slice(0, breakPoint).trimEnd() + '…';
}

function estimateReadingTime(html: string | null): number {
  if (!html) return 1;
  const text = html.replace(/<[^>]*>/g, ' ');
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(1, Math.ceil(words / 200));
}

function normalizeDate(value: string | null): string {
  if (!value) return 'Undated';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseBody(html: string | null): string[] {
  if (!html) return [];
  const text = html.replace(/<[^>]*>/g, ' ');
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function premiumHeroFallback(title: string): string {
  const clean = title.replace(/&/g, '&amp;').slice(0, 48);
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E100D"/>
          <stop offset="50%" stop-color="#1A1F16"/>
          <stop offset="100%" stop-color="#0E100D"/>
        </linearGradient>
        <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#85C441" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#E37400" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#g1)"/>
      <circle cx="200" cy="160" r="280" fill="url(#g2)"/>
      <circle cx="1000" cy="580" r="320" fill="url(#g2)"/>
      <line x1="0" y1="360" x2="1200" y2="360" stroke="#85C441" stroke-opacity="0.06" stroke-width="1"/>
      <line x1="600" y1="0" x2="600" y2="720" stroke="#85C441" stroke-opacity="0.06" stroke-width="1"/>
      <text x="72" y="580" fill="#F0EFE8" font-family="'Inter', system-ui, sans-serif" font-size="48" font-weight="800" letter-spacing="-2" opacity="0.92">${clean}</text>
      <text x="72" y="630" fill="#85C441" font-family="'Inter', system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="5" opacity="0.8">WAKILISHA EDITORIAL</text>
    </svg>`
  )}`;
}

function mapMediaAsset(row: Record<string, unknown>): MediaAsset {
  return {
    id: String(row.id || ''),
    entityType: String(row.entity_type || ''),
    entitySlug: String(row.entity_slug || ''),
    role: String(row.role || ''),
    url: rewriteWpImageUrl(String(row.url || '')),
    altText: row.alt_text ? String(row.alt_text) : null,
    source: row.source ? String(row.source) : null,
  };
}

function resolveHeroUrl(
  slug: string,
  articleHeroUrl: string | null,
  mediaHeroMap: Record<string, string>,
  mediaAssets: MediaAsset[]
): string {
  // Prefer media assets from the publishing system, then fall back to article column
  const mediaHero = mediaAssets.find((m) => m.role === 'hero' && m.url);
  if (mediaHero) return mediaHero.url;

  const mappedHero = mediaHeroMap[slug];
  if (mappedHero) return mappedHero;

  if (articleHeroUrl) return rewriteWpImageUrl(articleHeroUrl);

  return '';
}

function resolveDek(
  excerptRaw: string | null,
  contentHtmlRaw: string | null
): string {
  const excerpt = excerptRaw ? decodeHtmlEntities(excerptRaw) : '';
  const isNullish = !excerpt || excerpt === 'null' || excerpt === 'undefined';
  if (!isNullish) return excerpt;
  // Fallback: generate excerpt from article body
  const bodyExcerpt = generateExcerpt(contentHtmlRaw, 160);
  return bodyExcerpt ? decodeHtmlEntities(bodyExcerpt) : '';
}

function mapRow(
  row: Record<string, unknown>,
  mediaHeroMap?: Record<string, string>,
  mediaAssets?: MediaAsset[],
  opts?: { includeContent?: boolean }
): MagazineArticle {
  const categories = normalizeTaxonomyTerms(row.categories);
  const tags = normalizeTaxonomyTerms(row.tags);
  const slug = String(row.slug || '');
  const title = decodeHtmlEntities(String(row.title || ''));
  const excerptRaw = row.excerpt ? String(row.excerpt) : null;
  const rawContentHtml = String(row.content_html || '');
  const contentHtml = rewriteWpImageUrls(rawContentHtml);
  const author = decodeHtmlEntities(String(row.author || 'WAKILISHA Editorial'));
  const articleHeroUrl = row.hero_image_url ? String(row.hero_image_url) : null;
  const dek = resolveDek(excerptRaw, rawContentHtml);
  const assets = mediaAssets ?? [];

  const heroUrl = resolveHeroUrl(
    slug,
    articleHeroUrl,
    mediaHeroMap ?? {},
    assets
  ) || premiumHeroFallback(title);

  return {
    id: String(row.id || ''),
    slug,
    title,
    section: decodeHtmlEntities(categories[0] || 'Article'),
    author,
    date: normalizeDate(row.published_at as string | null),
    readingTime: rawContentHtml ? estimateReadingTime(rawContentHtml) : 3,
    heroUrl,
    dek,
    body: opts?.includeContent ? parseBody(contentHtml).map((p) => decodeHtmlEntities(p)) : [],
    contentHtml,
    tags: tags.map((t) => decodeHtmlEntities(t)),
    relatedEntities: [],
    isFeatured: false,
    readCount: 0,
    mediaAssets: assets,
  };
}

/* ─── Public API ─── */
export async function listMagazineArticles(): Promise<MagazineArticle[]> {
  const articlesResult = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .eq('wp_status', 'publish')
    .order('published_at', { ascending: false });

  if (articlesResult.error) {
    throw new Error(`Supabase magazine fetch error: ${articlesResult.error.message}`);
  }

  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('entity_slug, url, role')
    .eq('entity_type', 'article');

  const mediaHeroMap: Record<string, string> = {};
  for (const row of mediaResult.data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.entity_slug === 'string' && typeof r.url === 'string' && r.role === 'hero') {
      mediaHeroMap[r.entity_slug] = rewriteWpImageUrl(r.url);
    }
  }

  return (articlesResult.data ?? []).map((row) =>
    mapRow(row as Record<string, unknown>, mediaHeroMap)
  );
}

export async function getMagazineArticleBySlug(
  slug: string,
  previewNonce?: string | null
): Promise<MagazineArticle | null> {
  // If a preview nonce is provided, validate it first
  if (previewNonce) {
    const validated = await validatePreviewNonce(slug, previewNonce);
    if (validated) {
      return fetchArticleBySlug(slug, ['publish', 'draft']);
    }
    // Invalid or expired nonce — fall through to published-only
  }

  return fetchArticleBySlug(slug, ['publish']);
}

async function fetchArticleBySlug(
  slug: string,
  allowedStatuses: string[]
): Promise<MagazineArticle | null> {
  const articleResult = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, seo, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .eq('slug', slug)
    .in('wp_status', allowedStatuses)
    .maybeSingle();

  if (articleResult.error) {
    throw new Error(`Supabase article fetch error: ${articleResult.error.message}`);
  }

  if (!articleResult.data) return null;

  // Fetch ALL media assets for this article — hero, inline, gallery, etc.
  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('id, entity_type, entity_slug, role, url, alt_text, source')
    .eq('entity_type', 'article')
    .eq('entity_slug', slug);

  const mediaAssets: MediaAsset[] = (mediaResult.data ?? []).map((row) =>
    mapMediaAsset(row as Record<string, unknown>)
  );

  // Build a hero map for consistency with the list view
  const mediaHeroMap: Record<string, string> = {};
  for (const asset of mediaAssets) {
    if (asset.role === 'hero' && asset.url) {
      mediaHeroMap[asset.entitySlug] = asset.url;
    }
  }

  return mapRow(
    articleResult.data as Record<string, unknown>,
    mediaHeroMap,
    mediaAssets,
    { includeContent: true }
  );
}

export async function getRelatedArticles(article: MagazineArticle, limit = 3): Promise<MagazineArticle[]> {
  const articlesResult = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, author, published_at, modified_at, categories, tags, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .neq('slug', article.slug)
    .eq('wp_status', 'publish')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (articlesResult.error) {
    throw new Error(`Supabase related articles fetch error: ${articlesResult.error.message}`);
  }

  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('entity_slug, url, role')
    .eq('entity_type', 'article');

  const mediaHeroMap: Record<string, string> = {};
  for (const row of mediaResult.data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.entity_slug === 'string' && typeof r.url === 'string' && r.role === 'hero') {
      mediaHeroMap[r.entity_slug] = rewriteWpImageUrl(r.url);
    }
  }

  return (articlesResult.data ?? []).map((row) =>
    mapRow(row as Record<string, unknown>, mediaHeroMap)
  );
}

export function toRepairedStory(article: MagazineArticle): RepairedStory {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    section: article.section,
    dek: article.dek,
    author: article.author,
    date: article.date,
    readingTime: article.readingTime,
    heroUrl: article.heroUrl,
  };
}

/**
 * Fetch all hero images for articles from the in-house media library.
 * Returns a map of { [slug]: url } for quick lookup.
 */
export async function getArticleHeroMediaMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('wk_media_assets')
    .select('entity_slug, url')
    .eq('entity_type', 'article')
    .eq('role', 'hero');

  if (error) throw new Error(`Media assets fetch error: ${error.message}`);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.entity_slug === 'string' && typeof r.url === 'string') {
      map[r.entity_slug] = rewriteWpImageUrl(r.url);
    }
  }
  return map;
}

/**
 * Update the hero_image_url for an article in wk_articles,
 * and upsert (or insert) the entry in wk_media_assets.
 */
export async function setArticleHeroImage(
  articleSlug: string,
  heroUrl: string,
  altText: string = ''
): Promise<void> {
  // Update the article
  const { error: articleError } = await supabase
    .from('wk_articles')
    .update({ hero_image_url: heroUrl })
    .eq('slug', articleSlug);

  if (articleError) throw new Error(`Article hero update error: ${articleError.message}`);

  // Check if a media asset already exists
  const { data: existing } = await supabase
    .from('wk_media_assets')
    .select('id')
    .eq('entity_type', 'article')
    .eq('entity_slug', articleSlug)
    .eq('role', 'hero')
    .maybeSingle();

  if (existing && typeof existing === 'object' && 'id' in existing) {
    // Update existing
    await supabase
      .from('wk_media_assets')
      .update({ url: heroUrl, alt_text: altText, source: 'editor_upload' })
      .eq('id', (existing as { id: string }).id);
  } else {
    // Insert new
    await supabase.from('wk_media_assets').insert({
      entity_type: 'article',
      entity_slug: articleSlug,
      role: 'hero',
      url: heroUrl,
      alt_text: altText,
      source: 'editor_upload',
    });
  }
}

/* ─── Preview Nonce System ─── */

/**
 * Generate a one-time preview nonce for a draft article.
 * Stores it on the article row with a 1-hour expiry.
 * Returns the nonce string to build the preview URL.
 */
export async function createPreviewNonce(slug: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('wk_articles')
    .update({
      preview_nonce: nonce,
      preview_nonce_expires_at: expiresAt,
    })
    .eq('slug', slug);

  if (error) throw new Error(`Preview nonce creation failed: ${error.message}`);

  return nonce;
}

/**
 * Validate a preview nonce against the database.
 * Returns true if the nonce is valid and hasn't expired for the given slug.
 */
async function validatePreviewNonce(slug: string, nonce: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('wk_articles')
    .select('preview_nonce, preview_nonce_expires_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as Record<string, unknown>;
  if (row.preview_nonce !== nonce) return false;

  const expiresAt = row.preview_nonce_expires_at as string | null;
  if (!expiresAt) return false;

  return new Date(expiresAt) > new Date();
}

/**
 * Fetch all published articles by a specific author.
 * Matches against the author column using normalized comparison.
 */
export async function getArticlesByAuthor(authorSlug: string): Promise<MagazineArticle[]> {
  // Normalize the slug back to possible DB representations
  const underscoreVariant = authorSlug.replace(/-/g, '_');
  const spaceVariant = authorSlug.replace(/-/g, ' ');

  const { data, error } = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, author, published_at, modified_at, categories, tags, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .eq('wp_status', 'publish')
    .or(`author.ilike.${authorSlug},author.ilike.${underscoreVariant},author.ilike.${spaceVariant}`)
    .order('published_at', { ascending: false });

  if (error) throw new Error(`Author articles fetch error: ${error.message}`);

  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('entity_slug, url, role')
    .eq('entity_type', 'article');

  const mediaHeroMap: Record<string, string> = {};
  for (const row of mediaResult.data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.entity_slug === 'string' && typeof r.url === 'string' && r.role === 'hero') {
      mediaHeroMap[r.entity_slug] = rewriteWpImageUrl(r.url);
    }
  }

  // Client-side filter for exact normalized match
  const normalizedTarget = authorSlug.toLowerCase().replace(/[\s_-]+/g, '-');
  return (data ?? [])
    .filter((row) => {
      const rawAuthor = String((row as Record<string, unknown>).author || '');
      return rawAuthor.trim().toLowerCase().replace(/[\s_-]+/g, '-') === normalizedTarget;
    })
    .map((row) =>
      mapRow(row as Record<string, unknown>, mediaHeroMap)
    );
}

/* ─── React Hook ─── */
import { useEffect, useState, useCallback } from 'react';

export function useMagazineArticles() {
  const [articles, setArticles] = useState<MagazineArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listMagazineArticles()
      .then((items) => {
        setArticles(items);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load articles');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { articles, loading, error, refresh };
}

export function useMagazineArticle(slug: string | undefined, previewNonce?: string | null) {
  const [article, setArticle] = useState<MagazineArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('No article slug provided');
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    getMagazineArticleBySlug(slug, previewNonce)
      .then((item) => {
        if (!alive) return;
        setArticle(item);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load article');
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug, previewNonce]);

  return { article, loading, error };
}