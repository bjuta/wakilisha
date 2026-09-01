
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { canonicalTrackSlugCandidate } from "../_shared/registry-track-identity.ts";

const SITE_BASE = "https://wakilisha.africa";

type TrackData = {
  title: string;
  artist: string;
  isrc: string | null;
  duration: string | null;
  duration_ms: number | null;
  trackNumber: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
};

type ReleaseData = {
  title: string;
  slug: string;
  releaseType: string;
  releaseDate: string | null;
  year: string | null;
  artworkUrl: string | null;
  durationStr: string | null;
  trackCount: number;
  tracks: TrackData[];
};

type AppearsOnData = {
  title: string;
  artworkUrl: string | null;
  primaryArtist: string;
  releaseType: string;
  releaseDate: string | null;
  tracks: TrackData[];
};

type ArtistScrapeResult = {
  slug: string;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  genres: string[];
  country: string | null;
  spotifyUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  topSongs: Array<{ title: string; artist: string; artworkUrl: string | null; previewUrl: string | null }>;
  releases: ReleaseData[];
  appearsOn: AppearsOnData[];
  relatedArtists: string[];
  videos: Array<{ title: string; youtubeId: string; thumbnail: string }>;
};

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function normalizeForMatch(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

function parseDurationMs(str: string | null): number | null {
  if (!str) return null;
  const match = str.match(/(\d+):(\d{2})/);
  if (!match) return null;
  return (parseInt(match[1], 10) * 60 + parseInt(match[2], 10)) * 1000;
}

function dedupeSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) { seen.add(base); return base; }
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  const s = `${base}-${i}`;
  seen.add(s);
  return s;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function stripLeadingGt(s: string): string {
  return s.replace(/^\s*>\s*/, "");
}

function splitIntoSections(html: string): string[] {
  const sections: string[] = [];
  let pos = 0;
  while (pos < html.length) {
    const start = html.indexOf("<section", pos);
    if (start === -1) break;
    let depth = 1;
    let cursor = start + 1;
    while (cursor < html.length && depth > 0) {
      const nextOpen = html.indexOf("<section", cursor);
      const nextClose = html.indexOf("</section>", cursor);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        cursor = nextOpen + 1;
      } else {
        depth--;
        cursor = nextClose + "</section>".length;
      }
    }
    sections.push(html.slice(start, cursor));
    pos = cursor;
  }
  return sections;
}

function parseReleaseMeta(metaStr: string): { releaseDate: string | null; year: string | null; trackCount: number; durationStr: string | null; releaseType: string } {
  const parts = metaStr.split("\u00B7").map(s => s.trim());
  const releaseTypeRaw = (parts[0] || "").toLowerCase();
  let releaseType = "album";
  if (releaseTypeRaw.includes("single")) releaseType = "single";
  else if (releaseTypeRaw.includes("ep")) releaseType = "ep";
  else if (releaseTypeRaw.includes("compilation")) releaseType = "compilation";
  else if (releaseTypeRaw.includes("mixtape")) releaseType = "mixtape";

  let releaseDate: string | null = null;
  let year: string | null = null;
  let trackCount = 0;
  let durationStr: string | null = null;

  for (const part of parts.slice(1)) {
    const dateMatch = part.match(/(\d+)\s+(\w+)\s+(\d{4})/);
    if (dateMatch) {
      const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
      const monthKey = dateMatch[2].slice(0, 3).toLowerCase();
      const month = months[monthKey] || "01";
      const day = dateMatch[1].padStart(2, "0");
      releaseDate = `${dateMatch[3]}-${month}-${day}`;
      year = dateMatch[3];
      continue;
    }
    const trackMatch = part.match(/(\d+)\s+track/);
    if (trackMatch) { trackCount = parseInt(trackMatch[1], 10); continue; }
    if (part.match(/\d+:\d{2}/)) { durationStr = part.trim(); }
  }

  return { releaseDate, year, trackCount, durationStr, releaseType };
}

function splitTrackArtists(artistStr: string): string[] {
  if (!artistStr) return [];
  const normalized = artistStr
    .replace(/\s+feat\.\s+/gi, ", ")
    .replace(/\s+ft\.\s+/gi, ", ")
    .replace(/\s+with\s+/gi, ", ")
    .replace(/\s+x\s+/gi, ", ")
    .replace(/\s+\+\s+/gi, ", ");
  return normalized
    .split(/,\s+|\s+&\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function extractFeaturedFromTitle(title: string): string[] {
  if (!title) return [];
  const featured: string[] = [];
  const seen = new Set<string>();

  function addNames(inner: string) {
    const names = inner.split(/\s*[,&]\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    for (const n of names) {
      const key = n.toLowerCase();
      if (!seen.has(key)) { seen.add(key); featured.push(n); }
    }
  }

  // Parentheses: (feat. X), (ft. X), (featuring X), (with X), (w/ X)
  const parenMatch = title.match(/\((?:feat\.?|ft\.?|featuring|with|w\/)\s+([^)]+)\)/i);
  if (parenMatch) addNames(parenMatch[1]);

  // Square brackets: [feat. X], [ft. X], [featuring X], [with X], [w/ X]
  const bracketMatch = title.match(/\[(?:feat\.?|ft\.?|featuring|with|w\/)\s+([^\]]+)\]/i);
  if (bracketMatch) addNames(bracketMatch[1]);

  // Dash / em-dash / en-dash: — feat. X, - ft. X, — featuring X, — with X
  const dashMatch = title.match(/\s[-\u2013\u2014]\s*(?:feat\.?|ft\.?|featuring|with|w\/)\s+(.+)$/i);
  if (dashMatch) addNames(dashMatch[1]);

  // x collaboration: "Song x Artist2"
  const xMatch = title.match(/\s+x\s+([A-Z][^,(\[]+?)(?:\s*[,&]\s*[A-Z][^,(\[]+?)*)\s*$/i);
  if (!xMatch) {
    const xMatch2 = title.match(/\s+x\s+([A-Z][^,(\[]+)$/i);
    if (xMatch2) addNames(xMatch2[1]);
  } else {
    addNames(xMatch[1]);
  }

  // + collaboration: "Song + Artist2"
  const plusMatch = title.match(/\s+\+\s+([A-Z][^,(\[]+?)(?:\s*[,&]\s*[A-Z][^,(\[]+?)*)\s*$/i);
  if (!plusMatch) {
    const plusMatch2 = title.match(/\s+\+\s+([A-Z][^,(\[]+)$/i);
    if (plusMatch2) addNames(plusMatch2[1]);
  } else {
    addNames(plusMatch[1]);
  }

  return featured;
}

function getTrackArtistsForOwnRelease(
  trackArtistField: string,
  trackTitle: string,
  primaryArtistName: string
): Array<{ name: string; isPrimary: boolean }> {
  const primarySlug = slugify(primaryArtistName);
  const fromField = splitTrackArtists(trackArtistField);
  const fromTitle = extractFeaturedFromTitle(trackTitle);

  const seen = new Set<string>();
  const result: Array<{ name: string; isPrimary: boolean }> = [];

  seen.add(primarySlug);
  result.push({ name: primaryArtistName, isPrimary: true });

  for (const name of fromField) {
    const key = slugify(name);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name, isPrimary: false });
    }
  }

  for (const name of fromTitle) {
    const key = slugify(name);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name, isPrimary: false });
    }
  }

  return result;
}

function getTrackArtistsForAppearsOn(
  trackArtistField: string,
  trackTitle: string,
  releaseOwnerName: string
): Array<{ name: string; isPrimary: boolean }> {
  const fromField = splitTrackArtists(trackArtistField || releaseOwnerName);
  const fromTitle = extractFeaturedFromTitle(trackTitle);

  const seen = new Set<string>();
  const result: Array<{ name: string; isPrimary: boolean }> = [];

  for (let i = 0; i < fromField.length; i++) {
    const key = slugify(fromField[i]);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name: fromField[i], isPrimary: i === 0 });
    }
  }

  for (const name of fromTitle) {
    const key = slugify(name);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name, isPrimary: false });
    }
  }

  return result;
}

