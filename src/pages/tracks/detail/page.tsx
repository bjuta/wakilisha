import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getTrack, type PublicTrackDetail } from "@/services/publicApi/client";
import { buildTrackHeroIntro, buildTrackSeoDescription } from "@/services/cultureContext/trackAdapters";
import { TrackChartSparkline } from "@/components/charts/TrackChartSparkline";
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import type { MusicRecordingSchema } from "@/components/seo/SchemaOrg";
import TrackLyricsSection from "./components/TrackLyricsSection";
import TrackRelatedTracks from "./components/TrackRelatedTracks";
import TrackReleaseTracklist from "./components/TrackReleaseTracklist";
import { releaseUrl } from "@/utils/releaseUrl";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { ContributionBadges } from "@/components/feature/community/ContributionBadges";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { TrackMomentSummary } from "@/components/feature/community/TrackMomentDrawer";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useEntityActions } from "@/hooks/useCommunityActions";
import { getApplePlaybackPrefsSnapshot } from "@/services/appleMusicConnection";
import {
  formatListeningProgress,
  getListeningHistoryForTrack,
  type ListeningHistoryItem,
} from "@/services/listeningHistory";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";
import { trackEvent } from "@/services/analytics";

function cleanDirtyTrackSlug(artistSlug?: string, trackSlug?: string): string {
  if (!artistSlug || !trackSlug) return "";
  if (!trackSlug.endsWith(`-${artistSlug}`)) return "";
  return trackSlug.slice(0, -artistSlug.length - 1);
}

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
  appleMusicId: string | null;
  appleMusicCatalogId: string | null;
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
    appleMusicId?: string | null;
    appleMusicCatalogId?: string | null;
  }>;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function recordValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object") return undefined;
  return (record as Record<string, unknown>)[key];
}

function findReleaseTrack(raw: any, trackData: any, releaseData: any) {
  const candidates = [
    ...(Array.isArray(releaseData?.tracks) ? releaseData.tracks : []),
    ...(Array.isArray(raw.releaseTracks) ? raw.releaseTracks : []),
    ...(Array.isArray(raw.tracks) ? raw.tracks : []),
  ];

  const currentSlug = clean(trackData.slug || raw.slug);
  const currentId = clean(trackData.id || raw.id);
  const currentTitle = clean(trackData.title || raw.title).toLowerCase();

  return candidates.find((candidate: any) => {
    const candidateSlug = clean(candidate.slug);
    const candidateId = clean(candidate.id);
    const candidateTitle = clean(candidate.title).toLowerCase();

    return (
      (currentSlug && candidateSlug === currentSlug) ||
      (currentId && candidateId === currentId) ||
      (currentTitle && candidateTitle === currentTitle)
    );
  }) || null;
}

function releaseMetadata(raw: any, trackData: any, releaseData: any) {
  const trackMetadata = trackData?.metadata && typeof trackData.metadata === "object" ? trackData.metadata : {};
  const rawMetadata = raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  const releaseMetadata = releaseData?.metadata && typeof releaseData.metadata === "object" ? releaseData.metadata : {};
  return { trackMetadata, rawMetadata, releaseMetadata };
}

