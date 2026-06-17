import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getTrack, type RepairedTrackDetail } from "@/services/repaired/client";
import { buildTrackSummaryFromApi } from "@/services/registryNlg";
import { TrackChartSparkline } from "@/components/charts/TrackChartSparkline";
import { MetaTags } from "@/components/seo/MetaTags";
import TrackLyricsSection from "./components/TrackLyricsSection";
import TrackRelatedTracks from "./components/TrackRelatedTracks";
import { releaseUrl } from "@/utils/releaseUrl";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { ShareButton } from "@/components/design-system/share/ShareSheet";

/* ─── Types ─── */

type TrackChartAppearance = {
  editionSlug?: string;
  editionLabel?: string;
  familySlug?: string;
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
  const previewUrl: string | null = api.previewUrl || trackData.previewUrl || null;
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
    <div className="max-w-[640px]">
      <p className="text-[16px] md:text-[18px] leading-[1.85] text-[var(--wk-text-soft)]">
        <span
          className="float-left mr-3 font-black leading-[0.75] text-[var(--wk-brand)]"
          style={{ fontSize: "clamp(56px, 7vw, 78px)", marginTop: "0.02em" }}
        >
          {firstChar}
        </span>
        <span>{rest}</span>
      </p>
      <div className="mt-5 pt-4 border-t border-[var(--wk-divider)]">
        <p className="text-[11px] text-[var(--wk-text-faint)] italic leading-relaxed">
          An algorithmic summary drawn from connected data across the WAKILISHA archive.
        </p>
      </div>
    </div>
  );
}

/* ─── Chart KPIs ─── */

