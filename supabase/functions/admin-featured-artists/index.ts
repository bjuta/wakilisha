import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeaturedArtistRow {
  id: string;
  artist_slug: string;
  display_order: number;
  created_at: string;
}

interface ArtistInfo {
  slug: string;
  display_name: string;
  public_image_url: string | null;
  genres: string[];
  country: string | null;
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

    if (req.method === "GET") {
      const { data: rows, error: fetchErr } = await db
        .from("wk_magazine_featured_artists")
        .select("id, artist_slug, display_order, created_at")
        .order("display_order", { ascending: true });

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!rows || rows.length === 0) {
        return new Response(JSON.stringify({ artists: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const slugs = (rows as FeaturedArtistRow[]).map((r) => r.artist_slug);
      const { data: artists, error: artistErr } = await db
        .from("registry_artists")
        .select("slug, display_name, public_image_url, metadata")
        .in("slug", slugs);

      const artistMap = new Map<string, ArtistInfo>();
      if (artists && !artistErr) {
        for (const a of artists) {
          const meta = (a.metadata ?? {}) as Record<string, unknown>;
          const genresRaw = meta.genres;
          const countryRaw = meta.country;

          artistMap.set(a.slug, {
            slug: a.slug,
            display_name: a.display_name ?? a.slug,
            public_image_url: a.public_image_url ?? null,
            genres: Array.isArray(genresRaw)
              ? genresRaw.filter((g): g is string => typeof g === "string")
              : [],
            country: typeof countryRaw === "string" ? countryRaw : null,
          });
        }
      }

      const result = (rows as FeaturedArtistRow[]).map((row) => {
        const info = artistMap.get(row.artist_slug);
        return {
          id: row.id,
          artist_slug: row.artist_slug,
          artist_name: info?.display_name ?? row.artist_slug,
          artist_image: info?.public_image_url ?? null,
          artist_genres: info?.genres ?? [],
          artist_country: info?.country ?? null,
          display_order: row.display_order,
          created_at: row.created_at,
        };
      });

      return new Response(JSON.stringify({ artists: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (req.method === "POST") {
      const body = await req.json();
      const artistSlug = body.artist_slug;
      if (!artistSlug) {
        return new Response(JSON.stringify({ error: "Missing artist_slug" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count, error: countErr } = await db
        .from("wk_magazine_featured_artists")
        .select("*", { count: "exact", head: true });

      if (countErr) {
        return new Response(JSON.stringify({ error: countErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const nextOrder = (count ?? 0);
      const { data: inserted, error: insertErr } = await db
        .from("wk_magazine_featured_artists")
        .insert({ artist_slug: artistSlug, display_order: nextOrder })
        .select("id, artist_slug, display_order, created_at")
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

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteErr } = await db
        .from("wk_magazine_featured_artists")
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
        .from("wk_magazine_featured_artists")
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