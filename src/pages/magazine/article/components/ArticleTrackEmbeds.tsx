import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/utils/releaseUrl";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";
import { WkIcon } from "@/components/design-system/Icon";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TrackEmbedData {
  id: string;
  slug: string;
  title: string;
  artistName: string;
  artistSlug?: string;
  durationMs?: number;
  previewUrl?: string;
  appleMusicId?: string | null;
  appleMusicCatalogId?: string | null;
  artworkUrl?: string;
  primaryGenre?: string;
  labelName?: string;
}

/* ------------------------------------------------------------------ */
/*  Marker constants                                                   */
/* ------------------------------------------------------------------ */

export const TRACK_MARKER_PREFIX = "WK_TRACK_";

const REGISTRY_MARKER_RE = /<!--WK_REGISTRY_TRACK:([^:>]+)-->/g;

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNested(record: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, record);
}

function readAppleMusicCatalogId(row: { metadata?: unknown }): string | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;

  return firstString(
    meta.apple_music_track_id,
    meta.apple_music_id,
    meta.appleMusicId,
    meta.apple_music_catalog_id,
    meta.appleMusicCatalogId,
    readNested(meta, ["apple_music", "id"]),
    readNested(meta, ["apple_music", "catalog_id"]),
    readNested(meta, ["appleMusic", "id"]),
    readNested(meta, ["appleMusic", "catalogId"]),
    readNested(meta, ["providers", "apple_music", "id"]),
    readNested(meta, ["providers", "apple_music", "catalog_id"]),
    readNested(meta, ["provider_ids", "apple_music"]),
    readNested(meta, ["source_ids", "apple_music"])
  );
}


/* ------------------------------------------------------------------ */
/*  Registry marker resolver                                           */
/* ------------------------------------------------------------------ */

/**
 * Scans HTML for track registry markers, fetches track data from Supabase,
 * and returns resolved track embeds with proper segment markers.
 */
export async function resolveTrackMarkers(
  markedHtml: string,
): Promise<{ markedHtml: string; tracks: TrackEmbedData[] }> {
  const markers: Array<{ fullMatch: string; slug: string }> = [];

  let m: RegExpExecArray | null;
  const re = new RegExp(REGISTRY_MARKER_RE.source, "g");
  while ((m = re.exec(markedHtml)) !== null) {
    markers.push({ fullMatch: m[0], slug: m[1] });
  }

  if (!markers.length) {
    return { markedHtml, tracks: [] };
  }

  // Fetch track data for each marker
  const slugs = markers.map((mk) => mk.slug);
  const { data: trackRows } = await supabase
    .from("registry_tracks")
    .select("id, slug, title, duration_ms, preview_url, artwork_url, metadata")
    .eq("status", "active")
    .in("slug", slugs);

  if (!trackRows?.length) {
    let stripped = markedHtml;
    for (const mk of markers) {
      stripped = stripped.replace(mk.fullMatch, "");
    }
    return { markedHtml: stripped, tracks: [] };
  }

  const tracksBySlug = new Map(trackRows.map((t) => [t.slug, t]));
  const trackIds = trackRows.map((t) => t.id);

  // Fetch primary artists
  const { data: trackArtists } = await supabase
    .from("registry_track_artists")
    .select("track_id, artist_name_text, artist_slug")
    .in("track_id", trackIds)
    .eq("is_primary", true)
    .eq("status", "active");

  const artistByTrackId: Record<string, { name: string; slug: string }> = {};
  (trackArtists || []).forEach((ta) => {
    if (!artistByTrackId[ta.track_id]) {
      artistByTrackId[ta.track_id] = { name: ta.artist_name_text || "Unknown", slug: ta.artist_slug || "" };
    }
  });

  // Fetch Release context through the canonical Track membership table.
  const releaseIdByTrackId = new Map<string, string>();
  const { data: releaseMemberships } = await supabase
    .from("registry_release_tracks")
    .select("track_id, release_id")
    .in("track_id", trackIds)
    .eq("status", "active")
    .order("disc_number", { ascending: true })
    .order("track_number", { ascending: true });

  for (const membership of releaseMemberships || []) {
    const trackId = String(membership.track_id || "");
    const releaseId = String(membership.release_id || "");

    if (
      !trackId ||
      !releaseId ||
      releaseIdByTrackId.has(trackId)
    ) {
      continue;
    }

    releaseIdByTrackId.set(trackId, releaseId);
  }

  // Fetch label info from releases
  const releaseIds = [
    ...new Set(releaseIdByTrackId.values()),
  ];
  let releaseLabelMap: Record<string, string> = {};
  if (releaseIds.length > 0) {
    const { data: releases } = await supabase
      .from("registry_releases")
      .select("id, metadata")
      .in("id", releaseIds)
      .eq("status", "active");
    (releases || []).forEach((r) => {
      const meta = (r.metadata as Record<string, unknown>) || {};
      const label = typeof meta.record_label === "string" ? meta.record_label : "";
      if (label) releaseLabelMap[r.id] = label;
    });
  }

  // Fetch artist metadata for genre
  const artistSlugs = [...new Set((trackArtists || []).map((ta) => ta.artist_slug).filter(Boolean))] as string[];
  let artistGenreMap: Record<string, string> = {};
  if (artistSlugs.length > 0) {
    const { data: artistsWithGenres } = await supabase
      .from("registry_artists")
      .select("slug, metadata")
      .in("slug", artistSlugs)
      .eq("status", "active");
    (artistsWithGenres || []).forEach((a) => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      const genres = Array.isArray(meta.genres) ? (meta.genres as string[]) : [];
      if (genres.length > 0) artistGenreMap[a.slug] = genres[0];
    });
  }

  const newTracks: TrackEmbedData[] = [];
  let resultHtml = markedHtml;

  for (const mk of markers) {
    const row = tracksBySlug.get(mk.slug);
    if (!row) {
      resultHtml = resultHtml.replace(mk.fullMatch, "");
      continue;
    }

    const artistInfo = artistByTrackId[row.id];
    const artistSlug = artistInfo?.slug || "";
    const primaryGenre = artistGenreMap[artistSlug] || "";

    const appleMusicCatalogId = readAppleMusicCatalogId(row);

    const trackData: TrackEmbedData = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      artistName: artistInfo?.name || "Unknown",
      artistSlug,
      durationMs: row.duration_ms || undefined,
      previewUrl: row.preview_url || undefined,
      appleMusicId: appleMusicCatalogId,
      appleMusicCatalogId,
      artworkUrl: row.artwork_url || undefined,
      primaryGenre,
      labelName: releaseIdByTrackId.get(row.id)
        ? (releaseLabelMap[releaseIdByTrackId.get(row.id)!] || undefined)
        : undefined,
    };

    const trackIdx = newTracks.length;
    const markerComment = `<!--${TRACK_MARKER_PREFIX}${trackIdx}-->`;
    resultHtml = resultHtml.replace(mk.fullMatch, markerComment);
    newTracks.push(trackData);
  }

  return { markedHtml: resultHtml, tracks: newTracks };
}

