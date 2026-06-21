import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Supabase config missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug") ?? "";
    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if admin exists
    const { data: userRoles } = await db
      .from("user_role_assignments")
      .select("id, role_key, status")
      .eq("user_id", "27937fb0-147f-4d0f-b735-3b9b9b82f38f")
      .eq("status", "active");

    // Try direct insert with service role
    const { data: existing } = await db
      .from("wk_magazine_featured_artists")
      .select("*", { count: "exact", head: true });

    const nextOrder = (existing as unknown as { count: number | null })?.count ?? 0;

    const { data, error } = await db
      .from("wk_magazine_featured_artists")
      .insert({ artist_slug: slug, display_order: nextOrder })
      .select()
      .single();

    return new Response(
      JSON.stringify({
        userRoles,
        existingCount: nextOrder,
        inserted: data,
        error: error ? { message: error.message, code: error.code, details: error.details } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
