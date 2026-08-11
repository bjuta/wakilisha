import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_supabase_environment",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const db = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: { persistSession: false },
      },
    );

    const articleResult = await db.rpc(
      "publish_due_article_publications",
      { p_limit: 50 },
    );

    const playlistResult = await db.rpc(
      "publish_due_playlist_publications",
      { p_limit: 50 },
    );

    const articleRows = Array.isArray(
      articleResult.data,
    )
      ? articleResult.data
      : [];

    const playlistRows = Array.isArray(
      playlistResult.data,
    )
      ? playlistResult.data
      : [];

    const errors = [
      articleResult.error
        ? {
            kind: "article",
            message: articleResult.error.message,
          }
        : null,
      playlistResult.error
        ? {
            kind: "playlist",
            message: playlistResult.error.message,
          }
        : null,
    ].filter(Boolean);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          errors,
          articles: {
            published: articleRows.length,
            rows: articleRows,
          },
          playlists: {
            published: playlistRows.length,
            rows: playlistRows,
          },
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const rows = [
      ...articleRows.map((row) => ({
        kind: "article",
        ...row,
      })),
      ...playlistRows.map((row) => ({
        kind: "playlist",
        ...row,
      })),
    ];

    return new Response(
      JSON.stringify({
        ok: true,
        published: rows.length,
        rows,
        articles: {
          published: articleRows.length,
          rows: articleRows,
        },
        playlists: {
          published: playlistRows.length,
          rows: playlistRows,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
