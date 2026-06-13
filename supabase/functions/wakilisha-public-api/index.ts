import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "1; mode=block",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
  });
}

function releaseTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "album" || t === "studio album") return "studio album";
  if (t === "ep" || t === "extended play") return "extended play";
  if (t === "single") return "single";
  if (t === "compilation" || t === "mixtape") return t;
  return t;
}

function articleize(word: string): string {
  const first = word.charAt(0).toLowerCase();
  if ("aeiou".includes(first)) return `an ${word}`;
  return `a ${word}`;
}

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

function extractYear(dateStr: string): string {
  if (!dateStr) return "";
  const cleaned = String(dateStr).trim();
  if (cleaned.includes("-")) return cleaned.split("-")[0];
  const spaceParts = cleaned.split(" ");
  const last = spaceParts[spaceParts.length - 1];
  if (/^\d{4}$/.test(last)) return last;
  return cleaned;
}

function extractFirstImgSrc(html: string): string {
  const m = html.match(/<img[^>]+src="([^"]+)"/);
  return m ? m[1] : "";
}

function stripHtml(html: string): string {
  return String(html || "").replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, "").trim();
}

function generateSmartExcerpt(html: string | null | undefined, maxChars = 280): string {
  if (!html) return "";
  const withoutHeadings = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  let plain = withoutHeadings.replace(/<[^>]*>/g, "");
  plain = plain.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, "");
  plain = plain.replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= maxChars) return plain;
  const chopped = plain.slice(0, maxChars);
  const lastSpace = chopped.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return chopped.slice(0, lastSpace).replace(/[,\s]+$/, "") + "\u2026";
  return chopped.replace(/[,\s]+$/, "") + "\u2026";
}

function resolveDek(article: Record<string, unknown>, maxChars = 280): string {
  const manualExcerpt = String(article.excerpt || "").trim();
  if (manualExcerpt) return manualExcerpt;
  return generateSmartExcerpt(String(article.content_html || ""), maxChars);
}

function parseCategoryNames(categories: any): string[] {
  if (!Array.isArray(categories)) return [];
  return categories.map((c: any) => {
    if (typeof c === "string") return c;
    if (c && typeof c === "object" && c.name) return String(c.name);
    return "";
  }).filter(Boolean);
}

function parseTagNames(tags: any): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((t: any) => {
    if (typeof t === "string") return t;
    if (t && typeof t === "object" && t.name) return String(t.name);
    return "";
  }).filter(Boolean);
}

function normalizePath(raw: string): string {
  const withoutPrefix = raw.replace(/^(\/functions\/v1)?\/wakilisha-public-api/, "");
  return withoutPrefix.replace(/\/$/, "") || "/";
}

const WP_AUTHOR_MAP: Record<string, string> = {
  "1": "Wakilisha Staff",
  "37": "Muiruri Beautah",
  "38": "Shalom Kendi Mbae",
  "39": "Michael Mburu",
  "40": "Kambura Matiri",
  "41": "Kiuta Faith",
  "42": "gatwiri_c",
  "43": "Mary Gathoni",
  "44": "Timothy Muiruri",
  "47": "Sarah Wambi",
  "48": "Frank Njugi",
  "52": "Victor Muia",
  "54": "Hafare Segelan",
  "179": "Wangari Karume",
};

function resolveAuthor(article: Record<string, unknown>): string {
  const storedAuthor = String(article.author || "").trim();
  if (storedAuthor && storedAuthor !== "Wakilisha") return storedAuthor;
  const rawMeta = (article.raw_meta || {}) as Record<string, unknown>;
  const wpAuthorId = rawMeta.post_author ? String(rawMeta.post_author) : "";
  if (wpAuthorId && WP_AUTHOR_MAP[wpAuthorId]) return WP_AUTHOR_MAP[wpAuthorId];
  return "Wakilisha Staff";
}

function authorSlugFromName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function buildArticleResponse(a: any) {
  const catNames = parseCategoryNames(a.categories);
  const section = catNames.length > 0 ? catNames[0] : "Music";
  const contentText = stripHtml(String(a.content_html || ""));
  const tagNames = parseTagNames(a.tags);
  const dek = resolveDek(a, 280);
  let heroUrl = String(a.hero_image_url || "");
  if (!heroUrl && a.content_html) heroUrl = extractFirstImgSrc(String(a.content_html));
  const authorName = resolveAuthor(a);
  return {
    id: String(a.id),
    slug: String(a.slug),
    title: String(a.title),
    section,
    dek,
    author: authorName,
    authorSlug: authorSlugFromName(authorName),
    date: a.published_at ? String(a.published_at).split("T")[0] : "",
    readingTime: Math.max(1, Math.ceil(contentText.length / 1500)),
    heroUrl,
    tags: tagNames,
  };
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);
}

type ReleaseEntry = {
  slug: string;
  title: string;
  releaseType: string;
  year: string;
  releaseDate: string;
  trackCount: number;
  artworkUrl: string;
  labelName?: string;
  tracks: Array<{ title: string; duration: string }>;
};

