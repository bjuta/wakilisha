import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getTrack, type PublicTrackDetail } from "@/services/publicApi/client";
import { buildTrackHeroIntro, buildTrackSeoDescription } from "@/services/cultureContext/trackAdapters";
import { TrackChartSparkline } from "@/components/charts/TrackChartSparkline";
import { MetaTags } from "@/components/seo/MetaTags";
import TrackLyricsSection from "./components/TrackLyricsSection";
import TrackRelatedTracks from "./components/TrackRelatedTracks";
import TrackReleaseTracklist from "./components/TrackReleaseTracklist";
import { releaseUrl } from "@/utils/releaseUrl";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";

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
  artists: Array<{
    name: string;
    slug: string;
    isPrimary: boolean;
    isFeatured: boolean;
    creditOrder: number;
    role: string;
  }>;
  genre: string;
  genreSlug: string;
  genres: string[];
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
  releaseType: string;
  isPlayable: boolean;
  previewUrl: string | null;
  albumTitle: string;
  albumSlug: string;
  albumTrackNumber: number;
  albumTotalTracks: number;
  chartHistory: number[];
  chartAppearances: TrackChartAppearance[];
  lyrics: string | null;
  lyricsContributor: { name: string; source?: string } | null;
  isrc: string | null;
  explicit: boolean;
  firstChartedDate: string;
  releaseTracks: Array<{
    id: string;
    slug: string;
    title: string;
    artist: string;
    duration: number;
    trackNumber: number;
    artworkUrl: string;
    previewUrl?: string;
  }>;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function apiToViewModel(api: PublicTrackDetail): TrackViewModel {
  const raw = api as any;
  const trackData = raw.track ?? raw;
  const artistData = raw.artist ?? {};
  const releaseData = raw.release ?? trackData.release ?? null;
  const labelData = raw.label ?? null;

  const rawArtists = Array.isArray(raw.artists) ? raw.artists : [];
  const mappedArtists = rawArtists.map((artist: any, index: number) => ({
    name: clean(artist.name || artist.artist_name_text),
    slug: clean(artist.slug || artist.artist_slug),
    isPrimary: Boolean(artist.isPrimary ?? artist.is_primary),
    isFeatured: Boolean(artist.isFeatured ?? artist.is_featured),
    creditOrder: Number(artist.creditOrder ?? artist.credit_order ?? index),
    role: artist.role || "primary",
  })).filter((artist: TrackViewModel["artists"][number]) => artist.name);
  const hasPrimary = mappedArtists.some((artist) => artist.isPrimary);
  const artists = hasPrimary ? mappedArtists : mappedArtists.map((artist, index) => ({ ...artist, isPrimary: index === 0 }));

  const primaryArtist = artists.find((artist) => artist.isPrimary) || artists[0];
  const artistName = primaryArtist?.name || artistData.name || "WAKILISHA";
  const resolvedArtistSlug = primaryArtist?.slug || artistData.slug || "";

  const history = Array.isArray(raw.chartHistory) ? raw.chartHistory : [];
  const chartAppearances = Array.isArray(raw.chartAppearances)
    ? raw.chartAppearances.map((appearance: any) => ({
        editionSlug: appearance.editionSlug || "",
        editionLabel: appearance.editionLabel || "",
        familySlug: appearance.familySlug || "",
        date: appearance.date || "",
        rank: Number(appearance.rank || 0),
        previousRank: appearance.previousRank != null ? Number(appearance.previousRank) : null,
        movement: appearance.movement || "same",
      }))
    : [];

  const currentRank = Number(raw.currentRank ?? 0) || 0;
  const prevRank = Number(raw.previousRank ?? (history.length > 1 ? history[history.length - 2] : 0)) || 0;
  const rawMovement = String(raw.movement || "").toLowerCase();
  let movement: TrackViewModel["movement"] = ["up", "down", "new", "same"].includes(rawMovement)
    ? (rawMovement as TrackViewModel["movement"])
    : "same";
  let movementAmount = Number(raw.movementAmount ?? 0) || 0;

  if (!rawMovement) {
    if (!prevRank || prevRank <= 0) movement = "new";
    else if (currentRank > 0 && currentRank < prevRank) {
      movement = "up";
      movementAmount = prevRank - currentRank;
    } else if (currentRank > 0 && currentRank > prevRank) {
      movement = "down";
      movementAmount = currentRank - prevRank;
    }
  }

  const allGenres = (api.genres || []).map((g: any) => clean(g.name)).filter(Boolean);
  const primaryGenre = allGenres[0] || "";
  const primaryGenreSlug = (api.genres || [])[0]?.slug || "";
  const duration = trackData.durationMs ? Math.round(trackData.durationMs / 1000) : (trackData.duration || 0);
  const artworkUrl = trackData.artworkUrl || releaseData?.artworkUrl || artistData?.imageUrl || "";
  const previewUrl: string | null = api.previewUrl || trackData.previewUrl || null;
  const albumTitle = releaseData?.title || "";
  const rawAlbumSlug = releaseData?.slug || "";
  const albumSlug = rawAlbumSlug.includes("--") ? rawAlbumSlug.split("--").slice(1).join("--") || rawAlbumSlug : rawAlbumSlug;
  const albumTrackNumber = Number(trackData.trackNumber || trackData.track_number || 0);
  const albumTotalTracks = Number(releaseData?.trackCount || 0);
  const releaseFullDate = releaseData?.releaseDate || "";
  const releaseType = releaseData?.releaseType || "";
  const releaseTracks = (releaseData?.tracks || []).map((t: any) => ({
    id: String(t.id || ""),
    slug: String(t.slug || ""),
    title: String(t.title || ""),
    artist: String(t.artist || ""),
    duration: Number(t.duration || 0),
    trackNumber: Number(t.trackNumber || 0),
    artworkUrl: String(t.artworkUrl || ""),
    previewUrl: t.previewUrl || undefined,
  }));

  return {
    slug: trackData.slug,
    title: trackData.title,
    artist: artistName,
    artistSlug: resolvedArtistSlug,
    artists,
    genre: primaryGenre,
    genreSlug: primaryGenreSlug,
    genres: allGenres,
    label: labelData?.name || releaseData?.labelName || "",
    labelSlug: labelData?.slug || releaseData?.labelSlug || "",
    rank: currentRank,
    peakPosition: Number(raw.peakRank ?? currentRank) || 0,
    weeksOnChart: Number(raw.weeksOnChart ?? history.length ?? 0) || 0,
    movement,
    movementAmount,
    previousWeek: prevRank > 0 ? prevRank : null,
    artworkUrl,
    duration,
    releaseYear: releaseFullDate ? releaseFullDate.split("-")[0] : "",
    releaseDate: releaseFullDate,
    releaseType,
    isPlayable: Boolean(previewUrl),
    previewUrl,
    albumTitle,
    albumSlug,
    albumTrackNumber,
    albumTotalTracks,
    chartHistory: history,
    chartAppearances,
    lyrics: null,
    lyricsContributor: null,
    isrc: trackData.isrc || null,
    explicit: Boolean(trackData.explicit),
    firstChartedDate: raw.firstChartedDate || "",
    releaseTracks,
  };
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-right font-extrabold capitalize text-[var(--wk-text)]">{value}</span>
    </div>
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

function ChartKpiGrid({ vm }: { vm: TrackViewModel }) {
  const kpis = [
    { label: "Peak position", value: vm.peakPosition > 0 ? `#${vm.peakPosition}` : "Not yet", sub: "Best chart moment" },
    { label: "Weeks charted", value: vm.weeksOnChart || "Not yet", sub: "Time in the mix" },
    { label: "Current rank", value: vm.rank > 0 ? `#${vm.rank}` : "Not ranked", sub: vm.movement === "new" ? "New here" : vm.movement === "up" ? `Up ${vm.movementAmount}` : vm.movement === "down" ? `Down ${vm.movementAmount}` : "Holding" },
    { label: "First seen", value: vm.firstChartedDate ? formatDate(vm.firstChartedDate) : vm.releaseYear || "Not yet", sub: "First chart signal" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-3.5 hover:border-[var(--wk-brand)]/20 transition-colors">
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

function TrackSidebar({ vm }: { vm: TrackViewModel }) {
  const hasChartData = vm.weeksOnChart > 0 || vm.peakPosition > 0;

  return (
    <aside className="space-y-5 lg:sticky lg:top-[88px] lg:self-start">
      {(hasChartData && vm.chartHistory.length >= 2) && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="TrendingUp" size={13} />
            Chart movement
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

      <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="Activity" size={13} />
          Track facts
        </div>
        <div className="grid grid-cols-2 gap-3">
          {vm.duration > 0 && <StatCard value={formatDuration(vm.duration)} label="Duration" />}
          {vm.releaseDate ? <StatCard value={formatDate(vm.releaseDate)} label="Released" /> : vm.releaseYear ? <StatCard value={vm.releaseYear} label="Year" /> : null}
          {vm.rank > 0 && <StatCard value={`#${vm.rank}`} label="Current rank" />}
          {vm.peakPosition > 0 && <StatCard value={`#${vm.peakPosition}`} label="Peak" />}
          {vm.weeksOnChart > 0 && <StatCard value={String(vm.weeksOnChart)} label="Weeks" />}
          {vm.albumTrackNumber > 0 && vm.albumTotalTracks > 0 && <StatCard value={`${vm.albumTrackNumber} / ${vm.albumTotalTracks}`} label="Track no." />}
        </div>
      </div>

      {(vm.label || vm.genre || vm.isrc || vm.explicit) && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="BadgeCheck" size={13} />
            What we know
          </div>
          <div className="space-y-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
            {vm.genre && vm.genre !== "Unknown" && <InfoRow label="Sound" value={vm.genre} />}
            {vm.label && vm.label !== "Unknown" && <InfoRow label="Label" value={vm.label} />}
            <InfoRow label="Chart data" value={hasChartData ? "Linked" : "Not charted"} />
            <InfoRow label="Preview" value={vm.isPlayable ? "Available" : "Not available"} />
            {vm.isrc && <InfoRow label="ISRC" value={<span className="font-mono text-[11px]">{vm.isrc}</span>} />}
            {vm.explicit && <InfoRow label="Advisory" value={<span className="text-[var(--wk-danger)] font-bold uppercase text-[10px]">Explicit</span>} />}
          </div>
        </div>
      )}

      {vm.albumTitle && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Disc3" size={13} />
            Release
          </div>
          <Link to={releaseUrl({ slug: vm.albumSlug, artist: vm.artist })} className="group flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--wk-surface-raised)] transition-colors">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[var(--wk-bg)] border border-[var(--wk-border)]">
              {vm.artworkUrl && <img src={vm.artworkUrl} alt={vm.albumTitle} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
                {vm.albumTitle}
              </div>
              {vm.albumTrackNumber > 0 && (
                <div className="text-[11px] font-semibold text-[var(--wk-text-muted)]">Track {vm.albumTrackNumber}</div>
              )}
            </div>
            <WkIcon name="ArrowRight" size={14} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)] transition-colors" />
          </Link>
        </div>
      )}
    </aside>
  );
}

function ConnectedArtists({ artists, artworkUrl }: { artists: TrackViewModel["artists"]; artworkUrl: string }) {
  if (!artists || artists.length === 0) return null;

  const primary = artists.filter((artist) => artist.isPrimary);
  const featured = artists.filter((artist) => artist.isFeatured && !artist.isPrimary);
  const others = artists.filter((artist) => !artist.isPrimary && !artist.isFeatured);
  const groups = [
    { label: "Primary artist", items: primary },
    { label: "Featured", items: featured },
    { label: "Also credited", items: others },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="UserPlus" size={12} />
          Artists on this track
        </div>
        <h2 className="text-[18px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
          {artists.length} artist{artists.length !== 1 ? "s" : ""}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">{group.label}</span>
            </div>
            <div className="space-y-2">
              {group.items.map((artist) => (
                <Link key={artist.slug || artist.name} to={artist.slug ? `/artists/${artist.slug}` : "#"} className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition-all duration-200 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)] hover:-translate-y-0.5">
                  <div className="relative shrink-0 h-12 w-12 rounded-full overflow-hidden bg-[var(--wk-surface-raised)] ring-2 ring-[var(--wk-border)] group-hover:ring-[var(--wk-brand)]/30 transition-all">
                    {artist.isPrimary && artworkUrl ? <img src={artworkUrl} alt={artist.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><i className="ri-user-line text-[var(--wk-text-faint)] text-xl" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">{artist.name}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{artist.isPrimary ? "Primary artist" : artist.isFeatured ? "Featured" : "Collaborator"}</div>
                  </div>
                  <WkIcon name="ArrowRight" size={14} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TrackDetail() {
  const { artistSlug, trackSlug } = useParams<{ artistSlug: string; trackSlug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useScrollDepthTracking({
    pageType: "track_detail",
    entitySlug: trackSlug,
    entityType: "track",
  });

  useEffect(() => {
    let alive = true;
    if (!artistSlug || !trackSlug) {
      setLoading(false);
      setError("No track slug provided");
      return;
    }

    setLoading(true);
    setError(null);
    getTrack(artistSlug, trackSlug)
      .then((apiData) => {
        if (!alive) return;
        if (!apiData) {
          setError("Track not found.");
          setLoading(false);
          return;
        }
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

  if (error || !track) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-file-music-line text-[var(--wk-text-faint)] text-[32px]" />
        </div>
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Track not found</h1>
        <p className="mb-8 text-[15px] text-[var(--wk-text-muted)] max-w-[400px] mx-auto">
          {error || "We do not have this track page ready yet."}
        </p>
        <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-extrabold text-[var(--wk-brand-on)] hover:opacity-90 whitespace-nowrap">
          <i className="ri-bar-chart-2-line" />
          Browse the charts
        </Link>
      </main>
    );
  }

  const trackIntro = buildTrackHeroIntro(track);
  const seoDescription = buildTrackSeoDescription(track);
  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;
  const minutes = track.duration ? Math.round(track.duration / 60) : 0;

  const trackChips = [
    track.releaseType && track.releaseType !== "Unknown" ? track.releaseType : "",
    track.genre && track.genre !== "Unknown" ? track.genre : "",
    track.label && track.label !== "Unknown" ? track.label : "",
  ].filter(Boolean);

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) {
      togglePlay();
      return;
    }
    const playerTrack = {
      id: track.slug,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      isPlayable: track.isPlayable,
      source: "WAKILISHA",
      duration: track.duration,
      previewUrl: track.previewUrl || undefined,
    };
    playTrack(playerTrack, [playerTrack], {
      pageType: "track_detail",
      entitySlug: trackSlug,
      entityType: "track",
      sourceSection: "track_hero",
    });
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <MetaTags
        title={`${track.title} by ${track.artist}`}
        description={seoDescription}
        imageUrl={track.artworkUrl}
        type="music.song"
        artistName={track.artist}
        releaseDate={track.releaseDate || track.releaseYear}
      />

      <section className="relative -mt-16 pt-16 overflow-hidden">
        {track.artworkUrl && (
          <div className="absolute inset-0 opacity-20 scale-110" style={{ backgroundImage: `url("${track.artworkUrl}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(90px) saturate(1.4)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/70 to-[var(--wk-bg)]" />

        <div className="relative z-10 wk-container-wide px-6 py-16 md:py-24 lg:py-28">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-end">
            <div className="relative shrink-0 w-[260px] md:w-[320px] lg:w-[360px] aspect-square overflow-hidden">
              {track.artworkUrl ? <img src={track.artworkUrl} alt={`${track.title} artwork`} loading="lazy" className="w-full h-full object-cover" /> : <div className="relative h-full w-full bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)] flex items-center justify-center"><i className="ri-music-2-line text-6xl text-[#30451f]/40" /></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)]/60 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-5">
                <WkIcon name="Music" size={13} />
                Track profile
                {track.rank > 0 && <span className="ml-1 opacity-70">· #{track.rank}</span>}
              </div>

              <h1 className="font-[var(--wk-font-display)] font-black text-[var(--wk-text)] leading-[0.9] tracking-[-0.05em]" style={{ fontSize: "clamp(38px, 6vw, 80px)" }}>
                {track.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {track.artists.length > 0 ? track.artists.map((artist, index) => (
                  <span key={artist.slug || index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-[var(--wk-text-faint)]">·</span>}
                    {artist.slug ? <Link to={`/artists/${artist.slug}`} className="text-[15px] md:text-[17px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">{artist.name}</Link> : <span className="text-[15px] md:text-[17px] font-bold text-[var(--wk-text)]">{artist.name}</span>}
                    {artist.isFeatured && <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">feat.</span>}
                  </span>
                )) : <span className="text-[15px] font-bold text-[var(--wk-text)]">{track.artist}</span>}
                {track.label && track.label !== "Unknown" && (
                  <>
                    <span className="text-[var(--wk-text-faint)]">·</span>
                    <Link to={`/labels/${track.labelSlug}`} className="text-[14px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors">{track.label}</Link>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-5 mt-6 text-[12px] font-bold text-[var(--wk-text-muted)]">
                {track.releaseDate ? <span className="inline-flex items-center gap-2"><WkIcon name="Calendar" size={14} />{formatDate(track.releaseDate)}</span> : track.releaseYear ? <span className="inline-flex items-center gap-2"><WkIcon name="Calendar" size={14} />{track.releaseYear}</span> : null}
                {minutes > 0 && <span className="inline-flex items-center gap-2"><WkIcon name="Clock3" size={14} />{minutes} min</span>}
                {track.genre && track.genre !== "Unknown" && <span className="inline-flex items-center gap-2"><WkIcon name="Tag" size={14} />{track.genre}</span>}
                {track.explicit && <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 bg-[var(--wk-text-faint)]/10 text-[10px] font-extrabold uppercase tracking-wider text-[var(--wk-text-faint)]">Explicit</span>}
              </div>

              <div className="flex flex-wrap gap-3 mt-8">
                <button onClick={handlePlay} disabled={!track.isPlayable} className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] text-white px-6 py-3 text-[14px] font-extrabold hover:bg-[var(--wk-brand)]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                  <WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={18} />
                  {isTrackPlaying ? "Pause" : track.isPlayable ? "Play preview" : "No preview"}
                </button>
                <Link to={`/tracks/${artistSlug}/${trackSlug}/lyrics/contribute`} className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap">
                  <WkIcon name="Edit3" size={16} />
                  Contribute lyrics
                </Link>
                <ShareButton item={{ title: track.title, subtitle: track.artist, description: trackIntro || seoDescription, imageUrl: track.artworkUrl, type: "track" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="wk-container-wide px-6 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="flex-1 min-w-0 space-y-10 md:space-y-14">
            {/* Culture context — styled like ReleaseExcerpt */}
            {trackIntro && (
              <section>
                <div className="relative border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] overflow-hidden">
                  <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-[var(--wk-brand)]" />
                  <div className="px-6 py-5 pl-8">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center text-[var(--wk-brand)]">
                          <i className="ri-compass-3-line text-[14px]" />
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                          Track context
                        </span>
                      </div>
                      {trackChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {trackChips.map((chip) => (
                            <span
                              key={chip}
                              className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-text-muted)] whitespace-nowrap"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[14px] leading-[1.8] text-[var(--wk-text-soft)]">
                      {trackIntro}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Tracklist from the release */}
            <TrackReleaseTracklist
              artistSlug={track.artistSlug}
              currentTrackSlug={track.slug}
              albumTitle={track.albumTitle}
              tracks={track.releaseTracks}
            />

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

                <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6 mb-6">
                  <TrackChartSparkline history={track.chartHistory} peakPosition={track.peakPosition} currentRank={track.rank} weeksOnChart={track.weeksOnChart} />
                </div>

                {track.chartAppearances.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1 h-3 rounded-full bg-[var(--wk-brand)]" />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Chart moments ({track.chartAppearances.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {track.chartAppearances.slice(0, 8).map((appearance, index) => {
                        const editionHref = appearance.familySlug && appearance.editionSlug ? `/charts/${appearance.familySlug}/${appearance.editionSlug}` : "/charts";
                        return (
                          <Link key={appearance.editionSlug || index} to={editionHref} className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)] transition-all">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)]/10 text-[13px] font-black text-[var(--wk-brand)]">#{appearance.rank}</div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-bold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">{appearance.editionLabel || `Edition #${index + 1}`}</div>
                              {appearance.date && <div className="text-[10px] text-[var(--wk-text-muted)]">{appearance.date}</div>}
                            </div>
                            <WkIcon name="ArrowRight" size={12} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                <ChartKpiGrid vm={track} />
              </section>
            )}

            <TrackLyricsSection trackSlug={track.slug} artistSlug={track.artistSlug} trackTitle={track.title} artistName={track.artist} lyrics={track.lyrics} lyricsContributor={track.lyricsContributor} />

            <TrackRelatedTracks trackSlug={track.slug} artistSlug={track.artistSlug} artistName={track.artist} albumSlug={track.albumSlug} albumTitle={track.albumTitle} genreSlug={track.genreSlug} genreName={track.genre} />

            {track.artists.length > 0 && <ConnectedArtists artists={track.artists} artworkUrl={track.artworkUrl} />}

            {track.artistSlug && (
              <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">Primary artist</div>
                    <div className="text-[18px] font-extrabold text-[var(--wk-text)]">{track.artist}</div>
                    <div className="text-[12px] font-semibold text-[var(--wk-text-muted)] mt-1">Follow the artist page for more songs, releases, and chart moments.</div>
                  </div>
                  <Link to={`/artists/${track.artistSlug}`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap">
                    View artist
                    <WkIcon name="ArrowUpRight" size={13} />
                  </Link>
                </div>
              </section>
            )}
          </div>

          <div className="w-full lg:w-[340px] shrink-0">
            <TrackSidebar vm={track} />
          </div>
        </div>
      </div>
    </main>
  );
}
