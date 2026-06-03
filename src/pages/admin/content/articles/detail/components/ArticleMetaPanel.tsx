import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { ArticlePublishTimeline } from "./ArticlePublishTimeline";
import { ArticleSeoPreview } from "./ArticleSeoPreview";
import { ArticleRevisionHistory } from "./ArticleRevisionHistory";

interface SeoMeta {
  title?: string;
  description?: string;
  keywords?: string;
  [key: string]: unknown;
}

interface Props {
  author: string;
  categories: string[];
  tags: string[];
  publishedAt: string;
  seo: SeoMeta;
  slug: string;
  wpStatus: string | null;
  createdAt: string;
  updatedAt: string | null;
  articleId: string;
  title: string;
  excerpt: string;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  lastAutosavedAt?: string | null;
  heroImageUrl?: string;
  isSavingHero?: boolean;
  onHeroImageSave?: (url: string) => void;
  onAuthorChange: (v: string) => void;
  onCategoriesChange: (v: string[]) => void;
  onTagsChange: (v: string[]) => void;
  onPublishedAtChange: (v: string) => void;
  onSeoChange: (v: SeoMeta) => void;
  onRestoreDraft?: (payload: {
    title: string;
    excerpt: string;
    content: string;
    author: string;
    categories: string[];
    tags: string[];
    seo: SeoMeta;
    publishedAt: string;
    wpStatus: string | null;
  }) => void;
}

