import { supabase } from "@/lib/supabase";
import { withPlaceholderImage } from "@/utils/imagePlaceholders";
import { rewriteWpImageUrl } from "@/services/wpImageRewrite";

export type RepairedStory = {
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
};

export type RepairedArtist = {
  id: string;
  slug: string;
  name: string;
  country?: string | null;
  imageUrl?: string | null;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  isChartArtist: boolean;
  isRising?: boolean;
  topChartPosition?: number | null;
};

export type RepairedRelease = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  year: string;
  releaseType: string;
  labelName: string;
  artworkUrl: string;
  trackCount: number;
  description?: string;
};

export type RepairedGenre = {
  id: string;
  slug: string;
  name: string;
  artistCount: number;
  trackCount: number;
  representativeArtists: string[];
};

export type RepairedLabel = {
  id: string;
  slug: string;
  name: string;
  country?: string | null;
  logoUrl?: string | null;
  artistCount: number;
  releaseCount: number;
  featuredArtists: string[];
  isFeatured: boolean;
  description?: string | null;
};

export type RepairedReleaseDetail = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  year: string;
  releaseDate: string;
  releaseType: string;
  labelName: string;
  labelSlug: string;
  artworkUrl: string;
  trackCount: number;
  totalDuration: number;
  tracks: Array<{
    id: string;
    slug: string;
    title: string;
    artist: string;
    duration: number;
    trackNumber: number;
    artworkUrl: string;
  }>;
  description?: string;
  metadata: Record<string, unknown>;
};

export type RepairedArticleDetail = {
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
  contentHtml: string;
  tags: string[];
  seo?: Record<string, unknown>;
  categories: string[];
};

export type RepairedArtistVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  platform: string;
};

export type RepairedArtistDetail = {
  id: string;
  slug: string;
  name: string;
  country: string;
  imageUrl: string;
  profileImageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  isChartArtist: boolean;
  isRising: boolean;
  topChartPosition: number | null;
  bio: string;
  fullBio: string;
  artistType: string | null;
  followerCount: number;
  popularity: number;
  spotifyUrl: string;
  instagram: string;
  chartEntries: Array<{
    rank: number;
    title: string;
    artist: string;
    slug: string;
    movement: "up" | "down" | "new" | "same";
    movementAmount: number;
    peakPosition: number;
    weeksOnChart: number;
    artworkUrl: string;
  }>;
  releases: Array<{
    slug: string;
    title: string;
    releaseType: string;
    year: string;
    releaseDate: string;
    trackCount: number;
    artworkUrl: string;
    tracks: Array<{ title: string; duration: string }>;
  }>;
  topSongs: Array<{
    title: string;
    artists: string;
    image: string;
    duration: string;
    songUrl: string;
  }>;
  relatedArtists: Array<{
    slug: string;
    name: string;
    imageUrl: string;
    score?: number;
    sharedTracksAll?: number;
    sharedChartTracks?: number;
    featuresThem?: number;
    theyFeature?: number;
    sharedTitles?: string[];
  }>;
  videos?: RepairedArtistVideo[];
};

type Row = Record<string, unknown>;

type MediaIdentity = {
  id?: string;
  slug: string;
  name: string;
  type: "article" | "artist" | "track" | "release" | "label" | "genre";
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pick(row: Row | null | undefined, keys: string[], fallback = ""): string {
  if (!row) return fallback;
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return fallback;
}

function pickNumber(row: Row | null | undefined, keys: string[], fallback = 0): number {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return asNumber(value, fallback);
  }
  return fallback;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function releaseUrl(release: { slug: string; artist: string }): string {
  return `/releases/${slugify(release.artist)}/${release.slug}`;
}

function yearFrom(value: string): string {
  return value ? value.slice(0, 4) : "";
}

function placeholder(url: string | null | undefined, identity: MediaIdentity): string {
  return withPlaceholderImage(rewriteWpImageUrl(url || "") || url || "", identity);
}

async function safeQuery<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Supabase content query failed.");
    return fallback;
  }
}

