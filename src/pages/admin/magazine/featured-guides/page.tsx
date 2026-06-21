import { useState, useEffect, useMemo, useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { fetchPublishedGuides } from "@/services/guidePages";
import type { GuidePageRecord } from "@/pages/guides/detail/sectionTypes";
import {
  fetchFeaturedGuides,
  addFeaturedGuide,
  removeFeaturedGuide,
  reorderFeaturedGuides,
  type FeaturedGuide,
} from "@/services/magazineFeaturedGuides";

/* ── Draggable item ── */
function SortableGuideItem({
  guide,
  idx,
  removing,
  onRemove,
}: {
  guide: FeaturedGuide;
  idx: number;
  removing: string | null;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: guide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-wk-bg-subtle p-3 transition-colors group ${
        isDragging
          ? "border-wk-brand shadow-lg opacity-95"
          : "border-wk-border hover:border-wk-border-strong"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="w-8 h-8 rounded-md flex items-center justify-center text-wk-text-faint hover:text-wk-text hover:bg-wk-surface transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <i className="ri-draggable text-[18px]" />
      </button>

      {/* Order number */}
      <span className="w-7 h-7 rounded-full bg-wk-brand text-wk-brand-on text-[11px] font-black flex items-center justify-center shrink-0">
        {idx + 1}
      </span>

      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-wk-surface-raised overflow-hidden shrink-0 flex items-center justify-center">
        {guide.guide_hero_url ? (
          <img src={guide.guide_hero_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <WkIcon name="BookOpen" size={18} className="text-wk-text-faint" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-wk-text truncate">{guide.guide_title}</div>
        <div className="text-[11px] text-wk-text-muted truncate">
          {[guide.guide_format, guide.guide_subtitle].filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* Slug pill */}
      <span className="hidden sm:inline-block text-[10px] font-mono text-wk-text-faint bg-wk-surface border border-wk-border rounded-md px-2 py-0.5 truncate max-w-[160px] shrink-0">
        {guide.guide_slug}
      </span>

      {/* Remove */}
      <button
        onClick={() => onRemove(guide.id)}
        disabled={removing === guide.id}
        className="w-7 h-7 rounded-md border border-transparent flex items-center justify-center text-wk-text-faint hover:text-wk-danger hover:border-wk-danger/30 hover:bg-wk-danger/5 transition-all cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <WkIcon name="X" size={14} />
      </button>
    </div>
  );
}

/* ── Page ── */
export default function AdminFeaturedGuidesPage() {
  const [featured, setFeatured] = useState<FeaturedGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [allGuides, setAllGuides] = useState<GuidePageRecord[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeatured = useCallback(() => {
    fetchFeaturedGuides()
      .then((data) => {
        setFeatured(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load featured guides. Check your connection.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadFeatured();
    setGuidesLoading(true);
    fetchPublishedGuides().then((data) => {
      setAllGuides(data);
      setGuidesLoading(false);
    });
  }, [loadFeatured]);

  const featuredSlugs = useMemo(() => new Set(featured.map((f) => f.guide_slug)), [featured]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allGuides
      .filter((g) => !featuredSlugs.has(g.slug))
      .filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          (g.subtitle && g.subtitle.toLowerCase().includes(q)) ||
          (g.guide_format && g.guide_format.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [search, allGuides, featuredSlugs]);

  const handleAdd = async (slug: string) => {
    setAddingSlug(slug);
    const ok = await addFeaturedGuide(slug);
    if (ok) {
      loadFeatured();
      setSearch("");
    }
    setAddingSlug(null);
  };

  const handleRemove = async (id: string) => {
    setError(null);
    setSaving(id);
    try {
      const ok = await removeFeaturedGuide(id);
      if (ok) {
        loadFeatured();
      } else {
        setError("Could not remove this guide. Your session may have expired — try refreshing the page.");
        console.error("Failed to remove featured guide. Auth may be expired or permissions insufficient.");
      }
    } catch (err) {
      setError("Network error while removing guide. Check your connection and try again.");
      console.error("Remove featured guide error:", err);
    }
    setSaving(null);
  };

  /* ── Drag-and-drop sensors ── */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = featured.findIndex((g) => g.id === active.id);
      const newIdx = featured.findIndex((g) => g.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(featured, oldIdx, newIdx);
      setFeatured(reordered);

      const ok = await reorderFeaturedGuides(reordered.map((g) => g.id));
      if (!ok) {
        // Revert on failure
        loadFeatured();
      }
    },
    [featured, loadFeatured],
  );

  const maxGuides = 4;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Magazine</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Featured Guides</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            These guides appear in the featured spotlight on the magazine landing page.{" "}
            {featured.length > 0 && `${featured.length} of ${maxGuides} slots used.`}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-wk-danger/30 bg-wk-danger/5 px-4 py-3 animate-in fade-in">
          <div className="w-8 h-8 rounded-full bg-wk-danger/10 flex items-center justify-center shrink-0">
            <WkIcon name="AlertTriangle" size={16} className="text-wk-danger" />
          </div>
          <p className="text-[13px] font-semibold text-wk-danger flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="w-6 h-6 rounded flex items-center justify-center text-wk-danger/60 hover:text-wk-danger cursor-pointer shrink-0"
          >
            <WkIcon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Search & Add */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-bold text-wk-text-muted uppercase tracking-wide">
            Add a guide to the spotlight
          </label>
          <div className="relative max-w-lg">
            <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
              <WkIcon name="Search" size={14} className="text-wk-text-faint shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guides by title, subtitle, or format..."
                className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text cursor-pointer">
                  <WkIcon name="X" size={14} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {search.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-wk-border bg-wk-surface shadow-lg z-20 overflow-hidden">
                {guidesLoading ? (
                  <div className="p-3 text-[13px] text-wk-text-muted">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-[13px] text-wk-text-muted">
                    {featuredSlugs.size >= maxGuides
                      ? `All ${maxGuides} spotlight slots are filled. Remove a guide first.`
                      : "No guides found."}
                  </div>
                ) : (
                  searchResults.map((guide) => (
                    <button
                      key={guide.slug}
                      onClick={() => handleAdd(guide.slug)}
                      disabled={addingSlug === guide.slug || featuredSlugs.size >= maxGuides}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-wk-bg-subtle transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="w-9 h-9 rounded-lg bg-wk-surface-raised overflow-hidden shrink-0 flex items-center justify-center">
                        {guide.hero_url ? (
                          <img src={guide.hero_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <WkIcon name="BookOpen" size={16} className="text-wk-text-faint" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-wk-text truncate">{guide.title}</div>
                        <div className="text-[11px] text-wk-text-muted truncate">
                          {[guide.guide_format, guide.subtitle].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <WkIcon name="Plus" size={14} className="text-wk-brand shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </WkSurface>

      {/* Current featured guides */}
      <WkSurface className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <WkIcon name="Star" size={14} className="text-wk-brand" />
          <h2 className="text-[13px] font-bold text-wk-text uppercase tracking-wide">Spotlight Lineup</h2>
          {featured.length > 0 && (
            <span className="text-[11px] text-wk-text-muted ml-auto">
              Drag handles to reorder
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-wk-border bg-wk-surface p-3">
                <div className="h-4 w-32 rounded bg-wk-surface-raised" />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-bg-subtle mx-auto mb-3">
              <WkIcon name="BookOpen" size={22} className="text-wk-text-faint" />
            </div>
            <p className="text-[14px] font-semibold text-wk-text-muted mb-1">No featured guides yet</p>
            <p className="text-[12px] text-wk-text-faint">Search above to add guides to the spotlight</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={featured.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {featured.map((guide, idx) => (
                  <SortableGuideItem
                    key={guide.id}
                    guide={guide}
                    idx={idx}
                    removing={saving}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </WkSurface>

      {/* Help card */}
      <WkSurface className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-wk-brand-soft flex items-center justify-center shrink-0 mt-0.5">
            <WkIcon name="Info" size={16} className="text-wk-brand" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-wk-text mb-1">How this works</h3>
            <p className="text-[12px] text-wk-text-muted leading-relaxed">
              Featured guides appear in a dedicated spotlight section on the WAKILISHA Magazine landing page. Drag the handles on the left to reorder — the order you set here is the order visitors see on the site. Each guide card shows its title, subtitle, format, and links to the full guide.
            </p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}