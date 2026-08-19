import { useCallback, useEffect, useState } from 'react';
import { listMagazineStories, getArticle, getInlineMagazineFallbackStories, type PublicStory } from '@/services/publicContent/client';
import { processArticleContent, generateExcerpt } from '@/services/articles/contentPipeline';
import { fetchAllSiteContent, type SiteContentResponse, type MagazineSiteArtist, type MagazineSiteRelease } from '@/services/magazineSiteContent';
import { batchGetMediaAssetsById } from '@/utils/mediaAssetProps';

export type MediaAsset = {
  id: string;
  entityType: string;
  entitySlug: string;
  role: string;
  url: string;
  altText: string | null;
  caption: string | null;
  title: string | null;
  source: string | null;
};

export type MagazineArticle = {
  id: string;
  slug: string;
  title: string;
  section: string;
  author: string;
  authorPersonPath?: string | null;
  authorOrganizationPath?: string | null;
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

export type { PublicStory };

function articleHeroUrl(article: any): string {
  return String(
    article?.heroUrl ||
    article?.imageUrl ||
    article?.featuredImageUrl ||
    article?.featured_image_url ||
    article?.hero_image_url ||
    article?.coverImageUrl ||
    article?.thumbnailUrl ||
    ""
  );
}


function storyToArticle(story: PublicStory): MagazineArticle {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    section: story.section || 'Article',
    author: story.author || 'WAKILISHA Editorial',
    authorPersonPath: story.authorPersonPath ?? null,
    authorOrganizationPath: story.authorOrganizationPath ?? null,
    date: story.date || 'Undated',
    readingTime: story.readingTime || 3,
    heroUrl: articleHeroUrl(story),
    dek: story.dek || '',
    body: [],
    contentHtml: '',
    tags: [],
    relatedEntities: [],
    isFeatured: false,
    readCount: 0,
    mediaAssets: [],
  };
}

export async function listMagazineArticles(limit = 500): Promise<MagazineArticle[]> {
  const stories = await listMagazineStories(limit);
  return stories.map(storyToArticle);
}

export async function getMagazineArticleBySlug(
  slug: string | undefined,
  previewNonce?: string | null
): Promise<MagazineArticle | null> {
  if (!slug) return null;
  const detail = await getArticle(slug, previewNonce);
  if (!detail) return null;
  const processedContent = processArticleContent(detail.contentHtml);
  const excerpt = detail.dek?.trim() || generateExcerpt(detail.contentHtml, 280);

  // Resolve inline media assets from content HTML
  const mediaAssets = await resolveInlineMediaAssets(detail.contentHtml);

  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    section: detail.section,
    author: detail.author,
    authorPersonPath: detail.authorPersonPath ?? null,
    authorOrganizationPath: detail.authorOrganizationPath ?? null,
    date: detail.date,
    readingTime: detail.readingTime,
    heroUrl: articleHeroUrl(detail),
    dek: excerpt,
    body: detail.contentHtml ? [detail.contentHtml] : [],
    contentHtml: processedContent,
    tags: detail.tags || [],
    relatedEntities: [],
    isFeatured: false,
    readCount: 0,
    mediaAssets,
  };
}

/**
 * Scans article HTML content for <img data-asset-id="..."> tags,
 * resolves the corresponding governed Media assets, and returns
 * caption, alt and title metadata for approved rows.
 */
async function resolveInlineMediaAssets(contentHtml: string): Promise<MediaAsset[]> {
  if (!contentHtml) return [];

  // Extract data-asset-id values from img tags
  const assetIds: string[] = [];
  const idRegex = /<img[^>]+data-asset-id="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(contentHtml)) !== null) {
    if (match[1] && !assetIds.includes(match[1])) {
      assetIds.push(match[1]);
    }
  }

  if (assetIds.length === 0) return [];

  try {
    const assetsById = await batchGetMediaAssetsById(assetIds);

    return assetIds.flatMap((assetId) => {
      const asset = assetsById.get(assetId);
      if (!asset) return [];

      return [{
        id: asset.id,
        entityType: "media",
        entitySlug: asset.slug ?? "",
        role: "inline",
        url: asset.url,
        altText:
          (asset.metadata?.alt_text as string) ||
          asset.title ||
          null,
        caption:
          (asset.metadata?.caption as string) ||
          null,
        title: asset.title || null,
        source: null,
      }];
    });
  } catch {
    return [];
  }
}