function parseTrackRows(modalHtml: string): TrackData[] {
  const tracks: TrackData[] = [];
  const rowRegex = /<div class=["'][^"']*wk-album-track-row[^"']*["']>([\s\S]*?)(?=<div class=["'][^"']*wk-album-track-row[^"']*["']|<\/div>\s*<\/div>\s*<\/div>)/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(modalHtml)) !== null) {
    const rowHtml = rowMatch[1];
    const trackNumMatch = rowHtml.match(/class=["'][^"']*wk-album-track-no[^"']*["']>(\d+)<\/div>/);
    const trackNumber = trackNumMatch ? parseInt(trackNumMatch[1], 10) : null;
    const titleMatch = rowHtml.match(/class=["'][^"']*wk-track-title[^"']*["']\s*>([\s\S]*?)<\/div>/);
    const title = titleMatch ? stripLeadingGt(decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim())) : "";
    if (!title) continue;
    const artistMatch = rowHtml.match(/class=["'][^"']*wk-track-artist[^"']*["']\s*>([\s\S]*?)<\/div>/);
    const artist = artistMatch ? stripLeadingGt(decodeHtmlEntities(artistMatch[1].replace(/<[^>]+>/g, "").trim())) : "";
    const durationMatch = rowHtml.match(/class=["'][^"']*wk-album-track-duration[^"']*["']\s*>([\s\S]*?)<\/span>/);
    const durationStr = durationMatch ? stripLeadingGt(durationMatch[1].trim()) : null;
    const duration_ms = parseDurationMs(durationStr === "-" ? null : durationStr);
    const isrcMatch = rowHtml.match(/data-(?:track-)?isrc=["']?([A-Z]{2}[A-Z0-9]{3}\d{7})["']?/);
    const isrc = isrcMatch ? isrcMatch[1] : null;
    const previewMatch = rowHtml.match(/data-preview-url=["']?([^"'\s>]+)["']?/);
    const previewUrl = previewMatch ? decodeHtmlEntities(previewMatch[1]) : null;
    const artworkMatch = rowHtml.match(/data-artwork-url=["']?([^"'\s>]+)["']?/);
    const artworkUrl = artworkMatch ? decodeHtmlEntities(artworkMatch[1]) : null;
    tracks.push({ title, artist, isrc, duration: durationStr === "-" ? null : durationStr, duration_ms, trackNumber, artworkUrl, previewUrl });
  }
  return tracks;
}

async function scrapeArtistPage(slug: string): Promise<ArtistScrapeResult | null> {
  const url = `${SITE_BASE}/artists/${slug}/`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WAKILISHA-Scraper/1.0; +https://wakilisha.africa)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn(`[scraper] ${slug}: HTTP ${res.status}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.warn(`[scraper] ${slug}: fetch failed - ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const h1Match = html.match(/class="wk-title wk-title--sm">([\s\S]*?)<\/h1>/);
  const name = h1Match ? decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, "").trim()) : slug;

  const bioMatch = html.match(/class="wk-prose wk-artist-about-copy[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/);
  let bio: string | null = null;
  if (bioMatch) {
    bio = bioMatch[1].trim();
    bio = bio.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    bio = bio.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    bio = bio.trim() || null;
  }

  const avatarMatch = html.match(/class=["'][^"']*wk-artist-avatar[^"']*["']>[\s\S]*?<img src=["']([^">\s]+)["']/);
  const imageUrl = avatarMatch ? avatarMatch[1] : null;
  const genreMatches = html.matchAll(/class="wk-artist-badge wk-artist-badge--genre">([\s\S]*?)<\/span>/g);
  const genres: string[] = [];
  for (const m of genreMatches) {
    const g = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim());
    if (g) genres.push(g);
  }
  const countryMatch = html.match(/class=["'][^"']*wk-artist-badge__label[^"']*["']>([\s\S]*?)<\/span>/);
  const country = countryMatch ? decodeHtmlEntities(countryMatch[1].trim()) : null;
  const spotifyMatch = html.match(/href="(https:\/\/open\.spotify\.com\/artist\/[^"]+)"/);
  const spotifyUrl = spotifyMatch ? spotifyMatch[1] : null;
  const instagramMatch = html.match(/href="(https:\/\/(?:www\.)?instagram\.com\/[^"]+)"/);
  const instagramUrl = instagramMatch ? instagramMatch[1] : null;
  const youtubeMatch = html.match(/href="(https:\/\/(?:www\.)?youtube\.com\/channel\/[^"]+)"/);
  const youtubeUrl = youtubeMatch ? youtubeMatch[1] : null;

  const topSongs: ArtistScrapeResult["topSongs"] = [];
  const topSongRegex = /data-wk-artist-popular-track[^>]*data-title="([^"]*)"[^>]*data-artist-name="([^"]*)"[^>]*data-artwork-url="([^"]*)"/g;
  let tsMatch: RegExpExecArray | null;
  while ((tsMatch = topSongRegex.exec(html)) !== null) {
    topSongs.push({
      title: decodeHtmlEntities(tsMatch[1]),
      artist: decodeHtmlEntities(tsMatch[2]),
      artworkUrl: tsMatch[3] ? decodeHtmlEntities(tsMatch[3]) : null,
      previewUrl: null,
    });
  }

  const videos: ArtistScrapeResult["videos"] = [];
  const videoRegex = /data-wk-artist-youtube-trigger=["']?1["']?[^>]*data-youtube-id=["']?([^"'\s>]+)["']?[^>]*aria-label="Play ([^"]+)"/g;
  let vMatch: RegExpExecArray | null;
  while ((vMatch = videoRegex.exec(html)) !== null) {
    const youtubeId = vMatch[1];
    const title = decodeHtmlEntities(vMatch[2]);
    videos.push({ title, youtubeId, thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` });
  }

  const relatedArtists: string[] = [];
  const releases: ReleaseData[] = [];
  const appearsOn: AppearsOnData[] = [];
  const releaseModalIds = new Set<string>();
  const appearsOnModalIds = new Set<string>();

  const sections = splitIntoSections(html);
  for (const sec of sections) {
    const isAppearsOn = /(<h2>Appears on<\/h2>|<h2>Appears On<\/h2>)/.test(sec);
    const isReleases = /wk-stack--imported-releases/.test(sec);
    const isRelatedArtists = /wk-related-artists-section/.test(sec);
    if (isRelatedArtists) {
      const slugRegex = /href="https:\/\/wakilisha\.africa\/artists\/([^\/]+)\/"/g;
      let rm: RegExpExecArray | null;
      while ((rm = slugRegex.exec(sec)) !== null) {
        if (!relatedArtists.includes(rm[1])) relatedArtists.push(rm[1]);
      }
    }
    if (isAppearsOn) {
      const modalIdRegex = /data-wk-album-modal-trigger=["']?(wk-import-album-[a-f0-9]+)["']?/g;
      let m: RegExpExecArray | null;
      while ((m = modalIdRegex.exec(sec)) !== null) appearsOnModalIds.add(m[1]);
    } else if (isReleases) {
      const modalIdRegex = /data-wk-album-modal-trigger=["']?(wk-import-album-[a-f0-9]+)["']?/g;
      let m: RegExpExecArray | null;
      while ((m = modalIdRegex.exec(sec)) !== null) releaseModalIds.add(m[1]);
    }
  }

  const modalRegex = /<div id=["'](wk-import-album-[a-f0-9]+)["'] class=["'][^"']*wk-album-modal[^"']*["']([\s\S]*?)(?=<div id=["']wk-import-album-|<div class=["']widget_shopping_cart["']|$)/g;
  let modalMatch: RegExpExecArray | null;
  while ((modalMatch = modalRegex.exec(html)) !== null) {
    const modalId = modalMatch[1];
    const modalHtml = modalMatch[2];
    const titleMatch = modalHtml.match(/class=["'][^"']*wk-album-modal__title[^"']*["']\s*>([\s\S]*?)<\/h4>/);
    if (!titleMatch) continue;
    const title = stripLeadingGt(decodeHtmlEntities(titleMatch[1].trim()));
    if (!title) continue;
    const artworkMatch = modalHtml.match(/class=["'][^"']*wk-album-modal__art[^"']*["']>\s*<img src=["']([^">\s]+)["']/);
    const artworkUrl = artworkMatch ? artworkMatch[1] : null;
    const metaMatch = modalHtml.match(/class=["'][^"']*wk-track-meta[^"']*["']\s*>([\s\S]*?)<\/div>/);
    const metaStr = metaMatch ? stripLeadingGt(decodeHtmlEntities(metaMatch[1].trim())) : "";
    const { releaseDate, year, trackCount: metaTrackCount, durationStr, releaseType } = parseReleaseMeta(metaStr);
    const primaryArtistMatch = modalHtml.match(/data-release-artist="([^"]+)"/);
    const primaryArtist = primaryArtistMatch ? decodeHtmlEntities(primaryArtistMatch[1]) : "";
    const tracks = parseTrackRows(modalHtml);
    const finalTrackCount = tracks.length || metaTrackCount;
    const titleSlug = slugify(title);
    if (appearsOnModalIds.has(modalId)) {
      appearsOn.push({ title, artworkUrl, primaryArtist, releaseType, releaseDate, tracks });
    } else if (releaseModalIds.has(modalId)) {
      releases.push({ title, slug: titleSlug, releaseType, releaseDate, year, artworkUrl, durationStr, trackCount: finalTrackCount, tracks });
    }
  }

  return { slug, name, bio, imageUrl, genres, country, spotifyUrl, instagramUrl, youtubeUrl, topSongs, releases, appearsOn, relatedArtists, videos };
}

async function writeScrapeToRegistry(
  supabase: ReturnType<typeof createClient>,
  data: ArtistScrapeResult,
  options: { dryRun: boolean; overwrite: boolean; bioOnly: boolean }
): Promise<{ success: boolean; stats: Record<string, number>; errors: string[] }> {
  const stats: Record<string, number> = {
    releases_upserted: 0,
    tracks_upserted: 0,
    release_artists_upserted: 0,
    release_tracks_upserted: 0,
    track_artists_upserted: 0,
    artist_updated: 0,
    appears_on_releases: 0,
    appears_on_tracks: 0,
    top_song_relationships: 0,
    top_songs_unmatched: 0,
  };
  const errors: string[] = [];

  async function fetchAllRows<T = any>(
    table: string,
    columns: string,
    filter?: { col: string; val: string },
    pageSize = 1000
  ): Promise<T[]> {
    const all: T[] = [];
    let from = 0;
    while (true) {
      let q = supabase.from(table).select(columns).range(from, from + pageSize - 1);
      if (filter) q = q.eq(filter.col, filter.val);
      const { data: rows, error } = await q;
      if (error) {
        console.error(`[fetchAllRows] ${table} error:`, error.message);
        break;
      }
      if (!rows || rows.length === 0) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  const { data: artistRow, error: artistErr } = await supabase
    .from("registry_artists")
    .select("id, slug, display_name, bio, public_image_url, metadata")
    .eq("slug", data.slug)
    .eq("status", "active")
    .maybeSingle();

  if (artistErr || !artistRow) {
    errors.push(`Artist not found in registry: ${data.slug}`);
    return { success: false, stats, errors };
  }

  const artistId = artistRow.id as string;

  const artistPatch: Record<string, unknown> = {};
  if (data.bio && (!artistRow.bio || (artistRow.bio as string).length < 50 || options.overwrite)) {
    artistPatch.bio = data.bio;
  }
  if (data.imageUrl && (!artistRow.public_image_url || options.overwrite)) {
    artistPatch.public_image_url = data.imageUrl;
  }

  const existingMeta = (artistRow.metadata || {}) as Record<string, unknown>;
  const metaPatch: Record<string, unknown> = {};

  if (!options.bioOnly) {
    if (data.spotifyUrl && (!existingMeta.spotify_url || options.overwrite)) metaPatch.spotify_url = data.spotifyUrl;
    if (data.instagramUrl && (!existingMeta.instagram_url || options.overwrite)) metaPatch.instagram_url = data.instagramUrl;
    if (data.youtubeUrl && (!existingMeta.youtube_url || options.overwrite)) metaPatch.youtube_url = data.youtubeUrl;
    if (data.country && (!existingMeta.country || options.overwrite)) metaPatch.country = data.country;
    if (data.genres.length > 0 && (!existingMeta.genres || options.overwrite)) metaPatch.genres = data.genres;

    if (data.videos.length > 0 && (!existingMeta.youtube_videos || options.overwrite)) {
      metaPatch.youtube_videos = data.videos.map(v => ({
        youtubeId: v.youtubeId,
        title: v.title,
        url: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      }));
    }

    if (data.topSongs.length > 0 && (!existingMeta.top_songs || options.overwrite)) {
      metaPatch.top_songs = data.topSongs.map(s => ({
        title: s.title,
        artists: s.artist,
        image: s.artworkUrl || "",
        duration: "",
        songUrl: s.previewUrl || "",
      }));
    }
    if (data.relatedArtists.length > 0 && (!existingMeta.related_artists || options.overwrite)) {
      metaPatch.related_artists = data.relatedArtists.map(slug => ({
        slug,
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      }));
    }
    if (data.imageUrl && (!existingMeta.portrait_image || options.overwrite)) {
      metaPatch.portrait_image = data.imageUrl;
    }
    if (data.releases.length > 0) {
      const albums = data.releases.filter(r => r.releaseType !== "single" && r.releaseType !== "ep");
      const epsSingles = data.releases.filter(r => r.releaseType === "ep" || r.releaseType === "single");
      if (albums.length > 0 && (!existingMeta.studio_albums || options.overwrite)) {
        metaPatch.studio_albums = albums.map(r => ({
          title: r.title,
          release_date: r.releaseDate || r.year || "",
          year: r.year || "",
          track_count: r.trackCount,
          image: r.artworkUrl || "",
          tracks: r.tracks.map(t => ({ title: t.title, duration: t.duration || "" })),
        }));
      }
      if (epsSingles.length > 0 && (!existingMeta.eps_compilations || options.overwrite)) {
        metaPatch.eps_compilations = epsSingles.map(r => ({
          title: r.title,
          release_date: r.releaseDate || r.year || "",
          year: r.year || "",
          track_count: r.trackCount,
          image: r.artworkUrl || "",
          tracks: r.tracks.map(t => ({ title: t.title, duration: t.duration || "" })),
        }));
      }
    }
  }

  if (Object.keys(metaPatch).length > 0) {
    artistPatch.metadata = { ...existingMeta, ...metaPatch };
  }

  if (Object.keys(artistPatch).length > 0 && !options.dryRun) {
    const { error } = await supabase.from("registry_artists")
      .update(artistPatch)
      .eq("id", artistId);
    if (error) errors.push(`Artist update error: ${error.message}`);
    else stats.artist_updated++;
  } else if (Object.keys(artistPatch).length > 0) {
    stats.artist_updated++;
  }

  if (options.bioOnly) {
    return { success: true, stats, errors };
  }

  const existingReleases = await fetchAllRows<{ id: string; slug: string; title: string }>(
    "registry_releases", "id, slug, title"
  );
  const existingReleaseBySlug = new Map<string, string>(
    existingReleases.map((r) => [r.slug, r.id])
  );
  const existingReleaseByTitle = new Map<string, string>(
    existingReleases.map((r) => [(r.title as string).toLowerCase().trim(), r.id])
  );

  const existingTracks = await fetchAllRows<{ id: string; slug: string; isrc: string | null; title: string }>(
    "registry_tracks", "id, slug, isrc, title"
  );
  const existingTrackByIsrc = new Map<string, string>(
    existingTracks.filter((t) => t.isrc).map((t) => [t.isrc, t.id])
  );
  const existingTrackBySlug = new Map<string, string>(
    existingTracks.map((t) => [t.slug, t.id])
  );
  const existingTrackIdToSlug = new Map<string, string>(
    existingTracks.map((t) => [t.id, t.slug])
  );
  const existingTrackIdToTitle = new Map<string, string>(
    existingTracks.map((t) => [t.id, t.title])
  );

  const existingReleaseArtists = await fetchAllRows<{ release_id: string; artist_id: string; artist_slug: string }>(
    "registry_release_artists", "release_id, artist_id, artist_slug",
    { col: "status", val: "active" }
  );
  const existingReleaseArtistSet = new Set<string>(
    existingReleaseArtists.map((r) => `${r.release_id}:${r.artist_id || r.artist_slug}`)
  );

  const existingReleaseTracks = await fetchAllRows<{ release_id: string; track_id: string }>(
    "registry_release_tracks", "release_id, track_id"
  );
  const existingReleaseTrackSet = new Set<string>(
    existingReleaseTracks.map((r) => `${r.release_id}:${r.track_id}`)
  );

  const existingTrackArtists = await fetchAllRows<{
    track_id: string;
    artist_slug: string;
    artist_name_text: string | null;
    is_featured: boolean | null;
  }>(
    "registry_track_artists",
    "track_id, artist_slug, artist_name_text, is_featured",
    { col: "status", val: "active" }
  );
  const existingTrackArtistSet = new Set<string>(
    existingTrackArtists.map((r) => `${r.track_id}:${r.artist_slug}`)
  );
  const featuredArtistNamesByTrack = new Map<string, string[]>();
  for (const link of existingTrackArtists) {
    if (!link.is_featured) continue;
    const name =
      link.artist_name_text ||
      link.artist_slug;
    if (!featuredArtistNamesByTrack.has(link.track_id)) {
      featuredArtistNamesByTrack.set(link.track_id, []);
    }
    featuredArtistNamesByTrack.get(link.track_id)!.push(name);
  }
  const existingTrackByArtistAndSlug = new Map<string, string>();
  const ambiguousTrackScopeKeys = new Set<string>();

  const registerTrackScopeAlias = (
    artistSlug: string,
    trackSlug: string,
    trackId: string,
  ) => {
    if (!artistSlug || !trackSlug || !trackId) return;
    const key = `${artistSlug}:${trackSlug}`;
    if (ambiguousTrackScopeKeys.has(key)) return;
    const existingId = existingTrackByArtistAndSlug.get(key);
    if (existingId && existingId !== trackId) {
      existingTrackByArtistAndSlug.delete(key);
      ambiguousTrackScopeKeys.add(key);
      return;
    }
    existingTrackByArtistAndSlug.set(key, trackId);
  };

  for (const link of existingTrackArtists) {
    const actualSlug = existingTrackIdToSlug.get(link.track_id);
    if (actualSlug) {
      registerTrackScopeAlias(link.artist_slug, actualSlug, link.track_id);
    }
    const existingTitle = existingTrackIdToTitle.get(link.track_id);
    if (existingTitle) {
      registerTrackScopeAlias(
        link.artist_slug,
        canonicalTrackSlugCandidate(
          existingTitle,
          {
            featuredArtistNames:
              featuredArtistNamesByTrack.get(link.track_id) || [],
          },
        ),
        link.track_id,
      );
    }
  }

  const resolveTrackInArtistScope = (
    artistSlug: string,
    trackSlug: string,
  ): string | undefined => {
    const key = `${artistSlug}:${trackSlug}`;
    if (ambiguousTrackScopeKeys.has(key)) {
      throw new Error(
        `Ambiguous Track identity in artist scope: ${artistSlug}/${trackSlug}`,
      );
    }
    return existingTrackByArtistAndSlug.get(key);
  };

  const seenReleaseSlugs = new Set<string>(existingReleaseBySlug.keys());

  const ensureRelease = async (
    title: string,
    artworkUrl: string | null,
    releaseType: string,
    releaseDate: string | null
  ): Promise<string | null> => {
    const titleKey = title.toLowerCase().trim();
    let releaseId = existingReleaseByTitle.get(titleKey);
    if (!releaseId) {
      const baseSlug = slugify(title);
      const scopedCandidate = `${data.slug}--${baseSlug}`;
      releaseId = existingReleaseBySlug.get(scopedCandidate);
      if (!releaseId) {
        releaseId = existingReleaseBySlug.get(baseSlug);
      }
    }

    if (!releaseId) {
      const newId = crypto.randomUUID();
      const relSlug = dedupeSlug(`${data.slug}--${slugify(title)}`, seenReleaseSlugs);
      const newRelease = {
        id: newId,
        slug: relSlug,
        title,
        normalized_title: slugify(title).replace(/-/g, " "),
        release_type: releaseType,
        release_date: releaseDate || null,
        artwork_url: artworkUrl || null,
        status: "active",
        metadata: {
          source: "wakilisha_scraper",
          scraped_artist: data.slug,
          scraped_at: new Date().toISOString(),
        },
      };

      if (!options.dryRun) {
        const { error } = await supabase.from("registry_releases").insert(newRelease);
        if (error) {
          errors.push(`Release insert error "${title}": ${error.message}`);
          return null;
        }
      }

      releaseId = newId;
      existingReleaseBySlug.set(relSlug, newId);
      existingReleaseByTitle.set(titleKey, newId);
      stats.releases_upserted++;
    } else if (options.overwrite) {
      if (!options.dryRun) {
        const overwritePatch: Record<string, unknown> = {
          title,
          normalized_title: slugify(title).replace(/-/g, " "),
          release_type: releaseType,
          release_date: releaseDate || null,
          artwork_url: artworkUrl || null,
        };
        await supabase.from("registry_releases")
          .update(overwritePatch)
          .eq("id", releaseId);
      }
      stats.releases_upserted++;
    } else {
      if (artworkUrl && !options.dryRun) {
        await supabase.from("registry_releases")
          .update({ artwork_url: artworkUrl })
          .eq("id", releaseId)
          .is("artwork_url", null);
      }
    }

    return releaseId;
  };

  const ensureReleaseArtist = async (
    releaseId: string,
    artistIdOrSlug: string,
    displayName: string,
    isPrimary: boolean,
    confidence: number
  ) => {
    let resolvedId: string | null = null;
    let resolvedSlug: string;

    if (artistIdOrSlug.length === 36 && artistIdOrSlug.includes("-")) {
      resolvedId = artistIdOrSlug;
      resolvedSlug = data.slug;
    } else {
      resolvedSlug = artistIdOrSlug;
      const { data: found } = await supabase
        .from("registry_artists")
        .select("id")
        .eq("slug", resolvedSlug)
        .eq("status", "active")
        .maybeSingle();
      resolvedId = found?.id || null;
    }

    const key = `${releaseId}:${resolvedId || resolvedSlug}`;
    if (existingReleaseArtistSet.has(key)) return;

    const row: Record<string, unknown> = {
      release_id: releaseId,
      artist_id: resolvedId || null,
      artist_slug: resolvedSlug,
      artist_name_text: displayName,
      role: isPrimary ? "primary_artist" : "featured_artist",
      is_primary: isPrimary,
      is_featured: !isPrimary,
      credit_order: isPrimary ? 1 : 2,
      source: "wakilisha_scraper",
      confidence,
      status: "active",
      metadata: { scraped_from: data.slug, scraped_at: new Date().toISOString() },
    };

    if (!options.dryRun) {
      const conflictCols = resolvedId ? "release_id,artist_id" : "release_id,artist_slug";
      await supabase.from("registry_release_artists")
        .upsert(row, { onConflict: conflictCols, ignoreDuplicates: true });
    }
    stats.release_artists_upserted++;
    existingReleaseArtistSet.add(key);
  };

  const processTracksForOwnRelease = async (
    releaseId: string,
    tracks: TrackData[]
  ) => {
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!track.title) continue;

      const trackArtistScope = slugify(data.name);
      const structuredTrackArtists =
        splitTrackArtists(track.artist || data.name);
      const structuredFeaturedArtistNames =
        structuredTrackArtists.filter(
          (name) =>
            slugify(name) !== trackArtistScope,
        );
      const trackTitleSlug =
        canonicalTrackSlugCandidate(
          track.title,
          {
            featuredArtistNames:
              structuredFeaturedArtistNames,
          },
        );
      let trackId: string | undefined;

      if (track.isrc) trackId = existingTrackByIsrc.get(track.isrc);

      if (!trackId) {
        try {
          trackId = resolveTrackInArtistScope(
            trackArtistScope,
            trackTitleSlug,
          );
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : String(error),
          );
          continue;
        }
      }

      if (!trackId) {
        const newId = crypto.randomUUID();
        const trackSlug = trackTitleSlug;
        const newTrack = {
          id: newId,
          slug: trackSlug,
          title: track.title,
          normalized_title: slugify(track.title).replace(/-/g, " "),
          isrc: track.isrc || null,
          release_id: releaseId,
          duration_ms: track.duration_ms,
          track_number: track.trackNumber,
          disc_number: 1,
          artwork_url: track.artworkUrl || null,
          status: "active",
          metadata: {
            source: "wakilisha_scraper",
            scraped_artist: data.slug,
            preview_url: track.previewUrl || null,
          },
        };

        if (!options.dryRun) {
          const { error } = await supabase.from("registry_tracks").insert(newTrack);
          if (error) {
            errors.push(`Track insert error "${track.title}": ${error.message}`);
            continue;
          }
        }

        trackId = newId;
        existingTrackBySlug.set(trackSlug, newId);
        existingTrackIdToSlug.set(newId, trackSlug);
        existingTrackIdToTitle.set(newId, track.title);
        registerTrackScopeAlias(
          trackArtistScope,
          trackSlug,
          newId,
        );
        if (track.isrc) existingTrackByIsrc.set(track.isrc, newId);
        stats.tracks_upserted++;
      } else if (options.overwrite) {
        if (!options.dryRun) {
          const overwritePatch: Record<string, unknown> = {
            title: track.title,
            normalized_title: slugify(track.title).replace(/-/g, " "),
            isrc: track.isrc || null,
            release_id: releaseId,
            duration_ms: track.duration_ms,
            track_number: track.trackNumber,
            artwork_url: track.artworkUrl || null,
            metadata: {
              source: "wakilisha_scraper",
              scraped_artist: data.slug,
              preview_url: track.previewUrl || null,
            },
          };
          await supabase.from("registry_tracks")
            .update(overwritePatch)
            .eq("id", trackId);
        }
        stats.tracks_upserted++;
      }

      const rtKey = `${releaseId}:${trackId}`;
      if (!existingReleaseTrackSet.has(rtKey)) {
        if (!options.dryRun) {
          await supabase.from("registry_release_tracks").upsert({
            release_id: releaseId,
            track_id: trackId,
            track_number: track.trackNumber || (i + 1),
            disc_number: 1,
            source: "wakilisha_scraper",
            confidence: 85,
            status: "active",
            metadata: { scraped_artist: data.slug },
          }, { onConflict: "release_id,track_id", ignoreDuplicates: true });
        }
        stats.release_tracks_upserted++;
        existingReleaseTrackSet.add(rtKey);
      } else if (options.overwrite) {
        if (!options.dryRun) {
          await supabase.from("registry_release_tracks")
            .update({ track_number: track.trackNumber || (i + 1), disc_number: 1, status: "active" })
            .eq("release_id", releaseId)
            .eq("track_id", trackId);
        }
      }

      const trackArtists = getTrackArtistsForOwnRelease(
        track.artist || data.name,
        track.title,
        data.name
      );

      if (!options.dryRun) {
        for (let ai = 0; ai < trackArtists.length; ai++) {
          const { name: artistNameClean, isPrimary } = trackArtists[ai];
          const artistSlugGuess = slugify(artistNameClean);

          const { data: taArtist } = await supabase
            .from("registry_artists")
            .select("id, slug, display_name")
            .eq("slug", artistSlugGuess)
            .eq("status", "active")
            .maybeSingle();

          const taRow: Record<string, unknown> = {
            track_id: trackId,
            artist_slug: taArtist?.slug || artistSlugGuess,
            artist_name_text: taArtist?.display_name || artistNameClean,
            role: isPrimary ? "primary_artist" : "featured_artist",
            is_primary: isPrimary,
            is_featured: !isPrimary,
            credit_order: ai + 1,
            source: "wakilisha_scraper",
            confidence: 80,
            status: "active",
            metadata: { scraped_from: data.slug },
          };

          if (taArtist) taRow.artist_id = taArtist.id;

          const taKey = `${trackId}:${taRow.artist_slug}`;
          if (!existingTrackArtistSet.has(taKey)) {
            await supabase.from("registry_track_artists").insert(taRow);
            stats.track_artists_upserted++;
            existingTrackArtistSet.add(taKey as string);
          } else if (options.overwrite) {
            await supabase.from("registry_track_artists")
              .update({
                is_primary: isPrimary,
                is_featured: !isPrimary,
                role: isPrimary ? "primary_artist" : "featured_artist",
                status: "active",
                credit_order: ai + 1,
              })
              .eq("track_id", trackId as string)
              .eq("artist_slug", taRow.artist_slug as string)
              .eq("status", "active");
          }
        }
      } else {
        for (const { name: artistNameClean } of trackArtists) {
          const taKey = `${trackId}:${slugify(artistNameClean)}`;
          if (!existingTrackArtistSet.has(taKey)) {
            stats.track_artists_upserted++;
            existingTrackArtistSet.add(taKey);
          }
        }
      }
    }
  };

  const processTracksForAppearsOn = async (
    releaseId: string,
    tracks: TrackData[],
    releaseOwnerName: string
  ) => {
    const releaseOwnerSlug = slugify(releaseOwnerName);

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!track.title) continue;

      const structuredTrackArtists =
        splitTrackArtists(
          track.artist || releaseOwnerName,
        );
      const trackTitleSlug =
        canonicalTrackSlugCandidate(
          track.title,
          {
            featuredArtistNames:
              structuredTrackArtists.slice(1),
          },
        );
      let trackId: string | undefined;

      if (track.isrc) trackId = existingTrackByIsrc.get(track.isrc);

      if (!trackId) {
        try {
          trackId = resolveTrackInArtistScope(
            releaseOwnerSlug,
            trackTitleSlug,
          );
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : String(error),
          );
          continue;
        }
      }

      if (!trackId) {
        const newId = crypto.randomUUID();
        const trackSlug = trackTitleSlug;
        const newTrack = {
          id: newId,
          slug: trackSlug,
          title: track.title,
          normalized_title: slugify(track.title).replace(/-/g, " "),
          isrc: track.isrc || null,
          release_id: releaseId,
          duration_ms: track.duration_ms,
          track_number: track.trackNumber,
          disc_number: 1,
          artwork_url: track.artworkUrl || null,
          status: "active",
          metadata: {
            source: "wakilisha_scraper",
            scraped_artist: data.slug,
            preview_url: track.previewUrl || null,
          },
        };

        if (!options.dryRun) {
          const { error } = await supabase.from("registry_tracks").insert(newTrack);
          if (error) {
            errors.push(`Track insert error "${track.title}": ${error.message}`);
            continue;
          }
        }

        trackId = newId;
        existingTrackBySlug.set(trackSlug, newId);
        existingTrackIdToSlug.set(newId, trackSlug);
        existingTrackIdToTitle.set(newId, track.title);
        registerTrackScopeAlias(
          releaseOwnerSlug,
          trackSlug,
          newId,
        );
        if (track.isrc) existingTrackByIsrc.set(track.isrc, newId);
        stats.tracks_upserted++;
      }

      const rtKey = `${releaseId}:${trackId}`;
      if (!existingReleaseTrackSet.has(rtKey)) {
        if (!options.dryRun) {
          await supabase.from("registry_release_tracks").upsert({
            release_id: releaseId,
            track_id: trackId,
            track_number: track.trackNumber || (i + 1),
            disc_number: 1,
            source: "wakilisha_scraper",
            confidence: 85,
            status: "active",
            metadata: { scraped_artist: data.slug },
          }, { onConflict: "release_id,track_id", ignoreDuplicates: true });
        }
        stats.release_tracks_upserted++;
        existingReleaseTrackSet.add(rtKey);
      }

      const trackArtists = getTrackArtistsForAppearsOn(
        track.artist || releaseOwnerName,
        track.title,
        releaseOwnerName
      );

      if (!options.dryRun) {
        for (let ai = 0; ai < trackArtists.length; ai++) {
          const { name: artistNameClean, isPrimary } = trackArtists[ai];
          const artistSlugGuess = slugify(artistNameClean);

          const { data: taArtist } = await supabase
            .from("registry_artists")
            .select("id, slug, display_name")
            .eq("slug", artistSlugGuess)
            .eq("status", "active")
            .maybeSingle();

          const taRow: Record<string, unknown> = {
            track_id: trackId,
            artist_slug: taArtist?.slug || artistSlugGuess,
            artist_name_text: taArtist?.display_name || artistNameClean,
            role: isPrimary ? "primary_artist" : "featured_artist",
            is_primary: isPrimary,
            is_featured: !isPrimary,
            credit_order: ai + 1,
            source: "wakilisha_scraper",
            confidence: 80,
            status: "active",
            metadata: { scraped_from: data.slug },
          };

          if (taArtist) taRow.artist_id = taArtist.id;

          const taKey = `${trackId}:${taRow.artist_slug}`;
          if (!existingTrackArtistSet.has(taKey)) {
            await supabase.from("registry_track_artists").insert(taRow);
            stats.track_artists_upserted++;
            existingTrackArtistSet.add(taKey as string);
          }
        }
      } else {
        for (const { name: artistNameClean } of trackArtists) {
          const taKey = `${trackId}:${slugify(artistNameClean)}`;
          if (!existingTrackArtistSet.has(taKey)) {
            stats.track_artists_upserted++;
            existingTrackArtistSet.add(taKey);
          }
        }
      }
      stats.appears_on_tracks++;
    }
  };

  for (const rel of data.releases) {
    if (!rel.title) continue;
    const releaseId = await ensureRelease(rel.title, rel.artworkUrl, rel.releaseType, rel.releaseDate);
    if (!releaseId) continue;

    await ensureReleaseArtist(releaseId, artistId, data.name, true, 90);
    await processTracksForOwnRelease(releaseId, rel.tracks);
  }

  for (const ao of data.appearsOn) {
    if (!ao.title) continue;
    const releaseId = await ensureRelease(ao.title, ao.artworkUrl, ao.releaseType, ao.releaseDate);
    if (!releaseId) continue;
    stats.appears_on_releases++;

    await ensureReleaseArtist(releaseId, artistId, data.name, false, 85);

    if (ao.primaryArtist) {
      const paSlug = slugify(ao.primaryArtist);
      await ensureReleaseArtist(releaseId, paSlug, ao.primaryArtist, true, 80);
    }

    await processTracksForAppearsOn(releaseId, ao.tracks, ao.primaryArtist || data.name);
  }

  if (data.topSongs.length > 0) {
    const now = new Date().toISOString();
    const topSongTaSet = new Set<string>();
    const artistScrapedSlug = slugify(data.name);

    for (let i = 0; i < data.topSongs.length; i++) {
      const ts = data.topSongs[i];
      const structuredTopSongArtists =
        splitTrackArtists(ts.artist || data.name);
      const trackSlugCandidate =
        canonicalTrackSlugCandidate(
          ts.title,
          {
            featuredArtistNames:
              structuredTopSongArtists.slice(1),
          },
        );
      let matchedTrackId: string | undefined;

      try {
        matchedTrackId = resolveTrackInArtistScope(
          artistScrapedSlug,
          trackSlugCandidate,
        );
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : String(error),
        );
        continue;
      }

      let matchedTrackSlug = matchedTrackId
        ? existingTrackIdToSlug.get(matchedTrackId)
        : undefined;

      if (!matchedTrackId) {
        const trackId = crypto.randomUUID();
        const trackSlug = trackSlugCandidate;

        if (!options.dryRun) {
          const newTrack = {
            id: trackId,
            slug: trackSlug,
            title: ts.title,
            normalized_title: slugify(ts.title).replace(/-/g, " "),
            isrc: null,
            release_id: null,
            duration_ms: null,
            track_number: null,
            disc_number: null,
            artwork_url: ts.artworkUrl || null,
            preview_url: ts.previewUrl || null,
            status: "active",
            metadata: {
              source: "wakilisha_scraper_top_song",
              scraped_artist: data.slug,
              scraped_at: now,
              rank: i + 1,
            },
          };

          const { error: trackErr } = await supabase
            .from("registry_tracks")
            .insert(newTrack);

          if (trackErr) {
            errors.push(
              `Top-song track insert error "${ts.title}": ${trackErr.message}`,
            );
            continue;
          }
        }

        matchedTrackId = trackId;
        matchedTrackSlug = trackSlug;
        existingTrackBySlug.set(trackSlug, trackId);
        existingTrackIdToSlug.set(trackId, trackSlug);
        existingTrackIdToTitle.set(trackId, ts.title);
        registerTrackScopeAlias(
          artistScrapedSlug,
          trackSlug,
          trackId,
        );
        stats.tracks_upserted++;

        const taKey = `${trackId}:${artistScrapedSlug}`;
        if (
          !existingTrackArtistSet.has(taKey) &&
          !topSongTaSet.has(taKey)
        ) {
          if (!options.dryRun) {
            const { error: taErr } = await supabase
              .from("registry_track_artists")
              .insert({
                track_id: trackId,
                artist_id: artistId,
                artist_slug: artistScrapedSlug,
                artist_name_text: data.name,
                role: "primary_artist",
                is_primary: true,
                is_featured: false,
                credit_order: 1,
                source: "wakilisha_scraper_top_song",
                confidence: 80,
                status: "active",
                metadata: {
                  scraped_from: data.slug,
                  scraped_at: now,
                  rank: i + 1,
                },
              });

            if (taErr) {
              errors.push(
                `Top-song track-artist error "${ts.title}": ${taErr.message}`,
              );
            }
          }

          stats.track_artists_upserted++;
          topSongTaSet.add(taKey);
          existingTrackArtistSet.add(taKey);
        }
      }

      if (!matchedTrackSlug) {
        errors.push(
          `Top-song Track identity missing slug for "${ts.title}"`,
        );
        continue;
      }

      const relationshipEntry: Record<string, unknown> = {
        source_entity_type: "artist",
        source_slug: data.slug,
        target_entity_type: "track",
        target_slug: matchedTrackSlug,
        relationship_type: "popular_track",
        relationship_role: "top_song",
        relationship_status: "active",
        source_kind: "wakilisha_scraper",
        source_record_id: `rank_${i + 1}`,
        sort_order: i + 1,
        confidence: 75,
        metadata: {
          scraped_from: data.slug,
          scraped_at: now,
          rank: i + 1,
          matched_by: "normalized_title",
          top_song_title: ts.title,
        },
      };

      if (!options.dryRun) {
        const { error: relErr } = await supabase
          .from("registry_entity_relationships")
          .upsert(relationshipEntry, {
            onConflict:
              "source_entity_type,source_slug,target_entity_type,target_slug,relationship_type,relationship_role,source_kind,source_record_id",
            ignoreDuplicates: false,
          });
        if (relErr) {
          errors.push(`Top-song relationship error "${ts.title}": ${relErr.message}`);
        }
      }
      stats.top_song_relationships++;
    }
  }

  return { success: true, stats, errors };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) return respond({ error: "Supabase config missing" }, 500);

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // allow empty body
    }

    const mode = String(body.mode ?? "scrape_one");

    if (mode === "status") {
      const [ra, rt, ta] = await Promise.all([
        supabase.from("registry_release_artists").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("registry_release_tracks").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("registry_track_artists").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return respond({
        mode: "status",
        registry: {
          release_artists_links: ra.count ?? 0,
          release_tracks_links: rt.count ?? 0,
          track_artist_links: ta.count ?? 0,
        },
      });
    }

    if (mode === "list_artists") {
      const { data: artists, error } = await supabase
        .from("registry_artists")
        .select("slug, display_name")
        .eq("status", "active")
        .order("slug");
      if (error) return respond({ error: error.message }, 500);
      return respond({ mode: "list_artists", count: artists?.length ?? 0, artists: artists || [] });
    }

    if (mode === "scrape_one") {
      const artistSlug = String(body.artistSlug ?? "").trim();
      if (!artistSlug) return respond({ error: "Missing artistSlug" }, 400);
      const dryRun = body.dryRun === true;
      const overwrite = body.overwrite === true;
      const bioOnly = body.bioOnly === true;
      const scraped = await scrapeArtistPage(artistSlug);
      if (!scraped) {
        return respond({ success: false, error: `Could not scrape artist page: ${artistSlug}`, artistSlug });
      }
      const result = await writeScrapeToRegistry(supabase, scraped, { dryRun, overwrite, bioOnly });
      return respond({
        mode: "scrape_one",
        success: true,
        artistSlug,
        dryRun,
        overwrite,
        bioOnly,
        scraped: {
          name: scraped.name,
          bio_length: scraped.bio?.length ?? 0,
          releases: scraped.releases.length,
          appears_on: scraped.appearsOn.length,
          top_songs: scraped.topSongs.length,
          videos: scraped.videos.length,
          related_artists: scraped.relatedArtists.length,
          genres: scraped.genres,
          country: scraped.country,
          sample_releases: scraped.releases.slice(0, 5).map(r => ({
            title: r.title,
            type: r.releaseType,
            date: r.releaseDate,
            track_count: r.tracks.length,
            sample_tracks: r.tracks.slice(0, 3).map(t => `${t.trackNumber || ""} ${t.title} - ${t.artist}`),
          })),
          sample_appears_on: scraped.appearsOn.slice(0, 5).map(a => ({
            title: a.title,
            primary_artist: a.primaryArtist,
            track_count: a.tracks.length,
          })),
        },
        write_result: result,
      });
    }

    if (mode === "batch") {
      const slugs = (body.slugs as string[]) || [];
      const dryRun = body.dryRun === true;
      const overwrite = body.overwrite === true;
      const bioOnly = body.bioOnly === true;
      if (!slugs.length) return respond({ error: "Missing slugs array" }, 400);
      const batchResults: Array<{
        slug: string;
        success: boolean;
        stats?: Record<string, number>;
        errors?: string[];
        scraped_releases?: number;
        scraped_appears_on?: number;
      }> = [];
      const aggregateStats: Record<string, number> = {
        artists_processed: 0,
        artists_failed: 0,
        releases_upserted: 0,
        tracks_upserted: 0,
        release_artists_upserted: 0,
        release_tracks_upserted: 0,
        track_artists_upserted: 0,
        appears_on_releases: 0,
        top_song_relationships: 0,
        top_songs_unmatched: 0,
      };
      for (const artistSlug of slugs) {
        try {
          const scraped = await scrapeArtistPage(artistSlug);
          if (!scraped) {
            batchResults.push({ slug: artistSlug, success: false, errors: ["Could not fetch page"] });
            aggregateStats.artists_failed++;
            continue;
          }
          const result = await writeScrapeToRegistry(supabase, scraped, { dryRun, overwrite, bioOnly });
          batchResults.push({
            slug: artistSlug,
            success: result.success,
            stats: result.stats,
            errors: result.errors,
            scraped_releases: scraped.releases.length,
            scraped_appears_on: scraped.appearsOn.length,
          });
          if (result.success) {
            aggregateStats.artists_processed++;
            for (const [k, v] of Object.entries(result.stats)) {
              aggregateStats[k] = (aggregateStats[k] ?? 0) + v;
            }
          } else {
            aggregateStats.artists_failed++;
          }
          await new Promise(resolve => setTimeout(resolve, 400));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          batchResults.push({ slug: artistSlug, success: false, errors: [msg] });
          aggregateStats.artists_failed++;
        }
      }
      return respond({
        mode: "batch",
        success: true,
        dryRun,
        overwrite,
        bioOnly,
        total: slugs.length,
        aggregate: aggregateStats,
        results: batchResults,
      });
    }

    return respond({ error: `Unknown mode: ${mode}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return respond({ error: "Internal error", detail: msg }, 500);
  }
});
