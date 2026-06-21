import { useState, useEffect, useCallback, useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import type { BriefingSectionItem, BriefingContentSection } from "@/services/briefingService";
import {
  EMAIL_BRIEFING_TEMPLATE_PROFILES,
  type BriefingTemplateSlug,
} from "@/services/emailBriefingTemplateProfiles";

// ── Types ──

export type PickerEntityType = "articles" | "artists" | "releases" | "charts" | "guides";

// Mapping from module name → entity type
const MODULE_TO_ENTITY: Record<string, PickerEntityType | null> = {
  featured_routes: "articles",
  lead_editorial: "articles",
  story_grid: "articles",
  quote_thread: "articles",
  field_notes: "articles",
  route_cards: "articles",
  memory_lead: "articles",
  language_cards: "articles",
  diaspora_lead: "articles",
  distance_cards: "articles",
  regional_lead: "articles",
  city_board: "articles",

  archive_reads: "guides",
  archive_routes: "guides",
  archive_threads: "guides",
  guide_hero: "guides",
  numbered_methods: "guides",
  memory_archive: "guides",
  regional_archive: "guides",

  chart_pulse: "charts",
  chart_lead: "charts",
  ranked_artwork_tiles: "charts",
  movement_board: "charts",
  archive_chart_route: "charts",
  chart_context: "releases",

  artist_motion: "artists",
  artist_wall: "artists",
  featured_artist: "artists",
  signal_tiles: "artists",
  new_voice_wall: "artists",
  spotlight_card: "artists",
  first_signal_tiles: "artists",
  cross_border_artists: "artists",
  roster_motion: "artists",

  release_lead: "releases",
  cover_grid: "releases",
  release_activity: "releases",

  keep_going: null,
  related_routes: null,
  artist_routes: null,
  discovery_routes: null,
  listen_read_routes: null,
  listen_read_go: null,
  save_routes: null,
  industry_routes: null,
  day_cards: null,
  admin_routes: null,
  label_cards: null,
  registry_stats: null,
  entity_change_cards: null,
  repair_notes: null,
  agenda_hero: null,
};

// For a given briefing template, what sections should admin fill by default?
export interface TemplateSectionDef {
  sectionType: PickerEntityType;
  label: string;          // UI display label
  moduleName: string;     // corresponding primary module from template profile
  hint: string;           // short description for admin
  required: boolean;
}

function getTemplateSections(slug: string): TemplateSectionDef[] {
  const profile = EMAIL_BRIEFING_TEMPLATE_PROFILES[(slug as BriefingTemplateSlug)];
  if (!profile) return getDefaultTemplateSections();

  const seen = new Set<PickerEntityType>();
  const defs: TemplateSectionDef[] = [];

  for (const mod of profile.primaryModules) {
    const entityType = MODULE_TO_ENTITY[mod];
    if (!entityType || seen.has(entityType)) continue;
    seen.add(entityType);
    defs.push(buildSectionDef(mod, entityType, profile.title));
  }

  // Always include at least one fallback if we got nothing
  if (defs.length === 0) return getDefaultTemplateSections();
  return defs;
}

function buildSectionDef(mod: string, entityType: PickerEntityType, _briefingTitle: string): TemplateSectionDef {
  const labelMap: Record<string, { label: string; hint: string }> = {
    featured_routes: { label: "Featured Stories", hint: "Pick 3-6 articles to lead the issue with. First item becomes the hero." },
    lead_editorial: { label: "Lead Story", hint: "The main editorial piece for this issue." },
    story_grid: { label: "Story Grid", hint: "Supporting articles shown in a 2-column card grid." },
    quote_thread: { label: "Quote / Pull-out", hint: "Articles whose excerpts will be used as pull quotes." },
    field_notes: { label: "Field Notes", hint: "Brief article notes for the field guides section." },
    archive_reads: { label: "Archive Reads", hint: "Older guides surfaced as archive picks." },
    archive_routes: { label: "Archive Routes", hint: "Guides or articles surfaced from the back-catalogue." },
    guide_hero: { label: "Featured Guide", hint: "A single guide shown as a large hero card." },
    numbered_methods: { label: "Methods / Steps", hint: "Guides shown as numbered step cards." },
    chart_pulse: { label: "Chart Highlights", hint: "Chart entries to include — first becomes the lead." },
    chart_lead: { label: "Chart Leader", hint: "Top chart entries — first becomes the full-bleed lead." },
    ranked_artwork_tiles: { label: "Ranked Tiles", hint: "Chart entries shown as artwork tiles with rank badges." },
    movement_board: { label: "Movement Board", hint: "Chart entries showing biggest movers this week." },
    artist_motion: { label: "Artist Motion", hint: "Artists shown in an image-first grid." },
    artist_wall: { label: "Artist Wall", hint: "Artists displayed as an image wall." },
    featured_artist: { label: "Featured Artist", hint: "A single spotlighted artist." },
    new_voice_wall: { label: "New Voices", hint: "Emerging artists shown with image and geography." },
    release_lead: { label: "New Releases", hint: "Releases shown as cover cards — first becomes the lead." },
    cover_grid: { label: "Cover Grid", hint: "Releases shown in a 3-column cover grid." },
    release_activity: { label: "Release Activity", hint: "Supporting releases shown as route tiles." },
    regional_lead: { label: "Regional Stories", hint: "Articles focused on the regional story." },
    cross_border_artists: { label: "Cross-border Artists", hint: "Artists from across the region shown as a wall." },
    diaspora_lead: { label: "Diaspora Stories", hint: "Articles that speak to diaspora themes." },
    memory_lead: { label: "Memory / Language Articles", hint: "Articles for the memory & language section." },
    label_cards: { label: "Label Cards", hint: "Labels shown as cards with roster context." },
    roster_motion: { label: "Roster Artists", hint: "Artists from the labels in this issue." },
    agenda_hero: { label: "Agenda Stories", hint: "Articles or event picks for the weekend agenda." },
  };

  const { label, hint } = labelMap[mod] ?? {
    label: mod.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    hint: `Content for the ${mod.replace(/_/g, " ")} section.`,
  };

  const typeLabels: Record<PickerEntityType, string> = {
    articles: "Stories", artists: "Artists", releases: "Releases", charts: "Charts", guides: "Guides",
  };

  return {
    sectionType: entityType,
    label,
    moduleName: mod,
    hint,
    required: true,
  };
}

function getDefaultTemplateSections(): TemplateSectionDef[] {
  return [
    { sectionType: "articles", label: "Stories", moduleName: "featured_routes", hint: "Pick articles to include in this issue.", required: true },
    { sectionType: "artists", label: "Artists", moduleName: "artist_motion", hint: "Pick artists to feature.", required: false },
    { sectionType: "releases", label: "Releases", moduleName: "release_lead", hint: "Pick releases to feature.", required: false },
  ];
}

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
  templateDef?: TemplateSectionDef; // if linked to a template section
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
      id: a.id, slug: a.slug, type: "articles" as PickerEntityType,
      title: a.title ?? "Untitled", subtitle: a.excerpt ? a.excerpt.slice(0, 120) : "Article",
      imageUrl: a.hero_image_url ?? undefined, meta: [category, dateLabel].filter(Boolean).join(" · "),
      raw: { slug: a.slug, title: a.title ?? "Untitled", excerpt: a.excerpt ?? "", heroUrl: a.hero_image_url ?? undefined, author: a.author ?? undefined, published_at: a.published_at ?? undefined, readingTime, section: category || undefined },
    };
  });
}

