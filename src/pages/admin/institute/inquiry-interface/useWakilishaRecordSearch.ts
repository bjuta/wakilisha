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

function compact(values: Array<string | number | null | undefined | false>) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
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

function socialLinksFrom(metadata: AnyRow | null | undefined) {
  const meta = metadata ?? {};
  const links = [
    ["Spotify", meta.spotify_url || (meta.spotify_artist_id ? `spotify:artist:${meta.spotify_artist_id}` : "")],
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

  return Object.fromEntries(keys.filter((key) => meta[key] !== undefined && meta[key] !== null && String(meta[key]).trim() !== "").map((key) => [key, meta[key]]));
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

function articleRecord(article: AdminArticleListItem): WakilishaRecordSearchResult {
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

function authorDisplayName(row: AuthorRow) {
  return row.name
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function authorRecord(author: AuthorRow): WakilishaRecordSearchResult {
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

function chartFamilyRecord(family: ChartFamily): WakilishaRecordSearchResult | null {
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

function resultMatches(result: WakilishaRecordSearchResult, query: string) {
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return true;
  return result.searchText.includes(clean);
}

export function useWakilishaRecordSearch(entityType: "all" | WakilishaRecordEntityType, query: string) {
  const [allRecords, setAllRecords] = useState<WakilishaRecordSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadRecords() {
      setLoading(true);
      setError("");

      try {
        const [
          artistsResult,
          tracksResult,
          releasesResult,
          labelsResult,
          genresResult,
          aliasesResult,
          trackArtistsResult,
          releaseArtistsResult,
          releaseTracksResult,
          releaseTracklistsResult,
          entityRelationshipsResult,
          mediaResult,
          trackProviderLinksResult,
          chartEntriesResult,
          chartProgramsResult,
          articles,
          authors,
          chartPayload,
        ] = await Promise.all([
          supabase.from("registry_artists").select("id, slug, display_name, normalized_name, sort_name, bio, artist_type, gender, origin_iso2, origin_confidence, public_image_url, image_source_provider, status, metadata, updated_at").order("display_name"),
          supabase.from("registry_tracks").select("id, slug, title, normalized_title, isrc, release_id, duration_ms, explicit, track_number, disc_number, artwork_url, preview_url, status, metadata, updated_at").order("title"),
          supabase.from("registry_releases").select("id, slug, title, normalized_title, release_type, upc, release_date, release_date_precision, label_id, artwork_url, status, metadata, description, updated_at").order("title"),
          supabase.from("registry_labels").select("id, slug, name, normalized_name, description, country_code, status, metadata, updated_at").order("name"),
          supabase.from("registry_genres").select("id, slug, name, parent_genre_id, description, status, metadata, updated_at").order("name"),
          supabase.from("registry_artist_aliases").select("id, alias_slug, canonical_artist_id, alias_display_name, confidence, source, notes, provider_type, provider_id, provider_uri, status"),
          supabase.from("registry_track_artists").select("track_id, artist_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, source, confidence, status, metadata"),
          supabase.from("registry_release_artists").select("release_id, artist_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit, source, confidence, status, metadata"),
          supabase.from("registry_release_tracks").select("release_id, track_id, disc_number, track_number, source, confidence, status, metadata"),
          supabase.from("registry_release_tracklists").select("release_slug, release_title, track_count, tracks"),
          supabase.from("registry_entity_relationships").select("source_entity_type, source_slug, target_entity_type, target_slug, relationship_type, relationship_role, relationship_status, confidence, metadata"),
          supabase.from("registry_media_assets").select("id, title, url, media_kind, file_kind, asset_purpose, source_entity, source_record_id, status, rights_status, credit_text, tags, metadata"),
          supabase.from("registry_track_provider_links").select("track_id, provider_key, provider_track_id, provider_release_id, provider_artist_ids, isrc, upc, preview_url, artwork_url, duration_ms, storefront, match_method, match_confidence, match_status, raw_payload"),
          supabase.from("wk_chart_entries_v2").select("id, edition_id, rank, previous_rank, movement, track_slug, track_title, artist_slug, artist_name, artwork_url, source_count, occurrence_count, source_urls_seen, release_date, canonical_track_id, canonical_release_id, canonical_artist_id, total_score, eligibility_status, source_payload, airplay_detections, airplay_station_count, airplay_weighted_score"),
          supabase.from("wk_chart_programs_v2").select("id, series_slug, market_slug, public_slug, public_label, short_label, source_family_slug, default_period_type, default_methodology_version, default_eligibility_rules_version, chart_size, airplay_enabled, airplay_station_scope, updated_at"),
          fetchArticlesForAdminList(500),
          fetchAllAuthors(),
          getChartFamilies().catch(() => ({ data: { families: [], editions: [] } })),
        ]);

        const firstError = [
          artistsResult.error,
          tracksResult.error,
          releasesResult.error,
          labelsResult.error,
          genresResult.error,
          aliasesResult.error,
          trackArtistsResult.error,
          releaseArtistsResult.error,
          releaseTracksResult.error,
          releaseTracklistsResult.error,
          entityRelationshipsResult.error,
          mediaResult.error,
          trackProviderLinksResult.error,
          chartEntriesResult.error,
          chartProgramsResult.error,
        ].find(Boolean);

        if (firstError) throw firstError;

        const artists = (artistsResult.data ?? []) as AnyRow[];
        const tracks = (tracksResult.data ?? []) as AnyRow[];
        const releases = (releasesResult.data ?? []) as AnyRow[];
        const labels = (labelsResult.data ?? []) as AnyRow[];
        const genres = (genresResult.data ?? []) as AnyRow[];
        const aliases = (aliasesResult.data ?? []) as AnyRow[];
        const trackArtists = (trackArtistsResult.data ?? []) as AnyRow[];
        const releaseArtists = (releaseArtistsResult.data ?? []) as AnyRow[];
        const releaseTracks = (releaseTracksResult.data ?? []) as AnyRow[];
        const releaseTracklists = (releaseTracklistsResult.data ?? []) as AnyRow[];
        const entityRelationships = (entityRelationshipsResult.data ?? []) as AnyRow[];
        const mediaAssets = (mediaResult.data ?? []) as AnyRow[];
        const trackProviderLinks = (trackProviderLinksResult.data ?? []) as AnyRow[];
        const chartEntries = (chartEntriesResult.data ?? []) as AnyRow[];
        const chartPrograms = (chartProgramsResult.data ?? []) as AnyRow[];

        const artistsById = mapBy(artists, "id");
        const artistsBySlug = mapBy(artists, "slug");
        const tracksById = mapBy(tracks, "id");
        const releasesById = mapBy(releases, "id");
        const labelsById = mapBy(labels, "id");

        const aliasesByArtistId = groupBy(aliases.filter((row) => row.status === "active"), "canonical_artist_id");
        const trackArtistsByTrackId = groupBy(trackArtists.filter((row) => row.status === "active"), "track_id");
        const trackArtistsBySlug = groupBy(trackArtists.filter((row) => row.status === "active"), "artist_slug");
        const releaseArtistsByReleaseId = groupBy(releaseArtists.filter((row) => row.status === "active"), "release_id");
        const releaseArtistsBySlug = groupBy(releaseArtists.filter((row) => row.status === "active"), "artist_slug");
        const releaseTracksByReleaseId = groupBy(releaseTracks.filter((row) => row.status === "active"), "release_id");
        const providerLinksByTrackId = groupBy(trackProviderLinks, "track_id");
        const chartEntriesByArtistSlug = groupBy(chartEntries, "artist_slug");
        const chartEntriesByTrackSlug = groupBy(chartEntries, "track_slug");
        const releaseTracklistBySlug = mapBy(releaseTracklists, "release_slug");

        const labelReleaseCounts = new Map<string, number>();
        releases.forEach((release) => {
          const labelId = String(release.label_id || "");
          const label = labelId ? labelsById.get(labelId) : null;
          if (label?.slug) labelReleaseCounts.set(label.slug, (labelReleaseCounts.get(label.slug) ?? 0) + 1);

          const metaLabel = String(release.metadata?.record_label || release.metadata?.label || "").trim().toLowerCase();
          if (metaLabel) labelReleaseCounts.set(metaLabel, (labelReleaseCounts.get(metaLabel) ?? 0) + 1);
        });

        const artistRecords = artists.map((artist) => {
          const meta = (artist.metadata ?? {}) as AnyRow;
          const slug = String(artist.slug || "");
          const artistTrackRows = trackArtistsBySlug.get(slug) ?? [];
          const artistReleaseRows = releaseArtistsBySlug.get(slug) ?? [];
          const linkedTracks = artistTrackRows
            .map((row) => tracksById.get(String(row.track_id)))
            .filter(Boolean)
            .slice(0, 24)
            .map((track) => ({
              slug: track.slug,
              title: track.title,
              artworkUrl: track.artwork_url,
              status: track.status,
            }));

          const linkedReleases = artistReleaseRows
            .map((row) => releasesById.get(String(row.release_id)))
            .filter(Boolean)
            .slice(0, 24)
            .map((release) => ({
              slug: release.slug,
              title: release.title,
              releaseType: release.release_type,
              releaseDate: release.release_date,
              artworkUrl: release.artwork_url,
              status: release.status,
            }));

          const artistAliases = aliasesByArtistId.get(String(artist.id)) ?? [];
          const chartContext = chartEntriesByArtistSlug.get(slug) ?? [];
          const socials = socialLinksFrom(meta);
          const country = meta.country || artist.origin_iso2 || "";
          const genres = Array.isArray(meta.genres) ? meta.genres : Array.isArray(meta.enriched_genres) ? meta.enriched_genres : [];

          const missing = compact([
            artist.public_image_url ? "" : "image",
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
            richContext: {
              profile: {
                bio: artist.bio,
                artistType: artist.artist_type,
                gender: artist.gender,
                originIso2: artist.origin_iso2,
                country,
                genres,
              },
              trail: {
                socialLinks: socials,
                spotifyFollowers: meta.spotify_followers,
                spotifyPopularity: meta.spotify_popularity,
                spotifyArtistId: meta.spotify_artist_id || meta.spotify_id,
                appleMusicId: meta.apple_music_id,
                appleMusicAlbumIds: meta.apple_music_album_ids,
              },
              media: mediaSummary(mediaAssets, String(artist.id), slug),
              aliases: artistAliases.map((alias) => ({
                aliasSlug: alias.alias_slug,
                displayName: alias.alias_display_name,
                source: alias.source,
                confidence: alias.confidence,
                provider: alias.provider_type,
                providerId: alias.provider_id,
              })),
              discography: {
                linkedTrackCount: artistTrackRows.length,
                linkedReleaseCount: artistReleaseRows.length,
                linkedTracks,
                linkedReleases,
                topSongs: Array.isArray(meta.top_songs) ? meta.top_songs : [],
                youtubeVideos: Array.isArray(meta.youtube_videos) ? meta.youtube_videos : [],
              },
              charts: {
                chartEntryCount: chartContext.length,
                entries: chartContext.slice(0, 12),
              },
              relationships: relationSummary(entityRelationships, slug),
            },
          };

          return {
            id: `artist:${slug}`,
            entityType: "artist" as const,
            slug,
            label: artist.display_name || slug,
            subtitle: compact([artist.status !== "active" ? artist.status : "", country, genres.slice(0, 2).join(", ")]).join(" · ") || "Artist",
            href: hrefFor("artist", slug),
            imageUrl: artist.public_image_url || meta.portrait_image || null,
            contextText: artist.bio ? String(artist.bio).replace(/<[^>]*>/g, "") : compact([country, genres.slice(0, 3).join(", ")]).join(" · "),
            snapshot,
            health: healthFrom(missing, statusNote(artist.status)),
            searchText: searchBlob([artist.display_name, artist.normalized_name, slug, artist.bio, artist.status, meta, socials, linkedTracks, linkedReleases, chartContext, artistAliases]),
          };
        });

        const trackRecords = tracks.map((track) => {
          const slug = String(track.slug || "");
          const trackArtistRows = trackArtistsByTrackId.get(String(track.id)) ?? [];
          const artistsForTrack = trackArtistRows
            .sort((a, b) => Number(a.credit_order ?? 999) - Number(b.credit_order ?? 999))
            .map((row) => ({
              slug: row.artist_slug,
              name: row.artist_name_text,
              role: row.role,
              isPrimary: row.is_primary,
              isFeatured: row.is_featured,
              displayCredit: row.display_credit,
            }));
          const release = track.release_id ? releasesById.get(String(track.release_id)) : null;
          const providerLinks = providerLinksByTrackId.get(String(track.id)) ?? [];
          const chartContext = chartEntriesByTrackSlug.get(slug) ?? [];
          const primaryArtist = artistsForTrack.find((artist) => artist.isPrimary) ?? artistsForTrack[0] ?? null;

          const missing = compact([
            track.artwork_url ? "" : "artwork",
            artistsForTrack.length ? "" : "artist credits",
            release ? "" : "release",
            track.preview_url || providerLinks.some((link) => link.preview_url) ? "" : "preview/provider audio",
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
              artists: artistsForTrack,
              release: release
                ? {
                    slug: release.slug,
                    title: release.title,
                    releaseType: release.release_type,
                    releaseDate: release.release_date,
                    artworkUrl: release.artwork_url,
                    status: release.status,
                  }
                : null,
              providerLinks: providerLinks.map((link) => ({
                provider: link.provider_key,
                providerTrackId: link.provider_track_id,
                providerReleaseId: link.provider_release_id,
                isrc: link.isrc,
                upc: link.upc,
                previewUrl: link.preview_url,
                artworkUrl: link.artwork_url,
                storefront: link.storefront,
                matchStatus: link.match_status,
                confidence: link.match_confidence,
              })),
              charts: {
                chartEntryCount: chartContext.length,
                entries: chartContext.slice(0, 12),
              },
              relationships: relationSummary(entityRelationships, slug),
            },
          };

          return {
            id: `track:${slug}`,
            entityType: "track" as const,
            slug,
            label: track.title || slug,
            subtitle: compact([track.status !== "active" ? track.status : "", primaryArtist?.name, release?.title]).join(" · ") || "Track",
            href: hrefFor("track", slug),
            imageUrl: track.artwork_url || providerLinks.find((link) => link.artwork_url)?.artwork_url || release?.artwork_url || null,
            contextText: compact([primaryArtist?.name, release?.title, track.isrc]).join(" · "),
            snapshot,
            health: healthFrom(missing, statusNote(track.status)),
            searchText: searchBlob([track.title, track.normalized_title, slug, track.isrc, track.metadata, artistsForTrack, release, providerLinks, chartContext]),
          };
        });

        const releaseRecords = releases.map((release) => {
          const slug = String(release.slug || "");
          const releaseArtistRows = releaseArtistsByReleaseId.get(String(release.id)) ?? [];
          const releaseTrackRows = releaseTracksByReleaseId.get(String(release.id)) ?? [];
          const tracklistRow = releaseTracklistBySlug.get(slug);
          const label = release.label_id ? labelsById.get(String(release.label_id)) : null;
          const artistsForRelease = releaseArtistRows
            .sort((a, b) => Number(a.credit_order ?? 999) - Number(b.credit_order ?? 999))
            .map((row) => ({
              slug: row.artist_slug,
              name: row.artist_name_text,
              role: row.role,
              isPrimary: row.is_primary,
              isFeatured: row.is_featured,
              displayCredit: row.display_credit,
            }));
          const primaryArtist = artistsForRelease.find((artist) => artist.isPrimary) ?? artistsForRelease[0] ?? null;
          const tracklistPreview = releaseTrackRows
            .sort((a, b) => Number(a.track_number ?? 999) - Number(b.track_number ?? 999))
            .slice(0, 24)
            .map((row) => {
              const track = tracksById.get(String(row.track_id));
              return {
                trackNumber: row.track_number,
                discNumber: row.disc_number,
                slug: track?.slug,
                title: track?.title,
                artworkUrl: track?.artwork_url,
                status: track?.status,
              };
            });

          const missing = compact([
            release.artwork_url ? "" : "artwork",
            artistsForRelease.length ? "" : "artist credits",
            release.release_date ? "" : "release date",
            releaseTrackRows.length || tracklistRow ? "" : "tracklist",
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
              artists: artistsForRelease,
              label: label
                ? {
                    slug: label.slug,
                    name: label.name,
                    countryCode: label.country_code,
                    description: label.description,
                  }
                : null,
              tracklist: {
                source: tracklistRow ? "registry_release_tracklists" : "registry_release_tracks",
                trackCount: Number(tracklistRow?.track_count ?? releaseTrackRows.length ?? 0),
                tracks: Array.isArray(tracklistRow?.tracks) ? tracklistRow.tracks : tracklistPreview,
              },
              media: mediaSummary(mediaAssets, String(release.id), slug),
              relationships: relationSummary(entityRelationships, slug),
            },
          };

          return {
            id: `release:${slug}`,
            entityType: "release" as const,
            slug,
            label: release.title || slug,
            subtitle: compact([
              release.status !== "active" ? release.status : "",
              primaryArtist?.name,
              release.release_type,
              release.release_date,
              tracklistRow?.track_count ? `${tracklistRow.track_count} track(s)` : releaseTrackRows.length ? `${releaseTrackRows.length} track(s)` : "",
            ]).join(" · ") || "Release",
            href: hrefFor("release", slug),
            imageUrl: release.artwork_url || null,
            contextText: release.description || compact([primaryArtist?.name, release.release_type, release.release_date]).join(" · "),
            snapshot,
            health: healthFrom(missing, statusNote(release.status)),
            searchText: searchBlob([release.title, release.normalized_title, slug, release.description, release.metadata, artistsForRelease, label, tracklistRow, tracklistPreview]),
          };
        });

        const labelRecords = labels.map((label) => {
          const slug = String(label.slug || "");
          const labelNameKey = String(label.name || "").toLowerCase();
          const releaseCount = labelReleaseCounts.get(slug) ?? labelReleaseCounts.get(labelNameKey) ?? 0;
          const linkedReleases = releases
            .filter((release) => String(release.label_id || "") === String(label.id) || String(release.metadata?.record_label || "").toLowerCase() === labelNameKey)
            .slice(0, 24)
            .map((release) => ({
              slug: release.slug,
              title: release.title,
              releaseType: release.release_type,
              releaseDate: release.release_date,
              artworkUrl: release.artwork_url,
              status: release.status,
            }));

          const missing = compact([
            label.description ? "" : "description",
            label.country_code ? "" : "country",
            releaseCount ? "" : "linked releases",
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
            richContext: {
              releases: {
                linkedReleaseCount: releaseCount,
                linkedReleases,
              },
              media: mediaSummary(mediaAssets, String(label.id), slug),
              relationships: relationSummary(entityRelationships, slug),
            },
          };

          return {
            id: `label:${slug}`,
            entityType: "label" as const,
            slug,
            label: label.name || slug,
            subtitle: compact([label.status !== "active" ? label.status : "", label.country_code, releaseCount ? `${releaseCount} release(s)` : ""]).join(" · ") || "Label",
            href: hrefFor("label", slug),
            imageUrl: null,
            contextText: label.description || compact([label.country_code, `${releaseCount} release(s)`]).join(" · "),
            snapshot,
            health: healthFrom(missing, statusNote(label.status)),
            searchText: searchBlob([label.name, label.normalized_name, slug, label.description, label.country_code, label.metadata, linkedReleases]),
          };
        });

        const genreRecords = genres.map((genre) => {
          const slug = String(genre.slug || "");
          const relationships = relationSummary(entityRelationships, slug);
          const representativeArtists = relationships
            .filter((item) => item.sourceType === "artist" || item.targetType === "artist")
            .map((item) => {
              const artistSlug = item.sourceType === "artist" ? item.source : item.target;
              return artistsBySlug.get(String(artistSlug))?.display_name || artistSlug;
            })
            .filter(Boolean)
            .slice(0, 12);

          const missing = compact([
            genre.description ? "" : "description",
            representativeArtists.length ? "" : "representative artists/relationships",
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
            richContext: {
              representativeArtists,
              relationships,
            },
          };

          return {
            id: `genre:${slug}`,
            entityType: "genre" as const,
            slug,
            label: genre.name || slug,
            subtitle: compact([genre.status !== "active" ? genre.status : "", representativeArtists.length ? `Includes ${representativeArtists.slice(0, 2).join(", ")}` : ""]).join(" · ") || "Genre",
            href: hrefFor("genre", slug),
            imageUrl: null,
            contextText: genre.description || representativeArtists.join(", "),
            snapshot,
            health: healthFrom(missing, statusNote(genre.status)),
            searchText: searchBlob([genre.name, slug, genre.description, genre.metadata, representativeArtists, relationships]),
          };
        });

        const chartFamilyRecords = (chartPayload.data.families ?? []).map(chartFamilyRecord).filter(Boolean) as WakilishaRecordSearchResult[];

        const chartProgramRecords = chartPrograms.map((program) => {
          const slug = String(program.public_slug || program.id || "");
          const entries = chartEntries.filter((entry) => String(entry.edition_id || "").startsWith(String(program.id || ""))).slice(0, 12);

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
              entries,
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
            searchText: searchBlob([program, entries]),
          };
        });

        const nextRecords = [
          ...artistRecords,
          ...trackRecords,
          ...releaseRecords,
          ...labelRecords,
          ...genreRecords,
          ...articles.map(articleRecord),
          ...authors.map(authorRecord),
          ...chartFamilyRecords,
          ...chartProgramRecords,
        ];

        if (alive) setAllRecords(nextRecords);
      } catch (loadError) {
        if (!alive) return;
        setAllRecords([]);
        setError(loadError instanceof Error ? loadError.message : "Failed to load rich WAKILISHA records.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadRecords();

    return () => {
      alive = false;
    };
  }, []);

  const records = useMemo(() => {
    return allRecords
      .filter((record) => entityType === "all" || record.entityType === entityType)
      .filter((record) => resultMatches(record, query))
      .slice(0, 80);
  }, [allRecords, entityType, query]);

  return {
    records,
    loading,
    error,
    totalRecords: allRecords.length,
  };
}

export async function fetchWakilishaRecordDetail(record: WakilishaRecordSearchResult): Promise<WakilishaRecordDetail> {
  if (record.entityType !== "release") return {};

  const { data: tracklistRow } = await supabase
    .from("registry_release_tracklists")
    .select("release_slug, release_title, track_count, tracks")
    .eq("release_slug", record.slug)
    .maybeSingle();

  if (tracklistRow?.tracks && Array.isArray(tracklistRow.tracks)) {
    return {
      tracklist: tracklistRow.tracks.map((track: AnyRow, index: number) => ({
        trackNumber: Number(track.trackNumber ?? track.track_number ?? index + 1),
        slug: String(track.slug ?? track.trackSlug ?? ""),
        title: String(track.title ?? track.trackTitle ?? "Untitled track"),
        artists: Array.isArray(track.artists) ? track.artists.map(String) : compact([track.artist, track.artistName]),
        artworkUrl: track.artworkUrl ?? track.artwork_url ?? null,
        previewUrl: track.previewUrl ?? track.preview_url ?? null,
      })),
    };
  }

  const { data: releaseRow, error: releaseError } = await supabase
    .from("registry_releases")
    .select("id, slug, title")
    .eq("slug", record.slug)
    .maybeSingle();

  if (releaseError || !releaseRow?.id) return {};

  const releaseId = String(releaseRow.id);

  const { data: releaseTracks, error: releaseTracksError } = await supabase
    .from("registry_release_tracks")
    .select("track_id, track_number")
    .eq("release_id", releaseId)
    .eq("status", "active")
    .order("track_number", { ascending: true });

  if (releaseTracksError || !releaseTracks?.length) return {};

  const trackIds = releaseTracks.map((row) => String(row.track_id)).filter(Boolean);
  if (!trackIds.length) return {};

  const [{ data: trackRows }, { data: artistRows }] = await Promise.all([
    supabase.from("registry_tracks").select("id, slug, title, artwork_url, preview_url").in("id", trackIds),
    supabase.from("registry_track_artists").select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order").in("track_id", trackIds).eq("status", "active"),
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

  return {
    tracklist: releaseTracks
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
      .filter(Boolean) as WakilishaRecordDetail["tracklist"],
  };
}
