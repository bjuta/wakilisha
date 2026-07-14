import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const WP_SITE_URL = "https://wakilisha.com";
const FETCH_TIMEOUT = 15000;
const PER_PAGE = 50;

/* ───────────────────────────────────────────
   VC / WPBakery / Uncode Shortcode Sanitizer
   Ported from src/utils/sanitizeVcShortcodes.ts
   ─────────────────────────────────────────── */

function decodeVcRawHtml(encoded: string): string {
  try {
    const urlEncoded = atob(encoded.trim());
    const decoded = decodeURIComponent(urlEncoded);
    if (/^\s*\[/.test(decoded)) return '';
    return decoded;
  } catch {
    return '';
  }
}

function sanitizeVcShortcodes(html: string): string {
  if (!html || typeof html !== 'string') return html;
  let result = html;

  // 1. [vc_raw_html]BASE64[/vc_raw_html]
  result = result.replace(
    /\[vc_raw_html\]([\s\S]*?)\[\/vc_raw_html\]/gi,
    (_, encoded) => decodeVcRawHtml(encoded)
  );

  // 2. Self-closing vc tags
  result = result.replace(/\[vc_[^\]]*?\/\]/gi, '');

  // 3. Opening vc tags
  result = result.replace(/\[vc_[^\]]*?\]/gi, '');

  // 4. Closing vc tags
  result = result.replace(/\[\/vc_[^\]]*?\]/gi, '');

  // 5. Uncode shortcodes
  result = result.replace(/\[uncode_[^\]]*?\][\s\S]*?\[\/uncode_[^\]]*?\]/gi, '');
  result = result.replace(/\[uncode_[^\]]*?\/?\]/gi, '');
  result = result.replace(/\[\/uncode_[^\]]*?\]/gi, '');

  // 6. [caption ...] ... [/caption]
  result = result.replace(/\[caption[^\]]*?\]([\s\S]*?)\[\/caption\]/gi, '$1');

  // 7. [gallery], [playlist], [audio], [video]
  result = result.replace(/\[gallery[^\]]*?\]/gi, '');
  result = result.replace(/\[playlist[^\]]*?\]/gi, '');
  result = result.replace(/\[audio[^\]]*?\]/gi, '');
  result = result.replace(/\[video[^\]]*?\]/gi, '');

  // 8. Orphan uncode_shortcode_id attributes
  result = result.replace(/\s*uncode_shortcode_id="[^"]*"/gi, '');

  // 9. Collapse multiple blank lines
  result = result.replace(/(\n\s*){3,}/g, '\n\n');

  return result;
}

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

function extractFirstImgSrc(html: string): string {
  const m = html.match(/<img[^>]+src="([^"]+)"/);
  return m ? m[1] : "";
}

function stripHtml(html: string): string {
  return String(html || "").replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, "").trim();
}

function estimateReadingTime(html: string): number {
  const text = stripHtml(html);
  return Math.max(1, Math.ceil(text.length / 1500));
}

function generateExcerpt(html: string, maxChars = 280): string {
  let plain = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  plain = plain.replace(/<[^>]*>/g, "");
  plain = plain.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, "");
  plain = plain.replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= maxChars) return plain;
  const lastSpace = plain.slice(0, maxChars).lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return plain.slice(0, lastSpace).replace(/[,\s]+$/, "") + "\u2026";
  return plain.slice(0, maxChars).replace(/[,\s]+$/, "") + "\u2026";
}

function resolveAuthor(wpAuthorId: string, authorMap: Map<string, string>): string {
  const mapped = authorMap.get(String(wpAuthorId));
  return mapped || "Wakilisha Staff";
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Wakilisha-WP-Import/1.0" },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllPages(baseUrl: string, perPage: number): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${baseUrl}?per_page=${perPage}&page=${page}&_embed&orderby=date&order=desc`;
    console.log(`Fetching page ${page}...`);
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      console.error(`Failed page ${page}: HTTP ${res.status}`);
      break;
    }

    const totalHeader = res.headers.get("X-WP-Total");
    const totalPagesHeader = res.headers.get("X-WP-TotalPages");
    if (totalHeader) console.log(`Total items: ${totalHeader}`);
    if (totalPagesHeader) totalPages = parseInt(totalPagesHeader, 10);

    const items = await res.json();
    all.push(...items);
    page++;
  }

  return all;
}

