import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeaturedGuideRow {
  id: string;
  guide_slug: string;
  display_order: number;
  created_at: string;
}

interface GuideInfo {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  hero_url: string | null;
  guide_format: string | null;
  color_var: string | null;
  icon: string | null;
  framing: string | null;
  published_at: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    // GET is public — anyone can see the featured guides
    if (req.method === "GET") {
      const { data: rows, error: fetchErr } = await db
        .from("wk_magazine_featured_guides")
        .select("id, guide_slug, display_order, created_at")
        .order("display_order", { ascending: true });

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!rows || rows.length === 0) {
        return new Response(JSON.stringify({ guides: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const slugs = (rows as FeaturedGuideRow[]).map((r) => r.guide_slug);
      const { data: guides, error: guideErr } = await db
        .from("guide_pages")
        .select("slug, title, subtitle, excerpt, hero_url, guide_format, color_var, icon, framing, published_at")
        .in("slug", slugs)
        .eq("status", "published");

      const guideMap = new Map<string, GuideInfo>();
      if (guides && !guideErr) {
        for (const g of guides) {
          guideMap.set(g.slug, {
            slug: g.slug,
            title: g.title,
            subtitle: g.subtitle ?? null,
            excerpt: g.excerpt ?? null,
            hero_url: g.hero_url ?? null,
            guide_format: g.guide_format ?? null,
            color_var: g.color_var ?? null,
            icon: g.icon ?? null,
            framing: g.framing ?? null,
            published_at: g.published_at ?? null,
          });
        }
      }

      const result = (rows as FeaturedGuideRow[]).map((row) => {
        const info = guideMap.get(row.guide_slug);
        return {
          id: row.id,
          guide_slug: row.guide_slug,
          guide_title: info?.title ?? row.guide_slug,
          guide_subtitle: info?.subtitle ?? null,
          guide_excerpt: info?.excerpt ?? null,
          guide_hero_url: info?.hero_url ?? null,
          guide_format: info?.guide_format ?? null,
          guide_color_var: info?.color_var ?? null,
          guide_icon: info?.icon ?? null,
          guide_framing: info?.framing ?? null,
          guide_published_at: info?.published_at ?? null,
          display_order: row.display_order,
          created_at: row.created_at,
        };
      });

      return new Response(JSON.stringify({ guides: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other methods require admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await db
      .from("user_role_assignments")
      .select("role_key, status")
      .eq("user_id", user.id)
      .eq("role_key", "administrator")
      .eq("status", "active")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Add a featured guide
    if (req.method === "POST") {
      const body = await req.json();
      const guideSlug = body.guide_slug;
      if (!guideSlug) {
        return new Response(JSON.stringify({ error: "Missing guide_slug" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count, error: countErr } = await db
        .from("wk_magazine_featured_guides")
        .select("*", { count: "exact", head: true });

      if (countErr) {
        return new Response(JSON.stringify({ error: countErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const nextOrder = (count ?? 0);
      const { data: inserted, error: insertErr } = await db
        .from("wk_magazine_featured_guides")
        .insert({ guide_slug: guideSlug, display_order: nextOrder })
        .select("id, guide_slug, display_order, created_at")
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: Remove a featured guide
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteErr } = await db
        .from("wk_magazine_featured_guides")
        .delete()
        .eq("id", id);

      if (deleteErr) {
        return new Response(JSON.stringify({ error: deleteErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Reorder featured guides
    if (req.method === "PUT") {
      const body = await req.json();
      const orderedIds = body.ordered_ids;
      if (!orderedIds || !Array.isArray(orderedIds)) {
        return new Response(JSON.stringify({ error: "Missing ordered_ids array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates = orderedIds.map((id: string, index: number) => ({
        id,
        display_order: index,
      }));

      const { error: upsertErr } = await db
        .from("wk_magazine_featured_guides")
        .upsert(updates, { onConflict: "id" });

      if (upsertErr) {
        return new Response(JSON.stringify({ error: upsertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
