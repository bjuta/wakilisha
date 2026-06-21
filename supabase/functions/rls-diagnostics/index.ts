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

    // Fix the broken RLS policies by creating the auth.role() function
    const { data: funcExists, error: funcCheckErr } = await db.rpc("check_function_exists", {
      schema_name: "auth",
      function_name: "role"
    });

    // Create auth.role() function using the service role key (bypasses RLS)
    const { error: createErr } = await db.from("_sql").select("*").limit(0);

    // Actually, we need to use raw SQL. Let me use the pg_exec function if available.
    // Since we can't drop policies via the SQL API, we need to create the missing auth.role() function.

    return new Response(
      JSON.stringify({
        message: "The auth.role() function needs to be created in the Supabase SQL Editor. This function is missing and is breaking all RLS policies that reference it.",
        tables_affected: [
          "wk_magazine_featured_artists",
          "wk_ingestion_runs",
          "legacy_import_records",
          "wk_import_staging_records",
          "wk_import_staging_failures",
          "wk_magazine_visual_assets",
          "wk_chart_scoring_runs",
          "wk_chart_airplay_stations",
          "wk_chart_airplay_evidence"
        ],
        fix_sql: `
-- Create the auth.role() function that Supabase policies expect
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'role', ''),
    'anon'
  )::text;
$$;
`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
