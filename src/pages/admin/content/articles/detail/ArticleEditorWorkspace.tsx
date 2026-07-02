import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ArticleEditorHeader } from "./components/ArticleEditorHeader";
import { ArticleContentEditor } from "./components/ArticleContentEditor";
import { ArticleMetaPanel } from "./components/ArticleMetaPanel";
import { ArticlePreviewModal } from "./components/ArticlePreviewModal";
import { ArticlePublishChecklist } from "./components/ArticlePublishChecklist";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  fetchArticleForAdmin,
  saveArticle,
  createRevision,
  getLatestRevision,
  pruneRevisions,
  saveHeroToMediaLibrary,
  checkSlugCollision,
  insertSlugRedirect,
  trashArticle,
  generatePreviewNonce,
  type AdminArticleDetail,
  type ArticleSavePayload,
} from "@/services/articles/articleAdminService";
import { processArticleContent } from "@/services/articles/contentPipeline";
import { syncInstituteArticlePublicationState } from "@/services/institute/institutePublicationSyncService";

/* ─── Draft state (UI-layer only) ─── */

interface Draft {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  categories: string[];
  tags: string[];
  publishedAt: string;
  seo: { title?: string; description?: string; keywords?: string };
}

/* ─── Recovery payload ─── */

interface RecoveryPayload {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  publishedAt: string;
  wpStatus: string | null;
  revisionNumber: number;
  createdAt: string;
}

/* ─── Toast ─── */

interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

/* ─── Page ─── */

export type ArticleEditorWorkspaceMode = "article-admin" | "institute";

export type ArticleReviewSubmitPayload = {
  articleId: string;
  articleSlug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  author: string;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  wpStatus: string | null;
};

export type ArticleEditorWorkspaceProps = {
  slug?: string;
  mode?: ArticleEditorWorkspaceMode;
  returnPath?: string;
  allowSubmitForReview?: boolean;
  submitForReviewLabel?: string;
  instituteNotice?: string;
  onSubmittedForReview?: (payload: ArticleReviewSubmitPayload) => Promise<void> | void;
};

