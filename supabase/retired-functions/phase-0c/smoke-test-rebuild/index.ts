import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const SUPABASE_URL = Deno.env.get("VITE_PUBLIC_SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
}

Deno.serve(async (_req: Request) => {
  const steps: string[] = [];

  try {
    steps.push("Fetching 5 test artists...");
    const { data: artists, error: artistErr } = await supabase
      .from("registry_artists")
      .select("id, slug, display_name, metadata")
      .not("metadata", "is", null)
      .limit(5);

    if (artistErr) throw new Error(`Fetch failed: ${artistErr.message}`);
    steps.push(`Got ${artists.length} artists`);

    for (const a of artists) {
      const m = a.metadata as Record<string, unknown> | null;
      steps.push(`${a.slug}: metadata keys=${m ? Object.keys(m).join(",") : "null"}`);
    }

    // Try one upsert
    const testSlug = "test--smoke-track";
    const { error: upsertErr } = await supabase.from("registry_tracks").upsert({
      slug: testSlug,
      title: "Smoke Test",
      normalized_title: "smoke test",
      status: "active",
      metadata: { source: "test" },
    }, { onConflict: "slug" });

    steps.push(`Upsert test: ${upsertErr ? "FAIL: " + upsertErr.message : "OK"}`);

    return new Response(JSON.stringify({ steps }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), steps }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});