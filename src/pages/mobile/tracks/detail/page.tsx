import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getTrack, type RepairedTrackDetail } from "@/services/repaired/client";
import { buildTrackSummaryFromApi } from "@/services/registryNlg";
import { TrackChartSparkline } from "@/components/charts/TrackChartSparkline";
import { MetaTags } from "@/components/seo/MetaTags";
import { releaseUrl } from "@/utils/releaseUrl";
import { WkIcon } from "@/components/design-system/Icon";

/* ─── Types ─── */

type TrackChartAppearance = {
  editionSlug?: string;
  editionLabel?: string;
  familySlug?: string;
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
  const artistName = primaryArtist?.name || artistData.name || "WAKILISHA";
  const resolvedArtistSlug = primaryArtist?.slug || artistData.slug || "";

  const history = Array.isArray(raw.chartHistory) ? raw.chartHistory : [];
  const chartAppearances = Array.isArray(raw.chartAppearances) ? raw.chartAppearances.map((a: any) => ({
    editionSlug: a.editionSlug || "",
    editionLabel: a.editionLabel || "",
    familySlug: a.familySlug || "",
    date: a.date || "",
    rank: Number(a.rank || 0),
    previousRank: a.previousRank != null ? Number(a.previousRank) : null,
    movement: a.movement || "same",
  })) : [];
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
  const albumSlug = rawAlbumSlug.includes("--") ? rawAlbumSlug.split("--").slice(1).join("--") || rawAlbumSlug : rawAlbumSlug;
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
      <p className="text-[14px] leading-[1.8] text-[var(--wk-text-soft)]">
        <span className="float-left mr-2 font-black leading-[0.75] text-[var(--wk-brand)]" style={{ fontSize: "46px", marginTop: "0.02em" }}>
          {firstChar}
        </span>
        <span>{rest}</span>
      </p>
      <div className="mt-4 pt-3 border-t border-[var(--wk-divider)]">
        <p className="text-[10px] text-[var(--wk-text-faint)] italic leading-relaxed">
          Generated from connected data across the WAKILISHA archive.
        </p>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function MobileTrackDetail() {
  const { artistSlug, trackSlug } = useParams<{ artistSlug: string; trackSlug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [rawData, setRawData] = useState<RepairedTrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [expandedAbout, setExpandedAbout] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!artistSlug || !trackSlug) { setLoading(false); setError("No track slug provided"); return; }
    setLoading(true); setError(null);
    getTrack(artistSlug, trackSlug)
      .then((apiData) => {
        if (!alive) return;
        if (!apiData) { setError("Track not found."); setLoading(false); return; }
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
  }, [artistSlug, trackSlug]);

  useEffect(() => {
    setArtworkFailed(false);
  }, [track?.artworkUrl]);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareSheet(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wk-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--wk-brand)]" />
          </div>
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">Loading track...</span>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center bg-[var(--wk-bg)]">
        <i className="ri-file-music-line text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="text-[20px] font-black text-[var(--wk-text)]">Track not found</h1>
        <p className="text-[14px] text-[var(--wk-text-muted)]">{error || "This track has not been catalogued yet."}</p>
        <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap">
          <i className="ri-arrow-left-line" />
          Browse Charts
        </Link>
      </div>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;
  const canUseArtwork = Boolean(track.artworkUrl && !artworkFailed);

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) { togglePlay(); return; }
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: "WAKILISHA", duration: track.duration, previewUrl: track.previewUrl || undefined },
      [track].filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: "WAKILISHA", duration: t.duration, previewUrl: t.previewUrl || undefined }))
    );
  };

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* SEO */}
      <MetaTags
        title={`${track.title} by ${track.artist}`}
        description={`${track.title} by ${track.artist}${track.albumTitle ? ` from ${track.albumTitle}` : ""} — WAKILISHA${track.rank > 0 ? ` · #${track.rank}` : ""}`}
        imageUrl={track.artworkUrl}
        type="music.song"
        artistName={track.artist}
        releaseDate={track.releaseDate || track.releaseYear}
      />

      {/* Floating top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-safe-top pt-4 pointer-events-none">
        <Link
          to="/charts"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all active:scale-95"
          aria-label="Back"
        >
          <i className="ri-arrow-left-line text-lg" />
        </Link>
        <button
          onClick={() => setShowShareSheet(true)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all active:scale-95"
          aria-label="Share"
        >
          <i className="ri-share-line text-lg" />
        </button>
      </div>

      {/* Hero */}
      <section className="relative min-h-[380px] flex items-end overflow-hidden">
        {canUseArtwork ? (
          <div className="absolute inset-0" style={{ backgroundImage: `url(${track.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/30" />

        <div className="relative w-full px-5 pb-7 pt-20">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand)]/90 px-3 py-1 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur">
              <i className="ri-music-2-line text-[10px]" />
              Track profile
            </span>
            {track.rank > 0 && (
              <span className="rounded-full border border-white/20 bg-black/30 backdrop-blur-md px-2.5 py-1 text-[10px] font-extrabold text-white/80">
                #{track.rank}
              </span>
            )}
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.05em] text-[var(--wk-text)]" style={{ fontSize: "clamp(26px, 7.5vw, 40px)" }}>
            {track.title}
          </h1>
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]">
              {canUseArtwork ? (
                <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" onError={() => setArtworkFailed(true)} />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <i className="ri-music-2-line text-[var(--wk-text-faint)] text-sm" />
                </div>
              )}
            </div>
            <div>
              {track.artistSlug ? (
                <Link to={`/artists/${track.artistSlug}`} className="text-[13px] font-bold text-[var(--wk-text)] active:opacity-70">
                  {track.artist}
                </Link>
              ) : (
                <span className="text-[13px] font-bold text-[var(--wk-text)]">{track.artist}</span>
              )}
              <div className="text-[10px] text-[var(--wk-text-muted)]">
                {track.releaseDate ? formatDate(track.releaseDate) : track.releaseYear}
                {track.label && track.label !== "Unknown" ? ` · ${track.label}` : ""}
                {track.explicit ? " · Explicit" : ""}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handlePlay}
              disabled={!track.isPlayable}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-white active:scale-[0.97] transition-transform disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"} text-base`} />
              {isTrackPlaying ? "Pause" : track.isPlayable ? "Play preview" : "No preview"}
            </button>
            {track.genre && track.genre !== "Unknown" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur px-4 py-2.5 text-[11px] font-semibold text-[var(--wk-text-muted)] whitespace-nowrap">
                <i className="ri-price-tag-3-line text-sm" />
                {track.genre}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="px-5 py-6 space-y-8">

        {/* About this track */}
        {rawData && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">About this track</span>
            </div>
            <MobileCuratorsNote apiData={rawData} />
          </section>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {track.duration > 0 && (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Duration</div>
              <div className="mt-0.5 text-[17px] font-black text-[var(--wk-text)]">{formatDuration(track.duration)}</div>
            </div>
          )}
          {track.peakPosition > 0 && (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Peak</div>
              <div className="mt-0.5 text-[17px] font-black text-[var(--wk-text)]">#{track.peakPosition}</div>
            </div>
          )}
          {track.weeksOnChart > 0 && (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Weeks</div>
              <div className="mt-0.5 text-[17px] font-black text-[var(--wk-text)]">{track.weeksOnChart}</div>
            </div>
          )}
          {track.rank > 0 && (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Rank</div>
              <div className="mt-0.5 text-[17px] font-black text-[var(--wk-text)]">#{track.rank}</div>
            </div>
          )}
          {(track.releaseDate || track.releaseYear) && (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 col-span-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Released</div>
              <div className="mt-0.5 text-[14px] font-black text-[var(--wk-text)] leading-tight">
                {track.releaseDate ? formatDate(track.releaseDate) : track.releaseYear}
              </div>
            </div>
          )}
        </div>

        {/* Chart performance */}
        {(track.weeksOnChart > 0 || track.peakPosition > 0) && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Chart performance</span>
            </div>
            {/* Sparkline */}
            {track.chartHistory.length >= 2 && (
              <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-4 mb-4">
                <TrackChartSparkline
                  history={track.chartHistory}
                  peakPosition={track.peakPosition}
                  currentRank={track.rank}
                  weeksOnChart={track.weeksOnChart}
                  compact
                />
              </div>
            )}
            {/* Chart appearances — clickable links */}
            {track.chartAppearances.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {track.chartAppearances.slice(0, 6).map((app, i) => {
                  const href = app.familySlug && app.editionSlug
                    ? `/charts/${app.familySlug}/${app.editionSlug}`
                    : "/charts";
                  return (
                    <Link
                      key={app.editionSlug || i}
                      to={href}
                      className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)]/10 text-[12px] font-black text-[var(--wk-brand)]">
                        #{app.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">
                          {app.editionLabel || `Edition #${i + 1}`}
                        </div>
                      </div>
                      <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)] text-sm" />
                    </Link>
                  );
                })}
                {track.chartAppearances.length > 6 && (
                  <Link
                    to="/charts"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--wk-border)] py-2.5 text-[11px] font-bold text-[var(--wk-brand)] active:scale-[0.98] transition-transform"
                  >
                    View all {track.chartAppearances.length} appearances
                    <i className="ri-arrow-right-line text-xs" />
                  </Link>
                )}
              </div>
            )}
          </section>
        )}

        {/* Registry details */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Track details</span>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] divide-y divide-[var(--wk-divider)]">
            {(track.releaseDate || track.releaseYear) && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Released</span>
                <span className="text-[13px] font-bold text-[var(--wk-text)]">
                  {track.releaseDate ? formatDate(track.releaseDate) : track.releaseYear}
                </span>
              </div>
            )}
            {track.genre && track.genre !== "Unknown" && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Genre</span>
                <Link to={`/genres/${track.genreSlug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
                  {track.genre}
                </Link>
              </div>
            )}
            {track.label && track.label !== "Unknown" && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Label</span>
                <Link to={`/labels/${track.labelSlug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
                  {track.label}
                </Link>
              </div>
            )}
            {track.albumTitle && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Release</span>
                <Link to={releaseUrl({ slug: track.albumSlug, artist: track.artist })} className="text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] text-right max-w-[160px] truncate">
                  {track.albumTitle}
                </Link>
              </div>
            )}
            {track.isrc && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">ISRC</span>
                <span className="text-[12px] font-mono font-bold text-[var(--wk-text)]">{track.isrc}</span>
              </div>
            )}
            {track.duration > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Duration</span>
                <span className="text-[13px] font-bold text-[var(--wk-text)]">{formatDuration(track.duration)}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Preview</span>
              <span className="text-[13px] font-bold text-[var(--wk-text)]">
                {track.isPlayable ? "Available" : "Not available"}
              </span>
            </div>
          </div>
        </section>

        {/* Connected Artists */}
        {track.artists.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Artists</span>
            </div>
            <div className="space-y-2">
              {track.artists.map((a) => (
                <Link
                  key={a.slug || a.name}
                  to={a.slug ? `/artists/${a.slug}` : "#"}
                  className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 active:scale-[0.98] transition-transform"
                >
                  <div className="flex-shrink-0 h-11 w-11 rounded-full bg-[var(--wk-surface-raised)] flex items-center justify-center overflow-hidden ring-1 ring-[var(--wk-border)]">
                    {a.isPrimary && canUseArtwork ? (
                      <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <i className="ri-user-line text-[var(--wk-text-faint)] text-[17px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{a.name}</div>
                    <div className="text-[10px] text-[var(--wk-text-muted)]">
                      {a.isPrimary ? "Primary" : a.isFeatured ? "Featured" : "Collaborator"}
                    </div>
                  </div>
                  <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)] text-[16px]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Release link */}
        {track.albumTitle && (
          <Link
            to={releaseUrl({ slug: track.albumSlug, artist: track.artist })}
            className="flex items-center justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-4 active:bg-[var(--wk-surface-raised)] transition-colors"
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">Release</div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{track.albumTitle}</div>
              {track.albumTrackNumber > 0 && (
                <div className="text-[11px] text-[var(--wk-text-muted)]">Track {track.albumTrackNumber} of {track.albumTotalTracks}</div>
              )}
            </div>
            <i className="ri-arrow-right-line text-[var(--wk-text-muted)] text-lg" />
          </Link>
        )}

        {/* Artist link */}
        {track.artistSlug && (
          <Link
            to={`/artists/${track.artistSlug}`}
            className="flex items-center justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-4 active:bg-[var(--wk-surface-raised)] transition-colors"
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">Artist</div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{track.artist}</div>
            </div>
            <i className="ri-arrow-right-line text-[var(--wk-text-muted)] text-lg" />
          </Link>
        )}

        {/* Label link */}
        {track.label && track.label !== "Unknown" && track.labelSlug && (
          <Link
            to={`/labels/${track.labelSlug}`}
            className="flex items-center justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-4 active:bg-[var(--wk-surface-raised)] transition-colors"
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">Label</div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{track.label}</div>
            </div>
            <i className="ri-arrow-right-line text-[var(--wk-text-muted)] text-lg" />
          </Link>
        )}

        {/* Lyrics Contribute CTA */}
        <div className="rounded-2xl border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/20 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[var(--wk-brand-soft)] flex items-center justify-center shrink-0">
              <i className="ri-file-text-line text-[var(--wk-brand)] text-[17px]" />
            </div>
            <div>
              <div className="text-[12px] font-extrabold text-[var(--wk-text)]">Lyrics</div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">
                {track.lyrics ? "View or correct the lyrics" : "No lyrics yet — be the first to contribute"}
              </div>
            </div>
          </div>
          <Link
            to={`/tracks/${track.artistSlug}/${track.slug}/lyrics/contribute`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--wk-brand)] py-3 text-[13px] font-extrabold text-white active:scale-[0.97] transition-transform whitespace-nowrap"
          >
            <i className="ri-edit-2-line text-base" />
            {track.lyrics ? "Suggest correction" : "Contribute lyrics"}
          </Link>
        </div>

        {/* Browse CTA */}
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center">
          <p className="text-[13px] font-semibold text-[var(--wk-text-soft)]">Explore the full catalogue</p>
          <Link to="/charts" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-white active:scale-[0.97] transition-transform whitespace-nowrap">
            <i className="ri-bar-chart-2-line" />
            Browse charts
          </Link>
        </div>
      </div>

      {/* Share bottom sheet */}
      {showShareSheet && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={() => setShowShareSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl bg-[var(--wk-surface)] p-6 shadow-2xl">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--wk-border)]" />
            <h3 className="mb-5 text-[17px] font-black text-[var(--wk-text)]">Share track</h3>
            <button
              onClick={handleShare}
              className="flex w-full items-center gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-4 text-left transition-colors active:bg-[var(--wk-surface-raised)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]">
                <i className={`${copied ? "ri-check-line" : "ri-clipboard-line"} text-[var(--wk-brand)] text-lg`} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[var(--wk-text)]">{copied ? "Link copied!" : "Copy link"}</div>
                <div className="text-[12px] text-[var(--wk-text-muted)] break-all">{window.location.href}</div>
              </div>
            </button>
            <button onClick={() => setShowShareSheet(false)} className="mt-3 w-full rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] py-4 text-[14px] font-bold text-[var(--wk-text-muted)] transition-colors active:bg-[var(--wk-surface-raised)]">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}