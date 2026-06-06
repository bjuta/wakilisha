import { useCallback, useEffect, useState } from 'react';
import { listMagazineStories, type RepairedStory } from '@/services/repairedContent/client';

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

export type { RepairedStory };

function storyToArticle(story: RepairedStory): MagazineArticle {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    section: story.section || 'Article',
    author: story.author || 'WAKILISHA Editorial',
    date: story.date || 'Undated',
    readingTime: story.readingTime || 3,
    heroUrl: story.heroUrl,
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

export async function listMagazineArticles(): Promise<MagazineArticle[]> {
  const stories = await listMagazineStories();
  return stories.map(storyToArticle);
}

export async function getMagazineArticleBySlug(slug: string | undefined): Promise<MagazineArticle | null> {
  if (!slug) return null;
  const articles = await listMagazineArticles();
  return articles.find((article) => article.slug === slug) ?? null;
}

export async function getRelatedArticles(article: MagazineArticle, limit = 3): Promise<MagazineArticle[]> {
  const articles = await listMagazineArticles();
  return articles.filter((item) => item.slug !== article.slug).slice(0, limit);
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

export async function getArticleHeroMediaMap(): Promise<Record<string, string>> {
  const articles = await listMagazineArticles();
  return Object.fromEntries(articles.filter((article) => article.heroUrl).map((article) => [article.slug, article.heroUrl]));
}

export async function setArticleHeroImage(): Promise<void> {
  throw new Error('Article hero updates must go through the canonical WAKILISHA API/admin layer.');
}

export async function createPreviewNonce(): Promise<string> {
  throw new Error('Article previews must go through the canonical WAKILISHA API/admin layer.');
}

export async function getArticlesByAuthor(authorSlug: string): Promise<MagazineArticle[]> {
  const normalizedTarget = authorSlug.toLowerCase().replace(/[\s_-]+/g, '-');
  const articles = await listMagazineArticles();
  return articles.filter((article) => article.author.trim().toLowerCase().replace(/[\s_-]+/g, '-') === normalizedTarget);
}

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
        setArticles([]);
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