async function firstMediaUrl(entityType: string, entitySlug: string): Promise<string> {
  return safeQuery(async () => {
    const { data: relationship } = await supabase
      .from("registry_entity_relationships")
      .select("target_slug, relationship_role")
      .eq("source_entity_type", entityType)
      .eq("source_slug", entitySlug)
      .eq("target_entity_type", "media_assets")
      .eq("relationship_status", "active")
      .order("relationship_role", { ascending: true })
      .limit(1)
      .maybeSingle();

    const mediaSlug = pick(relationship as Row | null, ["target_slug"]);
    if (!mediaSlug) return "";

    const { data: media } = await supabase
      .from("registry_media_assets")
      .select("url")
      .eq("slug", mediaSlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    return pick(media as Row | null, ["url"]);
  }, "");
}

async function mediaMapFor(entityType: string, slugs: string[]): Promise<Map<string, string>> {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (uniqueSlugs.length === 0) return new Map();

  return safeQuery(async () => {
    const { data: relationships } = await supabase
      .from("registry_entity_relationships")
      .select("source_slug, target_slug")
      .eq("source_entity_type", entityType)
      .in("source_slug", uniqueSlugs)
      .eq("target_entity_type", "media_assets")
      .eq("relationship_status", "active");

    const mediaSlugs = Array.from(new Set(((relationships || []) as Row[]).map((row) => pick(row, ["target_slug"])).filter(Boolean)));
    if (mediaSlugs.length === 0) return new Map<string, string>();

    const { data: mediaRows } = await supabase
      .from("registry_media_assets")
      .select("slug, url")
      .in("slug", mediaSlugs)
      .eq("status", "active");

    const urls = new Map(((mediaRows || []) as Row[]).map((row) => [pick(row, ["slug"]), pick(row, ["url"])]));
    const map = new Map<string, string>();
    for (const rel of (relationships || []) as Row[]) {
      const sourceSlug = pick(rel, ["source_slug"]);
      const targetSlug = pick(rel, ["target_slug"]);
      const url = urls.get(targetSlug);
      if (sourceSlug && url && !map.has(sourceSlug)) map.set(sourceSlug, url);
    }
    return map;
  }, new Map<string, string>());
}

async function metadataMap(entityType: string, entitySlug: string): Promise<Map<string, Row>> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("registry_entity_metadata")
      .select("meta_key, meta_value, meta_value_json, meta_group")
      .eq("entity_type", entityType)
      .eq("entity_slug", entitySlug)
      .eq("status", "active");
    return new Map(((data || []) as Row[]).map((row) => [pick(row, ["meta_key"]), row]));
  }, new Map<string, Row>());
}

function metaString(meta: Map<string, Row>, key: string): string {
  return pick(meta.get(key), ["meta_value"]);
}

function metaNumber(meta: Map<string, Row>, key: string): number {
  const row = meta.get(key);
  const json = row?.meta_value_json as Row | undefined;
  return pickNumber(json, ["numeric_value"], pickNumber(row, ["meta_value"], 0));
}

function toArtist(row: Row, mediaUrl = ""): RepairedArtist {
  const slug = pick(row, ["slug", "target_slug"], pick(row, ["id"]));
  const name = pick(row, ["name", "title", "display_name"], slug.replaceAll("-", " "));
  return {
    id: pick(row, ["id"], slug),
    slug,
    name,
    country: pick(row, ["country", "origin_country", "country_name"], null as unknown as string),
    imageUrl: placeholder(mediaUrl || pick(row, ["image_url", "avatar_url", "photo_url"]), { id: pick(row, ["id"], slug), slug, name, type: "artist" }),
    genres: [],
    trackCount: pickNumber(row, ["track_count"], 0),
    releaseCount: pickNumber(row, ["release_count"], 0),
    isChartArtist: true,
    isRising: false,
    topChartPosition: null,
  };
}

