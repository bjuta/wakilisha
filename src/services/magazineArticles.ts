import { supabase } from '@/lib/supabase';

/* ─── Types ─── */
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

function mapRow(
  row: Record<string, unknown>,
  mediaHeroMap?: Record<string, string>,
  opts?: { includeContent?: boolean }
): MagazineArticle {
  const categories = normalizeTaxonomyTerms(row.categories);
  const tags = normalizeTaxonomyTerms(row.tags);
  const slug = String(row.slug || '');
  const title = String(row.title || '');
  const excerpt = String(row.excerpt || '');
  const contentHtml = opts?.includeContent ? String(row.content_html || '') : '';
  const author = String(row.author || 'WAKILISHA Editorial');
  const heroImageUrl = row.hero_image_url ? String(row.hero_image_url) : (mediaHeroMap?.[slug] || null);
  const safeExcerpt = excerpt !== 'null' && excerpt !== 'undefined' ? excerpt : '';

  return {
    id: String(row.id || ''),
    slug,
    title,
    section: categories[0] || 'Article',
    author,
    date: normalizeDate(row.published_at as string | null),
    readingTime: opts?.includeContent ? estimateReadingTime(contentHtml) : 3,
    heroUrl: heroImageUrl || premiumHeroFallback(title),
    dek: safeExcerpt || (opts?.includeContent ? parseBody(contentHtml)[0] || '' : ''),
    body: opts?.includeContent ? parseBody(contentHtml) : [],
    contentHtml,
    tags,
    relatedEntities: [],
    isFeatured: false,
    readCount: 0,
  };
}

/* ─── Public API ─── */
export async function listMagazineArticles(): Promise<MagazineArticle[]> {
  const articlesResult = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, author, published_at, modified_at, categories, tags, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .neq('wp_status', 'trash')
    .neq('wp_status', 'private')
    .order('published_at', { ascending: false });

  if (articlesResult.error) {
    throw new Error(`Supabase magazine fetch error: ${articlesResult.error.message}`);
  }

  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('entity_slug, url')
    .eq('entity_type', 'article')
    .eq('role', 'hero');

  const mediaHeroMap: Record<string, string> = {};
  for (const row of mediaResult.data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.entity_slug === 'string' && typeof r.url === 'string' && r.url.includes('wakilisha')) {
      mediaHeroMap[r.entity_slug] = r.url;
    }
  }

  return (articlesResult.data ?? []).map((row) => mapRow(row as Record<string, unknown>, mediaHeroMap));
}

export async function getMagazineArticleBySlug(slug: string): Promise<MagazineArticle | null> {
  const articleResult = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, seo, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .eq('slug', slug)
    .neq('wp_status', 'trash')
    .neq('wp_status', 'private')
    .maybeSingle();

  if (articleResult.error) {
    throw new Error(`Supabase article fetch error: ${articleResult.error.message}`);
  }

  if (!articleResult.data) return null;

  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('url')
    .eq('entity_type', 'article')
    .eq('entity_slug', slug)
    .eq('role', 'hero')
    .maybeSingle();

  const mediaHeroMap: Record<string, string> = {};
  if (mediaResult.data && typeof mediaResult.data === 'object') {
    const r = mediaResult.data as Record<string, unknown>;
    if (typeof r.url === 'string' && r.url.includes('wakilisha')) {
      mediaHeroMap[slug] = r.url;
    }
  }

  return mapRow(articleResult.data as Record<string, unknown>, mediaHeroMap, { includeContent: true });
}

export async function getRelatedArticles(article: MagazineArticle, limit = 3): Promise<MagazineArticle[]> {
  const articlesResult = await supabase
    .from('wk_articles')
    .select(
      'id, slug, title, excerpt, author, published_at, modified_at, categories, tags, wp_status, hero_image_url, created_at, updated_at, source_wp_post_id'
    )
    .neq('slug', article.slug)
    .neq('wp_status', 'trash')
    .neq('wp_status', 'private')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (articlesResult.error) {
    throw new Error(`Supabase related articles fetch error: ${articlesResult.error.message}`);
  }

  const mediaResult = await supabase
    .from('wk_media_assets')
    .select('entity_slug, url')
    .eq('entity_type', 'article')
    .eq('role', 'hero');

  const mediaHeroMap: Record<string, string> = {};
  for (const row of mediaResult.data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.entity_slug === 'string' && typeof r.url === 'string' && r.url.includes('wakilisha')) {
      mediaHeroMap[r.entity_slug] = r.url;
    }
  }

  return (articlesResult.data ?? []).map((row) => mapRow(row as Record<string, unknown>, mediaHeroMap));
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

export type MediaAsset = {
  id: string;
  entityType: string;
  entitySlug: string;
  role: string;
  url: string;
  altText: string | null;
  source: string | null;
};

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
      map[r.entity_slug] = r.url;
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

export function useMagazineArticle(slug: string | undefined) {
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

    getMagazineArticleBySlug(slug)
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
  }, [slug]);

  return { article, loading, error };
}