async function searchArtists(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase.from("registry_artists").select("id, slug, display_name, bio, public_image_url, metadata").eq("status", "active").order("display_name").limit(20);
  if (q) request = request.ilike("display_name", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((a: any) => {
    const meta = (a.metadata as Record<string, unknown>) ?? {};
    const genres = Array.isArray(meta.genres) ? (meta.genres as string[]).slice(0, 3).join(", ") : "";
    return {
      id: a.id, slug: a.slug, type: "artists" as PickerEntityType,
      title: a.display_name ?? "", subtitle: a.bio ? a.bio.slice(0, 100) : genres || "Artist",
      imageUrl: a.public_image_url ?? undefined, meta: genres,
      raw: { slug: a.slug, display_name: a.display_name ?? "", bio_excerpt: a.bio ? a.bio.slice(0, 160) + "..." : undefined, imageUrl: a.public_image_url ?? undefined },
    };
  });
}

async function searchReleases(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url").eq("status", "active").order("release_date", { ascending: false }).limit(20);
  if (q) request = request.ilike("title", `%${q}%`);
  const { data } = await request;
  if (!data || data.length === 0) return [];
  const releaseIds = data.map((r: any) => r.id);
  const { data: artists } = await supabase.from("registry_release_artists").select("release_id, artist_name_text").in("release_id", releaseIds).eq("is_primary", true).eq("status", "active");
  const artistByRelease: Record<string, string> = {};
  (artists ?? []).forEach((a: any) => { if (!artistByRelease[a.release_id]) artistByRelease[a.release_id] = a.artist_name_text; });
  return data.map((r: any) => ({
    id: r.id, slug: r.slug, type: "releases" as PickerEntityType,
    title: r.title ?? "", subtitle: artistByRelease[r.id] ?? "Unknown Artist",
    imageUrl: r.artwork_url ?? undefined, meta: `${r.release_type ?? "Release"} · ${r.release_date ? r.release_date.slice(0, 4) : ""}`,
    raw: { slug: r.slug, title: r.title ?? "", artist_name: artistByRelease[r.id] ?? "Unknown", type: r.release_type ?? "release", artwork_url: r.artwork_url ?? undefined, release_date: r.release_date ?? undefined },
  }));
}

async function searchCharts(query: string): Promise<SearchResult[]> {
  const { data: editions } = await supabase.from("wk_chart_editions_v2").select("id, slug").eq("status", "published").order("edition_date", { ascending: false }).limit(1);
  if (!editions || editions.length === 0) return [];
  const editionId = editions[0].id;
  const editionSlug = editions[0].slug;
  const q = query.trim();
  let request = supabase.from("wk_chart_entries_v2").select("id, track_slug, track_title, artist_name, artwork_url, rank, movement, previous_rank").eq("edition_id", editionId).order("rank").limit(40);
  if (q) request = request.or(`track_title.ilike.%${q}%,artist_name.ilike.%${q}%`);
  const { data } = await request;
  return (data ?? []).map((e: any) => {
    const movementAmount = e.previous_rank != null && e.previous_rank > 0 ? Math.abs(e.previous_rank - e.rank) : 0;
    return {
      id: e.id, slug: e.track_slug ?? "", type: "charts" as PickerEntityType,
      title: e.track_title ?? "", subtitle: e.artist_name ?? "",
      imageUrl: e.artwork_url ?? undefined, meta: `#${e.rank} · ${e.movement ?? "same"}`,
      raw: { slug: e.track_slug ?? "", track_title: e.track_title ?? "", artist_name: e.artist_name ?? "", rank: e.rank ?? 0, movement: e.movement ?? "same", movementAmount, artwork_url: e.artwork_url ?? undefined, edition_slug: editionSlug },
    };
  });
}

async function searchGuides(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  let request = supabase.from("guides").select("id, slug, title, excerpt, hero_url, status").eq("status", "published").order("created_at", { ascending: false }).limit(20);
  if (q) request = request.ilike("title", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((g: any) => ({
    id: g.id, slug: g.slug, type: "guides" as PickerEntityType,
    title: g.title ?? "", subtitle: g.excerpt ? g.excerpt.slice(0, 120) : "Guide",
    imageUrl: g.hero_url ?? undefined, meta: "Guide",
    raw: { slug: g.slug, title: g.title ?? "", excerpt: g.excerpt ?? undefined, heroUrl: g.hero_url ?? undefined },
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
  searchType, onSelect, selectedIds,
}: { searchType: PickerEntityType; onSelect: (item: SearchResult) => void; selectedIds: Set<string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => { setResults([]); setInitialLoaded(false); setQuery(""); }, [searchType]);

  useEffect(() => {
    if (initialLoaded) return;
    setLoading(true);
    doSearch(searchType, "").then((r) => { setResults(r); setInitialLoaded(true); }).finally(() => setLoading(false));
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
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ENTITY_TYPES.find((t) => t.key === searchType)?.label.toLowerCase() ?? "content"}...`}
          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] py-2 pl-9 pr-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] cursor-pointer">
            <WkIcon name="X" size={12} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {loading && <div className="flex items-center justify-center py-10 gap-2 text-[13px] text-[var(--wk-text-muted)]"><span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={14} className="animate-spin" /></span>Searching...</div>}
        {!loading && results.length === 0 && <div className="py-10 text-center text-[13px] text-[var(--wk-text-muted)]">{query ? `No results for "${query}"` : "Nothing found"}</div>}
        {!loading && results.map((r) => {
          const isSelected = selectedIds.has(r.id);
          return (
            <button key={r.id} onClick={() => onSelect(r)}
              className={`w-full flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${isSelected ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : "border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-bg)]"}`}
            >
              {r.imageUrl ? (
                <div className="w-9 h-9 flex-shrink-0 rounded-md overflow-hidden bg-[var(--wk-bg-subtle)]"><img src={r.imageUrl} alt="" className="w-full h-full object-cover" /></div>
              ) : r.type === "charts" && (r.raw.rank !== undefined) ? (
                <div className="w-9 h-9 flex-shrink-0 rounded-md bg-[var(--wk-brand)] text-white flex items-center justify-center font-black text-[12px]">#{r.raw.rank}</div>
              ) : (
                <div className="w-9 h-9 flex-shrink-0 rounded-md bg-[var(--wk-bg-subtle)] flex items-center justify-center"><WkIcon name={ENTITY_TYPES.find((t) => t.key === r.type)?.icon as any ?? "FileText"} size={14} className="text-[var(--wk-text-faint)]" /></div>
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
  section, index, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  section: Section; index: number;
  onUpdate: (s: Section) => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const typeConfig = ENTITY_TYPES.find((t) => t.key === section.type);
  const isTemplateBound = !!section.templateDef;

  return (
    <div className={`rounded-xl border overflow-hidden ${isTemplateBound ? "border-[var(--wk-brand)]/30 bg-[var(--wk-surface)]" : "border-[var(--wk-border)] bg-[var(--wk-surface)]"}`}>
      {/* Section header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-[var(--wk-border)] ${isTemplateBound ? "bg-[var(--wk-brand-soft)]/30" : "bg-[var(--wk-bg)]"}`}>
        {isTemplateBound && (
          <span className="flex-shrink-0 text-[var(--wk-brand)]">
            <WkIcon name="Layout" size={13} />
          </span>
        )}
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
          <button
            onClick={() => onUpdate({ ...section, layout: section.layout === "list" ? "grid" : "list" })}
            className="flex items-center gap-1 rounded border border-[var(--wk-border)] px-2 py-1 text-[10px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-brand)] transition-all cursor-pointer whitespace-nowrap"
            title={`Switch to ${section.layout === "list" ? "grid" : "list"} layout`}
          >
            <WkIcon name={section.layout === "list" ? "LayoutGrid" : "List"} size={11} />
            {section.layout}
          </button>
          <button onClick={onMoveUp} disabled={isFirst} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer"><WkIcon name="ChevronUp" size={12} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer"><WkIcon name="ChevronDown" size={12} /></button>
          <button onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-red-500 cursor-pointer"><WkIcon name="Trash2" size={12} /></button>
        </div>
      </div>

      {/* Template hint */}
      {isTemplateBound && section.templateDef && section.items.length === 0 && (
        <div className="px-3 py-2 bg-[var(--wk-brand-soft)]/20 border-b border-[var(--wk-border)] flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5 text-[var(--wk-brand)]"><WkIcon name="Info" size={12} /></span>
          <span className="text-[11px] text-[var(--wk-brand)] opacity-80">{section.templateDef.hint}</span>
        </div>
      )}

      {/* Items */}
      {section.items.length === 0 ? (
        <div className="px-3 py-4 text-[11px] text-[var(--wk-text-faint)] text-center italic">
          {isTemplateBound
            ? `← Search ${ENTITY_TYPES.find((t) => t.key === section.type)?.label.toLowerCase() ?? "content"} on the left and click to add items here`
            : "No items yet — search and select content on the left"}
        </div>
      ) : (
        <div className="divide-y divide-[var(--wk-border)]">
          {section.items.map((item, itemIdx) => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2">
              <span className="text-[10px] font-bold text-[var(--wk-text-faint)] w-4 shrink-0">{itemIdx + 1}</span>
              {item.imageUrl && <div className="w-7 h-7 shrink-0 rounded overflow-hidden"><img src={item.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--wk-text)] truncate">{item.title}</div>
                <div className="text-[10px] text-[var(--wk-text-faint)] truncate">{item.subtitle}</div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => { const ni = [...section.items]; if (itemIdx > 0) { [ni[itemIdx - 1], ni[itemIdx]] = [ni[itemIdx], ni[itemIdx - 1]]; } onUpdate({ ...section, items: ni }); }} disabled={itemIdx === 0} className="flex h-5 w-5 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer"><WkIcon name="ChevronUp" size={10} /></button>
                <button onClick={() => { const ni = [...section.items]; if (itemIdx < ni.length - 1) { [ni[itemIdx], ni[itemIdx + 1]] = [ni[itemIdx + 1], ni[itemIdx]]; } onUpdate({ ...section, items: ni }); }} disabled={itemIdx === section.items.length - 1} className="flex h-5 w-5 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] disabled:opacity-30 cursor-pointer"><WkIcon name="ChevronDown" size={10} /></button>
                <button onClick={() => onUpdate({ ...section, items: section.items.filter((_, i) => i !== itemIdx) })} className="flex h-5 w-5 items-center justify-center rounded text-[var(--wk-text-faint)] hover:text-red-500 cursor-pointer"><WkIcon name="X" size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-[var(--wk-border)] bg-[var(--wk-bg)]/50 flex items-center justify-between">
        <span className="text-[10px] text-[var(--wk-text-faint)]">{section.items.length} item{section.items.length !== 1 ? "s" : ""}</span>
        {isTemplateBound && (
          <span className="text-[10px] text-[var(--wk-brand)] font-semibold opacity-70">Template section</span>
        )}
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
  briefingSlug?: string;
}

export default function ContentPicker({ initialContent, onChange, briefingSlug }: ContentPickerProps) {
  const [searchType, setSearchType] = useState<PickerEntityType>("articles");
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);

  const templateSections = useMemo(() => {
    if (!briefingSlug) return getDefaultTemplateSections();
    return getTemplateSections(briefingSlug);
  }, [briefingSlug]);

  const buildInitialSections = useCallback((): Section[] => {
    // If editing an existing issue, restore its sections
    if (initialContent?.sections && initialContent.sections.length > 0) {
      return initialContent.sections.map((s, i) => {
        const matchingDef = templateSections.find((td) => td.sectionType === s.type);
        return {
          id: `section-${i}-${s.type}`,
          title: s.title,
          type: s.type as PickerEntityType,
          layout: (s.layout ?? "list") as "list" | "grid",
          templateDef: matchingDef,
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
        };
      });
    }

    // New issue: scaffold template sections as empty placeholders
    return templateSections.map((def, i) => ({
      id: `template-${i}-${def.sectionType}`,
      title: def.label,
      type: def.sectionType,
      layout: defaultLayoutForType(def.sectionType),
      templateDef: def,
      items: [],
    }));
  }, [initialContent, templateSections]);

  const [sections, setSections] = useState<Section[]>(buildInitialSections);
  const [intro, setIntro] = useState(initialContent?.intro ?? "");
  const [outro, setOutro] = useState(initialContent?.outro ?? "");

  // When briefingSlug changes (admin selects a different briefing for a new issue),
  // rebuild the template scaffolding — but only for new issues
  useEffect(() => {
    if (initialContent?.sections && initialContent.sections.length > 0) return; // editing
    setSections(buildInitialSections());
  }, [briefingSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set target section based on current searchType tab
  useEffect(() => {
    const matching = sections.find((s) => s.type === searchType);
    if (matching) setTargetSectionId(matching.id);
    else setTargetSectionId(null);
  }, [searchType, sections]);

  // IDs selected per type
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

  // Emit changes
  useEffect(() => {
    const nonEmpty = sections.filter((s) => s.items.length > 0);
    const output: ContentPickerOutput = {
      sections: nonEmpty.map((s) => ({ title: s.title, type: s.type, layout: s.layout, items: s.items.map((i) => i.raw) })),
      intro: intro || undefined,
      outro: outro || undefined,
    };
    onChange(output);
  }, [sections, intro, outro]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((item: SearchResult) => {
    setSections((prev) => {
      // Prefer targetSectionId if set and matches the type
      const target = targetSectionId ? prev.find((s) => s.id === targetSectionId && s.type === item.type) : null;
      const fallbackSection = prev.find((s) => s.type === item.type);
      const destSection = target ?? fallbackSection;

      if (destSection) {
        const alreadyIn = destSection.items.some((i) => i.id === item.id);
        if (alreadyIn) {
          return prev.map((s) => s.id === destSection.id ? { ...s, items: s.items.filter((i) => i.id !== item.id) } : s);
        }
        return prev.map((s) => s.id === destSection.id ? { ...s, items: [...s.items, { ...item, selected: true } as SearchResult & { selected: true }] } : s);
      }

      // No section of this type yet — create one
      const newSection: Section = {
        id: `section-${Date.now()}-${item.type}`,
        title: ENTITY_TYPES.find((t) => t.key === item.type)?.label ?? item.type,
        type: item.type,
        layout: defaultLayoutForType(item.type),
        items: [{ ...item, selected: true } as SearchResult & { selected: true }],
      };
      return [...prev, newSection];
    });
  }, [targetSectionId]);

  const handleAddCustomSection = () => {
    const newSection: Section = {
      id: `custom-${Date.now()}`,
      title: "Custom Section",
      type: searchType,
      layout: defaultLayoutForType(searchType),
      items: [],
    };
    setSections((prev) => [...prev, newSection]);
    setTargetSectionId(newSection.id);
  };

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const nonEmptySections = sections.filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-4">

      {/* Template notice banner */}
      {briefingSlug && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/20 px-3 py-2.5">
          <span className="flex-shrink-0 mt-0.5 text-[var(--wk-brand)]"><WkIcon name="Layout" size={14} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-[var(--wk-brand)]">
              {EMAIL_BRIEFING_TEMPLATE_PROFILES[(briefingSlug as BriefingTemplateSlug)]?.title ?? briefingSlug} — custom sections pre-loaded
            </div>
            <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">
              Each section below matches this briefing&apos;s template. Click a tab on the left, search for content, then click items to add them. You can also add extra sections using the button below.
            </div>
          </div>
        </div>
      )}

      {/* Intro / Outro */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-1.5 uppercase tracking-wide">Intro text</label>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="Opening note for this issue..." className="w-full resize-none rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-1.5 uppercase tracking-wide">Outro text</label>
          <textarea value={outro} onChange={(e) => setOutro(e.target.value)} rows={2} placeholder="Closing note for this issue..." className="w-full resize-none rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: "480px" }}>

        {/* Left: search panel */}
        <div className="lg:col-span-2 flex flex-col min-h-0 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">

          {/* Type tabs */}
          <div className="flex overflow-x-auto border-b border-[var(--wk-border)] bg-[var(--wk-bg)]">
            {ENTITY_TYPES.map((et) => (
              <button
                key={et.key} onClick={() => setSearchType(et.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer border-b-2 flex-shrink-0 ${searchType === et.key ? "border-[var(--wk-brand)] text-[var(--wk-brand)]" : "border-transparent text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"}`}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name={et.icon as any} size={13} /></span>
                <span>{et.label}</span>
                {selectedIdsByType[et.key].size > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--wk-brand)] text-white text-[9px] font-bold px-1">{selectedIdsByType[et.key].size}</span>
                )}
              </button>
            ))}
          </div>

          {/* Target section selector (if multiple of same type) */}
          {sections.filter((s) => s.type === searchType).length > 1 && (
            <div className="px-3 py-2 border-b border-[var(--wk-border)] bg-[var(--wk-bg)]/60">
              <label className="text-[10px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide block mb-1">Add to section:</label>
              <div className="flex flex-wrap gap-1">
                {sections.filter((s) => s.type === searchType).map((s) => (
                  <button
                    key={s.id} onClick={() => setTargetSectionId(s.id)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${targetSectionId === s.id ? "bg-[var(--wk-brand)] text-white" : "bg-[var(--wk-bg)] border border-[var(--wk-border)] text-[var(--wk-text-muted)]"}`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 p-3 overflow-hidden flex flex-col min-h-0" style={{ maxHeight: "440px" }}>
            <SearchPanel searchType={searchType} onSelect={handleSelect} selectedIds={selectedIdsByType[searchType]} />
          </div>
        </div>

        {/* Right: sections */}
        <div className="lg:col-span-3 flex flex-col min-h-0 gap-3 overflow-y-auto pr-0.5" style={{ maxHeight: "560px" }}>
          {sections.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-[var(--wk-border)] p-8 text-center text-[13px] text-[var(--wk-text-muted)]">
              <span className="flex h-8 w-8 items-center justify-center mx-auto mb-2 rounded-full bg-[var(--wk-bg-subtle)]"><WkIcon name="Layers" size={18} className="text-[var(--wk-text-faint)]" /></span>
              Search and select content on the left to build your issue.
            </div>
          )}
          {sections.map((section, idx) => (
            <SectionEditor
              key={section.id} section={section} index={idx}
              isFirst={idx === 0} isLast={idx === sections.length - 1}
              onUpdate={(updated) => setSections((prev) => prev.map((s) => s.id === section.id ? updated : s))}
              onRemove={() => setSections((prev) => prev.filter((s) => s.id !== section.id))}
              onMoveUp={() => setSections((prev) => { const next = [...prev]; if (idx > 0) [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; })}
              onMoveDown={() => setSections((prev) => { const next = [...prev]; if (idx < next.length - 1) [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next; })}
            />
          ))}

          {/* Add custom section */}
          <button
            onClick={handleAddCustomSection}
            className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[var(--wk-border)] p-3 text-[12px] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all cursor-pointer"
          >
            <span className="flex h-5 w-5 items-center justify-center"><WkIcon name="Plus" size={14} /></span>
            Add custom {ENTITY_TYPES.find((t) => t.key === searchType)?.label.toLowerCase() ?? "section"} section
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--wk-bg)] border border-[var(--wk-border)] text-[12px] text-[var(--wk-text-muted)]">
        <span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Layers" size={13} /></span>
        <span><strong className="text-[var(--wk-text)]">{nonEmptySections.length}</strong> populated section{nonEmptySections.length !== 1 ? "s" : ""}</span>
        <span className="text-[var(--wk-border-2)]">·</span>
        <span><strong className="text-[var(--wk-text)]">{totalItems}</strong> item{totalItems !== 1 ? "s" : ""}</span>
        {sections.filter((s) => s.items.length === 0 && s.templateDef).length > 0 && (
          <>
            <span className="text-[var(--wk-border-2)]">·</span>
            <span className="text-amber-600">{sections.filter((s) => s.items.length === 0 && s.templateDef).length} empty template section{sections.filter((s) => s.items.length === 0 && s.templateDef).length !== 1 ? "s" : ""}</span>
          </>
        )}
        {nonEmptySections.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2 py-0.5 text-[11px]">
            <WkIcon name={ENTITY_TYPES.find((t) => t.key === s.type)?.icon as any ?? "FileText"} size={10} />
            {s.items.length}
          </span>
        ))}
      </div>
    </div>
  );
}