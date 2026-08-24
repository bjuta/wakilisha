import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getReleaseTrack, getTrack, type PublicTrackDetail } from "@/services/publicApi/client";
import { resolveScopedSlugRedirect } from "@/services/slugRedirects";
import { buildTrackHeroIntro, buildTrackSeoDescription } from "@/services/cultureContext/trackAdapters";
import { TrackChartSparkline } from "@/components/charts/TrackChartSparkline";
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import type { MusicRecordingSchema } from "@/components/seo/SchemaOrg";
import TrackLyricsSection from "./components/TrackLyricsSection";
import TrackRelatedTracks from "./components/TrackRelatedTracks";
import TrackReleaseTracklist from "./components/TrackReleaseTracklist";
import { releaseUrl } from "@/utils/releaseUrl";
import { releaseTrackUrl, trackUrl } from "@/utils/trackUrl";
import { WkIcon } from "@/components/design-system/Icon";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { TrackActionsMenu } from "@/components/tracks/TrackActionsMenu";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";
import { ContributionBadges } from "@/components/feature/community/ContributionBadges";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { TrackMomentSummary } from "@/components/feature/community/TrackMomentDrawer";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useEntityActions } from "@/hooks/useCommunityActions";
import { getUserSaves } from "@/services/community/service";
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
  id: string;
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
  albumArtistSlug: string;
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
  const albumArtistSlug = firstString(
    releaseData?.artistSlug,
    releaseData?.artist_slug,
    releaseData?.primaryArtistSlug,
    releaseData?.primary_artist_slug,
    trackData.releaseArtistSlug,
    trackData.release_artist_slug,
    raw.releaseArtistSlug,
    raw.release_artist_slug,
    relMetadata.primaryArtistSlug,
    relMetadata.primary_artist_slug,
    relMetadata.artistSlug,
    relMetadata.artist_slug,
    resolvedArtistSlug,
  );
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
    id: clean(trackData.id || raw.id),
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
    albumArtistSlug,
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

