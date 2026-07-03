import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchArticlesForAdminList, type AdminArticleListItem } from "@/services/articles/articleAdminService";
import { fetchAllAuthors, type AuthorRow } from "@/services/authorProfiles";
import { getChartFamilies, type ChartFamily } from "@/services/chartsPublic/client";

export type WakilishaRecordEntityType =
  | "artist"
  | "track"
  | "release"
  | "label"
  | "genre"
  | "article"
  | "author"
  | "chart_family";

export type WakilishaRecordHealthStatus = "usable" | "thin" | "needs_review";

export type WakilishaRecordHealth = {
  status: WakilishaRecordHealthStatus;
  missingFields: string[];
  notes: string[];
};

export type WakilishaRecordSearchResult = {
  id: string;
  entityType: WakilishaRecordEntityType;
  slug: string;
  label: string;
  subtitle: string;
  href: string;
  imageUrl: string | null;
  contextText: string;
  snapshot: Record<string, unknown>;
  health: WakilishaRecordHealth;
  searchText: string;
};

export type WakilishaRecordDetail = {
  tracklist?: Array<{
    trackNumber: number;
    slug: string;
    title: string;
    artists: string[];
    artworkUrl: string | null;
    previewUrl: string | null;
  }>;
  richContext?: Record<string, unknown>;
  snapshotPatch?: Record<string, unknown>;
};

type AnyRow = Record<string, any>;

export const wakilishaRecordEntityOptions: Array<{
  key: "all" | WakilishaRecordEntityType;
  label: string;
  note: string;
}> = [
  { key: "all", label: "All records", note: "Search across WAKILISHA." },
  { key: "artist", label: "Artists", note: "Artist profiles, aliases, bios, links, discography, and chart context." },
  { key: "track", label: "Tracks", note: "Songs, credits, releases, chart signals, and provider links." },
  { key: "release", label: "Releases", note: "Albums, EPs, singles, tracklists, artists, labels, and descriptions." },
  { key: "label", label: "Labels", note: "Record labels, releases, country, description, and metadata." },
  { key: "genre", label: "Genres", note: "Sounds, styles, descriptions, representative artists, and relationships." },
  { key: "article", label: "Articles", note: "WAKILISHA articles and editorial records." },
  { key: "author", label: "Authors", note: "WAKILISHA contributors and author records." },
  { key: "chart_family", label: "Charts", note: "Chart programs, markets, rules, editions, and entries." },
];

const searchableTypes: WakilishaRecordEntityType[] = [
  "artist",
  "track",
  "release",
  "label",
  "genre",
  "article",
  "author",
  "chart_family",
];

function compact(values: Array<string | number | null | undefined | false>) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "";
  }
}

function searchBlob(values: unknown[]) {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value.map((item) => safeJson(item));
      if (value && typeof value === "object") return [safeJson(value), ...Object.values(value as Record<string, unknown>).map(String)];
      return [String(value || "")];
    })
    .join(" ")
    .toLowerCase();
}

function groupBy<T extends AnyRow>(rows: T[], key: string) {
  const map = new Map<string, T[]>();

  rows.forEach((row) => {
    const value = String(row[key] ?? "").trim();
    if (!value) return;
    map.set(value, [...(map.get(value) ?? []), row]);
  });

  return map;
}

function mapBy<T extends AnyRow>(rows: T[], key: string) {
  const map = new Map<string, T>();

  rows.forEach((row) => {
    const value = String(row[key] ?? "").trim();
    if (value && !map.has(value)) map.set(value, row);
  });

  return map;
}

function healthFrom(missingFields: string[], notes: string[] = []): WakilishaRecordHealth {
  if (missingFields.length >= 3) return { status: "needs_review", missingFields, notes };
  if (missingFields.length > 0 || notes.length > 0) return { status: "thin", missingFields, notes };
  return { status: "usable", missingFields, notes };
}

function statusNote(status: string | null | undefined) {
  return status && status !== "active" ? [`Registry status is ${status}. Use carefully as evidence.`] : [];
}

function hrefFor(type: WakilishaRecordEntityType, slug: string) {
  if (type === "artist") return `/artists/${slug}`;
  if (type === "track") return `/tracks/${slug}`;
  if (type === "release") return `/releases/${slug}`;
  if (type === "label") return `/labels/${slug}`;
  if (type === "genre") return `/genres/${slug}`;
  if (type === "article") return `/magazine/${slug}`;
  if (type === "author") return `/authors/${slug}`;
  if (type === "chart_family") return `/charts/${slug}`;
  return "";
}

function like(query: string) {
  return `%${query.replaceAll("%", "").replaceAll(",", " ").trim()}%`;
}

function socialLinksFrom(metadata: AnyRow | null | undefined) {
  const meta = metadata ?? {};
  const links = [
    ["Spotify", meta.spotify_url || (meta.spotify_artist_id ? `spotify:artist:${meta.spotify_artist_id}` : "") || (meta.spotify_id ? `spotify:artist:${meta.spotify_id}` : "")],
    ["Apple Music", meta.apple_music_url || (meta.apple_music_id ? `apple-music:${meta.apple_music_id}` : "")],
    ["Instagram", meta.instagram_url],
    ["YouTube", meta.youtube_url],
    ["TikTok", meta.tiktok_url],
    ["X / Twitter", meta.twitter_url],
    ["Facebook", meta.facebook_url],
    ["Website", meta.website_url],
  ];

  return links
    .map(([label, url]) => ({ label, url: String(url || "").trim() }))
    .filter((item) => item.url);
}

function metadataHighlights(metadata: AnyRow | null | undefined) {
  const meta = metadata ?? {};
  const keys = [
    "source",
    "source_kind",
    "country",
    "genres",
    "enriched_genres",
    "spotify_followers",
    "spotify_popularity",
    "spotify_artist_id",
    "spotify_id",
    "apple_music_id",
    "apple_music_album_ids",
    "top_songs",
    "youtube_videos",
    "portrait_image",
    "source_entity",
  ];

  return Object.fromEntries(
    keys
      .filter((key) => meta[key] !== undefined && meta[key] !== null && String(meta[key]).trim() !== "")
      .map((key) => [key, meta[key]]),
  );
}

