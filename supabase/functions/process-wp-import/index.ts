import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLE_WRITABLE = new Set([
  "registry_artists", "registry_tracks", "registry_releases", "registry_labels",
  "registry_genres", "wk_artists", "wk_tracks", "wk_releases", "wk_labels",
  "wk_genres", "wk_articles", "wk_guides", "wk_raw_wp_posts",
  "wk_cms_documents", "wk_media_assets", "wk_wordpress_items",
]);

const API_PAGE_SIZE = 50;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { runId, batchSize = 50, maxItems = 500 } = await req.json();

    if (!runId) {
      return new Response(JSON.stringify({ error: "runId is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the ingestion run
    const { data: run, error: runErr } = await supabase
      .from("wk_ingestion_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Ingestion run not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const manifest = run.source_manifest ?? {};
    const siteUrl = (manifest as Record<string, unknown>).site_url as string || "";
    const stagingPlan = (manifest as Record<string, unknown>).staging_plan as Record<string, unknown> | undefined;
    const buckets = (stagingPlan?.buckets ?? []) as Array<Record<string, unknown>>;

    if (!siteUrl) {
      return new Response(JSON.stringify({ error: "No site_url in source_manifest." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark run as running
    await supabase.from("wk_ingestion_runs").update({
      status: "running",
      started_at: new Date().toISOString(),
    }).eq("id", runId);

    const stats = { total: 0, imported: 0, failed: 0, skipped: 0 };
    const errors: string[] = [];
    const warnings: string[] = [];
    const importedCounts: Record<string, number> = {};

    // 2. Process each bucket
    for (const bucket of buckets) {
      const targetEntity = bucket.target_entity as string;
      const sourceType = (bucket.source_files as string[])?.[0] || "posts";

      if (!TABLE_WRITABLE.has(targetEntity)) {
        warnings.push(`Table "${targetEntity}" is not in the writable allowlist. Skipping bucket.`);
        stats.skipped += (bucket.candidate_count as number) || 0;
        continue;
      }

      // Determine WP REST API endpoint
      const restBase = (manifest as Record<string, unknown>).scan?.evidence?.post_types?.[sourceType]?.restBase as string || sourceType;

      // Fetch total count first
      let totalItems = (bucket.candidate_count as number) || 0;
      if (totalItems === 0) {
        try {
          const countRes = await fetch(
            `${siteUrl}/wp-json/wp/v2/${restBase}?per_page=1`,
            { headers: { "Accept": "application/json", "User-Agent": "Wakilisha-Import/1.0" } }
          );
          if (countRes.ok) {
            const totalHeader = countRes.headers.get("X-WP-Total");
            totalItems = totalHeader ? parseInt(totalHeader, 10) : 0;
          }
        } catch {
          totalItems = 0;
        }
      }

      const limit = Math.min(totalItems, maxItems);
      const pages = Math.ceil(limit / API_PAGE_SIZE);

      // Fetch and import in pages
      for (let page = 1; page <= pages; page++) {
        try {
          const wpRes = await fetch(
            `${siteUrl}/wp-json/wp/v2/${restBase}?per_page=${API_PAGE_SIZE}&page=${page}&orderby=date&order=desc`,
            { headers: { "Accept": "application/json", "User-Agent": "Wakilisha-Import/1.0" } }
          );

          if (!wpRes.ok) {
            const msg = `WP API error for ${restBase} page ${page}: HTTP ${wpRes.status}`;
            errors.push(msg);
            stats.failed += API_PAGE_SIZE;
            continue;
          }

          const items = await wpRes.json() as Array<Record<string, unknown>>;
          stats.total += items.length;

          // Import each item
          for (const item of items) {
            const wpId = String(item.id ?? "unknown");
            try {
              // Transform WP post to target table row
              const row = transformForTable(item, targetEntity, sourceType);

              if (!row || Object.keys(row).length === 0) {
                await supabase.from("legacy_import_records").insert({
                  job_id: runId,
                  source_kind: run.source_kind,
                  legacy_id: wpId,
                  target_table: targetEntity,
                  status: "skipped",
                  raw_payload: item,
                  error_message: "No transformable fields found for this item.",
                });
                stats.skipped++;
                continue;
              }

              // Insert into target table
              const { data: inserted, error: insertErr } = await supabase
                .from(targetEntity)
                .insert(row)
                .select("id")
                .single();

              if (insertErr) {
                // Track failure
                await supabase.from("legacy_import_records").insert({
                  job_id: runId,
                  source_kind: run.source_kind,
                  legacy_id: wpId,
                  target_table: targetEntity,
                  status: "failed",
                  raw_payload: item,
                  error_message: insertErr.message,
                });
                stats.failed++;
                if (errors.length < 100) errors.push(`${targetEntity}#${wpId}: ${insertErr.message}`);
              } else {
                // Track success
                await supabase.from("legacy_import_records").insert({
                  job_id: runId,
                  source_kind: run.source_kind,
                  legacy_id: wpId,
                  target_table: targetEntity,
                  target_id: inserted?.[0]?.id ?? null,
                  status: "imported",
                  raw_payload: item,
                });
                stats.imported++;
                importedCounts[targetEntity] = (importedCounts[targetEntity] || 0) + 1;
              }
            } catch (itemErr) {
              await supabase.from("legacy_import_records").insert({
                job_id: runId,
                source_kind: run.source_kind,
                legacy_id: wpId,
                target_table: targetEntity,
                status: "failed",
                raw_payload: item,
                error_message: itemErr instanceof Error ? itemErr.message : "Unknown error",
              });
              stats.failed++;
            }
          }
        } catch (pageErr) {
          const msg = `Failed to fetch page ${page} for ${restBase}: ${pageErr instanceof Error ? pageErr.message : "network error"}`;
          errors.push(msg);
          stats.failed += API_PAGE_SIZE;
        }
      }
    }

    // 3. Update the run with final stats
    await supabase.from("wk_ingestion_runs").update({
      status: stats.failed > 0 && stats.imported === 0 ? "failed" : "completed",
      finished_at: new Date().toISOString(),
      imported_counts: importedCounts,
      errors: errors.slice(0, 200),
      warnings: [...(run.warnings ?? []), ...warnings],
    }).eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        stats: { total: stats.total, imported: stats.imported, failed: stats.failed, skipped: stats.skipped },
        importedCounts,
        errorCount: errors.length,
        warningCount: warnings.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---- Transform helpers ----
function transformForTable(item: Record<string, unknown>, targetTable: string, sourceType: string): Record<string, unknown> | null {
  const title = typeof item.title === "object" && item.title
    ? (item.title as Record<string, string>).rendered || ""
    : String(item.id ?? "");
  const content = typeof item.content === "object" && item.content
    ? (item.content as Record<string, string>).rendered || ""
    : "";
  const excerpt = typeof item.excerpt === "object" && item.excerpt
    ? (item.excerpt as Record<string, string>).rendered || ""
    : "";
  const slug = String(item.slug ?? slugify(stripHtml(title)));
  const status = String(item.status ?? "publish");
  const date = String(item.date ?? new Date().toISOString());

  switch (targetTable) {
    case "wk_raw_wp_posts":
      return {
        ingestion_run_id: null,
        source_file: sourceType,
        wp_post_id: Number(item.id),
        wp_post_type: sourceType,
        wp_status: status,
        slug,
        title: stripHtml(title),
        published_at: date,
        modified_at: String(item.modified ?? date),
        content_html: content,
        excerpt_html: excerpt,
        raw: item,
        content_hash: null,
      };

    case "wk_wordpress_items":
      return {
        import_source_id: null,
        source_file: sourceType,
        wp_post_id: String(item.id ?? ""),
        wp_post_type: sourceType,
        wp_status: status,
        original_slug: slug,
        original_title: stripHtml(title),
        original_permalink: String(item.link ?? ""),
        original_published_at: date,
        original_modified_at: String(item.modified ?? date),
        raw_item: JSON.stringify(item),
      };

    case "wk_cms_documents":
      return {
        document_type: sourceType === "post" ? "article" : sourceType,
        slug,
        title: stripHtml(title),
        status: status === "publish" ? "published" : "draft",
        published_at: date,
        body_html: content,
        excerpt_html: excerpt,
        source_import_id: String(item.id ?? ""),
      };

    case "wk_articles":
      return {
        title: stripHtml(title),
        slug,
        status: status === "publish" ? "published" : "draft",
        published_at: date,
        body: content,
        dek: stripHtml(excerpt).slice(0, 200),
        legacy_wp_id: String(item.id ?? ""),
        legacy_wp_type: sourceType,
      };

    case "wk_artists":
    case "registry_artists":
      return {
        name: stripHtml(title),
        slug,
        bio: stripHtml(content).slice(0, 2000) || null,
        legacy_wp_id: String(item.id ?? ""),
      };

    case "wk_tracks":
    case "registry_tracks":
      return {
        title: stripHtml(title),
        slug,
        legacy_wp_id: String(item.id ?? ""),
      };

    case "wk_releases":
    case "registry_releases":
      return {
        title: stripHtml(title),
        slug,
        description: stripHtml(content).slice(0, 1000) || null,
        release_date: date,
        legacy_wp_id: String(item.id ?? ""),
      };

    case "wk_labels":
    case "registry_labels":
      return {
        name: stripHtml(title),
        slug,
        description: stripHtml(content).slice(0, 1000) || null,
        legacy_wp_id: String(item.id ?? ""),
      };

    case "wk_genres":
    case "registry_genres":
      return {
        name: stripHtml(title),
        slug,
        description: stripHtml(content).slice(0, 1000) || null,
        legacy_wp_id: String(item.id ?? ""),
      };

    case "wk_guides":
      return {
        title: stripHtml(title),
        slug,
        body: content,
        excerpt: stripHtml(excerpt).slice(0, 300),
        legacy_wp_id: String(item.id ?? ""),
        status: status === "publish" ? "published" : "draft",
      };

    case "wk_media_assets":
      return {
        title: stripHtml(title),
        alt_text: String(item.alt_text ?? ""),
        source_url: String(item.source_url ?? item.guid?.rendered ?? ""),
        mime_type: String(item.mime_type ?? ""),
        legacy_wp_id: String(item.id ?? ""),
      };

    default:
      return null;
  }
}
