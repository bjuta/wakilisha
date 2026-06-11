import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date().toISOString();

    // Find all articles that are scheduled and whose publish time has arrived
    const { data: scheduled, error: fetchError } = await supabase
      .from("wk_articles")
      .select("id, slug, title, published_at")
      .eq("wp_status", "future")
      .lte("published_at", now);

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message, published: 0 }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!scheduled || scheduled.length === 0) {
      return new Response(
        JSON.stringify({ success: true, published: 0, message: "No scheduled articles ready to publish." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Publish each one
    let publishedCount = 0;
    const published: Array<{ slug: string; title: string }> = [];

    for (const article of scheduled) {
      const { error: updateError } = await supabase
        .from("wk_articles")
        .update({ wp_status: "publish", updated_at: now })
        .eq("id", article.id);

      if (updateError) {
        console.error(`Failed to publish article ${article.slug}:`, updateError.message);
        continue;
      }

      publishedCount++;
      published.push({ slug: article.slug, title: article.title || "" });
    }

    return new Response(
      JSON.stringify({
        success: true,
        published: publishedCount,
        articles: published,
        checked_at: now,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err), published: 0 }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
