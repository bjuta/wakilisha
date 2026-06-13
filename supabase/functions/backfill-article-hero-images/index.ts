import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WP_SITE = "https://wakilisha.africa";

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  hero_image_url: string | null;
}

interface WpFeaturedMedia {
  source_url?: string;
  alt_text?: string;
  media_details?: {
    sizes?: Record<string, { source_url: string }>;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let body: Record<string, unknown> | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const slugs: string[] | undefined = body?.slugs as string[] | undefined;

    // Fetch articles missing hero images
    let query = supabase.from("wk_articles").select("id, slug, title, hero_image_url");
    if (slugs && slugs.length > 0) {
      query = query.in("slug", slugs);
    } else {
      query = query.or("hero_image_url.is.null,hero_image_url.eq.''");
    }
    
    const { data: articles, error: fetchErr } = await query;
    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!articles || articles.length === 0) {
      return new Response(JSON.stringify({ message: "No articles missing hero images found.", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ slug: string; title: string; oldImage: string | null; newImage: string | null; status: string }> = [];
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const article of articles as ArticleRow[]) {
      try {
        // Query WP REST API by slug
        const wpUrl = `${WP_SITE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(article.slug)}&_embed`;
        const wpRes = await fetch(wpUrl, {
          headers: { "Accept": "application/json", "User-Agent": "Wakilisha/1.0" },
        });

        if (!wpRes.ok) {
          results.push({ slug: article.slug, title: article.title, oldImage: article.hero_image_url, newImage: null, status: `WP API error ${wpRes.status}` });
          failed++;
          continue;
        }

        const posts = await wpRes.json() as Array<Record<string, unknown>>;
        if (!posts || posts.length === 0) {
          results.push({ slug: article.slug, title: article.title, oldImage: article.hero_image_url, newImage: null, status: "Not found on WP" });
          skipped++;
          continue;
        }

        const embedded = posts[0]._embedded as Record<string, unknown> | undefined;
        const featuredMediaArr = embedded?.["wp:featuredmedia"] as Array<WpFeaturedMedia> | undefined;
        const media = featuredMediaArr?.[0];

        if (!media || !media.source_url) {
          results.push({ slug: article.slug, title: article.title, oldImage: article.hero_image_url, newImage: null, status: "No featured image on WP" });
          skipped++;
          continue;
        }

        // Prefer large size, fall back to full, then source_url
        const large = media.media_details?.sizes?.large?.source_url;
        const full = media.media_details?.sizes?.full?.source_url;
        const imageUrl = large || full || media.source_url;

        // Update the article
        const { error: updateErr } = await supabase
          .from("wk_articles")
          .update({ hero_image_url: imageUrl })
          .eq("id", article.id);

        if (updateErr) {
          results.push({ slug: article.slug, title: article.title, oldImage: article.hero_image_url, newImage: imageUrl, status: `Update failed: ${updateErr.message}` });
          failed++;
        } else {
          results.push({ slug: article.slug, title: article.title, oldImage: article.hero_image_url, newImage: imageUrl, status: "Updated" });
          updated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ slug: article.slug, title: article.title, oldImage: article.hero_image_url, newImage: null, status: msg });
        failed++;
      }
    }

    return new Response(JSON.stringify({
      summary: { total: articles.length, updated, skipped, failed },
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
