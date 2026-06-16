import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getTrack, type RepairedTrackDetail } from "@/services/repaired/client";
import { buildTrackSummaryFromApi } from "@/services/registryNlg";
import { TrackChartHistorySection } from "@/components/charts/TrackChartHistory";

/* ─── Types ─── */

type TrackChartAppearance = {
  editionSlug?: string;
  editionLabel?: string;
  date?: string;
  rank?: number;
  previousRank?: number | null;
  movement?: string;
  weeksOnChart?: number;
};

type TrackViewModel = {
  slug: string;
  title: string;
  artist: string;
  artistSlug: string;
  artists: Array<{
    name: string; slug: string; isPrimary: boolean; isFeatured: boolean;
    creditOrder: number; role: string;
  }>;
  genre: string;
  genreSlug: string;
  label: string;
  labelSlug: string;
  rank: number;
  peakPosition: number;
  weeksOnChart: number;
  movement: "up" | "down" | "new" | "same";
  movementAmount: number;
  previousWeek: number | null;
  artworkUrl: string;
  duration: number;
  releaseYear: string;
  releaseDate: string;
  isPlayable: boolean;
  previewUrl: string | null;
  albumTitle: string;
  albumSlug: string;
  albumTrackNumber: number;
  albumTotalTracks: number;
  credits: Array<{ role: string; name: string }>;
  chartHistory: number[];
  chartAppearances: TrackChartAppearance[];
  chartAppearanceCount: number;
  lyrics: string | null;
  lyricsContributor: { name: string; source?: string } | null;
  artistImage: string;
  isrc: string | null;
  explicit: boolean;
  isStandalone: boolean;
  firstChartedDate: string;
  editionLabels: string[];
  sourceProviders: string[];
};

/* ─── ViewModel builder ─── */