function relationSummary(rows: AnyRow[], slug: string) {
  return rows
    .filter((row) => row.source_slug === slug || row.target_slug === slug)
    .slice(0, 12)
    .map((row) => ({
      type: row.relationship_type,
      role: row.relationship_role,
      source: row.source_slug,
      target: row.target_slug,
      sourceType: row.source_entity_type,
      targetType: row.target_entity_type,
      confidence: row.confidence,
    }));
}

function mediaSummary(rows: AnyRow[], entityId: string, slug: string) {
  return rows
    .filter((row) => row.source_record_id === entityId || row.source_entity === slug)
    .slice(0, 8)
    .map((row) => ({
      title: row.title,
      url: row.url,
      kind: row.media_kind || row.file_kind,
      purpose: row.asset_purpose,
      credit: row.credit_text,
      rights: row.rights_status,
    }));
}

function authorDisplayName(row: AuthorRow) {
  return row.name
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function toArtistRecord(artist: AnyRow): WakilishaRecordSearchResult {
  const meta = (artist.metadata ?? {}) as AnyRow;
  const slug = String(artist.slug || "");
  const country = meta.country || artist.origin_iso2 || "";
  const genres = Array.isArray(meta.genres) ? meta.genres : Array.isArray(meta.enriched_genres) ? meta.enriched_genres : [];
  const socials = socialLinksFrom(meta);
  const missing = compact([
    artist.public_image_url || meta.portrait_image ? "" : "image",
    artist.bio ? "" : "bio",
    country ? "" : "country/origin",
    genres.length ? "" : "genres",
    socials.length ? "" : "social/provider links",
  ]);

  const snapshot = {
    source: "registry_artists",
    entityType: "artist",
    id: artist.id,
    slug,
    name: artist.display_name,
    normalizedName: artist.normalized_name,
    sortName: artist.sort_name,
    bio: artist.bio,
    artistType: artist.artist_type,
    gender: artist.gender,
    originIso2: artist.origin_iso2,
    originConfidence: artist.origin_confidence,
    country,
    genres,
    publicImageUrl: artist.public_image_url,
    imageSourceProvider: artist.image_source_provider,
    status: artist.status,
    metadata: meta,
    metadataHighlights: metadataHighlights(meta),
    href: hrefFor("artist", slug),
  };

  return {
    id: `artist:${slug}`,
    entityType: "artist",
    slug,
    label: artist.display_name || slug,
    subtitle: compact([artist.status !== "active" ? artist.status : "", country, genres.slice(0, 2).join(", ")]).join(" · ") || "Artist",
    href: hrefFor("artist", slug),
    imageUrl: artist.public_image_url || meta.portrait_image || null,
    contextText: artist.bio ? cleanText(artist.bio) : compact([country, genres.slice(0, 3).join(", ")]).join(" · "),
    snapshot,
    health: healthFrom(missing, statusNote(artist.status)),
    searchText: searchBlob([artist.display_name, artist.normalized_name, slug, artist.bio, artist.status, meta, socials]),
  };
}

function toTrackRecord(track: AnyRow, artists: AnyRow[] = [], release: AnyRow | null = null, chartEntries: AnyRow[] = []): WakilishaRecordSearchResult {
  const slug = String(track.slug || "");
  const primaryArtist = artists.find((artist) => artist.is_primary) ?? artists[0] ?? null;

  const artistCredits = artists
    .sort((a, b) => Number(a.credit_order ?? 999) - Number(b.credit_order ?? 999))
    .map((artist) => ({
      slug: artist.artist_slug,
      name: artist.artist_name_text,
      role: artist.role,
      isPrimary: artist.is_primary,
      isFeatured: artist.is_featured,
      displayCredit: artist.display_credit,
    }));

  const missing = compact([
    track.artwork_url ? "" : "artwork",
    artistCredits.length ? "" : "artist credits",
    release ? "" : "release",
    track.preview_url ? "" : "preview/provider audio",
  ]);

  const snapshot = {
    source: "registry_tracks",
    entityType: "track",
    id: track.id,
    slug,
    title: track.title,
    normalizedTitle: track.normalized_title,
    isrc: track.isrc,
    durationMs: track.duration_ms,
    explicit: track.explicit,
    trackNumber: track.track_number,
    discNumber: track.disc_number,
    artworkUrl: track.artwork_url,
    previewUrl: track.preview_url,
    status: track.status,
    metadata: track.metadata ?? {},
    href: hrefFor("track", slug),
    richContext: {
      searchContext: {
        artists: artistCredits,
        release: release
          ? {
              slug: release.slug,
              title: release.title,
              releaseType: release.release_type,
              releaseDate: release.release_date,
              artworkUrl: release.artwork_url,
            }
          : null,
        chartEntryCount: chartEntries.length,
      },
    },
  };

  return {
    id: `track:${slug}`,
    entityType: "track",
    slug,
    label: track.title || slug,
    subtitle: compact([track.status !== "active" ? track.status : "", primaryArtist?.artist_name_text, release?.title]).join(" · ") || "Track",
    href: hrefFor("track", slug),
    imageUrl: track.artwork_url || release?.artwork_url || null,
    contextText: compact([primaryArtist?.artist_name_text, release?.title, track.isrc]).join(" · "),
    snapshot,
    health: healthFrom(missing, statusNote(track.status)),
    searchText: searchBlob([track.title, track.normalized_title, slug, track.isrc, track.metadata, artistCredits, release, chartEntries]),
  };
}

function toReleaseRecord(release: AnyRow, artists: AnyRow[] = [], label: AnyRow | null = null, trackCount = 0): WakilishaRecordSearchResult {
  const slug = String(release.slug || "");
  const primaryArtist = artists.find((artist) => artist.is_primary) ?? artists[0] ?? null;

  const artistCredits = artists
    .sort((a, b) => Number(a.credit_order ?? 999) - Number(b.credit_order ?? 999))
    .map((artist) => ({
      slug: artist.artist_slug,
      name: artist.artist_name_text,
      role: artist.role,
      isPrimary: artist.is_primary,
      isFeatured: artist.is_featured,
      displayCredit: artist.display_credit,
    }));

  const missing = compact([
    release.artwork_url ? "" : "artwork",
    artistCredits.length ? "" : "artist credits",
    release.release_date ? "" : "release date",
    trackCount ? "" : "tracklist",
    release.description ? "" : "description",
    label ? "" : "label",
  ]);

  const snapshot = {
    source: "registry_releases",
    entityType: "release",
    id: release.id,
    slug,
    title: release.title,
    normalizedTitle: release.normalized_title,
    releaseType: release.release_type,
    upc: release.upc,
    releaseDate: release.release_date,
    releaseDatePrecision: release.release_date_precision,
    artworkUrl: release.artwork_url,
    description: release.description,
    status: release.status,
    metadata: release.metadata ?? {},
    href: hrefFor("release", slug),
    richContext: {
      searchContext: {
        artists: artistCredits,
        label: label
          ? {
              slug: label.slug,
              name: label.name,
              countryCode: label.country_code,
            }
          : null,
        trackCount,
      },
    },
  };

  return {
    id: `release:${slug}`,
    entityType: "release",
    slug,
    label: release.title || slug,
    subtitle: compact([
      release.status !== "active" ? release.status : "",
      primaryArtist?.artist_name_text,
      release.release_type,
      release.release_date,
      trackCount ? `${trackCount} track(s)` : "",
    ]).join(" · ") || "Release",
    href: hrefFor("release", slug),
    imageUrl: release.artwork_url || null,
    contextText: release.description || compact([primaryArtist?.artist_name_text, release.release_type, release.release_date]).join(" · "),
    snapshot,
    health: healthFrom(missing, statusNote(release.status)),
    searchText: searchBlob([release.title, release.normalized_title, slug, release.description, release.metadata, artistCredits, label]),
  };
}

function toLabelRecord(label: AnyRow): WakilishaRecordSearchResult {
  const slug = String(label.slug || "");
  const missing = compact([
    label.description ? "" : "description",
    label.country_code ? "" : "country",
  ]);

  const snapshot = {
    source: "registry_labels",
    entityType: "label",
    id: label.id,
    slug,
    name: label.name,
    normalizedName: label.normalized_name,
    description: label.description,
    countryCode: label.country_code,
    status: label.status,
    metadata: label.metadata ?? {},
    href: hrefFor("label", slug),
  };

  return {
    id: `label:${slug}`,
    entityType: "label",
    slug,
    label: label.name || slug,
    subtitle: compact([label.status !== "active" ? label.status : "", label.country_code]).join(" · ") || "Label",
    href: hrefFor("label", slug),
    imageUrl: null,
    contextText: label.description || label.country_code || "",
    snapshot,
    health: healthFrom(missing, statusNote(label.status)),
    searchText: searchBlob([label.name, label.normalized_name, slug, label.description, label.country_code, label.metadata]),
  };
}

function toGenreRecord(genre: AnyRow): WakilishaRecordSearchResult {
  const slug = String(genre.slug || "");
  const missing = compact([
    genre.description ? "" : "description",
  ]);

  const snapshot = {
    source: "registry_genres",
    entityType: "genre",
    id: genre.id,
    slug,
    name: genre.name,
    description: genre.description,
    parentGenreId: genre.parent_genre_id,
    status: genre.status,
    metadata: genre.metadata ?? {},
    href: hrefFor("genre", slug),
  };

  return {
    id: `genre:${slug}`,
    entityType: "genre",
    slug,
    label: genre.name || slug,
    subtitle: compact([genre.status !== "active" ? genre.status : "", "Genre"]).join(" · "),
    href: hrefFor("genre", slug),
    imageUrl: null,
    contextText: genre.description || "",
    snapshot,
    health: healthFrom(missing, statusNote(genre.status)),
    searchText: searchBlob([genre.name, slug, genre.description, genre.metadata]),
  };
}

function toArticleRecord(article: AdminArticleListItem): WakilishaRecordSearchResult {
  const slug = article.slug;
  const label = article.title || slug;
  const subtitle = compact([
    article.author ? `By ${article.author}` : "",
    article.wpStatus || "",
    article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : "",
  ]).join(" · ") || "WAKILISHA article";

  const missing = compact([
    article.heroImageUrl ? "" : "hero image",
    article.excerpt ? "" : "excerpt",
    article.author ? "" : "author",
    article.publishedAt ? "" : "published date",
  ]);

  const snapshot = {
    source: "wk_articles",
    entityType: "article",
    slug,
    title: article.title,
    excerpt: article.excerpt,
    author: article.author,
    publishedAt: article.publishedAt,
    status: article.wpStatus,
    categories: article.categories,
    tags: article.tags,
    heroImageUrl: article.heroImageUrl,
    href: hrefFor("article", slug),
    richContext: {
      editorial: {
        categories: article.categories,
        tags: article.tags,
        status: article.wpStatus,
      },
    },
  };

  return {
    id: `article:${slug}`,
    entityType: "article",
    slug,
    label,
    subtitle,
    href: hrefFor("article", slug),
    imageUrl: article.heroImageUrl ?? null,
    contextText: article.excerpt || subtitle,
    snapshot,
    health: healthFrom(missing),
    searchText: searchBlob([label, subtitle, article.excerpt, article.author, article.categories, article.tags, slug, snapshot]),
  };
}

function toAuthorRecord(author: AuthorRow): WakilishaRecordSearchResult {
  const displayName = authorDisplayName(author);
  const subtitle = compact([author.role || "Contributor", author.location || "", author.source_kind || "registry author"]).join(" · ");
  const missing = compact([author.avatar_url ? "" : "avatar", author.bio ? "" : "bio", author.role ? "" : "role", author.location ? "" : "location"]);

  const snapshot = {
    source: "registry_authors",
    entityType: "author",
    id: author.id,
    slug: author.slug,
    name: author.name,
    displayName,
    role: author.role,
    bio: author.bio,
    avatarUrl: author.avatar_url,
    coverUrl: author.cover_url,
    location: author.location,
    socialLinks: author.social_links,
    joinedDate: author.joined_date,
    url: author.url,
    sourceKind: author.source_kind,
    href: hrefFor("author", author.slug),
    richContext: {
      profile: {
        bio: author.bio,
        role: author.role,
        location: author.location,
        socialLinks: author.social_links,
      },
    },
  };

  return {
    id: `author:${author.slug}`,
    entityType: "author",
    slug: author.slug,
    label: displayName,
    subtitle,
    href: hrefFor("author", author.slug),
    imageUrl: author.avatar_url ?? null,
    contextText: author.bio || subtitle,
    snapshot,
    health: healthFrom(missing),
    searchText: searchBlob([displayName, author.name, subtitle, author.bio, author.slug, author.location, author.role, snapshot]),
  };
}

function toChartFamilyRecord(family: ChartFamily): WakilishaRecordSearchResult | null {
  const slug = family.slug || family.publicSlug || family.familyKey;
  if (!slug) return null;

  const label = family.publicLabel || family.label || family.shortLabel || slug;
  const subtitle = compact([
    family.marketLabel || family.defaultRegion,
    family.periodType || family.editionFrequency,
    family.defaultChartSize ? `${family.defaultChartSize} entries` : "",
  ]).join(" · ") || "WAKILISHA chart family";

  const missing = compact([
    family.description ? "" : "description",
    family.defaultRegion ? "" : "region",
    family.defaultRuleset && family.defaultRuleset !== "unknown" ? "" : "ruleset",
    family.defaultScoringModel && family.defaultScoringModel !== "unknown" ? "" : "scoring model",
  ]);

  const snapshot = {
    source: "chartsPublic.getChartFamilies",
    entityType: "chart_family",
    id: family.id,
    slug,
    label,
    familyKey: family.familyKey,
    description: family.description,
    defaultChartSize: family.defaultChartSize,
    defaultRegion: family.defaultRegion,
    editionFrequency: family.editionFrequency,
    defaultRuleset: family.defaultRuleset,
    defaultScoringModel: family.defaultScoringModel,
    seriesSlug: family.seriesSlug,
    seriesLabel: family.seriesLabel,
    marketSlug: family.marketSlug,
    marketLabel: family.marketLabel,
    publicSlug: family.publicSlug,
    publicLabel: family.publicLabel,
    chartMode: family.chartMode,
    periodType: family.periodType,
    methodologyVersion: family.methodologyVersion,
    eligibilityRulesVersion: family.eligibilityRulesVersion,
    href: hrefFor("chart_family", slug),
    richContext: {
      methodology: {
        ruleset: family.defaultRuleset,
        scoringModel: family.defaultScoringModel,
        methodologyVersion: family.methodologyVersion,
        eligibilityRulesVersion: family.eligibilityRulesVersion,
      },
      market: {
        marketSlug: family.marketSlug,
        marketLabel: family.marketLabel,
        defaultRegion: family.defaultRegion,
      },
    },
  };

  return {
    id: `chart_family:${slug}`,
    entityType: "chart_family",
    slug,
    label,
    subtitle,
    href: hrefFor("chart_family", slug),
    imageUrl: null,
    contextText: family.description || subtitle,
    snapshot,
    health: healthFrom(missing),
    searchText: searchBlob([label, subtitle, family.description, family.familyKey, family.seriesLabel, family.marketLabel, slug, snapshot]),
  };
}

async function searchArtists(query: string) {
  const pattern = like(query);

  const { data, error } = await supabase
    .from("registry_artists")
    .select("id, slug, display_name, normalized_name, sort_name, bio, artist_type, gender, origin_iso2, origin_confidence, public_image_url, image_source_provider, status, metadata, updated_at")
    .or(`slug.ilike.${pattern},display_name.ilike.${pattern},normalized_name.ilike.${pattern},sort_name.ilike.${pattern},bio.ilike.${pattern}`)
    .order("display_name")
    .limit(25);

  if (error) throw error;

  return (data ?? []).map(toArtistRecord);
}

async function searchTracks(query: string) {
  const pattern = like(query);

  const { data: tracks, error } = await supabase
    .from("registry_tracks")
    .select("id, slug, title, normalized_title, isrc, release_id, duration_ms, explicit, track_number, disc_number, artwork_url, preview_url, status, metadata, updated_at")
    .or(`slug.ilike.${pattern},title.ilike.${pattern},normalized_title.ilike.${pattern},isrc.ilike.${pattern}`)
    .order("title")
    .limit(25);

  if (error) throw error;

  const trackRows = tracks ?? [];
  const trackIds = trackRows.map((track) => String(track.id));
  const releaseIds = trackRows.map((track) => String(track.release_id || "")).filter(Boolean);
  const trackSlugs = trackRows.map((track) => String(track.slug || "")).filter(Boolean);

  const [artistsResult, releasesResult, chartResult] = await Promise.all([
    trackIds.length
      ? supabase.from("registry_track_artists").select("track_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, status").in("track_id", trackIds).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    releaseIds.length
      ? supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, status").in("id", releaseIds)
      : Promise.resolve({ data: [], error: null }),
    trackSlugs.length
      ? supabase.from("wk_chart_entries_v2").select("id, edition_id, rank, movement, track_slug, track_title, artist_slug, artist_name, artwork_url, total_score, eligibility_status").in("track_slug", trackSlugs)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (artistsResult.error) throw artistsResult.error;
  if (releasesResult.error) throw releasesResult.error;
  if (chartResult.error) throw chartResult.error;

  const artistsByTrackId = groupBy((artistsResult.data ?? []) as AnyRow[], "track_id");
  const releasesById = mapBy((releasesResult.data ?? []) as AnyRow[], "id");
  const chartEntriesByTrackSlug = groupBy((chartResult.data ?? []) as AnyRow[], "track_slug");

  return trackRows.map((track) =>
    toTrackRecord(
      track,
      artistsByTrackId.get(String(track.id)) ?? [],
      releasesById.get(String(track.release_id || "")) ?? null,
      chartEntriesByTrackSlug.get(String(track.slug || "")) ?? [],
    ),
  );
}

async function searchReleases(query: string) {
  const pattern = like(query);

  const { data: releases, error } = await supabase
    .from("registry_releases")
    .select("id, slug, title, normalized_title, release_type, upc, release_date, release_date_precision, label_id, artwork_url, status, metadata, description, updated_at")
    .or(`slug.ilike.${pattern},title.ilike.${pattern},normalized_title.ilike.${pattern},upc.ilike.${pattern},description.ilike.${pattern}`)
    .order("title")
    .limit(25);

  if (error) throw error;

  const releaseRows = releases ?? [];
  const releaseIds = releaseRows.map((release) => String(release.id));
  const labelIds = releaseRows.map((release) => String(release.label_id || "")).filter(Boolean);
  const releaseSlugs = releaseRows.map((release) => String(release.slug || "")).filter(Boolean);

  const [artistsResult, labelsResult, tracklistsResult, releaseTracksResult] = await Promise.all([
    releaseIds.length
      ? supabase.from("registry_release_artists").select("release_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, status").in("release_id", releaseIds).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    labelIds.length
      ? supabase.from("registry_labels").select("id, slug, name, country_code, description, status").in("id", labelIds)
      : Promise.resolve({ data: [], error: null }),
    releaseSlugs.length
      ? supabase.from("registry_release_tracklists").select("release_slug, track_count").in("release_slug", releaseSlugs)
      : Promise.resolve({ data: [], error: null }),
    releaseIds.length
      ? supabase.from("registry_release_tracks").select("release_id, track_id").in("release_id", releaseIds).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (artistsResult.error) throw artistsResult.error;
  if (labelsResult.error) throw labelsResult.error;
  if (tracklistsResult.error) throw tracklistsResult.error;
  if (releaseTracksResult.error) throw releaseTracksResult.error;

  const artistsByReleaseId = groupBy((artistsResult.data ?? []) as AnyRow[], "release_id");
  const labelsById = mapBy((labelsResult.data ?? []) as AnyRow[], "id");
  const tracklistBySlug = mapBy((tracklistsResult.data ?? []) as AnyRow[], "release_slug");
  const releaseTracksByReleaseId = groupBy((releaseTracksResult.data ?? []) as AnyRow[], "release_id");

  return releaseRows.map((release) => {
    const trackCount = Number(tracklistBySlug.get(String(release.slug || ""))?.track_count ?? releaseTracksByReleaseId.get(String(release.id))?.length ?? 0);
    return toReleaseRecord(release, artistsByReleaseId.get(String(release.id)) ?? [], labelsById.get(String(release.label_id || "")) ?? null, trackCount);
  });
}

async function searchLabels(query: string) {
  const pattern = like(query);

  const { data, error } = await supabase
    .from("registry_labels")
    .select("id, slug, name, normalized_name, description, country_code, status, metadata, updated_at")
    .or(`slug.ilike.${pattern},name.ilike.${pattern},normalized_name.ilike.${pattern},description.ilike.${pattern},country_code.ilike.${pattern}`)
    .order("name")
    .limit(25);

  if (error) throw error;

  return (data ?? []).map(toLabelRecord);
}

async function searchGenres(query: string) {
  const pattern = like(query);

  const { data, error } = await supabase
    .from("registry_genres")
    .select("id, slug, name, parent_genre_id, description, status, metadata, updated_at")
    .or(`slug.ilike.${pattern},name.ilike.${pattern},description.ilike.${pattern}`)
    .order("name")
    .limit(25);

  if (error) throw error;

  return (data ?? []).map(toGenreRecord);
}

async function searchArticles(query: string) {
  const clean = query.toLowerCase();
  const articles = await fetchArticlesForAdminList(500);

  return articles
    .map(toArticleRecord)
    .filter((record) => record.searchText.includes(clean))
    .slice(0, 25);
}

async function searchAuthors(query: string) {
  const clean = query.toLowerCase();
  const authors = await fetchAllAuthors();

  return authors
    .map(toAuthorRecord)
    .filter((record) => record.searchText.includes(clean))
    .slice(0, 25);
}

async function searchChartFamilies(query: string) {
  const clean = query.toLowerCase();
  const chartPayload = await getChartFamilies().catch(() => ({ data: { families: [], editions: [] } }));

  const familyRecords = (chartPayload.data.families ?? [])
    .map(toChartFamilyRecord)
    .filter(Boolean) as WakilishaRecordSearchResult[];

  const { data: programs } = await supabase
    .from("wk_chart_programs_v2")
    .select("id, series_slug, market_slug, public_slug, public_label, short_label, source_family_slug, default_period_type, default_methodology_version, default_eligibility_rules_version, chart_size, airplay_enabled, airplay_station_scope, updated_at")
    .limit(25);

  const programRecords = (programs ?? []).map((program) => {
    const slug = String(program.public_slug || program.id || "");
    const snapshot = {
      source: "wk_chart_programs_v2",
      entityType: "chart_family",
      id: program.id,
      slug,
      label: program.public_label,
      shortLabel: program.short_label,
      seriesSlug: program.series_slug,
      marketSlug: program.market_slug,
      sourceFamilySlug: program.source_family_slug,
      periodType: program.default_period_type,
      methodologyVersion: program.default_methodology_version,
      eligibilityRulesVersion: program.default_eligibility_rules_version,
      chartSize: program.chart_size,
      airplayEnabled: program.airplay_enabled,
      airplayStationScope: program.airplay_station_scope,
      href: hrefFor("chart_family", slug),
      richContext: {
        chartProgram: program,
      },
    };

    return {
      id: `chart_program:${slug}`,
      entityType: "chart_family" as const,
      slug,
      label: program.public_label || slug,
      subtitle: compact([program.market_slug, program.default_period_type, program.chart_size ? `${program.chart_size} entries` : ""]).join(" · ") || "Chart program",
      href: hrefFor("chart_family", slug),
      imageUrl: null,
      contextText: compact([program.public_label, program.series_slug, program.market_slug]).join(" · "),
      snapshot,
      health: healthFrom([], []),
      searchText: searchBlob([program]),
    };
  });

  return [...familyRecords, ...programRecords]
    .filter((record) => record.searchText.includes(clean))
    .slice(0, 25);
}

async function searchByType(type: WakilishaRecordEntityType, query: string) {
  if (type === "artist") return searchArtists(query);
  if (type === "track") return searchTracks(query);
  if (type === "release") return searchReleases(query);
  if (type === "label") return searchLabels(query);
  if (type === "genre") return searchGenres(query);
  if (type === "article") return searchArticles(query);
  if (type === "author") return searchAuthors(query);
  if (type === "chart_family") return searchChartFamilies(query);
  return [];
}

export function useWakilishaRecordSearch(entityType: "all" | WakilishaRecordEntityType, query: string) {
  const cleanQuery = query.trim();
  const [records, setRecords] = useState<WakilishaRecordSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    if (cleanQuery.length < 2) {
      setRecords([]);
      setLoading(false);
      setError("");
      return () => {
        alive = false;
      };
    }

    const timeout = window.setTimeout(() => {
      async function runSearch() {
        setLoading(true);
        setError("");

        try {
          const typesToSearch = entityType === "all" ? searchableTypes : [entityType];
          const chunks = await Promise.all(typesToSearch.map((type) => searchByType(type, cleanQuery)));

          if (!alive) return;

          const nextRecords = chunks
            .flat()
            .filter((record, index, all) => all.findIndex((candidate) => candidate.id === record.id) === index)
            .sort((a, b) => {
              const aExact = a.label.toLowerCase() === cleanQuery.toLowerCase() || a.slug.toLowerCase() === cleanQuery.toLowerCase();
              const bExact = b.label.toLowerCase() === cleanQuery.toLowerCase() || b.slug.toLowerCase() === cleanQuery.toLowerCase();

              if (aExact && !bExact) return -1;
              if (!aExact && bExact) return 1;
              return a.label.localeCompare(b.label);
            })
            .slice(0, 80);

          setRecords(nextRecords);
        } catch (searchError) {
          if (!alive) return;
          setRecords([]);
          setError(searchError instanceof Error ? searchError.message : "Failed to search WAKILISHA records.");
        } finally {
          if (alive) setLoading(false);
        }
      }

      void runSearch();
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [cleanQuery, entityType]);

  return {
    records,
    loading,
    error,
    totalRecords: records.length,
  };
}

async function loadEntityRelationships(slugs: string[]) {
  if (!slugs.length) return [];

  const source = await supabase
    .from("registry_entity_relationships")
    .select("source_entity_type, source_slug, target_entity_type, target_slug, relationship_type, relationship_role, relationship_status, confidence, metadata")
    .in("source_slug", slugs)
    .eq("relationship_status", "active");

  const target = await supabase
    .from("registry_entity_relationships")
    .select("source_entity_type, source_slug, target_entity_type, target_slug, relationship_type, relationship_role, relationship_status, confidence, metadata")
    .in("target_slug", slugs)
    .eq("relationship_status", "active");

  if (source.error) throw source.error;
  if (target.error) throw target.error;

  return [...(source.data ?? []), ...(target.data ?? [])];
}

export async function fetchWakilishaRecordDetail(record: WakilishaRecordSearchResult): Promise<WakilishaRecordDetail> {
  if (record.entityType === "artist") {
    const { data: artist, error } = await supabase
      .from("registry_artists")
      .select("id, slug, display_name, normalized_name, sort_name, bio, artist_type, gender, origin_iso2, origin_confidence, public_image_url, image_source_provider, status, metadata, updated_at")
      .eq("slug", record.slug)
      .maybeSingle();

    if (error || !artist) return {};

    const artistId = String(artist.id);
    const slug = String(artist.slug);

    const [aliasesResult, trackArtistsResult, releaseArtistsResult, chartEntriesResult, relationships, mediaResult] = await Promise.all([
      supabase.from("registry_artist_aliases").select("alias_slug, alias_display_name, confidence, source, notes, provider_type, provider_id, provider_uri, status").eq("canonical_artist_id", artistId).eq("status", "active"),
      supabase.from("registry_track_artists").select("track_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, status").eq("artist_slug", slug).eq("status", "active"),
      supabase.from("registry_release_artists").select("release_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, status").eq("artist_slug", slug).eq("status", "active"),
      supabase.from("wk_chart_entries_v2").select("id, edition_id, rank, movement, track_slug, track_title, artist_slug, artist_name, artwork_url, total_score, eligibility_status, source_count, occurrence_count, source_urls_seen").eq("artist_slug", slug),
      loadEntityRelationships([slug]),
      supabase.from("registry_media_assets").select("title, url, media_kind, file_kind, asset_purpose, source_entity, source_record_id, status, rights_status, credit_text, tags, metadata").or(`source_entity.eq.${slug},source_record_id.eq.${artistId}`).eq("status", "active"),
    ]);

    if (aliasesResult.error) throw aliasesResult.error;
    if (trackArtistsResult.error) throw trackArtistsResult.error;
    if (releaseArtistsResult.error) throw releaseArtistsResult.error;
    if (chartEntriesResult.error) throw chartEntriesResult.error;
    if (mediaResult.error) throw mediaResult.error;

    const trackIds = (trackArtistsResult.data ?? []).map((row) => String(row.track_id)).filter(Boolean);
    const releaseIds = (releaseArtistsResult.data ?? []).map((row) => String(row.release_id)).filter(Boolean);

    const [tracksResult, releasesResult] = await Promise.all([
      trackIds.length
        ? supabase.from("registry_tracks").select("id, slug, title, artwork_url, preview_url, status, metadata").in("id", trackIds).limit(40)
        : Promise.resolve({ data: [], error: null }),
      releaseIds.length
        ? supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, status, metadata").in("id", releaseIds).limit(40)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tracksResult.error) throw tracksResult.error;
    if (releasesResult.error) throw releasesResult.error;

    const meta = (artist.metadata ?? {}) as AnyRow;
    const country = meta.country || artist.origin_iso2 || "";
    const genres = Array.isArray(meta.genres) ? meta.genres : Array.isArray(meta.enriched_genres) ? meta.enriched_genres : [];

    const richContext = {
      profile: {
        bio: artist.bio,
        artistType: artist.artist_type,
        gender: artist.gender,
        originIso2: artist.origin_iso2,
        country,
        genres,
      },
      trail: {
        socialLinks: socialLinksFrom(meta),
        spotifyFollowers: meta.spotify_followers,
        spotifyPopularity: meta.spotify_popularity,
        spotifyArtistId: meta.spotify_artist_id || meta.spotify_id,
        appleMusicId: meta.apple_music_id,
        appleMusicAlbumIds: meta.apple_music_album_ids,
      },
      aliases: aliasesResult.data ?? [],
      discography: {
        linkedTrackCount: trackIds.length,
        linkedReleaseCount: releaseIds.length,
        linkedTracks: (tracksResult.data ?? []).map((track) => ({
          slug: track.slug,
          title: track.title,
          artworkUrl: track.artwork_url,
          status: track.status,
        })),
        linkedReleases: (releasesResult.data ?? []).map((release) => ({
          slug: release.slug,
          title: release.title,
          releaseType: release.release_type,
          releaseDate: release.release_date,
          artworkUrl: release.artwork_url,
          status: release.status,
        })),
        topSongs: Array.isArray(meta.top_songs) ? meta.top_songs : [],
        youtubeVideos: Array.isArray(meta.youtube_videos) ? meta.youtube_videos : [],
      },
      charts: {
        chartEntryCount: chartEntriesResult.data?.length ?? 0,
        entries: chartEntriesResult.data ?? [],
      },
      relationships: relationSummary(relationships as AnyRow[], slug),
      media: mediaSummary((mediaResult.data ?? []) as AnyRow[], artistId, slug),
    };

    return {
      richContext,
      snapshotPatch: {
        ...artist,
        country,
        genres,
        metadataHighlights: metadataHighlights(meta),
        richContext,
      },
    };
  }

  if (record.entityType === "track") {
    const { data: track, error } = await supabase
      .from("registry_tracks")
      .select("id, slug, title, normalized_title, isrc, release_id, duration_ms, explicit, track_number, disc_number, artwork_url, preview_url, status, metadata, updated_at")
      .eq("slug", record.slug)
      .maybeSingle();

    if (error || !track) return {};

    const trackId = String(track.id);
    const slug = String(track.slug);
    const releaseId = String(track.release_id || "");

    const [artistsResult, releaseResult, providerResult, chartResult, relationships] = await Promise.all([
      supabase.from("registry_track_artists").select("artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, source, confidence, status, metadata").eq("track_id", trackId).eq("status", "active"),
      releaseId
        ? supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, status, metadata").eq("id", releaseId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("registry_track_provider_links").select("provider_key, provider_track_id, provider_release_id, provider_artist_ids, isrc, upc, preview_url, artwork_url, duration_ms, storefront, match_method, match_confidence, match_status, raw_payload").eq("track_id", trackId),
      supabase.from("wk_chart_entries_v2").select("id, edition_id, rank, previous_rank, movement, track_slug, track_title, artist_slug, artist_name, artwork_url, source_count, occurrence_count, source_urls_seen, release_date, canonical_track_id, total_score, eligibility_status, source_payload, airplay_detections, airplay_station_count, airplay_weighted_score").eq("track_slug", slug),
      loadEntityRelationships([slug]),
    ]);

    if (artistsResult.error) throw artistsResult.error;
    if (releaseResult.error) throw releaseResult.error;
    if (providerResult.error) throw providerResult.error;
    if (chartResult.error) throw chartResult.error;

    const richContext = {
      artists: artistsResult.data ?? [],
      release: releaseResult.data ?? null,
      providerLinks: providerResult.data ?? [],
      charts: {
        chartEntryCount: chartResult.data?.length ?? 0,
        entries: chartResult.data ?? [],
      },
      relationships: relationSummary(relationships as AnyRow[], slug),
    };

    return {
      richContext,
      snapshotPatch: {
        ...track,
        richContext,
      },
    };
  }

  if (record.entityType === "release") {
    const { data: releaseRow, error: releaseError } = await supabase
      .from("registry_releases")
      .select("id, slug, title, normalized_title, release_type, upc, release_date, release_date_precision, label_id, artwork_url, status, metadata, description, updated_at")
      .eq("slug", record.slug)
      .maybeSingle();

    if (releaseError || !releaseRow?.id) return {};

    const releaseId = String(releaseRow.id);
    const labelId = String(releaseRow.label_id || "");

    const [artistsResult, labelResult, tracklistResult, releaseTracksResult, relationships, mediaResult] = await Promise.all([
      supabase.from("registry_release_artists").select("artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, source, confidence, status, metadata").eq("release_id", releaseId).eq("status", "active"),
      labelId
        ? supabase.from("registry_labels").select("id, slug, name, country_code, description, status, metadata").eq("id", labelId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("registry_release_tracklists").select("release_slug, release_title, track_count, tracks").eq("release_slug", record.slug).maybeSingle(),
      supabase.from("registry_release_tracks").select("track_id, disc_number, track_number, source, confidence, status, metadata").eq("release_id", releaseId).eq("status", "active").order("track_number", { ascending: true }),
      loadEntityRelationships([record.slug]),
      supabase.from("registry_media_assets").select("title, url, media_kind, file_kind, asset_purpose, source_entity, source_record_id, status, rights_status, credit_text, tags, metadata").or(`source_entity.eq.${record.slug},source_record_id.eq.${releaseId}`).eq("status", "active"),
    ]);

    if (artistsResult.error) throw artistsResult.error;
    if (labelResult.error) throw labelResult.error;
    if (tracklistResult.error) throw tracklistResult.error;
    if (releaseTracksResult.error) throw releaseTracksResult.error;
    if (mediaResult.error) throw mediaResult.error;

    if (tracklistResult.data?.tracks && Array.isArray(tracklistResult.data.tracks)) {
      const tracklist = tracklistResult.data.tracks.map((track: AnyRow, index: number) => ({
        trackNumber: Number(track.trackNumber ?? track.track_number ?? index + 1),
        slug: String(track.slug ?? track.trackSlug ?? ""),
        title: String(track.title ?? track.trackTitle ?? "Untitled track"),
        artists: Array.isArray(track.artists) ? track.artists.map(String) : compact([track.artist, track.artistName]),
        artworkUrl: track.artworkUrl ?? track.artwork_url ?? null,
        previewUrl: track.previewUrl ?? track.preview_url ?? null,
      }));

      const richContext = {
        artists: artistsResult.data ?? [],
        label: labelResult.data ?? null,
        tracklist: {
          source: "registry_release_tracklists",
          trackCount: tracklist.length,
          tracks: tracklist,
        },
        relationships: relationSummary(relationships as AnyRow[], record.slug),
        media: mediaSummary((mediaResult.data ?? []) as AnyRow[], releaseId, record.slug),
      };

      return {
        tracklist,
        richContext,
        snapshotPatch: {
          ...releaseRow,
          richContext,
        },
      };
    }

    const releaseTracks = releaseTracksResult.data ?? [];
    const trackIds = releaseTracks.map((row) => String(row.track_id)).filter(Boolean);

    const [{ data: trackRows }, { data: artistRows }] = await Promise.all([
      trackIds.length
        ? supabase.from("registry_tracks").select("id, slug, title, artwork_url, preview_url").in("id", trackIds)
        : Promise.resolve({ data: [] }),
      trackIds.length
        ? supabase.from("registry_track_artists").select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order").in("track_id", trackIds).eq("status", "active")
        : Promise.resolve({ data: [] }),
    ]);

    const trackById = new Map<string, AnyRow>();
    (trackRows ?? []).forEach((track) => trackById.set(String(track.id), track));

    const artistsByTrack = new Map<string, string[]>();
    (artistRows ?? []).forEach((artist) => {
      const trackId = String(artist.track_id);
      const name = String(artist.artist_name_text || "").trim();
      if (!name) return;
      artistsByTrack.set(trackId, [...(artistsByTrack.get(trackId) ?? []), name]);
    });

    const tracklist = releaseTracks
      .map((row) => {
        const trackId = String(row.track_id);
        const track = trackById.get(trackId);
        if (!track) return null;

        return {
          trackNumber: Number(row.track_number) || 0,
          slug: String(track.slug || ""),
          title: String(track.title || "Untitled track"),
          artists: artistsByTrack.get(trackId) ?? [],
          artworkUrl: track.artwork_url ?? null,
          previewUrl: track.preview_url ?? null,
        };
      })
      .filter(Boolean) as WakilishaRecordDetail["tracklist"];

    const richContext = {
      artists: artistsResult.data ?? [],
      label: labelResult.data ?? null,
      tracklist: {
        source: "registry_release_tracks",
        trackCount: tracklist?.length ?? 0,
        tracks: tracklist ?? [],
      },
      relationships: relationSummary(relationships as AnyRow[], record.slug),
      media: mediaSummary((mediaResult.data ?? []) as AnyRow[], releaseId, record.slug),
    };

    return {
      tracklist,
      richContext,
      snapshotPatch: {
        ...releaseRow,
        richContext,
      },
    };
  }

  if (record.entityType === "label") {
    const { data: label, error } = await supabase
      .from("registry_labels")
      .select("id, slug, name, normalized_name, description, country_code, status, metadata, updated_at")
      .eq("slug", record.slug)
      .maybeSingle();

    if (error || !label) return {};

    const { data: releases } = await supabase
      .from("registry_releases")
      .select("slug, title, release_type, release_date, artwork_url, status, metadata")
      .eq("label_id", label.id)
      .limit(40);

    const relationships = await loadEntityRelationships([record.slug]);

    const richContext = {
      releases: {
        linkedReleaseCount: releases?.length ?? 0,
        linkedReleases: releases ?? [],
      },
      relationships: relationSummary(relationships as AnyRow[], record.slug),
    };

    return {
      richContext,
      snapshotPatch: {
        ...label,
        richContext,
      },
    };
  }

  if (record.entityType === "genre") {
    const { data: genre, error } = await supabase
      .from("registry_genres")
      .select("id, slug, name, parent_genre_id, description, status, metadata, updated_at")
      .eq("slug", record.slug)
      .maybeSingle();

    if (error || !genre) return {};

    const relationships = await loadEntityRelationships([record.slug]);

    const richContext = {
      relationships: relationSummary(relationships as AnyRow[], record.slug),
    };

    return {
      richContext,
      snapshotPatch: {
        ...genre,
        richContext,
      },
    };
  }

  return {};
}
