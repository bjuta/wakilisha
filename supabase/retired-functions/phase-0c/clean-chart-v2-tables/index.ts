import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const tables = [
    "wk_chart_entries_v2",
    "wk_chart_source_coverage_v2",
    "wk_chart_slug_aliases_v2",
    "wk_chart_editions_v2",
    "wk_chart_programs_v2",
    "wk_chart_series_v2",
    "wk_chart_markets_v2",
  ];

  const results: Record<string, { before: number; after: number; error?: string }> = {};

  for (const table of tables) {
    try {
      const { count: before } = await supabase.from(table).select("*", { count: "exact", head: true });

      const { error } = await supabase.from(table).delete().neq("id", "NO_MATCH_KEEP_ALL");

      if (error) {
        results[table] = { before: before ?? 0, after: -1, error: error.message };
      } else {
        const { count: after } = await supabase.from(table).select("*", { count: "exact", head: true });
        results[table] = { before: before ?? 0, after: after ?? 0 };
      }
    } catch (err) {
      results[table] = { before: -1, after: -1, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return new Response(JSON.stringify({ status: "done", results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