/* ───────────────────────────────────────────
   Main handler
   ─────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const action = body.action || "import";

    // ── DISCOVER ──
    if (action === "discover") {
      const results: Record<string, unknown> = { siteUrl: WP_SITE_URL };

      // Users
      try {
        const usersRes = await fetchWithTimeout(`${WP_SITE_URL}/wp-json/wp/v2/users?per_page=100`);
        if (usersRes.ok) {
          const users = await usersRes.json();
          results.users = {
            count: usersRes.headers.get("X-WP-Total") || String(users.length),
            samples: (users as any[]).slice(0, 5).map((u: any) => ({
              id: u.id,
              name: u.name,
              slug: u.slug,
            })),
          };
        } else {
          results.users = { error: `HTTP ${usersRes.status}` };
        }
      } catch (e) {
        results.users = { error: e instanceof Error ? e.message : "Failed" };
      }

      // Posts
      try {
        const postsRes = await fetchWithTimeout(
          `${WP_SITE_URL}/wp-json/wp/v2/posts?per_page=1&status=publish`
        );
        if (postsRes.ok) {
          results.posts = {
            published: parseInt(postsRes.headers.get("X-WP-Total") || "0", 10),
          };
        } else {
          results.posts = { error: `HTTP ${postsRes.status}` };
        }
      } catch (e) {
        results.posts = { error: e instanceof Error ? e.message : "Failed" };
      }

      // Categories
      try {
        const catRes = await fetchWithTimeout(`${WP_SITE_URL}/wp-json/wp/v2/categories?per_page=100`);
        if (catRes.ok) {
          const cats = await catRes.json();
          results.categories = {
            count: catRes.headers.get("X-WP-Total") || String(cats.length),
            names: (cats as any[]).map((c: any) => c.name),
          };
        }
      } catch { /* non-fatal */ }

      // Tags
      try {
        const tagRes = await fetchWithTimeout(`${WP_SITE_URL}/wp-json/wp/v2/tags?per_page=100`);
        if (tagRes.ok) {
          const tags = await tagRes.json();
          results.tags = {
            count: tagRes.headers.get("X-WP-Total") || String(tags.length),
            names: (tags as any[]).slice(0, 10).map((t: any) => t.name),
          };
        }
      } catch { /* non-fatal */ }

      // Media
      try {
        const mediaRes = await fetchWithTimeout(`${WP_SITE_URL}/wp-json/wp/v2/media?per_page=1`);
        if (mediaRes.ok) {
          results.media = {
            count: parseInt(mediaRes.headers.get("X-WP-Total") || "0", 10),
          };
        }
      } catch { /* non-fatal */ }

      return new Response(JSON.stringify({ success: true, discovery: results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT ──
    if (action === "import") {
      const stats = {
        usersFetched: 0,
        authorsCreated: 0,
        authorsSkipped: 0,
        postsFetched: 0,
        articlesInserted: 0,
        articlesSkipped: 0,
        articlesUpdated: 0,
        vcCleaned: 0,
        errors: [] as string[],
      };

      // Step 1: Fetch WP users → build author map
      console.log("Step 1: Fetching WP users...");
      const users = await fetchAllPages(`${WP_SITE_URL}/wp-json/wp/v2/users`, 100);
      stats.usersFetched = users.length;
      const authorMap = new Map<string, string>();
      const authorSlugMap = new Map<string, string>();

      for (const user of users) {
        const userId = String(user.id);
        const name = String(user.name || "").trim();
        if (name) {
          authorMap.set(userId, name);
          const slug = String(user.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
          authorSlugMap.set(userId, slug);
        }
      }

      // Step 2: Upsert registry_authors
      console.log("Step 2: Upserting registry_authors...");
      for (const [userId, name] of authorMap) {
        const slug = authorSlugMap.get(userId) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
        const userData = users.find((u: any) => String(u.id) === userId);
        const avatarUrl = userData?.avatar_urls?.["96"] || userData?.avatar_urls?.["48"] || "";

        // Check if author exists
        const { data: existing } = await supabase
          .from("registry_authors")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (existing) {
          // Update existing author
          const { error: updateErr } = await supabase
            .from("registry_authors")
            .update({
              name,
              avatar_url: avatarUrl || undefined,
              url: userData?.url || undefined,
              source_kind: "wordpress",
              updated_at: new Date().toISOString(),
            })
            .eq("slug", slug);

          if (updateErr) {
            stats.errors.push(`Author update failed for ${slug}: ${updateErr.message}`);
          } else {
            stats.authorsSkipped++;
          }
        } else {
          // Create new author with generated UUID-like ID
          const authorId = crypto.randomUUID();
          const { error: insertErr } = await supabase
            .from("registry_authors")
            .insert({
              id: authorId,
              slug,
              name,
              avatar_url: avatarUrl || null,
              url: userData?.url || null,
              source_kind: "wordpress",
              role: "Contributor",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertErr) {
            stats.errors.push(`Author insert failed for ${slug}: ${insertErr.message}`);
          } else {
            stats.authorsCreated++;
          }
        }
      }

      // Step 3: Fetch all published WP posts
      console.log("Step 3: Fetching WP posts...");
      const posts = await fetchAllPages(`${WP_SITE_URL}/wp-json/wp/v2/posts`, PER_PAGE);
      stats.postsFetched = posts.length;

      // Step 4: Process and insert each post
      console.log(`Step 4: Processing ${posts.length} posts...`);
      let processedCount = 0;

      for (const post of posts) {
        processedCount++;
        const wpId = String(post.id);
        const wpSlug = String(post.slug || "");
        const title = String(post.title?.rendered || "").trim();
        const rawContent = String(post.content?.rendered || "");
        const wpStatus = String(post.status || "publish");
        const publishedAt = post.date || null;
        const modifiedAt = post.modified || null;

        // Skip posts without content or title
        if (!title || !rawContent) {
          stats.articlesSkipped++;
          continue;
        }

        // Clean VC shortcodes
        const cleanContent = sanitizeVcShortcodes(rawContent);
        if (cleanContent !== rawContent) stats.vcCleaned++;

        // Extract excerpt
        const wpExcerpt = String(post.excerpt?.rendered || "").replace(/<[^>]+>/g, "").trim();
        const excerpt = wpExcerpt || generateExcerpt(cleanContent, 280);

        // Resolve author
        const wpAuthorId = String(post.author || "");
        const author = resolveAuthor(wpAuthorId, authorMap);

        // Extract hero image
        let heroUrl = "";
        // Check featured media
        if (post._embedded?.["wp:featuredmedia"]?.[0]?.source_url) {
          heroUrl = String(post._embedded["wp:featuredmedia"][0].source_url);
        }
        if (!heroUrl && post.featured_media && post._embedded?.["wp:featuredmedia"]?.[0]?.source_url) {
          heroUrl = String(post._embedded["wp:featuredmedia"][0].source_url);
        }
        if (!heroUrl && cleanContent) {
          heroUrl = extractFirstImgSrc(cleanContent);
        }

        // Extract categories
        const categories: string[] = [];
        if (post._embedded?.["wp:term"]) {
          for (const termGroup of post._embedded["wp:term"]) {
            if (Array.isArray(termGroup)) {
              for (const term of termGroup) {
                if (term.taxonomy === "category" && term.name) {
                  categories.push(String(term.name));
                }
              }
            }
          }
        }

        // Extract tags
        const tags: string[] = [];
        if (post._embedded?.["wp:term"]) {
          for (const termGroup of post._embedded["wp:term"]) {
            if (Array.isArray(termGroup)) {
              for (const term of termGroup) {
                if (term.taxonomy === "post_tag" && term.name) {
                  tags.push(String(term.name));
                }
              }
            }
          }
        }

        // Reading time
        const readingTime = estimateReadingTime(cleanContent);

        // Build seo meta from Yoast if available
        const seo: Record<string, unknown> = {};
        if (post.yoast_head_json) {
          seo.yoast = post.yoast_head_json;
        }

        // Check if article already exists by slug
        const { data: existingArticle } = await supabase
          .from("wk_articles")
          .select("id, content_html, wp_status")
          .eq("slug", wpSlug)
          .maybeSingle();

        const articleRow = {
          source_wp_post_id: parseInt(wpId, 10),
          slug: wpSlug,
          title,
          excerpt,
          content_html: cleanContent,
          author,
          published_at: publishedAt,
          modified_at: modifiedAt,
          categories: JSON.stringify(categories),
          tags: JSON.stringify(tags),
          seo: JSON.stringify(seo),
          raw_meta: JSON.stringify(post),
          wp_status: wpStatus,
          hero_image_url: heroUrl || null,
          updated_at: new Date().toISOString(),
        };

        if (existingArticle) {
          // Update if content changed
          if (existingArticle.content_html !== cleanContent || existingArticle.wp_status !== wpStatus) {
            const { error: updateErr } = await supabase
              .from("wk_articles")
              .update(articleRow)
              .eq("id", existingArticle.id);

            if (updateErr) {
              stats.errors.push(`Update failed for "${title}": ${updateErr.message}`);
            } else {
              stats.articlesUpdated++;
            }
          } else {
            stats.articlesSkipped++;
          }
        } else {
          const { error: insertErr } = await supabase
            .from("wk_articles")
            .insert({
              ...articleRow,
              created_at: new Date().toISOString(),
            });

          if (insertErr) {
            stats.errors.push(`Insert failed for "${title}": ${insertErr.message}`);
          } else {
            stats.articlesInserted++;
          }
        }

        // Log progress
        if (processedCount % 50 === 0) {
          console.log(`Progress: ${processedCount}/${posts.length} posts processed`);
        }
      }

      console.log("Import complete!", stats);

      return new Response(JSON.stringify({ success: true, stats }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}. Use "discover" or "import".` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Import failed:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