function ChartKpiGrid({ vm }: { vm: TrackViewModel }) {
  const kpis = [
    { label: "Peak position", value: vm.peakPosition > 0 ? `#${vm.peakPosition}` : "—", sub: "All-time best", icon: "ri-trophy-line" },
    { label: "Weeks charted", value: vm.weeksOnChart || "—", sub: "Total weeks ranked", icon: "ri-calendar-check-line" },
    { label: "Current rank", value: vm.rank > 0 ? `#${vm.rank}` : "—", sub: vm.movement === "new" ? "New entry" : vm.movement === "up" ? `Up ${vm.movementAmount}` : vm.movement === "down" ? `Down ${vm.movementAmount}` : "Steady", icon: "ri-bar-chart-2-line" },
    { label: "First charted", value: vm.firstChartedDate ? formatDate(vm.firstChartedDate) : vm.releaseYear || "—", sub: "First charted", icon: "ri-flag-line" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-3.5 hover:border-[var(--wk-brand)]/20 transition-colors"
        >
          <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-2">
            {kpi.label}
          </div>
          <div className="text-[22px] md:text-[26px] font-black text-[var(--wk-text)] tracking-[-0.03em] leading-none mb-1">
            {kpi.value}
          </div>
          <div className="text-[10px] text-[var(--wk-text-muted)]">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Sidebar Metadata ─── */

function TrackSidebar({ vm, rawData }: { vm: TrackViewModel; rawData: RepairedTrackDetail | null }) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.05);

  const hasChartData = vm.weeksOnChart > 0 || vm.peakPosition > 0;

  return (
    <aside ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up space-y-5 lg:sticky lg:top-[88px] lg:self-start`}>

      {/* Chart Sparkline — compact sidebar preview */}
      {(vm.weeksOnChart > 0 || vm.peakPosition > 0) && vm.chartHistory.length >= 2 && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="TrendingUp" size={13} />
            Chart trajectory
          </div>
          <TrackChartSparkline
            history={vm.chartHistory}
            peakPosition={vm.peakPosition}
            currentRank={vm.rank}
            weeksOnChart={vm.weeksOnChart}
            compact
          />
        </div>
      )}

      {/* Stats */}
      <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="Activity" size={13} />
          Track stats
        </div>
        <div className="grid grid-cols-2 gap-3">
          {vm.duration > 0 && (
            <StatCard value={formatDuration(vm.duration)} label="Duration" />
          )}
          {vm.releaseDate ? (
            <StatCard value={formatDate(vm.releaseDate)} label="Released" />
          ) : vm.releaseYear ? (
            <StatCard value={vm.releaseYear} label="Year" />
          ) : null}
          {vm.rank > 0 && <StatCard value={`#${vm.rank}`} label="Current rank" />}
          {vm.peakPosition > 0 && <StatCard value={`#${vm.peakPosition}`} label="Peak position" />}
          {vm.weeksOnChart > 0 && <StatCard value={String(vm.weeksOnChart)} label="Weeks charted" />}
          {vm.albumTrackNumber > 0 && vm.albumTotalTracks > 0 && (
            <StatCard value={`${vm.albumTrackNumber} / ${vm.albumTotalTracks}`} label="Track no." />
          )}
        </div>
      </div>

      {/* Label */}
      {vm.label && vm.label !== "Unknown" && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Building2" size={13} />
            Label
          </div>
          <div className="text-[15px] font-extrabold text-[var(--wk-text)]">{vm.label}</div>
          <div className="text-[12px] font-semibold text-[var(--wk-text-muted)] mt-1 capitalize">
            {vm.genre && vm.genre !== "Unknown" ? vm.genre : ""}
          </div>
          {vm.labelSlug && (
            <Link
              to={`/labels/${vm.labelSlug}`}
              className="inline-flex items-center gap-2 mt-4 text-[12px] font-bold text-[var(--wk-brand)] hover:underline"
            >
              Open label
              <WkIcon name="ArrowUpRight" size={12} />
            </Link>
          )}
        </div>
      )}

      {/* Genre */}
      {vm.genre && vm.genre !== "Unknown" && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Tag" size={13} />
            Genre
          </div>
          <div className="text-[15px] font-extrabold text-[var(--wk-text)]">{vm.genre}</div>
          {vm.genreSlug && (
            <Link
              to={`/genres/${vm.genreSlug}`}
              className="inline-flex items-center gap-2 mt-4 text-[12px] font-bold text-[var(--wk-brand)] hover:underline"
            >
              Explore genre
              <WkIcon name="ArrowUpRight" size={12} />
            </Link>
          )}
        </div>
      )}

      {/* Profile status */}
      <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="BadgeCheck" size={13} />
          Profile status
        </div>
        <div className="space-y-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          <RegistryRow label="Chart data" value={hasChartData ? "Linked" : "Not charted"} />
          <RegistryRow label="Preview" value={vm.isPlayable ? "Available" : "Not available"} />
          {vm.isrc && <RegistryRow label="ISRC" value={<span className="font-mono text-[11px]">{vm.isrc}</span>} />}
          {vm.explicit && <RegistryRow label="Advisory" value={<span className="text-[var(--wk-danger)] font-bold uppercase text-[10px]">Explicit</span>} />}
          {vm.sourceProviders.length > 0 && (
            <RegistryRow label="Sources" value={vm.sourceProviders.slice(0, 2).join(", ")} />
          )}
        </div>
      </div>

      {/* Album */}
      {vm.albumTitle && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Disc3" size={13} />
            Release
          </div>
          <Link
            to={releaseUrl({ slug: vm.albumSlug, artist: vm.artist })}
            className="group flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--wk-surface-raised)] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--wk-bg)] border border-[var(--wk-border)]">
              {vm.artworkUrl && (
                <img src={vm.artworkUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
                {vm.albumTitle}
              </div>
              {vm.albumTrackNumber > 0 && (
                <div className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                  Track {vm.albumTrackNumber}
                </div>
              )}
            </div>
            <WkIcon name="ArrowRight" size={14} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)] transition-colors" />
          </Link>
        </div>
      )}
    </aside>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-3.5">
      <div className="text-[17px] font-black text-[var(--wk-text)] leading-tight tracking-[-0.02em] break-words">{value}</div>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-1.5">
        {label}
      </div>
    </div>
  );
}

function RegistryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-right font-extrabold capitalize text-[var(--wk-text)]">{value}</span>
    </div>
  );
}

/* ─── Artists section ─── */

