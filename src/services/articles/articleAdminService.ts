/**
 * Admin Article Data Service
 *
 * Unified data layer for admin article operations. Every admin page that
 * touches article data should go through this service — never raw Supabase.
 *
 * Reads use the shared content pipeline (contentPipeline.ts) for consistent
 * HTML transformation across admin preview and public rendering.
 * Writes use Phase 2A versioned Article RPCs with draft-version locking.
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
  draft_version?: number | null;
}

/* ─── Admin Detail View ─── */

export interface AdminArticleDetail {
  id: string;
  resourceId: string | null;
  ownerId: string | null;
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
  draftVersion: number;
  previewNonce?: string | null;
}

/* ─── Admin List View ─── */

export interface AdminArticleListItem {
  id: string;
  resourceId: string | null;
  ownerId: string | null;
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
  articleSlug?: string;
  draftVersion?: number;
  versionId?: string;
  versionNumber?: number;
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
  draftVersion?: number | null;
}

/* ─── Select columns used across all queries ─── */

const ARTICLE_SELECT =
  "id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, seo, wp_status, hero_image_url, created_at, updated_at, draft_version, preview_nonce, preview_nonce_expires_at";

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

  const {
    data: resourceIdentity,
    error: resourceIdentityError,
  } = await supabase
    .from("wk_resource_owner_index")
    .select("resource_id, owner_id")
    .eq("resource_kind", "article")
    .eq("canonical_record_id", row.id)
    .maybeSingle();

  if (resourceIdentityError) {
    console.error(
      "Failed to load Article resource identity:",
      resourceIdentityError,
    );
  }

  const canonicalIdentity = resourceIdentity as {
    resource_id: string | null;
    owner_id: string | null;
  } | null;

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
    resourceId: canonicalIdentity?.resource_id ?? null,
    ownerId: canonicalIdentity?.owner_id ?? null,
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
    draftVersion: Number(row.draft_version ?? 1),
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
    .select("id, slug, title, excerpt, author, published_at, wp_status, created_at, categories, tags, hero_image_url")
    .neq("wp_status", "trash")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error loading articles:", error);
    return [];
  }

  const articles = ((data ?? []) as ArticleRow[]).map((row) => ({
    id: row.id,
    resourceId: null as string | null,
    ownerId: null as string | null,
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

  const articleIds = articles.map((article) => article.id);

  if (articleIds.length === 0) {
    return articles;
  }

  const { data: resourceData, error: resourceError } = await supabase
    .from("wk_resource_owner_index")
    .select("canonical_record_id, resource_id, owner_id")
    .eq("resource_kind", "article")
    .in("canonical_record_id", articleIds);

  if (resourceError) {
    console.error("Error loading Article resource links:", resourceError);
    return articles;
  }

  const identityByArticleId = new Map(
    ((resourceData ?? []) as Array<{
      canonical_record_id: string | null;
      resource_id: string | null;
      owner_id: string | null;
    }>)
      .filter(
        (resource) =>
          resource.canonical_record_id !== null,
      )
      .map((resource) => [
        resource.canonical_record_id as string,
        {
          resourceId: resource.resource_id,
          ownerId: resource.owner_id,
        },
      ]),
  );

  return articles.map((article) => {
    const identity = identityByArticleId.get(article.id);

    return {
      ...article,
      resourceId: identity?.resourceId ?? null,
      ownerId: identity?.ownerId ?? null,
    };
  });
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



export interface ArticleDraftCreatePayload {
  title: string;
  excerpt?: string;
  contentHtml?: string;
  author?: string;
  slugBase?: string;
  categories?: unknown[];
  tags?: unknown[];
  seo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function slugifyArticleDraft(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "institute-article-draft";
}

async function buildUniqueArticleSlug(base: string): Promise<string> {
  const cleanBase = slugifyArticleDraft(base).slice(0, 76);
  let candidate = cleanBase;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from("wk_articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw new Error(`Failed to check article slug: ${error.message}`);
    if (!data) return candidate;

    candidate = `${cleanBase}-${suffix}`;
    suffix += 1;
  }
}

export async function createArticleDraftForAdmin(payload: ArticleDraftCreatePayload): Promise<AdminArticleDetail> {
  const title = payload.title.trim() || "Untitled Institute article draft";
  const slugBase = payload.slugBase || title;

  const { data, error } = await supabase.rpc("create_institute_article_draft", {
    p_title: title,
    p_slug_base: slugBase,
    p_excerpt: payload.excerpt ?? "",
    p_author: payload.author ?? "WAKILISHA Contributor",
    p_seo: payload.seo ?? {},
    p_metadata: payload.metadata ?? {},
  });

  if (error) throw new Error(`Failed to create article draft: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : null;
  const slug = row?.article_slug as string | undefined;

  if (!slug) throw new Error("Article draft was created but no slug was returned.");

  const article = await fetchArticleForAdmin(slug);
  if (!article) throw new Error("Article draft was created but could not be loaded.");

  return article;
}

/* ════════════════════════════════════════════
   WRITE OPERATIONS
   ════════════════════════════════════════════ */

type ArticleVersionKind = "manual_save" | "submitted";

type TaxonomyPayloadItem = {
  name: string;
  slug?: string;
};

function parseTaxonomyPayload(value: string | undefined): TaxonomyPayloadItem[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return { name: item };
        }

        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const name = String(record.name ?? "").trim();
          const slug = String(record.slug ?? "").trim();
          if (!name && !slug) return null;
          return { name: name || slug, slug: slug || undefined };
        }

        return null;
      })
      .filter((item): item is TaxonomyPayloadItem => Boolean(item));
  } catch {
    return [];
  }
}

async function resolveTaxonomyIds(
  taxonomy: "category" | "post_tag",
  items: TaxonomyPayloadItem[],
): Promise<string[]> {
  if (items.length === 0) return [];

  const { data, error } = await supabase.rpc("get_taxonomy_terms", {
    p_taxonomy: taxonomy,
    p_search: null,
    p_page: 1,
    p_page_size: null,
  });

  if (error) {
    throw new Error(`Failed to load ${taxonomy} terms: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  const bySlug = new Map(rows.map((row) => [row.slug.toLowerCase(), row.id]));
  const byName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  const ids: string[] = [];

  for (const item of items) {
    const id =
      (item.slug ? bySlug.get(item.slug.toLowerCase()) : undefined) ??
      byName.get(item.name.toLowerCase());

    if (!id) {
      throw new Error(`Taxonomy term is not in registry: ${item.name}`);
    }

    if (!ids.includes(id)) ids.push(id);
  }

  return ids;
}

async function resolvePayloadTaxonomyIds(payload: ArticleSavePayload): Promise<string[]> {
  const categoryIds = await resolveTaxonomyIds(
    "category",
    parseTaxonomyPayload(payload.categories),
  );

  const tagIds = await resolveTaxonomyIds(
    "post_tag",
    parseTaxonomyPayload(payload.tags),
  );

  return [...categoryIds, ...tagIds];
}

function classifySaveError(message: string): SaveResult["errorCode"] {
  const msg = message.toLowerCase();

  if (
    msg.includes("stale") ||
    msg.includes("modified") ||
    msg.includes("conflict") ||
    msg.includes("concurrent")
  ) {
    return "stale_update";
  }

  if (msg.includes("permission") || msg.includes("unauthorized") || msg.includes("policy")) {
    return "permission_denied";
  }

  if (msg.includes("not found") || msg.includes("does not exist")) {
    return "not_found";
  }

  return "unknown";
}

/**
 * Save article via the Phase 2A versioned save RPC.
 */
export async function saveArticle(
  articleId: string,
  payload: ArticleSavePayload,
  expectedDraftVersion: number | null,
  versionKind: ArticleVersionKind = "manual_save",
): Promise<SaveResult> {
  if (expectedDraftVersion == null) {
    return {
      ok: false,
      error: "Cannot save because the editor does not know the current draft version. Reload the article and try again.",
      errorCode: "stale_update",
    };
  }

  try {
    const taxonomyTermIds = await resolvePayloadTaxonomyIds(payload);
    const { categories, tags, ...versionedPayload } = payload;

    void categories;
    void tags;

    const { data, error } = await supabase.rpc("save_article_versioned", {
      p_article_id: articleId,
      p_payload: versionedPayload,
      p_expected_draft_version: expectedDraftVersion,
      p_version_kind: versionKind,
      p_taxonomy_term_ids: taxonomyTermIds,
    });

    if (error) {
      const errorCode = classifySaveError(error.message);
      return {
        ok: false,
        error:
          errorCode === "stale_update"
            ? "This article was modified by someone else while you were editing. Please review the latest version before saving."
            : `Save failed: ${error.message}`,
        errorCode,
      };
    }

    const row = Array.isArray(data) ? data[0] : null;

    return {
      ok: true,
      articleSlug: row?.article_slug as string | undefined,
      draftVersion: typeof row?.draft_version === "number" ? row.draft_version : undefined,
      versionId: row?.version_id as string | undefined,
      versionNumber: typeof row?.version_number === "number" ? row.version_number : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown save failure";
    const errorCode = classifySaveError(message);

    return {
      ok: false,
      error:
        errorCode === "stale_update"
          ? "This article was modified by someone else while you were editing. Please review the latest version before saving."
          : `Save failed: ${message}`,
      errorCode,
    };
  }
}


export interface ArticleLifecycleEvent {
  id: string;
  articleId: string;
  versionId: string | null;
  versionNumber: number | null;
  action: string;
  priorStatus: string | null;
  resultingStatus: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  actorId: string | null;
  actorLabel: string | null;
  createdAt: string;
}

export async function fetchArticleLifecycleEvents(articleId: string): Promise<ArticleLifecycleEvent[]> {
  const { data, error } = await (supabase as any).rpc("list_article_lifecycle_events", {
    p_article_id: articleId,
    p_limit: 50,
  });

  if (error) {
    console.error("Failed to load article lifecycle events:", error.message);
    return [];
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  return rows.map((row: any) => ({
    id: row.id,
    articleId: row.article_id,
    versionId: row.version_id ?? null,
    versionNumber: typeof row.version_number === "number" ? row.version_number : row.version_number ? Number(row.version_number) : null,
    action: row.action,
    priorStatus: row.prior_status ?? null,
    resultingStatus: row.resulting_status ?? null,
    note: row.note ?? null,
    metadata: row.metadata ?? {},
    actorId: row.actor_id ?? null,
    actorLabel: row.actor_label ?? null,
    createdAt: row.created_at,
  }));
}

export interface ArticleVersionFingerprintStatus {
  latestVersionNumber: number | null;
  latestContentFingerprint: string | null;
  approvedVersionNumber: number | null;
  approvedContentFingerprint: string | null;
}

export async function fetchArticleVersionFingerprintStatus(
  articleId: string,
  approvedVersionNumber: number | null,
): Promise<ArticleVersionFingerprintStatus> {
  const empty: ArticleVersionFingerprintStatus = {
    latestVersionNumber: null,
    latestContentFingerprint: null,
    approvedVersionNumber,
    approvedContentFingerprint: null,
  };

  if (!approvedVersionNumber) return empty;

  const { data, error } = await (supabase as any).rpc("list_article_versions", {
    p_article_id: articleId,
    p_limit: 50,
  });

  if (error) {
    console.warn("Failed to load article version fingerprints:", error.message);
    return empty;
  }

  const rows = Array.isArray(data) ? data : [];

  const versions = rows
    .map((row: any) => ({
      versionNumber:
        typeof row.revision_number === "number"
          ? row.revision_number
          : row.revision_number
            ? Number(row.revision_number)
            : null,
      contentFingerprint:
        row.content_fingerprint == null
          ? null
          : String(row.content_fingerprint),
    }))
    .filter((row) => row.versionNumber != null);

  const latest = versions
    .slice()
    .sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber))[0] ?? null;

  const approved =
    versions.find((row) => row.versionNumber === approvedVersionNumber) ?? null;

  return {
    latestVersionNumber: latest?.versionNumber ?? null,
    latestContentFingerprint: latest?.contentFingerprint ?? null,
    approvedVersionNumber,
    approvedContentFingerprint: approved?.contentFingerprint ?? null,
  };
}

type ArticleLifecycleRpcName =
  | "submit_article_for_review"
  | "request_article_changes"
  | "approve_article_version"
  | "publish_article_version"
  | "schedule_article_publication"
  | "unpublish_article"
  | "archive_article"
  | "restore_article_from_archive";

async function callArticleLifecycleRpc(
  rpcName: ArticleLifecycleRpcName,
  args: Record<string, unknown>,
): Promise<SaveResult> {
  try {
    const { data, error } = await (supabase as any).rpc(rpcName, args);

    if (error) {
      const errorCode = classifySaveError(error.message);
      return {
        ok: false,
        error:
          errorCode === "stale_update"
            ? "This article was modified by someone else while you were editing. Please review the latest version before saving."
            : `Lifecycle action failed: ${error.message}`,
        errorCode,
      };
    }

    const row = Array.isArray(data) ? data[0] : null;

    return {
      ok: true,
      articleSlug: row?.article_slug as string | undefined,
      draftVersion: typeof row?.draft_version === "number" ? row.draft_version : undefined,
      versionId: row?.version_id as string | undefined,
      versionNumber: typeof row?.version_number === "number" ? row.version_number : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown lifecycle failure";
    const errorCode = classifySaveError(message);

    return {
      ok: false,
      error:
        errorCode === "stale_update"
          ? "This article was modified by someone else while you were editing. Please review the latest version before saving."
          : `Lifecycle action failed: ${message}`,
      errorCode,
    };
  }
}

export async function submitArticleForReview(
  articleId: string,
  expectedDraftVersion: number | null,
  note: string | null = null,
): Promise<SaveResult> {
  if (expectedDraftVersion == null) {
    return {
      ok: false,
      error: "Cannot submit because the editor does not know the current draft version. Reload the article and try again.",
      errorCode: "stale_update",
    };
  }

  return callArticleLifecycleRpc("submit_article_for_review", {
    p_article_id: articleId,
    p_expected_draft_version: expectedDraftVersion,
    p_note: note,
  });
}

export async function requestArticleChanges(
  articleId: string,
  versionId: string | null = null,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("request_article_changes", {
    p_article_id: articleId,
    p_version_id: versionId,
    p_note: note,
  });
}

export async function approveArticleVersion(
  articleId: string,
  versionId: string | null = null,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("approve_article_version", {
    p_article_id: articleId,
    p_version_id: versionId,
    p_note: note,
  });
}

export async function publishArticleVersion(
  articleId: string,
  versionId: string | null = null,
  publishedAt: string | null = null,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("publish_article_version", {
    p_article_id: articleId,
    p_version_id: versionId,
    p_published_at: publishedAt,
    p_note: note,
  });
}

export async function scheduleArticlePublication(
  articleId: string,
  versionId: string | null = null,
  publishAt: string,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("schedule_article_publication", {
    p_article_id: articleId,
    p_version_id: versionId,
    p_publish_at: publishAt,
    p_note: note,
  });
}

export async function unpublishArticle(
  articleId: string,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("unpublish_article", {
    p_article_id: articleId,
    p_note: note,
  });
}

export async function archiveArticle(
  articleId: string,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("archive_article", {
    p_article_id: articleId,
    p_note: note,
  });
}

export async function restoreArticleFromArchive(
  articleId: string,
  note: string | null = null,
): Promise<SaveResult> {
  return callArticleLifecycleRpc("restore_article_from_archive", {
    p_article_id: articleId,
    p_note: note,
  });
}


/**
 * Create a durable autosave snapshot.
 */
export async function createRevision(payload: RevisionPayload): Promise<void> {
  if (payload.createdBy === "manual_save") return;
  if (payload.draftVersion == null) return;

  const { error } = await supabase.rpc("create_article_autosave", {
    p_article_id: payload.articleId,
    p_expected_draft_version: payload.draftVersion,
    p_payload: {
      title: payload.title,
      excerpt: payload.excerpt,
      content_html: payload.contentHtml,
      author: payload.author,
      seo: payload.seo,
    },
  });

  if (error) {
    throw new Error(`Autosave failed: ${error.message}`);
  }
}

/**
 * Get the latest durable autosave for an article.
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
  const { data, error } = await supabase.rpc("get_latest_article_autosave", {
    p_article_id: articleId,
  });

  if (error) {
    console.warn("Failed to load latest autosave:", error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    revisionNumber: Number(row.version_number ?? 0),
    createdAt: String(row.created_at ?? ""),
    title: String(row.title ?? ""),
    excerpt: String(row.excerpt ?? ""),
    contentHtml: String(row.content_html ?? ""),
    author: String(row.author_display ?? ""),
    categories: normalizeTaxonomyTerms(row.category_snapshot).map(processText),
    tags: normalizeTaxonomyTerms(row.tag_snapshot).map(processText),
    seo: (row.seo as Record<string, unknown>) ?? {},
    publishedAt: "",
    wpStatus: null,
  };
}

/**
 * Revision pruning now happens inside the Phase 2A database RPCs.
 */
export async function pruneRevisions(articleId: string): Promise<void> {
  void articleId;
  return;
}

/**
 * Save hero image to media library.
 */
export async function saveHeroToMediaLibrary(
  articleSlug: string,
  articleTitle: string,
  imageUrl: string
): Promise<void> {
  void articleSlug;
  void articleTitle;
  void imageUrl;
  return;
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
  return archiveArticle(articleId);
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
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await (supabase as any).rpc("create_article_preview_link", {
      p_article_id: articleId,
      p_version_id: null,
      p_expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error("Failed to generate version-bound preview nonce:", error.message);
      return null;
    }

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const row = rows[0] as { nonce?: string } | undefined;

    return row?.nonce ?? null;
  } catch (err) {
    console.error("Failed to generate version-bound preview nonce:", err);
    return null;
  }
}

/**
 * Fetch an article by its preview nonce (for shareable preview URLs).
 * Works for drafts, pending, and scheduled articles.
 */
export async function getArticleByPreviewNonce(nonce: string): Promise<AdminArticleDetail | null> {
  const { data, error } = await (supabase as any).rpc("resolve_article_preview_nonce", {
    p_nonce: nonce,
  });

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as (ArticleRow & {
    raw_meta?: Record<string, unknown>;
    version_number?: number | null;
  }) | undefined;

  if (error || !row) return null;

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
    draftVersion: Number(row.version_number ?? row.draft_version ?? 1),
    previewNonce: nonce,
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
  return restoreArticleFromArchive(articleId);
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