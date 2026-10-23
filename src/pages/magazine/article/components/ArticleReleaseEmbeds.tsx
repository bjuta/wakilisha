import { useState } from "react";
import { Link } from "react-router-dom";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { WkIcon } from "@/components/design-system/Icon";
import { usePlayer } from "@/context/PlayerContext";
import { releaseUrl, slugify } from "@/utils/releaseUrl";
import { supabase } from "@/lib/supabase";
import { RELEASE_MARKER_PREFIX } from "./ArticleEmbedUtils";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TrackEmbedData {
  title: string;
  artist: string;
  duration: string;
  trackNumber: number;
  previewUrl?: string;
  isrc?: string;
}

export interface ReleaseEmbedData {
  title: string;
  artist: string;
  artistSlug?: string;
  releaseSlug?: string;
  artworkUrl: string;
  releaseType: string;
  releaseDate: string;
  trackCount: number;
  totalDuration: string;
  labelName: string;
  tracks: TrackEmbedData[];
}

/* ------------------------------------------------------------------ */
/*  HTML pre-processing — replaces old WP release blocks with markers  */
/* ------------------------------------------------------------------ */

export function transformArticleHtmlForReleaseEmbeds(html: string): {
  markedHtml: string;
  releases: ReleaseEmbedData[];
} {
  if (!html) return { markedHtml: "", releases: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const selectors = [
    ".wk-release-embed-grid",
    ".wk-album-grid",
    ".wk-release-embed-grid--editorial",
    ".wk-release-embed-card--feature",
  ];
  const embedBlocks: Element[] = [];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach((el) => {
      if (!embedBlocks.includes(el)) embedBlocks.push(el);
    });
  }

  const releases: ReleaseEmbedData[] = [];

  embedBlocks.forEach((block, idx) => {
    const release = extractReleaseFromEmbed(block);
    if (!release) return;

    const marker = doc.createComment(`${RELEASE_MARKER_PREFIX}${idx}`);

    // Clean up associated modals
    const modalPattern = "wk-embed-album-";
    doc.querySelectorAll(`[id^="${modalPattern}"]`).forEach((m) => m.remove());
    doc.querySelectorAll(".wk-album-modal").forEach((m) => m.remove());

    block.replaceWith(marker);
    releases.push(release);
  });

  return { markedHtml: doc.body.innerHTML, releases };
}

