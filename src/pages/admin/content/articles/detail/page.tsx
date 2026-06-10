import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import { rewriteWpImageUrl, rewriteWpImageUrls } from "@/services/wpImageRewrite";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";
import { createPreviewNonce } from "@/services/magazineArticles";
import { ArticleEditorHeader } from "./components/ArticleEditorHeader";
import { ArticleContentEditor } from "./components/ArticleContentEditor";
import { ArticleMetaPanel } from "./components/ArticleMetaPanel";
import { useAdminUser } from "@/hooks/useAdminUser";

/* ─── Types ─── */

interface ArticleRecord {
  id: string;
  slug: string;
  title: string | null;
  excerpt: string | null;
  content_html: string | null;
  author: string | null;
  published_at: string | null;
  modified_at: string | null;
  categories: string[] | null;
  tags: string[] | null;
  seo: Record<string, unknown> | null;
  wp_status: string | null;
  hero_image_url: string | null;
  created_at: string;
  updated_at: string | null;
}

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

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const adminUser = useAdminUser();

  const userCanPublish = adminUser.can("publish_articles");
  const userCanEditOthers = adminUser.can("edit_others_articles");
  const isAdmin = adminUser.role === "administrator" || adminUser.can("admin_god_mode");

  // ── State: MUST be declared before articlePermissions (which reads `article`) ──
  const [article, setArticle] = useState<ArticleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Central permission object (reactive via useMemo) ──
  const articlePermissions = useMemo(() => {
    const articleAuthor = (article?.author ?? "").toLowerCase();
    const currentUserName = adminUser.name?.toLowerCase() ?? "";
    const isOwner = !articleAuthor || !currentUserName
      ? true
      : articleAuthor === currentUserName || articleAuthor.includes(currentUserName) || currentUserName.includes(articleAuthor);

    const canView = true; // Everyone authenticated can view
    const canEdit = isAdmin || isOwner || userCanEditOthers;
    const canDelete = isAdmin || (isOwner && userCanEditOthers);
    const canPublish = isAdmin || (isOwner && userCanPublish);
    const canAutosave = canEdit;
    const reason = !canEdit
      ? "You can only edit your own articles. This article is owned by " + (article?.author || "another author") + "."
      : null;

    return { canView, canEdit, canDelete, canPublish, canAutosave, reason };
  }, [article, adminUser, isAdmin, userCanEditOthers, userCanPublish]);

  // Editable draft state
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

  const [heroImageUrl, setHeroImageUrl] = useState<string>("");
  const [isSavingHero, setIsSavingHero] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecovery, setShowRecovery] = useState<RecoveryPayload | null>(null);

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

  /* ─── Load article ─── */
  useEffect(() => {
    if (!slug) return;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("wk_articles")
        .select("id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, seo, wp_status, hero_image_url, created_at, updated_at")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        addToast("error", "Failed to load article.");
        setLoading(false);
        return;
      }

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setArticle({ ...data, title: decodeHtmlEntities(data.title ?? "") });
      setHeroImageUrl(rewriteWpImageUrl(data.hero_image_url ?? ""));

      // Set draft state — content is always visible, editing is gated by articlePermissions
      setDraft({
        title: decodeHtmlEntities(data.title ?? ""),
        excerpt: decodeHtmlEntities(data.excerpt ?? ""),
        content: rewriteWpImageUrls(data.content_html ?? ""),
        author: decodeHtmlEntities(data.author ?? ""),
        categories: normalizeTaxonomyTerms(data.categories).map((c) => decodeHtmlEntities(c)),
        tags: normalizeTaxonomyTerms(data.tags).map((t) => decodeHtmlEntities(t)),
        publishedAt: data.published_at ?? "",
        seo: (data.seo as { title?: string; description?: string; keywords?: string }) ?? {},
      });
      setIsDirty(false);
      setLoading(false);

      // Check for recovery: is there an autosave newer than the article's updated_at?
      await checkForRecovery(data.id, data.updated_at);
    }

    load();
  }, [slug]);

  /* ─── Recovery check ─── */
  async function checkForRecovery(articleId: string, articleUpdatedAt: string | null) {
    const { data } = await supabase
      .from("wk_article_revisions")
      .select("id, revision_number, created_at, title, excerpt, content_html, author, categories, tags, seo, wp_status, published_at")
      .eq("article_id", articleId)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;

    const autosaveTime = new Date(data.created_at);
    const articleTime = articleUpdatedAt ? new Date(articleUpdatedAt) : new Date(0);

    if (autosaveTime > articleTime) {
      setShowRecovery({
        title: decodeHtmlEntities(data.title || ""),
        excerpt: decodeHtmlEntities(data.excerpt || ""),
        content: data.content_html || "",
        author: decodeHtmlEntities(data.author || ""),
        categories: normalizeTaxonomyTerms(data.categories).map((c) => decodeHtmlEntities(c)),
        tags: normalizeTaxonomyTerms(data.tags).map((t) => decodeHtmlEntities(t)),
        seo: (data.seo as Record<string, unknown>) || {},
        publishedAt: data.published_at || "",
        wpStatus: data.wp_status,
        revisionNumber: data.revision_number,
        createdAt: data.created_at,
      });
    }
  }

  /* ─── Autosave ─── */
  async function autosaveRevision(currentDraft: Draft) {
    if (!articlePermissions.canAutosave) return;
    const currentArticle = stateRef.current.article;
    if (!currentArticle) return;

    setIsAutosaving(true);

    try {
      // Get next revision number
      const { data: maxRev } = await supabase
        .from("wk_article_revisions")
        .select("revision_number")
        .eq("article_id", currentArticle.id)
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextRevNumber = (maxRev?.revision_number ?? 0) + 1;

      const { error } = await supabase
        .from("wk_article_revisions")
        .insert({
          article_id: currentArticle.id,
          revision_number: nextRevNumber,
          title: currentDraft.title || null,
          excerpt: currentDraft.excerpt || null,
          content_html: currentDraft.content || null,
          author: currentDraft.author || null,
          categories: currentDraft.categories,
          tags: currentDraft.tags,
          seo: currentDraft.seo,
          published_at: currentDraft.publishedAt || null,
          wp_status: currentArticle.wp_status,
          created_by: "autosave",
        });

      if (error) {
        console.error("Autosave failed:", error);
        return;
      }

      const now = new Date().toISOString();
      setLastAutosavedAt(now);

      // Cleanup: keep only last 20 revisions
      const { data: oldRevisions } = await supabase
        .from("wk_article_revisions")
        .select("id, revision_number")
        .eq("article_id", currentArticle.id)
        .order("revision_number", { ascending: false });

      if (oldRevisions && oldRevisions.length > 20) {
        const toDelete = oldRevisions.slice(20);
        const ids = toDelete.map((r) => r.id);
        await supabase
          .from("wk_article_revisions")
          .delete()
          .in("id", ids);
      }
    } catch (err) {
      console.error("Autosave error:", err);
    } finally {
      setIsAutosaving(false);
    }
  }

  // 10-second autosave interval
  useEffect(() => {
    const interval = setInterval(() => {
      const { isDirty, isSaving, isPublishing, isAutosaving, draft } = stateRef.current;
      if (isDirty && !isSaving && !isPublishing && !isAutosaving) {
        autosaveRevision(draft);
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
  const handleRestoreDraft = useCallback((payload: {
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
  }, []);

  function handleInsertLink(html: string) {
    setDraft((prev) => ({ ...prev, content: prev.content + "\n\n" + html }));
    setIsDirty(true);
  }

  /* ─── Save helpers ─── */
  async function saveToSupabase(extraFields: Partial<ArticleRecord> = {}) {
    if (!article) return false;

    const payload = {
      title: draft.title || null,
      excerpt: draft.excerpt || null,
      content_html: draft.content || null,
      author: draft.author || null,
      categories: draft.categories,
      tags: draft.tags,
      published_at: draft.publishedAt || null,
      seo: draft.seo,
      updated_at: new Date().toISOString(),
      ...extraFields,
    };

    const { error } = await supabase
      .from("wk_articles")
      .update(payload)
      .eq("id", article.id);

    if (error) {
      addToast("error", `Save failed: ${error.message}`);
      return false;
    }

    // Refresh local article state
    const newStatus = (extraFields.wp_status as string | undefined) ?? article.wp_status;
    setArticle((prev) =>
      prev
        ? {
            ...prev,
            ...payload,
            wp_status: newStatus ?? prev.wp_status,
            published_at: payload.published_at ?? prev.published_at,
          }
        : prev
    );
    setIsDirty(false);
    return true;
  }

  async function handleSaveDraft() {
    if (!articlePermissions.canEdit) { addToast("error", articlePermissions.reason ?? "Permission denied."); return; }
    setIsSaving(true);
    const ok = await saveToSupabase({ wp_status: "draft" });
    setIsSaving(false);
    if (ok) addToast("success", "Saved as draft.");
  }

  async function handlePublish() {
    if (!articlePermissions.canPublish) { addToast("error", "You do not have permission to publish articles."); return; }
    setIsPublishing(true);
    const publishDate = draft.publishedAt || new Date().toISOString();
    const ok = await saveToSupabase({
      wp_status: "publish",
      published_at: publishDate,
    });
    setIsPublishing(false);
    if (ok) {
      setDraft((prev) => ({ ...prev, publishedAt: publishDate }));
      addToast("success", "Article published!");
    }
  }

  async function handleUnpublish() {
    if (!articlePermissions.canPublish) { addToast("error", "You do not have permission to unpublish."); return; }
    setIsSaving(true);
    const ok = await saveToSupabase({ wp_status: "draft" });
    setIsSaving(false);
    if (ok) addToast("info", "Article unpublished — saved as draft.");
  }

  async function handleDelete() {
    if (!articlePermissions.canDelete) { addToast("error", "You do not have permission to delete this article."); return; }
    if (!article) return;
    const { error } = await supabase
      .from("wk_articles")
      .update({ wp_status: "trash" })
      .eq("id", article.id);

    if (error) {
      addToast("error", "Failed to trash article.");
      return;
    }

    addToast("info", "Article moved to trash.");
    setTimeout(() => navigate("/admin/content/articles"), 1000);
  }

  async function handleSaveHeroImage(url: string) {
    if (!articlePermissions.canEdit) { addToast("error", articlePermissions.reason ?? "Permission denied."); return; }
    if (!article) return;
    setIsSavingHero(true);
    try {
      const { error } = await supabase
        .from("wk_articles")
        .update({ hero_image_url: url || null })
        .eq("id", article.id);

      if (error) {
        addToast("error", `Hero image save failed: ${error.message}`);
        return;
      }

      // Persist to media library too
      const { data: existing } = await supabase
        .from("wk_media_assets")
        .select("id")
        .eq("entity_type", "article")
        .eq("entity_slug", article.slug)
        .eq("role", "hero")
        .maybeSingle();

      if (url) {
        if (existing && typeof existing === "object" && "id" in existing) {
          await supabase
            .from("wk_media_assets")
            .update({ url, alt_text: draft.title, source: "editor_upload" })
            .eq("id", (existing as { id: string }).id);
        } else {
          await supabase.from("wk_media_assets").insert({
            entity_type: "article",
            entity_slug: article.slug,
            role: "hero",
            url,
            alt_text: draft.title,
            source: "editor_upload",
          });
        }
      }

      setHeroImageUrl(url);
      setArticle((prev) => prev ? { ...prev, hero_image_url: url || null } : prev);
      addToast("success", url ? "Hero image saved to media library." : "Hero image removed.");
    } finally {
      setIsSavingHero(false);
    }
  }

  async function handlePreview() {
    if (!article) return;
    setIsPreviewing(true);
    try {
      const nonce = await createPreviewNonce(article.slug);
      window.open(`/magazine/${article.slug}?preview=${nonce}`, "_blank");
      addToast("success", "Preview opened in new tab.");
    } catch (err) {
      addToast("error", "Failed to generate preview link.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSlugChange(newSlug: string): Promise<boolean> {
    if (!articlePermissions.canEdit) { addToast("error", articlePermissions.reason ?? "Permission denied."); return false; }
    if (!article || !slug) return false;
    // Check for slug collision
    const { data: existing } = await supabase
      .from("wk_articles")
      .select("id")
      .eq("slug", newSlug)
      .neq("id", article.id)
      .maybeSingle();

    if (existing) {
      addToast("error", `Slug "${newSlug}" is already taken.`);
      return false;
    }

    const { error } = await supabase
      .from("wk_articles")
      .update({ slug: newSlug })
      .eq("id", article.id);

    if (error) {
      addToast("error", `Failed to update slug: ${error.message}`);
      return false;
    }

    addToast("success", "Slug updated. Reloading…");
    setTimeout(() => navigate(`/admin/content/articles/${newSlug}`), 800);
    return true;
  }

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
        <p className="text-[13px] text-[var(--wk-text-muted)]">No article with slug &quot;{slug}&quot;</p>
        <button
          onClick={() => navigate("/admin/content/articles")}
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
      {/* Header */}
      <ArticleEditorHeader
        slug={article.slug}
        title={draft.title}
        status={article.wp_status}
        isDirty={isDirty}
        isSaving={isSaving}
        isPublishing={isPublishing}
        isPreviewing={isPreviewing}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onDelete={() => setShowDeleteConfirm(true)}
        onPreview={handlePreview}
        userCanPublish={articlePermissions.canPublish}
        userCanEditOthers={articlePermissions.canEdit}
        isAdmin={isAdmin}
        articleOwner={article.author}
        permissions={articlePermissions}
      />

      {/* Keyboard hint */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
        <WkIcon name="Command" size={11} />
        <span>+S to save · Auto-saves every 10s · Last auto-saved: {lastAutosavedAt ? new Date(lastAutosavedAt).toLocaleTimeString() : "—"}</span>
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
            wpStatus={article.wp_status}
            createdAt={article.created_at}
            updatedAt={article.updated_at}
            articleId={article.id}
            title={draft.title}
            excerpt={draft.excerpt}
            isDirty={isDirty}
            isSaving={isSaving}
            isPublishing={isPublishing}
            lastAutosavedAt={lastAutosavedAt}
            heroImageUrl={heroImageUrl}
            isSavingHero={isSavingHero}
            onHeroImageSave={handleSaveHeroImage}
            onAuthorChange={(v) => patchDraft({ author: v })}
            onCategoriesChange={(v) => patchDraft({ categories: v })}
            onTagsChange={(v) => patchDraft({ tags: v })}
            onPublishedAtChange={(v) => patchDraft({ publishedAt: v })}
            onSeoChange={(v) => patchDraft({ seo: v })}
            onRestoreDraft={handleRestoreDraft}
            onSlugChange={handleSlugChange}
            onInsertLink={handleInsertLink}
          />
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-info-soft)] text-[var(--wk-info)]">
              <WkIcon name="Save" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Unsaved Auto-saved Changes Found</h3>
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
              This will set the article status to &quot;trash&quot;. You can restore it later from
              the database if needed.
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
                toast.type === "success"
                  ? "CheckCircle2"
                  : toast.type === "error"
                  ? "XCircle"
                  : "Info"
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

/* ─── Helper: normalize WordPress taxonomy objects to strings ─── */

function normalizeTaxonomyTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null && "name" in item) {
      return String((item as Record<string, unknown>).name ?? "");
    }
    return String(item);
  }).filter(Boolean);
}