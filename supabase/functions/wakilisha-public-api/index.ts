import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveSeriesLabels(
  supabase: ReturnType<typeof createClient>,
  seriesSlugs: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(seriesSlugs.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data: rows } = await supabase
    .from("chart_series")
    .select("slug, label")
    .in("slug", unique)
    .eq("status", "active");
  const map = new Map<string, string>();
  for (const row of (rows ?? [])) {
    map.set(String(row.slug), String(row.label || row.slug));
  }
  return map;
}

async function resolveMarketLabels(
  supabase: ReturnType<typeof createClient>,
  marketSlugs: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(marketSlugs.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data: rows } = await supabase
    .from("chart_markets")
    .select("slug, label")
    .in("slug", unique)
    .eq("status", "active");
  const map = new Map<string, string>();
  for (const row of (rows ?? [])) {
    map.set(String(row.slug), String(row.label || row.slug));
  }
  return map;
}

// ─── Editorial Excerpt Generator ──────────────────────────────────────

function formatDateNicely(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDurationApprox(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `approximately ${m} minutes`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `approximately ${h} hour${h > 1 ? "s" : ""}`;
  return `approximately ${h} hour${h > 1 ? "s" : ""} and ${rm} minutes`;
}

function pickOpeners(): string[] {
  return [
    "marks a significant moment",
    "represents an important chapter",
    "stands as a notable release",
    "showcases the artist's evolving sound",
    "delivers a compelling body of work",
    "captures the artist at a pivotal point",
    "offers a rich listening experience",
    "brings together a carefully curated set of tracks",
  ];
}

function pickClosers(): string[] {
  return [
    "adding to the artist's growing catalog.",
    "cementing their place in the contemporary landscape.",
    "reflecting the creative momentum of the period.",
    "contributing to the broader cultural conversation.",
    "demonstrating the breadth of their artistic vision.",
    "offering listeners a definitive statement of intent.",
    "positioning the artist within their genre's evolution.",
  ];
}

function releaseTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "album" || t === "studio album") return "studio album";
  if (t === "ep" || t === "extended play") return "extended play";
  if (t === "single") return "single";
  if (t === "compilation" || t === "mixtape") return t;
  return t;
}

function getNotableTracks(tracks: Array<Record<string, unknown>>, count: number): string[] {
  const sorted = [...tracks].filter((t) => t.title && String(t.title).trim()).sort((a, b) => {
    const an = Number(a.trackNumber || a.track_number || 0);
    const bn = Number(b.trackNumber || b.track_number || 0);
    return an - bn;
  });
  if (sorted.length <= 2) return sorted.slice(1).map((t) => String(t.title));
  const middle = sorted.slice(1, -1);
  const picked: string[] = [];
  const step = Math.max(1, Math.floor(middle.length / count));
  for (let i = 0; i < middle.length && picked.length < count; i += step) {
    picked.push(String(middle[i].title));
  }
  return picked;
}

function articleize(word: string): string {
  const first = word.charAt(0).toLowerCase();
  if ("aeiou".includes(first)) return `an ${word}`;
  return `a ${word}`;
}

