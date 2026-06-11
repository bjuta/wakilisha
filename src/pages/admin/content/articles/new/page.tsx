import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminNewArticlePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (autoSlug) {
        setSlug(slugify(value));
      }
    },
    [autoSlug]
  );

  const handleSlugChange = useCallback((value: string) => {
    setAutoSlug(false);
    setSlug(slugify(value));
  }, []);

  const handleCreate = useCallback(async () => {
    const finalSlug = slug.trim() || slugify(title).trim();
    const finalTitle = title.trim();

    if (!finalTitle) {
      setError("Please enter a title.");
      return;
    }

    if (!finalSlug) {
      setError("Could not generate a slug. Please type one manually.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Check slug collision first
      const { data: existing, error: checkError } = await supabase
        .from("wk_articles")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();

      if (checkError) {
        setError(`Failed to check slug: ${checkError.message}`);
        setCreating(false);
        return;
      }

      if (existing) {
        setError(`The slug "${finalSlug}" is already in use. Please choose a different one.`);
        setCreating(false);
        return;
      }

      // Direct INSERT — RLS policy checks edit_own_articles capability or administrator role
      const { data: inserted, error: insertError } = await supabase
        .from("wk_articles")
        .insert({
          slug: finalSlug,
          title: finalTitle,
          wp_status: "draft",
          categories: [],
          tags: [],
          seo: {},
          raw_meta: {},
        })
        .select("id, slug")
        .single();

      if (insertError) {
        if (insertError.message.includes("permission denied") || insertError.message.includes("policy")) {
          setError("You don't have permission to create articles. The 'edit_own_articles' capability or administrator role is required.");
        } else {
          setError(`Failed to create article: ${insertError.message}`);
        }
        setCreating(false);
        return;
      }

      if (!inserted) {
        setError("Article was created but no data was returned.");
        setCreating(false);
        return;
      }

      navigate(`/admin/content/articles/${inserted.slug}`);
    } catch (err) {
      setError("An unexpected error occurred.");
      setCreating(false);
    }
  }, [title, slug]);

  return (
    <div className="max-w-[600px] mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate("/admin/content/articles")}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors cursor-pointer whitespace-nowrap"
      >
        <WkIcon name="ArrowLeft" size={14} />
        Back to Articles
      </button>

      {/* Header */}
      <div>
        <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Content</div>
        <h1 className="text-[22px] font-black tracking-tight text-wk-text">New Article</h1>
        <p className="mt-1 text-[13px] text-wk-text-muted">
          Start a new draft. You'll be taken to the editor after creating it.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-wk-border bg-wk-surface p-6 space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <label htmlFor="new-article-title" className="block text-[12px] font-black uppercase tracking-wider text-wk-text-muted">
            Title
          </label>
          <input
            id="new-article-title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Enter article title..."
            className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[14px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
            autoFocus
          />
        </div>

        {/* Slug */}
        <div className="space-y-2">
          <label htmlFor="new-article-slug" className="block text-[12px] font-black uppercase tracking-wider text-wk-text-muted">
            Slug
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-article-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="article-url-slug"
              className="flex-1 rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[14px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors font-mono text-[13px]"
            />
            <button
              onClick={() => {
                setAutoSlug(true);
                setSlug(slugify(title));
              }}
              className="h-10 w-10 rounded-lg border border-wk-border bg-wk-bg-subtle flex items-center justify-center text-wk-text-muted hover:text-wk-text hover:border-wk-brand transition-all cursor-pointer shrink-0"
              title="Regenerate from title"
            >
              <WkIcon name="RefreshCw" size={14} />
            </button>
          </div>
          {autoSlug && title && (
            <p className="text-[11px] text-wk-text-faint">Auto-generated from title. Edit manually to override.</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-wk-danger-soft border border-wk-danger/20 px-4 py-3 text-[13px] text-wk-danger">
            <WkIcon name="AlertCircle" size={15} className="shrink-0 mt-px" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            {creating ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <WkIcon name="Plus" size={14} />
                Create Draft
              </>
            )}
          </button>
          <button
            onClick={() => navigate("/admin/content/articles")}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5 space-y-2">
        <p className="text-[12px] font-black uppercase tracking-wider text-wk-text-muted">What happens next</p>
        <ul className="space-y-1.5 text-[13px] text-wk-text-muted">
          <li className="flex items-start gap-2">
            <WkIcon name="Check" size={13} className="text-wk-success shrink-0 mt-0.5" />
            A new draft is created with your title and slug
          </li>
          <li className="flex items-start gap-2">
            <WkIcon name="Check" size={13} className="text-wk-success shrink-0 mt-0.5" />
            You're taken straight into the editor to write content
          </li>
          <li className="flex items-start gap-2">
            <WkIcon name="Check" size={13} className="text-wk-success shrink-0 mt-0.5" />
            Auto-save kicks in every 10 seconds — no lost work
          </li>
        </ul>
      </div>
    </div>
  );
}