function toRelease(row: Row, mediaUrl = ""): RepairedRelease {
  const slug = pick(row, ["slug"], pick(row, ["id"]));
  const title = pick(row, ["title", "name"], slug.replaceAll("-", " "));
  const releaseDate = pick(row, ["release_date", "date", "published_at"]);
  return {
    id: pick(row, ["id"], slug),
    slug,
    title,
    artist: pick(row, ["artist", "artist_name"], "WAKILISHA Registry"),
    year: yearFrom(releaseDate),
    releaseType: pick(row, ["release_type", "type"], "release"),
    labelName: pick(row, ["label_name", "label"], ""),
    artworkUrl: placeholder(mediaUrl || pick(row, ["artwork_url", "image_url", "cover_url"]), { id: pick(row, ["id"], slug), slug, name: title, type: "release" }),
    trackCount: pickNumber(row, ["track_count"], 0),
    description: pick(row, ["description", "summary", "content"], ""),
  };
}

export async function listMagazineStories(): Promise<RepairedStory[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("wk_articles")
      .select("*")
      .eq("wp_status", "publish")
      .limit(500);
    if (error) throw new Error(error.message);

    const articles = (data || []) as Row[];
    const media = await mediaMapFor("articles", articles.map((row) => pick(row, ["slug", "post_name", "source_slug"])));
    return articles.map((row) => {
      const slug = pick(row, ["slug", "post_name", "source_slug"], pick(row, ["id"]));
      const title = pick(row, ["title", "post_title"], slug.replaceAll("-", " "));
      const image = media.get(slug) || pick(row, ["hero_url", "image_url", "featured_image_url"]);
      return {
        id: pick(row, ["id"], slug),
        slug,
        title,
        section: pick(row, ["section", "category"], "Magazine"),
        dek: pick(row, ["dek", "excerpt", "post_excerpt"], ""),
        author: pick(row, ["author", "author_name"], "WAKILISHA"),
        date: pick(row, ["published_at", "post_date", "created_at"], ""),
        readingTime: pickNumber(row, ["reading_time"], 4),
        heroUrl: placeholder(image, { id: pick(row, ["id"], slug), slug, name: title, type: "article" }),
      };
    });
  }, []);
}

export async function listArtists(): Promise<RepairedArtist[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("registry_artists")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    const artists = (data || []) as Row[];
    const media = await mediaMapFor("artists", artists.map((row) => pick(row, ["slug"])));
    return artists.map((row) => toArtist(row, media.get(pick(row, ["slug"]))));
  }, []);
}

export async function listReleases(): Promise<RepairedRelease[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("registry_releases")
      .select("*")
      .eq("status", "active")
      .limit(500);
    if (error) throw new Error(error.message);

    const releases = (data || []) as Row[];
    const media = await mediaMapFor("releases", releases.map((row) => pick(row, ["slug"])));
    return releases.map((row) => toRelease(row, media.get(pick(row, ["slug"]))));
  }, []);
}