function apiToViewModel(api: RepairedTrackDetail): TrackViewModel {
  const raw = api as any;
  const trackData = raw.track ?? raw;
  const artistData = raw.artist ?? {};
  const releaseData = raw.release ?? trackData.release ?? null;
  const labelData = raw.label ?? null;

  const artistsArr: TrackViewModel["artists"] = Array.isArray(raw.artists) && raw.artists.length > 0
    ? raw.artists.map((a: any) => ({
        name: a.name || a.artist_name_text || "",
        slug: a.slug || a.artist_slug || "",
        isPrimary: Boolean(a.isPrimary ?? a.is_primary),
        isFeatured: Boolean(a.isFeatured ?? a.is_featured),
        creditOrder: Number(a.creditOrder ?? a.credit_order ?? 0),
        role: a.role || "primary",
      }))
    : [];

  const primaryArtist = artistsArr.find((a) => a.isPrimary) || artistsArr[0];
  const artistName = primaryArtist?.name || artistData.name || "WAKILISHA Registry";
  const resolvedArtistSlug = primaryArtist?.slug || artistData.slug || "";

  const history = Array.isArray(raw.chartHistory) ? raw.chartHistory : [];
  const chartAppearances = Array.isArray(raw.chartAppearances) ? raw.chartAppearances : [];
  const currentRank = raw.currentRank ?? 0;
  const prevRank = raw.previousRank ?? (history.length > 1 ? history[history.length - 2] : 0);

  const rawMovement = String(raw.movement || "").toLowerCase();
  let movement: TrackViewModel["movement"] = ["up", "down", "new", "same"].includes(rawMovement)
    ? (rawMovement as TrackViewModel["movement"])
    : "same";
  let movementAmount = Number(raw.movementAmount ?? 0) || 0;
  if (!rawMovement) {
    if (!prevRank || prevRank <= 0) movement = "new";
    else if (currentRank > 0 && currentRank < prevRank) { movement = "up"; movementAmount = prevRank - currentRank; }
    else if (currentRank > 0 && currentRank > prevRank) { movement = "down"; movementAmount = currentRank - prevRank; }
  }

  const primaryGenre = api.genres && api.genres.length > 0 ? api.genres[0].name : "";
  const primaryGenreSlug = api.genres && api.genres.length > 0 ? api.genres[0].slug : "";
  const duration = trackData.durationMs ? Math.round(trackData.durationMs / 1000) : (trackData.duration || 0);
  const artworkUrl = trackData.artworkUrl || releaseData?.artworkUrl || artistData?.imageUrl || "";
  const previewUrl: string | null = api.previewUrl || trackData.previewUrl || null;
  const albumTitle = releaseData?.title || "";
  const rawAlbumSlug = releaseData?.slug || "";
  const albumSlug = rawAlbumSlug.includes('--') ? rawAlbumSlug : (rawAlbumSlug ? `${resolvedArtistSlug}--${rawAlbumSlug}` : "");
  const albumTrackNumber = trackData.trackNumber || trackData.track_number || 0;
  const albumTotalTracks = releaseData?.trackCount || 0;
  const releaseFullDate = releaseData?.releaseDate || "";

  return {
    slug: trackData.slug,
    title: trackData.title,
    artist: artistName,
    artistSlug: resolvedArtistSlug,
    artists: artistsArr,
    genre: primaryGenre,
    genreSlug: primaryGenreSlug,
    label: labelData?.name || releaseData?.labelName || "",
    labelSlug: labelData?.slug || releaseData?.labelSlug || "",
    rank: currentRank,
    peakPosition: raw.peakRank ?? currentRank,
    weeksOnChart: raw.weeksOnChart ?? history.length ?? 0,
    movement, movementAmount,
    previousWeek: prevRank > 0 ? prevRank : null,
    artworkUrl, duration,
    releaseYear: releaseFullDate ? releaseFullDate.split("-")[0] : "",
    releaseDate: releaseFullDate,
    isPlayable: !!previewUrl,
    previewUrl,
    albumTitle, albumSlug, albumTrackNumber, albumTotalTracks,
    credits: [],
    chartHistory: history,
    chartAppearances,
    chartAppearanceCount: Number(raw.chartAppearanceCount ?? chartAppearances.length ?? 0),
    lyrics: null,
    lyricsContributor: null,
    artistImage: artistData.imageUrl || "",
    isrc: trackData.isrc || null,
    explicit: Boolean(trackData.explicit),
    isStandalone: !releaseData,
    firstChartedDate: raw.firstChartedDate || "",
    editionLabels: Array.isArray(raw.editionLabels) ? raw.editionLabels : [],
    sourceProviders: Array.isArray(raw.sourceProviders) ? raw.sourceProviders : [],
    source: "WAKILISHA Registry",
    streamCount: null,
    streamingLinks: [],
  };
}

/* ─── Helpers ─── */

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch { return dateStr; }
}

function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/* ─── Sub-components ─── */

/* ─── Artist chip for hero ─── */

function ArtistChip({ artist, isPrimary }: { artist: TrackViewModel["artists"][0]; isPrimary: boolean }) {
  if (!artist.slug) return (
    <span className="text-[15px] md:text-[17px] font-semibold text-white/70">{artist.name}</span>
  );
  return (
    <Link
      to={`/artists/${artist.slug}`}
      className="inline-flex items-center gap-1.5 text-[15px] md:text-[17px] font-semibold text-white/80 hover:text-white transition-colors group/artist"
    >
      {isPrimary && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)] opacity-70 group-hover/artist:opacity-100 transition-opacity" />
      )}
      {artist.name}
      {artist.isFeatured && (
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/35 ml-0.5">feat.</span>
      )}
    </Link>
  );
}

/* ─── Provenance spec bar ─── */

