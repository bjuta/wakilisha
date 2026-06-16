import { useState, useEffect } from "react";
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
};

type TrackViewModel = {
  slug: string;
  title: string;
  artist: string;
  artistSlug: string;
  artists: Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean; creditOrder: number; role: string }>;
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
  const previewUrl: string | null = api.previewUrl || (trackData as any).previewUrl || null;
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

/* ─── Mobile Curator's Note ─── */

function MobileCuratorsNote({ apiData }: { apiData: RepairedTrackDetail }) {
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
    artistsForNlg, releaseForNlg,
    genres.map((g) => g.name),
    chartCtx, sourceProviders || [],
  );

  if (!summary) return null;

  const firstChar = summary.charAt(0);
  const rest = summary.slice(1);

  return (
    <div>
      <p className="text-[15px] leading-[1.8] text-[var(--wk-text-soft)]">
        <span className="float-left mr-2 font-black leading-[0.75] text-[var(--wk-brand)]" style={{ fontSize: "50px", marginTop: "0.02em" }}>
          {firstChar}
        </span>
        <span>{rest}</span>
      </p>
      <div className="mt-4 pt-3 border-t border-[var(--wk-divider)]">
        <p className="text-[10px] text-[var(--wk-text-faint)] italic leading-relaxed">
          Generated from the WAKILISHA relationship graph. A deterministic summary drawn from connected registry data.
        </p>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function MobileTrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [rawData, setRawData] = useState<RepairedTrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[14px] font-semibold text-[var(--wk-text-muted)]">Opening registry file&hellip;</p>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="min-h-screen bg-[var(--wk-bg)] px-5 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-file-music-line text-[var(--wk-text-faint)] text-[28px]" />
        </div>
        <h1 className="mb-2 text-[22px] font-black text-[var(--wk-text)]">Not in the registry</h1>
        <p className="mb-6 text-[14px] text-[var(--wk-text-muted)]">{error || "This recording has not yet been catalogued."}</p>
        <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-extrabold text-[var(--wk-brand-on)] whitespace-nowrap">
          <i className="ri-bar-chart-2-line" /> Browse charts
        </Link>
      </div>
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
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "340px" }}>
        {track.artworkUrl ? (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url(${track.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center 30%" }}
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--wk-surface-raised)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-black/50 to-black/15" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 py-4 flex items-center justify-between">
          <Link to="/charts" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/80 whitespace-nowrap">
            <i className="ri-arrow-left-line text-[11px]" /> Charts
          </Link>
          <button onClick={handleShare} className="h-8 w-8 flex items-center justify-center rounded-full border border-white/15 bg-black/20 backdrop-blur-md text-white/80">
            <i className={`${copied ? "ri-check-line text-[var(--wk-success)]" : "ri-share-line"} text-[13px]`} />
          </button>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 backdrop-blur-md px-2.5 py-1">
              <span className="w-1 h-1 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">Registry File</span>
            </div>
            {track.rank > 0 && (
              <span className="rounded-full border border-white/20 bg-black/25 backdrop-blur-md px-2.5 py-1 text-[10px] font-extrabold text-white/80">
                #{track.rank}
              </span>
            )}
            {track.movement === "new" && (
              <span className="rounded-full bg-[var(--wk-brand)]/20 border border-[var(--wk-brand)]/30 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[var(--wk-brand)]">
                New
              </span>
            )}
          </div>
          <h1 className="font-black leading-[0.88] tracking-[-0.04em] text-white mb-2" style={{ fontSize: "clamp(28px, 8vw, 48px)" }}>
            {track.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {track.artists.length > 0 ? (
              track.artists.map((a, i) => (
                <span key={a.slug || i} className="flex items-center gap-1">
                  {i > 0 && !a.isFeatured && <span className="text-white/25 text-[11px]">·</span>}
                  {a.slug ? (
                    <Link to={`/artists/${a.slug}`} className="text-[14px] font-semibold text-white/70 hover:text-white transition-colors">
                      {a.isPrimary && <span className="inline-block w-1 h-1 rounded-full bg-[var(--wk-brand)] mr-1 align-middle opacity-70" />}
                      {a.name}
                    </Link>
                  ) : (
                    <span className="text-[14px] font-semibold text-white/70">{a.name}</span>
                  )}
                  {a.isFeatured && <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/30 ml-0.5">feat.</span>}
                </span>
              ))
            ) : (
              track.artistSlug ? (
                <Link to={`/artists/${track.artistSlug}`} className="text-[14px] font-semibold text-white/70 hover:text-white">{track.artist}</Link>
              ) : (
                <span className="text-[14px] font-semibold text-white/70">{track.artist}</span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Content card ── */}
      <div className="relative z-10 rounded-t-[24px] bg-[var(--wk-bg)] -mt-6" style={{ boxShadow: "0 -6px 30px -10px rgba(0,0,0,0.2)" }}>

        {/* Play bar */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-[var(--wk-divider)]">
          <button
            onClick={handlePlay}
            disabled={!track.isPlayable}
            className="flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-extrabold text-[var(--wk-brand-on)] transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"} text-[16px]`} />
            {isTrackPlaying ? "Pause" : track.isPlayable ? "Play preview" : "No preview"}
          </button>
          <div className="text-[11px] text-[var(--wk-text-muted)]">
            {track.isPlayable ? "Preview available" : "No audio in registry"}
          </div>
        </div>

        <div className="px-5">

          {/* Curator's Note */}
          {rawData && (
            <section className="py-8 border-b border-[var(--wk-divider)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-text-faint)] whitespace-nowrap">Curator&rsquo;s Note</span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>
              <MobileCuratorsNote apiData={rawData} />
            </section>
          )}

          {/* Chart KPIs + Trajectory + Appearances */}
          {(track.weeksOnChart > 0 || track.peakPosition > 0) && (
            <section className="py-6 border-b border-[var(--wk-divider)]">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Peak</span>
                  <div className="text-[24px] font-black text-[var(--wk-text)] mt-0.5">{track.peakPosition > 0 ? `#${track.peakPosition}` : "—"}</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Weeks</span>
                  <div className="text-[24px] font-black text-[var(--wk-text)] mt-0.5">{track.weeksOnChart || "—"}</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Current</span>
                  <div className="text-[24px] font-black text-[var(--wk-text)] mt-0.5">{track.rank > 0 ? `#${track.rank}` : "—"}</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">First charted</span>
                  <div className="text-[13px] font-extrabold text-[var(--wk-text)] mt-0.5 leading-tight">{track.firstChartedDate ? formatDate(track.firstChartedDate) : track.releaseYear || "—"}</div>
                </div>
              </div>

              {track.chartAppearances.length > 0 && (
                <TrackChartHistorySection
                  trackSlug={track.slug}
                  trackRank={track.rank}
                  trackPeak={track.peakPosition}
                  trackWeeks={track.weeksOnChart}
                  trackHistory={track.chartHistory}
                  chartAppearances={track.chartAppearances}
                  chartAppearanceCount={track.chartAppearanceCount}
                  compact
                />
              )}
            </section>
          )}

          {/* Provenance */}
          <section className="py-8 border-b border-[var(--wk-divider)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-text-faint)] whitespace-nowrap">Provenance</span>
              <div className="h-px flex-1 bg-[var(--wk-divider)]" />
            </div>
            <div className="space-y-1">
              {track.releaseDate && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Released</span>
                  <span className="text-[13px] font-bold text-[var(--wk-text)]">{formatDate(track.releaseDate)}</span>
                </div>
              )}
              {track.albumTitle && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Release</span>
                  <Link to={`/releases/${track.albumSlug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
                    {track.albumTitle}
                  </Link>
                </div>
              )}
              {track.label && track.label !== "Unknown" && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Label</span>
                  <Link to={`/labels/${track.labelSlug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
                    {track.label}
                  </Link>
                </div>
              )}
              {track.genre && track.genre !== "Unknown" && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Genre</span>
                  <Link to={`/genres/${track.genreSlug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
                    {track.genre}
                  </Link>
                </div>
              )}
              {track.isrc && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">ISRC</span>
                  <span className="text-[12px] font-mono font-bold text-[var(--wk-text)]">{track.isrc}</span>
                </div>
              )}
              {track.duration > 0 && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Duration</span>
                  <span className="text-[13px] font-bold text-[var(--wk-text)]">{formatDuration(track.duration)}</span>
                </div>
              )}
              {track.sourceProviders.length > 0 && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Sources</span>
                  <span className="text-[13px] font-bold text-[var(--wk-text)]">{humanList(track.sourceProviders)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Connected Artists */}
          {track.artists.length > 0 && (
            <section className="py-8 border-b border-[var(--wk-divider)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-text-faint)] whitespace-nowrap">Connected Artists</span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>
              <div className="space-y-2">
                {track.artists.map((a) => (
                  <Link
                    key={a.slug}
                    to={a.slug ? `/artists/${a.slug}` : "#"}
                    className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 active:scale-[0.98] transition-transform"
                  >
                    <div className="flex-shrink-0 h-11 w-11 rounded-full bg-[var(--wk-surface-raised)] flex items-center justify-center overflow-hidden ring-1 ring-[var(--wk-border)]">
                      {a.isPrimary && track.artworkUrl ? (
                        <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <i className="ri-user-line text-[var(--wk-text-faint)] text-[17px]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{a.name}</div>
                      <div className="text-[10px] text-[var(--wk-text-muted)]">{a.isPrimary ? "Primary" : a.isFeatured ? "Featured" : "Collaborator"}</div>
                    </div>
                    <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)] text-[16px]" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Ecosystem */}
          {(track.albumTitle || (track.label && track.label !== "Unknown") || (track.genre && track.genre !== "Unknown")) && (
            <section className="py-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-text-faint)] whitespace-nowrap">In the Ecosystem</span>
                <div className="h-px flex-1 bg-[var(--wk-divider)]" />
              </div>
              <div className="space-y-2">
                {track.albumTitle && (
                  <Link to={`/releases/${track.albumSlug}`} className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 active:scale-[0.98] transition-transform">
                    <div className="flex-shrink-0 h-11 w-11 rounded-lg bg-[var(--wk-surface-raised)] flex items-center justify-center">
                      <i className="ri-album-line text-[var(--wk-text-muted)] text-[20px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">Release</div>
                      <div className="text-[14px] font-bold text-[var(--wk-text)]">{track.albumTitle}</div>
                    </div>
                    <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)] ml-auto" />
                  </Link>
                )}
                {track.label && track.label !== "Unknown" && (
                  <Link to={`/labels/${track.labelSlug}`} className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 active:scale-[0.98] transition-transform">
                    <div className="flex-shrink-0 h-11 w-11 rounded-lg bg-[var(--wk-surface-raised)] flex items-center justify-center">
                      <i className="ri-disc-line text-[var(--wk-text-muted)] text-[20px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">Label</div>
                      <div className="text-[14px] font-bold text-[var(--wk-text)]">{track.label}</div>
                    </div>
                    <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)] ml-auto" />
                  </Link>
                )}
                {track.genre && track.genre !== "Unknown" && (
                  <Link to={`/genres/${track.genreSlug}`} className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 active:scale-[0.98] transition-transform">
                    <div className="flex-shrink-0 h-11 w-11 rounded-lg bg-[var(--wk-surface-raised)] flex items-center justify-center">
                      <i className="ri-price-tag-3-line text-[var(--wk-text-muted)] text-[20px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">Genre</div>
                      <div className="text-[14px] font-bold text-[var(--wk-text)]">{track.genre}</div>
                    </div>
                    <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)] ml-auto" />
                  </Link>
                )}
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[var(--wk-surface)] border-t border-[var(--wk-border)] py-10 px-5 text-center mt-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)] mb-3">WAKILISHA Registry</p>
          <h3 className="text-[18px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">African music, systematically catalogued.</h3>
          <p className="text-[12px] text-[var(--wk-text-muted)] mb-6 leading-relaxed">
            Every track in the registry is connected to its artists, releases, labels, genres, and chart history.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link to="/charts" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-extrabold text-[var(--wk-brand-on)] whitespace-nowrap">
              <i className="ri-bar-chart-2-line" /> Charts
            </Link>
            <Link to="/artists" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-2.5 text-[12px] font-bold text-[var(--wk-text)] whitespace-nowrap">
              <i className="ri-user-line" /> Artists
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}