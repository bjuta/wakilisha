/**
 * Admin Article Data Service
 *
 * Unified data layer for admin article operations. Every admin page that
 * touches article data should go through this service — never raw Supabase.
 *
 * Reads use the shared content pipeline (contentPipeline.ts) for consistent
 * HTML transformation across admin preview and public rendering.
 * Writes wrap the update_article RPC with optimistic locking.
 */

import { supabase } from "@/lib/supabase";
import {
  processArticleContent,
  processArticleContentForEditor,
  processText,
  generateExcerpt,
  normalizeTaxonomyTerms,
} from "@/services/articles/contentPipeline";
import { injectMediaCaptions, buildAssetCaptionMap } from "@/utils/injectMediaCaptions";

/* ─── Raw Supabase Row ─── */

export interface ArticleRow {
  id: string;
  slug: string;
  title: string | null;
  excerpt: string | null;
  content_html: string | null;
  author: string | null;
  published_at: string | null;
  modified_at: string | null;
  categories: unknown[] | null;
  tags: unknown[] | null;
  seo: Record<string, unknown> | null;
  wp_status: string | null;
  hero_image_url: string | null;
  created_at: string;
  updated_at: string | null;
  preview_nonce?: string | null;
  preview_nonce_expires_at?: string | null;
}

/* ─── Admin Detail View ─── */

export interface AdminArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  author: string;
  publishedAt: string;
  categories: string[];
  tags: string[];
  seo: { title?: string; description?: string; keywords?: string };
  wpStatus: string;
  heroImageUrl: string;
  createdAt: string;
  updatedAt: string | null;
  previewNonce?: string | null;
}

/* ─── Admin List View ─── */

export interface AdminArticleListItem {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string | null;
  wpStatus: string | null;
  createdAt: string;
  categories: string[];
  tags: string[];
  heroImageUrl: string | null;
}

/* ─── Trashed Article ─── */

export interface TrashedArticle {
  id: string;
  slug: string;
  title: string;
  author: string;
  trashedAt: string | null;
  createdAt: string;
}

/* ─── Save Payload ─── */

export interface ArticleSavePayload {
  title?: string | null;
  excerpt?: string | null;
  content_html?: string | null;
  author?: string | null;
  categories?: string;
  tags?: string;
  published_at?: string | null;
  seo?: Record<string, unknown>;
  wp_status?: string;
  hero_image_url?: string | null;
  slug?: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  errorCode?: "stale_update" | "permission_denied" | "not_found" | "unknown";
  currentServerState?: AdminArticleDetail;
}

/* ─── Revision Payload ─── */

export interface RevisionPayload {
  articleId: string;
  revisionNumber: number;
  title: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  author: string | null;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  publishedAt: string | null;
  wpStatus: string | null;
  createdBy: "manual_save" | "autosave";
}

/* ─── Select columns used across all queries ─── */

const ARTICLE_SELECT =
  "id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, seo, wp_status, hero_image_url, created_at, updated_at, preview_nonce, preview_nonce_expires_at";

/* ════════════════════════════════════════════
   READ OPERATIONS
   ════════════════════════════════════════════ */

/**
 * Fetch a single article row from Supabase by slug.
 */