function generateReleaseExcerpt(opts: {
  title: string;
  artist: string;
  releaseDate: string;
  releaseType: string;
  labelName: string;
  trackCount: number;
  tracks: Array<Record<string, unknown>>;
  totalDuration: number;
}): string {
  const { title, artist, releaseDate, releaseType, labelName, trackCount, tracks, totalDuration } = opts;
  const rType = releaseTypeLabel(releaseType);
  const niceDate = formatDateNicely(releaseDate);
  const yearOnly = releaseDate ? String(releaseDate).split("-")[0] : "";

  const parts: string[] = [];

  // Opening sentence
  let open = `${title} is ${articleize(rType)} by ${artist}`;
  if (niceDate && niceDate !== yearOnly) {
    open += `, released on ${niceDate}`;
  } else if (yearOnly) {
    open += `, released in ${yearOnly}`;
  }
  if (labelName && labelName !== "Independent" && labelName !== "Unknown") {
    open += ` through ${labelName}`;
  }
  open += ".";
  parts.push(open);

  // Track details
  if (trackCount > 0 && tracks.length > 0) {
    const sorted = [...tracks].filter((t) => t.title && String(t.title).trim()).sort((a, b) => {
      const an = Number(a.trackNumber || a.track_number || 0);
      const bn = Number(b.trackNumber || b.track_number || 0);
      return an - bn;
    });

    const firstTrack = sorted[0]?.title ? String(sorted[0].title) : "";
    const lastTrack = sorted.length > 1 && sorted[sorted.length - 1]?.title
      ? String(sorted[sorted.length - 1].title)
      : "";

    let trackSentence = "";
    if (trackCount === 1 && firstTrack) {
      trackSentence = `The release consists of a single track, "${firstTrack}."`;
    } else if (trackCount === 2 && firstTrack && lastTrack) {
      trackSentence = `The release spans ${trackCount} tracks, opening with "${firstTrack}" and closing with "${lastTrack}."`;
    } else if (trackCount > 2) {
      const middle = getNotableTracks(sorted, 2);
      if (firstTrack) {
        trackSentence = `The ${trackCount}-track project opens with "${firstTrack}"`;
        if (middle.length === 1) {
          trackSentence += ` and includes "${middle[0]}" among its standout cuts`;
        } else if (middle.length === 2) {
          trackSentence += `, with notable inclusions like "${middle[0]}" and "${middle[1]}"`;
        }
        if (lastTrack) {
          trackSentence += `, concluding with "${lastTrack}"`;
        }
        trackSentence += ".";
      } else {
        trackSentence = `The release features ${trackCount} tracks.`;
      }
    }
    if (trackSentence) parts.push(trackSentence);

    // Duration
    if (totalDuration > 0) {
      const dur = formatDurationApprox(totalDuration);
      const durSentence = `With a total runtime of ${dur}, the project delivers ${trackCount > 5 ? "a substantial listening experience" : "a concise but complete statement"}.`;
      parts.push(durSentence);
    }
  } else if (trackCount > 0) {
    parts.push(`The release features ${trackCount} tracks.`);
    if (totalDuration > 0) {
      parts.push(`With a total runtime of ${formatDurationApprox(totalDuration)}, it offers a complete listening experience.`);
    }
  }

  // Context / significance sentence
  const opener = pickOpeners()[Math.floor(Math.random() * pickOpeners().length)];
  const closer = pickClosers()[Math.floor(Math.random() * pickClosers().length)];
  parts.push(`${title} ${opener} in ${artist}'s discography, ${closer}`);

  return parts.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/wakilisha-public-api/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let data: unknown;

    if (path === "/repaired/magazine" || path === "/repaired/magazine/") {
      const { data: articles } = await supabase
        .from("wk_articles")
        .select("id, slug, title, excerpt, author, published_at, content_html, categories")
        .eq("wp_status", "publish")
        .order("published_at", { ascending: false })
        .limit(50);

      data = {
        stories: (articles ?? []).map((a: Record<string, unknown>) => {
          const cats = Array.isArray(a.categories) ? a.categories as Array<Record<string, unknown>> : [];
          const section = cats.length > 0 ? String(cats[0].name || "Music") : "Music";
          const contentText = String(a.content_html || "").replace(/<[^>]+>/g, "");
          const dek = a.excerpt ? String(a.excerpt) : (contentText ? contentText.substring(0, 140) + "..." : "");
          return {
            id: String(a.id),
            slug: String(a.slug),
            title: String(a.title),
            section,
            dek,
            author: String(a.author || "Wakilisha"),
            date: a.published_at ? String(a.published_at).split("T")[0] : "",
            readingTime: Math.max(1, Math.ceil(contentText.length / 1500)),
            heroUrl: "",
          };
        }),
      };
    }

    else if (path.startsWith("/repaired/artists/")) {
      const slug = path.replace(/^\/repaired\/artists\//, "").replace(/\/$/, "");

      const { data: artist } = await supabase
        .from("registry_artists")
        .select("id, slug, display_name, origin_iso2, public_image_url, bio, status, metadata")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (!artist) return jsonResponse({ data: null }, 404);

      const meta = (artist.metadata || {}) as Record<string, unknown>;
      const sourceWpPostId = meta.source_wp_post_id ? Number(meta.source_wp_post_id) : null;

      let wkArtist: Record<string, unknown> | null = null;
      if (sourceWpPostId) {
        const { data: wk } = await supabase
          .from("wk_artists")
          .select("raw_meta, wp_status")
          .eq("source_wp_post_id", sourceWpPostId)
          .maybeSingle();
        wkArtist = wk || null;
      }

      const rawMeta = (wkArtist?.raw_meta || {}) as Record<string, unknown>;

      const genres: string[] = [];
      const primaryGenre = rawMeta.primary_genre || rawMeta["waki-artist-primary-genre"];
      if (primaryGenre) genres.push(String(primaryGenre));
      const artistType = rawMeta.artist_type ? String(rawMeta.artist_type) : null;

      const albums: Array<Record<string, unknown>> = [];
      try {
        const albumJson = rawMeta._wk_artist_studio_albums || rawMeta.studio_albums;
        if (albumJson) {
          const parsed = JSON.parse(String(albumJson));
          if (Array.isArray(parsed)) {
            for (const al of parsed) {
              albums.push({
                slug: String(al.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
                title: String(al.title || ""),
                releaseType: "Album",
                year: al.release_date ? String(al.release_date).split("-")[0] : "",
                releaseDate: al.release_date || "",
                trackCount: al.track_count || 0,
                artworkUrl: al.image || al.artwork || "",
                tracks: (al.tracks || []).map((tr: Record<string, unknown>) => ({
                  title: String(tr.title || ""),
                  duration: String(tr.duration || ""),
                })),
              });
            }
          }
        }
      } catch { /* ignore */ }

      const eps: Array<Record<string, unknown>> = [];
      try {
        const epJson = rawMeta._wk_artist_eps_compilations || rawMeta.eps_compilations;
        if (epJson) {
          const parsed = JSON.parse(String(epJson));
          if (Array.isArray(parsed)) {
            for (const ep of parsed) {
              eps.push({
                slug: String(ep.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
                title: String(ep.title || ""),
                releaseType: "EP",
                year: ep.release_date ? String(ep.release_date).split("-")[0] : "",
                releaseDate: ep.release_date || "",
                trackCount: ep.track_count || 0,
                artworkUrl: ep.image || ep.artwork || "",
                tracks: (ep.tracks || []).map((tr: Record<string, unknown>) => ({
                  title: String(tr.title || ""),
                  duration: String(tr.duration || ""),
                })),
              });
            }
          }
        }
      } catch { /* ignore */ }

      const topSongs: Array<Record<string, unknown>> = [];
      try {
        const songJson = rawMeta._wk_artist_top_songs || rawMeta.top_songs;
        if (songJson) {
          const parsed = JSON.parse(String(songJson));
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              topSongs.push({
                title: String(s.title || ""),
                artists: String(s.artists || ""),
                image: s.image || s.artwork || "",
                duration: String(s.duration || s.runtime || ""),
                songUrl: s.song_url || "",
              });
            }
          }
        }
      } catch { /* ignore */ }

      let bio = artist.bio || "";
      if (!bio && rawMeta.biography) bio = String(rawMeta.biography);
      if (!bio && rawMeta.short_description) bio = String(rawMeta.short_description);
      if (!bio && rawMeta._wk_artist_tagline) bio = String(rawMeta._wk_artist_tagline);

      const fullBio = rawMeta.full_bio ? String(rawMeta.full_bio) : "";

      const { data: chartEntries } = await supabase
        .from("chart_entries")
        .select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name")
        .eq("artist_slug", slug)
        .order("rank", { ascending: true })
        .limit(50);

      const chartEntryList = (chartEntries ?? []).map((e: Record<string, unknown>) => {
        const prev = Number(e.previous_rank || 0);
        const curr = Number(e.rank || 0);
        let movement: string = String(e.movement || "same");
        let movementAmount = 0;
        if (prev > 0 && curr > 0) {
          if (curr < prev) { movement = "up"; movementAmount = prev - curr; }
          else if (curr > prev) { movement = "down"; movementAmount = curr - prev; }
        }
        return {
          rank: curr,
          title: String(e.track_title || ""),
          artist: String(e.artist_name || ""),
          slug: String(e.track_slug || ""),
          movement: movement as "up" | "down" | "new" | "same",
          movementAmount,
          peakPosition: curr,
          weeksOnChart: 1,
          artworkUrl: e.artwork_url || "",
        };
      });

      const relatedArtists: Array<Record<string, unknown>> = [];
      try {
        const relatedJson = rawMeta._wk_artist_related_artists || rawMeta.related_artists;
        if (relatedJson) {
          const parsed = JSON.parse(String(relatedJson));
          if (Array.isArray(parsed)) {
            for (const ra of parsed) {
              const raSlug = ra.slug || String(ra).toLowerCase().replace(/[^a-z0-9]+/g, "-");
              if (raSlug) {
                const { data: raData } = await supabase
                  .from("registry_artists")
                  .select("slug, display_name, public_image_url")
                  .eq("slug", raSlug)
                  .eq("status", "active")
                  .maybeSingle();
                if (raData) {
                  relatedArtists.push({
                    slug: String(raData.slug),
                    name: String(raData.display_name),
                    imageUrl: raData.public_image_url || "",
                  });
                }
              }
            }
          }
        }
      } catch { /* ignore */ }

      if (relatedArtists.length === 0 && artist.origin_iso2) {
        const { data: sameCountry } = await supabase
          .from("registry_artists")
          .select("slug, display_name, public_image_url")
          .eq("origin_iso2", artist.origin_iso2)
          .eq("status", "active")
          .neq("slug", slug)
          .limit(6);
        for (const sc of (sameCountry ?? [])) {
          relatedArtists.push({
            slug: String(sc.slug),
            name: String(sc.display_name),
            imageUrl: sc.public_image_url || "",
          });
        }
      }

      const followerCount = rawMeta._wk_artist_followers ? Number(rawMeta._wk_artist_followers) : 0;
      const popularity = rawMeta._wk_artist_popularity ? Number(rawMeta._wk_artist_popularity) : 0;
      const country = rawMeta._wk_artist_country ? String(rawMeta._wk_artist_country) : (artist.origin_iso2 || "");

      const releases = [...albums, ...eps];
      const trackCount = releases.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.trackCount) || 0), 0);
      const releaseCount = releases.length;
      const isChartArtist = chartEntryList.length > 0;
      const topChartPosition = isChartArtist ? Math.min(...chartEntryList.map((e: Record<string, unknown>) => Number(e.rank))) : null;

      const videos: Array<Record<string, unknown>> = [];
      try {
        const oEmbedKeys = Object.keys(rawMeta).filter((k) => k.startsWith("_oembed_") && !k.startsWith("_oembed_time_"));
        for (const key of oEmbedKeys) {
          const html = String(rawMeta[key] || "");
          if (!html || html.trim() === "") continue;
          const srcMatch = html.match(/src=["'](https?:\/\/[^"']+)["']/);
          if (!srcMatch) continue;
          const src = srcMatch[1];
          const titleMatch = html.match(/title=["']([^"']+)["']/);
          const title = titleMatch ? titleMatch[1] : "";
          const ytMatch = src.match(/youtube\.com\/embed\/([^?&]+)/) || src.match(/youtu\.be\/([^?&]+)/);
          if (ytMatch) {
            const videoId = ytMatch[1];
            videos.push({
              id: videoId,
              title: title || "Video",
              url: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              source: "youtube",
            });
          } else {
            videos.push({
              id: src,
              title: title || "Video",
              url: src,
              thumbnail: "",
              source: "generic",
            });
          }
        }
      } catch { /* ignore */ }

      data = {
        artist: {
          id: String(artist.id),
          slug: String(artist.slug),
          name: String(artist.display_name),
          country,
          imageUrl: artist.public_image_url || "",
          genres,
          trackCount,
          releaseCount,
          isChartArtist,
          isRising: popularity > 0 && popularity < 40,
          topChartPosition,
          bio,
          fullBio,
          artistType,
          followerCount,
          popularity,
          spotifyUrl: rawMeta._wk_artist_spotify_url ? String(rawMeta._wk_artist_spotify_url) : (rawMeta.spotify_url ? String(rawMeta.spotify_url) : ""),
          instagram: rawMeta._wk_artist_instagram ? String(rawMeta._wk_artist_instagram) : (rawMeta.instagram ? String(rawMeta.instagram) : ""),
          chartEntries: chartEntryList,
          releases,
          topSongs,
          relatedArtists,
          videos,
        },
      };
    }

    else if (path === "/repaired/artists" || path === "/repaired/artists/") {
      const { data: publishedWpArtists } = await supabase
        .from("wk_artists")
        .select("source_wp_post_id")
        .eq("wp_status", "publish");

      const publishedPostIds = (publishedWpArtists ?? [])
        .map((a: Record<string, unknown>) => String(a.source_wp_post_id))
        .filter(Boolean);

      let query = supabase
        .from("registry_artists")
        .select("id, slug, display_name, origin_iso2, public_image_url, status")
        .eq("status", "active")
        .order("display_name", { ascending: true });

      if (publishedPostIds.length > 0) {
        query = query.in("metadata->>source_wp_post_id", publishedPostIds);
      } else {
        data = { artists: [] };
        return jsonResponse({ data });
      }

      const { data: artists } = await query.limit(500);

      data = {
        artists: (artists ?? []).map((a: Record<string, unknown>) => ({
          id: String(a.id),
          slug: String(a.slug),
          name: String(a.display_name),
          country: a.origin_iso2 || null,
          imageUrl: a.public_image_url || null,
          genres: [],
          trackCount: 0,
          releaseCount: 0,
          isChartArtist: true,
          isRising: false,
          topChartPosition: null,
        })),
      };
    }

    else if (path.startsWith("/repaired/releases/")) {
      const pathRemainder = path.replace(/^\/repaired\/releases\//, "").replace(/\/$/, "");
      const segments = pathRemainder.split("/").filter(Boolean);
      const releaseSlug = segments.length >= 2 ? segments[segments.length - 1] : pathRemainder;

      const { data: release } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata, status, description")
        .eq("slug", releaseSlug)
        .in("status", ["active", "draft"])
        .maybeSingle();

      if (!release) return jsonResponse({ data: null }, 404);

      const releaseId = String(release.id);

      const { data: tracks } = await supabase
        .from("registry_tracks")
        .select("id, slug, title, duration_ms, track_number, artwork_url")
        .eq("release_id", releaseId)
        .order("track_number", { ascending: true });

      const trackIds = (tracks ?? []).map((t: Record<string, unknown>) => String(t.id));
      const { data: credits } = trackIds.length > 0
        ? await supabase
            .from("registry_track_artist_credits")
            .select("track_id, display_name, role, credit_order")
            .in("track_id", trackIds)
            .eq("role", "primary")
            .order("credit_order", { ascending: true })
        : { data: [] };

      const { data: label } = release.label_id
        ? await supabase
            .from("registry_labels")
            .select("id, slug, name, country_code")
            .eq("id", String(release.label_id))
            .maybeSingle()
        : { data: null };

      const trackArtistMap = new Map<string, string>();
      for (const c of (credits ?? [])) {
        const tid = String(c.track_id);
        if (!trackArtistMap.has(tid)) {
          trackArtistMap.set(tid, String(c.display_name));
        }
      }

      const trackList = (tracks ?? []).map((t: Record<string, unknown>) => ({
        id: String(t.id),
        slug: String(t.slug || t.id),
        title: String(t.title),
        artist: trackArtistMap.get(String(t.id)) || "Unknown",
        duration: Number(t.duration_ms || 0) / 1000,
        trackNumber: t.track_number || 0,
        artworkUrl: t.artwork_url || "",
      }));

      const totalDuration = trackList.reduce((sum: number, tr: Record<string, unknown>) => sum + (Number(tr.duration) || 0), 0);

      const artistName = trackArtistMap.get(trackIds[0]) || (label?.name || "Unknown");

      let description = release.description || "";
      if (!description || description.trim().length === 0) {
        description = generateReleaseExcerpt({
          title: String(release.title),
          artist: artistName,
          releaseDate: String(release.release_date || ""),
          releaseType: String(release.release_type || "album"),
          labelName: label?.name || "Independent",
          trackCount: trackList.length,
          tracks: trackList,
          totalDuration,
        });

        try {
          await supabase
            .from("registry_releases")
            .update({ description })
            .eq("id", releaseId);
        } catch { /* ignore write errors */ }
      }

      data = {
        release: {
          id: releaseId,
          slug: String(release.slug),
          title: String(release.title),
          artist: artistName,
          year: release.release_date ? String(release.release_date).split("-")[0] : "",
          releaseDate: release.release_date || "",
          releaseType: String(release.release_type || "album"),
          labelName: label?.name || "Independent",
          labelSlug: label?.slug || "",
          artworkUrl: release.artwork_url || "",
          trackCount: trackList.length,
          tracks: trackList,
          totalDuration,
          description,
          metadata: release.metadata || {},
        },
      };
    }

    else if (path === "/repaired/releases" || path === "/repaired/releases/") {
      const { data: releases } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_date, release_type, artwork_url, label_id, status, description")
        .in("status", ["active", "draft"])
        .order("release_date", { ascending: false })
        .limit(200);

      const releaseIds = (releases ?? []).map((r: Record<string, unknown>) => String(r.id));
      const labelIds = (releases ?? []).map((r: Record<string, unknown>) => r.label_id).filter(Boolean).map(String);

      const { data: tracks } = releaseIds.length > 0
        ? await supabase.from("registry_tracks").select("id, release_id, duration_ms, track_number, title").in("release_id", releaseIds)
        : { data: [] };

      const trackIds = (tracks ?? []).map((t: Record<string, unknown>) => String(t.id));

      const { data: credits } = trackIds.length > 0
        ? await supabase
            .from("registry_track_artist_credits")
            .select("track_id, display_name, role, credit_order")
            .in("track_id", trackIds)
            .eq("role", "primary")
            .order("credit_order", { ascending: true })
        : { data: [] };

      const { data: labels } = labelIds.length > 0
        ? await supabase.from("registry_labels").select("id, name").in("id", [...new Set(labelIds)])
        : { data: [] };

      const labelMap = new Map((labels ?? []).map((l: Record<string, unknown>) => [String(l.id), String(l.name)]));
      const trackReleaseMap = new Map((tracks ?? []).map((t: Record<string, unknown>) => [String(t.id), String(t.release_id)]));
      const releaseArtistMap = new Map<string, string>();
      for (const c of (credits ?? [])) {
        const rid = trackReleaseMap.get(String(c.track_id));
        if (rid && !releaseArtistMap.has(rid)) {
          releaseArtistMap.set(rid, String(c.display_name));
        }
      }
      const releaseTrackCount = new Map<string, number>();
      for (const t of (tracks ?? [])) {
        const rid = String(t.release_id);
        releaseTrackCount.set(rid, (releaseTrackCount.get(rid) || 0) + 1);
      }
      const releaseTotalDuration = new Map<string, number>();
      for (const t of (tracks ?? [])) {
        const rid = String(t.release_id);
        const dur = Number(t.duration_ms || 0) / 1000;
        releaseTotalDuration.set(rid, (releaseTotalDuration.get(rid) || 0) + dur);
      }
      const releaseTracks = new Map<string, Array<Record<string, unknown>>>();
      for (const t of (tracks ?? [])) {
        const rid = String(t.release_id);
        if (!releaseTracks.has(rid)) releaseTracks.set(rid, []);
        releaseTracks.get(rid)!.push({
          title: t.title,
          trackNumber: t.track_number || 0,
          duration: Number(t.duration_ms || 0) / 1000,
        });
      }

      data = {
        releases: (releases ?? []).map((r: Record<string, unknown>) => {
          const rid = String(r.id);
          const artistName = releaseArtistMap.get(rid) || "Unknown";
          const labelName = labelMap.get(String(r.label_id)) || "Independent";
          const trackCount = releaseTrackCount.get(rid) || 0;
          const totalDuration = releaseTotalDuration.get(rid) || 0;
          const trackList = releaseTracks.get(rid) || [];

          let description = r.description || "";
          if (!description || description.trim().length === 0) {
            description = generateReleaseExcerpt({
              title: String(r.title),
              artist: artistName,
              releaseDate: String(r.release_date || ""),
              releaseType: String(r.release_type || "album"),
              labelName,
              trackCount,
              tracks: trackList,
              totalDuration,
            });
          }

          return {
            id: rid,
            slug: String(r.slug),
            title: String(r.title),
            artist: artistName,
            year: r.release_date ? String(r.release_date).split("-")[0] : "",
            releaseType: String(r.release_type || "album"),
            labelName,
            artworkUrl: r.artwork_url || "",
            trackCount,
            description,
          };
        }),
      };
    }

    else if (path === "/repaired/genres" || path === "/repaired/genres/") {
      const { data: genres } = await supabase
        .from("registry_genres")
        .select("id, slug, name, description, status")
        .eq("status", "active")
        .order("name", { ascending: true });

      data = {
        genres: (genres ?? []).map((g: Record<string, unknown>) => ({
          id: String(g.id),
          slug: String(g.slug),
          name: String(g.name),
          artistCount: 0,
          trackCount: 0,
          representativeArtists: [],
        })),
      };
    }

    else if (path === "/repaired/labels" || path === "/repaired/labels/") {
      const { data: labels } = await supabase
        .from("registry_labels")
        .select("id, slug, name, country_code, description, status")
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(500);

      data = {
        labels: (labels ?? []).map((l: Record<string, unknown>) => ({
          id: String(l.id),
          slug: String(l.slug),
          name: String(l.name),
          country: l.country_code || null,
          logoUrl: null,
          artistCount: 0,
          releaseCount: 0,
          featuredArtists: [],
          isFeatured: false,
          description: l.description || null,
        })),
      };
    }

    else if (path === "/charts" || path === "/charts/") {
      const { data: programs } = await supabase
        .from("chart_programs")
        .select("id, public_slug, label, series_slug, market_slug, default_chart_size, default_period_type, default_methodology_version, status")
        .eq("status", "active")
        .order("label", { ascending: true });

      const programIds = (programs ?? []).map((p: Record<string, unknown>) => String(p.id));
      const { data: editions } = programIds.length > 0
        ? await supabase
            .from("chart_editions")
            .select("id, program_id, edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
            .in("program_id", programIds)
            .eq("status", "published")
            .order("edition_date", { ascending: false })
        : { data: [] };

      const editionsByProgram = new Map<string, Array<Record<string, unknown>>>();
      for (const e of (editions ?? [])) {
        const pid = String(e.program_id);
        if (!editionsByProgram.has(pid)) editionsByProgram.set(pid, []);
        editionsByProgram.get(pid)!.push(e);
      }

      const seriesSlugs = (programs ?? []).map((p: Record<string, unknown>) => String(p.series_slug)).filter(Boolean);
      const marketSlugs = (programs ?? []).map((p: Record<string, unknown>) => String(p.market_slug)).filter(Boolean);
      const [seriesLabelMap, marketLabelMap] = await Promise.all([
        resolveSeriesLabels(supabase, seriesSlugs),
        resolveMarketLabels(supabase, marketSlugs),
      ]);

      const programsResult = (programs ?? []).map((p: Record<string, unknown>) => {
        const pid = String(p.id);
        const edList = editionsByProgram.get(pid) || [];
        const latest = edList[0];
        const seriesSlug = String(p.series_slug || "");
        const marketSlug = String(p.market_slug || "");
        return {
          id: pid,
          publicSlug: String(p.public_slug),
          publicLabel: String(p.label),
          shortLabel: String(p.label),
          sourceFamilySlug: String(p.public_slug),
          seriesSlug,
          seriesLabel: seriesLabelMap.get(seriesSlug) || seriesSlug,
          marketSlug,
          marketLabel: marketLabelMap.get(marketSlug) || marketSlug,
          periodType: String(p.default_period_type || "weekly"),
          methodologyVersion: String(p.default_methodology_version || "legacy-import-v1"),
          eligibilityRulesVersion: "legacy-import-v1",
          latestEdition: latest ? {
            id: String(latest.edition_slug),
            slug: String(latest.edition_slug),
            label: String(latest.edition_label),
            date: String(latest.edition_date),
            periodStart: latest.period_start,
            periodEnd: latest.period_end,
            entryCount: latest.entry_count,
          } : null,
          archive: edList.map((e: Record<string, unknown>) => ({
            id: String(e.edition_slug),
            slug: String(e.edition_slug),
            label: String(e.edition_label),
            date: String(e.edition_date),
            periodStart: e.period_start,
            periodEnd: e.period_end,
            entryCount: e.entry_count,
          })),
        };
      });

      data = { programs: programsResult };
    }

    else if (path.startsWith("/charts/")) {
      const chartPath = path.replace(/^\/charts\//, "");
      const segments = chartPath.split("/").filter(Boolean);

      if (segments.length === 1) {
        const slug = segments[0];
        const { data: program } = await supabase
          .from("chart_programs")
          .select("id, public_slug, label, series_slug, market_slug, default_chart_size, default_period_type, default_methodology_version, status")
          .eq("public_slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (!program) return jsonResponse({ error: "Not found" }, 404);

        const { data: editions } = await supabase
          .from("chart_editions")
          .select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
          .eq("program_id", program.id)
          .eq("status", "published")
          .order("edition_date", { ascending: false });

        const [seriesLabelMap, marketLabelMap] = await Promise.all([
          resolveSeriesLabels(supabase, [String(program.series_slug || "")]),
          resolveMarketLabels(supabase, [String(program.market_slug || "")]),
        ]);

        const seriesSlug = String(program.series_slug || "");
        const marketSlug = String(program.market_slug || "");

        data = {
          program: {
            id: String(program.id),
            publicSlug: String(program.public_slug),
            publicLabel: String(program.label),
            shortLabel: String(program.label),
            sourceFamilySlug: String(program.public_slug),
            seriesSlug,
            seriesLabel: seriesLabelMap.get(seriesSlug) || seriesSlug,
            marketSlug,
            marketLabel: marketLabelMap.get(marketSlug) || marketSlug,
            periodType: String(program.default_period_type || "weekly"),
            methodologyVersion: String(program.default_methodology_version || "legacy-import-v1"),
            eligibilityRulesVersion: "legacy-import-v1",
            latestEdition: editions && editions.length > 0 ? {
              id: String(editions[0].edition_slug),
              slug: String(editions[0].edition_slug),
              label: String(editions[0].edition_label),
              date: String(editions[0].edition_date),
              periodStart: editions[0].period_start,
              periodEnd: editions[0].period_end,
              entryCount: editions[0].entry_count,
            } : null,
            archive: (editions ?? []).map((e: Record<string, unknown>) => ({
              id: String(e.edition_slug),
              slug: String(e.edition_slug),
              label: String(e.edition_label),
              date: String(e.edition_date),
              periodStart: e.period_start,
              periodEnd: e.period_end,
              entryCount: e.entry_count,
            })),
          },
        };
      } else if (segments.length === 2 && segments[1] === "latest") {
        const slug = segments[0];
        const { data: program } = await supabase
          .from("chart_programs")
          .select("id, public_slug, label, series_slug, market_slug")
          .eq("public_slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (!program) return jsonResponse({ error: "Not found" }, 404);

        const { data: edition } = await supabase
          .from("chart_editions")
          .select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
          .eq("program_id", program.id)
          .eq("status", "published")
          .order("edition_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const [seriesLabelMap, marketLabelMap] = await Promise.all([
          resolveSeriesLabels(supabase, [String(program.series_slug || "")]),
          resolveMarketLabels(supabase, [String(program.market_slug || "")]),
        ]);

        const seriesSlug = String(program.series_slug || "");
        const marketSlug = String(program.market_slug || "");

        data = {
          edition: edition ? {
            id: String(edition.edition_slug),
            slug: String(edition.edition_slug),
            label: String(edition.edition_label),
            date: String(edition.edition_date),
            periodStart: edition.period_start,
            periodEnd: edition.period_end,
            entryCount: edition.entry_count,
          } : null,
          program: {
            id: String(program.id),
            publicSlug: String(program.public_slug),
            publicLabel: String(program.label),
            seriesSlug,
            seriesLabel: seriesLabelMap.get(seriesSlug) || seriesSlug,
            marketSlug,
            marketLabel: marketLabelMap.get(marketSlug) || marketSlug,
          },
        };
      } else if (segments.length === 2) {
        const slug = segments[0];
        const editionSlug = segments[1];

        const { data: program } = await supabase
          .from("chart_programs")
          .select("id, public_slug, label, series_slug, market_slug")
          .eq("public_slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (!program) return jsonResponse({ error: "Not found" }, 404);

        const { data: edition } = await supabase
          .from("chart_editions")
          .select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
          .eq("program_id", program.id)
          .eq("edition_slug", editionSlug)
          .maybeSingle();

        const [seriesLabelMap, marketLabelMap] = await Promise.all([
          resolveSeriesLabels(supabase, [String(program.series_slug || "")]),
          resolveMarketLabels(supabase, [String(program.market_slug || "")]),
        ]);

        const seriesSlug = String(program.series_slug || "");
        const marketSlug = String(program.market_slug || "");

        data = {
          edition: edition ? {
            id: String(edition.edition_slug),
            slug: String(edition.edition_slug),
            label: String(edition.edition_label),
            date: String(edition.edition_date),
            periodStart: edition.period_start,
            periodEnd: edition.period_end,
            entryCount: edition.entry_count,
          } : null,
          program: {
            id: String(program.id),
            publicSlug: String(program.public_slug),
            publicLabel: String(program.label),
            seriesSlug,
            seriesLabel: seriesLabelMap.get(seriesSlug) || seriesSlug,
            marketSlug,
            marketLabel: marketLabelMap.get(marketSlug) || marketSlug,
          },
        };
      } else if (segments.length === 3 && segments[2] === "entries") {
        const slug = segments[0];
        const editionSlug = segments[1];

        const { data: program } = await supabase
          .from("chart_programs")
          .select("id")
          .eq("public_slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (!program) return jsonResponse({ error: "Not found" }, 404);

        const { data: edition } = await supabase
          .from("chart_editions")
          .select("id")
          .eq("program_id", program.id)
          .eq("edition_slug", editionSlug)
          .maybeSingle();

        if (!edition) return jsonResponse({ error: "Not found" }, 404);

        const { data: entries } = await supabase
          .from("chart_entries")
          .select("id, rank, previous_rank, movement, track_slug, track_title, artist_slug, artist_name, artwork_url, score, source_entry_id")
          .eq("edition_id", edition.id)
          .order("rank", { ascending: true });

        data = {
          entries: (entries ?? []).map((e: Record<string, unknown>) => {
            const artistName = String(e.artist_name || "");
            const artistNames = artistName ? artistName.split(",").map((s: string) => s.trim()) : [];
            return {
              id: String(e.id),
              editionId: String(edition.id),
              rank: e.rank,
              previousRank: e.previous_rank,
              movement: e.movement || "same",
              trackSlug: e.track_slug,
              trackTitle: e.track_title,
              artistSlugs: e.artist_slug ? [String(e.artist_slug)] : [],
              artistNames,
              artworkUrl: e.artwork_url,
              score: e.score,
              sourceEntryId: e.source_entry_id,
            };
          }),
        };
      } else {
        return jsonResponse({ error: "Not found" }, 404);
      }
    }

    else if (path.startsWith("/tracks/")) {
      const trackPath = path.replace(/^\/tracks\//, "");
      const segments = trackPath.split("/").filter(Boolean);

      if (segments.length === 2 && segments[1] === "chart-history") {
        const trackSlug = segments[0];

        const { data: entries } = await supabase
          .from("chart_entries")
          .select("edition_id, rank, track_title, artist_name, artwork_url")
          .eq("track_slug", trackSlug)
          .order("rank", { ascending: true });

        const editionIds = [...new Set((entries ?? []).map((e: Record<string, unknown>) => String(e.edition_id)))];

        const { data: editions } = editionIds.length > 0
          ? await supabase
              .from("chart_editions")
              .select("id, edition_slug, edition_date, program_id")
              .in("id", editionIds)
          : { data: [] };

        const programIds = [...new Set((editions ?? []).map((e: Record<string, unknown>) => String(e.program_id)))];

        const { data: programs } = programIds.length > 0
          ? await supabase
              .from("chart_programs")
              .select("id, public_slug, label")
              .in("id", programIds)
          : { data: [] };

        const editionMap = new Map((editions ?? []).map((e: Record<string, unknown>) => [String(e.id), e]));
        const programMap = new Map((programs ?? []).map((p: Record<string, unknown>) => [String(p.id), p]));

        const appearances = (entries ?? []).map((e: Record<string, unknown>) => {
          const ed = editionMap.get(String(e.edition_id));
          const prog = ed ? programMap.get(String(ed.program_id)) : null;
          return {
            editionSlug: ed ? String(ed.edition_slug) : "",
            editionDate: ed ? String(ed.edition_date) : "",
            familySlug: prog ? String(prog.public_slug) : "",
            familyLabel: prog ? String(prog.label) : "",
            rank: e.rank,
          };
        });

        const ranks = appearances.map((a: Record<string, unknown>) => Number(a.rank)).filter((r: number) => r > 0);
        const peakPosition = ranks.length > 0 ? Math.min(...ranks) : 0;

        data = {
          history: {
            trackSlug,
            trackTitle: entries && entries.length > 0 ? String(entries[0].track_title) : trackSlug,
            artistNames: entries && entries.length > 0 && entries[0].artist_name ? String(entries[0].artist_name).split(",").map((s: string) => s.trim()) : [],
            appearances,
            peakPosition,
            totalWeeksOnChart: appearances.length,
            firstAppearance: appearances.length > 0 ? appearances[0].editionDate : null,
            latestAppearance: appearances.length > 0 ? appearances[appearances.length - 1].editionDate : null,
          },
        };
      } else {
        return jsonResponse({ error: "Not found" }, 404);
      }
    } else {
      return jsonResponse({ error: "Not found" }, 404);
    }

    return jsonResponse({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
