import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ArticleEditorHeader } from "./components/ArticleEditorHeader";
import {
  ArticleWorkbenchNav,
  type ArticleWorkbenchMode,
} from "./components/ArticleWorkbenchNav";
import { ArticleContentEditor } from "./components/ArticleContentEditor";
import { ArticleMetaPanel } from "./components/ArticleMetaPanel";
import { ArticleWriteContextDrawer } from "./components/ArticleWriteContextDrawer";
import { ArticleDocumentModeSwitcher } from "./components/ArticleDocumentModeSwitcher";
import { ArticlePublishChecklist } from "./components/ArticlePublishChecklist";
import { ArticleTrustPanel } from "./components/ArticleTrustPanel";
import { useArticleTrustWorkspace } from "./hooks/useArticleTrustWorkspace";
import { useAdminUser } from "@/hooks/useAdminUser";
import { useArticleDocumentModeState } from "./hooks/useArticleDocumentModeState";
import type {
  RichTextSelectionSnapshot,
} from "@/components/design-system/editorial/RichTextEditor";
import {
  fetchArticleForAdmin,
  saveArticle,
  submitArticleForReview,
  requestArticleChanges,
  approveArticleVersion,
  publishArticleVersion,
  scheduleArticlePublication,
  unpublishArticle,
  createRevision,
  getLatestRevision,
  pruneRevisions,
  saveHeroToMediaLibrary,
  checkSlugCollision,
  insertSlugRedirect,
  trashArticle,
  generatePreviewNonce,
  fetchArticleLifecycleEvents,
  fetchArticleVersionFingerprintStatus,
  type AdminArticleDetail,
  type ArticleSavePayload,
  type ArticleLifecycleEvent,
} from "@/services/articles/articleAdminService";
import { processArticleContent } from "@/services/articles/contentPipeline";
import { syncInstituteArticlePublicationState } from "@/services/institute/institutePublicationSyncService";
import {
  acceptArticleSuggestion,
  createArticleSuggestion,
  rejectArticleSuggestion,
  withdrawArticleSuggestion,
} from "@/services/articles/articleReviewService";

