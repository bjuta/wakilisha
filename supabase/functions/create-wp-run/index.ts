import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Supabase config missing", detail: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { host, port, user, password, database, prefix } = body;

    if (!host || !user || !password || !database) {
      return new Response(
        JSON.stringify({ success: false, error: "host, user, password, database required", received: { host: !!host, user: !!user, password: !!password, database: !!database } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const payload = {
      source_name: `${host}/${database}`,
      source_kind: "wordpress_database_cli",
      source_manifest: {
        connection_type: "wordpress_database_cli",
        credentials_preview: { host, port: Number(port), user, database, prefix: prefix || "wp_", password_stored: false },
        created_at: now,
        status: "created_for_cli",
      },
      status: "created_for_cli",
      imported_counts: {},
      warnings: ["Created via UI. Ready for CLI staging."],
      errors: [],
      created_at: now,
    };

    const { data: run, error: runErr } = await supabase
      .from("wk_ingestion_runs")
      .insert(payload)
      .select("id")
      .single();

    if (runErr) {
      return new Response(
        JSON.stringify({ success: false, error: runErr.message, code: runErr.code, details: runErr.details, hint: runErr.hint }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, runId: (run as { id: string }).id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const stack = err instanceof Error ? err.stack : undefined;
    return new Response(
      JSON.stringify({ success: false, error: message, stack: stack?.split("\n").slice(0, 3).join(" | ") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});