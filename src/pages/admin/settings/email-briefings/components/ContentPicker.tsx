import { useState, useEffect, useCallback, useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import type { BriefingSectionItem, BriefingContentSection } from "@/services/briefingService";

// ── Types ──

export type PickerEntityType = "articles" | "artists" | "releases" | "charts" | "guides";

interface SearchResult {
  id: string;
  slug: string;
  type: PickerEntityType;
  title: string;
  subtitle: string;
  imageUrl?: string;
  meta?: string;
  raw: BriefingSectionItem;
}

interface Section {
  id: string;
  title: string;
  type: PickerEntityType;
  layout: "list" | "grid";
  items: (SearchResult & { selected: true })[];
}

const ENTITY_TYPES: { key: PickerEntityType; label: string; icon: string; color: string }[] = [
  { key: "articles", label: "Stories", icon: "FileText", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "artists", label: "Artists", icon: "Music", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "releases", label: "Releases", icon: "Disc3", color: "text-violet-600 bg-violet-50 border-violet-200" },
  { key: "charts", label: "Charts", icon: "BarChart2", color: "text-rose-600 bg-rose-50 border-rose-200" },
  { key: "guides", label: "Guides", icon: "BookOpen", color: "text-sky-600 bg-sky-50 border-sky-200" },
];

const LAYOUT_PRESETS: { type: PickerEntityType; defaultLayout: "list" | "grid" }[] = [
  { type: "articles", defaultLayout: "list" },
  { type: "artists", defaultLayout: "grid" },
  { type: "releases", defaultLayout: "grid" },
  { type: "charts", defaultLayout: "list" },
  { type: "guides", defaultLayout: "list" },
];

function defaultLayoutForType(type: PickerEntityType): "list" | "grid" {
  return LAYOUT_PRESETS.find((p) => p.type === type)?.defaultLayout ?? "list";
}

function defaultSectionTitle(type: PickerEntityType): string {
  const map: Record<PickerEntityType, string> = {
    articles: "Latest Stories",
    artists: "Artists to Watch",
    releases: "Fresh Drops",
    charts: "Chart Highlights",
    guides: "From the Guides",
  };
  return map[type];
}

// ── Supabase searchers ──

async function searchArticles(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase
    .from("wk_articles")
    .select("id, slug, title, excerpt, hero_image_url, published_at, author, categories")
    .eq("wp_status", "publish")
    .order("published_at", { ascending: false })
    .limit(20);
  if (q) request = request.ilike("title", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((a: any) => {
    const cats = Array.isArray(a.categories) ? a.categories : [];
    const category = cats.length > 0 ? cats[0].name ?? "" : "";
    const dateLabel = a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
    const readingTime = a.excerpt ? Math.max(1, Math.ceil(a.excerpt.split(/\s+/).length / 200)) : 1;
    return {
      id: a.id,
      slug: a.slug,
      type: "articles" as PickerEntityType,
      title: a.title ?? "Untitled",
      subtitle: a.excerpt ? a.excerpt.slice(0, 120) : "Article",
      imageUrl: a.hero_image_url ?? undefined,
      meta: [category, dateLabel].filter(Boolean).join(" · "),
      raw: {
        slug: a.slug,
        title: a.title ?? "Untitled",
        excerpt: a.excerpt ?? "",
        heroUrl: a.hero_image_url ?? undefined,
        author: a.author ?? undefined,
        published_at: a.published_at ?? undefined,
        readingTime,
        section: category || undefined,
      },
    };
  });
}

async function searchArtists(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase
    .from("registry_artists")
    .select("id, slug, display_name, bio, public_image_url, metadata")
    .eq("status", "active")
    .order("display_name")
    .limit(20);
  if (q) request = request.ilike("display_name", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((a: any) => {
    const meta = (a.metadata as Record<string, unknown>) ?? {};
    const genres = Array.isArray(meta.genres) ? (meta.genres as string[]).slice(0, 3).join(", ") : "";
    return {
      id: a.id,
      slug: a.slug,
      type: "artists" as PickerEntityType,
      title: a.display_name ?? "",
      subtitle: a.bio ? a.bio.slice(0, 100) : genres || "Artist",
      imageUrl: a.public_image_url ?? undefined,
      meta: genres,
      raw: {
        slug: a.slug,
        display_name: a.display_name ?? "",
        bio_excerpt: a.bio ? a.bio.slice(0, 160) + "..." : undefined,
        imageUrl: a.public_image_url ?? undefined,
      },
    };
  });
}

async function searchReleases(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase
    .from("registry_releases")
    .select("id, slug, title, release_type, release_date, artwork_url")
    .eq("status", "active")
    .order("release_date", { ascending: false })
    .limit(20);
  if (q) request = request.ilike("title", `%${q}%`);
  const { data } = await request;
  if (!data || data.length === 0) return [];
  const releaseIds = data.map((r: any) => r.id);
  const { data: artists } = await supabase
    .from("registry_release_artists")
    .select("release_id, artist_name_text")
    .in("release_id", releaseIds)
    .eq("is_primary", true)
    .eq("status", "active");
  const artistByRelease: Record<string, string> = {};
  (artists ?? []).forEach((a: any) => { if (!artistByRelease[a.release_id]) artistByRelease[a.release_id] = a.artist_name_text; });
  return data.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    type: "releases" as PickerEntityType,
    title: r.title ?? "",
    subtitle: artistByRelease[r.id] ?? "Unknown Artist",
    imageUrl: r.artwork_url ?? undefined,
    meta: `${r.release_type ?? "Release"} · ${r.release_date ? r.release_date.slice(0, 4) : ""}`,
    raw: {
      slug: r.slug,
      title: r.title ?? "",
      artist_name: artistByRelease[r.id] ?? "Unknown",
      type: r.release_type ?? "release",
      artwork_url: r.artwork_url ?? undefined,
      release_date: r.release_date ?? undefined,
    },
  }));
}