function apiToViewModel(api: PublicTrackDetail): TrackViewModel {
  const raw = api as any;
  const trackData = raw.track ?? raw;
  const artistData = raw.artist ?? {};
  const releaseData = raw.release ?? trackData.release ?? raw.album ?? trackData.album ?? null;
  const labelData = raw.label ?? null;
  const { trackMetadata, rawMetadata, releaseMetadata: relMetadata } = releaseMetadata(raw, trackData, releaseData);
  const matchedReleaseTrack = findReleaseTrack(raw, trackData, releaseData);

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
  const albumTitle = firstString(
    releaseData?.title,
    releaseData?.name,
    trackData.releaseTitle,
    trackData.albumTitle,
    raw.releaseTitle,
    raw.albumTitle,
    trackMetadata.releaseTitle,
    trackMetadata.albumTitle,
    rawMetadata.releaseTitle,
    rawMetadata.albumTitle,
    relMetadata.title,
    relMetadata.name
  );
  const rawAlbumSlug = firstString(
    releaseData?.slug,
    trackData.releaseSlug,
    trackData.albumSlug,
    raw.releaseSlug,
    raw.albumSlug,
    trackMetadata.releaseSlug,
    trackMetadata.albumSlug,
    rawMetadata.releaseSlug,
    rawMetadata.albumSlug,
    relMetadata.slug
  );
  const albumSlug = rawAlbumSlug.includes("--") ? rawAlbumSlug.split("--").slice(1).join("--") || rawAlbumSlug : rawAlbumSlug;
  const albumTrackNumber = firstNumber(
    trackData.trackNumber,
    trackData.track_number,
    raw.trackNumber,
    raw.track_number,
    matchedReleaseTrack?.trackNumber,
    matchedReleaseTrack?.track_number,
    trackMetadata.trackNumber,
    trackMetadata.track_number,
    rawMetadata.trackNumber,
    rawMetadata.track_number
  );
  const albumTotalTracks = firstNumber(
    releaseData?.trackCount,
    releaseData?.track_count,
    raw.releaseTrackCount,
    raw.albumTrackCount,
    trackData.releaseTrackCount,
    trackData.albumTrackCount,
    trackMetadata.trackCount,
    trackMetadata.releaseTrackCount,
    trackMetadata.albumTrackCount,
    rawMetadata.trackCount,
    rawMetadata.releaseTrackCount,
    rawMetadata.albumTrackCount,
    relMetadata.trackCount,
    relMetadata.track_count
  );
  const releaseFullDate = firstString(
    releaseData?.releaseDate,
    releaseData?.date,
    releaseData?.releasedAt,
    trackData.releaseDate,
    raw.releaseDate,
    trackMetadata.releaseDate,
    rawMetadata.releaseDate,
    relMetadata.releaseDate,
    relMetadata.date
  );
  const releaseType = firstString(
    releaseData?.releaseType,
    releaseData?.type,
    trackData.releaseType,
    raw.releaseType,
    trackMetadata.releaseType,
    rawMetadata.releaseType,
    relMetadata.releaseType,
    relMetadata.type
  );
  const releaseTracks = (releaseData?.tracks || []).map((t: any) => ({
    id: String(t.id || ""),
    slug: String(t.slug || ""),
    title: String(t.title || ""),
    artist: String(t.artist || ""),
    duration: Number(t.duration || 0),
    trackNumber: Number(t.trackNumber || 0),
    artworkUrl: String(t.artworkUrl || ""),
    previewUrl: t.previewUrl || undefined,
    appleMusicId: t.appleMusicId || t.appleMusicCatalogId || null,
    appleMusicCatalogId: t.appleMusicCatalogId || t.appleMusicId || null,
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
    label: firstString(
      labelData?.name,
      releaseData?.labelName,
      releaseData?.label,
      trackData.labelName,
      raw.labelName,
      trackMetadata.labelName,
      rawMetadata.labelName,
      relMetadata.labelName,
      relMetadata.label
    ),
    labelSlug: firstString(
      labelData?.slug,
      releaseData?.labelSlug,
      trackData.labelSlug,
      raw.labelSlug,
      trackMetadata.labelSlug,
      rawMetadata.labelSlug,
      relMetadata.labelSlug
    ),
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
    appleMusicId: trackData.appleMusicId || trackData.appleMusicCatalogId || raw.appleMusicId || raw.appleMusicCatalogId || null,
    appleMusicCatalogId: trackData.appleMusicCatalogId || trackData.appleMusicId || raw.appleMusicCatalogId || raw.appleMusicId || null,
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

function timeAgoShort(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
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

function releaseKindLabel(type: string): string {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "ep" || normalized === "extended play") return "EP";
  if (normalized === "album" || normalized === "studio album") return "album";
  if (normalized === "compilation") return "compilation";
  if (normalized === "mixtape") return "mixtape";
  if (normalized === "soundtrack") return "soundtrack";
  if (normalized === "deluxe") return "deluxe edition";
  if (normalized === "single") return "single";
  return normalized || "release";
}

function TrackAlbumContextSection({ vm }: { vm: TrackViewModel }) {
  if (!vm.albumTitle) return null;

  const releaseKind = releaseKindLabel(vm.releaseType);
  const releasePath = releaseUrl({ slug: vm.albumSlug, artist: vm.artist });
  const trackPosition = vm.albumTrackNumber > 0
    ? `Track ${vm.albumTrackNumber}${vm.albumTotalTracks > 0 ? ` of ${vm.albumTotalTracks}` : ""}`
    : "";
  const releaseDate = vm.releaseDate ? formatDate(vm.releaseDate) : vm.releaseYear;
  const trackCountText = vm.albumTotalTracks > 0
    ? `${vm.albumTotalTracks} track${vm.albumTotalTracks === 1 ? "" : "s"}`
    : "";
  const descriptionBits = [
    trackPosition,
    releaseKind,
    trackCountText,
    releaseDate ? `released ${vm.releaseDate ? "on" : "in"} ${releaseDate}` : "",
    vm.label ? `under ${vm.label}` : "",
  ].filter(Boolean);

  return (
    <section>
      <div className="overflow-hidden rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="grid gap-0 md:grid-cols-[220px_1fr]">
          <Link
            to={releasePath}
            className="relative block min-h-[220px] bg-[var(--wk-bg)]"
            aria-label={`Open ${vm.albumTitle}`}
          >
            {vm.artworkUrl ? (
              <img
                src={vm.artworkUrl}
                alt={`${vm.albumTitle} artwork`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <WkIcon name="Disc3" size={42} className="text-[var(--wk-brand)]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            {trackPosition && (
              <div className="absolute bottom-4 left-4 rounded-full bg-black/55 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                {trackPosition}
              </div>
            )}
          </Link>

          <div className="p-6 md:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              <WkIcon name="Disc3" size={12} />
              Release context
            </div>

            <h2 className="mt-4 text-[28px] font-black leading-none tracking-[-0.04em] text-[var(--wk-text)] md:text-[36px]">
              From {vm.albumTitle}
            </h2>

            <p className="mt-3 max-w-[680px] text-[14px] leading-7 text-[var(--wk-text-soft)]">
              {vm.title} appears on {vm.albumTitle}
              {descriptionBits.length > 0 ? `, ${descriptionBits.join(" · ")}.` : "."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {trackPosition && <StatCard value={trackPosition} label="Position" />}
              {releaseKind && <StatCard value={releaseKind} label="Release type" />}
              {trackCountText && <StatCard value={trackCountText} label="Project size" />}
              {releaseDate && <StatCard value={releaseDate} label="Release date" />}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={releasePath}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-extrabold text-white transition-colors hover:bg-[var(--wk-brand)]/90"
              >
                View release
                <WkIcon name="ArrowRight" size={15} />
              </Link>
              {vm.releaseTracks.length > 1 && (
                <span className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3 text-[13px] font-bold text-[var(--wk-text-muted)]">
                  <WkIcon name="ListMusic" size={15} />
                  {vm.releaseTracks.length} tracks on this release
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function TrackListeningSignalPanel({ signal }: { signal: ListeningHistoryItem | null }) {
  if (!signal) return null;

  const progress = Math.round(Math.min(1, Math.max(0, signal.progress || 0)) * 100);
  const source = signal.backend === "apple" ? "Apple Music full playback" : "Preview playback";

  return (
    <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Headphones" size={12} />
            Your listening
          </div>
          <h2 className="mt-3 text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
            {signal.playCount} play{signal.playCount === 1 ? "" : "s"} on WAKILISHA
          </h2>
          <p className="mt-1 text-[13px] font-semibold text-[var(--wk-text-muted)]">
            Last played {timeAgoShort(signal.lastPlayedAt)} · {source}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 md:w-[320px]">
          <StatCard value={formatListeningProgress(signal)} label="Progress" />
          <StatCard value={signal.fullPlayCount || 0} label="Full plays" />
          <StatCard value={signal.completedCount || 0} label="Finished" />
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--wk-bg)]">
        <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${progress}%` }} />
      </div>
    </section>
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
  const navigate = useNavigate();
  const location = useLocation();
  const { playTrack, currentTrack, isPlaying, togglePlay, playbackBackend } = usePlayer();
  const user = useAuthUser();
  const { save: saveEntityAction, loading: entityActionLoading } = useEntityActions(user.id || undefined);
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackSaved, setTrackSaved] = useState(false);
  const [trackSaveError, setTrackSaveError] = useState<string | null>(null);
  const [listeningSignal, setListeningSignal] = useState<ListeningHistoryItem | null>(null);
  const [applePlaybackConnected, setApplePlaybackConnected] = useState(
    () => getApplePlaybackPrefsSnapshot().appleMusicConnected
  );

  useScrollDepthTracking({
    pageType: "track_detail",
    entitySlug: trackSlug,
    entityType: "track",
  });

  useEffect(() => {
    const cleanedTrackSlug = cleanDirtyTrackSlug(artistSlug, trackSlug);
    if (!artistSlug || !trackSlug || !cleanedTrackSlug || cleanedTrackSlug === trackSlug) return;

    navigate(`/tracks/${artistSlug}/${cleanedTrackSlug}${location.search || ""}${location.hash || ""}`, {
      replace: true,
    });
  }, [artistSlug, trackSlug, navigate, location.search, location.hash]);

  useEffect(() => {
    const syncApplePlaybackState = () => {
      setApplePlaybackConnected(getApplePlaybackPrefsSnapshot().appleMusicConnected);
    };

    syncApplePlaybackState();
    window.addEventListener("wk-playback-changed", syncApplePlaybackState);
    window.addEventListener("wk-apple-music-connected", syncApplePlaybackState);

    return () => {
      window.removeEventListener("wk-playback-changed", syncApplePlaybackState);
      window.removeEventListener("wk-apple-music-connected", syncApplePlaybackState);
    };
  }, []);

  useEffect(() => {
    if (!track?.slug) {
      setListeningSignal(null);
      return;
    }

    const syncListeningSignal = () => {
      setListeningSignal(getListeningHistoryForTrack(track.slug));
    };

    syncListeningSignal();
    window.addEventListener("wk-listening-history-changed", syncListeningSignal);

    return () => {
      window.removeEventListener("wk-listening-history-changed", syncListeningSignal);
    };
  }, [track?.slug]);

  useEffect(() => {
    let alive = true;
    if (!artistSlug || !trackSlug) {
      setLoading(false);
      setError("No track slug provided");
      return;
    }

    setLoading(true);
    setError(null);
    setTrackSaved(false);
    setTrackSaveError(null);
    getTrack(artistSlug, trackSlug)
      .then((apiData) => {
        if (!alive) return;
        if (!apiData) {
          trackEvent("page_not_found", {
            pageType: "404",
            entityType: "broken_page",
            entitySlug: `${artistSlug || "unknown"}/${trackSlug || "unknown"}`,
            context: {
              status_code: 404,
              not_found_path: location.pathname,
              not_found_search: location.search || "",
              not_found_hash: location.hash || "",
              route_guess: "missing_track",
              suggested_fix: cleanDirtyTrackSlug(artistSlug, trackSlug)
                ? `/tracks/${artistSlug}/${cleanDirtyTrackSlug(artistSlug, trackSlug)}`
                : "",
              soft_404_surface: "track_detail",
              artist_slug: artistSlug,
              track_slug: trackSlug,
            },
          });

          setError("Track not found.");
          setLoading(false);
          return;
        }
        setTrack(apiToViewModel(apiData));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError("Could not load track.");
        setLoading(false);
      });

    return () => { alive = false; };
  }, [artistSlug, trackSlug, location.pathname, location.search, location.hash]);

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
  const hasAppleCatalog = Boolean(track.appleMusicCatalogId || track.appleMusicId);
  const canPlayFullTrack = hasAppleCatalog && applePlaybackConnected;
  const hasPlayableSource = track.isPlayable || canPlayFullTrack;
  const playButtonLabel = isTrackPlaying
    ? (playbackBackend === "apple" ? "Pause" : "Pause preview")
    : canPlayFullTrack
      ? "Play full track"
      : track.isPlayable
        ? "Play preview"
        : hasAppleCatalog
          ? "Connect Apple Music"
          : "No playback";

  const trackChips = [
    track.releaseType && track.releaseType !== "Unknown" ? track.releaseType : "",
    track.genre && track.genre !== "Unknown" ? track.genre : "",
    track.label && track.label !== "Unknown" ? track.label : "",
  ].filter(Boolean);

  const handlePlay = () => {
    if (!hasPlayableSource) return;
    if (isCurrentTrack) {
      togglePlay();
      return;
    }
    const playerTrack = {
      id: track.slug,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
      isPlayable: hasPlayableSource,
      source: "WAKILISHA",
      duration: track.duration,
      previewUrl: track.previewUrl || undefined,
      appleMusicId: track.appleMusicId,
      appleMusicCatalogId: track.appleMusicCatalogId,
      artistSlug: track.artistSlug || artistSlug || undefined,
      trackSlug: track.slug || trackSlug || undefined,
    };
    playTrack(playerTrack, [playerTrack], {
      pageType: "track_detail",
      entitySlug: trackSlug,
      entityType: "track",
      sourceSection: "track_hero",
    });
  };

  const handleSaveTrack = async () => {
    if (!track) return;

    const canonicalPath = artistSlug && trackSlug
      ? `/tracks/${artistSlug}/${trackSlug}`
      : `/tracks/${track.slug}`;

    setTrackSaveError(null);

    try {
      const result = await saveEntityAction({
        entityType: "track",
        entityId: track.slug,
        entitySlug: track.slug,
        entityUrl: canonicalPath,
        title: track.title,
        subtitle: track.artist,
        imageUrl: track.artworkUrl,
      });

      if (result) setTrackSaved(result.saved);
    } catch (err) {
      console.error("Could not save track", err);
      setTrackSaveError("Could not save this track.");
    }
  };

  const communityEntity = {
    type: "track" as const,
    id: trackSlug || undefined,
    slug: trackSlug || undefined,
    url: typeof window !== "undefined" ? window.location.href : `/tracks/${artistSlug}/${trackSlug}`,
    title: track.title,
    subtitle: track.artist,
    imageUrl: track.artworkUrl,
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

      <SchemaOrg
        data={{
          "@type": "MusicRecording",
          name: track.title,
          byArtist: { "@type": "MusicGroup", name: track.artist, url: track.artistSlug ? `/artists/${track.artistSlug}` : undefined },
          image: track.artworkUrl,
          duration: track.duration > 0 ? `PT${String(Math.floor(track.duration / 60))}M${String(track.duration % 60)}S` : undefined,
          datePublished: track.releaseDate || track.releaseYear,
          inAlbum: track.albumTitle ? { "@type": "MusicAlbum", name: track.albumTitle, url: `/releases/${track.artistSlug}/${track.albumSlug}` } : undefined,
          genre: track.genres.length > 0 ? track.genres : undefined,
          isrcCode: track.isrc || undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }}
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
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={!hasPlayableSource}
                  aria-label={playButtonLabel}
                  title={playButtonLabel}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] text-white px-6 py-3 text-[14px] font-extrabold hover:bg-[var(--wk-brand)]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={18} />
                  {playButtonLabel}
                </button>
                <Link to={`/tracks/${artistSlug}/${trackSlug}/lyrics/contribute`} className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] px-5 py-3 text-[13px] font-bold hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap">
                  <WkIcon name="Edit3" size={16} />
                  Contribute lyrics
                </Link>
                <button
                  type="button"
                  onClick={handleSaveTrack}
                  disabled={entityActionLoading}
                  className={`inline-flex items-center gap-2.5 rounded-xl border px-5 py-3 text-[13px] font-bold transition-colors whitespace-nowrap disabled:opacity-60 ${
                    trackSaved
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  <WkIcon name="Heart" size={16} fill={trackSaved ? "currentColor" : "none"} />
                  {entityActionLoading ? "Saving..." : trackSaved ? "Saved" : "Save track"}
                </button>
                <ShareButton item={{ title: track.title, subtitle: track.artist, description: trackIntro || seoDescription, imageUrl: track.artworkUrl, type: "track" }} />
              </div>
              {trackSaveError && (
                <p className="mt-3 text-[12px] font-bold text-red-500">
                  {trackSaveError}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="wk-container-wide px-6 pb-2">
        <ContributionBadges entityType="track" entitySlug={trackSlug} />
      </div>

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

            <TrackAlbumContextSection vm={track} />

            {/* Tracklist from the release */}
            <TrackReleaseTracklist
              artistSlug={track.artistSlug}
              currentTrackSlug={track.slug}
              albumTitle={track.albumTitle}
              tracks={track.releaseTracks}
            />

            <TrackListeningSignalPanel signal={listeningSignal} />
            <TrackMomentSummary entity={communityEntity} />

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

      <CommunitySection entity={communityEntity} user={user} />
    </main>
  );
}
