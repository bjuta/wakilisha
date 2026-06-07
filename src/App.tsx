import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import "./index.css";

type AnyRecord = Record<string, unknown>;

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type ChartEdition = {
  id: string;
  title: string;
  slug: string;
  series: string;
  country: string;
  date: string;
  status: string;
  raw: AnyRecord;
};

type ChartEntry = {
  id: string;
  editionId: string;
  rank: number;
  previousRank: number | null;
  movement: string;
  trackSlug: string;
  trackTitle: string;
  artistSlug: string;
  artistName: string;
  artworkUrl: string;
  score: number | null;
  sourceEntryId: string;
};

type SurfaceReadiness = {
  surface: string;
  readiness: string;
  readiness_score: number;
  primary_count: number;
  support_count: number;
  caveat_count: number;
  recommendation: string;
};

type ImportSnapshot = {
  active_artists: number;
  active_tracks: number;
  active_releases: number;
  active_labels: number;
  chart_entries: number;
  chart_entry_canonical_track_links: number;
  active_canonical_media_assets: number;
  phase6_artist_structured_output_rows: number;
  unresolved_reference_or_review_rows: number;
  hard_error_rows: number;
};

const FALLBACK_COLORS = ["#85C441", "#111827", "#F5F1E8", "#FFB703", "#E76F51", "#2A9D8F", "#7C3AED"];

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function escapeSvgText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function placeholderImage(entityType: string, slug: string, title: string): string {
  const seed = `${entityType}:${slug || title || "wakilisha"}`;
  const hash = stableHash(seed);
  const color = FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  const dark = FALLBACK_COLORS[(hash + 2) % FALLBACK_COLORS.length];
  const initials = (title || slug || entityType || "W")
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "W";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${escapeSvgText(title || entityType)}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3" fill="rgba(255,255,255,.22)"/><path d="M0 80 80 0" stroke="rgba(255,255,255,.08)" stroke-width="3"/></pattern></defs><rect width="800" height="800" fill="url(#g)"/><rect width="800" height="800" fill="url(#p)"/><circle cx="640" cy="160" r="180" fill="rgba(255,255,255,.12)"/><circle cx="120" cy="680" r="220" fill="rgba(0,0,0,.12)"/><text x="50%" y="49%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="190" font-weight="900" fill="white" letter-spacing="-12">${escapeSvgText(initials)}</text><text x="50%" y="67%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="rgba(255,255,255,.82)" letter-spacing="6">WAKILISHA</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolveImage(input: {
  entityType: string;
  slug: string;
  title: string;
  artworkUrl?: string | null;
  mediaUrl?: string | null;
  externalUrl?: string | null;
}): string {
  return input.artworkUrl || input.mediaUrl || input.externalUrl || placeholderImage(input.entityType, input.slug, input.title);
}