async function fetchArticleRow(slug: string): Promise<ArticleRow | null> {
  const { data, error } = await supabase
    .from("wk_articles")
    .select(ARTICLE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load article: ${error.message}`);
  return data as ArticleRow | null;
}

/* ─── WordPress author ID → real display name mapping ─── */
const WP_AUTHOR_ID_MAP: Record<string, string> = {
  "1": "Wakilisha Staff",
  "37": "Muiruri Beautah",
  "38": "Shalom Kendi Mbae",
  "39": "Michael Mburu",
  "40": "Kambura Matiri",
  "41": "Kiuta Faith",
  "42": "gatwiri_c",
  "43": "Mary Gathoni",
  "44": "Timothy Muiruri",
  "47": "Sarah Wambi",
  "48": "Frank Njugi",
  "52": "Victor Muia",
  "54": "Hafare Segelan",
  "179": "Wangari Karume",
};

function resolveAuthorFromRow(row: ArticleRow): string {
  const stored = (row.author ?? "").trim();
  if (stored && stored !== "Wakilisha" && stored !== "wakilisha") return stored;

  const rawMeta = (row as unknown as { raw_meta?: Record<string, unknown> }).raw_meta;
  if (rawMeta) {
    const wpId = String(rawMeta.post_author ?? "").trim();
    if (wpId && WP_AUTHOR_ID_MAP[wpId]) {
      return WP_AUTHOR_ID_MAP[wpId];
    }
  }

  return stored || "Wakilisha Staff";
}

/**
 * Fetch article for admin detail view — full content processing via shared pipeline.
 */
export async function fetchArticleForAdmin(slug: string): Promise<AdminArticleDetail | null> {
  const { data, error } = await supabase
    .from("wk_articles")
    .select(ARTICLE_SELECT + ", raw_meta")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load article: ${error.message}`);
  if (!data) return null;

  const row = data as ArticleRow & { raw_meta?: Record<string, unknown> };

  let contentHtml = processArticleContentForEditor(row.content_html);

  // Inject captions from media assets for images with data-asset-id
  if (row.content_html) {
    const assetIds = extractAssetIdsFromHtml(row.content_html);
    if (assetIds.length > 0) {
      try {
        const { data: assets } = await supabase
          .from("registry_media_assets")
          .select("id, title, metadata")
          .in("id", assetIds);

        if (assets && assets.length > 0) {
          const captionEntries = (assets as Array<{
            id: string;
            title: string | null;
            metadata: Record<string, unknown> | null;
          }>).map((a) => ({
            id: a.id,
            caption: (a.metadata?.caption as string) || null,
            altText: (a.metadata?.alt_text as string) || a.title || null,
            title: a.title || null,
          }));

          const assetMap = buildAssetCaptionMap(captionEntries);
          contentHtml = injectMediaCaptions(contentHtml, assetMap);
        }
      } catch {
        // Non-blocking — captions are a nice-to-have
      }
    }
  }

  return {
    id: row.id,
    slug: row.slug,
    title: processText(row.title),
    excerpt: processText(row.excerpt) || generateExcerpt(row.content_html),
    contentHtml,
    author: resolveAuthorFromRow(row),
    publishedAt: row.published_at ?? "",
    categories: normalizeTaxonomyTerms(row.categories).map(processText),
    tags: normalizeTaxonomyTerms(row.tags).map(processText),
    seo: (row.seo as { title?: string; description?: string; keywords?: string }) ?? {},
    wpStatus: row.wp_status ?? "draft",
    heroImageUrl: row.hero_image_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previewNonce: row.preview_nonce ?? null,
  };
}

/**
 * Extract unique data-asset-id values from article HTML content.
 */
function extractAssetIdsFromHtml(html: string): string[] {
  const ids: string[] = [];
  const regex = /<img[^>]+data-asset-id="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1] && !ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
}

/**
 * Fetch article list for admin listing page — lightweight, no content processing.
 */
export async function fetchArticlesForAdminList(limit = 200): Promise<AdminArticleListItem[]> {
  const { data, error } = await supabase
    .from("wk_articles")
    .select("slug, title, excerpt, author, published_at, wp_status, created_at, categories, tags, hero_image_url")
    .neq("wp_status", "trash")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error loading articles:", error);
    return [];
  }

  return ((data ?? []) as ArticleRow[]).map((row) => ({
    slug: row.slug,
    title: processText(row.title),
    excerpt: processText(row.excerpt) || "",
    author: processText(row.author),
    publishedAt: row.published_at,
    wpStatus: row.wp_status,
    createdAt: row.created_at,
    categories: normalizeTaxonomyTerms(row.categories).map(processText),
    tags: normalizeTaxonomyTerms(row.tags).map(processText),
    heroImageUrl: row.hero_image_url,
  }));
}

/**
 * Check if a slug is already taken by another article.
 */
export async function checkSlugCollision(slug: string, excludeArticleId: string): Promise<boolean> {
  const { data } = await supabase
    .from("wk_articles")
    .select("id")
    .eq("slug", slug)
    .neq("id", excludeArticleId)
    .maybeSingle();

  return !!data;
}

/**
 * Check article scheduling status — used by public article page.
 */