export async function getRelease(_artistSlug: string, releaseSlug: string): Promise<RepairedReleaseDetail | null> {
  return safeQuery(async () => {
    const { data: releaseRow, error } = await supabase
      .from("registry_releases")
      .select("*")
      .eq("slug", releaseSlug)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!releaseRow) return null;

    const release = toRelease(releaseRow as Row, await firstMediaUrl("releases", releaseSlug));

    const { data: rels } = await supabase
      .from("registry_entity_relationships")
      .select("source_slug, sort_order")
      .eq("target_entity_type", "releases")
      .eq("target_slug", releaseSlug)
      .eq("source_entity_type", "tracks")
      .eq("relationship_type", "track_release")
      .eq("relationship_status", "active")
      .order("sort_order", { ascending: true });

    const trackSlugs = ((rels || []) as Row[]).map((row) => pick(row, ["source_slug"])).filter(Boolean);
    const { data: trackRows } = trackSlugs.length
      ? await supabase.from("registry_tracks").select("*").in("slug", trackSlugs)
      : { data: [] as Row[] };
    const trackMedia = await mediaMapFor("tracks", trackSlugs);
    const tracksBySlug = new Map(((trackRows || []) as Row[]).map((row) => [pick(row, ["slug"]), row]));

    const tracks = trackSlugs.map((slug, index) => {
      const row = tracksBySlug.get(slug) || { slug, title: slug.replaceAll("-", " ") };
      const title = pick(row, ["title", "name"], slug.replaceAll("-", " "));
      return {
        id: pick(row, ["id"], slug),
        slug,
        title,
        artist: pick(row, ["artist", "artist_name"], release.artist),
        duration: pickNumber(row, ["duration"], 0),
        trackNumber: index + 1,
        artworkUrl: placeholder(trackMedia.get(slug), { slug, name: title, type: "track" }),
      };
    });

    return {
      ...release,
      releaseDate: pick(releaseRow as Row, ["release_date", "date", "published_at"], ""),
      labelSlug: slugify(release.labelName),
      trackCount: tracks.length || release.trackCount,
      totalDuration: tracks.reduce((sum, track) => sum + track.duration, 0),
      tracks,
      metadata: releaseRow as Row,
    };
  }, null);
}

export async function getArticle(slug: string): Promise<RepairedArticleDetail | null> {
  return safeQuery(async () => {
    const { data: row, error } = await supabase
      .from("wk_articles")
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const title = pick(row as Row, ["title", "post_title"], slug.replaceAll("-", " "));
    const mediaUrl = await firstMediaUrl("articles", slug);
    return {
      id: pick(row as Row, ["id"], slug),
      slug,
      title,
      section: pick(row as Row, ["section", "category"], "Magazine"),
      dek: pick(row as Row, ["dek", "excerpt", "post_excerpt"], ""),
      author: pick(row as Row, ["author", "author_name"], "WAKILISHA"),
      date: pick(row as Row, ["published_at", "post_date", "created_at"], ""),
      readingTime: pickNumber(row as Row, ["reading_time"], 4),
      heroUrl: placeholder(mediaUrl || pick(row as Row, ["hero_url", "image_url", "featured_image_url"]), { id: pick(row as Row, ["id"], slug), slug, name: title, type: "article" }),
      contentHtml: pick(row as Row, ["content_html", "post_content", "content", "body"], ""),
      tags: [],
      seo: {},
      categories: [],
    };
  }, null);
}

export async function listGenres(): Promise<RepairedGenre[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase.from("registry_genres").select("*").eq("status", "active").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    return ((data || []) as Row[]).map((row) => ({
      id: pick(row, ["id"], pick(row, ["slug"])),
      slug: pick(row, ["slug"], pick(row, ["id"])),
      name: pick(row, ["name", "title"], pick(row, ["slug"]).replaceAll("-", " ")),
      artistCount: pickNumber(row, ["artist_count"], 0),
      trackCount: pickNumber(row, ["track_count"], 0),
      representativeArtists: [],
    }));
  }, []);
}