export function ArticleMetaPanel({
  author,
  categories,
  tags,
  publishedAt,
  seo,
  slug,
  wpStatus,
  createdAt,
  updatedAt,
  articleId,
  title,
  excerpt,
  isDirty,
  isSaving,
  isPublishing,
  lastAutosavedAt,
  heroImageUrl = "",
  isSavingHero = false,
  onHeroImageSave,
  onAuthorChange,
  onCategoriesChange,
  onTagsChange,
  onPublishedAtChange,
  onSeoChange,
  onRestoreDraft,
}: Props) {
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [seoPreviewOpen, setSeoPreviewOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [heroUrlInput, setHeroUrlInput] = useState(heroImageUrl);
  const [heroPreviewError, setHeroPreviewError] = useState(false);

  // Sync heroUrlInput if heroImageUrl prop changes (on load)
  useState(() => {
    setHeroUrlInput(heroImageUrl);
  });

  function addCategory() {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      onCategoriesChange([...categories, trimmed]);
    }
    setNewCategory("");
  }

  function removeCategory(cat: string) {
    onCategoriesChange(categories.filter((c) => c !== cat));
  }

  function addTag() {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setNewTag("");
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-4">
      {/* Hero Image */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3 flex items-center gap-1.5">
          <WkIcon name="Image" size={12} className="text-wk-text-faint" />
          Hero Image
        </h3>

        {/* Preview */}
        {heroUrlInput && !heroPreviewError ? (
          <div className="relative mb-3 rounded-lg overflow-hidden bg-wk-bg-subtle border border-wk-border" style={{ height: 120 }}>
            <img
              src={heroUrlInput}
              alt="Hero preview"
              className="w-full h-full object-cover object-top"
              onError={() => setHeroPreviewError(true)}
            />
            <button
              onClick={() => {
                setHeroUrlInput("");
                setHeroPreviewError(false);
                onHeroImageSave?.("");
              }}
              className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="Remove hero image"
            >
              <WkIcon name="X" size={11} />
            </button>
          </div>
        ) : (
          <div className="mb-3 flex h-20 items-center justify-center rounded-lg border border-dashed border-wk-border bg-wk-bg-subtle text-wk-text-faint text-[11px] gap-2">
            <WkIcon name="ImageOff" size={16} />
            <span>No hero image</span>
          </div>
        )}

        {/* Source badge */}
        {heroUrlInput && heroUrlInput.includes("wakilisha.africa/wp-content") && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-wk-surface-raised border border-wk-border px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted">
            <WkIcon name="Globe" size={10} />
            WP Import
          </div>
        )}

        {/* URL Input */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-wk-text-muted">Image URL</label>
          <input
            type="url"
            value={heroUrlInput}
            onChange={(e) => {
              setHeroUrlInput(e.target.value);
              setHeroPreviewError(false);
            }}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors font-mono"
          />
          <button
            onClick={() => onHeroImageSave?.(heroUrlInput)}
            disabled={isSavingHero || heroUrlInput === heroImageUrl}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-wk-border bg-wk-surface py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-40 transition-colors"
          >
            {isSavingHero ? (
              <>
                <i className="ri-loader-4-line animate-spin text-[14px]" />
                Saving…
              </>
            ) : (
              <>
                <WkIcon name="Save" size={13} />
                Save to Media Library
              </>
            )}
          </button>
          <p className="text-[10px] text-wk-text-faint leading-relaxed">
            Paste a direct image URL. WP import images link to wakilisha.africa. Upload new images via the media library or your CDN, then paste the URL here.
          </p>
        </div>
      </WkSurface>

      {/* Status Info */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
          Record Info
        </h3>
        <div className="space-y-2">
          <InfoRow label="Slug" value={slug} mono />
          <InfoRow label="WP Status" value={wpStatus ?? "—"} />
          <InfoRow label="Created" value={createdAt ? new Date(createdAt).toLocaleString() : "—"} />
          <InfoRow
            label="Last Modified"
            value={updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
          />
        </div>
      </WkSurface>

      {/* Author */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
          Author
        </h3>
        <input
          type="text"
          value={author}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="Author name…"
          className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
        />
      </WkSurface>

      {/* Publish Date */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
          Publish Date
        </h3>
        <input
          type="datetime-local"
          value={publishedAt ? publishedAt.slice(0, 16) : ""}
          onChange={(e) => onPublishedAtChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand transition-colors cursor-pointer"
        />
      </WkSurface>

      {/* Categories */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
          Categories
        </h3>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categories.length === 0 && (
            <span className="text-[12px] text-wk-text-faint">No categories</span>
          )}
          {categories.map((cat, i) => {
            const label = typeof cat === "string" ? cat : typeof cat === "object" && cat !== null && "name" in cat ? String((cat as Record<string, unknown>).name ?? "") : String(cat);
            if (!label) return null;
            return (
              <span
                key={`cat-${label}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-semibold text-wk-brand"
              >
                {label}
                <button
                  onClick={() => removeCategory(label)}
                  className="hover:text-wk-danger transition-colors"
                >
                  <WkIcon name="X" size={11} />
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="Add category…"
            className="flex-1 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
          />
          <button
            onClick={addCategory}
            disabled={!newCategory.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-40 transition-colors"
          >
            <WkIcon name="Plus" size={14} />
          </button>
        </div>
      </WkSurface>

      {/* Tags */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
          Tags
        </h3>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.length === 0 && (
            <span className="text-[12px] text-wk-text-faint">No tags</span>
          )}
          {tags.map((tag, i) => {
            const label = typeof tag === "string" ? tag : typeof tag === "object" && tag !== null && "name" in tag ? String((tag as Record<string, unknown>).name ?? "") : String(tag);
            if (!label) return null;
            return (
              <span
                key={`tag-${label}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-wk-surface-raised px-2.5 py-1 text-[11px] font-semibold text-wk-text-muted border border-wk-border"
              >
                {label}
                <button
                  onClick={() => removeTag(label)}
                  className="hover:text-wk-danger transition-colors"
                >
                  <WkIcon name="X" size={11} />
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="Add tag…"
            className="flex-1 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
          />
          <button
            onClick={addTag}
            disabled={!newTag.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-40 transition-colors"
          >
            <WkIcon name="Plus" size={14} />
          </button>
        </div>
      </WkSurface>

      {/* SEO Panel */}
      <WkSurface className="overflow-hidden">
        <button
          onClick={() => setSeoOpen(!seoOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors"
        >
          <div className="flex items-center gap-2">
            <WkIcon name="Search" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
              SEO Metadata
            </h3>
          </div>
          <WkIcon
            name={seoOpen ? "ChevronUp" : "ChevronDown"}
            size={14}
            className="text-wk-text-faint"
          />
        </button>

        {seoOpen && (
          <div className="border-t border-wk-border px-4 py-4 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">
                SEO Title
              </label>
              <input
                type="text"
                value={seo.title ?? ""}
                onChange={(e) => onSeoChange({ ...seo, title: e.target.value })}
                placeholder="SEO title (60 chars max)…"
                maxLength={60}
                className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
              />
              <div className="mt-1 text-right text-[10px] text-wk-text-faint">
                {(seo.title ?? "").length} / 60
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">
                Meta Description
              </label>
              <textarea
                value={seo.description ?? ""}
                onChange={(e) => onSeoChange({ ...seo, description: e.target.value })}
                placeholder="Meta description (160 chars max)…"
                maxLength={160}
                rows={3}
                className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand resize-none transition-colors"
              />
              <div className="mt-1 text-right text-[10px] text-wk-text-faint">
                {(seo.description ?? "").length} / 160
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">
                Keywords
              </label>
              <input
                type="text"
                value={seo.keywords ?? ""}
                onChange={(e) => onSeoChange({ ...seo, keywords: e.target.value })}
                placeholder="keyword1, keyword2, keyword3…"
                className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
              />
            </div>
          </div>
        )}
      </WkSurface>
      {/* Publishing Timeline */}
      <WkSurface className="overflow-hidden">
        <button
          onClick={() => setTimelineOpen(!timelineOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors"
        >
          <div className="flex items-center gap-2">
            <WkIcon name="GitBranch" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
              Publishing Timeline
            </h3>
          </div>
          <WkIcon
            name={timelineOpen ? "ChevronUp" : "ChevronDown"}
            size={14}
            className="text-wk-text-faint"
          />
        </button>
        {timelineOpen && (
          <div className="border-t border-wk-border px-4 py-4">
            <ArticlePublishTimeline
              status={wpStatus}
              publishedAt={publishedAt}
              createdAt={createdAt}
              updatedAt={updatedAt}
              isDirty={isDirty}
              isSaving={isSaving}
              isPublishing={isPublishing}
              lastAutosavedAt={lastAutosavedAt}
            />
          </div>
        )}
      </WkSurface>

      {/* SEO Preview */}
      <WkSurface className="overflow-hidden">
        <button
          onClick={() => setSeoPreviewOpen(!seoPreviewOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors"
        >
          <div className="flex items-center gap-2">
            <WkIcon name="Share2" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
              SEO &amp; Social Preview
            </h3>
          </div>
          <WkIcon
            name={seoPreviewOpen ? "ChevronUp" : "ChevronDown"}
            size={14}
            className="text-wk-text-faint"
          />
        </button>
        {seoPreviewOpen && (
          <div className="border-t border-wk-border px-4 py-4 space-y-3">
            <ArticleSeoPreview
              title={title}
              excerpt={excerpt}
              slug={slug}
              seo={seo}
              author={author}
              publishedAt={publishedAt}
            />
          </div>
        )}
      </WkSurface>

      {/* Revision History */}
      <WkSurface className="overflow-hidden">
        <button
          onClick={() => setRevisionsOpen(!revisionsOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors"
        >
          <div className="flex items-center gap-2">
            <WkIcon name="History" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
              Revision History
            </h3>
          </div>
          <WkIcon
            name={revisionsOpen ? "ChevronUp" : "ChevronDown"}
            size={14}
            className="text-wk-text-faint"
          />
        </button>
        {revisionsOpen && (
          <div className="border-t border-wk-border px-4 py-4">
            <ArticleRevisionHistory
              articleId={articleId}
              currentStatus={wpStatus}
              currentTitle={title}
              onRestore={(payload) => {
                onRestoreDraft?.({
                  title: payload.title,
                  excerpt: payload.excerpt,
                  content: payload.content,
                  author: payload.author,
                  categories: payload.categories,
                  tags: payload.tags,
                  seo: payload.seo as SeoMeta,
                  publishedAt: payload.publishedAt,
                  wpStatus: payload.wpStatus,
                });
              }}
            />
          </div>
        )}
      </WkSurface>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] font-semibold text-wk-text-faint shrink-0">{label}</span>
      <span
        className={`text-right text-[11px] text-wk-text-soft truncate max-w-[160px] ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}