export async function getRelatedArticles(article: MagazineArticle, limit = 3): Promise<MagazineArticle[]> {
  const articles = await listMagazineArticles();
  return articles.filter((item) => item.slug !== article.slug).slice(0, limit);
}

export function toPublicStory(article: MagazineArticle): PublicStory {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    section: article.section,
    dek: article.dek,
    author: article.author,
    authorPersonPath: article.authorPersonPath ?? null,
    authorOrganizationPath: article.authorOrganizationPath ?? null,
    date: article.date,
    readingTime: article.readingTime,
    heroUrl: article.heroUrl,
  };
}

export async function getArticleHeroMediaMap(): Promise<Record<string, string>> {
  const articles = await listMagazineArticles();
  return Object.fromEntries(articles.filter((article) => article.heroUrl).map((article) => [article.slug, article.heroUrl]));
}

export async function setArticleHeroImage(): Promise<void> {
  throw new Error('Article hero updates must go through the canonical WAKILISHA API/admin layer.');
}

export async function createPreviewNonce(_slug?: string): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

export async function getArticlesByAuthor(authorSlug: string): Promise<MagazineArticle[]> {
  const normalizedTarget = authorSlug.toLowerCase().replace(/[\s_-]+/g, '-');
  const articles = await listMagazineArticles();

  // Try exact slug match first
  let matches = articles.filter((article) => article.author.trim().toLowerCase().replace(/[\s_-]+/g, '-') === normalizedTarget);
  if (matches.length > 0) return matches;

  // Try matching by registry_authors.name — fetch authors and check
  try {
    const { fetchAuthorBySlug } = await import('@/services/authorProfiles');
    const dbAuthor = await fetchAuthorBySlug(normalizedTarget);
    if (dbAuthor) {
      const dbName = dbAuthor.name.trim().toLowerCase();
      matches = articles.filter((article) => {
        const articleAuthor = article.author.trim().toLowerCase().replace(/[\s_-]+/g, '-');
        const articleAuthorRaw = article.author.trim().toLowerCase();
        return articleAuthor === normalizedTarget ||
               articleAuthorRaw === dbName ||
               articleAuthorRaw.includes(dbName);
      });
      if (matches.length > 0) return matches;
    }
  } catch {
    // Silently fall through — return no matches
  }

  return [];
}

function initialMagazineArticles(limit = 500): MagazineArticle[] {
  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : 500;
  const safeLimit = Math.min(500, Math.max(1, requestedLimit));

  return getInlineMagazineFallbackStories()
    .slice(0, safeLimit)
    .map(storyToArticle);
}

export function useMagazineArticles(limit = 500) {
  const initialArticles = initialMagazineArticles(limit);
  const [articles, setArticles] = useState<MagazineArticle[]>(initialArticles);
  const [loading, setLoading] = useState(initialArticles.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const fallbackArticles = initialMagazineArticles(limit);

    setLoading(fallbackArticles.length === 0);
    setError(null);

    listMagazineArticles(limit)
      .then((items) => {
        setArticles(items.length > 0 ? items : fallbackArticles);
        setLoading(false);
      })
      .catch((err) => {
        setArticles(fallbackArticles);
        setError(fallbackArticles.length > 0 ? null : err instanceof Error ? err.message : 'Failed to load articles');
        setLoading(false);
      });
  }, [limit]);

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
        setArticle(null);
        setError(err instanceof Error ? err.message : 'Failed to load article');
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug, previewNonce]);

  return { article, loading, error };
}

export function useSiteContent() {
  const [content, setContent] = useState<SiteContentResponse>({ articles: [], artists: [], releases: [], chartHighlights: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAllSiteContent()
      .then((data) => {
        setContent(data);
        setLoading(false);
      })
      .catch((err) => {
        setContent({ articles: [], artists: [], releases: [], chartHighlights: [] });
        setError(err instanceof Error ? err.message : 'Failed to load site content');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { content, loading, error, refresh };
}