function ConnectedArtists({ artists, artworkUrl }: { artists: TrackViewModel["artists"]; artworkUrl: string }) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);
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
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="UserPlus" size={12} />
            Connected artists
          </div>
          <h2 className="text-[18px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
            {artists.length} artist{artists.length !== 1 ? "s" : ""}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    key={a.slug || a.name}
                    to={a.slug ? `/artists/${a.slug}` : "#"}
                    className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition-all duration-200 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)] hover:-translate-y-0.5"
                  >
                    <div className="relative flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-[var(--wk-surface-raised)] ring-2 ring-[var(--wk-border)] group-hover:ring-[var(--wk-brand)]/30 transition-all">
                      {a.isPrimary && artworkUrl ? (
                        <img src={artworkUrl} alt={a.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-user-line text-[var(--wk-text-faint)] text-xl" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px] text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
                        {a.name}
                      </div>
                      <div className="text-[11px] text-[var(--wk-text-muted)]">
                        {a.isPrimary ? "Primary artist" : a.isFeatured ? "Featured" : "Collaborator"}
                      </div>
                    </div>
                    <WkIcon name="ArrowRight" size={14} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Main Page ─── */

export default function TrackDetail() {
  const { artistSlug, trackSlug } = useParams<{ artistSlug: string; trackSlug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [rawData, setRawData] = useState<RepairedTrackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ─── Data fetch ─── */
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

  /* ─── Loading ─── */
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto h-24 w-24 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Loading track&hellip;</p>
        </div>
      </main>
    );
  }

  /* ─── Error ─── */
  if (error || !track) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-file-music-line text-[var(--wk-text-faint)] text-[32px]" />
        </div>
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Track not found</h1>
        <p className="mb-8 text-[15px] text-[var(--wk-text-muted)] max-w-[400px] mx-auto">
          {error || "This recording has not yet been catalogued."}
        </p>
        <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-extrabold text-[var(--wk-brand-on)] hover:opacity-90 whitespace-nowrap">
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
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: "WAKILISHA", duration: track.duration, previewUrl: track.previewUrl || undefined },
      [track].filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: "WAKILISHA", duration: t.duration, previewUrl: t.previewUrl || undefined }))
    );
  };

  const minutes = track.duration ? Math.round(track.duration / 60) : 0;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* SEO */}
      <MetaTags
        title={`${track.title} by ${track.artist}`}
        description={`${track.title} by ${track.artist}${track.albumTitle ? ` from ${track.albumTitle}` : ""} — WAKILISHA${track.rank > 0 ? ` · #${track.rank}` : ""}`}
        imageUrl={track.artworkUrl}
        type="music.song"
        artistName={track.artist}
        releaseDate={track.releaseDate || track.releaseYear}
      />

      {/* ── Hero — same pattern as release detail ── */}
      <section className="relative overflow-hidden">
        {/* Ambient blur */}
        {track.artworkUrl && (
          <div
            className="absolute inset-0 opacity-20 scale-110"
            style={{
              backgroundImage: `url("${track.artworkUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(90px) saturate(1.4)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/70 to-[var(--wk-bg)]" />

        <div className="relative z-10 wk-container-wide px-6 py-16 md:py-24 lg:py-28">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-end">
            {/* Artwork */}
            <div
              className="relative flex-shrink-0 w-[260px] md:w-[320px] lg:w-[360px] aspect-square rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)]"
              style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.28)" }}
            >
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative h-full w-full bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)] flex items-center justify-center">
                  <i className="ri-music-2-line text-6xl text-[#30451f]/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-2">
              {/* Kicker */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)]/60 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-5">
                <WkIcon name="Music" size={13} />
                Track profile
                {track.rank > 0 && (
                  <span className="ml-1 opacity-70">· #{track.rank}</span>
                )}
              </div>

              {/* Title */}
              <h1
                className="font-[var(--wk-font-display)] font-black text-[var(--wk-text)] leading-[0.9] tracking-[-0.05em]"
                style={{ fontSize: "clamp(38px, 6vw, 80px)" }}
              >
                {track.title}
              </h1>

              {/* Artists */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {track.artists.length > 0 ? (
                  track.artists.map((a, i) => (
                    <span key={a.slug || i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-[var(--wk-text-faint)]">·</span>}
                      {a.slug ? (
                        <Link
                          to={`/artists/${a.slug}`}
                          className="text-[15px] md:text-[17px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors"
                        >
                          {a.name}
                        </Link>
                      ) : (
                        <span className="text-[15px] md:text-[17px] font-bold text-[var(--wk-text)]">{a.name}</span>
                      )}
                      {a.isFeatured && (
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">feat.</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-[15px] font-bold text-[var(--wk-text)]">{track.artist}</span>
                )}
                {/* Label in sub-line */}
                {track.label && track.label !== "Unknown" && (
                  <>
                    <span className="text-[var(--wk-text-faint)]">·</span>
                    <Link
                      to={`/labels/${track.labelSlug}`}
                      className="text-[14px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors"
                    >
                      {track.label}
                    </Link>
                  </>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-5 mt-6 text-[12px] font-bold text-[var(--wk-text-muted)]">
                {track.releaseDate ? (
                  <span className="inline-flex items-center gap-2">
                    <WkIcon name="Calendar" size={14} />
                    {formatDate(track.releaseDate)}
                  </span>
                ) : track.releaseYear ? (
                  <span className="inline-flex items-center gap-2">
                    <WkIcon name="Calendar" size={14} />
                    {track.releaseYear}
                  </span>
                ) : null}
                {minutes > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <WkIcon name="Clock3" size={14} />
                    {minutes} min
                  </span>
                )}
                {track.genre && track.genre !== "Unknown" && (
                  <span className="inline-flex items-center gap-2">
                    <WkIcon name="Tag" size={14} />
                    {track.genre}
                  </span>
                )}
                {track.explicit && (
                  <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 bg-[var(--wk-text-faint)]/10 text-[10px] font-extrabold uppercase tracking-wider text-[var(--wk-text-faint)]">
                    Explicit
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mt-8">
                <button
                  onClick={handlePlay}
                  disabled={!track.isPlayable}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] text-white px-6 py-3 text-[14px] font-extrabold hover:bg-[var(--wk-brand)]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={18} />
                  {isTrackPlaying ? "Pause" : track.isPlayable ? "Play preview" : "No preview"}
                </button>
                <Link
                  to={`/tracks/${artistSlug}/${trackSlug}/lyrics/contribute`}
                  className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap"
                >
                  <WkIcon name="Edit3" size={16} />
                  Contribute lyrics
                </Link>
                <div className="ml-1">
                  <ShareButton
                    item={{
                      title: track.title,
                      subtitle: track.artist,
                      description: `${track.title} by ${track.artist} — WAKILISHA`,
                      imageUrl: track.artworkUrl,
                      type: "track",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="wk-container-wide px-6 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-10 md:space-y-14">

            {/* Curator's Note */}
            {rawData && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                    <WkIcon name="BookOpen" size={12} />
                    About this track
                  </div>
                </div>
                <CuratorsNote apiData={rawData} />
              </section>
            )}

            {/* Chart Performance */}
            {(track.chartHistory.length > 0 || track.weeksOnChart > 0) && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                    <WkIcon name="BarChart3" size={12} />
                    Chart performance
                  </div>
                  <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
                    {track.weeksOnChart > 0 ? `${track.weeksOnChart} weeks on chart` : "Chart history"}
                  </h2>
                </div>

                {/* Sparkline + KPIs */}
                <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6 mb-6">
                  <TrackChartSparkline
                    history={track.chartHistory}
                    peakPosition={track.peakPosition}
                    currentRank={track.rank}
                    weeksOnChart={track.weeksOnChart}
                  />
                </div>

                {/* Chart appearances — clickable edition links */}
                {track.chartAppearances.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1 h-3 rounded-full bg-[var(--wk-brand)]" />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">
                        Chart appearances ({track.chartAppearances.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {track.chartAppearances.slice(0, 8).map((app, i) => {
                        const editionHref = app.familySlug && app.editionSlug
                          ? `/charts/${app.familySlug}/${app.editionSlug}`
                          : "/charts";
                        return (
                          <Link
                            key={app.editionSlug || i}
                            to={editionHref}
                            className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)] transition-all"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)]/10 text-[13px] font-black text-[var(--wk-brand)]">
                              #{app.rank}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-bold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
                                {app.editionLabel || `Edition #${i + 1}`}
                              </div>
                              {app.date && (
                                <div className="text-[10px] text-[var(--wk-text-muted)]">{app.date}</div>
                              )}
                            </div>
                            <WkIcon name="ArrowRight" size={12} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                    {track.chartAppearances.length > 8 && (
                      <div className="mt-2 text-center">
                        <Link
                          to="/charts"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-brand)] hover:underline"
                        >
                          View all {track.chartAppearances.length} appearances
                          <WkIcon name="ArrowRight" size={11} />
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <ChartKpiGrid vm={track} />
              </section>
            )}

            {/* Lyrics */}
            <TrackLyricsSection
              trackSlug={track.slug}
              artistSlug={track.artistSlug}
              trackTitle={track.title}
              artistName={track.artist}
              lyrics={track.lyrics}
              lyricsContributor={track.lyricsContributor}
            />

            {/* Related Tracks */}
            <TrackRelatedTracks
              trackSlug={track.slug}
              artistSlug={track.artistSlug}
              artistName={track.artist}
              albumSlug={track.albumSlug}
              albumTitle={track.albumTitle}
              genreSlug={track.genreSlug}
              genreName={track.genre}
            />

            {/* Connected Artists */}
            {track.artists.length > 0 && (
              <ConnectedArtists artists={track.artists} artworkUrl={track.artworkUrl} />
            )}

            {/* Artist link */}
            {track.artistSlug && (
              <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">
                      Primary Artist
                    </div>
                    <div className="text-[18px] font-extrabold text-[var(--wk-text)]">{track.artist}</div>
                    <div className="text-[12px] font-semibold text-[var(--wk-text-muted)] mt-1">
                      Primary artist on this track
                    </div>
                  </div>
                  <Link
                    to={`/artists/${track.artistSlug}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap"
                  >
                    View artist
                    <WkIcon name="ArrowUpRight" size={13} />
                  </Link>
                </div>
              </section>
            )}

          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[340px] flex-shrink-0">
            <TrackSidebar vm={track} rawData={rawData} />
          </div>
        </div>
      </div>
    </main>
  );
}