async function getArtistDiscography(
  supabase: ReturnType<typeof createClient>,
  artistId: string,
  artistName: string,
  metadataAlbums: any[],
  metadataEps: any[],
): Promise<ReleaseEntry[]> {
  // Try relational tables first
  const { data: releaseArtistRows } = await supabase
    .from("registry_release_artists")
    .select("release_id, is_primary, role")
    .eq("artist_id", artistId)
    .eq("status", "active")
    .order("credit_order", { ascending: true });

  if (releaseArtistRows && releaseArtistRows.length > 0) {
    const releaseIds = [...new Set(releaseArtistRows.map((r: any) => String(r.release_id)))];
    const { data: releases } = await supabase
      .from("registry_releases")
      .select("id, slug, title, release_type, release_date, artwork_url, label_id")
      .in("id", releaseIds)
      .in("status", ["active", "draft"])
      .order("release_date", { ascending: false });

    if (releases && releases.length > 0) {
      const { data: releaseTracks } = await supabase
        .from("registry_release_tracks")
        .select("release_id, track_id, track_number")
        .in("release_id", releaseIds)
        .eq("status", "active")
        .order("track_number", { ascending: true });

      const tracksByRelease = new Map<string, Array<{ track_id: string; track_number: number }>>();
      for (const rt of (releaseTracks ?? [])) {
        const rid = String(rt.release_id);
        if (!tracksByRelease.has(rid)) tracksByRelease.set(rid, []);
        tracksByRelease.get(rid)!.push({ track_id: String(rt.track_id), track_number: Number(rt.track_number || 0) });
      }

      const trackIds = (releaseTracks ?? []).map((rt: any) => String(rt.track_id));
      const { data: trackRows } = trackIds.length > 0
        ? await supabase.from("registry_tracks").select("id, title, duration_ms").in("id", trackIds)
        : { data: [] };
      const trackById = new Map((trackRows ?? []).map((t: any) => [String(t.id), t]));

      const labelIds = [...new Set((releases ?? []).map((r: any) => r.label_id).filter(Boolean).map(String))];
      const { data: labels } = labelIds.length > 0
        ? await supabase.from("registry_labels").select("id, name").in("id", labelIds)
        : { data: [] };
      const labelById = new Map((labels ?? []).map((l: any) => [String(l.id), String(l.name)]));

      return (releases as any[]).map((r: any) => {
        const releaseTrackList = tracksByRelease.get(String(r.id)) ?? [];
        const tracks = releaseTrackList
          .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
          .map((rt) => {
            const t = trackById.get(rt.track_id);
            if (!t) return null;
            const dms = Number(t.duration_ms || 0);
            const minutes = Math.floor(dms / 60000);
            const seconds = Math.floor((dms % 60000) / 1000);
            return {
              title: String(t.title || ""),
              duration: dms > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : "",
            };
          })
          .filter(Boolean) as Array<{ title: string; duration: string }>;

        const trackCount = tracks.length || releaseTrackList.length;
        const labelName = r.label_id ? (labelById.get(String(r.label_id)) || "Independent") : "Independent";

        return {
          slug: String(r.slug),
          title: String(r.title),
          releaseType: String(r.release_type || "album"),
          year: r.release_date ? String(r.release_date).split("-")[0] : "",
          releaseDate: r.release_date || "",
          trackCount,
          artworkUrl: String(r.artwork_url || ""),
          labelName,
          tracks,
        };
      });
    }
  }

  // Fall back to metadata blobs
  const releasesFromMeta: ReleaseEntry[] = [];
  for (const al of metadataAlbums) {
    releasesFromMeta.push({
      slug: al.title ? slugify(al.title) : "",
      title: String(al.title || ""),
      releaseType: "Album",
      year: extractYear(String(al.release_date || al.year || "")),
      releaseDate: String(al.release_date || al.year || ""),
      trackCount: Number(al.track_count || al.trackCount || 0),
      artworkUrl: String(al.image || al.artwork || al.artworkUrl || al.artwork_url || ""),
      tracks: Array.isArray(al.tracks) ? al.tracks.map((tr: any) => ({ title: String(tr.title || ""), duration: String(tr.duration || "") })) : [],
    });
  }
  for (const ep of metadataEps) {
    releasesFromMeta.push({
      slug: ep.title ? slugify(ep.title) : "",
      title: String(ep.title || ""),
      releaseType: "EP",
      year: extractYear(String(ep.release_date || ep.year || "")),
      releaseDate: String(ep.release_date || ep.year || ""),
      trackCount: Number(ep.track_count || ep.trackCount || 0),
      artworkUrl: String(ep.image || ep.artwork || ep.artworkUrl || ep.artwork_url || ""),
      tracks: Array.isArray(ep.tracks) ? ep.tracks.map((tr: any) => ({ title: String(tr.title || ""), duration: String(tr.duration || "") })) : [],
    });
  }
  return releasesFromMeta;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, ...securityHeaders } });
  const url = new URL(req.url);
  const path = normalizePath(url.pathname);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let data: unknown;

    if (path === "/authors" || path === "/authors/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;
      const { data: authors } = await supabase.from("registry_authors").select("id, slug, name, bio, role, location, avatar_url, cover_url, social_links, joined_date").order("name", { ascending: true }).limit(limit);
      data = { authors: (authors ?? []).map((a: any) => ({ id: String(a.id), slug: String(a.slug), name: String(a.name), bio: a.bio || null, role: a.role || "Contributor", location: a.location || null, avatarUrl: a.avatar_url || null, coverUrl: a.cover_url || null, socialLinks: a.social_links || [], joinedDate: a.joined_date || null })) };
    }

    else if (path.startsWith("/authors/")) {
      const authorSlug = path.replace(/^\/authors\//, "").replace(/\/$/, "");
      if (!authorSlug) return jsonResponse({ data: null }, 404);
      const { data: author } = await supabase.from("registry_authors").select("id, slug, name, bio, role, location, avatar_url, cover_url, social_links, joined_date").eq("slug", authorSlug).maybeSingle();
      if (!author) return jsonResponse({ data: null }, 404);
      const authorName = String(author.name);
      const authorSlugNormalized = authorSlugFromName(authorName);
      const { data: allArticles } = await supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo, raw_meta").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(500);
      const matchedArticles = (allArticles ?? []).filter((a: any) => authorSlugFromName(resolveAuthor(a)) === authorSlugNormalized);
      const articleList = matchedArticles.map((a: any) => buildArticleResponse(a));
      data = { author: { id: String(author.id), slug: String(author.slug), name: String(author.name), bio: author.bio || null, role: author.role || "Contributor", location: author.location || null, avatarUrl: author.avatar_url || null, coverUrl: author.cover_url || null, socialLinks: author.social_links || [], joinedDate: author.joined_date || null }, articles: articleList, articleCount: articleList.length };
    }

    else if (path.startsWith("/preview/")) {
      const nonce = path.replace(/^\/preview\//, "").replace(/\/$/, "");
      const now = new Date().toISOString();
      const { data: article } = await supabase.from("wk_articles").select("id, slug, title, excerpt, content_html, author, published_at, categories, tags, hero_image_url, seo, wp_status, raw_meta").eq("preview_nonce", nonce).gt("preview_nonce_expires_at", now).maybeSingle();
      if (!article) return jsonResponse({ data: null, meta: { reason: "expired_or_invalid" } }, 404);
      data = { article: { ...buildArticleResponse(article), contentHtml: String(article.content_html || ""), seo: (article.seo || {}) as Record<string, unknown>, categories: parseCategoryNames(article.categories), wpStatus: String(article.wp_status || "draft") } };
    }

    else if (path === "/magazine/site-content" || path === "/magazine/site-content/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 200;
      const [articleResult, artistResult, releaseResult, chartResult] = await Promise.all([
        supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo, raw_meta").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(limit),
        supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, metadata, status").eq("status", "active").order("display_name", { ascending: true }).limit(50),
        supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, description, status").in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(30),
        supabase.from("wk_chart_entries_v2").select("rank, track_title, track_slug, artist_name, artwork_url, edition_id").order("rank", { ascending: true }).limit(20),
      ]);
      const articles = (articleResult.data ?? []).map((a: any) => ({ contentType: "article" as const, ...buildArticleResponse(a) }));
      const artists = (artistResult.data ?? []).map((a: any) => {
        const meta = (a.metadata || {}) as Record<string, unknown>;
        const artistGenres: string[] = Array.isArray(meta.genres) ? (meta.genres as string[]).map(String) : [];
        return { contentType: "artist" as const, id: String(a.id), slug: String(a.slug), title: String(a.display_name), section: artistGenres[0] || "Artist", dek: artistGenres.slice(0, 3).join(" / ") || "Artist in the registry", author: "", authorSlug: "", date: "", readingTime: 0, heroUrl: String(a.public_image_url || ""), tags: artistGenres, originIso2: a.origin_iso2 || null };
      });
      const releases = (releaseResult.data ?? []).map((r: any) => ({ contentType: "release" as const, id: String(r.id), slug: String(r.slug), title: String(r.title), section: String(r.release_type || "Release"), dek: r.description || "", author: "", authorSlug: "", date: r.release_date ? String(r.release_date).split("T")[0] : "", readingTime: 0, heroUrl: String(r.artwork_url || ""), tags: [], releaseType: String(r.release_type || "album") }));
      const chartHighlights = (chartResult.data ?? []).map((c: any) => ({ contentType: "chart_entry" as const, id: String(c.track_slug || c.edition_id), slug: String(c.track_slug || ""), title: String(c.track_title || ""), section: "Chart Entry", dek: `#${c.rank} \u00B7 ${c.artist_name || ""}`, author: String(c.artist_name || ""), authorSlug: "", date: "", readingTime: 0, heroUrl: String(c.artwork_url || ""), tags: [], rank: Number(c.rank), artistName: String(c.artist_name || "") }));
      data = { articles, artists, releases, chartHighlights };
    }

    else if (path.startsWith("/magazine/public/issues/")) {
      const issueSlug = path.replace(/^\/magazine\/public\/issues\//, "").replace(/\/$/, "");
      const { data: issue } = await supabase.from("wk_magazine_issues").select("*").eq("slug", issueSlug).eq("status", "published").maybeSingle();
      if (!issue) return jsonResponse({ data: null, meta: { reason: "not_found_or_not_published" } }, 404);
      const { data: sections } = await supabase.from("wk_magazine_issue_sections").select("*").eq("issue_id", String(issue.id)).order("sort_order", { ascending: true });
      const { data: entities } = await supabase.from("wk_magazine_issue_entities").select("*").eq("issue_id", String(issue.id)).order("sort_order", { ascending: true });
      const visualAssetIds = (sections ?? []).map((s: any) => s.visual_asset_id).filter(Boolean) as string[];
      let visualAssets: any[] = [];
      if (visualAssetIds.length > 0) {
        const { data: visuals } = await supabase.from("wk_magazine_visual_assets").select("*").in("id", visualAssetIds).in("status", ["approved", "locked"]);
        visualAssets = visuals ?? [];
      }
      data = { issue: { id: String(issue.id), slug: String(issue.slug), title: String(issue.title), dek: issue.dek || null, status: String(issue.status), timeframeStart: issue.timeframe_start || null, timeframeEnd: issue.timeframe_end || null, issueType: String(issue.issue_type), visualFamily: issue.visual_family || null, treatment: issue.treatment || null, palette: issue.palette || null, contrastMode: issue.contrast_mode || null, createdBy: String(issue.created_by), publishedAt: issue.published_at || null }, sections: (sections ?? []).map((s: any) => ({ id: String(s.id), spreadId: String(s.spread_id), sectionType: String(s.section_type), title: String(s.title), deck: s.deck || null, body: s.body || null, layout: String(s.layout), sortOrder: Number(s.sort_order), status: String(s.status), visualAssetId: s.visual_asset_id || null })), entities: (entities ?? []).map((e: any) => ({ id: String(e.id), sectionId: e.section_id || null, entityType: String(e.entity_type), entityId: String(e.entity_id), role: String(e.role), selectionState: String(e.selection_state), sortOrder: Number(e.sort_order), sourceReason: e.source_reason || null })), visualAssets: visualAssets.map((v: any) => ({ id: String(v.id), spreadId: String(v.spread_id), visualFamily: String(v.visual_family), visualType: String(v.visual_type), editorialIntent: String(v.editorial_intent), treatment: String(v.treatment), palette: String(v.palette), contrastMode: String(v.contrast_mode), status: String(v.status) })) };
    }

    else if (path.startsWith("/magazine/") && path !== "/magazine" && path !== "/magazine/") {
      const slug = path.replace(/^\/magazine\//, "").replace(/\/$/, "");
      const now = new Date().toISOString();
      const { data: article } = await supabase.from("wk_articles").select("id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, hero_image_url, seo, wp_status, raw_meta").eq("slug", slug).maybeSingle();
      if (!article) return jsonResponse({ data: null }, 404);
      if (article.wp_status === "future" && article.published_at && article.published_at <= now) {
        const { error: updateError } = await supabase.from("wk_articles").update({ wp_status: "publish", updated_at: now }).eq("id", article.id);
        if (!updateError) article.wp_status = "publish";
      }
      if (article.wp_status !== "publish") return jsonResponse({ data: null }, 404);
      data = { article: { ...buildArticleResponse(article), contentHtml: String(article.content_html || ""), seo: (article.seo || {}) as Record<string, unknown>, categories: parseCategoryNames(article.categories) } };
    }

    else if (path === "/magazine" || path === "/magazine/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 500;
      const now = new Date().toISOString();
      await supabase.from("wk_articles").update({ wp_status: "publish", updated_at: now }).eq("wp_status", "future").lte("published_at", now);
      const { data: articles } = await supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo, raw_meta").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(limit);
      data = { stories: (articles ?? []).map((a: any) => buildArticleResponse(a)) };
    }

    // ── ARTIST DETAIL (v16: registry-first discography) ──
    else if (path.startsWith("/artists/")) {
      const slug = path.replace(/^\/artists\//, "").replace(/\/$/, "");
      const { data: artist } = await supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, bio, status, metadata").eq("slug", slug).eq("status", "active").maybeSingle();
      if (!artist) return jsonResponse({ data: null }, 404);

      const meta = (artist.metadata || {}) as Record<string, unknown>;
      const displayName = String(artist.display_name || "");
      const socialInstagram = String(meta.social_instagram || meta.instagram_url || "");
      const socialSpotify = String(meta.social_spotify || "");
      const youtubeChannel = String(meta.youtube_channel || "");
      const spotifyImage = String(meta.spotify_image || meta.portrait_image || "");
      const genresArr = meta.genres;
      const genres: string[] = [];
      if (Array.isArray(genresArr)) { for (const g of genresArr as string[]) genres.push(String(g)); }
      if (meta.country) genres.push(String(meta.country));

      const topSongs: any[] = [];
      const metaSongs = meta.top_songs;
      if (Array.isArray(metaSongs)) {
        for (const s of metaSongs as any[]) {
          topSongs.push({ title: String(s.title || ""), artists: String(s.artists || s.artist || ""), image: String(s.image || s.artwork || s.artworkUrl || s.artwork_url || ""), duration: String(s.duration || s.runtime || ""), songUrl: String(s.song_url || s.songUrl || s.url || "") });
        }
      }

      const wpBio = String(artist.bio || "");
      const tagline = String(meta.tagline || "");
      const shortBio = tagline || stripHtml(wpBio).split(".")[0] + "." || "";
      const fullBio = tagline + "\n\n" + wpBio;

      const videos: any[] = [];
      const youtubeVideos = meta.youtube_videos;
      if (Array.isArray(youtubeVideos)) {
        for (const videoUrl of youtubeVideos as string[]) {
          const v = String(videoUrl || "");
          const ytMatch = v.match(/youtube\.com\/watch\?v=([^&]+)/) || v.match(/youtu\.be\/([^?&]+)/);
          if (ytMatch) { const videoId = ytMatch[1]; videos.push({ id: videoId, title: "Video", url: "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1", thumbnail: "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg", platform: "youtube" }); }
        }
      }
      if (videos.length === 0) {
        const videoUrlsRaw = meta.video_urls;
        if (typeof videoUrlsRaw === "string" && videoUrlsRaw) {
          try {
            const parsed = JSON.parse(videoUrlsRaw);
            const urls = Array.isArray(parsed) ? parsed : [];
            for (const vid of urls) {
              const videoUrl = String(vid.url || vid || "");
              const ytMatch = videoUrl.match(/youtube\.com\/watch\?v=([^&]+)/) || videoUrl.match(/youtu\.be\/([^?&]+)/);
              if (ytMatch) { const videoId = ytMatch[1]; videos.push({ id: videoId, title: String(vid.title || "Video"), url: "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1", thumbnail: "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg", platform: "youtube" }); }
            }
          } catch { /* ignore */ }
        }
      }

      const metaAlbums = Array.isArray(meta.studio_albums) ? meta.studio_albums as any[] : [];
      const metaEps = Array.isArray(meta.eps_compilations) ? meta.eps_compilations as any[] : [];
      const releases = await getArtistDiscography(supabase, String(artist.id), displayName, metaAlbums, metaEps);

      const { data: chartEntriesBySlug } = await supabase.from("wk_chart_entries_v2").select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name").eq("artist_slug", slug).order("rank", { ascending: true }).limit(50);
      let chartEntries = chartEntriesBySlug ?? [];
      if (chartEntries.length === 0 && displayName) {
        const { data: chartEntriesByName } = await supabase.from("wk_chart_entries_v2").select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name").ilike("artist_name", displayName).order("rank", { ascending: true }).limit(50);
        chartEntries = chartEntriesByName ?? [];
      }
      const chartEntryList = chartEntries.map((e: any) => {
        const prev = Number(e.previous_rank || 0);
        const curr = Number(e.rank || 0);
        let movement: string = String(e.movement || "same");
        let movementAmount = 0;
        if (prev > 0 && curr > 0) { if (curr < prev) { movement = "up"; movementAmount = prev - curr; } else if (curr > prev) { movement = "down"; movementAmount = curr - prev; } }
        return { rank: curr, title: String(e.track_title || ""), artist: String(e.artist_name || ""), slug: String(e.track_slug || ""), movement, movementAmount, peakPosition: curr, weeksOnChart: 1, artworkUrl: e.artwork_url || "" };
      });

      const relatedArtists: any[] = [];
      const metaRelated = meta.related_artists;
      if (Array.isArray(metaRelated) && metaRelated.length > 0) {
        const relatedSlugs = (metaRelated as any[]).slice(0, 8).map((r: any) => String(r.slug || "")).filter(Boolean);
        if (relatedSlugs.length > 0) {
          const { data: relatedRows } = await supabase.from("registry_artists").select("slug, display_name, public_image_url").in("slug", relatedSlugs).eq("status", "active");
          const relatedMap = new Map((relatedRows ?? []).map((r: any) => [String(r.slug), r]));
          for (const mr of metaRelated as any[]) {
            const relSlug = String(mr.slug || "");
            const row = relatedMap.get(relSlug);
            relatedArtists.push({ slug: relSlug, name: row ? String(row.display_name) : String(mr.name || relSlug), imageUrl: row?.public_image_url || "", score: Number(mr.score || 0), sharedTracksAll: 0, sharedChartTracks: 0, featuresThem: Number(mr.they_feature || 0), theyFeature: Number(mr.features_them || 0), sharedTitles: [] });
          }
        }
      }
      if (relatedArtists.length === 0 && artist.origin_iso2) {
        const { data: sameCountry } = await supabase.from("registry_artists").select("slug, display_name, public_image_url").eq("origin_iso2", artist.origin_iso2).eq("status", "active").neq("slug", slug).limit(6);
        for (const sc of (sameCountry ?? [])) { relatedArtists.push({ slug: String(sc.slug), name: String(sc.display_name), imageUrl: sc.public_image_url || "" }); }
      }

      const followerCount = meta.spotify_followers ? Number(meta.spotify_followers) : 0;
      const popularity = meta.spotify_popularity ? Number(meta.spotify_popularity) : 0;
      const country = String(meta.country || artist.origin_iso2 || "");
      const heroImage = String(meta.portrait_image || artist.public_image_url || spotifyImage || "");
      const trackCount = releases.reduce((sum: number, r: any) => sum + (Number(r.trackCount) || 0), 0);
      const isChartArtist = chartEntryList.length > 0;
      const topChartPosition = isChartArtist ? Math.min(...chartEntryList.map((e: any) => Number(e.rank))) : null;

      data = {
        artist: {
          id: String(artist.id),
          slug: String(artist.slug),
          name: displayName,
          country,
          imageUrl: heroImage || artist.public_image_url || "",
          profileImageUrl: heroImage || artist.public_image_url || "",
          genres,
          trackCount,
          releaseCount: releases.length,
          isChartArtist,
          isRising: popularity > 0 && popularity < 40,
          topChartPosition,
          bio: shortBio || displayName + " is an artist in the WAKILISHA registry.",
          fullBio: fullBio || wpBio || "",
          artistType: String(artist.gender || meta.gender || ""),
          followerCount,
          popularity,
          spotifyUrl: meta.spotify_artist_id ? "https://open.spotify.com/artist/" + meta.spotify_artist_id : socialSpotify || "",
          instagram: socialInstagram,
          youtubeChannel,
          chartEntries: chartEntryList,
          releases,
          topSongs,
          relatedArtists,
          videos,
          discographySource: releases.length > 0 ? "registry_relational" : "metadata_json",
        },
      };
    }

    else if (path === "/artists" || path === "/artists/") {
      const { data: artists } = await supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, status, metadata").eq("status", "active").order("display_name", { ascending: true }).limit(500);
      data = { artists: (artists ?? []).map((a: any) => { const meta = (a.metadata || {}) as Record<string, unknown>; const artistGenres: string[] = Array.isArray(meta.genres) ? (meta.genres as string[]).map(String) : []; return { id: String(a.id), slug: String(a.slug), name: String(a.display_name), country: a.origin_iso2 || null, imageUrl: a.public_image_url || null, genres: artistGenres, trackCount: 0, releaseCount: 0, isChartArtist: true, isRising: false, topChartPosition: null }; }) };
    }

    else if (path.startsWith("/releases/")) {
      const relSegments = path.replace(/^\/releases\//, "").split("/").filter(Boolean);
      const relSlug = relSegments[relSegments.length - 1] || "";
      const { data: release } = await supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata, status, description").eq("slug", relSlug).in("status", ["active", "draft"]).maybeSingle();
      if (!release) return jsonResponse({ data: null }, 404);
      const releaseId = String(release.id);
      const releaseMeta = (release.metadata || {}) as Record<string, unknown>;

      const { data: releaseTracks } = await supabase.from("registry_release_tracks").select("track_id, track_number, disc_number").eq("release_id", releaseId).eq("status", "active").order("track_number", { ascending: true });

      let trackList: any[] = [];
      if (releaseTracks && releaseTracks.length > 0) {
        const trackIds = releaseTracks.map((rt: any) => String(rt.track_id));
        const { data: tracks } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, track_number, artwork_url").in("id", trackIds);
        const trackById = new Map((tracks ?? []).map((t: any) => [String(t.id), t]));
        trackList = releaseTracks.map((rt: any) => {
          const t = trackById.get(String(rt.track_id));
          if (!t) return null;
          return { id: String(t.id), slug: String(t.slug || t.id), title: String(t.title), artist: "Unknown", duration: Number(t.duration_ms || 0) / 1000, trackNumber: Number(rt.track_number || t.track_number || 0), artworkUrl: t.artwork_url || "" };
        }).filter(Boolean);
      } else {
        const { data: tracks } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, track_number, artwork_url").eq("release_id", releaseId).order("track_number", { ascending: true });
        trackList = (tracks ?? []).map((t: any) => ({ id: String(t.id), slug: String(t.slug || t.id), title: String(t.title), artist: "Unknown", duration: Number(t.duration_ms || 0) / 1000, trackNumber: t.track_number || 0, artworkUrl: t.artwork_url || "" }));
      }

      const { data: releaseArtists } = await supabase.from("registry_release_artists").select("artist_id, artist_name_text, is_primary, artist_slug").eq("release_id", releaseId).eq("status", "active").order("credit_order", { ascending: true }).limit(5);
      const primaryArtist = (releaseArtists ?? []).find((ra: any) => ra.is_primary) || (releaseArtists ?? [])[0];
      const artistName = primaryArtist ? String(primaryArtist.artist_name_text || primaryArtist.artist_slug || "Unknown") : "Unknown";

      const { data: label } = release.label_id ? await supabase.from("registry_labels").select("id, slug, name, country_code").eq("id", String(release.label_id)).maybeSingle() : { data: null };
      const totalDuration = trackList.reduce((sum: number, tr: any) => sum + (Number(tr.duration) || 0), 0);
      const labelName = label?.name || String(releaseMeta.wp_label || "Independent");

      let description = release.description || "";
      if (!description || description.trim().length === 0) {
        const rType = releaseTypeLabel(String(release.release_type || "album"));
        const niceDate = formatDateNicely(String(release.release_date || ""));
        const yearOnly = release.release_date ? String(release.release_date).split("-")[0] : "";
        let desc = release.title + " is " + articleize(rType) + " by " + artistName;
        if (niceDate && niceDate !== yearOnly) desc += ", released on " + niceDate;
        else if (yearOnly) desc += ", released in " + yearOnly;
        if (labelName && labelName !== "Independent" && labelName !== "Unknown") desc += " through " + labelName;
        desc += ".";
        description = desc;
        try { await supabase.from("registry_releases").update({ description }).eq("id", releaseId); } catch { /* ignore */ }
      }

      data = { release: { id: releaseId, slug: String(release.slug), title: String(release.title), artist: artistName, year: release.release_date ? String(release.release_date).split("-")[0] : "", releaseDate: release.release_date || "", releaseType: String(release.release_type || "album"), labelName, labelSlug: label?.slug || "", artworkUrl: release.artwork_url || "", trackCount: trackList.length, tracks: trackList, totalDuration, description, metadata: { ...releaseMeta, wpLabel: releaseMeta.wp_label || null, wpDistributor: releaseMeta.wp_distributor || null, wpWriters: releaseMeta.wp_writers || null, wpProducers: releaseMeta.wp_producers || null } } };
    }

    else if (path === "/releases" || path === "/releases/") {
      const { data: releases } = await supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, status, description").in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(200);
      const labelIds = (releases ?? []).map((r: any) => r.label_id).filter(Boolean).map(String);
      const { data: labels } = labelIds.length > 0 ? await supabase.from("registry_labels").select("id, name").in("id", [...new Set(labelIds)]) : { data: [] };
      const labelMap = new Map((labels ?? []).map((l: any) => [String(l.id), String(l.name)]));
      data = { releases: (releases ?? []).map((r: any) => ({ id: String(r.id), slug: String(r.slug), title: String(r.title), artist: labelMap.get(String(r.label_id)) || "Independent", year: r.release_date ? String(r.release_date).split("-")[0] : "", releaseType: String(r.release_type || "album"), labelName: labelMap.get(String(r.label_id)) || "Independent", artworkUrl: r.artwork_url || "", trackCount: 0, description: r.description || "" })) };
    }

    else if (path.startsWith("/genres/")) {
      const gSlug = path.replace(/^\/genres\//, "").replace(/\/$/, "");
      const { data: genre } = await supabase.from("registry_genres").select("id, slug, name, description, status").eq("slug", gSlug).eq("status", "active").maybeSingle();
      if (!genre) return jsonResponse({ data: null }, 404);
      const { data: artistGenreRows } = await supabase.from("wk_import_staging_records").select("mapped_record").eq("target_entity", "artist_genres").eq("target_status", "ready").filter("mapped_record->>genre_slug", "eq", gSlug);
      const artistSlugsFromStaging = [...new Set((artistGenreRows ?? []).map((r: any) => { const mr = (r.mapped_record || {}) as Record<string, unknown>; return String(mr.artist_slug || ""); }).filter(Boolean))];
      let registryArtists: any[] = [];
      if (artistSlugsFromStaging.length > 0) {
        const { data: regArtists } = await supabase.from("registry_artists").select("slug, display_name, public_image_url").in("slug", artistSlugsFromStaging).eq("status", "active").limit(18);
        registryArtists = regArtists ?? [];
      }
      let topTracks: any[] = [];
      if (artistSlugsFromStaging.length > 0) {
        const { data: entries } = await supabase.from("wk_chart_entries_v2").select("track_slug, track_title, artist_name, artwork_url, rank").in("artist_slug", artistSlugsFromStaging).order("rank", { ascending: true }).limit(24);
        topTracks = entries ?? [];
      }
      const { data: relatedGenres } = await supabase.from("registry_genres").select("slug, name").eq("status", "active").neq("slug", gSlug).limit(8);
      data = { genre: { id: String(genre.id), slug: String(genre.slug), name: String(genre.name), description: genre.description || null }, artists: registryArtists.map((a: any) => ({ slug: String(a.slug), name: String(a.display_name), imageUrl: a.public_image_url || "" })), topTracks: topTracks.map((t: any) => ({ slug: String(t.track_slug), title: String(t.track_title), artistName: String(t.artist_name), artworkUrl: t.artwork_url || "", peakRank: Number(t.rank) })), relatedGenres: (relatedGenres ?? []).map((g: any) => ({ slug: String(g.slug), name: String(g.name) })) };
    }

    else if (path === "/genres" || path === "/genres/") {
      const { data: genres } = await supabase.from("registry_genres").select("id, slug, name, description, status").eq("status", "active").order("name", { ascending: true });
      const { data: artistGenreAll } = await supabase.from("wk_import_staging_records").select("mapped_record").eq("target_entity", "artist_genres").eq("target_status", "ready");
      const genreArtistCounts = new Map();
      const genreRepresentatives = new Map();
      for (const r of (artistGenreAll ?? [])) { const mr = (r.mapped_record || {}) as Record<string, unknown>; const gs = String(mr.genre_slug || ""); const artistName = String(mr.artist_slug || "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()); if (gs) { genreArtistCounts.set(gs, (genreArtistCounts.get(gs) || 0) + 1); const existing = genreRepresentatives.get(gs) || []; if (existing.length < 4) existing.push(artistName); genreRepresentatives.set(gs, existing); } }
      data = { genres: (genres ?? []).map((g: any) => { const gs = String(g.slug); return { id: String(g.id), slug: gs, name: String(g.name), artistCount: genreArtistCounts.get(gs) || 0, trackCount: 0, representativeArtists: genreRepresentatives.get(gs) || [] }; }) };
    }

    else if (path.startsWith("/labels/")) {
      const lSlug = path.replace(/^\/labels\//, "").replace(/\/$/, "");
      const { data: label } = await supabase.from("registry_labels").select("id, slug, name, description, country_code, status").eq("slug", lSlug).eq("status", "active").maybeSingle();
      if (!label) return jsonResponse({ data: null }, 404);
      const { data: releases } = await supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url").eq("label_id", String(label.id)).in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(50);
      const releaseIds = (releases ?? []).map((r: any) => String(r.id));
      const { data: tracks } = releaseIds.length > 0 ? await supabase.from("registry_tracks").select("id, release_id, title, slug").in("release_id", releaseIds) : { data: [] };
      const releaseTrackCount = new Map();
      for (const t of (tracks ?? [])) { const rid = String(t.release_id); releaseTrackCount.set(rid, (releaseTrackCount.get(rid) || 0) + 1); }
      const uniqueTrackSlugs = [...new Set((tracks ?? []).map((t: any) => String(t.slug || t.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")).filter(Boolean))];
      const rosterMap = new Map();
      if (uniqueTrackSlugs.length > 0) {
        const { data: chartData } = await supabase.from("wk_chart_entries_v2").select("track_slug, artist_slug, artist_name, artwork_url").in("track_slug", uniqueTrackSlugs).limit(120);
        for (const c of (chartData ?? [])) { const aSlug = String(c.artist_slug || ""); if (aSlug && !rosterMap.has(aSlug)) rosterMap.set(aSlug, { slug: aSlug, name: String(c.artist_name || aSlug), artworkUrl: c.artwork_url || "" }); }
      }
      if (releaseIds.length > 0) {
        const { data: relArtists } = await supabase.from("registry_release_artists").select("artist_slug, artist_name_text, artist_id").in("release_id", releaseIds).eq("status", "active").eq("is_primary", true);
        for (const ra of (relArtists ?? [])) { const aSlug = String(ra.artist_slug || ""); if (aSlug && !rosterMap.has(aSlug)) rosterMap.set(aSlug, { slug: aSlug, name: String(ra.artist_name_text || aSlug), artworkUrl: "" }); }
      }
      const { data: relatedLabels } = await supabase.from("registry_labels").select("slug, name").eq("status", "active").neq("slug", lSlug).limit(8);
      data = { label: { id: String(label.id), slug: String(label.slug), name: String(label.name), description: label.description || null, countryCode: label.country_code || null }, roster: [...rosterMap.values()], releases: (releases ?? []).map((r: any) => ({ slug: String(r.slug), title: String(r.title), releaseDate: r.release_date || "", releaseType: String(r.release_type || "album"), artworkUrl: r.artwork_url || "", trackCount: releaseTrackCount.get(String(r.id)) || 0 })), relatedLabels: (relatedLabels ?? []).map((g: any) => ({ slug: String(g.slug), name: String(g.name) })) };
    }

    else if (path === "/labels" || path === "/labels/") {
      const { data: labels } = await supabase.from("registry_labels").select("id, slug, name, country_code, description, status").eq("status", "active").order("name", { ascending: true }).limit(500);
      data = { labels: (labels ?? []).map((l: any) => ({ id: String(l.id), slug: String(l.slug), name: String(l.name), country: l.country_code || null, logoUrl: null, artistCount: 0, releaseCount: 0, featuredArtists: [], isFeatured: false, description: l.description || null })) };
    }

    else if (path.startsWith("/tracks/")) {
      const tSegments = path.replace(/^\/tracks\//, "").split("/").filter(Boolean);
      const tSlug = tSegments[tSegments.length - 1] || "";
      let track: any = null;
      const isIsrcLookup = tSlug.toLowerCase().startsWith("isrc:");
      if (isIsrcLookup) {
        const isrc = tSlug.slice(5);
        const { data: byIsrc } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, isrc, explicit, track_number, disc_number, release_id, metadata, status").eq("isrc", isrc).order("status", { ascending: true }).order("slug", { ascending: true }).limit(1);
        track = byIsrc && byIsrc.length > 0 ? byIsrc[0] : null;
      } else {
        const { data: bySlug } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, isrc, explicit, track_number, disc_number, release_id, metadata, status").eq("slug", tSlug).maybeSingle();
        track = bySlug;
      }
      if (!track) return jsonResponse({ data: null }, 404);
      const trackId = String(track.id);
      const { data: release } = track.release_id ? await supabase.from("registry_releases").select("slug, title, release_date, release_type, artwork_url, label_id").eq("id", String(track.release_id)).maybeSingle() : { data: null };
      const { data: label } = release?.label_id ? await supabase.from("registry_labels").select("slug, name, country_code").eq("id", String(release.label_id)).maybeSingle() : { data: null };
      const { data: chartEntriesList } = await supabase.from("wk_chart_entries_v2").select("edition_id, rank, previous_rank, movement, track_title, artist_name, artwork_url").eq("canonical_track_id", trackId).order("rank", { ascending: true });
      const { data: historyEntries } = await supabase.from("wk_chart_entries_v2").select("rank, edition_id, movement").eq("canonical_track_id", trackId).order("rank", { ascending: true });
      let peakRank: number | null = null;
      if (historyEntries && historyEntries.length > 0) peakRank = Math.min(...historyEntries.map((e: any) => Number(e.rank || 0)).filter((r: number) => r > 0));
      const bestEntry = chartEntriesList && chartEntriesList.length > 0 ? chartEntriesList[0] : null;
      const artistName = bestEntry ? String(bestEntry.artist_name || "") : "Unknown";
      const artistSlugFromEntry = bestEntry ? (String(bestEntry.artist_name || "").split(",")[0] || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") : "";
      const chartHistory = (historyEntries ?? []).map((e: any) => Number(e.rank || 0));
      const chartHistoryUnique = chartHistory.filter((r: number, i: number) => chartHistory.indexOf(r) === i).slice(0, 52);
      const allChartAppearances = (chartEntriesList ?? []).map((e: any) => ({ editionSlug: String(e.edition_id || ""), editionLabel: String(e.edition_id || ""), date: "", rank: Number(e.rank || 0), previousRank: e.previous_rank != null ? Number(e.previous_rank) : null, movement: String(e.movement || "same") }));
      const prevRank = bestEntry && bestEntry.previous_rank != null ? Number(bestEntry.previous_rank) : null;
      const rawMovement = String(bestEntry?.movement || "").toLowerCase();
      let movement: string = ["up", "down", "new", "same"].includes(rawMovement) ? rawMovement : "same";
      let movementAmount = 0;
      if (bestEntry) {
        const curr = Number(bestEntry.rank || 0);
        if (!rawMovement) { if (!prevRank || prevRank <= 0) movement = "new"; else if (curr > 0 && curr < prevRank) { movement = "up"; movementAmount = prevRank - curr; } else if (curr > 0 && curr > prevRank) { movement = "down"; movementAmount = curr - prevRank; } }
        else if (prevRank && curr > 0) movementAmount = Math.abs(prevRank - curr);
      }
      data = { track: { id: String(track.id), slug: String(track.slug), title: String(track.title), durationMs: track.duration_ms || 0, artworkUrl: track.artwork_url || "", isrc: track.isrc || null, explicit: track.explicit || false, trackNumber: track.track_number || 0, discNumber: track.disc_number || 0, metadata: track.metadata || {}, status: track.status || "active" }, artist: { slug: artistSlugFromEntry, name: artistName, imageUrl: bestEntry?.artwork_url || "" }, release: release ? { slug: String(release.slug), title: String(release.title), releaseDate: release.release_date || "", releaseType: String(release.release_type || "single"), artworkUrl: release.artwork_url || "" } : null, label: label ? { slug: String(label.slug), name: String(label.name), countryCode: label.country_code || null } : null, genres: [], chartHistory: chartHistoryUnique, chartAppearances: allChartAppearances, chartAppearanceCount: allChartAppearances.length, peakRank, weeksOnChart: historyEntries ? historyEntries.length : 0, currentRank: bestEntry ? Number(bestEntry.rank) : null, previousRank: prevRank, movement, movementAmount };
    }

    else if (path === "/charts" || path === "/charts/") {
      const { data: programs } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, source_family_slug, series_slug, market_slug, chart_size, default_period_type, default_methodology_version").order("public_label", { ascending: true });
      const programsWithEditions = await Promise.all((programs ?? []).map(async (p: any) => {
        const { data: editions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", p.id).eq("status", "published").order("edition_date", { ascending: false });
        const latestEdition = editions && editions.length > 0 ? { id: String(editions[0].edition_slug), slug: String(editions[0].edition_slug), label: String(editions[0].edition_label), date: String(editions[0].edition_date), periodStart: editions[0].period_start || null, periodEnd: editions[0].period_end || null, entryCount: editions[0].entry_count || 0 } : null;
        return { id: String(p.id), publicSlug: String(p.public_slug), publicLabel: String(p.public_label), shortLabel: String(p.public_label), sourceFamilySlug: String(p.source_family_slug || p.public_slug), seriesSlug: String(p.series_slug || ""), seriesLabel: String(p.series_slug || ""), marketSlug: String(p.market_slug || ""), marketLabel: String(p.market_slug || ""), periodType: String(p.default_period_type || "weekly"), methodologyVersion: String(p.default_methodology_version || "legacy-import-v1"), eligibilityRulesVersion: "legacy-import-v1", latestEdition, archive: (editions ?? []).map((e: any) => ({ id: String(e.edition_slug), slug: String(e.edition_slug), label: String(e.edition_label), date: String(e.edition_date), periodStart: e.period_start || null, periodEnd: e.period_end || null, entryCount: e.entry_count || 0 })) };
      }));
      data = { programs: programsWithEditions };
    }

    else if (path.startsWith("/charts/")) {
      const chartPath = path.replace(/^\/charts\//, "");
      const segments = chartPath.split("/").filter(Boolean);
      if (segments.length === 1) {
        const slug = segments[0];
        const { data: program } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, source_family_slug, series_slug, market_slug, chart_size, default_period_type, default_methodology_version").eq("public_slug", slug).maybeSingle();
        if (!program) return jsonResponse({ error: "Not found" }, 404);
        const { data: editions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", program.id).eq("status", "published").order("edition_date", { ascending: false });
        const latestEdition = editions && editions.length > 0 ? { id: String(editions[0].edition_slug), slug: String(editions[0].edition_slug), label: String(editions[0].edition_label), date: String(editions[0].edition_date), periodStart: editions[0].period_start || null, periodEnd: editions[0].period_end || null, entryCount: editions[0].entry_count || 0 } : null;
        data = { program: { id: String(program.id), publicSlug: String(program.public_slug), publicLabel: String(program.public_label), shortLabel: String(program.public_label), sourceFamilySlug: String(program.source_family_slug || program.public_slug), seriesSlug: String(program.series_slug || ""), seriesLabel: String(program.series_slug || ""), marketSlug: String(program.market_slug || ""), marketLabel: String(program.market_slug || ""), periodType: String(program.default_period_type || "weekly"), methodologyVersion: String(program.default_methodology_version || "legacy-import-v1"), eligibilityRulesVersion: "legacy-import-v1", latestEdition, archive: (editions ?? []).map((e: any) => ({ id: String(e.edition_slug), slug: String(e.edition_slug), label: String(e.edition_label), date: String(e.edition_date), periodStart: e.period_start || null, periodEnd: e.period_end || null, entryCount: e.entry_count || 0 })) } };
      }
      else if (segments.length === 2) {
        const [slug, second] = segments;
        const { data: program } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, source_family_slug, series_slug, market_slug, chart_size, default_period_type, default_methodology_version").eq("public_slug", slug).maybeSingle();
        if (!program) return jsonResponse({ error: "Not found" }, 404);
        const programVM = { id: String(program.id), publicSlug: String(program.public_slug), publicLabel: String(program.public_label), seriesSlug: String(program.series_slug || ""), seriesLabel: String(program.series_slug || ""), marketSlug: String(program.market_slug || ""), marketLabel: String(program.market_slug || ""), sourceFamilySlug: String(program.source_family_slug || program.public_slug) };
        if (second === "latest") {
          const { data: editions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", program.id).eq("status", "published").order("edition_date", { ascending: false }).limit(1);
          const latestEdition = editions && editions.length > 0 ? { id: String(editions[0].edition_slug), slug: String(editions[0].edition_slug), label: String(editions[0].edition_label), date: String(editions[0].edition_date), periodStart: editions[0].period_start || null, periodEnd: editions[0].period_end || null, entryCount: editions[0].entry_count || 0 } : null;
          data = { edition: latestEdition, program: programVM };
        } else {
          const { data: edition } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", program.id).eq("edition_slug", second).maybeSingle();
          data = { edition: edition ? { id: String(edition.edition_slug), slug: String(edition.edition_slug), label: String(edition.edition_label), date: String(edition.edition_date), periodStart: edition.period_start || null, periodEnd: edition.period_end || null, entryCount: edition.entry_count || 0 } : null, program: programVM };
        }
      }
      else if (segments.length === 3 && segments[2] === "entries") {
        const [slug, editionSlug] = segments;
        const { data: program } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, series_slug, market_slug, source_family_slug").eq("public_slug", slug).maybeSingle();
        if (!program) return jsonResponse({ error: "Not found" }, 404);
        const { data: edition } = await supabase.from("wk_chart_editions_v2").select("id, edition_slug, edition_label, edition_date, entry_count, status").eq("program_id", program.id).eq("edition_slug", editionSlug).maybeSingle();
        if (!edition) return jsonResponse({ error: "Edition not found" }, 404);
        const { data: entries } = await supabase.from("wk_chart_entries_v2").select("id, rank, previous_rank, movement, track_slug, track_title, artist_name, artwork_url, total_score").eq("edition_id", edition.id).order("rank", { ascending: true }).limit(150);
        const entryList = (entries ?? []).map((e: any) => ({ id: String(e.id), rank: Number(e.rank || 0), previousRank: e.previous_rank != null ? Number(e.previous_rank) : null, movement: String(e.movement || "same"), trackSlug: String(e.track_slug || ""), trackTitle: String(e.track_title || ""), artistNames: String(e.artist_name || "").split(",").map((s: string) => s.trim()).filter(Boolean), artistSlugs: String(e.artist_name || "").split(",").map((s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")).filter(Boolean), artworkUrl: e.artwork_url || null, score: e.total_score != null ? Number(e.total_score) : null, sourceEntryId: String(e.id) }));
        data = { entries: entryList };
      }
      else { return jsonResponse({ error: "Not found" }, 404); }
    }

    else {
      return jsonResponse({ error: "Not found" }, 404);
    }

    return jsonResponse({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
