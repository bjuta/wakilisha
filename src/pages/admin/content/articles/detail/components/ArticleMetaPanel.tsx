import { useState, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import { ArticlePublishTimeline } from "./ArticlePublishTimeline";
import { ArticleSeoPreview } from "./ArticleSeoPreview";
import { ArticleSeoAnalyzer } from "./ArticleSeoAnalyzer";
import { ArticleInternalLinks } from "./ArticleInternalLinks";
import { ArticleRevisionHistory } from "./ArticleRevisionHistory";
import { fetchAllAuthors, type AuthorRow } from "@/services/authorProfiles";

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
  onSlugChange?: (newSlug: string) => Promise<boolean>;
  onInsertLink?: (url: string) => void;
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
  onSlugChange,
  onInsertLink,
  onRestoreDraft,
}: Props) {
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoAnalyzerOpen, setSeoAnalyzerOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [seoPreviewOpen, setSeoPreviewOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [heroUrlInput, setHeroUrlInput] = useState(heroImageUrl);
  const [heroPreviewError, setHeroPreviewError] = useState(false);
  const [slugEditOpen, setSlugEditOpen] = useState(false);
  const [editedSlug, setEditedSlug] = useState(slug);
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  // Author dropdown from wk_authors
  const [authorList, setAuthorList] = useState<AuthorRow[]>([]);
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [authorSearch, setAuthorSearch] = useState("");

  useEffect(() => {
    fetchAllAuthors().then(setAuthorList);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!authorDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".author-dropdown-container")) {
        setAuthorDropdownOpen(false);
        setAuthorSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [authorDropdownOpen]);

  const filteredAuthors = authorSearch.trim()
    ? authorList.filter((a) => a.name.toLowerCase().includes(authorSearch.toLowerCase()))
    : authorList;

  // Sync heroUrlInput when heroImageUrl prop changes
  useEffect(() => {
    setHeroUrlInput(heroImageUrl);
    setHeroPreviewError(false);
  }, [heroImageUrl]);

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
          <div className="flex gap-2">
            <MediaPickerButton
              label="Browse Library"
              title="Select Hero Image"
              className="flex-1 justify-center py-2 text-[12px] hover:bg-[var(--wk-surface-raised)]"
              onSelect={(url) => {
                setHeroUrlInput(url);
                setHeroPreviewError(false);
                onHeroImageSave?.(url);
              }}
            />
            <button
              onClick={() => onHeroImageSave?.(heroUrlInput)}
              disabled={isSavingHero || heroUrlInput === heroImageUrl}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-wk-brand bg-wk-brand-soft py-2 text-[12px] font-semibold text-wk-brand hover:bg-wk-brand hover:text-wk-brand-on disabled:opacity-40 transition-colors"
            >
              {isSavingHero ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-[14px]" />
                  Saving…
                </>
              ) : (
                <>
                  <WkIcon name="Save" size={13} />
                  Save
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-wk-text-faint leading-relaxed">
            Paste a direct image URL or browse the media library. WP import images link to wakilisha.africa.
          </p>
        </div>
      </WkSurface>

      {/* Status Info */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
          Record Info
        </h3>
        <div className="space-y-2">
          {/* Editable Slug */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-wk-text-faint">Slug</span>
              <button
                onClick={() => { setSlugEditOpen(!slugEditOpen); setEditedSlug(slug); }}
                className="text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer"
              >
                {slugEditOpen ? "Cancel" : "Edit"}
              </button>
            </div>
            {slugEditOpen ? (
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={editedSlug}
                  onChange={(e) => setEditedSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))}
                  className="flex-1 rounded-md border border-wk-border bg-wk-bg-subtle px-2 py-1.5 text-[11px] font-mono text-wk-text outline-none focus:border-wk-brand"
                />
                <button
                  onClick={async () => {
                    if (!editedSlug.trim() || editedSlug === slug) { setSlugEditOpen(false); return; }
                    setIsSavingSlug(true);
                    const ok = await onSlugChange?.(editedSlug);
                    setIsSavingSlug(false);
                    if (ok) setSlugEditOpen(false);
                  }}
                  disabled={isSavingSlug || !editedSlug.trim() || editedSlug === slug}
                  className="flex items-center gap-1 rounded-md border border-wk-brand bg-wk-brand-soft px-2.5 py-1.5 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand hover:text-wk-brand-on disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {isSavingSlug ? (
                    <i className="ri-loader-4-line animate-spin text-[12px]" />
                  ) : (
                    <WkIcon name="Save" size={11} />
                  )}
                  Save
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-wk-text-soft font-mono truncate block" title={slug}>{slug}</span>
            )}
          </div>
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
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3 flex items-center gap-1.5">
          <WkIcon name="User" size={12} className="text-wk-text-faint" />
          Author
          {authorList.length > 0 && (
            <span className="text-[10px] font-normal text-wk-text-faint ml-auto">{authorList.length} in registry</span>
          )}
        </h3>

        <div className="author-dropdown-container relative">
          {/* Current selection / search input */}
          <div className="relative">
            <input
              type="text"
              value={authorDropdownOpen ? authorSearch : author}
              onChange={(e) => {
                if (authorDropdownOpen) {
                  setAuthorSearch(e.target.value);
                } else {
                  onAuthorChange(e.target.value);
                }
              }}
              onFocus={() => {
                setAuthorDropdownOpen(true);
                setAuthorSearch("");
              }}
              placeholder="Search or type author name…"
              className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
            />
            <button
              onClick={() => {
                setAuthorDropdownOpen(!authorDropdownOpen);
                setAuthorSearch("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-wk-surface-raised transition-colors cursor-pointer"
            >
              <WkIcon name={authorDropdownOpen ? "ChevronUp" : "ChevronDown"} size={13} className="text-wk-text-faint" />
            </button>
          </div>

          {/* Selected author badge when not from dropdown */}
          {author && !authorList.some((a) => a.name === author) && !authorDropdownOpen && (
            <p className="mt-1.5 text-[10px] text-wk-text-faint flex items-center gap-1">
              <WkIcon name="Info" size={10} />
              Custom byline (not in author registry)
            </p>
          )}

          {/* Dropdown */}
          {authorDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-wk-border bg-wk-surface shadow-lg">
              {/* Custom / free-text option */}
              {authorSearch.trim() && !filteredAuthors.some((a) => a.name.toLowerCase() === authorSearch.trim().toLowerCase()) && (
                <button
                  onClick={() => {
                    onAuthorChange(authorSearch.trim());
                    setAuthorDropdownOpen(false);
                    setAuthorSearch("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-wk-text hover:bg-wk-surface-raised transition-colors text-left border-b border-wk-border cursor-pointer"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wk-surface-raised text-wk-text-muted shrink-0">
                    <WkIcon name="Pencil" size={12} />
                  </div>
                  <div>
                    <span className="font-semibold">Use &quot;{authorSearch.trim()}&quot;</span>
                    <span className="block text-[10px] text-wk-text-faint">Custom byline (not in registry)</span>
                  </div>
                </button>
              )}

              {filteredAuthors.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-wk-text-faint">
                  {authorList.length === 0 ? "Loading authors…" : "No authors match your search."}
                </div>
              ) : (
                filteredAuthors.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onAuthorChange(a.name);
                      setAuthorDropdownOpen(false);
                      setAuthorSearch("");
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-left hover:bg-wk-surface-raised transition-colors cursor-pointer ${
                      a.name === author ? "bg-wk-brand-soft" : ""
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wk-brand text-[10px] font-black text-wk-brand-on shrink-0">
                      {a.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold ${a.name === author ? "text-wk-brand" : "text-wk-text"}`}>
                        {a.name}
                      </span>
                      <span className="block text-[10px] text-wk-text-faint">
                        /{a.slug}
                        {a.source_kind && ` · ${a.source_kind.replace("_", " ")}`}
                      </span>
                    </div>
                    {a.name === author && (
                      <div className="flex h-5 w-5 items-center justify-center">
                        <WkIcon name="Check" size={13} className="text-wk-brand" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
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

      {/* Internal Link Suggestions */}
      <ArticleInternalLinks
        content={(seo as Record<string, unknown>)._content as string || ""}
        currentSlug={slug}
        categories={categories}
        tags={tags}
        onInsertLink={onInsertLink}
      />

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
                Focus Keyword
              </label>
              <input
                type="text"
                value={(seo.focusKeyword as string) ?? ""}
                onChange={(e) => onSeoChange({ ...seo, focusKeyword: e.target.value })}
                placeholder="Primary keyword to optimize for…"
                className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
              />
              <p className="mt-1 text-[10px] text-wk-text-faint">
                Used to analyze keyword placement across title, headings, content, URL, and meta.
              </p>
            </div>
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

            <button
              onClick={() => setSeoAnalyzerOpen(!seoAnalyzerOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <WkIcon name="BarChart" size={13} />
                {seoAnalyzerOpen ? "Hide" : "Run"} Full SEO Analysis
              </span>
              <WkIcon name={seoAnalyzerOpen ? "ChevronUp" : "ChevronDown"} size={13} />
            </button>

            {seoAnalyzerOpen && (
              <div className="pt-2">
                <ArticleSeoAnalyzer
                  title={title}
                  content={(seo as Record<string, unknown>)._content as string || ""}
                  excerpt={excerpt}
                  slug={slug}
                  seoTitle={(seo.title as string) || title}
                  seoDescription={(seo.description as string) || excerpt}
                  seoKeywords={(seo.keywords as string) || ""}
                  focusKeyword={(seo.focusKeyword as string) || ""}
                />
              </div>
            )}
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