function extractReleaseFromEmbed(block: Element): ReleaseEmbedData | null {
  const titleEl = block.querySelector(".wk-release-embed-title, .wk-album-modal__title");
  const artistEl = block.querySelector(".wk-release-embed-artist");
  const imgEl = block.querySelector(".wk-release-embed-cover img, .wk-album-modal__art img, img");
  const metaEl = block.querySelector(".wk-release-embed-meta, .wk-track-meta");

  const title = titleEl?.textContent?.trim() || "";
  const artist = artistEl?.textContent?.trim() || "";
  const artworkUrl = imgEl?.getAttribute("src") || "";

  if (!title || !artworkUrl) return null;

  let releaseType = "Album";
  let releaseDate = "";
  let trackCount = 0;
  let totalDuration = "";
  let labelName = "";

  if (metaEl) {
    const spans = metaEl.querySelectorAll("span");
    const texts = Array.from(spans).map((s) => s.textContent?.trim() || "");
    if (texts.length >= 1) releaseType = texts[0] || "Album";
    if (texts.length >= 2) releaseDate = texts[1] || "";
    if (texts.length >= 3) {
      const tcMatch = texts[2].match(/(\d+)/);
      if (tcMatch) trackCount = parseInt(tcMatch[1], 10);
    }
    if (texts.length >= 4) totalDuration = texts[3] || "";
    if (texts.length >= 5) labelName = texts[4] || "";
  }

  const tracks: TrackEmbedData[] = [];
  const trackRows = block.querySelectorAll(
    ".wk-release-embed-track-item, .wk-album-track-row, .wk-chart-discovery-item"
  );

  trackRows.forEach((row) => {
    const noEl = row.querySelector(
      ".wk-release-embed-track-item__no span, .wk-album-track-no, .wk-chart-discovery-item__art span"
    );
    const bodyEl = row.querySelector(
      ".wk-release-embed-track-item__body, .wk-album-track-copy, .wk-chart-discovery-item__body"
    );
    const metaEl2 = row.querySelector(
      ".wk-release-embed-track-item__meta, .wk-album-track-meta, .wk-chart-discovery-item__meta"
    );
    const previewBtn = row.querySelector("button[data-preview-url]");

    const trackNo = parseInt(noEl?.textContent?.trim() || "0", 10);
    const strongEl = bodyEl?.querySelector("strong, .wk-track-title");
    const trackTitle = strongEl?.textContent?.trim() || bodyEl?.textContent?.trim() || "";
    const artistSpan = bodyEl?.querySelector("span, .wk-track-artist");
    const trackArtist = artistSpan?.textContent?.trim() || artist;
    const duration =
      metaEl2?.querySelector(".wk-album-track-duration, span")?.textContent?.trim() || "";
    const previewUrl = previewBtn?.getAttribute("data-preview-url") || undefined;
    const isrc = previewBtn?.getAttribute("data-isrc") || undefined;

    if (trackTitle) {
      tracks.push({
        title: trackTitle,
        artist: trackArtist,
        duration,
        trackNumber: trackNo || tracks.length + 1,
        previewUrl,
        isrc,
      });
    }
  });

  let artistSlug: string | undefined;
  const artistLink = block.querySelector(".wk-release-embed-artist-link, a[href*='/artists/']");
  if (artistLink) {
    const href = artistLink.getAttribute("href") || "";
    const match = href.match(/\/artists\/([^/]+)/);
    if (match) artistSlug = match[1];
  }
  if (!artistSlug && artist) {
    artistSlug = slugify(artist);
  }

  let releaseSlug: string | undefined;
  const trigger = block.querySelector("[data-wk-album-modal-trigger]");
  if (trigger) {
    const id = trigger.getAttribute("data-wk-album-modal-trigger") || "";
    if (id) {
      releaseSlug = slugify(title);
    }
  }

  return {
    title,
    artist,
    artistSlug,
    releaseSlug,
    artworkUrl,
    releaseType,
    releaseDate,
    trackCount,
    totalDuration,
    labelName,
    tracks,
  };
}

/* ------------------------------------------------------------------ */
/*  Duration helpers                                                   */
/* ------------------------------------------------------------------ */

