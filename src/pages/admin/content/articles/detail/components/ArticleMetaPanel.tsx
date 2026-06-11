import { useState, useEffect, useRef, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import { ArticlePublishTimeline } from "./ArticlePublishTimeline";
import { ArticleSeoPreview } from "./ArticleSeoPreview";
import { ArticleSeoAnalyzer } from "./ArticleSeoAnalyzer";
import { ArticleInternalLinks } from "./ArticleInternalLinks";
import { ArticleRevisionHistory } from "./ArticleRevisionHistory";
import { fetchAllAuthors, type AuthorRow } from "@/services/authorProfiles";
import { supabase } from "@/lib/supabase";

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
  // Publish panel actions (wired to the page-level handlers)
  onSaveDraft?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDelete?: () => void;
  onStatusChange?: (newStatus: string) => void;
  // Preview URL sharing
  previewUrl?: string | null;
  isGeneratingPreview?: boolean;
  onGeneratePreviewLink?: () => void;
}

// ── Local date/time helpers ──
function toLocalDatetimeValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isScheduledDate(iso: string): boolean {
  if (!iso) return false;
  return new Date(iso) > new Date();
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatPublishDate(iso: string): string {
  if (!iso) return "Immediately";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Immediately";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  onSaveDraft,
  onPublish,
  onUnpublish,
  onDelete,
  onStatusChange,
  previewUrl,
  isGeneratingPreview = false,
  onGeneratePreviewLink,
}: Props) {
  // ── Taxonomy term picker state ──
  const [categoryTermOptions, setCategoryTermOptions] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [tagTermOptions, setTagTermOptions] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.rpc("get_taxonomy_terms", { p_taxonomy: "category" }),
      supabase.rpc("get_taxonomy_terms", { p_taxonomy: "post_tag" }),
    ]).then(([catRes, tagRes]) => {
      if (catRes.data) setCategoryTermOptions(
        (catRes.data as { id: string; name: string; slug: string }[]).map((t) => ({ id: t.id, name: t.name, slug: t.slug }))
      );
      if (tagRes.data) setTagTermOptions(
        (tagRes.data as { id: string; name: string; slug: string }[]).map((t) => ({ id: t.id, name: t.name, slug: t.slug }))
      );
    });
  }, []);

  useEffect(() => {
    if (!categoryPickerOpen && !tagPickerOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".category-picker-container")) { setCategoryPickerOpen(false); setCategorySearch(""); }
      if (!target.closest(".tag-picker-container")) { setTagPickerOpen(false); setTagSearch(""); }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [categoryPickerOpen, tagPickerOpen]);

  const filteredCategoryOptions = categorySearch.trim()
    ? categoryTermOptions.filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : categoryTermOptions.slice(0, 20);

  const filteredTagOptions = tagSearch.trim()
    ? tagTermOptions.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : tagTermOptions.slice(0, 20);

  const selectCategory = useCallback((name: string) => {
    if (name && !categories.includes(name)) onCategoriesChange([...categories, name]);
    setCategorySearch(""); setCategoryPickerOpen(false);
  }, [categories, onCategoriesChange]);

  const selectTag = useCallback((name: string) => {
    if (name && !tags.includes(name)) onTagsChange([...tags, name]);
    setTagSearch(""); setTagPickerOpen(false);
  }, [tags, onTagsChange]);

  const removeCategory = useCallback((cat: string) => onCategoriesChange(categories.filter((c) => c !== cat)), [categories, onCategoriesChange]);
  const removeTag = useCallback((tag: string) => onTagsChange(tags.filter((t) => t !== tag)), [tags, onTagsChange]);

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

  // Author dropdown
  const [authorList, setAuthorList] = useState<AuthorRow[]>([]);
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [authorSearch, setAuthorSearch] = useState("");

  useEffect(() => { fetchAllAuthors().then(setAuthorList); }, []);

  useEffect(() => {
    if (!authorDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".author-dropdown-container")) {
        setAuthorDropdownOpen(false); setAuthorSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [authorDropdownOpen]);

  const filteredAuthors = authorSearch.trim()
    ? authorList.filter((a) => a.name.toLowerCase().includes(authorSearch.toLowerCase()))
    : authorList;

  useEffect(() => { setHeroUrlInput(heroImageUrl); setHeroPreviewError(false); }, [heroImageUrl]);

  // ── Publish panel state (WP-style inline editing) ──
  const isPublished = wpStatus === "publish";
  const isFuture = wpStatus === "future";
  const isDraft = wpStatus === "draft" || wpStatus === "pending" || !wpStatus;

  const [statusEditOpen, setStatusEditOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string>(wpStatus ?? "draft");
  const [dateEditOpen, setDateEditOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string>(toLocalDatetimeValue(publishedAt));

  // Sync pendingStatus when wpStatus prop changes
  useEffect(() => { setPendingStatus(wpStatus ?? "draft"); }, [wpStatus]);
  useEffect(() => { setPendingDate(toLocalDatetimeValue(publishedAt)); }, [publishedAt]);

  function getStatusLabel(s: string): string {
    if (s === "publish") return "Published";
    if (s === "future") return "Scheduled";
    if (s === "pending") return "Pending Review";
    return "Draft";
  }

  function getPublishButtonLabel(): string {
    if (isPublished || isFuture) return "Update";
    const dateVal = pendingDate || toLocalDatetimeValue(publishedAt);
    if (dateVal && isScheduledDate(new Date(dateVal).toISOString())) return "Schedule";
    return "Publish";
  }

  function handlePublishClick() {
    if (isPublished || isFuture) {
      onPublish?.();
    } else {
      onPublish?.();
    }
  }

  return (
    <div className="space-y-4">

      {/* ══════════════════════════════════
          PUBLISH PANEL (WordPress-style)
          ══════════════════════════════════ */}
      <WkSurface className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-wk-border bg-wk-surface-raised/40">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">Publish</h3>
          {lastAutosavedAt && (
            <span className="text-[10px] text-wk-text-faint">
              Auto-saved {new Date(lastAutosavedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Save Draft / Preview row */}
          <div className="flex gap-2">
            <button
              onClick={onSaveDraft}
              disabled={isSaving || isPublishing}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? (
                <><i className="ri-loader-4-line animate-spin text-[13px]" /> Saving…</>
              ) : (
                <><WkIcon name="Save" size={13} /> Save Draft</>
              )}
            </button>
            <a
              href={`/magazine/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
            >
              <WkIcon name="Eye" size={13} />
              {isPublished ? "View" : "Preview"}
            </a>
          </div>

          <div className="border-t border-wk-border" />

          {/* Status row */}
          <div className="flex items-start gap-2">
            <WkIcon name="Flag" size={13} className="text-wk-text-faint mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-1 text-[12px] text-wk-text-soft">
                <span>Status:</span>
                <span className="font-bold text-wk-text">{getStatusLabel(wpStatus ?? "draft")}</span>
                {!statusEditOpen && (
                  <button onClick={() => setStatusEditOpen(true)} className="text-[11px] text-wk-brand hover:underline ml-1 cursor-pointer">Edit</button>
                )}
              </div>
              {statusEditOpen && (
                <div className="mt-2 flex items-start gap-2">
                  <select
                    value={pendingStatus}
                    onChange={(e) => setPendingStatus(e.target.value)}
                    className="flex-1 rounded-md border border-wk-border bg-wk-bg-subtle px-2 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand"
                  >
                    <option value="publish">Published</option>
                    <option value="pending">Pending Review</option>
                    <option value="draft">Draft</option>
                  </select>
                  <button
                    onClick={() => {
                      const newStatus = pendingStatus;
                      setStatusEditOpen(false);
                      if (newStatus !== (wpStatus ?? "draft")) {
                        onStatusChange?.(newStatus);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-md border border-wk-border text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                  >OK</button>
                  <button
                    onClick={() => { setStatusEditOpen(false); setPendingStatus(wpStatus ?? "draft"); }}
                    className="text-[11px] text-wk-text-faint hover:text-wk-text transition-colors whitespace-nowrap"
                  >Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Visibility row */}
          <div className="flex items-center gap-2">
            <WkIcon name="Eye" size={13} className="text-wk-text-faint shrink-0" />
            <span className="text-[12px] text-wk-text-soft">Visibility:</span>
            <span className="text-[12px] font-bold text-wk-text">Public</span>
          </div>

          {/* Publish Date row */}
          <div className="flex items-start gap-2">
            <WkIcon name="Calendar" size={13} className="text-wk-text-faint mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-1 text-[12px] text-wk-text-soft flex-wrap">
                <span>{isPublished || isFuture ? "Published on:" : "Publish:"}</span>
                <span className="font-bold text-wk-text">{formatPublishDate(publishedAt)}</span>
                {!dateEditOpen && (
                  <button onClick={() => setDateEditOpen(true)} className="text-[11px] text-wk-brand hover:underline ml-1 cursor-pointer">Edit</button>
                )}
              </div>
              {dateEditOpen && (
                <div className="mt-2 space-y-2">
                  <input
                    type="datetime-local"
                    value={pendingDate}
                    onChange={(e) => setPendingDate(e.target.value)}
                    className="w-full rounded-md border border-wk-border bg-wk-bg-subtle px-2 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (pendingDate) {
                          onPublishedAtChange(new Date(pendingDate).toISOString());
                        }
                        setDateEditOpen(false);
                      }}
                      className="px-2.5 py-1.5 rounded-md border border-wk-border text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                    >OK</button>
                    <button
                      onClick={() => { setDateEditOpen(false); setPendingDate(toLocalDatetimeValue(publishedAt)); }}
                      className="text-[11px] text-wk-text-faint hover:text-wk-text transition-colors whitespace-nowrap"
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-wk-border" />

          {/* Preview link for drafts/pending — shareable URL */}
          {!isPublished && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <WkIcon name="Share2" size={13} className="text-wk-text-faint shrink-0" />
                <span className="text-[11px] text-wk-text-soft font-semibold uppercase tracking-wider">Share Preview</span>
              </div>
              {previewUrl ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={previewUrl}
                    className="flex-1 rounded-md border border-wk-border bg-wk-bg-subtle px-2 py-1.5 text-[11px] font-mono text-wk-text outline-none"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(previewUrl).then(() => {
                        // Visual feedback handled by the button text swap below
                      });
                    }}
                    className="flex items-center gap-1 rounded-md border border-wk-border bg-wk-bg-subtle px-2 py-1.5 text-[11px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors whitespace-nowrap cursor-pointer"
                    title="Copy preview link"
                  >
                    <WkIcon name="Clipboard" size={12} />
                    Copy
                  </button>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-7 w-7 rounded-md border border-wk-border hover:bg-wk-surface-raised transition-colors cursor-pointer"
                    title="Open preview in new tab"
                  >
                    <WkIcon name="ExternalLink" size={12} className="text-wk-text-faint" />
                  </a>
                </div>
              ) : (
                <button
                  onClick={onGeneratePreviewLink}
                  disabled={isGeneratingPreview}
                  className="flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-bg-subtle px-3 py-1.5 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {isGeneratingPreview ? (
                    <><i className="ri-loader-4-line animate-spin text-[12px]" /> Generating…</>
                  ) : (
                    <><WkIcon name="Link" size={12} /> Generate Preview Link</>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="border-t border-wk-border" />

          {/* Main action row */}
          <div className="flex items-center justify-between">
            {isPublished ? (
              <button
                onClick={onDelete}
                disabled={isSaving || isPublishing}
                className="text-[11px] text-wk-danger hover:underline cursor-pointer disabled:opacity-50"
              >
                Move to Trash
              </button>
            ) : (
              <span className="text-[11px] text-wk-text-faint">
                {isDirty ? "• Unsaved changes" : "✓ All saved"}
              </span>
            )}

            <button
              onClick={handlePublishClick}
              disabled={isSaving || isPublishing}
              className="flex items-center gap-1.5 rounded-md bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
            >
              {isPublishing ? (
                <><i className="ri-loader-4-line animate-spin text-[14px]" /> {getPublishButtonLabel()}…</>
              ) : (
                <><WkIcon name={isPublished ? "RefreshCw" : "Globe"} size={13} /> {getPublishButtonLabel()}</>
              )}
            </button>
          </div>
        </div>
      </WkSurface>

      {/* Hero Image */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3 flex items-center gap-1.5">
          <WkIcon name="Image" size={12} className="text-wk-text-faint" />
          Hero Image
        </h3>

        {heroUrlInput && !heroPreviewError ? (
          <div className="relative mb-3 rounded-lg overflow-hidden bg-wk-bg-subtle border border-wk-border" style={{ height: 120 }}>
            <img
              src={heroUrlInput}
              alt="Hero preview"
              className="w-full h-full object-cover object-top"
              onError={() => setHeroPreviewError(true)}
            />
            <button
              onClick={() => { setHeroUrlInput(""); setHeroPreviewError(false); onHeroImageSave?.(""); }}
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

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-wk-text-muted">Image URL</label>
          <input
            type="url"
            value={heroUrlInput}
            onChange={(e) => { setHeroUrlInput(e.target.value); setHeroPreviewError(false); }}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors font-mono"
          />
          <div className="flex gap-2">
            <MediaPickerButton
              label="Browse Library"
              title="Select Hero Image"
              className="flex-1 justify-center py-2 text-[12px] hover:bg-[var(--wk-surface-raised)]"
              onSelect={(url) => { setHeroUrlInput(url); setHeroPreviewError(false); onHeroImageSave?.(url); }}
            />
            <button
              onClick={() => onHeroImageSave?.(heroUrlInput)}
              disabled={isSavingHero || heroUrlInput === heroImageUrl}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-wk-brand bg-wk-brand-soft py-2 text-[12px] font-semibold text-wk-brand hover:bg-wk-brand hover:text-wk-brand-on disabled:opacity-40 transition-colors"
            >
              {isSavingHero ? (
                <><i className="ri-loader-4-line animate-spin text-[14px]" /> Saving…</>
              ) : (
                <><WkIcon name="Save" size={13} /> Save</>
              )}
            </button>
          </div>
        </div>
      </WkSurface>

      {/* Slug */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">Permalink</h3>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-wk-text-faint">Slug</span>
            <button
              onClick={() => { setSlugEditOpen(!slugEditOpen); setEditedSlug(slug); }}
              className="text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer"
            >
              {slugEditOpen ? "Cancel" : "Edit"}
            </button>
          </div>
          {slugEditOpen ? (
            <div className="flex gap-2">
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
                {isSavingSlug ? <i className="ri-loader-4-line animate-spin text-[12px]" /> : <WkIcon name="Save" size={11} />}
                Save
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-wk-text-soft font-mono truncate block" title={slug}>{slug}</span>
          )}
        </div>
      </WkSurface>

      {/* Author */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3 flex items-center gap-1.5">
          <WkIcon name="User" size={12} className="text-wk-text-faint" />
          Author
        </h3>
        <div className="author-dropdown-container relative">
          <div className="relative">
            <input
              type="text"
              value={authorDropdownOpen ? authorSearch : author}
              onChange={(e) => { if (authorDropdownOpen) setAuthorSearch(e.target.value); else onAuthorChange(e.target.value); }}
              onFocus={() => { setAuthorDropdownOpen(true); setAuthorSearch(""); }}
              placeholder="Search or type author name…"
              className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
            />
            <button
              onClick={() => { setAuthorDropdownOpen(!authorDropdownOpen); setAuthorSearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-wk-surface-raised transition-colors cursor-pointer"
            >
              <WkIcon name={authorDropdownOpen ? "ChevronUp" : "ChevronDown"} size={13} className="text-wk-text-faint" />
            </button>
          </div>

          {authorDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-wk-border bg-wk-surface shadow-lg">
              {authorSearch.trim() && !filteredAuthors.some((a) => a.name.toLowerCase() === authorSearch.trim().toLowerCase()) && (
                <button
                  onClick={() => { onAuthorChange(authorSearch.trim()); setAuthorDropdownOpen(false); setAuthorSearch(""); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-wk-text hover:bg-wk-surface-raised transition-colors text-left border-b border-wk-border cursor-pointer"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wk-surface-raised text-wk-text-muted shrink-0">
                    <WkIcon name="Pencil" size={12} />
                  </div>
                  <div>
                    <span className="font-semibold">Use &quot;{authorSearch.trim()}&quot;</span>
                    <span className="block text-[10px] text-wk-text-faint">Custom byline</span>
                  </div>
                </button>
              )}
              {filteredAuthors.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-wk-text-faint">
                  {authorList.length === 0 ? "Loading authors…" : "No authors match."}
                </div>
              ) : (
                filteredAuthors.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { onAuthorChange(a.name); setAuthorDropdownOpen(false); setAuthorSearch(""); }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-left hover:bg-wk-surface-raised transition-colors cursor-pointer ${a.name === author ? "bg-wk-brand-soft" : ""}`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wk-brand text-[10px] font-black text-wk-brand-on shrink-0">
                      {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold ${a.name === author ? "text-wk-brand" : "text-wk-text"}`}>{a.name}</span>
                      <span className="block text-[10px] text-wk-text-faint">/{a.slug}</span>
                    </div>
                    {a.name === author && <WkIcon name="Check" size={13} className="text-wk-brand shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </WkSurface>

      {/* Categories */}
      <WkSurface className="p-4">
        <div ref={categoryPickerRef} className="category-picker-container">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3 flex items-center gap-1.5">
            <WkIcon name="Folder" size={12} className="text-wk-text-faint" />
            Categories
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categories.length === 0 && <span className="text-[12px] text-wk-text-faint">No categories</span>}
            {categories.map((cat, i) => {
              const label = typeof cat === "string" ? cat : typeof cat === "object" && cat !== null && "name" in cat ? String((cat as Record<string, unknown>).name ?? "") : String(cat);
              if (!label) return null;
              return (
                <span key={`cat-${label}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-semibold text-wk-brand">
                  {label}
                  <button onClick={() => removeCategory(label)} className="hover:text-wk-danger transition-colors cursor-pointer"><WkIcon name="X" size={11} /></button>
                </span>
              );
            })}
          </div>
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => { setCategorySearch(e.target.value); if (!categoryPickerOpen) setCategoryPickerOpen(true); }}
                onFocus={() => setCategoryPickerOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter" && categorySearch.trim()) { e.preventDefault(); selectCategory(categorySearch.trim()); } if (e.key === "Escape") { setCategoryPickerOpen(false); setCategorySearch(""); } }}
                placeholder="Search or type a category…"
                className="flex-1 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
              />
              <button onClick={() => setCategoryPickerOpen(!categoryPickerOpen)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors cursor-pointer">
                <WkIcon name={categoryPickerOpen ? "ChevronUp" : "ChevronDown"} size={13} />
              </button>
            </div>
            {categoryPickerOpen && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-wk-border bg-wk-surface shadow-lg">
                {categorySearch.trim() && !categoryTermOptions.some((c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase()) && (
                  <button onClick={() => selectCategory(categorySearch.trim())} className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-wk-surface-raised transition-colors cursor-pointer border-b border-wk-border">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-wk-brand-soft text-wk-brand shrink-0"><WkIcon name="Plus" size={11} /></div>
                    <span className="font-semibold">Create &quot;{categorySearch.trim()}&quot;</span>
                  </button>
                )}
                {filteredCategoryOptions.map((c) => (
                  <button key={c.id} onClick={() => selectCategory(c.name)} className={`flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-wk-surface-raised transition-colors cursor-pointer ${categories.includes(c.name) ? "bg-wk-brand-soft" : ""}`}>
                    <span className={`font-semibold ${categories.includes(c.name) ? "text-wk-brand" : "text-wk-text"}`}>{c.name}</span>
                    {categories.includes(c.name) && <WkIcon name="Check" size={13} className="text-wk-brand ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </WkSurface>

      {/* Tags */}
      <WkSurface className="p-4">
        <div ref={tagPickerRef} className="tag-picker-container">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3 flex items-center gap-1.5">
            <WkIcon name="Tag" size={12} className="text-wk-text-faint" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.length === 0 && <span className="text-[12px] text-wk-text-faint">No tags</span>}
            {tags.map((tag, i) => {
              const label = typeof tag === "string" ? tag : typeof tag === "object" && tag !== null && "name" in tag ? String((tag as Record<string, unknown>).name ?? "") : String(tag);
              if (!label) return null;
              return (
                <span key={`tag-${label}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-wk-surface-raised px-2.5 py-1 text-[11px] font-semibold text-wk-text-muted border border-wk-border">
                  {label}
                  <button onClick={() => removeTag(label)} className="hover:text-wk-danger transition-colors cursor-pointer"><WkIcon name="X" size={11} /></button>
                </span>
              );
            })}
          </div>
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => { setTagSearch(e.target.value); if (!tagPickerOpen) setTagPickerOpen(true); }}
                onFocus={() => setTagPickerOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter" && tagSearch.trim()) { e.preventDefault(); selectTag(tagSearch.trim()); } if (e.key === "Escape") { setTagPickerOpen(false); setTagSearch(""); } }}
                placeholder="Search or type a tag…"
                className="flex-1 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors"
              />
              <button onClick={() => setTagPickerOpen(!tagPickerOpen)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors cursor-pointer">
                <WkIcon name={tagPickerOpen ? "ChevronUp" : "ChevronDown"} size={13} />
              </button>
            </div>
            {tagPickerOpen && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-wk-border bg-wk-surface shadow-lg">
                {tagSearch.trim() && !tagTermOptions.some((t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                  <button onClick={() => selectTag(tagSearch.trim())} className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-wk-surface-raised transition-colors cursor-pointer border-b border-wk-border">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-wk-surface-raised text-wk-text-muted shrink-0"><WkIcon name="Plus" size={11} /></div>
                    <span className="font-semibold">Create &quot;{tagSearch.trim()}&quot;</span>
                  </button>
                )}
                {filteredTagOptions.map((t) => (
                  <button key={t.id} onClick={() => selectTag(t.name)} className={`flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-wk-surface-raised transition-colors cursor-pointer ${tags.includes(t.name) ? "bg-wk-surface-raised" : ""}`}>
                    <span className="font-semibold text-wk-text">{t.name}</span>
                    {tags.includes(t.name) && <WkIcon name="Check" size={13} className="text-wk-text-muted ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <button onClick={() => setSeoOpen(!seoOpen)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors">
          <div className="flex items-center gap-2">
            <WkIcon name="Search" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">SEO Metadata</h3>
          </div>
          <WkIcon name={seoOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-wk-text-faint" />
        </button>
        {seoOpen && (
          <div className="border-t border-wk-border px-4 py-4 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">Focus Keyword</label>
              <input type="text" value={(seo.focusKeyword as string) ?? ""} onChange={(e) => onSeoChange({ ...seo, focusKeyword: e.target.value })} placeholder="Primary keyword to optimize for…" className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">SEO Title</label>
              <input type="text" value={seo.title ?? ""} onChange={(e) => onSeoChange({ ...seo, title: e.target.value })} placeholder="SEO title (60 chars max)…" maxLength={60} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors" />
              <div className="mt-1 text-right text-[10px] text-wk-text-faint">{(seo.title ?? "").length} / 60</div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">Meta Description</label>
              <textarea value={seo.description ?? ""} onChange={(e) => onSeoChange({ ...seo, description: e.target.value })} placeholder="Meta description (160 chars max)…" maxLength={160} rows={3} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand resize-none transition-colors" />
              <div className="mt-1 text-right text-[10px] text-wk-text-faint">{(seo.description ?? "").length} / 160</div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-wk-text-muted mb-1.5">Keywords</label>
              <input type="text" value={seo.keywords ?? ""} onChange={(e) => onSeoChange({ ...seo, keywords: e.target.value })} placeholder="keyword1, keyword2, keyword3…" className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors" />
            </div>
            <button onClick={() => setSeoAnalyzerOpen(!seoAnalyzerOpen)} className="flex w-full items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[12px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors cursor-pointer">
              <span className="flex items-center gap-1.5"><WkIcon name="BarChart" size={13} />{seoAnalyzerOpen ? "Hide" : "Run"} Full SEO Analysis</span>
              <WkIcon name={seoAnalyzerOpen ? "ChevronUp" : "ChevronDown"} size={13} />
            </button>
            {seoAnalyzerOpen && (
              <div className="pt-2">
                <ArticleSeoAnalyzer title={title} content={(seo as Record<string, unknown>)._content as string || ""} excerpt={excerpt} slug={slug} seoTitle={(seo.title as string) || title} seoDescription={(seo.description as string) || excerpt} seoKeywords={(seo.keywords as string) || ""} focusKeyword={(seo.focusKeyword as string) || ""} />
              </div>
            )}
          </div>
        )}
      </WkSurface>

      {/* Publishing Timeline */}
      <WkSurface className="overflow-hidden">
        <button onClick={() => setTimelineOpen(!timelineOpen)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors">
          <div className="flex items-center gap-2">
            <WkIcon name="GitBranch" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Publishing Timeline</h3>
          </div>
          <WkIcon name={timelineOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-wk-text-faint" />
        </button>
        {timelineOpen && (
          <div className="border-t border-wk-border px-4 py-4">
            <ArticlePublishTimeline status={wpStatus} publishedAt={publishedAt} createdAt={createdAt} updatedAt={updatedAt} isDirty={isDirty} isSaving={isSaving} isPublishing={isPublishing} lastAutosavedAt={lastAutosavedAt} />
          </div>
        )}
      </WkSurface>

      {/* SEO Preview */}
      <WkSurface className="overflow-hidden">
        <button onClick={() => setSeoPreviewOpen(!seoPreviewOpen)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors">
          <div className="flex items-center gap-2">
            <WkIcon name="Share2" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">SEO &amp; Social Preview</h3>
          </div>
          <WkIcon name={seoPreviewOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-wk-text-faint" />
        </button>
        {seoPreviewOpen && (
          <div className="border-t border-wk-border px-4 py-4 space-y-3">
            <ArticleSeoPreview title={title} excerpt={excerpt} slug={slug} seo={seo} author={author} publishedAt={publishedAt} />
          </div>
        )}
      </WkSurface>

      {/* Revision History */}
      <WkSurface className="overflow-hidden">
        <button onClick={() => setRevisionsOpen(!revisionsOpen)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors">
          <div className="flex items-center gap-2">
            <WkIcon name="History" size={14} className="text-wk-text-muted" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Revision History</h3>
          </div>
          <WkIcon name={revisionsOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-wk-text-faint" />
        </button>
        {revisionsOpen && (
          <div className="border-t border-wk-border px-4 py-4">
            <ArticleRevisionHistory
              articleId={articleId}
              currentStatus={wpStatus}
              currentTitle={title}
              onRestore={(payload) => {
                onRestoreDraft?.({ title: payload.title, excerpt: payload.excerpt, content: payload.content, author: payload.author, categories: payload.categories, tags: payload.tags, seo: payload.seo as SeoMeta, publishedAt: payload.publishedAt, wpStatus: payload.wpStatus });
              }}
            />
          </div>
        )}
      </WkSurface>
    </div>
  );
}