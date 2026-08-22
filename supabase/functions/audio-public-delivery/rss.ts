type UnknownRecord = Record<string, unknown>;

const SITE_URL = "https://wakilisha.africa";

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rssDate(value: unknown): string {
  const input = text(value);
  if (!input) return "";
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toUTCString();
}

function durationLabel(value: unknown): string {
  const seconds = numberValue(value);
  if (seconds === null || seconds < 0) return "";

  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function episodeXml(value: unknown): string {
  const episode = record(value);
  const title = text(episode.title);
  const canonicalPath = text(episode.canonical_path);
  const summary = text(episode.summary);
  const feed = record(episode.feed);
  const delivery = record(episode.delivery);
  const provenance = record(episode.provenance);
  const season = record(episode.season);

  const guid = text(feed.guid);
  const enclosureUrl = text(feed.enclosure_url);
  const mimeType = text(delivery.mime_type);
  const byteSize = numberValue(delivery.byte_size);
  const publishedAt = rssDate(provenance.published_at);
  const duration = durationLabel(delivery.duration_seconds);
  const episodeNumber = numberValue(episode.episode_number);
  const seasonNumber = numberValue(season.season_number);

  if (
    !title ||
    !canonicalPath.startsWith("/audio/") ||
    !guid ||
    !enclosureUrl.startsWith(`${SITE_URL}/audio/enclosures/`) ||
    mimeType !== "audio/mpeg" ||
    byteSize === null ||
    byteSize <= 0 ||
    !publishedAt
  ) {
    throw new Error("Public Audio Episode is missing stable RSS identity or delivery metadata.");
  }

  const itemUrl = `${SITE_URL}${canonicalPath}`;

  return [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(itemUrl)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
    `      <pubDate>${escapeXml(publishedAt)}</pubDate>`,
    `      <description>${escapeXml(summary || title)}</description>`,
    `      <enclosure url="${escapeXml(enclosureUrl)}" length="${Math.round(byteSize)}" type="audio/mpeg" />`,
    duration ? `      <itunes:duration>${escapeXml(duration)}</itunes:duration>` : "",
    seasonNumber !== null ? `      <itunes:season>${Math.round(seasonNumber)}</itunes:season>` : "",
    episodeNumber !== null ? `      <itunes:episode>${Math.round(episodeNumber)}</itunes:episode>` : "",
    "    </item>",
  ].filter(Boolean).join("\n");
}

export function renderAudioShowRss(value: unknown): string {
  const root = record(value);
  const show = record(root.show);
  const episodes = array(root.episodes);

  const slug = text(show.slug);
  const title = text(show.title);
  const description = text(show.description) || `Episodes from ${title} on WAKILISHA.`;
  const canonicalPath = text(show.canonical_path);
  const feedPath = text(show.feed_path);

  if (
    !slug ||
    !title ||
    canonicalPath !== `/audio/shows/${slug}` ||
    feedPath !== `/audio/shows/${slug}/feed.xml` ||
    episodes.length === 0
  ) {
    throw new Error("Public Audio Show is not feed-addressable.");
  }

  const itemBlocks = episodes.map(episodeXml);
  const firstEpisode = record(episodes[0]);
  const lastBuildDate = rssDate(record(firstEpisode.provenance).published_at);

  if (!lastBuildDate) {
    throw new Error("Public Audio Show has no deterministic published timestamp.");
  }

  const showUrl = `${SITE_URL}${canonicalPath}`;
  const feedUrl = `${SITE_URL}${feedPath}`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(showUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    "    <generator>WAKILISHA</generator>",
    ...itemBlocks,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