/* ------------------------------------------------------------------ */
/*  Duration helpers                                                   */
/* ------------------------------------------------------------------ */

function formatDuration(ms?: number): string {
  if (!ms) return "";
  const totalSecs = Math.round(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Track Embed Card (inline, compact)                                  */
/* ------------------------------------------------------------------ */

export function TrackEmbedCard({ track, articleSlug }: { track: TrackEmbedData; articleSlug?: string }) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const trackUrl = track.artistSlug
    ? `/tracks/${track.artistSlug}/${track.slug}`
    : `/tracks/${track.slug}`;
  const artistUrl = track.artistSlug ? `/artists/${track.artistSlug}` : null;
  const hasPlayableSource = Boolean(
    track.previewUrl || track.appleMusicCatalogId || track.appleMusicId,
  );
  const active = currentTrack?.id === track.slug;

  const handlePlayTrack = () => {
    if (!hasPlayableSource) return;
    const playerTrack = {
      id: track.slug,
      registryTrackId: track.id,
      title: track.title,
      artist: track.artistName,
      artworkUrl: track.artworkUrl || "",
      duration: track.durationMs ? Math.round(track.durationMs / 1000) : 0,
      previewUrl: track.previewUrl,
      appleMusicId: track.appleMusicId || track.appleMusicCatalogId || null,
      appleMusicCatalogId: track.appleMusicCatalogId || track.appleMusicId || null,
      album: track.labelName || "",
      artistSlug: track.artistSlug,
      trackSlug: track.slug,
      isPlayable: true,
    };
    if (active) { togglePlay(); return; }
    playTrack(playerTrack, [playerTrack], articleSlug ? {
      pageType: "article",
      entitySlug: articleSlug,
      entityType: "article",
      sourceSection: "article_body",
    } : undefined);
  };

  return (
    <div data-wk-article-media="track"
      className="my-7 flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-[var(--wk-text)] sm:gap-4 sm:p-4">
      <PlayableArtwork
        label={track.title}
        onPlay={(event) => { event.stopPropagation(); handlePlayTrack(); }}
        isPlaying={active && isPlaying}
        disabled={!hasPlayableSource}
        className="h-16 w-16 shrink-0 rounded-xl bg-[var(--wk-surface-raised)] sm:h-[72px] sm:w-[72px]"
      >
        {track.artworkUrl
          ? <img src={track.artworkUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          : <Ch19GradientImage slug={track.slug} name={track.title} />}
      </PlayableArtwork>

      <div className="min-w-0 flex-1">
        <Link to={trackUrl}
          className="block truncate text-[15px] font-bold leading-snug text-[var(--wk-text)] hover:underline sm:text-[16px]">
          {track.title}
        </Link>
        <div className="mt-1 truncate text-[13px] text-[var(--wk-text-muted)]">
          {artistUrl ? <Link to={artistUrl} className="hover:underline">{track.artistName}</Link> : track.artistName}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--wk-text-faint)]">
          {track.previewUrl ? <span className="font-semibold text-[#A86D21] dark:text-[#D6A054]">Preview</span>
            : hasPlayableSource ? <span>Apple Music</span> : <span>Unavailable</span>}
          {track.primaryGenre ? <span>{track.primaryGenre}</span> : null}
          {track.durationMs ? <span className="tabular-nums">{formatDuration(track.durationMs)}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <AddToPlaylistButton trackId={track.id} trackTitle={track.title} compact iconOnly />
        <Link to={trackUrl} title={`Open ${track.title}`} aria-label={`Open ${track.title}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]">
          <WkIcon name="ArrowUpRight" size={19} />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy wrapper                                                    */
/* ------------------------------------------------------------------ */

export function ArticleTrackEmbeds({
  tracks,
  articleSlug,
}: {
  tracks: TrackEmbedData[];
  articleSlug?: string;
}) {
  if (tracks.length === 0) return null;
  return (
    <>
      {tracks.map((track, i) => (
        <TrackEmbedCard key={`track-${i}`} track={track} articleSlug={articleSlug} />
      ))}
    </>
  );
}