const CANONICAL_PUBLIC_ORIGIN = String(
  import.meta.env.VITE_PUBLIC_SITE_ORIGIN ||
    "https://wakilisha.africa",
).replace(/\/+$/, "");

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
  const userCanEditOwn = adminUser.can("edit_own_articles");
  const userCanEditOthers = adminUser.can("edit_others_articles");
  const userCanManageReviewQueue = adminUser.can("manage_review_queue");
  const isAdmin = adminUser.role === "administrator" || adminUser.can("admin_god_mode");

  // ── State ──
  const [article, setArticle] = useState<AdminArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeWorkbenchMode, setActiveWorkbenchMode] =
    useState<ArticleWorkbenchMode>("write");
  const [writeContextOpen, setWriteContextOpen] =
    useState(false);
  const [focusMode, setFocusMode] =
    useState(false);

  const [
    reviewSelection,
    setReviewSelection,
  ] = useState<RichTextSelectionSnapshot | null>(
    null,
  );

  const [
    suggestionOperation,
    setSuggestionOperation,
  ] = useState<"replace" | "delete">(
    "replace",
  );

  const [
    suggestionReplacement,
    setSuggestionReplacement,
  ] = useState("");

  const [
    suggestionComment,
    setSuggestionComment,
  ] = useState("");

  const [
    isSuggestionSaving,
    setIsSuggestionSaving,
  ] = useState(false);

  const [
    suggestionComposerOpen,
    setSuggestionComposerOpen,
  ] = useState(false);

  const [
    savedSuggestionsOpen,
    setSavedSuggestionsOpen,
  ] = useState(false);

  const [
    suggestionDecision,
    setSuggestionDecision,
  ] = useState<{
    suggestionId: string;
    action: "accept" | "reject" | "withdraw";
  } | null>(null);

  const [
    suggestionDecisionNote,
    setSuggestionDecisionNote,
  ] = useState("");

  const [
    isSuggestionDecisionSaving,
    setIsSuggestionDecisionSaving,
  ] = useState(false);

  const [
    selectionPositionRevision,
    setSelectionPositionRevision,
  ] = useState(0);

  // ── Central permission object ──
  const articlePermissions = useMemo(() => {
    const isOwner =
      article?.ownerId !== null &&
      article?.ownerId === adminUser.id;

    const canView = true;
    const canEdit =
      isAdmin ||
      userCanEditOthers ||
      (userCanEditOwn && isOwner);
    const canDelete =
      !isInstituteMode &&
      (isAdmin || (isOwner && userCanEditOthers));
    const canPublish =
      !isInstituteMode &&
      (isAdmin || (isOwner && userCanPublish));
    const canAutosave = canEdit;
    const reason = !canEdit
      ? "You do not have permission to edit this Article."
      : null;

    return {
      canView,
      canEdit,
      canDelete,
      canPublish,
      canAutosave,
      reason,
    };
  }, [
    article?.ownerId,
    adminUser.id,
    isAdmin,
    isInstituteMode,
    userCanEditOwn,
    userCanEditOthers,
    userCanPublish,
  ]);

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
  const [lifecycleEvents, setLifecycleEvents] = useState<ArticleLifecycleEvent[]>([]);
  const [approvedVersionFingerprintStatus, setApprovedVersionFingerprintStatus] =
    useState<{
      latestVersionNumber: number | null;
      latestContentFingerprint: string | null;
      approvedVersionNumber: number | null;
      approvedContentFingerprint: string | null;
    } | null>(null);
  const [reviewActionModal, setReviewActionModal] = useState<null | "request_changes" | "approve">(null);
  const [reviewActionNote, setReviewActionNote] = useState("");
  const [isReviewActionBusy, setIsReviewActionBusy] = useState(false);

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

  async function refreshArticleLifecycleEvents(articleId: string) {
    const rows = await fetchArticleLifecycleEvents(articleId);
    setLifecycleEvents(rows);
  }

  useEffect(() => {
    if (!article?.id) {
      setLifecycleEvents([]);
      return;
    }

    void refreshArticleLifecycleEvents(article.id);
  }, [article?.id, article?.wpStatus, article?.draftVersion]);

  const latestReviewAction = useMemo(() => {
    return lifecycleEvents.find((event) =>
      ["submitted", "changes_requested", "approved", "scheduled", "published"].includes(event.action),
    )?.action ?? null;
  }, [lifecycleEvents]);

  const latestApprovedLifecycleEvent = useMemo(() => {
    return lifecycleEvents.find((event) => event.action === "approved") ?? null;
  }, [lifecycleEvents]);

  useEffect(() => {
    if (!article?.id || !latestApprovedLifecycleEvent?.versionNumber) {
      setApprovedVersionFingerprintStatus(null);
      return;
    }

    let alive = true;

    void (async () => {
      const status = await fetchArticleVersionFingerprintStatus(
        article.id,
        latestApprovedLifecycleEvent.versionNumber,
      );

      if (alive) {
        setApprovedVersionFingerprintStatus(status);
      }
    })();

    return () => {
      alive = false;
    };
  }, [article?.draftVersion, article?.id, latestApprovedLifecycleEvent?.versionNumber]);

  const hasChangesAfterLatestApproval = useMemo(() => {
    if (!latestApprovedLifecycleEvent) return false;
    if (isDirty) return true;

    const approvedVersionNumber = latestApprovedLifecycleEvent.versionNumber;
    const latestVersionNumber =
      approvedVersionFingerprintStatus?.latestVersionNumber ?? null;

    if (approvedVersionNumber && latestVersionNumber) {
      return latestVersionNumber !== approvedVersionNumber;
    }

    return true;
  }, [
    approvedVersionFingerprintStatus,
    isDirty,
    latestApprovedLifecycleEvent,
  ]);

  const articleWpStatus =
    article?.wpStatus ?? "draft";

  const isPendingReview =
    articleWpStatus === "pending";

  const isLiveOrScheduled =
    articleWpStatus === "publish" ||
    articleWpStatus === "future";

  const documentModeState =
    useArticleDocumentModeState({
      articleId: article?.id ?? null,
      wpStatus: article?.wpStatus ?? null,
      draftVersion:
        article?.draftVersion ?? null,
    });

  const articleTrustState =
    useArticleTrustWorkspace({
      articleId: article?.id ?? null,
      draftVersion:
        article?.draftVersion ?? null,
      enabled:
        activeWorkbenchMode === "trust",
    });

  const submittedDocument =
    documentModeState.targetVersion;

  const savedSuggestionThreads =
    useMemo(() => {
      const threads =
        documentModeState.reviewWorkspace
          ?.threads ?? [];

      return threads
        .filter(
          (thread) =>
            thread.threadKind ===
              "suggestion" &&
            thread.suggestion !== null,
        )
        .slice()
        .sort((left, right) => {
          const leftTime = Date.parse(
            left.suggestion?.createdAt ?? "",
          );

          const rightTime = Date.parse(
            right.suggestion?.createdAt ?? "",
          );

          return rightTime - leftTime;
        });
    }, [
      documentModeState.reviewWorkspace,
    ]);


  const usesSubmittedDocument = Boolean(
    documentModeState.mode !== "write" &&
    submittedDocument,
  );

  const documentTitle =
    usesSubmittedDocument
      ? submittedDocument?.title ?? ""
      : draft.title;

  const documentExcerpt =
    usesSubmittedDocument
      ? submittedDocument?.excerpt ?? ""
      : draft.excerpt;

  const documentContent =
    usesSubmittedDocument
      ? submittedDocument?.contentHtml ?? ""
      : draft.content;

  const documentReadOnly =
    documentModeState.mode !== "write" ||
    !articlePermissions.canEdit;

  const documentModeLabel =
    documentModeState.mode === "suggest"
      ? "Suggesting"
      : documentModeState.mode === "view"
        ? "Viewing"
        : null;

  useEffect(() => {
    setReviewSelection(null);
  }, [
    documentModeState.mode,
    submittedDocument?.id,
  ]);
  const canSubmitCurrentArticleForReview = Boolean(
    article &&
      allowSubmitForReview &&
      articlePermissions.canEdit &&
      !isPendingReview &&
      !isLiveOrScheduled &&
      (
        hasChangesAfterLatestApproval ||
        latestReviewAction !== "approved"
      ) &&
      (
        articleWpStatus === "draft" ||
        articleWpStatus === "" ||
        latestReviewAction === "changes_requested" ||
        hasChangesAfterLatestApproval
      ),
  );
  const canManageArticleReview = Boolean(article && (isAdmin || userCanManageReviewQueue));
  const canRequestArticleChanges = Boolean(
    article &&
      canManageArticleReview &&
      isPendingReview &&
      (latestReviewAction === "submitted" || latestReviewAction === null),
  );
  const canApproveCurrentArticleVersion = Boolean(
    article &&
      canManageArticleReview &&
      isPendingReview &&
      (latestReviewAction === "submitted" || latestReviewAction === null),
  );
  const canPublishApprovedArticleVersion = Boolean(
    article &&
      articlePermissions.canPublish &&
      latestReviewAction === "approved" &&
      !hasChangesAfterLatestApproval,
  );
  const submittedReviewLabel =
    submittedDocument?.versionNumber
      ? `submitted version ${submittedDocument.versionNumber}`
      : "the submitted version";

  const publishDisabledReason =
    article &&
    articlePermissions.canPublish &&
    isPendingReview
      ? `Review ${submittedReviewLabel} before approving it or requesting changes.`
      : article &&
          articlePermissions.canPublish &&
          hasChangesAfterLatestApproval
        ? "Submit this draft for review before publishing."
        : article &&
            articlePermissions.canPublish &&
            !canPublishApprovedArticleVersion
          ? "Approve the submitted version before publishing."
          : null;

  const editorialStatusLabel =
    articleWpStatus === "publish"
      ? "Published"
      : articleWpStatus === "future"
        ? "Scheduled"
        : articleWpStatus === "trash"
          ? "Archived"
          : hasChangesAfterLatestApproval
            ? "Changes Need Review"
            : latestReviewAction === "approved"
              ? "Approved for Publication"
              : latestReviewAction === "changes_requested"
              ? "Changes Requested"
              : latestReviewAction === "submitted" || articleWpStatus === "pending"
                ? "Pending Review"
                : "Draft";

  const editorialStatusColorKey =
    articleWpStatus === "publish"
      ? "publish"
      : articleWpStatus === "future"
        ? "future"
        : articleWpStatus === "trash"
          ? "trash"
          : hasChangesAfterLatestApproval
            ? "changes_requested"
            : latestReviewAction === "approved"
              ? "approved"
              : latestReviewAction === "changes_requested"
              ? "changes_requested"
              : latestReviewAction === "submitted" || articleWpStatus === "pending"
                ? "pending"
                : "draft";

  // Refs for optimistic locking
  const articleUpdatedAtRef = useRef<string | null>(null);
  const articleDraftVersionRef = useRef<number | null>(null);
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

        articleUpdatedAtRef.current =
          data.updatedAt ?? null;

        articleDraftVersionRef.current =
          data.draftVersion;

        const nextDraft: Draft = {
          title: data.title,
          excerpt: data.excerpt,
          content: data.contentHtml,
          author: data.author,
          categories: data.categories,
          tags: data.tags,
          publishedAt: data.publishedAt,
          seo: data.seo,
        };

        stateRef.current = {
          ...stateRef.current,
          article: data,
          draft: nextDraft,
          isDirty: false,
        };

        lastAutosavedContentRef.current =
          nextDraft.content +
          nextDraft.title +
          nextDraft.excerpt;

        setArticle(data);
        setPreviewNonce(data.previewNonce ?? null);

        // Auto-generate preview nonce for non-published articles so Preview works immediately
        if (data.wpStatus !== "publish" && !data.previewNonce) {
          generatePreviewNonce(data.id).then((nonce) => {
            if (nonce && alive) setPreviewNonce(nonce);
          }).catch(() => {});
        }

        setDraft(nextDraft);
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
  const patchDraft = useCallback(
    (patch: Partial<Draft>) => {
      const currentDraft =
        stateRef.current.draft;

      const changed = (
        Object.keys(patch) as Array<keyof Draft>
      ).some((key) => {
        const currentValue =
          currentDraft[key];

        const nextValue =
          patch[key];

        if (
          currentValue !== null &&
          typeof currentValue === "object"
        ) {
          return (
            JSON.stringify(currentValue) !==
            JSON.stringify(nextValue)
          );
        }

        if (
          nextValue !== null &&
          typeof nextValue === "object"
        ) {
          return (
            JSON.stringify(currentValue) !==
            JSON.stringify(nextValue)
          );
        }

        return currentValue !== nextValue;
      });

      if (!changed) {
        return;
      }

      const nextDraft = {
        ...currentDraft,
        ...patch,
      };

      stateRef.current = {
        ...stateRef.current,
        draft: nextDraft,
        isDirty: true,
      };

      setDraft(nextDraft);
      setIsDirty(true);
    },
    [],
  );

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

  function applyServerArticleState(
    freshArticle: AdminArticleDetail,
    resetDraft = true,
  ) {
    articleUpdatedAtRef.current =
      freshArticle.updatedAt ?? null;

    articleDraftVersionRef.current =
      freshArticle.draftVersion;

    if (resetDraft) {
      const nextDraft: Draft = {
        title: freshArticle.title,
        excerpt: freshArticle.excerpt,
        content: freshArticle.contentHtml,
        author: freshArticle.author,
        categories: freshArticle.categories,
        tags: freshArticle.tags,
        publishedAt: freshArticle.publishedAt,
        seo: freshArticle.seo,
      };

      /*
       * Interval callbacks read stateRef directly.
       * Synchronize it before scheduling React state
       * so stale content cannot be autosaved between
       * the server response and the next render.
       */
      stateRef.current = {
        ...stateRef.current,
        article: freshArticle,
        draft: nextDraft,
        isDirty: false,
      };

      lastAutosavedContentRef.current =
        nextDraft.content +
        nextDraft.title +
        nextDraft.excerpt;

      setArticle(freshArticle);
      setPreviewNonce(
        freshArticle.previewNonce ?? null,
      );
      setDraft(nextDraft);
      setIsDirty(false);

      return;
    }

    stateRef.current = {
      ...stateRef.current,
      article: freshArticle,
    };

    setArticle(freshArticle);
    setPreviewNonce(
      freshArticle.previewNonce ?? null,
    );
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
    let expectedDraftVersion = articleDraftVersionRef.current;

    if (forceOverwrite && expectedDraftVersion == null) {
      expectedDraftVersion = currentArticle.draftVersion;
    }

    let result = await saveArticle(currentArticle.id, payload, expectedDraftVersion);

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
          expectedDraftVersion = freshArticle.draftVersion;
          result = await saveArticle(currentArticle.id, payload, expectedDraftVersion);

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

    const refreshedArticle = await fetchArticleForAdmin(result.articleSlug ?? currentArticle.slug);

    if (refreshedArticle) {
      applyServerArticleState(refreshedArticle, true);
      setPreviewNonce(null);

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
    setPreviewNonce(null);
    setIsDirty(false);
    return true;
  }

  /** Force overwrite after conflict, then reloads the article first and saves. */
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

  /** Discard changes and reload the latest article from the server. */
  async function handleConflictDiscard() {
    if (!slug) return;
    setShowConflict(false);

    const freshData = await fetchArticleForAdmin(slug);
    if (freshData) {
      articleUpdatedAtRef.current = freshData.updatedAt ?? null;
      articleDraftVersionRef.current = freshData.draftVersion;
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
    const ok = await saveToSupabase({});
    setIsSaving(false);
    if (ok) {
      addToast(
        "success",
        isLiveOrScheduled
          ? "Working draft saved. Published version remains live."
          : "Draft saved.",
      );
    }
  }

  async function handlePublish() {
    if (publishDisabledReason || !canPublishApprovedArticleVersion) {
      addToast("error", publishDisabledReason || "Approve the submitted version before publishing.");
      return;
    }


    setShowPublishChecklist(true);
  }

  async function handlePublishConfirm() {
    setShowPublishChecklist(false);
    if (!article || !articlePermissions.canPublish) {
      addToast("error", "You do not have permission to publish articles.");
      return;
    }
    if (publishDisabledReason || !canPublishApprovedArticleVersion) {
      addToast("error", publishDisabledReason || "Approve the submitted version before publishing.");
      return;
    }

    setIsPublishing(true);
    try {
      const saved = isDirty ? await saveToSupabase({}) : true;
      if (!saved) return;

      const isScheduled = draft.publishedAt && new Date(draft.publishedAt) > new Date();
      const publishDate = draft.publishedAt || new Date().toISOString();

      const result = isScheduled
        ? await scheduleArticlePublication(article.id, null, publishDate)
        : await publishArticleVersion(article.id, null, publishDate);

      if (!result.ok) {
        addToast("error", result.error ?? "Publication failed.");
        return;
      }

      const refreshedArticle = await fetchArticleForAdmin(result.articleSlug ?? article.slug);
      if (refreshedArticle) {
        applyServerArticleState(refreshedArticle, true);
        await refreshArticleLifecycleEvents(refreshedArticle.id);
        await syncInstituteArticlePublicationState({
          articleId: refreshedArticle.id,
          articleSlug: refreshedArticle.slug,
          wpStatus: refreshedArticle.wpStatus,
          publishedAt: refreshedArticle.publishedAt,
        });
      }

      setDraft((prev) => ({ ...prev, publishedAt: publishDate }));
      if (isScheduled) {
        addToast("info", `Article scheduled for ${new Date(publishDate).toLocaleString()}.`);
      } else {
        addToast("success", "Article published!");
      }
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!article || !articlePermissions.canPublish) {
      addToast("error", "You do not have permission to unpublish.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await unpublishArticle(article.id);
      if (!result.ok) {
        addToast("error", result.error ?? "Failed to unpublish article.");
        return;
      }

      const refreshedArticle = await fetchArticleForAdmin(result.articleSlug ?? article.slug);
      if (refreshedArticle) {
        applyServerArticleState(refreshedArticle, true);
        await refreshArticleLifecycleEvents(refreshedArticle.id);
        await syncInstituteArticlePublicationState({
          articleId: refreshedArticle.id,
          articleSlug: refreshedArticle.slug,
          wpStatus: refreshedArticle.wpStatus,
          publishedAt: refreshedArticle.publishedAt,
        });
      }

      addToast("info", "Article unpublished and returned to draft.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === "pending") {
      await handleSubmitForReview();
      return;
    }

    if (newStatus === "publish") {
      await handlePublish();
      return;
    }

    if (newStatus === "draft") {
      if (isLiveOrScheduled) {
        await handleUnpublish();
      } else {
        await handleSaveDraft();
      }
      return;
    }

    addToast("error", `Unsupported lifecycle status: ${newStatus}`);
  }

  async function handleSubmitForReview() {
    if (!article || !articlePermissions.canEdit) {
      addToast("error", articlePermissions.reason ?? "Permission denied.");
      return;
    }

    setIsSaving(true);
    try {
      const saved = isDirty ? await saveToSupabase({}) : true;
      if (!saved) return;

      const expectedDraftVersion = articleDraftVersionRef.current ?? article.draftVersion;
      const result = await submitArticleForReview(article.id, expectedDraftVersion);

      if (!result.ok) {
        addToast("error", result.error ?? "Failed to submit for review.");
        return;
      }

      const refreshedArticle = await fetchArticleForAdmin(result.articleSlug ?? article.slug);
      if (refreshedArticle) {
        applyServerArticleState(refreshedArticle, true);
        await refreshArticleLifecycleEvents(refreshedArticle.id);
      }

      if (onSubmittedForReview) {
        try {
          await onSubmittedForReview({
            articleId: article.id,
            articleSlug: result.articleSlug ?? article.slug,
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
    } finally {
      setIsSaving(false);
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
      const result = await saveArticle(
        article.id,
        { hero_image_url: url || null },
        articleDraftVersionRef.current ?? article.draftVersion,
      );

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

      setPreviewNonce(null);
      await saveHeroToMediaLibrary(article.slug, draft.title, url);

      addToast("success", url ? "Hero image saved." : "Hero image removed.");
    } finally {
      setIsSavingHero(false);
    }
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

    const result = await saveArticle(
      article.id,
      { slug: newSlug },
      articleDraftVersionRef.current ?? article.draftVersion,
    );

    if (!result.ok) {
      addToast("error", result.error ?? "Failed to update slug.");
      return false;
    }

    setPreviewNonce(null);
    await insertSlugRedirect(slug, newSlug, adminUser.name || "system");

    addToast("success", "Slug updated. Reloading…");
    setTimeout(() => navigate(`/admin/content/articles/${newSlug}`), 800);
    return true;
  }

  async function handleReviewDecisionConfirm() {
    if (!article || !reviewActionModal) return;

    const note = reviewActionNote.trim();
    if (reviewActionModal === "request_changes" && !note) {
      addToast("error", "Explain the requested changes before sending this back.");
      return;
    }

    setIsReviewActionBusy(true);
    try {
      const result =
        reviewActionModal === "request_changes"
          ? await requestArticleChanges(article.id, null, note)
          : await approveArticleVersion(article.id, null, note || null);

      if (!result.ok) {
        addToast("error", result.error ?? "Review action failed.");
        return;
      }

      const refreshedArticle = await fetchArticleForAdmin(result.articleSlug ?? article.slug);
      if (refreshedArticle) {
        applyServerArticleState(refreshedArticle, true);
        await refreshArticleLifecycleEvents(refreshedArticle.id);
      } else {
        await refreshArticleLifecycleEvents(article.id);
      }

      addToast(
        "success",
        reviewActionModal === "request_changes" ? "Changes requested." : "Article version approved.",
      );
      setReviewActionModal(null);
      setReviewActionNote("");
    } finally {
      setIsReviewActionBusy(false);
    }
  }

  function openRequestChanges() {
    setReviewActionNote("");
    setReviewActionModal("request_changes");
  }

  function openApproveVersion() {
    setReviewActionNote("");
    setReviewActionModal("approve");
  }

  /** Generate a shareable preview link for this article. */
  async function handleGeneratePreviewLink() {
    if (!article) return;
    setIsGeneratingPreview(true);
    try {
      if (isDirty) {
        const saved = await saveToSupabase({});
        if (!saved) return;
      }

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

  /** Open the exact public rendering for the current governed or draft version. */
  async function handleMagazinePreview() {
    if (!article) return;

    const hadDirtyDraft = isDirty;

    if (hadDirtyDraft) {
      const saved = await saveToSupabase({});
      if (!saved) return;
    }

    const needsVersionPreview =
      article.wpStatus !== "publish" ||
      hadDirtyDraft ||
      hasChangesAfterLatestApproval;

    let nonce = hadDirtyDraft ? null : previewNonce;

    if (needsVersionPreview && !nonce) {
      setIsGeneratingPreview(true);
      nonce = await generatePreviewNonce(article.id);
      if (nonce) {
        setPreviewNonce(nonce);
      }
      setIsGeneratingPreview(false);
    }

    if (needsVersionPreview && !nonce) {
      addToast("error", "Could not prepare the exact Article preview.");
      return;
    }

    const previewPath =
      needsVersionPreview && nonce
        ? `/magazine/${encodeURIComponent(article.slug)}?preview=${encodeURIComponent(nonce)}`
        : `/magazine/${encodeURIComponent(article.slug)}`;

    window.open(
      `${CANONICAL_PUBLIC_ORIGIN}${previewPath}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const previewUrl =
    previewNonce && article?.slug
      ? `${CANONICAL_PUBLIC_ORIGIN}/magazine/${encodeURIComponent(article.slug)}?preview=${encodeURIComponent(previewNonce)}`
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


  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(
        "wk-admin-focus-mode-change",
        {
          detail: {
            active: focusMode,
          },
        },
      ),
    );
  }, [focusMode]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent(
          "wk-admin-focus-mode-change",
          {
            detail: {
              active: false,
            },
          },
        ),
      );
    };
  }, []);

  function handleCloseArticle() {
    if (
      isDirty &&
      !window.confirm(
        "Leave this Article with unsaved changes?",
      )
    ) {
      return;
    }

    navigate("/admin/content/articles");
  }

  useEffect(() => {
    if (
      documentModeState.mode === "suggest"
    ) {
      return;
    }

    resetSuggestionComposer();
  }, [documentModeState.mode]);

  useEffect(() => {
    setSuggestionComposerOpen(false);
    setSuggestionOperation("replace");
    setSuggestionReplacement("");
    setSuggestionComment("");
  }, [
    reviewSelection?.from,
    reviewSelection?.to,
  ]);

  const handleReviewSelectionChange =
    useCallback(
      (
        selection:
          RichTextSelectionSnapshot | null,
      ) => {
        if (
          suggestionComposerOpen &&
          !selection
        ) {
          return;
        }

        setReviewSelection((current) => {
          if (!selection) {
            return current
              ? null
              : current;
          }

          if (
            current &&
            current.from === selection.from &&
            current.to === selection.to &&
            current.quote ===
              selection.quote &&
            current.prefix ===
              selection.prefix &&
            current.suffix ===
              selection.suffix
          ) {
            return current;
          }

          return selection;
        });
      },
      [suggestionComposerOpen],
    );

  useEffect(() => {
    if (
      !reviewSelection ||
      suggestionComposerOpen
    ) {
      return;
    }

    let animationFrame = 0;

    const refreshSelectionPosition = () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      animationFrame =
        window.requestAnimationFrame(() => {
          setSelectionPositionRevision(
            (revision) => revision + 1,
          );
        });
    };

    window.addEventListener(
      "scroll",
      refreshSelectionPosition,
      true,
    );

    window.addEventListener(
      "resize",
      refreshSelectionPosition,
    );

    refreshSelectionPosition();

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "scroll",
        refreshSelectionPosition,
        true,
      );

      window.removeEventListener(
        "resize",
        refreshSelectionPosition,
      );
    };
  }, [
    reviewSelection,
    suggestionComposerOpen,
  ]);

  useEffect(() => {
    if (
      (
        !suggestionComposerOpen &&
        !savedSuggestionsOpen
      ) ||
      typeof document === "undefined"
    ) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    savedSuggestionsOpen,
    suggestionComposerOpen,
  ]);

  useEffect(() => {
    if (savedSuggestionsOpen) return;

    setSuggestionDecision(null);
    setSuggestionDecisionNote("");
  }, [savedSuggestionsOpen]);

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

  const suggestionTriggerPosition =
    reviewSelection?.getViewportRect &&
    typeof window !== "undefined" &&
    typeof document !== "undefined"
      ? (() => {
          void selectionPositionRevision;

          const rect =
            reviewSelection.getViewportRect();

          if (!rect) {
            return null;
          }

          const viewportGutter = 12;
          const buttonWidth = 174;
          const buttonHeight = 40;
          const selectionGap = 10;
          const desktopRailBreakpoint = 1100;

          const pointX = Math.min(
            window.innerWidth - 1,
            Math.max(
              0,
              rect.left,
            ),
          );

          const pointY = Math.min(
            window.innerHeight - 1,
            Math.max(
              0,
              rect.top +
                Math.max(
                  rect.height / 2,
                  1,
                ),
            ),
          );

          const pointElement =
            document.elementFromPoint(
              pointX,
              pointY,
            );

          const selectionIsVisible = Boolean(
            pointElement?.closest(
              "[data-article-editor-canvas] .ProseMirror",
            ),
          );

          if (
            !selectionIsVisible ||
            rect.bottom < 0 ||
            rect.top > window.innerHeight
          ) {
            return null;
          }

          const selectionMidY =
            rect.top +
            rect.height / 2;

          let top = Math.min(
            window.innerHeight -
              buttonHeight -
              viewportGutter,
            Math.max(
              viewportGutter,
              selectionMidY -
                buttonHeight / 2,
            ),
          );

          let left =
            window.innerWidth -
            buttonWidth -
            viewportGutter;

          const canUseDesktopRail =
            window.innerWidth >=
              desktopRailBreakpoint &&
            rect.right +
              selectionGap <
              left;

          if (!canUseDesktopRail) {
            left = Math.max(
              viewportGutter,
              window.innerWidth -
                112 -
                viewportGutter,
            );

            top = Math.max(
              viewportGutter,
              window.innerHeight -
                buttonHeight -
                viewportGutter,
            );
          }

          return {
            top,
            left,
            compact: !canUseDesktopRail,
          };
        })()
      : null;


  function resetSuggestionComposer() {
    setSuggestionComposerOpen(false);
    setReviewSelection(null);
    setSuggestionOperation("replace");
    setSuggestionReplacement("");
    setSuggestionComment("");
  }

  function readTargetVersionString(
    keys: string[],
  ): string {
    const targetVersion =
      documentModeState.targetVersion;

    if (
      !targetVersion ||
      typeof targetVersion !== "object"
    ) {
      return "";
    }

    const record =
      targetVersion as unknown as
        Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];

      if (
        typeof value === "string" &&
        value.trim()
      ) {
        return value;
      }
    }

    return "";
  }

  async function handleCreateArticleSuggestion() {
    if (!article || !reviewSelection) {
      addToast(
        "error",
        "Select submitted text before creating a suggestion.",
      );
      return;
    }

    const targetVersionId =
      readTargetVersionString([
        "id",
        "versionId",
        "version_id",
      ]);

    const targetVersionFingerprint =
      readTargetVersionString([
        "contentFingerprint",
        "versionFingerprint",
        "fingerprint",
        "content_fingerprint",
      ]);

    if (
      !targetVersionId ||
      !targetVersionFingerprint
    ) {
      addToast(
        "error",
        "The submitted version identity is unavailable.",
      );
      return;
    }

    if (
      suggestionOperation === "replace" &&
      !suggestionReplacement.trim()
    ) {
      addToast(
        "error",
        "Add replacement text or choose Delete Text.",
      );
      return;
    }

    const replacementText =
      suggestionOperation === "delete"
        ? ""
        : suggestionReplacement;

    let proposedContentHtml = "";

    try {
      proposedContentHtml =
        reviewSelection
          .buildProposedContentHtml(
            suggestionOperation,
            replacementText,
          );
    } catch {
      addToast(
        "error",
        "The proposed Article could not be prepared.",
      );
      return;
    }

    setIsSuggestionSaving(true);

    try {
      const result =
        await createArticleSuggestion({
          articleId: article.id,
          targetVersionId,
          targetVersionFingerprint,
          anchorFrom: reviewSelection.from,
          anchorTo: reviewSelection.to,
          anchorQuote: reviewSelection.quote,
          anchorPrefix: reviewSelection.prefix,
          anchorSuffix: reviewSelection.suffix,
          operationKind: suggestionOperation,
          originalText: reviewSelection.quote,
          replacementText,
          proposedContentHtml,
          comment:
            suggestionComment.trim() || null,
        });

      if (!result.ok) {
        addToast(
          "error",
          result.error ??
            "Suggestion creation failed.",
        );
        return;
      }

      documentModeState.refresh();

      addToast(
        "success",
        "Suggestion created and added to Suggestions.",
      );

      resetSuggestionComposer();
    } finally {
      setIsSuggestionSaving(false);
    }
  }

  function openSuggestionDecision(
    action: "accept" | "reject" | "withdraw",
    suggestionId: string,
  ) {
    setSuggestionDecision({
      action,
      suggestionId,
    });

    setSuggestionDecisionNote("");
  }

  function cancelSuggestionDecision() {
    if (isSuggestionDecisionSaving) return;

    setSuggestionDecision(null);
    setSuggestionDecisionNote("");
  }

  async function handleSuggestionDecision() {
    if (
      !article ||
      !suggestionDecision ||
      isSuggestionDecisionSaving
    ) {
      return;
    }

    const note =
      suggestionDecisionNote.trim() || null;

    if (
      suggestionDecision.action === "reject" &&
      !note
    ) {
      addToast(
        "error",
        "Add a reason before rejecting this suggestion.",
      );
      return;
    }

    setIsSuggestionDecisionSaving(true);

    try {
      if (
        suggestionDecision.action === "accept"
      ) {
        if (!canManageArticleReview) {
          addToast(
            "error",
            "You do not have permission to accept suggestions.",
          );
          return;
        }

        const expectedDraftVersion =
          articleDraftVersionRef.current ??
          article.draftVersion;

        const result =
          await acceptArticleSuggestion(
            suggestionDecision.suggestionId,
            expectedDraftVersion,
            note,
          );

        if (!result.ok) {
          addToast(
            "error",
            result.error ||
              "Suggestion acceptance failed.",
          );
          return;
        }

        if (result.data.status === "stale") {
          documentModeState.refresh();

          setSuggestionDecision(null);
          setSuggestionDecisionNote("");

          addToast(
            "info",
            "The submitted version changed. This suggestion is now stale.",
          );
          return;
        }

        const refreshedArticle =
          await fetchArticleForAdmin(
            result.data.articleSlug ||
              article.slug,
          );

        if (!refreshedArticle) {
          documentModeState.refresh();

          addToast(
            "error",
            "The suggestion was accepted, but the refreshed Article could not be loaded. Refresh before continuing.",
          );

          return;
        }

        if (
          refreshedArticle.wpStatus !==
          "draft"
        ) {
          documentModeState.refresh();

          addToast(
            "error",
            "The suggestion was accepted, but the Article did not return in draft state. Refresh before continuing.",
          );

          return;
        }

        applyServerArticleState(
          refreshedArticle,
          true,
        );

        documentModeState.setMode("write");
        documentModeState.refresh();

        setSavedSuggestionsOpen(false);
        setSuggestionDecision(null);
        setSuggestionDecisionNote("");

        addToast(
          "success",
          "Suggestion accepted. The Article is back in draft with the proposed change applied.",
        );

        return;
      }

      if (
        suggestionDecision.action === "reject"
      ) {
        if (!canManageArticleReview) {
          addToast(
            "error",
            "You do not have permission to reject suggestions.",
          );
          return;
        }

        const result =
          await rejectArticleSuggestion(
            suggestionDecision.suggestionId,
            note,
          );

        if (!result.ok) {
          addToast(
            "error",
            result.error ||
              "Suggestion rejection failed.",
          );
          return;
        }

        documentModeState.refresh();

        setSuggestionDecision(null);
        setSuggestionDecisionNote("");

        addToast(
          "success",
          "Suggestion rejected.",
        );

        return;
      }

      const result =
        await withdrawArticleSuggestion(
          suggestionDecision.suggestionId,
          note,
        );

      if (!result.ok) {
        addToast(
          "error",
          result.error ||
            "Suggestion withdrawal failed.",
        );
        return;
      }

      documentModeState.refresh();

      setSuggestionDecision(null);
      setSuggestionDecisionNote("");

      addToast(
        "success",
        "Suggestion withdrawn.",
      );
    } finally {
      setIsSuggestionDecisionSaving(false);
    }
  }

  const articleMetaPanel = (
    <ArticleMetaPanel
      activeMode={activeWorkbenchMode}
      hasChangesAfterApproval={hasChangesAfterLatestApproval}
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
      onPublishedAtChange={(v) =>
        !isInstituteMode && patchDraft({ publishedAt: v })
      }
      onSeoChange={(v) => patchDraft({ seo: v })}
      onRestoreDraft={handleRestoreDraft}
      onSlugChange={handleSlugChange}
      onInsertLink={handleInsertLink}
      onEmbedRelease={handleEmbedRelease}
      onSaveDraft={handleSaveDraft}
      onPublish={isInstituteMode ? undefined : handlePublish}
      onUnpublish={isInstituteMode ? undefined : handleUnpublish}
      onDelete={
        isInstituteMode
          ? undefined
          : () => setShowDeleteConfirm(true)
      }
      onStatusChange={
        isInstituteMode ? undefined : handleStatusChange
      }
      onSubmitForReview={handleSubmitForReview}
      onRequestChanges={openRequestChanges}
      onApproveVersion={openApproveVersion}
      canSubmitForReview={canSubmitCurrentArticleForReview}
      canRequestChanges={canRequestArticleChanges}
      canApproveVersion={canApproveCurrentArticleVersion}
      reviewActionBusy={isReviewActionBusy}
      publishDisabledReason={publishDisabledReason}
      lifecycleEvents={lifecycleEvents}
      previewUrl={previewUrl}
      isGeneratingPreview={isGeneratingPreview}
      onGeneratePreviewLink={handleGeneratePreviewLink}
      onMagazinePreview={handleMagazinePreview}
      previewNonce={previewNonce}
      onCategorySlugMap={setCategorySlugMap}
      onTagSlugMap={setTagSlugMap}
    />
  );

  return (
    <div
      data-article-focus-mode={focusMode || undefined}
      className={focusMode ? "space-y-3" : "space-y-5"}
    >
      {!focusMode && isInstituteMode ? (
        <div className="rounded-2xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] font-bold leading-5 text-wk-text-muted">
          {instituteNotice ?? "Draft, save, preview, then submit."}
        </div>
      ) : null}

      {/* Header */}
      <ArticleEditorHeader
        slug={article.slug}
        title={documentTitle}
        status={article.wpStatus}
        statusLabel={editorialStatusLabel}
        statusColorKey={editorialStatusColorKey}
        isDirty={isDirty}
        isSaving={isSaving}
        lastAutosavedAt={lastAutosavedAt}
        isPublishing={isPublishing}
        isPreviewing={isGeneratingPreview}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onDelete={() => setShowDeleteConfirm(true)}
        onPreview={handleMagazinePreview}
        onOpenArticleDetails={() => setWriteContextOpen(true)}
        showArticleDetails={
          activeWorkbenchMode === "write" &&
          documentModeState.mode === "write"
        }
        articleDetailsOpen={writeContextOpen}
        draftActionsDisabled={
          documentModeState.mode !== "write"
        }
        documentModeLabel={documentModeLabel}
        focusMode={focusMode}
        onToggleFocusMode={() =>
          setFocusMode((current) => !current)
        }
        onSubmitForReview={handleSubmitForReview}
        allowSubmitForReview={allowSubmitForReview}
        canSubmitForReview={canSubmitCurrentArticleForReview}
        canRequestChanges={canRequestArticleChanges}
        canApproveVersion={canApproveCurrentArticleVersion}
        reviewActionBusy={isReviewActionBusy}
        publishDisabledReason={publishDisabledReason}
        onRequestChanges={openRequestChanges}
        onApproveVersion={openApproveVersion}
        submitForReviewLabel={latestReviewAction === "changes_requested" ? "Resubmit for Review" : submitForReviewLabel}
        userCanPublish={articlePermissions.canPublish}
        userCanEditOthers={articlePermissions.canEdit}
        isAdmin={isAdmin}
        articleOwner={article.author}
        permissions={articlePermissions}
      />

      {!focusMode ? (
      <ArticleWorkbenchNav
          activeMode={activeWorkbenchMode}
          onModeChange={(mode) => {
            setActiveWorkbenchMode(mode);

            if (mode !== "write") {
              setWriteContextOpen(false);
              setFocusMode(false);
            }
          }}
        />
      ) : null}

      {/* Workbench mode layout */}
      <div className="grid gap-5">
        {activeWorkbenchMode === "write" ? (
          <div className="min-w-0 space-y-3">
            {isPendingReview ? (
              <ArticleDocumentModeSwitcher
                mode={documentModeState.mode}
                onModeChange={(nextMode) => {
                  documentModeState.setMode(
                    nextMode,
                  );

                  setReviewSelection(null);

                  if (nextMode !== "write") {
                    setWriteContextOpen(false);
                  }
                }}
                canSuggest={
                  documentModeState.canSuggest
                }
                canViewSubmitted={
                  documentModeState.canViewSubmitted
                }
                loading={
                  documentModeState.reviewLoading
                }
                errorCode={
                  documentModeState.reviewErrorCode
                }
                targetVersionNumber={
                  submittedDocument?.versionNumber ??
                  null
                }
                suggestionCount={
                  savedSuggestionThreads.length
                }
                onOpenSuggestions={() =>
                  setSavedSuggestionsOpen(true)
                }
              />
            ) : null}


            {typeof document !==
              "undefined" &&
            savedSuggestionsOpen
              ? createPortal(
                  <div
                    data-article-saved-suggestions-drawer
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="article-saved-suggestions-title"
                    className="fixed inset-0 z-[125] h-[100dvh] max-h-[100dvh] overflow-hidden bg-black/30"
                    onMouseDown={(event) => {
                      if (
                        event.currentTarget ===
                        event.target
                      ) {
                        setSavedSuggestionsOpen(
                          false,
                        );
                      }
                    }}
                  >
                    <aside className="absolute inset-y-0 right-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl">
                      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-info">
                            Submitted Version{" "}
                            {submittedDocument
                              ?.versionNumber}
                          </div>

                          <h2
                            id="article-saved-suggestions-title"
                            className="mt-1 text-[18px] font-bold text-wk-text"
                          >
                            Suggestions
                          </h2>

                          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                            {savedSuggestionThreads
                              .length}{" "}
                            saved{" "}
                            {savedSuggestionThreads
                              .length === 1
                              ? "proposal"
                              : "proposals"}{" "}
                            against this submitted
                            version.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSavedSuggestionsOpen(
                              false,
                            )
                          }
                          className="wk-button wk-button-secondary wk-button-sm"
                        >
                          Close
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
                        {documentModeState
                          .reviewLoading ? (
                          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-5 text-[12px] text-wk-text-muted">
                            Refreshing suggestions.
                          </div>
                        ) : savedSuggestionThreads
                            .length === 0 ? (
                          <div className="rounded-xl border border-dashed border-wk-border px-4 py-8 text-center">
                            <div className="text-[13px] font-bold text-wk-text">
                              No Saved Suggestions
                            </div>

                            <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                              Select text in Suggest
                              mode to create the first
                              proposal.
                            </p>
                          </div>
                        ) : (
                          savedSuggestionThreads.map(
                            (thread) => {
                              const suggestion =
                                thread.suggestion;

                              if (!suggestion) {
                                return null;
                              }

                              return (
                                <article
                                  key={thread.id}
                                  className="rounded-xl border border-wk-border bg-wk-surface px-4 py-4 shadow-sm"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-full bg-wk-info-soft px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-wk-info">
                                        {
                                          suggestion.operationKind
                                        }
                                      </span>

                                      <span className="rounded-full bg-wk-bg-subtle px-2 py-1 text-[10px] font-black capitalize text-wk-text-muted">
                                        {
                                          suggestion.status
                                        }
                                      </span>
                                    </div>

                                    <span className="text-[10px] text-wk-text-faint">
                                      {new Date(
                                        suggestion.createdAt,
                                      ).toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="mt-4">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                                      Selected Text
                                    </div>

                                    <blockquote className="mt-2 rounded-lg border border-wk-info/20 bg-wk-info-soft px-3 py-3 text-[12px] font-semibold leading-5 text-wk-text">
                                      “
                                      {
                                        thread.anchorQuote
                                      }
                                      ”
                                    </blockquote>
                                  </div>

                                  <div className="mt-4">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                                      Proposed Change
                                    </div>

                                    {suggestion.operationKind ===
                                    "delete" ? (
                                      <p className="mt-2 rounded-lg border border-wk-warning/20 bg-wk-warning-soft px-3 py-3 text-[12px] leading-5 text-wk-text-muted">
                                        Remove the selected
                                        text.
                                      </p>
                                    ) : (
                                      <p className="mt-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[12px] font-semibold leading-5 text-wk-text">
                                        {
                                          suggestion.replacementText
                                        }
                                      </p>
                                    )}
                                  </div>

                                  {thread.comments.length >
                                  0 ? (
                                    <div className="mt-4">
                                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                                        Review Note
                                      </div>

                                      <div className="mt-2 space-y-2">
                                        {thread.comments.map(
                                          (comment) => (
                                            <div
                                              key={
                                                comment.id
                                              }
                                              className="rounded-lg border border-wk-border px-3 py-3"
                                            >
                                              <p className="text-[12px] leading-5 text-wk-text">
                                                {
                                                  comment.bodyText
                                                }
                                              </p>

                                              <p className="mt-2 text-[10px] text-wk-text-faint">
                                                {
                                                  comment.createdByLabel
                                                }
                                              </p>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  ) : null}

                                  {suggestion.status ===
                                  "open" ? (
                                    <div className="mt-5 border-t border-wk-border pt-4">
                                      <div className="flex flex-wrap gap-2">
                                        {canManageArticleReview ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openSuggestionDecision(
                                                  "accept",
                                                  suggestion.id,
                                                )
                                              }
                                              disabled={
                                                isSuggestionDecisionSaving
                                              }
                                              className="wk-button wk-button-primary wk-button-sm"
                                            >
                                              Accept
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                openSuggestionDecision(
                                                  "reject",
                                                  suggestion.id,
                                                )
                                              }
                                              disabled={
                                                isSuggestionDecisionSaving
                                              }
                                              className="wk-button wk-button-secondary wk-button-sm"
                                            >
                                              Reject
                                            </button>
                                          </>
                                        ) : null}

                                        {thread.createdBy ===
                                        adminUser.id ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openSuggestionDecision(
                                                "withdraw",
                                                suggestion.id,
                                              )
                                            }
                                            disabled={
                                              isSuggestionDecisionSaving
                                            }
                                            className="wk-button wk-button-secondary wk-button-sm"
                                          >
                                            Withdraw
                                          </button>
                                        ) : null}
                                      </div>

                                      {suggestionDecision
                                        ?.suggestionId ===
                                        suggestion.id ? (
                                        <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4">
                                          <h3 className="text-[13px] font-bold text-wk-text">
                                            {suggestionDecision
                                              .action ===
                                            "accept"
                                              ? "Accept Suggestion"
                                              : suggestionDecision
                                                    .action ===
                                                  "reject"
                                                ? "Reject Suggestion"
                                                : "Withdraw Suggestion"}
                                          </h3>

                                          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                                            {suggestionDecision
                                              .action ===
                                            "accept"
                                              ? "This applies the proposed change to a new working draft and closes the current submitted review."
                                              : suggestionDecision
                                                    .action ===
                                                  "reject"
                                                ? "This closes the proposal without changing the submitted Article."
                                                : "This removes your proposal from the active review."}
                                          </p>

                                          <label className="mt-4 block">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                                              Decision Note
                                              {suggestionDecision
                                                .action ===
                                              "reject"
                                                ? " Required"
                                                : " Optional"}
                                            </span>

                                            <textarea
                                              value={
                                                suggestionDecisionNote
                                              }
                                              onChange={(
                                                event,
                                              ) =>
                                                setSuggestionDecisionNote(
                                                  event
                                                    .target
                                                    .value,
                                                )
                                              }
                                              rows={3}
                                              disabled={
                                                isSuggestionDecisionSaving
                                              }
                                              placeholder={
                                                suggestionDecision
                                                  .action ===
                                                "accept"
                                                  ? "Record why this change is being accepted."
                                                  : suggestionDecision
                                                        .action ===
                                                      "reject"
                                                    ? "Explain why this proposal should not be applied."
                                                    : "Add context for withdrawing this proposal."
                                              }
                                              className="mt-2 w-full resize-y rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[12px] leading-5 text-wk-text outline-none transition-colors focus:border-wk-brand disabled:opacity-60"
                                            />
                                          </label>

                                          <div className="mt-4 flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void handleSuggestionDecision()
                                              }
                                              disabled={
                                                isSuggestionDecisionSaving
                                              }
                                              className={
                                                suggestionDecision
                                                  .action ===
                                                "accept"
                                                  ? "wk-button wk-button-primary wk-button-sm"
                                                  : "wk-button wk-button-secondary wk-button-sm"
                                              }
                                            >
                                              {isSuggestionDecisionSaving
                                                ? "Saving..."
                                                : suggestionDecision
                                                      .action ===
                                                    "accept"
                                                  ? "Accept Suggestion"
                                                  : suggestionDecision
                                                        .action ===
                                                      "reject"
                                                    ? "Reject Suggestion"
                                                    : "Withdraw Suggestion"}
                                            </button>

                                            <button
                                              type="button"
                                              onClick={
                                                cancelSuggestionDecision
                                              }
                                              disabled={
                                                isSuggestionDecisionSaving
                                              }
                                              className="wk-button wk-button-secondary wk-button-sm"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="mt-4 border-t border-wk-border pt-3 text-[10px] text-wk-text-faint">
                                    Suggested by{" "}
                                    {
                                      thread.createdByLabel
                                    }
                                  </div>
                                </article>
                              );
                            },
                          )
                        )}
                      </div>
                    </aside>
                  </div>,
                  document.body,
                )
              : null}

            {typeof document !==
              "undefined" &&
            documentModeState.mode ===
              "suggest" &&
            reviewSelection &&
            suggestionTriggerPosition &&
            !suggestionComposerOpen
              ? createPortal(
                  <button
                    type="button"
                    data-article-suggestion-floating-trigger
                    aria-label="Draft a suggestion for the selected text"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() =>
                      setSuggestionComposerOpen(
                        true,
                      )
                    }
                    style={{
                      position: "fixed",
                      top:
                        suggestionTriggerPosition
                          .top,
                      left:
                        suggestionTriggerPosition
                          .left,
                      zIndex: 118,
                    }}
                    data-placement={
                      suggestionTriggerPosition
                        .compact
                        ? "mobile-fixed"
                        : "desktop-rail"
                    }
                    className={
                      suggestionTriggerPosition
                        .compact
                        ? "wk-button wk-button-primary wk-button-sm min-w-[100px] shadow-xl"
                        : "wk-button wk-button-primary wk-button-sm shadow-xl"
                    }
                  >
                    <WkIcon
                      name="MessageSquarePlus"
                      size={14}
                    />
                    {suggestionTriggerPosition
                      .compact
                      ? "Suggest"
                      : "Draft Suggestion"}
                  </button>,
                  document.body,
                )
              : null}

            {documentModeState.mode ===
            "suggest" ? (
              <div
                data-article-suggestion-selection
                data-selection-from={
                  reviewSelection?.from
                }
                data-selection-to={
                  reviewSelection?.to
                }
                className="min-h-[92px] rounded-xl border border-wk-info/30 bg-wk-info-soft px-4 py-3"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-info">
                  Suggestion Selection
                </div>

                {reviewSelection ? (
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[12px] font-semibold leading-5 text-wk-text">
                        “{reviewSelection.quote}”
                      </p>

                      <p className="mt-1 text-[10px] text-wk-text-muted">
                        Positions{" "}
                        {reviewSelection.from} to{" "}
                        {reviewSelection.to}. The
                        submitted Article remains
                        unchanged.
                      </p>
                    </div>

                    {!suggestionTriggerPosition ? (
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() =>
                          setSuggestionComposerOpen(
                            true,
                          )
                        }
                        className="wk-button wk-button-primary wk-button-sm shrink-0"
                      >
                        <WkIcon
                          name="MessageSquarePlus"
                          size={14}
                        />
                        Draft Suggestion
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">
                    Select text in the submitted
                    Article. The composer will stay
                    closed until you choose Draft
                    Suggestion.
                  </p>
                )}

                {typeof document !==
                  "undefined" &&
                reviewSelection &&
                suggestionComposerOpen
                  ? createPortal(
                      <div
                        data-article-suggestion-drawer
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="article-suggestion-drawer-title"
                        className="fixed inset-0 z-[120] h-[100dvh] max-h-[100dvh] overflow-hidden bg-black/30"
                    onMouseDown={(event) => {
                      if (
                        event.currentTarget ===
                        event.target
                      ) {
                        setSuggestionComposerOpen(
                          false,
                        );
                      }
                    }}
                  >
                        <aside className="absolute inset-y-0 right-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl">
                          <div className="shrink-0 flex items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-info">
                            Submitted Version{" "}
                            {submittedDocument
                              ?.versionNumber}
                          </div>

                          <h2
                            id="article-suggestion-drawer-title"
                            className="mt-1 text-[18px] font-bold text-wk-text"
                          >
                            Draft Suggestion
                          </h2>

                          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                            The submitted Article will
                            not change until this
                            suggestion is accepted.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSuggestionComposerOpen(
                              false,
                            )
                          }
                          className="wk-button wk-button-secondary wk-button-sm"
                        >
                          Close
                        </button>
                      </div>

                          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
                        <div className="rounded-xl border border-wk-info/30 bg-wk-info-soft px-4 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-wk-info">
                            Selected Text
                          </div>

                          <p className="mt-2 text-[13px] font-semibold leading-5 text-wk-text">
                            “{reviewSelection.quote}”
                          </p>

                          <p className="mt-1 text-[10px] text-wk-text-muted">
                            Positions{" "}
                            {reviewSelection.from} to{" "}
                            {reviewSelection.to}
                          </p>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                            Proposed Change
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              aria-pressed={
                                suggestionOperation ===
                                "replace"
                              }
                              onClick={() =>
                                setSuggestionOperation(
                                  "replace",
                                )
                              }
                              className={
                                suggestionOperation ===
                                "replace"
                                  ? "wk-button wk-button-primary wk-button-sm"
                                  : "wk-button wk-button-secondary wk-button-sm"
                              }
                            >
                              Replace Text
                            </button>

                            <button
                              type="button"
                              aria-pressed={
                                suggestionOperation ===
                                "delete"
                              }
                              onClick={() => {
                                setSuggestionOperation(
                                  "delete",
                                );

                                setSuggestionReplacement(
                                  "",
                                );
                              }}
                              className={
                                suggestionOperation ===
                                "delete"
                                  ? "wk-button wk-button-primary wk-button-sm"
                                  : "wk-button wk-button-secondary wk-button-sm"
                              }
                            >
                              Delete Text
                            </button>
                          </div>
                        </div>

                        {suggestionOperation ===
                        "replace" ? (
                          <label className="mt-5 block">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                              Replacement Text
                            </span>

                            <textarea
                              rows={5}
                              value={
                                suggestionReplacement
                              }
                              onChange={(event) =>
                                setSuggestionReplacement(
                                  event.target.value,
                                )
                              }
                              placeholder="Write the proposed replacement."
                              className="w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] leading-5 text-wk-text outline-none focus:border-wk-brand"
                            />
                          </label>
                        ) : (
                          <p className="mt-5 rounded-lg border border-wk-warning/20 bg-wk-warning-soft px-3 py-2 text-[11px] leading-4 text-wk-text-muted">
                            This proposes removing the
                            selected text.
                          </p>
                        )}

                        <label className="mt-5 block">
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
                            Review Note
                          </span>

                          <textarea
                            rows={4}
                            value={suggestionComment}
                            onChange={(event) =>
                              setSuggestionComment(
                                event.target.value,
                              )
                            }
                            placeholder="Explain why this change helps."
                            className="w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] leading-5 text-wk-text outline-none focus:border-wk-brand"
                          />
                        </label>
                      </div>

                          <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-wk-border px-5 py-4 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={
                            resetSuggestionComposer
                          }
                          disabled={
                            isSuggestionSaving
                          }
                          className="wk-button wk-button-secondary wk-button-sm"
                        >
                          Cancel Suggestion
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleCreateArticleSuggestion()
                          }
                          disabled={
                            isSuggestionSaving ||
                            (
                              suggestionOperation ===
                                "replace" &&
                              !suggestionReplacement
                                .trim()
                            )
                          }
                          className="wk-button wk-button-primary wk-button-sm"
                        >
                          {isSuggestionSaving ? (
                            <>
                              <WkIcon
                                name="Loader2"
                                size={14}
                                className="animate-spin"
                              />
                              Saving
                            </>
                          ) : (
                            <>
                              <WkIcon
                                name="MessageSquarePlus"
                                size={14}
                              />
                              Create Suggestion
                            </>
                          )}
                        </button>
                      </div>
                        </aside>
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            ) : null}

            <ArticleContentEditor

              title={documentTitle}
              excerpt={documentExcerpt}
              content={documentContent}
              onTitleChange={(value) =>
                documentModeState.mode ===
                  "write" &&
                articlePermissions.canEdit &&
                patchDraft({
                  title: value,
                })
              }
              onExcerptChange={(value) =>
                documentModeState.mode ===
                  "write" &&
                articlePermissions.canEdit &&
                patchDraft({
                  excerpt: value,
                })
              }
              onContentChange={(value) =>
                documentModeState.mode ===
                  "write" &&
                articlePermissions.canEdit &&
                patchDraft({
                  content: value,
                })
              }
              readOnly={documentReadOnly}
              readOnlyLabel={
                documentModeState.mode ===
                "suggest"
                  ? "Select text to suggest a change"
                  : documentModeState.mode ===
                      "view"
                    ? "Submitted version, viewing only"
                    : "Viewing only"
              }
              captureTextSelection={
                documentModeState.mode ===
                "suggest"
              }
              onTextSelectionChange={
                handleReviewSelectionChange
              }
              onSaveDraft={
                documentModeState.mode ===
                "write"
                  ? handleSaveDraft
                  : undefined
              }
              onPreviewArticle={
                documentModeState.mode ===
                "write"
                  ? handleMagazinePreview
                  : undefined
              }
              onOpenArticleDetails={
                documentModeState.mode ===
                "write"
                  ? () =>
                      setWriteContextOpen(true)
                  : undefined
              }
              onCloseArticle={
                handleCloseArticle
              }
              focusMode={focusMode}
              onToggleFocusMode={() =>
                setFocusMode(
                  (current) => !current,
                )
              }
            />
          </div>
        ) : null}

        {activeWorkbenchMode === "write" ? (
          <ArticleWriteContextDrawer
            open={writeContextOpen}
            title={draft.title}
            content={draft.content}
            categoryCount={draft.categories.length}
            tagCount={draft.tags.length}
            onClose={() => setWriteContextOpen(false)}
          >
            {articleMetaPanel}
          </ArticleWriteContextDrawer>
        ) : activeWorkbenchMode === "trust" ? (
          <ArticleTrustPanel
            state={articleTrustState}
          />
        ) : (
          <div className="w-full max-w-6xl">
            {articleMetaPanel}
          </div>
        )}
      </div>

      {/* Review Decision Modal */}
      {reviewActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg mx-4 rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand">
              <WkIcon name={reviewActionModal === "request_changes" ? "Flag" : "Shield"} size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">
              {reviewActionModal === "request_changes" ? "Request Changes" : "Approve Version"}
            </h3>
            <p className="text-[13px] text-wk-text-muted mb-4">
              {reviewActionModal === "request_changes"
                ? "Tell the writer what needs to change before this article can move forward."
                : "Approve the submitted immutable version for publication."}
            </p>
            <textarea
              value={reviewActionNote}
              onChange={(event) => setReviewActionNote(event.target.value)}
              rows={5}
              autoFocus
              placeholder={reviewActionModal === "request_changes" ? "What should change?" : "Optional approval note"}
              className="w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReviewActionModal(null);
                  setReviewActionNote("");
                }}
                disabled={isReviewActionBusy}
                className="wk-button wk-button-secondary wk-button-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviewDecisionConfirm}
                disabled={isReviewActionBusy || (reviewActionModal === "request_changes" && !reviewActionNote.trim())}
                className="wk-button wk-button-primary wk-button-sm"
              >
                {isReviewActionBusy ? (
                  <>
                    <WkIcon name="Loader2" size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : reviewActionModal === "request_changes" ? (
                  <>
                    <WkIcon name="Flag" size={14} />
                    Send Changes
                  </>
                ) : (
                  <>
                    <WkIcon name="Shield" size={14} />
                    Approve Version
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
                Cancel and Keep Editing
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
      <div className="fixed inset-x-0 top-4 z-[140] mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pointer-events-none sm:top-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex min-h-12 items-center gap-3 rounded-xl border-2 px-4 py-3 text-[13px] font-bold leading-5 text-white shadow-2xl ring-2 ring-black/10 transition-all ${
              toast.type === "success"
                ? "border-[var(--wk-success)] bg-[var(--wk-success)]"
                : toast.type === "error"
                  ? "border-[var(--wk-danger)] bg-[var(--wk-danger)]"
                  : "border-[var(--wk-info)] bg-[var(--wk-info)]"
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
