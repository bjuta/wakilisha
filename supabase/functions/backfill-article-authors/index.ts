import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WP_SITE_URL = "https://wakilisha.africa";
const BATCH_SIZE = 50;

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

interface AuthorInfo {
  authorId: string;
  authorName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* optional body */ }
    const action = String(body.action || "backfill");

    if (action === "status") {
      const { count: total } = await supabase
        .from("wk_articles")
        .select("id", { count: "exact", head: true })
        .eq("wp_status", "publish");

      const { count: withAuthor } = await supabase
        .from("wk_articles")
        .select("id", { count: "exact", head: true })
        .eq("wp_status", "publish")
        .not("author", "is", null);

      const { count: nullAuthor } = await supabase
        .from("wk_articles")
        .select("id", { count: "exact", head: true })
        .eq("wp_status", "publish")
        .is("author", null);

      return new Response(JSON.stringify({
        total: total ?? 0,
        withAuthor: withAuthor ?? 0,
        nullAuthor: nullAuthor ?? 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "backfill") {
      const { data: articles, error: fetchErr } = await supabase
        .from("wk_articles")
        .select("source_wp_post_id, author, slug")
        .eq("wp_status", "publish")
        .order("published_at", { ascending: false });

      if (fetchErr) {
        return new Response(JSON.stringify({ error: `Failed to fetch articles: ${fetchErr.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const typedArticles = (articles ?? []) as Array<{
        source_wp_post_id: number;
        author: string | null;
        slug: string;
      }>;

      const allPostIds = typedArticles
        .map((a) => Number(a.source_wp_post_id))
        .filter((id) => id > 0);

      const uniquePostIds = [...new Set(allPostIds)];

      const authorMap = new Map<string, AuthorInfo>();
      const batches: number[][] = [];

      for (let i = 0; i < uniquePostIds.length; i += BATCH_SIZE) {
        batches.push(uniquePostIds.slice(i, i + BATCH_SIZE));
      }

      let totalFetched = 0;
      let apiErrors = 0;

      for (const batch of batches) {
        const idsParam = batch.join(",");
        const url = `${WP_SITE_URL}/wp-json/wp/v2/posts?include=${idsParam}&per_page=${BATCH_SIZE}&_embed&_fields=id,author,_embedded`;

        try {
          const res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "Wakilisha-Backfill/1.0" },
          });

          if (!res.ok) {
            apiErrors++;
            continue;
          }

          const posts = await res.json() as Array<Record<string, unknown>>;
          totalFetched += posts.length;

          for (const post of posts) {
            const postId = String(post.id ?? "");
            const wpAuthorId = post.author != null ? String(post.author) : "";

            let authorName = "";
            const embedded = post._embedded as Record<string, unknown> | undefined;
            const authorArr = embedded?.author;
            if (Array.isArray(authorArr) && authorArr.length > 0) {
              authorName = String((authorArr[0] as Record<string, unknown>).name || "");
            }

            if (!authorName && wpAuthorId && WP_AUTHOR_MAP[wpAuthorId]) {
              authorName = WP_AUTHOR_MAP[wpAuthorId];
            }

            if (!authorName) {
              authorName = "Wakilisha Staff";
            }

            authorMap.set(postId, { authorId: wpAuthorId, authorName });
          }
        } catch {
          apiErrors++;
        }
      }

      // Update using SQL directly — more reliable than Supabase client for this table
      let updated = 0;
      let skipped = 0;
      let sqlErrors = 0;

      for (const [wpPostId, info] of authorMap) {
        const { error } = await supabase.rpc("update_article_author", {
          p_source_wp_post_id: parseInt(wpPostId, 10),
          p_author_name: info.authorName,
          p_post_author: info.authorId,
        });

        if (error) {
          // Try direct update as fallback
          const { error: updateErr } = await supabase
            .from("wk_articles")
            .update({ author: info.authorName })
            .eq("source_wp_post_id", parseInt(wpPostId, 10));

          if (updateErr) {
            sqlErrors++;
          } else {
            updated++;
          }
        } else {
          updated++;
        }
      }

      skipped = authorMap.size - updated - sqlErrors;

      return new Response(JSON.stringify({
        success: true,
        stats: {
          totalArticles: typedArticles.length,
          uniqueWpPostIds: uniquePostIds.length,
          authorMapSize: authorMap.size,
          postsFetchedFromApi: totalFetched,
          apiBatchErrors: apiErrors,
          articlesUpdated: updated,
          articlesSkipped: skipped,
          sqlErrors,
        },
        authorSample: [...authorMap.entries()].slice(0, 10).map(([postId, info]) => ({
          wpPostId: postId,
          authorId: info.authorId,
          authorName: info.authorName,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Internal error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