export async function checkArticleScheduling(slug: string): Promise<{
  isScheduled: boolean;
  scheduledDate: string | null;
} | null> {
  const { data } = await supabase
    .from("wk_articles")
    .select("wp_status, published_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  const row = data as { wp_status: string | null; published_at: string | null };
  const isScheduled =
    row.wp_status === "future" &&
    !!row.published_at &&
    new Date(row.published_at) > new Date();

  return {
    isScheduled,
    scheduledDate: isScheduled ? row.published_at : null,
  };
}

/* ════════════════════════════════════════════
   WRITE OPERATIONS
   ════════════════════════════════════════════ */

/**
 * Save article via the update_article RPC.
 * Uses optimistic locking when expectedUpdatedAt is provided.
 */
export async function saveArticle(
  articleId: string,
  payload: ArticleSavePayload,
  expectedUpdatedAt: string | null
): Promise<SaveResult> {
  const { data, error } = await supabase.rpc("update_article", {
    article_id: articleId,
    payload: payload,
    expected_updated_at: expectedUpdatedAt ?? null,
  });

  if (error) {
    // Detect stale update from RPC error
    const msg = error.message.toLowerCase();
    if (msg.includes("stale") || msg.includes("modified") || msg.includes("conflict") || msg.includes("concurrent")) {
      return {
        ok: false,
        error: "This article was modified by someone else while you were editing. Please review the latest version before saving.",
        errorCode: "stale_update",
      };
    }

    if (msg.includes("permission") || msg.includes("unauthorized") || msg.includes("policy")) {
      return {
        ok: false,
        error: `Permission denied: ${error.message}`,
        errorCode: "permission_denied",
      };
    }

    if (msg.includes("not found") || msg.includes("does not exist")) {
      return {
        ok: false,
        error: `Article not found: ${error.message}`,
        errorCode: "not_found",
      };
    }

    return {
      ok: false,
      error: `Save failed: ${error.message}`,
      errorCode: "unknown",
    };
  }

  return { ok: true };
}

/**
 * Create a revision snapshot for a manual save or autosave.
 */
export async function createRevision(payload: RevisionPayload): Promise<void> {
  try {
    // Get next revision number
    const { data: maxRev } = await supabase
      .from("wk_article_revisions")
      .select("revision_number")
      .eq("article_id", payload.articleId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRevNumber = (maxRev?.revision_number ?? 0) + 1;

    await supabase.from("wk_article_revisions").insert({
      article_id: payload.articleId,
      revision_number: nextRevNumber,
      title: payload.title,
      excerpt: payload.excerpt,
      content_html: payload.contentHtml,
      author: payload.author,
      categories: payload.categories,
      tags: payload.tags,
      seo: payload.seo,
      published_at: payload.publishedAt,
      wp_status: payload.wpStatus,
      created_by: payload.createdBy,
    });
  } catch (err) {
    console.error("Failed to create revision:", err);
  }
}

/**
 * Get the latest revision for an article (used for recovery check).
 */
export async function getLatestRevision(articleId: string): Promise<{
  revisionNumber: number;
  createdAt: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  author: string;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  publishedAt: string;
  wpStatus: string | null;
} | null> {
  const { data } = await supabase
    .from("wk_article_revisions")
    .select("id, revision_number, created_at, title, excerpt, content_html, author, categories, tags, seo, wp_status, published_at")
    .eq("article_id", articleId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    revisionNumber: data.revision_number,
    createdAt: data.created_at,
    title: processText(data.title),
    excerpt: processText(data.excerpt),
    contentHtml: data.content_html || "",
    author: processText(data.author),
    categories: normalizeTaxonomyTerms(data.categories).map(processText),
    tags: normalizeTaxonomyTerms(data.tags).map(processText),
    seo: (data.seo as Record<string, unknown>) || {},
    publishedAt: data.published_at || "",
    wpStatus: data.wp_status,
  };
}

/**
 * Clean up old revisions — keep only the most recent 20.
 */
export async function pruneRevisions(articleId: string): Promise<void> {
  try {
    const { data: oldRevisions } = await supabase
      .from("wk_article_revisions")
      .select("id, revision_number")
      .eq("article_id", articleId)
      .order("revision_number", { ascending: false });

    if (oldRevisions && oldRevisions.length > 20) {
      const toDelete = oldRevisions.slice(20);
      const ids = toDelete.map((r) => r.id);
      await supabase.from("wk_article_revisions").delete().in("id", ids);
    }
  } catch (err) {
    console.error("Failed to prune revisions:", err);
  }
}

/**
 * Save hero image to media library.
 */
export async function saveHeroToMediaLibrary(
  articleSlug: string,
  articleTitle: string,
  imageUrl: string
): Promise<void> {
  const mediaSlug = `article-${articleSlug}-hero`;

  try {
    const { data: existing } = await supabase
      .from("registry_media_assets")
      .select("id")
      .eq("slug", mediaSlug)
      .maybeSingle();

    if (imageUrl) {
      if (existing) {
        await supabase
          .from("registry_media_assets")
          .update({
            url: imageUrl,
            title: articleTitle,
            metadata: { alt_text: articleTitle, role: "hero" },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("registry_media_assets").insert({
          slug: mediaSlug,
          title: articleTitle,
          url: imageUrl,
          media_kind: "image",
          status: "active",
          source_kind: "editor_upload",
          source_entity: "article",
          source_record_id: articleSlug,
          metadata: { alt_text: articleTitle, role: "hero" },
        });
      }
    }
  } catch (err) {
    console.error("Failed to save hero to media library:", err);
  }
}

/**
 * Insert a slug redirect record.
 */
export async function insertSlugRedirect(
  oldSlug: string,
  newSlug: string,
  createdBy: string
): Promise<void> {
  try {
    await supabase.from("wk_slug_redirects").insert({
      old_slug: oldSlug,
      new_slug: newSlug,
      entity_type: "article",
      created_by: createdBy,
    });
  } catch {
    // Non-blocking — redirect is a nice-to-have
  }
}

/**
 * Look up a slug redirect.
 */
export async function lookupSlugRedirect(oldSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from("wk_slug_redirects")
    .select("new_slug")
    .eq("old_slug", oldSlug)
    .eq("entity_type", "article")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.new_slug ?? null;
}

/**
 * Trash an article (set wp_status = "trash").
 */
export async function trashArticle(articleId: string): Promise<SaveResult> {
  const { error } = await supabase.rpc("update_article", {
    article_id: articleId,
    payload: { wp_status: "trash" },
    expected_updated_at: null,
  });

  if (error) {
    return { ok: false, error: `Failed to trash article: ${error.message}` };
  }

  return { ok: true };
}

/* ════════════════════════════════════════════
   PREVIEW NONCE OPERATIONS
   ════════════════════════════════════════════ */

/**
 * Generate a shareable preview nonce for a draft article.
 * The nonce is valid for 7 days.
 */
export async function generatePreviewNonce(articleId: string): Promise<string | null> {
  try {
    // Generate a UUID v4
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase.rpc("update_article", {
      article_id: articleId,
      payload: {
        preview_nonce: uuid,
        preview_nonce_expires_at: expiresAt.toISOString(),
      },
      expected_updated_at: null,
    });

    if (error) {
      console.error("Failed to generate preview nonce:", error.message);
      return null;
    }

    // Fetch back the nonce
    const { data: article } = await supabase
      .from("wk_articles")
      .select("preview_nonce")
      .eq("id", articleId)
      .maybeSingle();

    return (article as { preview_nonce?: string } | null)?.preview_nonce ?? null;
  } catch (err) {
    console.error("Failed to generate preview nonce:", err);
    return null;
  }
}

/**
 * Fetch an article by its preview nonce (for shareable preview URLs).
 * Works for drafts, pending, and scheduled articles.
 */
export async function getArticleByPreviewNonce(nonce: string): Promise<AdminArticleDetail | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("wk_articles")
    .select(ARTICLE_SELECT + ", raw_meta")
    .eq("preview_nonce", nonce)
    .gt("preview_nonce_expires_at", now)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as ArticleRow & { raw_meta?: Record<string, unknown> };

  return {
    id: row.id,
    slug: row.slug,
    title: processText(row.title),
    excerpt: processText(row.excerpt) || generateExcerpt(row.content_html),
    contentHtml: processArticleContentForEditor(row.content_html),
    author: resolveAuthorFromRow(row),
    publishedAt: row.published_at ?? "",
    categories: normalizeTaxonomyTerms(row.categories).map(processText),
    tags: normalizeTaxonomyTerms(row.tags).map(processText),
    seo: (row.seo as { title?: string; description?: string; keywords?: string }) ?? {},
    wpStatus: row.wp_status ?? "draft",
    heroImageUrl: row.hero_image_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previewNonce: row.preview_nonce ?? null,
  };
}

/* ════════════════════════════════════════════
   TRASH MANAGEMENT OPERATIONS
   ════════════════════════════════════════════ */

/**
 * List all trashed articles.
 */
export async function listTrashedArticles(): Promise<TrashedArticle[]> {
  const { data, error } = await supabase
    .from("wk_articles")
    .select("id, slug, title, author, updated_at, created_at")
    .eq("wp_status", "trash")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error loading trashed articles:", error);
    return [];
  }

  return ((data ?? []) as Array<{
    id: string;
    slug: string;
    title: string | null;
    author: string | null;
    updated_at: string | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: processText(row.title),
    author: processText(row.author),
    trashedAt: row.updated_at,
    createdAt: row.created_at,
  }));
}

/**
 * Restore a trashed article back to draft status.
 */
export async function restoreArticle(articleId: string): Promise<SaveResult> {
  const { error } = await supabase.rpc("update_article", {
    article_id: articleId,
    payload: { wp_status: "draft" },
    expected_updated_at: null,
  });

  if (error) {
    return { ok: false, error: `Failed to restore article: ${error.message}` };
  }

  return { ok: true };
}

/**
 * Permanently delete an article from the database.
 * This cascades to revisions and slug redirects.
 */
export async function permanentlyDeleteArticle(articleId: string): Promise<SaveResult> {
  try {
    // Delete revisions first
    await supabase
      .from("wk_article_revisions")
      .delete()
      .eq("article_id", articleId);

    // Delete slug redirects for this article
    await supabase
      .from("wk_slug_redirects")
      .delete()
      .eq("entity_type", "article")
      .eq("new_slug", articleId);

    // Delete the article itself
    const { error } = await supabase
      .from("wk_articles")
      .delete()
      .eq("id", articleId);

    if (error) {
      return { ok: false, error: `Failed to permanently delete article: ${error.message}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to permanently delete article: ${err instanceof Error ? err.message : String(err)}` };
  }
}