function pickString(record: AnyRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function pickNumber(record: AnyRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function normalizeEdition(record: AnyRecord): ChartEdition {
  const id = pickString(record, ["id", "edition_id", "uuid"], crypto.randomUUID());
  const series = pickString(record, ["series_slug", "series", "chart_slug", "chart_series", "program_slug"], "wakilisha");
  const country = pickString(record, ["country_slug", "country", "country_iso2", "market", "market_slug"], "ke");
  const date = pickString(record, ["chart_date", "edition_date", "published_at", "date", "created_at"], "latest").slice(0, 10);
  const title = pickString(record, ["title", "name", "edition_title"], `${series.replaceAll("-", " ")} · ${country.toUpperCase()} · ${date}`);
  return {
    id,
    title,
    slug: pickString(record, ["slug", "edition_slug"], id),
    series,
    country,
    date,
    status: pickString(record, ["status"], "published"),
    raw: record,
  };
}

function normalizeEntry(record: AnyRecord): ChartEntry {
  const sourceEntryId = pickString(record, ["source_entry_id", "entry_id", "legacy_id", "id"], "");
  const title = pickString(record, ["track_title", "title", "name"], "Untitled track");
  const artist = pickString(record, ["artist_name", "artist", "artists"], "Unknown artist");
  return {
    id: pickString(record, ["id"], sourceEntryId || crypto.randomUUID()),
    editionId: pickString(record, ["edition_id"], ""),
    rank: pickNumber(record, ["rank", "position"]) || 0,
    previousRank: pickNumber(record, ["previous_rank", "previous_position"]),
    movement: pickString(record, ["movement"], "new"),
    trackSlug: pickString(record, ["track_slug"], title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")),
    trackTitle: title,
    artistSlug: pickString(record, ["artist_slug"], artist.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")),
    artistName: artist,
    artworkUrl: pickString(record, ["artwork_url", "image_url", "cover_url"], ""),
    score: pickNumber(record, ["score"]),
    sourceEntryId,
  };
}

async function fetchAll(): Promise<{
  snapshot: ImportSnapshot | null;
  readiness: SurfaceReadiness[];
  editions: ChartEdition[];
  entries: ChartEntry[];
}> {
  const [snapshotResult, readinessResult, editionsResult, entriesResult] = await Promise.all([
    supabase.from("phase7_global_import_closeout_snapshot").select("*").limit(1).maybeSingle(),
    supabase.from("phase7b_public_surface_readiness_snapshot").select("*").order("readiness_score", { ascending: false }),
    supabase.from("chart_editions").select("*").order("created_at", { ascending: false }).limit(24),
    supabase.from("chart_entries").select("*").order("rank", { ascending: true }).limit(1200),
  ]);

  const firstError = snapshotResult.error || readinessResult.error || editionsResult.error || entriesResult.error;
  if (firstError) throw new Error(firstError.message);

  return {
    snapshot: (snapshotResult.data as ImportSnapshot | null) || null,
    readiness: ((readinessResult.data || []) as AnyRecord[]).map((row) => ({
      surface: pickString(row, ["surface"]),
      readiness: pickString(row, ["readiness"]),
      readiness_score: pickNumber(row, ["readiness_score"]) || 0,
      primary_count: pickNumber(row, ["primary_count"]) || 0,
      support_count: pickNumber(row, ["support_count"]) || 0,
      caveat_count: pickNumber(row, ["caveat_count"]) || 0,
      recommendation: pickString(row, ["recommendation"]),
    })),
    editions: ((editionsResult.data || []) as AnyRecord[]).map(normalizeEdition),
    entries: ((entriesResult.data || []) as AnyRecord[]).map(normalizeEntry),
  };
}

function useWakilishaData(): LoadState<{
  snapshot: ImportSnapshot | null;
  readiness: SurfaceReadiness[];
  editions: ChartEdition[];
  entries: ChartEntry[];
}> {
  const [state, setState] = useState<LoadState<{ snapshot: ImportSnapshot | null; readiness: SurfaceReadiness[]; editions: ChartEdition[]; entries: ChartEntry[] }>>({
    data: { snapshot: null, readiness: [], editions: [], entries: [] },
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Failed to load WAKILISHA data" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" ? new Intl.NumberFormat("en").format(value) : "—";
}

function movementLabel(entry: ChartEntry): string {
  if (!entry.previousRank) return entry.movement || "new";
  const delta = entry.previousRank - entry.rank;
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return "—";
}

function useRoute(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wk-app-shell">
      <header className="wk-nav">
        <button className="wk-brand" onClick={() => navigate("/")}>
          <span className="wk-brand-mark">W</span>
          <span>
            <strong>WAKILISHA</strong>
            <small>Charts · Registry · Culture</small>
          </span>
        </button>
        <nav>
          <button onClick={() => navigate("/charts")}>Charts</button>
          <button onClick={() => navigate("/artists")}>Artists</button>
          <button onClick={() => navigate("/tracks")}>Tracks</button>
          <button onClick={() => navigate("/genres")}>Genres</button>
          <button onClick={() => navigate("/admin-review")}>Review</button>
        </nav>
      </header>
      {children}
    </div>
  );
}

function Home({ snapshot, readiness, entries }: { snapshot: ImportSnapshot | null; readiness: SurfaceReadiness[]; entries: ChartEntry[] }) {
  const heroEntries = entries.slice(0, 5);
  return (
    <main>
      <section className="wk-hero">
        <div className="wk-hero-copy">
          <p className="wk-eyebrow">Phase 8 / public build foundation</p>
          <h1>Charts are now the front door of WAKILISHA.</h1>
          <p>
            We are rebuilding around the imported registry: chart entries, canonical tracks, artists, media, fallback images, and review queues.
          </p>
          <div className="wk-hero-actions">
            <button className="wk-primary" onClick={() => navigate("/charts")}>Open charts</button>
            <button className="wk-secondary" onClick={() => navigate("/admin-review")}>Review backlog</button>
          </div>
        </div>
        <div className="wk-hero-stack">
          {heroEntries.map((entry) => (
            <article className="wk-hero-entry" key={entry.id}>
              <img src={resolveImage({ entityType: "chart-entry", slug: entry.sourceEntryId || entry.trackSlug, title: entry.trackTitle, artworkUrl: entry.artworkUrl })} alt="" />
              <span>#{entry.rank || "—"}</span>
              <div>
                <strong>{entry.trackTitle}</strong>
                <small>{entry.artistName}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="wk-stats-grid">
        <Stat label="Chart entries" value={snapshot?.chart_entries} />
        <Stat label="Canonical chart links" value={snapshot?.chart_entry_canonical_track_links} />
        <Stat label="Media assets" value={snapshot?.active_canonical_media_assets} />
        <Stat label="Hard errors" value={snapshot?.hard_error_rows} tone="good" />
      </section>

      <section className="wk-section">
        <div className="wk-section-head">
          <p className="wk-eyebrow">Surface readiness</p>
          <h2>Build order from the data</h2>
        </div>
        <div className="wk-surface-grid">
          {readiness.map((surface) => (
            <article className="wk-surface-card" key={surface.surface}>
              <div>
                <span className={`wk-status ${surface.readiness}`}>{surface.readiness.replaceAll("_", " ")}</span>
                <h3>{surface.surface}</h3>
              </div>
              <strong>{surface.readiness_score}</strong>
              <p>{surface.recommendation}</p>
              <small>{formatNumber(surface.primary_count)} primary · {formatNumber(surface.support_count)} support · {formatNumber(surface.caveat_count)} caveats</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | null | undefined; tone?: "good" }) {
  return (
    <article className={`wk-stat ${tone || ""}`}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  );
}

function ChartsPage({ editions, entries }: { editions: ChartEdition[]; entries: ChartEntry[] }) {
  const latest = entries.slice(0, 20);
  return (
    <main>
      <section className="wk-page-hero compact">
        <p className="wk-eyebrow">Public charts</p>
        <h1>The ranking layer for Kenyan and African music data.</h1>
        <p>Every card is wired to imported chart data. Missing images resolve through the central fallback framework.</p>
      </section>

      <section className="wk-section">
        <div className="wk-section-head split">
          <div>
            <p className="wk-eyebrow">Editions</p>
            <h2>Chart editions</h2>
          </div>
          <span>{formatNumber(editions.length)} loaded</span>
        </div>
        <div className="wk-edition-grid">
          {editions.map((edition, index) => (
            <button className="wk-edition-card" key={edition.id} onClick={() => navigate(`/charts/edition/${edition.id}`)}>
              <span>{edition.country.toUpperCase()}</span>
              <h3>{edition.title}</h3>
              <p>{edition.series.replaceAll("-", " ")} · {edition.date}</p>
              <strong>{index === 0 ? "Latest" : "Open"}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="wk-section">
        <div className="wk-section-head split">
          <div>
            <p className="wk-eyebrow">Latest ranking data</p>
            <h2>Chart pulse</h2>
          </div>
          <button className="wk-secondary" onClick={() => navigate(`/charts/edition/${latest[0]?.editionId || "latest"}`)}>Open latest</button>
        </div>
        <ChartTable entries={latest} />
      </section>
    </main>
  );
}

function ChartEditionPage({ editionId, editions, entries }: { editionId: string; editions: ChartEdition[]; entries: ChartEntry[] }) {
  const edition = editions.find((item) => item.id === editionId || item.slug === editionId);
  const editionEntries = entries.filter((entry) => entry.editionId === editionId).slice(0, 100);
  const fallbackEntries = editionEntries.length ? editionEntries : entries.slice(0, 100);
  return (
    <main>
      <section className="wk-page-hero compact">
        <p className="wk-eyebrow">Chart edition</p>
        <h1>{edition?.title || "Latest chart edition"}</h1>
        <p>{edition ? `${edition.series.replaceAll("-", " ")} · ${edition.country.toUpperCase()} · ${edition.date}` : "Showing the latest loaded ranking rows."}</p>
      </section>
      <section className="wk-section">
        <ChartTable entries={fallbackEntries} expanded />
      </section>
    </main>
  );
}

function ChartTable({ entries, expanded = false }: { entries: ChartEntry[]; expanded?: boolean }) {
  if (!entries.length) {
    return <div className="wk-empty">No chart rows loaded yet. The layout is ready; the data query returned empty.</div>;
  }
  return (
    <div className="wk-chart-list">
      {entries.map((entry) => (
        <article className="wk-chart-row" key={`${entry.id}-${entry.rank}`}>
          <div className="wk-rank">{entry.rank || "—"}</div>
          <img src={resolveImage({ entityType: "track", slug: entry.trackSlug || entry.sourceEntryId, title: entry.trackTitle, artworkUrl: entry.artworkUrl })} alt="" loading="lazy" />
          <div className="wk-track-main">
            <h3>{entry.trackTitle}</h3>
            <p>{entry.artistName}</p>
            {expanded && <small>{entry.trackSlug || "unresolved-track"} · source {entry.sourceEntryId || "—"}</small>}
          </div>
          <div className="wk-movement">{movementLabel(entry)}</div>
          <div className="wk-score">{entry.score ? entry.score.toFixed(0) : "—"}</div>
        </article>
      ))}
    </div>
  );
}

function PlaceholderSurface({ title, description, stat, support }: { title: string; description: string; stat?: number; support?: string }) {
  return (
    <main>
      <section className="wk-page-hero compact">
        <p className="wk-eyebrow">Phase 8 foundation</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      <section className="wk-section">
        <div className="wk-foundation-card">
          <img src={placeholderImage("surface", title, title)} alt="" />
          <div>
            <h2>{formatNumber(stat)} records ready</h2>
            <p>{support || "This surface is public-build-ready. The next implementation pass will add full directory, filters, detail pages, and Admin Review hooks."}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminReview({ snapshot }: { snapshot: ImportSnapshot | null }) {
  const backlog = snapshot?.unresolved_reference_or_review_rows || 233;
  const rows = [
    ["track_release_missing_reference_queue", 115],
    ["media_thumbnail_missing_reference_queue", 73],
    ["track_label_missing_reference_queue", 19],
    ["artist_genre_manual_unresolved", 9],
    ["phase6c_true_manual_review_after_audit", 9],
    ["release_label_missing_reference_queue", 8],
  ] as const;
  return (
    <main>
      <section className="wk-page-hero compact danger">
        <p className="wk-eyebrow">Required internal surface</p>
        <h1>Admin Review backlog</h1>
        <p>{formatNumber(backlog)} known review rows. These are not public blockers, but they must be visible to operators.</p>
      </section>
      <section className="wk-section">
        <div className="wk-review-list">
          {rows.map(([name, count]) => (
            <article key={name}>
              <strong>{count}</strong>
              <span>{name}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function App() {
  const route = useRoute();
  const { data, loading, error } = useWakilishaData();
  const editionId = useMemo(() => route.match(/^\/charts\/edition\/([^/]+)/)?.[1] || "", [route]);

  let content: React.ReactNode;
  if (loading) {
    content = <main><div className="wk-loading">Loading WAKILISHA registry data…</div></main>;
  } else if (error) {
    content = <main><div className="wk-error"><strong>Data load failed</strong><span>{error}</span></div></main>;
  } else if (route.startsWith("/charts/edition/")) {
    content = <ChartEditionPage editionId={editionId} editions={data.editions} entries={data.entries} />;
  } else if (route.startsWith("/charts")) {
    content = <ChartsPage editions={data.editions} entries={data.entries} />;
  } else if (route.startsWith("/artists")) {
    content = <PlaceholderSurface title="Artists" description="Artist profiles are ready for the next pass: metadata, images, related artists, top songs, highlights, genres, and countries." stat={data.snapshot?.active_artists} />;
  } else if (route.startsWith("/tracks")) {
    content = <PlaceholderSurface title="Tracks" description="Track surfaces are ready with caveats for release and label gaps. The directory can build now with Admin Review hooks." stat={data.snapshot?.active_tracks} />;
  } else if (route.startsWith("/genres")) {
    content = <PlaceholderSurface title="Genres" description="Genre pages are ready. Keep the small manual mapping residue in review." stat={27} />;
  } else if (route.startsWith("/media")) {
    content = <PlaceholderSurface title="Media foundation" description="Media is ready. Central image resolver and deterministic fallback placeholders are now part of the public shell." stat={data.snapshot?.active_canonical_media_assets} />;
  } else if (route.startsWith("/admin-review")) {
    content = <AdminReview snapshot={data.snapshot} />;
  } else {
    content = <Home snapshot={data.snapshot} readiness={data.readiness} entries={data.entries} />;
  }

  return <Shell>{content}</Shell>;
}

export default App;