function parseDuration(dur: string): number {
  const parts = dur.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Registry enrichment — replaces WP-scraped data with registry data  */
/* ------------------------------------------------------------------ */

async function enrichReleaseFromRegistry(
  release: ReleaseEmbedData,
): Promise<ReleaseEmbedData | null> {
  if (!release.title || !release.artist) return null;

  try {
    const normalizedTitle = slugify(release.title);
    const { data: candidates } = await supabase
      .from("registry_releases")
      .select("id, slug, title, release_type, release_date, artwork_url, label_id, description, metadata")
      .eq("status", "active")
      .or(`slug.eq.${normalizedTitle},normalized_title.ilike.${release.title.replace(/%/g, "")}`)
      .limit(8);

    if (!candidates?.length) return null;

    for (const row of candidates) {
      const { data: artists } = await supabase
        .from("registry_release_artists")
        .select("artist_name_text, artist_slug, is_primary")
        .eq("release_id", row.id)
        .eq("status", "active")
        .eq("is_primary", true);

      const primary = artists?.[0];
      if (!primary) continue;

      const artistMatch =
        slugify(primary.artist_name_text || "") === slugify(release.artist) ||
        (primary.artist_slug || "").toLowerCase() === slugify(release.artist);

      if (!artistMatch) continue;

      // Fetch tracklist
      const { data: relTracks } = await supabase
        .from("registry_release_tracks")
        .select("track_id, track_number")
        .eq("release_id", row.id)
        .order("track_number", { ascending: true });

      const trackIds = (relTracks || []).map((rt) => rt.track_id).filter(Boolean);

      let tracks: TrackEmbedData[] = [];
      if (trackIds.length > 0) {
        const { data: trackRows } = await supabase
          .from("registry_tracks")
          .select("id, slug, title, duration_ms, preview_url")
          .in("id", trackIds)
          .eq("status", "active");

        const tracksById = new Map((trackRows || []).map((t) => [t.id, t]));

        const { data: trackArtists } = await supabase
          .from("registry_track_artists")
          .select("track_id, artist_name_text, artist_slug, is_primary, is_featured")
          .in("track_id", trackIds)
          .eq("status", "active");

        const artistsByTrack = new Map<string, string[]>();
        for (const ta of (trackArtists || [])) {
          if (!artistsByTrack.has(ta.track_id)) artistsByTrack.set(ta.track_id, []);
          artistsByTrack.get(ta.track_id)!.push(
            ta.artist_name_text || ta.artist_slug || "",
          );
        }

        tracks = (relTracks || []).map((rt, idx) => {
          const t = tracksById.get(rt.track_id);
          if (!t) return null;
          const trackArtistNames = artistsByTrack.get(rt.track_id) || [];
          const durationSecs = t.duration_ms ? Math.round(t.duration_ms / 1000) : 0;
          const mins = Math.floor(durationSecs / 60);
          const secs = durationSecs % 60;
          return {
            title: t.title || "",
            artist: trackArtistNames.filter((a) => slugify(a) !== slugify(release.artist)).join(", ") || release.artist,
            duration: `${mins}:${String(secs).padStart(2, "0")}`,
            trackNumber: rt.track_number || idx + 1,
            previewUrl: t.preview_url || undefined,
            isrc: undefined,
          };
        }).filter(Boolean) as TrackEmbedData[];
      }

      // Resolve label name
      let labelName = "Independent";
      if (row.label_id) {
        const { data: labelRow } = await supabase
          .from("registry_labels")
          .select("name")
          .eq("id", row.label_id)
          .maybeSingle();
        if (labelRow?.name) labelName = String(labelRow.name);
      } else {
        const meta = (row.metadata || {}) as Record<string, unknown>;
        if (meta.record_label) labelName = String(meta.record_label);
      }

      const totalSecs = tracks.reduce((sum, t) => {
        const [m, s] = t.duration.split(":").map(Number);
        return sum + (m || 0) * 60 + (s || 0);
      }, 0);
      const totalMins = Math.floor(totalSecs / 60);
      const totalSecsRem = totalSecs % 60;

      return {
        title: row.title,
        artist: primary.artist_name_text || release.artist,
        artistSlug: primary.artist_slug || slugify(release.artist),
        releaseSlug: row.slug,
        artworkUrl: row.artwork_url || release.artworkUrl,
        releaseType: row.release_type || release.releaseType || "Album",
        releaseDate: row.release_date || release.releaseDate || "",
        trackCount: tracks.length,
        totalDuration: `${totalMins}:${String(totalSecsRem).padStart(2, "0")}`,
        labelName,
        tracks,
      };
    }

    return null;
  } catch (err) {
    console.warn("Registry release enrichment failed:", err);
    return null;
  }
}

export async function enrichAllReleasesFromRegistry(
  releases: ReleaseEmbedData[],
): Promise<ReleaseEmbedData[]> {
  if (!releases.length) return releases;
  const enriched = await Promise.all(
    releases.map(async (r) => {
      const registryData = await enrichReleaseFromRegistry(r);
      return registryData || r;
    }),
  );
  return enriched;
}

/* ------------------------------------------------------------------ */
/*  Registry marker resolver  —  embeds placed from the admin editor   */
/* ------------------------------------------------------------------ */

const REGISTRY_MARKER_RE = /<!--WK_REGISTRY_RELEASE:([^:]+):([^:]*):([^>]*)-->/g;

/**
 * Scans HTML for registry-release markers inserted by the admin editor,
 * fetches release data from Supabase, and merges them into the existing
 * releases array with proper segment markers.
 */
export async function resolveRegistryReleaseMarkers(
  markedHtml: string,
  existingReleases: ReleaseEmbedData[],
): Promise<{ markedHtml: string; releases: ReleaseEmbedData[] }> {
  const markers: Array<{ fullMatch: string; slug: string; artistSlug: string; artistName: string }> = [];

  let m: RegExpExecArray | null;
  const re = new RegExp(REGISTRY_MARKER_RE.source, "g");
  while ((m = re.exec(markedHtml)) !== null) {
    markers.push({
      fullMatch: m[0],
      slug: m[1],
      artistSlug: m[2] || "",
      artistName: decodeURIComponent(m[3] || ""),
    });
  }

  if (!markers.length) {
    return { markedHtml, releases: existingReleases };
  }

  // Fetch release data for each marker
  const slugs = markers.map((mk) => mk.slug);
  const { data: releaseRows } = await supabase
    .from("registry_releases")
    .select("id, slug, title, release_type, release_date, artwork_url, label_id, description, metadata")
    .eq("status", "active")
    .in("slug", slugs);

  if (!releaseRows?.length) {
    // No registry data — strip markers, return unchanged
    let stripped = markedHtml;
    for (const mk of markers) {
      stripped = stripped.replace(mk.fullMatch, "");
    }
    return { markedHtml: stripped, releases: existingReleases };
  }

  const releasesById = new Map(releaseRows.map((r) => [r.slug, r]));
  const newReleases: ReleaseEmbedData[] = [...existingReleases];
  let resultHtml = markedHtml;

  for (const mk of markers) {
    const row = releasesById.get(mk.slug);
    if (!row) {
      resultHtml = resultHtml.replace(mk.fullMatch, "");
      continue;
    }

    // Fetch primary artist if not already provided in the marker
    let artistName = mk.artistName;
    let artistSlug = mk.artistSlug;

    if (!artistName || !artistSlug) {
      const { data: artistLinks } = await supabase
        .from("registry_release_artists")
        .select("artist_name_text, artist_slug")
        .eq("release_id", row.id)
        .eq("is_primary", true)
        .eq("status", "active")
        .limit(1);

      if (artistLinks?.[0]) {
        artistName = artistLinks[0].artist_name_text || artistName;
        artistSlug = artistLinks[0].artist_slug || artistSlug;
      }
    }

    if (!artistName) {
      resultHtml = resultHtml.replace(mk.fullMatch, "");
      continue;
    }

    // Fetch tracklist
    const { data: relTracks } = await supabase
      .from("registry_release_tracks")
      .select("track_id, track_number")
      .eq("release_id", row.id)
      .order("track_number", { ascending: true });

    const trackIds = (relTracks || []).map((rt) => rt.track_id).filter(Boolean);

    let tracks: TrackEmbedData[] = [];

    if (trackIds.length > 0) {
      const { data: trackRows } = await supabase
        .from("registry_tracks")
        .select("id, slug, title, duration_ms, preview_url")
        .in("id", trackIds)
        .eq("status", "active");

      const tracksById = new Map((trackRows || []).map((t) => [t.id, t]));

      const { data: trackArtists } = await supabase
        .from("registry_track_artists")
        .select("track_id, artist_name_text, artist_slug, is_primary, is_featured")
        .in("track_id", trackIds)
        .eq("status", "active");

      const artistsByTrack = new Map<string, string[]>();
      for (const ta of (trackArtists || [])) {
        if (!artistsByTrack.has(ta.track_id)) artistsByTrack.set(ta.track_id, []);
        artistsByTrack.get(ta.track_id)!.push(
          ta.artist_name_text || ta.artist_slug || "",
        );
      }

      tracks = (relTracks || []).map((rt, idx) => {
        const t = tracksById.get(rt.track_id);
        if (!t) return null;
        const trackArtistNames = artistsByTrack.get(rt.track_id) || [];
        const durationSecs = t.duration_ms ? Math.round(t.duration_ms / 1000) : 0;
        const mins = Math.floor(durationSecs / 60);
        const secs = durationSecs % 60;
        return {
          title: t.title || "",
          artist: trackArtistNames.filter((a) => slugify(a) !== slugify(artistName)).join(", ") || artistName,
          duration: `${mins}:${String(secs).padStart(2, "0")}`,
          trackNumber: rt.track_number || idx + 1,
          previewUrl: t.preview_url || undefined,
          isrc: undefined,
        };
      }).filter(Boolean) as TrackEmbedData[];
    }

    // Resolve label name
    let labelName = "Independent";
    if (row.label_id) {
      const { data: labelRow } = await supabase
        .from("registry_labels")
        .select("name")
        .eq("id", row.label_id)
        .maybeSingle();
      if (labelRow?.name) labelName = String(labelRow.name);
    } else {
      const meta = (row.metadata || {}) as Record<string, unknown>;
      if (meta?.record_label) labelName = String(meta.record_label);
    }

    const totalSecs = tracks.reduce((sum, t) => {
      const [m, s] = t.duration.split(":").map(Number);
      return sum + (m || 0) * 60 + (s || 0);
    }, 0);
    const totalMins = Math.floor(totalSecs / 60);
    const totalSecsRem = totalSecs % 60;

    const releaseData: ReleaseEmbedData = {
      title: row.title,
      artist: artistName,
      artistSlug: artistSlug || slugify(artistName),
      releaseSlug: row.slug,
      artworkUrl: row.artwork_url || "",
      releaseType: row.release_type || "Release",
      releaseDate: row.release_date || "",
      trackCount: tracks.length,
      totalDuration: `${totalMins}:${String(totalSecsRem).padStart(2, "0")}`,
      labelName,
      tracks,
    };

    const markerIdx = newReleases.length;
    const markerComment = `<!--${RELEASE_MARKER_PREFIX}${markerIdx}-->`;
    resultHtml = resultHtml.replace(mk.fullMatch, markerComment);
    newReleases.push(releaseData);
  }

  return { markedHtml: resultHtml, releases: newReleases };
}

/* ------------------------------------------------------------------ */
/*  Release Embed Card                                                 */
/* ------------------------------------------------------------------ */

export function ReleaseEmbedCard({ release, articleSlug }: { release: ReleaseEmbedData; articleSlug?: string }) {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [expanded, setExpanded] = useState(false);

  const resolvedReleaseUrl =
    release.trackCount > 1 &&
    release.releaseSlug &&
    release.artist
      ? releaseUrl({
          slug: release.releaseSlug,
          artist: release.artist,
          artistSlug: release.artistSlug,
          trackCount: release.trackCount,
          releaseType: release.releaseType,
        })
      : undefined;

  const artistUrl = release.artistSlug
    ? `/artists/${release.artistSlug}`
    : undefined;

  const buildQueue = () =>
    release.tracks
      .filter((t) => t.previewUrl)
      .map((t) => ({
        id: t.isrc || `${release.title}-${t.title}`,
        title: t.title,
        artist: t.artist,
        artworkUrl: release.artworkUrl,
        duration: parseDuration(t.duration),
        previewUrl: t.previewUrl!,
        album: release.title,
      }));

  const handlePlayTrack = (track: TrackEmbedData, trackIndex: number) => {
    if (!track.previewUrl) return;

    const queueTracks = buildQueue();

    const playerTrack = {
      id: track.isrc || `${release.title}-${track.title}`,
      title: track.title,
      artist: track.artist,
      artworkUrl: release.artworkUrl,
      duration: parseDuration(track.duration),
      previewUrl: track.previewUrl,
      album: release.title,
    };

    // If this is the currently playing track, toggle play/pause
    if (currentTrack?.id === playerTrack.id) {
      togglePlay();
      return;
    }

    playTrack(playerTrack, queueTracks, articleSlug ? {
        pageType: "article",
        entitySlug: articleSlug,
        entityType: "article",
        sourceSection: "article_body",
      } : undefined);
  };

  const handlePlayReleasePreview = () => {
    const queueTracks = buildQueue();
    const firstTrack = queueTracks[0];
    if (!firstTrack) return;

    if (currentTrack?.id === firstTrack.id) {
      togglePlay();
      return;
    }

    playTrack(firstTrack, queueTracks, articleSlug ? {
        pageType: "article",
        entitySlug: articleSlug,
        entityType: "article",
        sourceSection: "article_body",
      } : undefined);
  };

  const displayTracks = expanded ? release.tracks : release.tracks.slice(0, 3);
  const hasPreview = release.tracks.some((track) => Boolean(track.previewUrl));

  return (
    <section data-wk-article-media="release"
      className="my-8 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)]">
      <div className="flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4">
        <PlayableArtwork label={release.title}
          onPlay={(event) => { event.stopPropagation(); handlePlayReleasePreview(); }}
          disabled={!hasPreview}
          isPlaying={Boolean(currentTrack && release.tracks.some((track) =>
            currentTrack.id === (track.isrc || `${release.title}-${track.title}`))) && isPlaying}
          className="h-[76px] w-[76px] shrink-0 rounded-xl bg-[var(--wk-surface-raised)] sm:h-[96px] sm:w-[96px]">
          {release.artworkUrl ? (
            <img src={release.artworkUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center"><WkIcon name="Disc3" size={28} /></span>
          )}
        </PlayableArtwork>
        <div className="min-w-0 flex-1">
          {resolvedReleaseUrl ? (
            <Link to={resolvedReleaseUrl}
              className="block truncate text-[16px] font-bold leading-tight hover:underline sm:text-[19px]">{release.title}</Link>
          ) : <h3 className="truncate text-[16px] font-bold leading-tight sm:text-[19px]">{release.title}</h3>}
          <div className="mt-1 truncate text-[13px] text-[var(--wk-text-muted)]">
            {artistUrl ? <Link to={artistUrl} className="hover:underline">{release.artist}</Link> : release.artist}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--wk-text-faint)]">
            <span>{release.releaseType}</span>
            {release.releaseDate ? <span>{release.releaseDate}</span> : null}
            {release.trackCount > 0 ? <span>{release.trackCount} tracks</span> : null}
            {hasPreview ? <span className="text-[#A86D21]">Previews available</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {hasPreview ? (
            <button type="button" onClick={handlePlayReleasePreview} aria-label={`Play ${release.title} previews`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)]">
              <WkIcon name="Play" size={20} />
            </button>
          ) : null}
          {resolvedReleaseUrl ? (
            <Link to={resolvedReleaseUrl} title="Open release" aria-label={`Open ${release.title}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
              <WkIcon name="ArrowUpRight" size={20} />
            </Link>
          ) : null}
        </div>
      </div>
      {release.tracks.length > 0 ? (
        <div className="border-t border-[var(--wk-border)]">
          {displayTracks.map((track, idx) => {
            const trackId = track.isrc || `${release.title}-${track.title}`;
            const playingThis = currentTrack?.id === trackId && isPlaying;
            return (
              <div key={`${trackId}-${idx}`}
                className="flex min-h-12 items-center gap-3 border-b border-[var(--wk-border)]/60 px-3 py-2 last:border-b-0 sm:px-4">
                <span className="w-6 shrink-0 text-center text-[12px] tabular-nums text-[var(--wk-text-faint)]">{track.trackNumber}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{track.title}</div>
                  <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{track.artist}</div>
                </div>
                {track.duration ? <span className="text-[11px] tabular-nums text-[var(--wk-text-faint)]">{track.duration}</span> : null}
                {track.previewUrl ? (
                  <button type="button" onClick={() => handlePlayTrack(track, idx)}
                    aria-label={`${playingThis ? "Pause" : "Preview"} ${track.title}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]">
                    <WkIcon name={playingThis ? "Pause" : "Play"} size={18} />
                  </button>
                ) : null}
              </div>
            );
          })}
          {release.tracks.length > 3 ? (
            <button type="button" onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-[var(--wk-border)] px-4 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
              {expanded ? "Show fewer tracks" : `View all ${release.tracks.length} tracks`}
              <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy wrapper — kept for compat, unused now but safe to keep      */
/* ------------------------------------------------------------------ */

export function ArticleReleaseEmbeds({
  releases,
  articleSlug,
}: {
  segments?: never;
  releases: ReleaseEmbedData[];
  articleSlug?: string;
}) {
  if (releases.length === 0) return null;
  return (
    <>
      {releases.map((release, i) => (
        <ReleaseEmbedCard key={`release-${i}`} release={release} articleSlug={articleSlug} />
      ))}
    </>
  );
}