function ProvenanceBar({ vm }: { vm: TrackViewModel }) {
  const specs: Array<{ label: string; value: React.ReactNode; icon: string }> = [];

  if (vm.releaseDate) {
    specs.push({ label: "Released", value: formatDate(vm.releaseDate), icon: "ri-calendar-line" });
  }
  if (vm.albumTitle) {
    specs.push({
      label: "Release",
      value: vm.albumSlug
        ? <Link to={`/releases/${vm.albumSlug}`} className="hover:text-[var(--wk-brand)] transition-colors">{vm.albumTitle}</Link>
        : vm.albumTitle,
      icon: "ri-album-line",
    });
  }
  if (vm.albumTrackNumber > 0 && vm.albumTotalTracks > 0) {
    specs.push({ label: "Track", value: `${vm.albumTrackNumber} of ${vm.albumTotalTracks}`, icon: "ri-play-list-2-line" });
  }
  if (vm.label && vm.label !== "Unknown") {
    specs.push({
      label: "Label",
      value: vm.labelSlug
        ? <Link to={`/labels/${vm.labelSlug}`} className="hover:text-[var(--wk-brand)] transition-colors">{vm.label}</Link>
        : vm.label,
      icon: "ri-disc-line",
    });
  }
  if (vm.genre && vm.genre !== "Unknown") {
    specs.push({
      label: "Genre",
      value: vm.genreSlug
        ? <Link to={`/genres/${vm.genreSlug}`} className="hover:text-[var(--wk-brand)] transition-colors">{vm.genre}</Link>
        : vm.genre,
      icon: "ri-price-tag-3-line",
    });
  }
  if (vm.isrc) {
    specs.push({ label: "ISRC", value: <span className="font-mono text-[12px] tracking-wider">{vm.isrc}</span>, icon: "ri-barcode-line" });
  }
  if (vm.duration > 0) {
    specs.push({ label: "Duration", value: formatDuration(vm.duration), icon: "ri-timer-line" });
  }
  if (vm.explicit) {
    specs.push({ label: "Advisory", value: <span className="text-[var(--wk-danger)] font-bold uppercase text-[11px]">Explicit</span>, icon: "ri-alert-line" });
  }
  if (vm.sourceProviders.length > 0) {
    specs.push({ label: "Sources", value: humanList(vm.sourceProviders), icon: "ri-database-2-line" });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-border)]">
      {specs.map((spec) => (
        <div key={spec.label} className="flex flex-col gap-1 bg-[var(--wk-surface)] px-4 py-3.5">
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            <i className={`${spec.icon} text-[11px]`} />
            {spec.label}
          </span>
          <span className="text-[13px] font-bold text-[var(--wk-text)] leading-snug">{spec.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Curator's Note (NLG Summary) ─── */

function CuratorsNote({ apiData }: { apiData: RepairedTrackDetail }) {
  const { artists = [], release, genres, chartHistory, peakRank, weeksOnChart, firstChartedDate, editionLabels, sourceProviders } = apiData;

  const artistsForNlg = artists.map((a) => ({
    name: a.name, slug: a.slug, isPrimary: a.isPrimary, isFeatured: a.isFeatured, creditOrder: a.creditOrder,
  }));

  const releaseForNlg = release ? {
    title: release.title, slug: release.slug, releaseDate: release.releaseDate,
    releaseType: release.releaseType, trackCount: release.trackCount,
    labelName: release.labelName, labelSlug: release.labelSlug,
  } : null;

  const chartCtx = (peakRank && peakRank > 0) || weeksOnChart > 0 ? {
    peakRank: peakRank || 0, weeksOnChart,
    firstChartedDate: firstChartedDate || "",
    appearances: chartHistory.length,
    editionLabels: editionLabels || [],
  } : null;

  const summary = buildTrackSummaryFromApi(
    {
      title: apiData.track.title,
      durationMs: apiData.track.durationMs,
      isrc: apiData.track.isrc,
      explicit: apiData.track.explicit,
      trackNumber: apiData.track.trackNumber,
      previewUrl: (apiData.track as any).previewUrl,
    },
    artistsForNlg,
    releaseForNlg,
    genres.map((g) => g.name),
    chartCtx,
    sourceProviders || [],
  );

  if (!summary) return null;

  const firstChar = summary.charAt(0);
  const rest = summary.slice(1);

  return (
    <div className="max-w-[680px]">
      <p className="text-[18px] md:text-[20px] leading-[1.85] text-[var(--wk-text-soft)]">
        <span
          className="float-left mr-4 font-black leading-[0.75] text-[var(--wk-brand)]"
          style={{ fontSize: "clamp(64px, 8vw, 88px)", marginTop: "0.02em" }}
        >
          {firstChar}
        </span>
        <span>{rest}</span>
      </p>
      <div className="mt-6 pt-4 border-t border-[var(--wk-divider)]">
        <p className="text-[11px] text-[var(--wk-text-faint)] italic leading-relaxed">
          Generated from the WAKILISHA relationship graph. A deterministic summary drawn from connected registry data — artists, releases, chart performance, genres, labels, and source providers.
        </p>
      </div>
    </div>
  );
}

/* ─── Artist Gallery ─── */

function ArtistGallery({ artists, artworkUrl }: { artists: TrackViewModel["artists"]; artworkUrl: string }) {
  if (!artists || artists.length === 0) return null;

  const primary = artists.filter((a) => a.isPrimary);
  const featured = artists.filter((a) => a.isFeatured && !a.isPrimary);
  const others = artists.filter((a) => !a.isPrimary && !a.isFeatured);

  const allGroups = [
    { label: "Primary Artist", items: primary },
    { label: "Featured", items: featured },
    { label: "Also Credited", items: others },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {allGroups.map((group) => (
        <div key={group.label}>
          <div className="mb-3 flex items-center gap-2">
            <span className="w-1 h-3 rounded-full bg-[var(--wk-brand)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">
              {group.label}
            </span>
          </div>
          <div className="space-y-2">
            {group.items.map((a) => (
              <Link
                key={a.slug}
                to={a.slug ? `/artists/${a.slug}` : "#"}
                className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all duration-300 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)] hover:-translate-y-0.5"
              >
                <div className="relative flex-shrink-0 h-14 w-14 rounded-full overflow-hidden bg-[var(--wk-surface-raised)] ring-2 ring-[var(--wk-border)] group-hover:ring-[var(--wk-brand)]/30 transition-all">
                  {a.isPrimary && artworkUrl ? (
                    <img src={artworkUrl} alt={a.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <i className="ri-user-line text-[var(--wk-text-faint)] text-xl" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
                    {a.name}
                  </div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    {a.role === "primary" ? "Primary artist" : a.role === "featured" ? "Featured artist" : "Collaborator"}
                  </div>
                </div>
                <i className="ri-arrow-right-line text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] group-hover:translate-x-0.5 transition-all text-[14px]" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Chart KPIs ─── */

function ChartKpiGrid({ vm }: { vm: TrackViewModel }) {
  const kpis = [
    { label: "Peak position", value: vm.peakPosition > 0 ? `#${vm.peakPosition}` : "—", sub: "All-time best", icon: "ri-trophy-line" },
    { label: "Weeks charted", value: vm.weeksOnChart || "—", sub: "Total weeks on the rankings", icon: "ri-calendar-check-line" },
    { label: "Current rank", value: vm.rank > 0 ? `#${vm.rank}` : "—", sub: vm.movement === "new" ? "New entry" : vm.movement === "up" ? `Up ${vm.movementAmount}` : vm.movement === "down" ? `Down ${vm.movementAmount}` : "Steady", icon: "ri-bar-chart-2-line" },
    { label: "First charted", value: vm.firstChartedDate ? formatDate(vm.firstChartedDate) : vm.releaseYear || "—", sub: "Registry debut", icon: "ri-flag-line" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 group hover:border-[var(--wk-brand)]/20 transition-all duration-300">
          <div className="flex items-center gap-2 mb-3">
            <i className={`${kpi.icon} text-[var(--wk-text-faint)] text-[15px]`} />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{kpi.label}</span>
          </div>
          <div className="text-[30px] md:text-[34px] font-black text-[var(--wk-text)] tracking-[-0.03em] leading-none mb-1">
            {kpi.value}
          </div>
          <div className="text-[11px] text-[var(--wk-text-muted)]">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */

export default function TrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [rawData, setRawData] = useState<RepairedTrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastScroll = useRef(false);

  /* ─── Data fetch ─── */
  useEffect(() => {
    let alive = true;
    if (!slug) { setLoading(false); setError("No track slug provided"); return; }
    setLoading(true); setError(null);
    getTrack(slug)
      .then((apiData) => {
        if (!alive) return;
        if (!apiData) { setError("Track not found in the registry."); setLoading(false); return; }
        setRawData(apiData);
        setTrack(apiToViewModel(apiData));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load track.");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [slug]);

  /* ─── Scroll tracking for floating header ─── */
  useEffect(() => {
    const onScroll = () => {
      const now = window.scrollY > 360;
      if (now !== lastScroll.current) {
        lastScroll.current = now;
        setScrolled(now);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto h-24 w-24 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Opening registry file&hellip;</p>
        </div>
      </main>
    );
  }

  /* ─── Error state ─── */
  if (error || !track) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-file-music-line text-[var(--wk-text-faint)] text-[32px]" />
        </div>
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Not in the registry</h1>
        <p className="mb-8 text-[15px] text-[var(--wk-text-muted)] max-w-[400px] mx-auto">
          {error || "This recording has not yet been catalogued. Our research team continuously expands the archive."}
        </p>
        <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-extrabold text-[var(--wk-brand-on)] transition-all hover:opacity-90 whitespace-nowrap">
          <i className="ri-bar-chart-2-line" />
          Browse the charts
        </Link>
      </main>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) { togglePlay(); return; }
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: "WAKILISHA Registry", duration: track.duration, previewUrl: track.previewUrl || undefined },
      [track].filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: "WAKILISHA Registry", duration: t.duration, previewUrl: t.previewUrl || undefined }))
    );
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* ── Floating mini-header ── */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
          scrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
        } bg-[var(--wk-bg)]/90 backdrop-blur-xl border-b border-[var(--wk-border)]`}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/charts" className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap shrink-0">
            <i className="ri-arrow-left-line text-[14px]" />
            Charts
          </Link>
          <span className="text-[var(--wk-text-faint)] text-[11px]">/</span>
          <span className="text-[13px] font-bold text-[var(--wk-text)] truncate">{track.title}</span>
          <span className="text-[var(--wk-text-faint)] text-[11px]">/</span>
          <span className="text-[12px] text-[var(--wk-text-muted)] truncate">{track.artist}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handlePlay} disabled={!track.isPlayable} className="h-8 px-4 rounded-full bg-[var(--wk-brand)] text-[11px] font-extrabold text-[var(--wk-brand-on)] transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap">
              <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"} text-[13px]`} />
              {isTrackPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={handleShare} className="h-8 w-8 flex items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] hover:border-[var(--wk-brand)]/30 transition-all">
              <i className={`${copied ? "ri-check-line text-[var(--wk-success)]" : "ri-share-line"} text-[13px]`} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          HERO — full-bleed artwork with editorial overlay
          ═══════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ height: "75vh", minHeight: "520px", maxHeight: "800px" }}>
        {/* Background artwork with ken-burns */}
        {track.artworkUrl ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${track.artworkUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center 25%",
              backgroundRepeat: "no-repeat",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--wk-surface-raised)]" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-black/55 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />

        {/* Top nav */}
        <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
          <Link
            to="/charts"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 backdrop-blur-md px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80 hover:bg-black/35 transition-all whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-[12px]" />
            Charts
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 backdrop-blur-md px-3 py-2 text-[11px] font-bold text-white/80 hover:bg-black/35 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-share-line text-[12px]" />
              {copied ? "Copied" : "Share"}
            </button>
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-10 md:pb-14">
          <div className="max-w-[1100px] mx-auto">
            {/* Registry badge */}
            <div className="mb-4 md:mb-6 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 backdrop-blur-md px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" />
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Registry File</span>
              </div>
              {track.rank > 0 && (
                <span className="rounded-full border border-white/20 bg-black/25 backdrop-blur-md px-3 py-1.5 text-[11px] font-extrabold text-white/80">
                  #{track.rank} on the charts
                </span>
              )}
              {track.movement === "new" && (
                <span className="rounded-full bg-[var(--wk-brand)]/20 border border-[var(--wk-brand)]/30 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-brand)]">
                  New entry
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="font-black leading-[0.88] tracking-[-0.04em] text-white mb-4 md:mb-5"
              style={{ fontSize: "clamp(38px, 6.5vw, 84px)", maxWidth: "900px" }}
            >
              {track.title}
            </h1>

            {/* Artists */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {track.artists.length > 0 ? (
                track.artists.map((a, i) => (
                  <span key={a.slug || i} className="flex items-center gap-1.5">
                    {i > 0 && !a.isFeatured && <span className="text-white/25 text-[13px]">·</span>}
                    <ArtistChip artist={a} isPrimary={a.isPrimary} />
                  </span>
                ))
              ) : (
                track.artistSlug ? (
                  <Link to={`/artists/${track.artistSlug}`} className="text-[16px] font-semibold text-white/75 hover:text-white transition-colors">
                    {track.artist}
                  </Link>
                ) : (
                  <span className="text-[16px] font-semibold text-white/75">{track.artist}</span>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FLOATING CONTENT CARD
          ═══════════════════════════════════════════ */}
      <div
        className="relative z-10 rounded-t-[32px] bg-[var(--wk-bg)]"
        style={{
          marginTop: "-48px",
          boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.25)",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 md:px-10">

          {/* ── Play bar ── */}
          <div className="flex items-center gap-4 py-6 border-b border-[var(--wk-divider)]">
            <button
              onClick={handlePlay}
              disabled={!track.isPlayable}
              className="flex items-center gap-2.5 rounded-full bg-[var(--wk-brand)] px-7 py-3.5 text-[14px] font-extrabold text-[var(--wk-brand-on)] transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
            >
              <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"} text-[18px]`} />
              {isTrackPlaying ? "Pause preview" : track.isPlayable ? "Play preview" : "No preview available"}
            </button>
            <div className="text-[12px] text-[var(--wk-text-muted)]">
              {track.isPlayable ? "Audio preview from registry sources" : "No audio preview in the registry"}
            </div>
          </div>

          {/* ── Section: Curator's Note ── */}
          <section className="py-12 md:py-16">
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-faint)] whitespace-nowrap">
                Curator&rsquo;s Note
              </span>
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
            </div>
            {rawData && <CuratorsNote apiData={rawData} />}
          </section>

          {/* ── Section: Provenance ── */}
          <section className="pb-12 md:pb-16">
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-faint)] whitespace-nowrap">
                Provenance
              </span>
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
            </div>
            <ProvenanceBar vm={track} />
          </section>

          {/* ── Section: Chart Performance ── */}
          {(track.chartHistory.length > 0 || track.weeksOnChart > 0 || track.chartAppearances.length > 0) && (
            <section className="pb-12 md:pb-16">
              <div className="mb-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-faint)] whitespace-nowrap">
                  Chart Performance
                </span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>

              <ChartKpiGrid vm={track} />

              {track.chartAppearances.length > 0 && (
                <div className="mt-8">
                  <TrackChartHistorySection
                    trackSlug={track.slug}
                    trackRank={track.rank}
                    trackPeak={track.peakPosition}
                    trackWeeks={track.weeksOnChart}
                    trackHistory={track.chartHistory}
                    chartAppearances={track.chartAppearances}
                    chartAppearanceCount={track.chartAppearanceCount}
                  />
                </div>
              )}
            </section>
          )}

          {/* ── Section: Connected Artists ── */}
          {track.artists.length > 0 && (
            <section className="pb-12 md:pb-16">
              <div className="mb-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-faint)] whitespace-nowrap">
                  Connected Artists
                </span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>
              <ArtistGallery artists={track.artists} artworkUrl={track.artworkUrl} />
            </section>
          )}

          {/* ── Section: Ecosystem ── */}
          {(track.albumTitle || (track.label && track.label !== "Unknown") || (track.genre && track.genre !== "Unknown")) && (
            <section className="pb-12 md:pb-16">
              <div className="mb-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-faint)] whitespace-nowrap">
                  In the Ecosystem
                </span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {track.albumTitle && (
                  <Link
                    to={`/releases/${track.albumSlug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all duration-300 hover:border-[var(--wk-brand)]/25 hover:bg-[var(--wk-surface-raised)] hover:-translate-y-0.5"
                  >
                    <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-[var(--wk-surface-raised)] flex items-center justify-center group-hover:bg-[var(--wk-brand-soft)] transition-colors">
                      <i className="ri-album-line text-[var(--wk-text-muted)] group-hover:text-[var(--wk-brand)] text-[22px] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-0.5">Release</div>
                      <div className="text-[15px] font-bold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">{track.albumTitle}</div>
                      {track.albumTrackNumber > 0 && (
                        <div className="text-[11px] text-[var(--wk-text-muted)]">Track {track.albumTrackNumber} of {track.albumTotalTracks}</div>
                      )}
                    </div>
                    <i className="ri-arrow-right-line text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] group-hover:translate-x-0.5 transition-all ml-auto" />
                  </Link>
                )}
                {track.label && track.label !== "Unknown" && (
                  <Link
                    to={`/labels/${track.labelSlug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all duration-300 hover:border-[var(--wk-brand)]/25 hover:bg-[var(--wk-surface-raised)] hover:-translate-y-0.5"
                  >
                    <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-[var(--wk-surface-raised)] flex items-center justify-center group-hover:bg-[var(--wk-brand-soft)] transition-colors">
                      <i className="ri-disc-line text-[var(--wk-text-muted)] group-hover:text-[var(--wk-brand)] text-[22px] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-0.5">Label</div>
                      <div className="text-[15px] font-bold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">{track.label}</div>
                    </div>
                    <i className="ri-arrow-right-line text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] group-hover:translate-x-0.5 transition-all ml-auto" />
                  </Link>
                )}
                {track.genre && track.genre !== "Unknown" && (
                  <Link
                    to={`/genres/${track.genreSlug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all duration-300 hover:border-[var(--wk-brand)]/25 hover:bg-[var(--wk-surface-raised)] hover:-translate-y-0.5"
                  >
                    <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-[var(--wk-surface-raised)] flex items-center justify-center group-hover:bg-[var(--wk-brand-soft)] transition-colors">
                      <i className="ri-price-tag-3-line text-[var(--wk-text-muted)] group-hover:text-[var(--wk-brand)] text-[22px] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-0.5">Genre</div>
                      <div className="text-[15px] font-bold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">{track.genre}</div>
                    </div>
                    <i className="ri-arrow-right-line text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] group-hover:translate-x-0.5 transition-all ml-auto" />
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* ── Section: Lyrics (if available) ── */}
          {track.lyrics && (
            <section className="pb-12 md:pb-16">
              <div className="mb-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-faint)] whitespace-nowrap">
                  Lyrics
                </span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
                {track.lyricsContributor && (
                  <div className="mb-5 flex items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
                    <i className="ri-user-star-line text-[var(--wk-brand)] text-[15px]" />
                    <span>Contributed by <span className="font-bold text-[var(--wk-text)]">{track.lyricsContributor.name}</span></span>
                  </div>
                )}
                <p className="text-[16px] leading-[2] text-[var(--wk-text)] md:text-[18px] md:leading-[2.2] max-w-[680px]">
                  <span className="float-left mr-3 mt-1 font-black leading-none text-[var(--wk-brand)]" style={{ fontSize: "clamp(44px, 6vw, 72px)" }}>
                    {track.lyrics.charAt(0)}
                  </span>
                  <span className="whitespace-pre-line">{track.lyrics.slice(1)}</span>
                </p>
              </div>
            </section>
          )}

        </div>

        {/* ── Footer CTA ── */}
        <section className="bg-[var(--wk-surface)] border-t border-[var(--wk-border)] py-16 px-6 text-center mt-8">
          <div className="max-w-[520px] mx-auto">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-4">
              WAKILISHA Registry
            </p>
            <h3 className="text-[22px] md:text-[26px] font-black tracking-[-0.035em] text-[var(--wk-text)] mb-3 leading-snug">
              African music, systematically catalogued.
            </h3>
            <p className="text-[14px] text-[var(--wk-text-muted)] mb-8 leading-relaxed">
              Every track in the registry is connected to its artists, releases, labels, genres, and chart history — creating a living archive of the continent&rsquo;s creative output.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                to="/charts"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-extrabold text-[var(--wk-brand-on)] transition-all hover:opacity-90 whitespace-nowrap"
              >
                <i className="ri-bar-chart-2-line" />
                Explore the charts
              </Link>
              <Link
                to="/artists"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-6 py-3 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:border-[var(--wk-brand)]/30 hover:text-[var(--wk-brand)] whitespace-nowrap"
              >
                <i className="ri-user-line" />
                Browse artists
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}