export function ArticleEditorWorkspace({
  slug,
  mode = "article-admin",
  returnPath = "/admin/content/articles",
  allowSubmitForReview = true,
  submitForReviewLabel = "Submit for Review",
  instituteNotice,
  onSubmittedForReview,
}: ArticleEditorWorkspaceProps) {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const isInstituteMode = mode === "institute";

  const userCanPublish = adminUser.can("publish_articles");
  const userCanEditOthers = adminUser.can("edit_others_articles");
  const isAdmin = adminUser.role === "administrator" || adminUser.can("admin_god_mode");

  // ── State ──
  const [article, setArticle] = useState<AdminArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ── Central permission object ──
  const articlePermissions = useMemo(() => {
    const articleAuthor = (article?.author ?? "").toLowerCase();
    const currentUserName = adminUser.name?.toLowerCase() ?? "";
    const isOwner =
      !articleAuthor || !currentUserName
        ? true
        : articleAuthor === currentUserName ||
          articleAuthor.includes(currentUserName) ||
          currentUserName.includes(articleAuthor);

    const canView = true;
    const canEdit = isAdmin || isOwner || userCanEditOthers;
    const canDelete = !isInstituteMode && (isAdmin || (isOwner && userCanEditOthers));
    const canPublish = !isInstituteMode && (isAdmin || (isOwner && userCanPublish));
    const canAutosave = canEdit;
    const reason = !canEdit
      ? "You can only edit your own articles. This article is owned by " +
        (article?.author || "another author") +
        "."
      : null;

    return { canView, canEdit, canDelete, canPublish, canAutosave, reason };
  }, [article, adminUser, isAdmin, isInstituteMode, userCanEditOthers, userCanPublish]);

  // ── Taxonomy slug maps (from ArticleMetaPanel) ──
  const [categorySlugMap, setCategorySlugMap] = useState<Record<string, string>>();
  const [tagSlugMap, setTagSlugMap] = useState<Record<string, string>>();

  // ── Draft state ──
  const [draft, setDraft] = useState<Draft>({
    title: "",
    excerpt: "",
    content: "",
    author: "",
    categories: [],
    tags: [],
    publishedAt: "",
    seo: {},
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isSavingHero, setIsSavingHero] = useState(false);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecovery, setShowRecovery] = useState<RecoveryPayload | null>(null);
  const [showPublishChecklist, setShowPublishChecklist] = useState(false);

  // ── Conflict detection state ──
  const [showConflict, setShowConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string>("");
  const [pendingConflictPayload, setPendingConflictPayload] = useState<Partial<ArticleSavePayload> | null>(null);

  // ── Preview nonce state ──
  const [previewNonce, setPreviewNonce] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Refs for stable access in interval callbacks
  const stateRef = useRef({
    isDirty,
    isSaving,
    isPublishing,
    isAutosaving,
    draft,
    article,
  });
  stateRef.current = { isDirty, isSaving, isPublishing, isAutosaving, draft, article };

  // Ref for optimistic locking
  const articleUpdatedAtRef = useRef<string | null>(null);
  // Ref for autosave dedup
  const lastAutosavedContentRef = useRef<string | null>(null);

  /* ─── Load article ─── */
  useEffect(() => {
    if (!slug) return;

    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchArticleForAdmin(slug);

        if (!alive) return;

        if (!data) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        articleUpdatedAtRef.current = data.updatedAt ?? null;
        setArticle(data);
        setPreviewNonce(data.previewNonce ?? null);

        // Auto-generate preview nonce for non-published articles so Preview works immediately
        if (data.wpStatus !== "publish" && !data.previewNonce) {
          generatePreviewNonce(data.id).then((nonce) => {
            if (nonce && alive) setPreviewNonce(nonce);
          }).catch(() => {});
        }

        setDraft({
          title: data.title,
          excerpt: data.excerpt,
          content: data.contentHtml,
          author: data.author,
          categories: data.categories,
          tags: data.tags,
          publishedAt: data.publishedAt,
          seo: data.seo,
        });
        setIsDirty(false);
        setLoading(false);

        // Check for recovery
        await checkForRecovery(data.id, data.updatedAt);
      } catch (err) {
        if (!alive) return;
        addToast("error", "Failed to load article.");
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [slug]);

  /* ─── Recovery check ─── */
  async function checkForRecovery(articleId: string, articleUpdatedAt: string | null) {
    const rev = await getLatestRevision(articleId);
    if (!rev) return;

    const autosaveTime = new Date(rev.createdAt);
    const articleTime = articleUpdatedAt ? new Date(articleUpdatedAt) : new Date(0);

    if (autosaveTime > articleTime) {
      setShowRecovery({
        title: rev.title,
        excerpt: rev.excerpt,
        content: rev.contentHtml,
        author: rev.author,
        categories: rev.categories,
        tags: rev.tags,
        seo: rev.seo,
        publishedAt: rev.publishedAt,
        wpStatus: rev.wpStatus,
        revisionNumber: rev.revisionNumber,
        createdAt: rev.createdAt,
      });
    }
  }

  /* ─── Autosave ─── */
  async function autosaveRevision(currentDraft: Draft) {
    if (!articlePermissions.canAutosave) return;
    const currentArticle = stateRef.current.article;
    if (!currentArticle) return;

    const fingerprint = currentDraft.content + currentDraft.title + currentDraft.excerpt;
    if (fingerprint === lastAutosavedContentRef.current) return;

    setIsAutosaving(true);

    try {
      await createRevision({
        articleId: currentArticle.id,
        revisionNumber: 0, // computed by service
        title: currentDraft.title || null,
        excerpt: currentDraft.excerpt || null,
        contentHtml: currentDraft.content || null,
        author: currentDraft.author || null,
        categories: currentDraft.categories,
        tags: currentDraft.tags,
        seo: currentDraft.seo,
        publishedAt: currentDraft.publishedAt || null,
        wpStatus: currentArticle.wpStatus,
        createdBy: "autosave",
      });

      const now = new Date().toISOString();
      setLastAutosavedAt(now);
      lastAutosavedContentRef.current = fingerprint;

      await pruneRevisions(currentArticle.id);
    } catch (err) {
      console.error("Autosave error:", err);
    } finally {
      setIsAutosaving(false);
    }
  }

  // 10-second autosave interval
  useEffect(() => {
    const interval = setInterval(() => {
      const { isDirty: dirty, isSaving: saving, isPublishing: publishing, isAutosaving: autosaving, draft: d } =
        stateRef.current;
      if (dirty && !saving && !publishing && !autosaving) {
        autosaveRevision(d);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  /* ─── Toast helpers ─── */
  function addToast(type: ToastMsg["type"], message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  /* ─── Draft setters ─── */
  const patchDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }, []);

  /* ─── Restore draft ─── */
  const handleRestoreDraft = useCallback(
    (payload: {
      title: string;
      excerpt: string;
      content: string;
      author: string;
      categories: string[];
      tags: string[];
      seo: Record<string, unknown>;
      publishedAt: string;
      wpStatus: string | null;
    }) => {
      setDraft({
        title: payload.title,
        excerpt: payload.excerpt,
        content: payload.content,
        author: payload.author,
        categories: payload.categories,
        tags: payload.tags,
        publishedAt: payload.publishedAt,
        seo: payload.seo as { title?: string; description?: string; keywords?: string },
      });
      setIsDirty(true);
      addToast("success", "Version restored. Remember to save!");
    },
    []
  );

  function handleInsertLink(html: string) {
    setDraft((prev) => ({ ...prev, content: prev.content + "\n\n" + html }));
    setIsDirty(true);
  }

  function handleEmbedRelease(marker: string) {
    setDraft((prev) => ({ ...prev, content: prev.content + "\n\n" + marker }));
    setIsDirty(true);
  }

  // ── Helper: convert string names to taxonomy objects with slugs ──
  const slugify = useCallback((text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }, []);

  function buildTaxonomyObjects(names: string[], slugMap?: Record<string, string>): Array<{ name: string; slug: string }> {
    return names.map((name) => ({
      name,
      slug: slugMap?.[name] || slugify(name),
    }));
  }


  function normalizeTextForCompare(value: unknown): string {
    return value == null ? "" : String(value).trim();
  }

  function normalizeListForCompare(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "name" in item) {
          return String((item as { name?: unknown }).name ?? "");
        }
        return String(item ?? "");
      })
      .map((item) => item.trim())
      .filter(Boolean)
      .sort();
  }

  function articleSavedFingerprint(source: AdminArticleDetail) {
    return JSON.stringify({
      title: normalizeTextForCompare(source.title),
      excerpt: normalizeTextForCompare(source.excerpt),
      contentHtml: normalizeTextForCompare(source.contentHtml),
      author: normalizeTextForCompare(source.author),
      categories: normalizeListForCompare(source.categories),
      tags: normalizeListForCompare(source.tags),
      publishedAt: normalizeTextForCompare(source.publishedAt),
      wpStatus: normalizeTextForCompare(source.wpStatus),
      heroImageUrl: normalizeTextForCompare(source.heroImageUrl),
    });
  }

  function draftSaveFingerprint(currentDraft: Draft, expectedStatus: string | null | undefined, expectedPublishedAt: string | null | undefined) {
    return JSON.stringify({
      title: normalizeTextForCompare(currentDraft.title),
      excerpt: normalizeTextForCompare(currentDraft.excerpt),
      contentHtml: normalizeTextForCompare(currentDraft.content),
      author: normalizeTextForCompare(currentDraft.author),
      categories: normalizeListForCompare(currentDraft.categories),
      tags: normalizeListForCompare(currentDraft.tags),
      publishedAt: normalizeTextForCompare(expectedPublishedAt ?? currentDraft.publishedAt),
      wpStatus: normalizeTextForCompare(expectedStatus),
    });
  }

  function articleMatchesDraftSave(
    freshArticle: AdminArticleDetail,
    currentDraft: Draft,
    expectedStatus: string | null | undefined,
    expectedPublishedAt: string | null | undefined,
  ) {
    const articleComparable = JSON.stringify({
      title: normalizeTextForCompare(freshArticle.title),
      excerpt: normalizeTextForCompare(freshArticle.excerpt),
      contentHtml: normalizeTextForCompare(freshArticle.contentHtml),
      author: normalizeTextForCompare(freshArticle.author),
      categories: normalizeListForCompare(freshArticle.categories),
      tags: normalizeListForCompare(freshArticle.tags),
      publishedAt: normalizeTextForCompare(expectedPublishedAt ?? freshArticle.publishedAt),
      wpStatus: normalizeTextForCompare(expectedStatus ?? freshArticle.wpStatus),
    });

    return articleComparable === draftSaveFingerprint(currentDraft, expectedStatus, expectedPublishedAt);
  }

  function applyServerArticleState(freshArticle: AdminArticleDetail, resetDraft = true) {
    articleUpdatedAtRef.current = freshArticle.updatedAt ?? null;
    setArticle(freshArticle);
    setPreviewNonce(freshArticle.previewNonce ?? null);

    if (resetDraft) {
      setDraft({
        title: freshArticle.title,
        excerpt: freshArticle.excerpt,
        content: freshArticle.contentHtml,
        author: freshArticle.author,
        categories: freshArticle.categories,
        tags: freshArticle.tags,
        publishedAt: freshArticle.publishedAt,
        seo: freshArticle.seo,
      });
    }
  }

  /* ─── Save helpers ─── */

  function buildSavePayload(extraFields: Partial<ArticleSavePayload> = {}): ArticleSavePayload {
    return {
      title: draft.title || null,
      excerpt: draft.excerpt || null,
      content_html: draft.content || null,
      author: draft.author || null,
      categories: JSON.stringify(buildTaxonomyObjects(draft.categories, categorySlugMap)),
      tags: JSON.stringify(buildTaxonomyObjects(draft.tags, tagSlugMap)),
      published_at: draft.publishedAt || null,
      seo: draft.seo,
      ...extraFields,
    };
  }

  async function saveToSupabase(extraFields: Partial<ArticleSavePayload> = {}, forceOverwrite = false): Promise<boolean> {
    if (!article) return false;

    const currentArticle = article;
    const currentDraft: Draft = {
      title: draft.title,
      excerpt: draft.excerpt,
      content: draft.content,
      author: draft.author,
      categories: [...draft.categories],
      tags: [...draft.tags],
      publishedAt: draft.publishedAt,
      seo: { ...draft.seo },
    };

    const payload = buildSavePayload(extraFields);
    const expectedStatus = (extraFields.wp_status as string | undefined) ?? currentArticle.wpStatus;
    const expectedPublishedAt = (extraFields.published_at as string | undefined) ?? currentDraft.publishedAt;
    let lockTimestamp = forceOverwrite ? null : articleUpdatedAtRef.current;

    let result = await saveArticle(currentArticle.id, payload, lockTimestamp);

    if (!result.ok && result.errorCode === "stale_update" && !forceOverwrite) {
      const freshArticle = await fetchArticleForAdmin(currentArticle.slug);

      if (freshArticle) {
        if (articleMatchesDraftSave(freshArticle, currentDraft, expectedStatus, expectedPublishedAt)) {
          applyServerArticleState(freshArticle, true);
          setIsDirty(false);
          lastAutosavedContentRef.current = currentDraft.content + currentDraft.title + currentDraft.excerpt;
          return true;
        }

        const serverStillMatchesOurLastSavedArticle =
          articleSavedFingerprint(freshArticle) === articleSavedFingerprint(currentArticle);

        if (serverStillMatchesOurLastSavedArticle) {
          applyServerArticleState(freshArticle, false);
          lockTimestamp = freshArticle.updatedAt ?? null;
          result = await saveArticle(currentArticle.id, payload, lockTimestamp);

          if (!result.ok && result.errorCode === "stale_update") {
            const afterRetry = await fetchArticleForAdmin(currentArticle.slug);
            if (afterRetry && articleMatchesDraftSave(afterRetry, currentDraft, expectedStatus, expectedPublishedAt)) {
              applyServerArticleState(afterRetry, true);
              setIsDirty(false);
              lastAutosavedContentRef.current = currentDraft.content + currentDraft.title + currentDraft.excerpt;
              return true;
            }
          }
        } else {
          setConflictError(result.error ?? "This article was modified by someone else while you were editing.");
          setPendingConflictPayload(extraFields);
          setShowConflict(true);
          return false;
        }
      }
    }

    if (!result.ok) {
      if (result.errorCode === "stale_update" && !forceOverwrite) {
        setConflictError(result.error ?? "This article was modified by someone else while you were editing.");
        setPendingConflictPayload(extraFields);
        setShowConflict(true);
        return false;
      }

      addToast("error", result.error ?? "Save failed.");
      return false;
    }

    const newStatus = (extraFields.wp_status as string | undefined) ?? currentArticle.wpStatus;

    await createRevision({
      articleId: currentArticle.id,
      revisionNumber: 0,
      title: currentDraft.title || null,
      excerpt: currentDraft.excerpt || null,
      contentHtml: currentDraft.content || null,
      author: currentDraft.author || null,
      categories: currentDraft.categories,
      tags: currentDraft.tags,
      seo: currentDraft.seo,
      publishedAt: currentDraft.publishedAt || null,
      wpStatus: newStatus ?? null,
      createdBy: "manual_save",
    });

    const refreshedArticle = await fetchArticleForAdmin(currentArticle.slug);

    if (refreshedArticle) {
      applyServerArticleState(refreshedArticle, true);

      if (typeof extraFields.wp_status !== "undefined") {
        await syncInstituteArticlePublicationState({
          articleId: refreshedArticle.id,
          articleSlug: refreshedArticle.slug,
          wpStatus: refreshedArticle.wpStatus,
          publishedAt: refreshedArticle.publishedAt,
        });
      }
    } else {
      articleUpdatedAtRef.current = null;
      setArticle((prev) =>
        prev
          ? {
              ...prev,
              title: currentDraft.title,
              excerpt: currentDraft.excerpt,
              contentHtml: currentDraft.content,
              author: currentDraft.author,
              categories: currentDraft.categories,
              tags: currentDraft.tags,
              publishedAt: payload.published_at ?? prev.publishedAt,
              wpStatus: newStatus ?? prev.wpStatus,
            }
          : prev,
      );
    }

    lastAutosavedContentRef.current = currentDraft.content + currentDraft.title + currentDraft.excerpt;
    setIsDirty(false);
    return true;
  }

  /** Force overwrite after conflict — reloads the article first then saves. */
  async function handleConflictOverwrite() {
    if (!article || !slug) return;
    setShowConflict(false);

    // Reload the latest server state to get a fresh updated_at
    const freshData = await fetchArticleForAdmin(slug);
    if (freshData) {
      articleUpdatedAtRef.current = freshData.updatedAt ?? null;
    }

    // Force save with null lock
    const extraFields = pendingConflictPayload ?? {};
    setIsSaving(true);
    const ok = await saveToSupabase(extraFields, true);
    setIsSaving(false);
    if (ok) {
      addToast("success", "Changes saved (overwrote newer version).");
    }
  }

  /** Discard changes — reload the latest article from the server. */
  async function handleConflictDiscard() {
    if (!slug) return;
    setShowConflict(false);

    const freshData = await fetchArticleForAdmin(slug);
    if (freshData) {
      articleUpdatedAtRef.current = freshData.updatedAt ?? null;
      setArticle(freshData);
      setPreviewNonce(freshData.previewNonce ?? null);
      setDraft({
        title: freshData.title,
        excerpt: freshData.excerpt,
        content: freshData.contentHtml,
        author: freshData.author,
        categories: freshData.categories,
        tags: freshData.tags,
        publishedAt: freshData.publishedAt,
        seo: freshData.seo,
      });
      setIsDirty(false);
      addToast("info", "Reloaded the latest version from the server.");
    }
  }

  async function handleSaveDraft() {
    if (!articlePermissions.canEdit) {
      addToast("error", articlePermissions.reason ?? "Permission denied.");
      return;
    }
    setIsSaving(true);
    const ok = await saveToSupabase({ wp_status: "draft" });
    setIsSaving(false);
    if (ok) addToast("success", "Saved as draft.");
  }

  async function handlePublish() {
    if (!articlePermissions.canPublish) {
      addToast("error", "You do not have permission to publish articles.");
      return;
    }
    setShowPublishChecklist(true);
  }

  async function handlePublishConfirm() {
    setShowPublishChecklist(false);
    if (!articlePermissions.canPublish) {
      addToast("error", "You do not have permission to publish articles.");
      return;
    }
    setIsPublishing(true);
    const isScheduled = draft.publishedAt && new Date(draft.publishedAt) > new Date();
    const publishDate = draft.publishedAt || new Date().toISOString();
    const ok = await saveToSupabase({
      wp_status: isScheduled ? "future" : "publish",
      published_at: publishDate,
    });
    setIsPublishing(false);
    if (ok) {
      setDraft((prev) => ({ ...prev, publishedAt: publishDate }));
      if (isScheduled) {
        addToast("info", `Article scheduled for ${new Date(publishDate).toLocaleString()}.`);
      } else {
        addToast("success", "Article published!");
      }
    }
  }

  async function handleUnpublish() {
    if (!articlePermissions.canPublish) {
      addToast("error", "You do not have permission to unpublish.");
      return;
    }
    setIsSaving(true);
    const ok = await saveToSupabase({ wp_status: "draft" });
    setIsSaving(false);
    if (ok) addToast("info", "Article unpublished — saved as draft.");
  }

  async function handleStatusChange(newStatus: string) {
    if (!articlePermissions.canEdit) {
      addToast("error", articlePermissions.reason ?? "Permission denied.");
      return;
    }

    if (newStatus === "publish" && !articlePermissions.canPublish) {
      addToast("error", "You do not have permission to publish articles.");
      return;
    }

    setIsSaving(true);
    const ok = await saveToSupabase({ wp_status: newStatus });
    setIsSaving(false);

    if (ok) {
      const labels: Record<string, string> = { publish: "Published", pending: "Pending Review", draft: "Draft" };
      addToast("success", `Status changed to ${labels[newStatus] || newStatus}.`);
    }
  }

  async function handleSubmitForReview() {
    if (!articlePermissions.canEdit) {
      addToast("error", articlePermissions.reason ?? "Permission denied.");
      return;
    }
    setIsSaving(true);
    const ok = await saveToSupabase({ wp_status: "pending" });
    setIsSaving(false);
    if (ok) {
      if (onSubmittedForReview && article) {
        try {
          await onSubmittedForReview({
            articleId: article.id,
            articleSlug: article.slug,
            title: draft.title,
            excerpt: draft.excerpt,
            contentHtml: draft.content,
            author: draft.author,
            categories: draft.categories,
            tags: draft.tags,
            seo: draft.seo,
            wpStatus: "pending",
          });
        } catch (error) {
          addToast("error", error instanceof Error ? error.message : "Failed to submit for review.");
          return;
        }
      }

      addToast("success", "Submitted for review.");
    }
  }

  async function handleDelete() {
    if (!articlePermissions.canDelete) {
      addToast("error", "You do not have permission to delete this article.");
      return;
    }
    if (!article) return;

    const result = await trashArticle(article.id);
    if (!result.ok) {
      addToast("error", result.error ?? "Failed to trash article.");
      return;
    }

    addToast("info", "Article moved to trash.");
    setTimeout(() => navigate(returnPath), 1000);
  }

  async function handleSaveHeroImage(url: string) {
    if (!articlePermissions.canEdit) {
      addToast("error", articlePermissions.reason ?? "Permission denied.");
      return;
    }
    if (!article) return;
    setIsSavingHero(true);
    try {
      const result = await saveArticle(article.id, { hero_image_url: url || null }, articleUpdatedAtRef.current);

      if (!result.ok) {
        addToast("error", result.error ?? "Hero image save failed.");
        return;
      }

      const refreshedArticle = await fetchArticleForAdmin(article.slug);
      if (refreshedArticle) {
        applyServerArticleState(refreshedArticle, false);
      } else {
        articleUpdatedAtRef.current = null;
        setArticle((prev) => (prev ? { ...prev, heroImageUrl: url || "" } : prev));
      }

      if (url) {
        await saveHeroToMediaLibrary(article.slug, draft.title, url);
      }

      addToast("success", url ? "Hero image saved to media library." : "Hero image removed.");
    } finally {
      setIsSavingHero(false);
    }
  }

  function handlePreview() {
    if (!article) return;
    setShowPreview(true);
    addToast("info", "Preview mode — scroll down to see the full article.");
  }

  async function handleSlugChange(newSlug: string): Promise<boolean> {
    if (!articlePermissions.canEdit) {
      addToast("error", articlePermissions.reason ?? "Permission denied.");
      return false;
    }
    if (!article || !slug) return false;

    const collision = await checkSlugCollision(newSlug, article.id);
    if (collision) {
      addToast("error", `Slug "${newSlug}" is already taken.`);
      return false;
    }

    const result = await saveArticle(article.id, { slug: newSlug }, articleUpdatedAtRef.current);

    if (!result.ok) {
      addToast("error", result.error ?? "Failed to update slug.");
      return false;
    }

    await insertSlugRedirect(slug, newSlug, adminUser.name || "system");

    addToast("success", "Slug updated. Reloading…");
    setTimeout(() => navigate(`/admin/content/articles/${newSlug}`), 800);
    return true;
  }

  /** Generate a shareable preview link for this article. */
  async function handleGeneratePreviewLink() {
    if (!article) return;
    setIsGeneratingPreview(true);
    try {
      const nonce = await generatePreviewNonce(article.id);
      if (nonce) {
        setPreviewNonce(nonce);
        addToast("success", "Preview link generated!");
      } else {
        addToast("error", "Failed to generate preview link.");
      }
    } finally {
      setIsGeneratingPreview(false);
    }
  }

  /** Open the magazine preview in a new tab, generating a nonce on-the-fly if needed. */
  async function handleMagazinePreview() {
    if (!article) return;
    let nonce = previewNonce;

    // If article isn't published and there's no nonce yet, generate one now
    if (article.wpStatus !== "publish" && !nonce) {
      setIsGeneratingPreview(true);
      nonce = await generatePreviewNonce(article.id);
      if (nonce) setPreviewNonce(nonce);
      setIsGeneratingPreview(false);
    }

    const isPublished = article.wpStatus === "publish";
    const url = isPublished || !nonce
      ? `/magazine/${article.slug}`
      : `/magazine/${article.slug}?preview=${nonce}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const previewUrl = previewNonce
    ? `${window.location.origin}/preview/${previewNonce}`
    : null;

  // ════════════════════════════════════════════
  // Store content in seo object as _content for the SEO analyzer
  const seoWithContent = { ...draft.seo, _content: draft.content };

  /* ─── Unsaved changes warning ─── */
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  /* ─── Keyboard shortcut: Cmd/Ctrl + S ─── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (articlePermissions.canEdit) handleSaveDraft();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, article]);

  /* ─── Render states ─── */

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-72 rounded-xl bg-[var(--wk-surface-raised)]" />
        <div className="h-[500px] rounded-xl bg-[var(--wk-surface-raised)]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]">
          <WkIcon name="FileX" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-[var(--wk-text)]">Article Not Found</h2>
        <p className="text-[13px] text-[var(--wk-text-muted)]">No article with slug "{slug}"</p>
        <button
          onClick={() => navigate(returnPath)}
          className="wk-button wk-button-secondary wk-button-sm"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Back to Articles
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="space-y-5">
      {isInstituteMode ? (
        <div className="rounded-xl border border-wk-warning/25 bg-wk-warning-soft/70 px-3 py-2.5 text-[12px] font-bold leading-5 text-wk-text-muted">
          {instituteNotice ?? "Draft, save, preview, then submit."}
        </div>
      ) : null}

      {/* Header */}
      <ArticleEditorHeader
        slug={article.slug}
        title={draft.title}
        status={article.wpStatus}
        isDirty={isDirty}
        isSaving={isSaving}
        isPublishing={isPublishing}
        isPreviewing={false}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onDelete={() => setShowDeleteConfirm(true)}
        onPreview={handlePreview}
        onSubmitForReview={handleSubmitForReview}
        allowSubmitForReview={allowSubmitForReview}
        submitForReviewLabel={submitForReviewLabel}
        userCanPublish={articlePermissions.canPublish}
        userCanEditOthers={articlePermissions.canEdit}
        isAdmin={isAdmin}
        articleOwner={article.author}
        permissions={articlePermissions}
      />

      {/* Keyboard hint */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
        <WkIcon name="Command" size={11} />
        <span>
          +S to save · Auto-saves every 10s · Last auto-saved:{" "}
          {lastAutosavedAt ? new Date(lastAutosavedAt).toLocaleTimeString() : "—"}
        </span>
      </div>

      {/* Editor layout: content left, meta right */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Content area */}
        <div>
          <ArticleContentEditor
            title={draft.title}
            excerpt={draft.excerpt}
            content={draft.content}
            onTitleChange={(v) => articlePermissions.canEdit && patchDraft({ title: v })}
            onExcerptChange={(v) => articlePermissions.canEdit && patchDraft({ excerpt: v })}
            onContentChange={(v) => articlePermissions.canEdit && patchDraft({ content: v })}
            readOnly={!articlePermissions.canEdit}
          />
        </div>

        {/* Meta sidebar */}
        <div>
          <ArticleMetaPanel
            author={draft.author}
            categories={draft.categories}
            tags={draft.tags}
            publishedAt={draft.publishedAt}
            seo={seoWithContent}
            slug={article.slug}
            wpStatus={article.wpStatus}
            createdAt={article.createdAt}
            updatedAt={article.updatedAt}
            articleId={article.id}
            title={draft.title}
            excerpt={draft.excerpt}
            isDirty={isDirty}
            isSaving={isSaving}
            isPublishing={isPublishing}
            publishingLocked={isInstituteMode}
            lastAutosavedAt={lastAutosavedAt}
            heroImageUrl={article.heroImageUrl}
            isSavingHero={isSavingHero}
            onHeroImageSave={handleSaveHeroImage}
            onAuthorChange={(v) => patchDraft({ author: v })}
            onCategoriesChange={(v) => patchDraft({ categories: v })}
            onTagsChange={(v) => patchDraft({ tags: v })}
            onPublishedAtChange={(v) => !isInstituteMode && patchDraft({ publishedAt: v })}
            onSeoChange={(v) => patchDraft({ seo: v })}
            onRestoreDraft={handleRestoreDraft}
            onSlugChange={handleSlugChange}
            onInsertLink={handleInsertLink}
            onEmbedRelease={handleEmbedRelease}
            onSaveDraft={handleSaveDraft}
            onPublish={isInstituteMode ? undefined : handlePublish}
            onUnpublish={isInstituteMode ? undefined : handleUnpublish}
            onDelete={isInstituteMode ? undefined : () => setShowDeleteConfirm(true)}
            onStatusChange={isInstituteMode ? undefined : handleStatusChange}
            previewUrl={previewUrl}
            isGeneratingPreview={isGeneratingPreview}
            onGeneratePreviewLink={handleGeneratePreviewLink}
            onMagazinePreview={handleMagazinePreview}
            previewNonce={previewNonce}
            onCategorySlugMap={setCategorySlugMap}
            onTagSlugMap={setTagSlugMap}
          />
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <ArticlePreviewModal
          title={draft.title}
          excerpt={draft.excerpt}
          content={draft.content}
          author={draft.author}
          heroImageUrl={article.heroImageUrl}
          publishedAt={draft.publishedAt}
          tags={draft.tags}
          categories={draft.categories}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Publish Checklist Modal */}
      {showPublishChecklist && (
        <ArticlePublishChecklist
          title={draft.title}
          content={draft.content}
          excerpt={draft.excerpt}
          heroImageUrl={article.heroImageUrl}
          seoTitle={(draft.seo?.title as string) || ""}
          seoDescription={(draft.seo?.description as string) || ""}
          publishedAt={draft.publishedAt}
          categories={draft.categories}
          onClose={() => setShowPublishChecklist(false)}
          onPublishAnyway={handlePublishConfirm}
          isPublishing={isPublishing}
        />
      )}

      {/* ══════════════════════════════════
          CONFLICT DETECTION MODAL
          ══════════════════════════════════ */}
      {showConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-wk-warning/30 bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-warning-soft text-wk-warning">
              <WkIcon name="AlertTriangle" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">Editing Conflict Detected</h3>
            <p className="text-[13px] text-wk-text-muted mb-4">
              {conflictError}
            </p>
            <p className="text-[12px] text-wk-text-soft bg-wk-bg-subtle rounded-lg px-3 py-2 mb-5 border border-wk-border/50">
              <strong>What happened:</strong> The article was modified on the server after you opened this page.
              If you save now, you might overwrite someone else's changes.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConflictDiscard}
                className="wk-button wk-button-secondary wk-button-sm w-full whitespace-nowrap"
              >
                <WkIcon name="RotateCcw" size={14} />
                Discard My Changes & Reload Latest
              </button>
              <button
                onClick={handleConflictOverwrite}
                className="wk-button wk-button-sm w-full whitespace-nowrap bg-wk-warning text-wk-brand-on hover:opacity-90 border border-wk-warning"
              >
                <WkIcon name="Save" size={14} />
                Overwrite Anyway (Force Save)
              </button>
              <button
                onClick={() => setShowConflict(false)}
                className="text-[12px] text-wk-text-faint hover:text-wk-text transition-colors py-1 cursor-pointer"
              >
                Cancel — Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Modal */}
      {showRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-info-soft)] text-[var(--wk-info)]">
              <WkIcon name="Save" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">
              Unsaved Auto-saved Changes Found
            </h3>
            <p className="text-[13px] text-[var(--wk-text-muted)] mb-1">
              An auto-saved version (v{showRecovery.revisionNumber}) from{" "}
              {new Date(showRecovery.createdAt).toLocaleString()} is newer than the last manual save.
            </p>
            <p className="text-[13px] text-[var(--wk-text-muted)] mb-5">
              Would you like to restore it, or keep the current version?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRecovery(null);
                }}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Keep Current
              </button>
              <button
                onClick={() => {
                  handleRestoreDraft({
                    title: showRecovery.title,
                    excerpt: showRecovery.excerpt,
                    content: showRecovery.content,
                    author: showRecovery.author,
                    categories: showRecovery.categories,
                    tags: showRecovery.tags,
                    seo: showRecovery.seo,
                    publishedAt: showRecovery.publishedAt,
                    wpStatus: showRecovery.wpStatus,
                  });
                  setShowRecovery(null);
                }}
                className="wk-button wk-button-primary wk-button-sm flex-1 whitespace-nowrap"
              >
                <WkIcon name="RotateCcw" size={14} />
                Restore Auto-saved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
              <WkIcon name="Trash2" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Move to Trash?</h3>
            <p className="text-[13px] text-[var(--wk-text-muted)] mb-5">
              This will set the article status to "trash". You can restore it later from the
              database if needed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDelete();
                }}
                className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-[var(--wk-danger)] text-white hover:opacity-90 border border-[var(--wk-danger)]"
              >
                Yes, Trash It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
              toast.type === "success"
                ? "border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                : toast.type === "error"
                  ? "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                  : "border-[var(--wk-info)]/20 bg-[var(--wk-info-soft)] text-[var(--wk-info)]"
            }`}
          >
            <WkIcon
              name={
                toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"
              }
              size={16}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}