function TrackAlbumContextSection({
  vm,
  onPlay,
  isPlaying,
  canPlay,
}: {
  vm: TrackViewModel;
  onPlay: () => void;
  isPlaying: boolean;
  canPlay: boolean;
}) {
  if (!vm.albumTitle) return null;

  const trackActionsHref = vm.albumSlug && (vm.albumArtistSlug || vm.artistSlug)
    ? releaseTrackUrl(vm.albumArtistSlug || vm.artistSlug, vm.albumSlug, vm.slug)
    : trackUrl(vm.slug, vm.artistSlug ? [vm.artistSlug] : []);
  const artistNames = vm.artists.length > 0
    ? vm.artists.map((artist) => artist.name).filter(Boolean).join(", ")
    : vm.artist;

  return (
    <section>
      <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
        From This Release
      </div>

      <div
        className="group grid items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3.5 transition-colors hover:bg-[var(--wk-surface-raised)]"
        style={{ gridTemplateColumns: "44px minmax(0, 1fr) auto 40px" }}
      >
        <PlayableArtwork
          label={vm.title}
          onPlay={() => {
            if (canPlay) onPlay();
          }}
          isPlaying={isPlaying}
          className="h-10 w-10 overflow-hidden rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)]"
        >
          {vm.artworkUrl ? (
            <img src={vm.artworkUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <WkIcon name="Music" size={18} className="text-[var(--wk-brand)]" />
            </div>
          )}
        </PlayableArtwork>

        <div className="min-w-0">
          <div className="truncate text-[14px] font-extrabold text-[var(--wk-text)]">
            {vm.title}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
            {artistNames}
          </div>
        </div>

        {vm.duration > 0 && (
          <div className="text-[11px] font-semibold tabular-nums text-[var(--wk-text-faint)]">
            {formatDuration(vm.duration)}
          </div>
        )}

        <TrackActionsMenu
          registryTrackId={vm.id}
          trackTitle={vm.title}
          artistName={vm.artist}
          artistSlug={vm.artistSlug}
          artworkUrl={vm.artworkUrl}
          trackSlug={vm.slug}
          trackHref={trackActionsHref}
        />
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            Your Listening
          </div>
          <h2 className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] md:text-[24px]">
            {signal.playCount} play{signal.playCount === 1 ? "" : "s"} on WAKILISHA
          </h2>
          <p className="mt-1 text-[12px] font-semibold text-[var(--wk-text-muted)]">
            Last played {timeAgoShort(signal.lastPlayedAt)} · {source}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          <span><strong className="text-[var(--wk-text)]">{formatListeningProgress(signal)}</strong> progress</span>
          <span><strong className="text-[var(--wk-text)]">{signal.fullPlayCount || 0}</strong> full plays</span>
          <span><strong className="text-[var(--wk-text)]">{signal.completedCount || 0}</strong> finished</span>
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
    { label: "Peak Position", value: vm.peakPosition > 0 ? `#${vm.peakPosition}` : "Not yet" },
    { label: "Weeks Charted", value: vm.weeksOnChart || "Not yet" },
    { label: "Current Rank", value: vm.rank > 0 ? `#${vm.rank}` : "Not ranked" },
    { label: "First Seen", value: vm.firstChartedDate ? formatDate(vm.firstChartedDate) : vm.releaseYear || "Not yet" },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] md:grid-cols-4">
      {kpis.map((kpi, index) => (
        <div
          key={kpi.label}
          className={`p-4 md:p-5 ${index % 2 ? "border-l border-[var(--wk-divider)]" : ""} ${index >= 2 ? "border-t border-[var(--wk-divider)] md:border-t-0" : ""} ${index > 0 ? "md:border-l md:border-[var(--wk-divider)]" : ""}`}
        >
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            {kpi.label}
          </div>
          <div className="mt-2 text-[20px] font-black leading-none tracking-[-0.03em] text-[var(--wk-text)] md:text-[24px]">
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackSidebar({ vm }: { vm: TrackViewModel }) {
  const hasChartData = vm.weeksOnChart > 0 || vm.peakPosition > 0;
  const released = vm.releaseDate ? formatDate(vm.releaseDate) : vm.releaseYear || "Unknown";
  const trackNumber = vm.albumTrackNumber > 0
    ? `${vm.albumTrackNumber}${vm.albumTotalTracks > 0 ? ` of ${vm.albumTotalTracks}` : ""}`
    : "Unknown";

  return (
    <aside className="space-y-5 lg:sticky lg:top-[88px] lg:self-start">
      <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="Activity" size={13} />
          Track Details
        </div>
        <div className="space-y-3 text-[12px] font-semibold text-[var(--wk-text-muted)]">
          {vm.duration > 0 && <InfoRow label="Duration" value={formatDuration(vm.duration)} />}
          <InfoRow label="Released" value={released} />
          <InfoRow label="Track" value={trackNumber} />
          {vm.genre && vm.genre !== "Unknown" && <InfoRow label="Sound" value={vm.genre} />}
          {vm.label && vm.label !== "Unknown" && <InfoRow label="Label" value={vm.label} />}
        </div>
      </div>

      {(hasChartData || vm.isrc || vm.explicit || vm.isPlayable) && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="BadgeCheck" size={13} />
            Registry Details
          </div>
          <div className="space-y-3 text-[12px] font-semibold text-[var(--wk-text-muted)]">
            <InfoRow label="Charts" value={hasChartData ? "Connected" : "Not charted"} />
            <InfoRow label="Playback" value={vm.isPlayable ? "Available" : "Not available"} />
            {vm.isrc && <InfoRow label="ISRC" value={<span className="font-mono text-[11px]">{vm.isrc}</span>} />}
            {vm.explicit && <InfoRow label="Advisory" value={<span className="text-[var(--wk-danger)] text-[10px] font-bold uppercase">Explicit</span>} />}
          </div>
        </div>
      )}

      {hasChartData && vm.chartHistory.length >= 2 && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="TrendingUp" size={13} />
            Chart Movement
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
  const { artistSlug, releaseSlug, trackSlug } = useParams<{
    artistSlug: string;
    releaseSlug?: string;
    trackSlug: string;
  }>();
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
  const [shareOpen, setShareOpen] = useState(false);
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

    const cleanedPath = releaseSlug
      ? releaseTrackUrl(artistSlug, releaseSlug, cleanedTrackSlug)
      : trackUrl(cleanedTrackSlug, [artistSlug]);

    navigate(`${cleanedPath}${location.search || ""}${location.hash || ""}`, {
      replace: true,
    });
  }, [artistSlug, releaseSlug, trackSlug, navigate, location.search, location.hash]);

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

    if (user.loading) {
      return () => {
        alive = false;
      };
    }

    if (!user.id || !track?.id) {
      setTrackSaved(false);
      return () => {
        alive = false;
      };
    }

    getUserSaves(user.id)
      .then((rows) => {
        if (!alive) return;

        setTrackSaved(
          rows.some((row) => {
            const saved = row as {
              entity_type?: string;
              entity_id?: string | null;
            };

            return (
              saved.entity_type === "track" &&
              saved.entity_id === track.id
            );
          })
        );
      })
      .catch((err) => {
        if (!alive) return;
        console.error("Could not load Track Save state", err);
        setTrackSaved(false);
      });

    return () => {
      alive = false;
    };
  }, [user.id, user.loading, track?.id]);

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
    const request = releaseSlug
      ? getReleaseTrack(artistSlug, releaseSlug, trackSlug)
      : getTrack(artistSlug, trackSlug);

    request
      .then(async (apiData) => {
        if (!alive) return;
        if (!apiData) {
          const redirect = await resolveScopedSlugRedirect(
            "track",
            artistSlug,
            trackSlug,
            { releaseSlug },
          );

          if (!alive) return;

          if (redirect && redirect.newPath !== location.pathname) {
            navigate(
              `${redirect.newPath}${location.search || ""}${location.hash || ""}`,
              { replace: true },
            );
            return;
          }

          trackEvent("page_not_found", {
            pageType: "404",
            entityType: "broken_page",
            entitySlug: releaseSlug
              ? `${artistSlug || "unknown"}/${releaseSlug}/${trackSlug || "unknown"}`
              : `${artistSlug || "unknown"}/${trackSlug || "unknown"}`,
            context: {
              status_code: 404,
              not_found_path: location.pathname,
              not_found_search: location.search || "",
              not_found_hash: location.hash || "",
              route_guess: "missing_track",
              suggested_fix: cleanDirtyTrackSlug(artistSlug, trackSlug)
                ? releaseSlug
                  ? releaseTrackUrl(
                      artistSlug,
                      releaseSlug,
                      cleanDirtyTrackSlug(artistSlug, trackSlug),
                    )
                  : trackUrl(
                      cleanDirtyTrackSlug(artistSlug, trackSlug),
                      [artistSlug],
                    )
                : "",
              soft_404_surface: "track_detail",
              artist_slug: artistSlug,
              release_slug: releaseSlug || "",
              track_slug: trackSlug,
            },
          });

          setError("Track not found.");
          setLoading(false);
          return;
        }
        const nextTrack = apiToViewModel(apiData);
        const scopedArtistSlug =
          nextTrack.albumArtistSlug ||
          nextTrack.artistSlug ||
          artistSlug;
        const scopedTrackSlug =
          nextTrack.slug ||
          trackSlug;

        if (
          !releaseSlug &&
          scopedArtistSlug &&
          nextTrack.albumSlug &&
          scopedTrackSlug
        ) {
          const scopedPath = releaseTrackUrl(
            scopedArtistSlug,
            nextTrack.albumSlug,
            scopedTrackSlug,
          );

          if (scopedPath !== location.pathname) {
            navigate(
              `${scopedPath}${location.search || ""}${location.hash || ""}`,
              { replace: true },
            );
            return;
          }
        }

        setTrack(nextTrack);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError("Could not load track.");
        setLoading(false);
      });

    return () => { alive = false; };
  }, [artistSlug, releaseSlug, trackSlug, navigate, location.pathname, location.search, location.hash]);

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
  const canonicalArtistSlug =
    track.albumArtistSlug ||
    track.artistSlug ||
    artistSlug ||
    "";
  const canonicalTrackSlug =
    track.slug ||
    trackSlug ||
    "";
  const canonicalReleaseSlug =
    track.albumSlug ||
    releaseSlug ||
    "";
  const canonicalPath =
    canonicalReleaseSlug && canonicalArtistSlug
      ? releaseTrackUrl(
          canonicalArtistSlug,
          canonicalReleaseSlug,
          canonicalTrackSlug,
        )
      : trackUrl(
          canonicalTrackSlug,
          canonicalArtistSlug
            ? [canonicalArtistSlug]
            : [],
        );
  const canonicalAbsoluteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${canonicalPath}`
      : `https://wakilisha.africa${canonicalPath}`;
  const lyricsContributionPath = `${canonicalPath}/lyrics/contribute`;
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

    setTrackSaveError(null);

    try {
      const result = await saveEntityAction({
        entityType: "track",
        entityId: track.id,
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
    id: track.slug || trackSlug || undefined,
    slug: track.slug || trackSlug || undefined,
    url: canonicalAbsoluteUrl,
    title: track.title,
    subtitle: track.artist,
    imageUrl: track.artworkUrl,
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <MetaTags
        title={`${track.title} by ${track.artist}`}
        description={seoDescription}
        url={canonicalAbsoluteUrl}
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
          inAlbum: track.albumTitle ? {
            "@type": "MusicAlbum",
            name: track.albumTitle,
            url: canonicalReleaseSlug && canonicalArtistSlug
              ? `/releases/${canonicalArtistSlug}/${canonicalReleaseSlug}`
              : undefined,
          } : undefined,
          genre: track.genres.length > 0 ? track.genres : undefined,
          isrcCode: track.isrc || undefined,
          url: canonicalAbsoluteUrl,
        }}
      />

      <section className="relative -mt-16 pt-16 overflow-hidden">
        {track.artworkUrl && (
          <div className="absolute inset-0 opacity-20 scale-110" style={{ backgroundImage: `url("${track.artworkUrl}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(90px) saturate(1.4)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/70 to-[var(--wk-bg)]" />

        <div className="relative z-10 wk-container-wide px-6 py-16 md:py-24 lg:py-28">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-end">
            <PlayableArtwork
              label={track.title}
              onPlay={() => {
                if (hasPlayableSource) handlePlay();
              }}
              isPlaying={isTrackPlaying}
              className="relative shrink-0 w-[280px] md:w-[340px] lg:w-[380px] aspect-square overflow-hidden"
            >
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={`${track.title} artwork`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)]">
                  <i className="ri-music-2-line text-6xl text-[#30451f]/40" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </PlayableArtwork>

            <div className="flex-1 min-w-0 pb-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)]/60 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-5">
                <WkIcon name="Music" size={13} />
                Track
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

              <div className="mt-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={!hasPlayableSource}
                  aria-label={playButtonLabel}
                  title={playButtonLabel}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-[var(--wk-brand)]/90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={17} />
                  {playButtonLabel}
                </button>

                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/72 p-1 backdrop-blur">
                  <AddToPlaylistButton
                    trackId={track.id}
                    trackTitle={track.title}
                    reactionStyle
                  />

                  <button
                    type="button"
                    onClick={handleSaveTrack}
                    disabled={entityActionLoading}
                    aria-label={entityActionLoading ? "Saving Track" : trackSaved ? "Saved Track" : "Save Track"}
                    title={entityActionLoading ? "Saving Track" : trackSaved ? "Saved Track" : "Save Track"}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                      trackSaved
                        ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                        : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                    }`}
                  >
                    <WkIcon name="Heart" size={17} fill={trackSaved ? "currentColor" : "none"} />
                    <span className="sr-only">{trackSaved ? "Saved Track" : "Save Track"}</span>
                  </button>

                  <Link
                    to={lyricsContributionPath}
                    aria-label="Contribute Lyrics"
                    title="Contribute Lyrics"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  >
                    <WkIcon name="Edit3" size={17} />
                    <span className="sr-only">Contribute Lyrics</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                    aria-label="Share"
                    title="Share"
                  >
                    <WkIcon name="Share2" size={17} />
                    <span className="sr-only">Share</span>
                  </button>


                </div>
              </div>

              <ShareSheet
                item={{
                  title: track.title,
                  subtitle: track.artist,
                  description: trackIntro || seoDescription,
                  imageUrl: track.artworkUrl,
                  type: "track",
                }}
                open={shareOpen}
                onClose={() => setShareOpen(false)}
              />
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
            {/* Culture context: styled like ReleaseExcerpt */}
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

            <TrackAlbumContextSection
              vm={track}
              onPlay={handlePlay}
              isPlaying={isTrackPlaying}
              canPlay={hasPlayableSource}
            />

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

            <TrackLyricsSection
              trackId={track.id} trackSlug={track.slug} artistSlug={track.artistSlug} trackTitle={track.title} artistName={track.artist} lyrics={track.lyrics} lyricsContributor={track.lyricsContributor} />

            <TrackRelatedTracks trackSlug={track.slug} artistSlug={track.artistSlug} artistName={track.artist} albumSlug={track.albumSlug} albumTitle={track.albumTitle} genreSlug={track.genreSlug} genreName={track.genre} />

            {track.artists.length > 1 && <ConnectedArtists artists={track.artists} artworkUrl={track.artworkUrl} />}

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