async function searchCharts(query: string): Promise<SearchResult[]> {
  const { data: editions } = await supabase
    .from("wk_chart_editions_v2")
    .select("id, slug")
    .eq("status", "published")
    .order("edition_date", { ascending: false })
    .limit(1);
  if (!editions || editions.length === 0) return [];
  const editionId = editions[0].id;
  const editionSlug = editions[0].slug;
  const q = query.trim();
  let request = supabase
    .from("wk_chart_entries_v2")
    .select("id, track_slug, track_title, artist_name, artwork_url, rank, movement, previous_rank")
    .eq("edition_id", editionId)
    .order("rank")
    .limit(40);
  if (q) request = request.or(`track_title.ilike.%${q}%,artist_name.ilike.%${q}%`);
  const { data } = await request;
  return (data ?? []).map((e: any) => {
    const movementAmount = e.previous_rank != null && e.previous_rank > 0 ? Math.abs(e.previous_rank - e.rank) : 0;
    return {
      id: e.id,
      slug: e.track_slug ?? "",
      type: "charts" as PickerEntityType,
      title: e.track_title ?? "",
      subtitle: e.artist_name ?? "",
      imageUrl: e.artwork_url ?? undefined,
      meta: `#${e.rank} · ${e.movement ?? "same"}`,
      raw: {
        slug: e.track_slug ?? "",
        track_title: e.track_title ?? "",
        artist_name: e.artist_name ?? "",
        rank: e.rank ?? 0,
        movement: e.movement ?? "same",
        movementAmount,
        artwork_url: e.artwork_url ?? undefined,
        edition_slug: editionSlug,
      },
    };
  });
}

