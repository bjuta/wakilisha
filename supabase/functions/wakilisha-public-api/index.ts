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

function makeUrlSafe(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawPath = url.pathname;
  const path = normalizePath(rawPath);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let data: unknown;

    // ── MAGAZINE SITE CONTENT AGGREGATION ──
    if (path === "/magazine/site-content" || path === "/magazine/site-content/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 200;

      const [articleResult, artistResult, releaseResult, chartResult] = await Promise.all([
        supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(limit),
        supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, metadata, status").eq("status", "active").order("display_name", { ascending: true }).limit(50),
        supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, description, status").in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(30),
        supabase.from("chart_entries").select("rank, track_title, track_slug, artist_name, artwork_url, edition_id").order("rank", { ascending: true }).limit(20),
      ]);

      const articles = (articleResult.data ?? []).map((a: any) => {
        const catNames = parseCategoryNames(a.categories);
        const section = catNames.length > 0 ? catNames[0] : "Music";
        const contentText = stripHtml(String(a.content_html || ""));
        const seoMeta = (a.seo || {}) as Record<string, unknown>;
        const dek = a.excerpt ? String(a.excerpt) : (seoMeta.yoast_metadesc ? String(seoMeta.yoast_metadesc) : (contentText ? contentText.substring(0, 140) + "..." : ""));
        const tagNames = parseTagNames(a.tags);
        let heroUrl = String(a.hero_image_url || "");
        if (!heroUrl && a.content_html) heroUrl = extractFirstImgSrc(String(a.content_html));
        return {
          contentType: "article" as const,
          id: String(a.id), slug: String(a.slug), title: String(a.title),
          section, dek, author: String(a.author || "Wakilisha"),
          date: a.published_at ? String(a.published_at).split("T")[0] : "",
          readingTime: Math.max(1, Math.ceil(contentText.length / 1500)),
          heroUrl, tags: tagNames,
        };
      });

      const artists = (artistResult.data ?? []).map((a: any) => {
        const meta = (a.metadata || {}) as Record<string, unknown>;
        const genresArr = meta.genres;
        const artistGenres: string[] = Array.isArray(genresArr) ? genresArr.map(String) : [];
        return {
          contentType: "artist" as const,
          id: String(a.id), slug: String(a.slug), title: String(a.display_name),
          section: artistGenres[0] || "Artist", dek: artistGenres.slice(0, 3).join(" / ") || "Artist in the registry",
          author: "", date: "", readingTime: 0,
          heroUrl: String(a.public_image_url || ""), tags: artistGenres,
          originIso2: a.origin_iso2 || null,
        };
      });

      const releases = (releaseResult.data ?? []).map((r: any) => ({
        contentType: "release" as const,
        id: String(r.id), slug: String(r.slug), title: String(r.title),
        section: String(r.release_type || "Release"), dek: r.description || "",
        author: "", date: r.release_date ? String(r.release_date).split("T")[0] : "",
        readingTime: 0, heroUrl: String(r.artwork_url || ""), tags: [],
        releaseType: String(r.release_type || "album"),
      }));

      const chartHighlights = (chartResult.data ?? []).map((c: any) => ({
        contentType: "chart_entry" as const,
        id: String(c.track_slug || c.edition_id), slug: String(c.track_slug || ""),
        title: String(c.track_title || ""),
        section: "Chart Entry", dek: `#${c.rank} · ${c.artist_name || ""}`,
        author: String(c.artist_name || ""), date: "", readingTime: 0,
        heroUrl: String(c.artwork_url || ""), tags: [],
        rank: Number(c.rank), artistName: String(c.artist_name || ""),
      }));

      data = { articles, artists, releases, chartHighlights };
    }

    // ── MAGAZINE PUBLIC ISSUE ──
    else if (path.startsWith("/magazine/public/issues/")) {
      const issueSlug = path.replace(/^\/magazine\/public\/issues\//, "").replace(/\/$/, "");

      const { data: issue } = await supabase
        .from("wk_magazine_issues")
        .select("*")
        .eq("slug", issueSlug)
        .eq("status", "published")
        .maybeSingle();

      if (!issue) return jsonResponse({ data: null, meta: { reason: "not_found_or_not_published" } }, 404);

      const { data: sections } = await supabase
        .from("wk_magazine_issue_sections")
        .select("*")
        .eq("issue_id", String(issue.id))
        .order("sort_order", { ascending: true });

      const { data: entities } = await supabase
        .from("wk_magazine_issue_entities")
        .select("*")
        .eq("issue_id", String(issue.id))
        .order("sort_order", { ascending: true });

      const visualAssetIds = (sections ?? [])
        .map((s: any) => s.visual_asset_id)
        .filter(Boolean) as string[];

      let visualAssets: any[] = [];
      if (visualAssetIds.length > 0) {
        const { data: visuals } = await supabase
          .from("wk_magazine_visual_assets")
          .select("*")
          .in("id", visualAssetIds)
          .in("status", ["approved", "locked"]);
        visualAssets = visuals ?? [];
      }

      data = {
        issue: {
          id: String(issue.id),
          slug: String(issue.slug),
          title: String(issue.title),
          dek: issue.dek || null,
          status: String(issue.status),
          timeframeStart: issue.timeframe_start || null,
          timeframeEnd: issue.timeframe_end || null,
          issueType: String(issue.issue_type),
          visualFamily: issue.visual_family || null,
          treatment: issue.treatment || null,
          palette: issue.palette || null,
          contrastMode: issue.contrast_mode || null,
          createdBy: String(issue.created_by),
          publishedAt: issue.published_at || null,
        },
        sections: (sections ?? []).map((s: any) => ({
          id: String(s.id),
          spreadId: String(s.spread_id),
          sectionType: String(s.section_type),
          title: String(s.title),
          deck: s.deck || null,
          body: s.body || null,
          layout: String(s.layout),
          sortOrder: Number(s.sort_order),
          status: String(s.status),
          visualAssetId: s.visual_asset_id || null,
        })),
        entities: (entities ?? []).map((e: any) => ({
          id: String(e.id),
          sectionId: e.section_id || null,
          entityType: String(e.entity_type),
          entityId: String(e.entity_id),
          role: String(e.role),
          selectionState: String(e.selection_state),
          sortOrder: Number(e.sort_order),
          sourceReason: e.source_reason || null,
        })),
        visualAssets: visualAssets.map((v: any) => ({
          id: String(v.id),
          spreadId: String(v.spread_id),
          visualFamily: String(v.visual_family),
          visualType: String(v.visual_type),
          editorialIntent: String(v.editorial_intent),
          treatment: String(v.treatment),
          palette: String(v.palette),
          contrastMode: String(v.contrast_mode),
          status: String(v.status),
        })),
      };
    }

    // ── ARTICLE DETAIL ──
    else if (path.startsWith("/magazine/") && path !== "/magazine" && path !== "/magazine/") {
      const slug = path.replace(/^\/magazine\//, "").replace(/\/$/, "");

      const { data: article } = await supabase
        .from("wk_articles")
        .select("id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, hero_image_url, seo, wp_status")
        .eq("slug", slug)
        .maybeSingle();

      if (!article) return jsonResponse({ data: null }, 404);

      const contentText = stripHtml(String(article.content_html || ""));
      const seoMeta = (article.seo || {}) as Record<string, unknown>;
      const catNames = parseCategoryNames(article.categories);
      const section = catNames.length > 0 ? catNames[0] : "Music";
      const tagsArr = parseTagNames(article.tags);

      let heroUrl = String(article.hero_image_url || "");
      if (!heroUrl && article.content_html) {
        heroUrl = extractFirstImgSrc(String(article.content_html));
      }

      const dek = article.excerpt
        ? String(article.excerpt)
        : (seoMeta.yoast_metadesc ? String(seoMeta.yoast_metadesc) : (contentText ? contentText.substring(0, 200) + "..." : ""));

      data = {
        article: {
          id: String(article.id),
          slug: String(article.slug),
          title: String(article.title),
          section,
          dek,
          author: String(article.author || "Wakilisha"),
          date: article.published_at ? String(article.published_at).split("T")[0] : "",
          readingTime: Math.max(1, Math.ceil(contentText.length / 1500)),
          heroUrl,
          contentHtml: String(article.content_html || ""),
          tags: tagsArr,
          seo: seoMeta,
          categories: catNames,
        },
      };
    }

    // ── MAGAZINE LISTING ──
    else if (path === "/magazine" || path === "/magazine/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 500;

      const { data: articles } = await supabase
        .from("wk_articles")
        .select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo")
        .eq("wp_status", "publish")
        .order("published_at", { ascending: false })
        .limit(limit);

      data = {
        stories: (articles ?? []).map((a: any) => {
          const catNames = parseCategoryNames(a.categories);
          const section = catNames.length > 0 ? catNames[0] : "Music";
          const contentText = stripHtml(String(a.content_html || ""));
          const seoMeta = (a.seo || {}) as Record<string, unknown>;
          const dek = a.excerpt ? String(a.excerpt) : (seoMeta.yoast_metadesc ? String(seoMeta.yoast_metadesc) : (contentText ? contentText.substring(0, 140) + "..." : ""));
          const tagNames = parseTagNames(a.tags);

          let heroUrl = String(a.hero_image_url || "");
          if (!heroUrl && a.content_html) {
            heroUrl = extractFirstImgSrc(String(a.content_html));
          }

          return {
            id: String(a.id),
            slug: String(a.slug),
            title: String(a.title),
            section,
            dek,
            author: String(a.author || "Wakilisha"),
            date: a.published_at ? String(a.published_at).split("T")[0] : "",
            readingTime: Math.max(1, Math.ceil(contentText.length / 1500)),
            heroUrl,
            tags: tagNames,
          };
        }),
      };
    }

    // ── ARTIST DETAIL ──
    else if (path.startsWith("/artists/")) {
      const slug = path.replace(/^\/artists\//, "").replace(/\/$/, "");

      const { data: artist } = await supabase
        .from("registry_artists")
        .select("id, slug, display_name, origin_iso2, public_image_url, bio, status, metadata")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (!artist) return jsonResponse({ data: null }, 404);

      const meta = (artist.metadata || {}) as Record<string, unknown>;
      const displayName = String(artist.display_name || "");

      const socialInstagram = String(meta.social_instagram || meta.instagram_url || "");
      const socialSpotify = String(meta.social_spotify || "");
      const youtubeChannel = String(meta.youtube_channel || "");
      const spotifyImage = String(meta.spotify_image || meta.portrait_image || "");

      const genresArr = meta.genres;
      const genres: string[] = [];
      if (Array.isArray(genresArr)) {
        for (const g of genresArr as string[]) genres.push(String(g));
      }
      if (meta.country) genres.push(String(meta.country));

      const albums: any[] = [];
      const metaAlbums = meta.studio_albums;
      if (Array.isArray(metaAlbums)) {
        for (const al of metaAlbums as any[]) {
          albums.push({
            slug: makeUrlSafe(String(al.title || "")),
            title: String(al.title || ""),
            releaseType: "Album",
            year: extractYear(String(al.release_date || al.year || "")),
            releaseDate: al.release_date || "",
            trackCount: Number(al.track_count || al.trackCount || 0),
            artworkUrl: String(al.image || al.artwork || al.artworkUrl || al.artwork_url || ""),
            tracks: Array.isArray(al.tracks) ? al.tracks.map((tr: any) => ({
              title: String(tr.title || ""),
              duration: String(tr.duration || ""),
            })) : [],
          });
        }
      }

      const eps: any[] = [];
      const metaEps = meta.eps_compilations;
      if (Array.isArray(metaEps)) {
        for (const ep of metaEps as any[]) {
          eps.push({
            slug: makeUrlSafe(String(ep.title || "")),
            title: String(ep.title || ""),
            releaseType: "EP",
            year: extractYear(String(ep.release_date || ep.year || "")),
            releaseDate: ep.release_date || "",
            trackCount: Number(ep.track_count || ep.trackCount || 0),
            artworkUrl: String(ep.image || ep.artwork || ep.artworkUrl || ep.artwork_url || ""),
            tracks: Array.isArray(ep.tracks) ? ep.tracks.map((tr: any) => ({
              title: String(tr.title || ""),
              duration: String(tr.duration || ""),
            })) : [],
          });
        }
      }

      const topSongs: any[] = [];
      const metaSongs = meta.top_songs;
      if (Array.isArray(metaSongs)) {
        for (const s of metaSongs as any[]) {
          topSongs.push({
            title: String(s.title || ""),
            artists: String(s.artists || s.artist || ""),
            image: String(s.image || s.artwork || s.artworkUrl || s.artwork_url || ""),
            duration: String(s.duration || s.runtime || ""),
            songUrl: String(s.song_url || s.songUrl || s.url || ""),
          });
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
          if (ytMatch) {
            const videoId = ytMatch[1];
            videos.push({
              id: videoId, title: "Video",
              url: "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1",
              thumbnail: "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg",
              platform: "youtube",
            });
          }
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
              if (ytMatch) {
                const videoId = ytMatch[1];
                videos.push({
                  id: videoId, title: String(vid.title || "Video"),
                  url: "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1",
                  thumbnail: "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg",
                  platform: "youtube",
                });
              }
            }
          } catch { /* ignore */ }
        }
      }

      const { data: chartEntriesBySlug } = await supabase
        .from("chart_entries")
        .select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name")
        .eq("artist_slug", slug)
        .order("rank", { ascending: true })
        .limit(50);

      let chartEntries = chartEntriesBySlug ?? [];
      if (chartEntries.length === 0 && displayName) {
        const { data: chartEntriesByName } = await supabase
          .from("chart_entries")
          .select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name")
          .ilike("artist_name", displayName)
          .order("rank", { ascending: true })
          .limit(50);
        chartEntries = chartEntriesByName ?? [];
      }

      const chartEntryList = chartEntries.map((e: any) => {
        const prev = Number(e.previous_rank || 0);
        const curr = Number(e.rank || 0);
        let movement: string = String(e.movement || "same");
        let movementAmount = 0;
        if (prev > 0 && curr > 0) {
          if (curr < prev) { movement = "up"; movementAmount = prev - curr; }
          else if (curr > prev) { movement = "down"; movementAmount = curr - prev; }
        }
        return {
          rank: curr, title: String(e.track_title || ""), artist: String(e.artist_name || ""),
          slug: String(e.track_slug || ""), movement, movementAmount, peakPosition: curr,
          weeksOnChart: 1, artworkUrl: e.artwork_url || "",
        };
      });

      const relatedArtists: any[] = [];

      const metaRelated = meta.related_artists;
      if (Array.isArray(metaRelated) && metaRelated.length > 0) {
        const relatedSlugs: string[] = [];
        for (const rel of metaRelated as any[]) {
          const relSlug = String(rel.slug || "");
          if (relSlug && !relatedSlugs.includes(relSlug)) relatedSlugs.push(relSlug);
        }
        if (relatedSlugs.length > 0) {
          const { data: relatedRegistry } = await supabase
            .from("registry_artists")
            .select("slug, display_name, public_image_url")
            .in("slug", relatedSlugs.slice(0, 10))
            .eq("status", "active");
          const imageMap = new Map<string, string>();
          for (const rr of (relatedRegistry ?? [])) {
            imageMap.set(String(rr.slug), rr.public_image_url || "");
          }
          for (const rel of (metaRelated as any[]).slice(0, 10)) {
            const relSlug = String(rel.slug || "");
            if (!relSlug) continue;
            const sharedTracksRaw = rel.shared_tracks;
            let sharedTracks: string[] = [];
            if (typeof sharedTracksRaw === "string") {
              try { sharedTracks = JSON.parse(sharedTracksRaw); } catch { sharedTracks = []; }
            } else if (Array.isArray(sharedTracksRaw)) {
              sharedTracks = sharedTracksRaw.map(String);
            }
            relatedArtists.push({
              slug: relSlug,
              name: String(rel.name || relSlug),
              imageUrl: imageMap.get(relSlug) || "",
              score: Number(rel.score || 0),
              sharedTracks,
              featuresThem: Number(rel.features_them || 0),
              theyFeature: Number(rel.they_feature || 0),
            });
          }
        }
      }

      if (relatedArtists.length === 0) {
        const { data: artistIdRow } = await supabase
          .from("wk_import_staging_records")
          .select("raw_record")
          .eq("source_entity", "mysql.wkcharts_artists")
          .filter("raw_record->>slug", "eq", slug)
          .maybeSingle();

        const internalArtistId = artistIdRow?.raw_record?.id;

        if (internalArtistId) {
          const { data: relRows } = await supabase
            .from("wk_import_staging_records")
            .select("raw_record")
            .eq("source_entity", "mysql.wkcharts_artist_relations")
            .or(`raw_record->>artist_id.eq.${internalArtistId},raw_record->>related_artist_id.eq.${internalArtistId}`)
            .order("raw_record->>score", { ascending: false })
            .limit(15);

          if (relRows && relRows.length > 0) {
            const relatedIds = new Set<string>();
            const relDataMap = new Map<string, any>();

            for (const row of relRows) {
              const rec = row.raw_record as Record<string, unknown>;
              const aId = String(rec.artist_id || "");
              const rId = String(rec.related_artist_id || "");
              const otherId = aId === String(internalArtistId) ? rId : aId;

              if (!relatedIds.has(otherId)) {
                relatedIds.add(otherId);
                let sharedTitles: string[] = [];
                try {
                  const raw = String(rec.sample_titles_json || "[]");
                  sharedTitles = JSON.parse(raw);
                } catch { sharedTitles = []; }

                relDataMap.set(otherId, {
                  score: Number(rec.score || 0),
                  sharedTracksAll: Number(rec.shared_tracks_all || 0),
                  sharedChartTracks: Number(rec.shared_chart_tracks || 0),
                  featuresThem: Number(rec.artist_features_them || 0),
                  theyFeature: Number(rec.they_feature_artist || 0),
                  sharedTitles,
                });
              }
            }

            const idList = [...relatedIds];
            const { data: artistRows } = await supabase
              .from("wk_import_staging_records")
              .select("raw_record")
              .eq("source_entity", "mysql.wkcharts_artists")
              .in("raw_record->>id", idList);

            const idToSlug = new Map<string, string>();
            const slugs: string[] = [];
            for (const ar of (artistRows ?? [])) {
              const rec = ar.raw_record as Record<string, unknown>;
              const aid = String(rec.id || "");
              const aslug = String(rec.slug || "");
              if (aid && aslug) {
                idToSlug.set(aid, aslug);
                slugs.push(aslug);
              }
            }

            if (slugs.length > 0) {
              const { data: regArtists } = await supabase
                .from("registry_artists")
                .select("slug, display_name, public_image_url")
                .in("slug", slugs)
                .eq("status", "active");

              const registryMap = new Map<string, { name: string; imageUrl: string }>();
              for (const ra of (regArtists ?? [])) {
                registryMap.set(String(ra.slug), {
                  name: String(ra.display_name),
                  imageUrl: String(ra.public_image_url || ""),
                });
              }

              for (const [artistIdKey, relData] of relDataMap) {
                const resolvedSlug = idToSlug.get(artistIdKey);
                if (!resolvedSlug) continue;
                const regData = registryMap.get(resolvedSlug);
                if (!regData) continue;

                relatedArtists.push({
                  slug: resolvedSlug,
                  name: regData.name,
                  imageUrl: regData.imageUrl,
                  score: relData.score,
                  sharedTracksAll: relData.sharedTracksAll,
                  sharedChartTracks: relData.sharedChartTracks,
                  featuresThem: relData.featuresThem,
                  theyFeature: relData.theyFeature,
                  sharedTitles: relData.sharedTitles,
                });
              }
            }
          }
        }
      }

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
            slug: String(sc.slug), name: String(sc.display_name), imageUrl: sc.public_image_url || "",
          });
        }
      }

      if (relatedArtists.length === 0 && meta.country) {
        const countryCode = String(meta.country).substring(0, 2).toUpperCase();
        const { data: sameCountry } = await supabase
          .from("registry_artists")
          .select("slug, display_name, public_image_url")
          .eq("origin_iso2", countryCode)
          .eq("status", "active")
          .neq("slug", slug)
          .limit(6);
        for (const sc of (sameCountry ?? [])) {
          relatedArtists.push({
            slug: String(sc.slug), name: String(sc.display_name), imageUrl: sc.public_image_url || "",
          });
        }
      }

      const followerCount = meta.spotify_followers ? Number(meta.spotify_followers) : 0;
      const popularity = meta.spotify_popularity ? Number(meta.spotify_popularity) : 0;
      const country = String(meta.country || artist.origin_iso2 || "");
      const heroImage = String(meta.portrait_image || artist.public_image_url || spotifyImage || "");

      const releases = [...albums, ...eps];
      const trackCount = releases.reduce((sum: number, r: any) => sum + (Number(r.trackCount) || 0), 0);
      const isChartArtist = chartEntryList.length > 0;
      const topChartPosition = isChartArtist ? Math.min(...chartEntryList.map((e: any) => Number(e.rank))) : null;

      data = {
        artist: {
          id: String(artist.id), slug: String(artist.slug), name: displayName, country,
          imageUrl: heroImage || artist.public_image_url || "",
          profileImageUrl: heroImage || artist.public_image_url || "",
          genres, trackCount, releaseCount: releases.length, isChartArtist,
          isRising: popularity > 0 && popularity < 40, topChartPosition,
          bio: shortBio || displayName + " is an artist in the WAKILISHA registry.",
          fullBio: fullBio || wpBio || "",
          artistType: String(artist.gender || meta.gender || ""),
          followerCount, popularity,
          spotifyUrl: meta.spotify_artist_id ? "https://open.spotify.com/artist/" + meta.spotify_artist_id : socialSpotify || "",
          instagram: socialInstagram,
          youtubeChannel,
          chartEntries: chartEntryList, releases, topSongs, relatedArtists, videos,
        },
      };
    }

    // ── ARTISTS LISTING ──
    else if (path === "/artists" || path === "/artists/") {
      const { data: artists } = await supabase
        .from("registry_artists")
        .select("id, slug, display_name, origin_iso2, public_image_url, status, metadata")
        .eq("status", "active")
        .order("display_name", { ascending: true })
        .limit(500);
      data = {
        artists: (artists ?? []).map((a: any) => {
          const meta = (a.metadata || {}) as Record<string, unknown>;
          const genresArr = meta.genres;
          const artistGenres: string[] = [];
          if (Array.isArray(genresArr)) {
            for (const g of genresArr as string[]) artistGenres.push(String(g));
          }
          return {
            id: String(a.id), slug: String(a.slug), name: String(a.display_name),
            country: a.origin_iso2 || null, imageUrl: a.public_image_url || null,
            genres: artistGenres, trackCount: 0, releaseCount: 0, isChartArtist: true, isRising: false, topChartPosition: null,
          };
        }),
      };
    }

    // ── RELEASE DETAIL ──
    else if (path.startsWith("/releases/")) {
      const relSegments = path.replace(/^\/releases\//, "").split("/").filter(Boolean);
      const relSlug = relSegments[relSegments.length - 1] || "";

      const { data: release } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata, status, description")
        .eq("slug", relSlug)
        .in("status", ["active", "draft"])
        .maybeSingle();
      if (!release) return jsonResponse({ data: null }, 404);

      const releaseId = String(release.id);
      const releaseMeta = (release.metadata || {}) as Record<string, unknown>;

      const { data: tracks } = await supabase
        .from("registry_tracks")
        .select("id, slug, title, duration_ms, track_number, artwork_url")
        .eq("release_id", releaseId)
        .order("track_number", { ascending: true });

      const { data: label } = release.label_id
        ? await supabase.from("registry_labels").select("id, slug, name, country_code").eq("id", String(release.label_id)).maybeSingle()
        : { data: null };

      const trackList = (tracks ?? []).map((t: any) => ({
        id: String(t.id), slug: String(t.slug || t.id), title: String(t.title),
        artist: "Unknown", duration: Number(t.duration_ms || 0) / 1000,
        trackNumber: t.track_number || 0, artworkUrl: t.artwork_url || "",
      }));

      const totalDuration = trackList.reduce((sum: number, tr: any) => sum + (Number(tr.duration) || 0), 0);
      const artistName = label?.name || "Unknown";
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

      data = {
        release: {
          id: releaseId, slug: String(release.slug), title: String(release.title),
          artist: artistName, year: release.release_date ? String(release.release_date).split("-")[0] : "",
          releaseDate: release.release_date || "", releaseType: String(release.release_type || "album"),
          labelName, labelSlug: label?.slug || "",
          artworkUrl: release.artwork_url || "", trackCount: trackList.length,
          tracks: trackList, totalDuration, description,
          metadata: { ...releaseMeta, wpLabel: releaseMeta.wp_label || null, wpDistributor: releaseMeta.wp_distributor || null, wpWriters: releaseMeta.wp_writers || null, wpProducers: releaseMeta.wp_producers || null },
        },
      };
    }

    // ── RELEASES LISTING ──
    else if (path === "/releases" || path === "/releases/") {
      const { data: releases } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_date, release_type, artwork_url, label_id, status, description")
        .in("status", ["active", "draft"])
        .order("release_date", { ascending: false })
        .limit(200);
      const labelIds = (releases ?? []).map((r: any) => r.label_id).filter(Boolean).map(String);
      const { data: labels } = labelIds.length > 0
        ? await supabase.from("registry_labels").select("id, name").in("id", [...new Set(labelIds)])
        : { data: [] };
      const labelMap = new Map((labels ?? []).map((l: any) => [String(l.id), String(l.name)]));
      data = {
        releases: (releases ?? []).map((r: any) => ({
          id: String(r.id), slug: String(r.slug), title: String(r.title),
          artist: labelMap.get(String(r.label_id)) || "Independent",
          year: r.release_date ? String(r.release_date).split("-")[0] : "",
          releaseType: String(r.release_type || "album"),
          labelName: labelMap.get(String(r.label_id)) || "Independent",
          artworkUrl: r.artwork_url || "", trackCount: 0, description: r.description || "",
        })),
      };
    }

    // ── GENRE DETAIL ──
    else if (path.startsWith("/genres/")) {
      const gSlug = path.replace(/^\/genres\//, "").replace(/\/$/, "");
      const { data: genre } = await supabase
        .from("registry_genres").select("id, slug, name, description, status")
        .eq("slug", gSlug).eq("status", "active").maybeSingle();
      if (!genre) return jsonResponse({ data: null }, 404);

      const { data: artistGenreRows } = await supabase
        .from("wk_import_staging_records")
        .select("mapped_record")
        .eq("target_entity", "artist_genres")
        .eq("target_status", "ready")
        .filter("mapped_record->>genre_slug", "eq", gSlug);

      const artistSlugsFromStaging = [...new Set((artistGenreRows ?? []).map((r: any) => {
        const mr = (r.mapped_record || {}) as Record<string, unknown>;
        return String(mr.artist_slug || "");
      }).filter(Boolean))];

      let registryArtists: any[] = [];
      if (artistSlugsFromStaging.length > 0) {
        const { data: regArtists } = await supabase
          .from("registry_artists").select("slug, display_name, public_image_url")
          .in("slug", artistSlugsFromStaging).eq("status", "active").limit(18);
        registryArtists = regArtists ?? [];
      }

      let topTracks: any[] = [];
      if (artistSlugsFromStaging.length > 0) {
        const { data: entries } = await supabase
          .from("chart_entries").select("track_slug, track_title, artist_name, artwork_url, rank")
          .in("artist_slug", artistSlugsFromStaging).order("rank", { ascending: true }).limit(24);
        topTracks = entries ?? [];
      }

      const { data: relatedGenres } = await supabase
        .from("registry_genres").select("slug, name").eq("status", "active").neq("slug", gSlug).limit(8);

      data = {
        genre: { id: String(genre.id), slug: String(genre.slug), name: String(genre.name), description: genre.description || null },
        artists: registryArtists.map((a: any) => ({ slug: String(a.slug), name: String(a.display_name), imageUrl: a.public_image_url || "" })),
        topTracks: topTracks.map((t: any) => ({ slug: String(t.track_slug), title: String(t.track_title), artistName: String(t.artist_name), artworkUrl: t.artwork_url || "", peakRank: Number(t.rank) })),
        relatedGenres: (relatedGenres ?? []).map((g: any) => ({ slug: String(g.slug), name: String(g.name) })),
      };
    }

    // ── GENRES LISTING ──
    else if (path === "/genres" || path === "/genres/") {
      const { data: genres } = await supabase
        .from("registry_genres").select("id, slug, name, description, status")
        .eq("status", "active").order("name", { ascending: true });
      const { data: artistGenreAll } = await supabase
        .from("wk_import_staging_records").select("mapped_record")
        .eq("target_entity", "artist_genres").eq("target_status", "ready");
      const genreArtistCounts = new Map();
      const genreRepresentatives = new Map();
      for (const r of (artistGenreAll ?? [])) {
        const mr = (r.mapped_record || {}) as Record<string, unknown>;
        const gs = String(mr.genre_slug || "");
        const artistName = String(mr.artist_slug || "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        if (gs) {
          genreArtistCounts.set(gs, (genreArtistCounts.get(gs) || 0) + 1);
          const existing = genreRepresentatives.get(gs) || [];
          if (existing.length < 4) existing.push(artistName);
          genreRepresentatives.set(gs, existing);
        }
      }
      data = {
        genres: (genres ?? []).map((g: any) => {
          const gs = String(g.slug);
          return { id: String(g.id), slug: gs, name: String(g.name), artistCount: genreArtistCounts.get(gs) || 0, trackCount: 0, representativeArtists: genreRepresentatives.get(gs) || [] };
        }),
      };
    }

    // ── LABEL DETAIL ──
    else if (path.startsWith("/labels/")) {
      const lSlug = path.replace(/^\/labels\//, "").replace(/\/$/, "");
      const { data: label } = await supabase
        .from("registry_labels").select("id, slug, name, description, country_code, status")
        .eq("slug", lSlug).eq("status", "active").maybeSingle();
      if (!label) return jsonResponse({ data: null }, 404);

      const { data: releases } = await supabase
        .from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url")
        .eq("label_id", String(label.id)).in("status", ["active", "draft"])
        .order("release_date", { ascending: false }).limit(50);

      const releaseIds = (releases ?? []).map((r: any) => String(r.id));
      const { data: tracks } = releaseIds.length > 0
        ? await supabase.from("registry_tracks").select("id, release_id, title, slug").in("release_id", releaseIds)
        : { data: [] };

      const releaseTrackCount = new Map();
      for (const t of (tracks ?? [])) {
        const rid = String(t.release_id);
        releaseTrackCount.set(rid, (releaseTrackCount.get(rid) || 0) + 1);
      }

      const uniqueTrackSlugs = [...new Set((tracks ?? []).map((t: any) => String(t.slug || t.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")).filter(Boolean))];
      const rosterMap = new Map();
      if (uniqueTrackSlugs.length > 0) {
        const { data: chartData } = await supabase
          .from("chart_entries").select("track_slug, artist_slug, artist_name, artwork_url")
          .in("track_slug", uniqueTrackSlugs).limit(120);
        for (const c of (chartData ?? [])) {
          const artistSlug = String(c.artist_slug || "");
          if (artistSlug && !rosterMap.has(artistSlug)) {
            rosterMap.set(artistSlug, { slug: artistSlug, name: String(c.artist_name || artistSlug), artworkUrl: c.artwork_url || "" });
          }
        }
      }

      const { data: relatedLabels } = await supabase
        .from("registry_labels").select("slug, name").eq("status", "active").neq("slug", lSlug).limit(8);

      data = {
        label: { id: String(label.id), slug: String(label.slug), name: String(label.name), description: label.description || null, countryCode: label.country_code || null },
        roster: [...rosterMap.values()],
        releases: (releases ?? []).map((r: any) => ({ slug: String(r.slug), title: String(r.title), releaseDate: r.release_date || "", releaseType: String(r.release_type || "album"), artworkUrl: r.artwork_url || "", trackCount: releaseTrackCount.get(String(r.id)) || 0 })),
        relatedLabels: (relatedLabels ?? []).map((g: any) => ({ slug: String(g.slug), name: String(g.name) })),
      };
    }

    // ── LABELS LISTING ──
    else if (path === "/labels" || path === "/labels/") {
      const { data: labels } = await supabase
        .from("registry_labels").select("id, slug, name, country_code, description, status")
        .eq("status", "active").order("name", { ascending: true }).limit(500);
      data = {
        labels: (labels ?? []).map((l: any) => ({ id: String(l.id), slug: String(l.slug), name: String(l.name), country: l.country_code || null, logoUrl: null, artistCount: 0, releaseCount: 0, featuredArtists: [], isFeatured: false, description: l.description || null })),
      };
    }

    // ── TRACK DETAIL ──
    else if (path.startsWith("/tracks/")) {
      const tSegments = path.replace(/^\/tracks\//, "").split("/").filter(Boolean);
      const tSlug = tSegments[tSegments.length - 1] || "";

      const { data: track } = await supabase
        .from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, isrc, explicit, track_number, disc_number, release_id, metadata, status")
        .eq("slug", tSlug).maybeSingle();
      if (!track) return jsonResponse({ data: null }, 404);

      const { data: release } = track.release_id
        ? await supabase.from("registry_releases").select("slug, title, release_date, release_type, artwork_url, label_id").eq("id", String(track.release_id)).maybeSingle()
        : { data: null };

      const { data: label } = release?.label_id
        ? await supabase.from("registry_labels").select("slug, name, country_code").eq("id", String(release.label_id)).maybeSingle()
        : { data: null };

      const { data: chartEntries } = await supabase
        .from("chart_entries").select("edition_id, rank, previous_rank, movement, track_title, artist_name, artwork_url")
        .eq("track_slug", tSlug).order("rank", { ascending: true });

      const { data: historyEntries } = await supabase
        .from("chart_entries").select("rank, edition_id, movement").eq("track_slug", tSlug).order("rank", { ascending: true });

      let peakRank: number | null = null;
      if (historyEntries && historyEntries.length > 0) {
        peakRank = Math.min(...historyEntries.map((e: any) => Number(e.rank || 0)).filter((r: number) => r > 0));
      }

      const bestEntry = chartEntries && chartEntries.length > 0 ? chartEntries[0] : null;
      const artistName = bestEntry ? String(bestEntry.artist_name || "") : "Unknown";
      const artistSlugFromEntry = bestEntry ? (String(bestEntry.artist_name || "").split(",")[0] || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") : "";

      const chartHistory = (historyEntries ?? []).map((e: any) => Number(e.rank || 0));
      const chartHistoryUnique = chartHistory.filter((r: number, i: number) => chartHistory.indexOf(r) === i).slice(0, 52);

      data = {
        track: { id: String(track.id), slug: String(track.slug), title: String(track.title), durationMs: track.duration_ms || 0, artworkUrl: track.artwork_url || "", isrc: track.isrc || null, explicit: track.explicit || false, trackNumber: track.track_number || 0, discNumber: track.disc_number || 0, metadata: track.metadata || {}, status: track.status || "active" },
        artist: { slug: artistSlugFromEntry, name: artistName, imageUrl: bestEntry?.artwork_url || "" },
        release: release ? { slug: String(release.slug), title: String(release.title), releaseDate: release.release_date || "", releaseType: String(release.release_type || "single"), artworkUrl: release.artwork_url || "" } : null,
        label: label ? { slug: String(label.slug), name: String(label.name), countryCode: label.country_code || null } : null,
        genres: [], chartHistory: chartHistoryUnique, peakRank, weeksOnChart: historyEntries ? historyEntries.length : 0, currentRank: bestEntry ? Number(bestEntry.rank) : null,
      };
    }

    // ── CHARTS — list all programs ──
    else if (path === "/charts" || path === "/charts/") {
      const { data: programs } = await supabase
        .from("chart_programs")
        .select("id, public_slug, label, series_slug, market_slug, default_chart_size, default_period_type, default_methodology_version, status")
        .eq("status", "active")
        .order("label", { ascending: true });

      const programsWithEditions = await Promise.all((programs ?? []).map(async (p: any) => {
        const { data: editions } = await supabase
          .from("chart_editions")
          .select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
          .eq("program_id", p.id)
          .eq("status", "published")
          .order("edition_date", { ascending: false });

        const latestEdition = editions && editions.length > 0
          ? {
              id: String(editions[0].edition_slug),
              slug: String(editions[0].edition_slug),
              label: String(editions[0].edition_label),
              date: String(editions[0].edition_date),
              periodStart: editions[0].period_start || null,
              periodEnd: editions[0].period_end || null,
              entryCount: editions[0].entry_count || 0,
            }
          : null;

        return {
          id: String(p.id),
          publicSlug: String(p.public_slug),
          publicLabel: String(p.label),
          shortLabel: String(p.label),
          sourceFamilySlug: String(p.public_slug),
          seriesSlug: String(p.series_slug || ""),
          seriesLabel: String(p.series_slug || ""),
          marketSlug: String(p.market_slug || ""),
          marketLabel: String(p.market_slug || ""),
          periodType: String(p.default_period_type || "weekly"),
          methodologyVersion: String(p.default_methodology_version || "legacy-import-v1"),
          eligibilityRulesVersion: "legacy-import-v1",
          latestEdition,
          archive: (editions ?? []).map((e: any) => ({
            id: String(e.edition_slug),
            slug: String(e.edition_slug),
            label: String(e.edition_label),
            date: String(e.edition_date),
            periodStart: e.period_start || null,
            periodEnd: e.period_end || null,
            entryCount: e.entry_count || 0,
          })),
        };
      }));

      data = { programs: programsWithEditions };
    }

    // ── CHARTS — single program, latest edition, or edition entries ──
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

        const latestEdition = editions && editions.length > 0
          ? {
              id: String(editions[0].edition_slug),
              slug: String(editions[0].edition_slug),
              label: String(editions[0].edition_label),
              date: String(editions[0].edition_date),
              periodStart: editions[0].period_start || null,
              periodEnd: editions[0].period_end || null,
              entryCount: editions[0].entry_count || 0,
            }
          : null;

        data = {
          program: {
            id: String(program.id),
            publicSlug: String(program.public_slug),
            publicLabel: String(program.label),
            shortLabel: String(program.label),
            sourceFamilySlug: String(program.public_slug),
            seriesSlug: String(program.series_slug || ""),
            seriesLabel: String(program.series_slug || ""),
            marketSlug: String(program.market_slug || ""),
            marketLabel: String(program.market_slug || ""),
            periodType: String(program.default_period_type || "weekly"),
            methodologyVersion: String(program.default_methodology_version || "legacy-import-v1"),
            eligibilityRulesVersion: "legacy-import-v1",
            latestEdition,
            archive: (editions ?? []).map((e: any) => ({
              id: String(e.edition_slug),
              slug: String(e.edition_slug),
              label: String(e.edition_label),
              date: String(e.edition_date),
              periodStart: e.period_start || null,
              periodEnd: e.period_end || null,
              entryCount: e.entry_count || 0,
            })),
          },
        };
      }

      else if (segments.length === 2) {
        const [slug, second] = segments;

        const { data: program } = await supabase
          .from("chart_programs")
          .select("id, public_slug, label, series_slug, market_slug, default_chart_size, default_period_type, default_methodology_version, status")
          .eq("public_slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (!program) return jsonResponse({ error: "Not found" }, 404);

        const programVM = {
          id: String(program.id),
          publicSlug: String(program.public_slug),
          publicLabel: String(program.label),
          seriesSlug: String(program.series_slug || ""),
          seriesLabel: String(program.series_slug || ""),
          marketSlug: String(program.market_slug || ""),
          marketLabel: String(program.market_slug || ""),
        };

        if (second === "latest") {
          const { data: editions } = await supabase
            .from("chart_editions")
            .select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
            .eq("program_id", program.id)
            .eq("status", "published")
            .order("edition_date", { ascending: false })
            .limit(1);

          const latestEdition = editions && editions.length > 0
            ? {
                id: String(editions[0].edition_slug),
                slug: String(editions[0].edition_slug),
                label: String(editions[0].edition_label),
                date: String(editions[0].edition_date),
                periodStart: editions[0].period_start || null,
                periodEnd: editions[0].period_end || null,
                entryCount: editions[0].entry_count || 0,
              }
            : null;

          data = {
            edition: latestEdition,
            program: programVM,
          };
        } else {
          const { data: edition } = await supabase
            .from("chart_editions")
            .select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
            .eq("program_id", program.id)
            .eq("edition_slug", second)
            .maybeSingle();

          data = {
            edition: edition
              ? {
                  id: String(edition.edition_slug),
                  slug: String(edition.edition_slug),
                  label: String(edition.edition_label),
                  date: String(edition.edition_date),
                  periodStart: edition.period_start || null,
                  periodEnd: edition.period_end || null,
                  entryCount: edition.entry_count || 0,
                }
              : null,
            program: programVM,
          };
        }
      }

      else if (segments.length === 3 && segments[2] === "entries") {
        const [slug, editionSlug] = segments;

        const { data: program } = await supabase
          .from("chart_programs")
          .select("id, public_slug, label, series_slug, market_slug")
          .eq("public_slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (!program) return jsonResponse({ error: "Not found" }, 404);

        const { data: edition } = await supabase
          .from("chart_editions")
          .select("id, edition_slug, edition_label, edition_date, entry_count, status")
          .eq("program_id", program.id)
          .eq("edition_slug", editionSlug)
          .maybeSingle();

        if (!edition) return jsonResponse({ error: "Edition not found" }, 404);

        const { data: entries } = await supabase
          .from("chart_entries")
          .select("id, rank, previous_rank, movement, track_slug, track_title, artist_name, artwork_url, score, source_entry_id")
          .eq("edition_id", edition.id)
          .order("rank", { ascending: true })
          .limit(150);

        const entryList = (entries ?? []).map((e: any) => ({
          id: String(e.id),
          rank: Number(e.rank || 0),
          previousRank: e.previous_rank != null ? Number(e.previous_rank) : null,
          movement: String(e.movement || "same"),
          trackSlug: String(e.track_slug || ""),
          trackTitle: String(e.track_title || ""),
          artistNames: String(e.artist_name || "").split(",").map((s: string) => s.trim()).filter(Boolean),
          artistSlugs: String(e.artist_name || "")
            .split(",")
            .map((s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""))
            .filter(Boolean),
          artworkUrl: e.artwork_url || null,
          score: e.score != null ? Number(e.score) : null,
          sourceEntryId: String(e.source_entry_id || e.id),
        }));

        data = { entries: entryList };
      }

      else {
        return jsonResponse({ error: "Not found" }, 404);
      }
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