export async function getArtist(slug: string): Promise<RepairedArtistDetail | null> {
  return safeQuery(async () => {
    const { data: artistRow, error } = await supabase
      .from("registry_artists")
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!artistRow) return null;

    const artist = toArtist(artistRow as Row, await firstMediaUrl("artists", slug));
    const meta = await metadataMap("artists", slug);
    const bio = pick(artistRow as Row, ["bio", "excerpt", "description", "summary"], metaString(meta, "_wk_artist_tagline"));
    const fullBio = pick(artistRow as Row, ["full_bio", "content", "body", "long_description"], pick(artistRow as Row, ["description"], bio));
    const country = metaString(meta, "_wk_artist_country") || pick(artistRow as Row, ["country", "origin_country"], "");

    const { data: artistTrackRels } = await supabase
      .from("registry_entity_relationships")
      .select("target_slug, relationship_role")
      .eq("source_entity_type", "artists")
      .eq("source_slug", slug)
      .eq("target_entity_type", "tracks")
      .eq("relationship_type", "artist_track")
      .eq("relationship_status", "active")
      .limit(300);
    const trackSlugs = Array.from(new Set(((artistTrackRels || []) as Row[]).map((row) => pick(row, ["target_slug"])).filter(Boolean)));
    const { data: trackRows } = trackSlugs.length ? await supabase.from("registry_tracks").select("*").in("slug", trackSlugs).limit(300) : { data: [] as Row[] };
    const trackMedia = await mediaMapFor("tracks", trackSlugs);
    const tracksBySlug = new Map(((trackRows || []) as Row[]).map((row) => [pick(row, ["slug"]), row]));

    const { data: releaseRels } = trackSlugs.length
      ? await supabase
          .from("registry_entity_relationships")
          .select("source_slug, target_slug, sort_order")
          .eq("source_entity_type", "tracks")
          .in("source_slug", trackSlugs)
          .eq("target_entity_type", "releases")
          .eq("relationship_type", "track_release")
          .eq("relationship_status", "active")
      : { data: [] as Row[] };

    const releaseSlugs = Array.from(new Set(((releaseRels || []) as Row[]).map((row) => pick(row, ["target_slug"])).filter(Boolean)));
    const { data: releaseRows } = releaseSlugs.length ? await supabase.from("registry_releases").select("*").in("slug", releaseSlugs).limit(200) : { data: [] as Row[] };
    const releaseMedia = await mediaMapFor("releases", releaseSlugs);
    const releaseTrackMap = new Map<string, Array<{ title: string; duration: string }>>();
    for (const rel of (releaseRels || []) as Row[]) {
      const releaseSlug = pick(rel, ["target_slug"]);
      const trackSlug = pick(rel, ["source_slug"]);
      const track = tracksBySlug.get(trackSlug);
      if (!releaseSlug || !track) continue;
      const list = releaseTrackMap.get(releaseSlug) || [];
      list.push({ title: pick(track, ["title", "name"], trackSlug.replaceAll("-", " ")), duration: "" });
      releaseTrackMap.set(releaseSlug, list);
    }

    const releases = ((releaseRows || []) as Row[]).map((row) => {
      const releaseSlug = pick(row, ["slug"]);
      const title = pick(row, ["title", "name"], releaseSlug.replaceAll("-", " "));
      const releaseDate = pick(row, ["release_date", "date", "published_at"], "");
      const tracks = releaseTrackMap.get(releaseSlug) || [];
      return {
        slug: releaseSlug,
        title,
        releaseType: pick(row, ["release_type", "type"], "release"),
        year: yearFrom(releaseDate),
        releaseDate,
        trackCount: tracks.length || pickNumber(row, ["track_count"], 0),
        artworkUrl: placeholder(releaseMedia.get(releaseSlug), { id: pick(row, ["id"], releaseSlug), slug: releaseSlug, name: title, type: "release" }),
        tracks,
      };
    });

    const { data: highlights } = await supabase
      .from("registry_artist_highlights")
      .select("*")
      .eq("artist_slug", slug)
      .eq("status", "active")
      .order("position", { ascending: true })
      .limit(100);

    const topSongs = ((highlights || []) as Row[])
      .filter((row) => pick(row, ["highlight_type"]).includes("song") || pick(row, ["source_kind"]).includes("top_songs"))
      .map((row) => ({
        title: pick(row, ["title"], "Untitled track"),
        artists: pick(row, ["subtitle"], artist.name),
        image: placeholder(pick(row, ["artwork_url"]), { slug: pick(row, ["canonical_entity_slug"], pick(row, ["title"])), name: pick(row, ["title"]), type: "track" }),
        duration: pick(row, ["duration"], ""),
        songUrl: pick(row, ["external_url"], `/tracks/${pick(row, ["canonical_entity_slug"], slugify(pick(row, ["title"])))}`),
      }));

    const discographyHighlights = ((highlights || []) as Row[]).filter((row) => ["studio_album", "ep_or_compilation"].includes(pick(row, ["highlight_type"])));
    for (const row of discographyHighlights) {
      const releaseSlug = slugify(pick(row, ["title"]));
      if (releases.some((release) => release.slug === releaseSlug || release.title === pick(row, ["title"]))) continue;
      const title = pick(row, ["title"]);
      releases.push({
        slug: releaseSlug,
        title,
        releaseType: pick(row, ["highlight_type"], "release"),
        year: yearFrom(pick(row, ["subtitle"], "")),
        releaseDate: pick(row, ["subtitle"], ""),
        trackCount: 0,
        artworkUrl: placeholder(pick(row, ["artwork_url"]), { slug: releaseSlug, name: title, type: "release" }),
        tracks: [],
      });
    }

    const { data: chartRows } = trackSlugs.length
      ? await supabase.from("chart_entries").select("*").in("track_slug", trackSlugs).order("rank", { ascending: true }).limit(50)
      : { data: [] as Row[] };

    const chartEntries = ((chartRows || []) as Row[]).map((row) => {
      const trackSlug = pick(row, ["track_slug"], slugify(pick(row, ["track_title", "title"])));
      const title = pick(row, ["track_title", "title"], trackSlug.replaceAll("-", " "));
      return {
        rank: pickNumber(row, ["rank"], 0),
        title,
        artist: pick(row, ["artist_name"], artist.name),
        slug: trackSlug,
        movement: "same" as const,
        movementAmount: 0,
        peakPosition: pickNumber(row, ["rank"], 0),
        weeksOnChart: 1,
        artworkUrl: placeholder(pick(row, ["artwork_url"]) || trackMedia.get(trackSlug), { slug: trackSlug, name: title, type: "track" }),
      };
    });

    return {
      ...artist,
      country,
      imageUrl: artist.imageUrl,
      profileImageUrl: artist.imageUrl,
      genres: [],
      trackCount: trackSlugs.length || artist.trackCount,
      releaseCount: releases.length || artist.releaseCount,
      isChartArtist: chartEntries.length > 0,
      isRising: topSongs.length > 0 || chartEntries.some((entry) => entry.rank <= 10),
      topChartPosition: chartEntries.length ? Math.min(...chartEntries.map((entry) => entry.rank).filter(Boolean)) : null,
      bio,
      fullBio,
      artistType: metaString(meta, "_wk_artist_gender") || null,
      followerCount: metaNumber(meta, "_wk_artist_followers"),
      popularity: metaNumber(meta, "_wk_artist_popularity"),
      spotifyUrl: metaString(meta, "_wk_artist_spotify") || metaString(meta, "_wk_artist_spotify_artist_id"),
      instagram: metaString(meta, "_wk_artist_instagram"),
      chartEntries,
      releases,
      topSongs,
      relatedArtists: [],
      videos: [],
    };
  }, null);
}

export async function listLabels(): Promise<RepairedLabel[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase.from("registry_labels").select("*").eq("status", "active").order("name", { ascending: true }).limit(500);
    if (error) throw new Error(error.message);
    const labels = (data || []) as Row[];
    const media = await mediaMapFor("labels", labels.map((row) => pick(row, ["slug"])));
    return labels.map((row) => {
      const slug = pick(row, ["slug"], pick(row, ["id"]));
      const name = pick(row, ["name", "title"], slug.replaceAll("-", " "));
      return {
        id: pick(row, ["id"], slug),
        slug,
        name,
        country: pick(row, ["country", "country_name"], null as unknown as string),
        logoUrl: placeholder(media.get(slug) || pick(row, ["logo_url", "image_url"]), { id: pick(row, ["id"], slug), slug, name, type: "label" }),
        artistCount: pickNumber(row, ["artist_count"], 0),
        releaseCount: pickNumber(row, ["release_count"], 0),
        featuredArtists: [],
        isFeatured: false,
        description: pick(row, ["description", "summary"], ""),
      };
    });
  }, []);
}