async function searchGuides(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase
    .from("guides")
    .select("id, slug, title, excerpt, hero_url, status")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  if (q) request = request.ilike("title", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((g: any) => ({
    id: g.id,
    slug: g.slug,
    type: "guides" as PickerEntityType,
    title: g.title ?? "",
    subtitle: g.excerpt ? g.excerpt.slice(0, 120) : "Guide",
    imageUrl: g.hero_url ?? undefined,
    meta: "Guide",
    raw: {
      slug: g.slug,
      title: g.title ?? "",
      excerpt: g.excerpt ?? undefined,
      heroUrl: g.hero_url ?? undefined,
    },
  }));
}

async function doSearch(type: PickerEntityType, query: string): Promise<SearchResult[]> {
  try {
    switch (type) {
      case "articles": return await searchArticles(query);
      case "artists": return await searchArtists(query);
      case "releases": return await searchReleases(query);
      case "charts": return await searchCharts(query);
      case "guides": return await searchGuides(query);
      default: return [];
    }
  } catch (_e) { return []; }
}

// ── SearchPanel ──

function SearchPanel({
  searchType,
  onSelect,
  selectedIds,
}: {
  searchType: PickerEntityType;
  onSelect: (item: SearchResult) => void;
  selectedIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    setResults([]);
    setInitialLoaded(false);
    setQuery("");
  }, [searchType]);

  // Load default results on first show
  useEffect(() => {
    if (initialLoaded) return;
    setLoading(true);
    doSearch(searchType, "").then((r) => {
      setResults(r);
      setInitialLoaded(true);
    }).finally(() => setLoading(false));
  }, [searchType, initialLoaded]);

  useEffect(() => {
    if (!initialLoaded) return;
    const timer = setTimeout(() => {
      setLoading(true);
      doSearch(searchType, query).then(setResults).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchType, initialLoaded]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-[var(--wk-text-faint)]">
          <WkIcon name="Search" size={14} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ENTITY_TYPES.find((t) => t.key === searchType)?.label.toLowerCase() ?? "content"}...`}
          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] py-2 pl-9 pr-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] cursor-pointer"
          >
            <WkIcon name="X" size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {loading && (
          <div className="flex items-center justify-center py-10 gap-2 text-[13px] text-[var(--wk-text-muted)]">
            <span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={14} className="animate-spin" /></span>
            Searching...
          </div>
        )}
        {!loading && results.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[var(--wk-text-muted)]">
            {query ? `No results for "${query}"` : "Nothing found"}
          </div>
        )}
        {!loading && results.map((r) => {
          const isSelected = selectedIds.has(r.id);
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className={`w-full flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                  : "border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-bg)]"
              }`}
            >
              {r.imageUrl ? (
                <div className="w-9 h-9 flex-shrink-0 rounded-md overflow-hidden bg-[var(--wk-bg-subtle)]">
                  <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : r.type === "charts" && (r.raw.rank !== undefined) ? (
                <div className="w-9 h-9 flex-shrink-0 rounded-md bg-[var(--wk-brand)] text-white flex items-center justify-center font-black text-[12px]">
                  #{r.raw.rank}
                </div>
              ) : (
                <div className="w-9 h-9 flex-shrink-0 rounded-md bg-[var(--wk-bg-subtle)] flex items-center justify-center">
                  <WkIcon name={ENTITY_TYPES.find((t) => t.key === r.type)?.icon as any ?? "FileText"} size={14} className="text-[var(--wk-text-faint)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[var(--wk-text)] truncate leading-tight">{r.title}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{r.subtitle}</div>
                {r.meta && <div className="text-[10px] text-[var(--wk-text-faint)] mt-0.5">{r.meta}</div>}
              </div>
              <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]" : "border-[var(--wk-border)]"}`}>
                {isSelected && <WkIcon name="Check" size={10} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SectionEditor ──

function SectionEditor({
  section,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  section: Section;
  index: number;
  onUpdate: (s: Section) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const typeConfig = ENTITY_TYPES.find((t) => t.key === section.type);

  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--wk-bg)] border-b border-[var(--wk-border)]">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] ${typeConfig?.color ?? ""}`}>
          <WkIcon name={typeConfig?.icon as any ?? "FileText"} size={12} />
        </span>
        <input
          value={section.title}
          onChange={(e) => onUpdate({ ...section, title: e.target.value })}
          className="flex-1 bg-transparent text-[12px] font-bold text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none min-w-0"
          placeholder="Section title..."
        />
        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
          {/* Layout toggle */}
          <button
            onClick={() => onUpdate({ ...section, layout: section.layout === "list" ? "grid" : "list" })}
            className="flex items-center gap-1 rounded border border-[var(--wk-border)] px-2 py-1 text-[10px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-brand)] transition-all cursor-pointer whitespace-nowrap"
            title={`Switch to ${section.layout === "list" ? "grid" : "list"} layout`}
          >
            <WkIcon name={section.layout === "list" ? "LayoutGrid" : "List"} size={11} />
            {section.layout}
          </button>
          <button onClick={onMoveUp} disabled={isFirst} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer">
            <WkIcon name="ChevronUp" size={12} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer">
            <WkIcon name="ChevronDown" size={12} />
          </button>
          <button onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-red-500 cursor-pointer">
            <WkIcon name="Trash2" size={12} />
          </button>
        </div>
      </div>

      {/* Items */}
      {section.items.length === 0 ? (
        <div className="px-3 py-4 text-[11px] text-[var(--wk-text-faint)] text-center italic">
          No items yet — search and select content on the left
        </div>
      ) : (
        <div className="divide-y divide-[var(--wk-border)]">
          {section.items.map((item, itemIdx) => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--wk-text-faint)] w-4 shrink-0">{itemIdx + 1}</span>
              {item.imageUrl ? (
                <div className="w-7 h-7 shrink-0 rounded overflow-hidden">
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--wk-text)] truncate">{item.title}</div>
                <div className="text-[10px] text-[var(--wk-text-faint)] truncate">{item.subtitle}</div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => {
                    const newItems = [...section.items];
                    if (itemIdx > 0) { [newItems[itemIdx - 1], newItems[itemIdx]] = [newItems[itemIdx], newItems[itemIdx - 1]]; }
                    onUpdate({ ...section, items: newItems });
                  }}
                  disabled={itemIdx === 0}
                  className="flex h-5 w-5 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer"
                >
                  <WkIcon name="ChevronUp" size={10} />
                </button>
                <button
                  onClick={() => {
                    const newItems = [...section.items];
                    if (itemIdx < newItems.length - 1) { [newItems[itemIdx], newItems[itemIdx + 1]] = [newItems[itemIdx + 1], newItems[itemIdx]]; }
                    onUpdate({ ...section, items: newItems });
                  }}
                  disabled={itemIdx === section.items.length - 1}
                  className="flex h-5 w-5 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer"
                >
                  <WkIcon name="ChevronDown" size={10} />
                </button>
                <button
                  onClick={() => onUpdate({ ...section, items: section.items.filter((_, i) => i !== itemIdx) })}
                  className="flex h-5 w-5 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-red-500 cursor-pointer"
                >
                  <WkIcon name="X" size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item count */}
      <div className="px-3 py-1.5 border-t border-[var(--wk-border)] bg-[var(--wk-bg)]/50 flex items-center justify-between">
        <span className="text-[10px] text-[var(--wk-text-faint)]">{section.items.length} item{section.items.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

// ── Main ContentPicker ──

export interface ContentPickerOutput {
  sections: BriefingContentSection[];
  intro?: string;
  outro?: string;
}

interface ContentPickerProps {
  initialContent?: ContentPickerOutput | null;
  onChange: (content: ContentPickerOutput) => void;
}

export default function ContentPicker({ initialContent, onChange }: ContentPickerProps) {
  const [searchType, setSearchType] = useState<PickerEntityType>("articles");
  const [sections, setSections] = useState<Section[]>(() => {
    if (!initialContent?.sections) return [];
    return initialContent.sections.map((s, i) => ({
      id: `section-${i}-${s.type}`,
      title: s.title,
      type: s.type as PickerEntityType,
      layout: (s.layout ?? "list") as "list" | "grid",
      items: (s.items ?? []).map((item, j) => ({
        id: `item-${i}-${j}`,
        slug: item.slug ?? "",
        type: s.type as PickerEntityType,
        title: item.title ?? item.name ?? item.display_name ?? item.track_title ?? "",
        subtitle: item.artist ?? item.artist_name ?? item.author ?? "",
        imageUrl: item.imageUrl ?? item.image_url ?? item.artwork_url ?? item.heroUrl ?? item.hero_url ?? undefined,
        selected: true,
        raw: item,
      } as SearchResult & { selected: true })),
    }));
  });
  const [intro, setIntro] = useState(initialContent?.intro ?? "");
  const [outro, setOutro] = useState(initialContent?.outro ?? "");

  // IDs selected in current search type's sections
  const selectedIdsByType = useMemo(() => {
    const map: Record<PickerEntityType, Set<string>> = {
      articles: new Set(), artists: new Set(), releases: new Set(), charts: new Set(), guides: new Set(),
    };
    for (const section of sections) {
      if (!map[section.type]) map[section.type] = new Set();
      for (const item of section.items) map[section.type].add(item.id);
    }
    return map;
  }, [sections]);

  // Emit to parent on any change
  useEffect(() => {
    const output: ContentPickerOutput = {
      sections: sections.map((s) => ({
        title: s.title,
        type: s.type,
        layout: s.layout,
        items: s.items.map((i) => i.raw),
      })),
      intro: intro || undefined,
      outro: outro || undefined,
    };
    onChange(output);
  }, [sections, intro, outro]);

  const handleSelect = useCallback((item: SearchResult) => {
    setSections((prev) => {
      // Find or create a section for this type
      const targetSection = prev.find((s) => s.type === item.type);
      if (targetSection) {
        const alreadyIn = targetSection.items.some((i) => i.id === item.id);
        if (alreadyIn) {
          // Remove from section
          return prev.map((s) => s.id === targetSection.id
            ? { ...s, items: s.items.filter((i) => i.id !== item.id) }
            : s
          ).filter((s) => s.items.length > 0 || s.id !== targetSection.id);
        }
        // Add to existing section
        return prev.map((s) => s.id === targetSection.id
          ? { ...s, items: [...s.items, { ...item, selected: true } as SearchResult & { selected: true }] }
          : s
        );
      }
      // Create new section
      const newSection: Section = {
        id: `section-${Date.now()}-${item.type}`,
        title: defaultSectionTitle(item.type),
        type: item.type,
        layout: defaultLayoutForType(item.type),
        items: [{ ...item, selected: true } as SearchResult & { selected: true }],
      };
      return [...prev, newSection];
    });
  }, []);

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Intro / Outro fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-1.5 uppercase tracking-wide">Intro text</label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={2}
            placeholder="Opening note for this issue..."
            className="w-full resize-none rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-1.5 uppercase tracking-wide">Outro text</label>
          <textarea
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            rows={2}
            placeholder="Closing note for this issue..."
            className="w-full resize-none rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
          />
        </div>
      </div>

      {/* Two-column: search (left) + sections (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0" style={{ minHeight: "420px" }}>
        {/* Left: search */}
        <div className="lg:col-span-2 flex flex-col min-h-0 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          {/* Type tabs */}
          <div className="flex overflow-x-auto border-b border-[var(--wk-border)] bg-[var(--wk-bg)]">
            {ENTITY_TYPES.map((et) => (
              <button
                key={et.key}
                onClick={() => setSearchType(et.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer border-b-2 flex-shrink-0 ${
                  searchType === et.key
                    ? "border-[var(--wk-brand)] text-[var(--wk-brand)]"
                    : "border-transparent text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                }`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center">
                  <WkIcon name={et.icon as any} size={13} />
                </span>
                <span>{et.label}</span>
                {selectedIdsByType[et.key].size > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--wk-brand)] text-white text-[9px] font-bold px-1">
                    {selectedIdsByType[et.key].size}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 p-3 overflow-hidden flex flex-col min-h-0" style={{ maxHeight: "460px" }}>
            <SearchPanel
              searchType={searchType}
              onSelect={handleSelect}
              selectedIds={selectedIdsByType[searchType]}
            />
          </div>
        </div>

        {/* Right: sections */}
        <div className="lg:col-span-3 flex flex-col min-h-0 overflow-y-auto space-y-3 pr-0.5" style={{ maxHeight: "540px" }}>
          {sections.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-[var(--wk-border)] p-8 text-center text-[13px] text-[var(--wk-text-muted)]">
              <span className="flex h-8 w-8 items-center justify-center mx-auto mb-2 rounded-full bg-[var(--wk-bg-subtle)]">
                <WkIcon name="Layers" size={18} className="text-[var(--wk-text-faint)]" />
              </span>
              Search and select content on the left to build your issue.<br />
              Selected items appear here as sections.
            </div>
          )}
          {sections.map((section, idx) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
              onUpdate={(updated) => setSections((prev) => prev.map((s) => s.id === section.id ? updated : s))}
              onRemove={() => setSections((prev) => prev.filter((s) => s.id !== section.id))}
              onMoveUp={() => {
                if (idx > 0) {
                  setSections((prev) => {
                    const next = [...prev];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    return next;
                  });
                }
              }}
              onMoveDown={() => {
                setSections((prev) => {
                  const next = [...prev];
                  if (idx < next.length - 1) [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                  return next;
                });
              }}
            />
          ))}
        </div>
      </div>

      {/* Footer summary */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--wk-bg)] border border-[var(--wk-border)] text-[12px] text-[var(--wk-text-muted)]">
        <span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Layers" size={13} /></span>
        <span><strong className="text-[var(--wk-text)]">{sections.length}</strong> section{sections.length !== 1 ? "s" : ""}</span>
        <span className="text-[var(--wk-border-2)]">·</span>
        <span><strong className="text-[var(--wk-text)]">{totalItems}</strong> item{totalItems !== 1 ? "s" : ""} selected</span>
        {sections.length > 0 && (
          <>
            <span className="text-[var(--wk-border-2)]">·</span>
            {sections.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2 py-0.5 text-[11px]">
                <WkIcon name={ENTITY_TYPES.find((t) => t.key === s.type)?.icon as any ?? "FileText"} size={10} />
                {s.items.length}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}