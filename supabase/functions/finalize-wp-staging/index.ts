import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Target entities that go to wk_content_items
const CONTENT_ENTITIES = new Set(["articles", "pages"]);

// Target entities that go to wk_authors
const AUTHOR_ENTITIES = new Set(["authors"]);

// Target entities that go to wk_taxonomy_terms
const TAXONOMY_ENTITIES = new Set(["taxonomy_terms", "artist_taxonomy_terms"]);

// Target entities that go to wk_media_assets
const MEDIA_ENTITIES = new Set(["media_assets"]);

// Target entities that go to wk_import_review_artifacts
const REVIEW_ENTITIES = new Set(["entity_relationships", "custom_fields"]);

// Everything else goes to wk_wakilisha_entities
const WAKILISHA_ENTITIES = new Set([
  "artists", "tracks", "releases", "labels", "genres", "guides",
  "chart_series", "chart_editions", "chart_programs",
  "chart_surfaces", "magazine_surfaces", "magazine_issues",
  "methodologies", "corrections",
  "play_surfaces", "label_surfaces", "settings_surfaces", "profile_surfaces",
  "content_entities",
]);

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "").slice(0, 200);
}

async function promoteToContentItems(
  supabase: ReturnType<typeof createClient>,
  runId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("promote_staging_to_content_items", { run_id: runId });
  if (error) throw new Error(`Content promotion failed: ${error.message}`);
  return data ?? 0;
}

async function promoteToWakilishaEntities(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  entities: string[],
): Promise<number> {
  const { data, error } = await supabase.rpc("promote_staging_to_wakilisha_entities", {
    run_id: runId,
    entity_types: entities,
  });
  if (error) throw new Error(`Wakilisha entity promotion failed: ${error.message}`);
  return data ?? 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { runId } = body;
    if (!runId) {
      return new Response(JSON.stringify({ error: "runId is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the run
    const { data: run, error: runErr } = await supabase
      .from("wk_ingestion_runs").select("*").eq("id", runId).maybeSingle();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Ingestion run not found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (run.status !== "staged") {
      return new Response(JSON.stringify({ error: `Run must be staged. Current status: ${run.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as finalizing
    await supabase.from("wk_ingestion_runs").update({
      status: "finalizing", errors: [],
    }).eq("id", runId);

    // Get all ready records grouped by target entity
    const { data: readyRecords, error: readyErr } = await supabase
      .from("wk_import_staging_records")
      .select("target_entity, id")
      .eq("ingestion_run_id", runId)
      .eq("target_status", "ready");

    if (readyErr) throw new Error(`Failed to query staging records: ${readyErr.message}`);

    if (!readyRecords || readyRecords.length === 0) {
      await supabase.from("wk_ingestion_runs").update({
        status: "finalized",
        finished_at: new Date().toISOString(),
        warnings: supabase.sql`array_append(coalesce(warnings, ''::text[]), 'No ready staging records to finalize.')`,
      }).eq("id", runId);

      return new Response(JSON.stringify({
        success: true, runId,
        message: "No ready records to finalize.",
        summary: { total: 0, content_items: 0, authors: 0, taxonomy_terms: 0, media_assets: 0, wakilisha_entities: 0, review_artifacts: 0 },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by entity type
    const entityGroups: Map<string, string[]> = new Map();
    for (const rec of readyRecords) {
      const entity = rec.target_entity;
      if (!entityGroups.has(entity)) entityGroups.set(entity, []);
      entityGroups.get(entity)!.push(rec.id);
    }

    const summary = { total: readyRecords.length, content_items: 0, authors: 0, taxonomy_terms: 0, media_assets: 0, wakilisha_entities: 0, review_artifacts: 0 };
    const promotionEvents: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (const [targetEntity, stagingIds] of entityGroups) {
      try {
        if (CONTENT_ENTITIES.has(targetEntity)) {
          // Promote to wk_content_items
          const contentPromoted = 0;
          for (const sid of stagingIds) {
            const { data: rec, error: recErr } = await supabase
              .from("wk_import_staging_records")
              .select("*")
              .eq("id", sid)
              .maybeSingle();

            if (recErr || !rec) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_content_items", event_type: "failed",
                message: recErr ? recErr.message : "Record not found",
              });
              continue;
            }

            const content_type = targetEntity === "pages" ? "page" : "article";
            const status = rec.mapped_record?.source_status === "publish" ? "published" : "draft";

            const { error: insertErr } = await supabase.from("wk_content_items").insert({
              content_type,
              slug: rec.target_slug || slugify(rec.title || sid),
              title: rec.title || "Untitled",
              body: rec.body || "",
              excerpt: rec.excerpt || "",
              status,
              published_at: rec.published_at,
              author_name: rec.author_name,
              source_url: rec.source_url,
              source_kind: rec.source_kind,
              source_ingestion_run_id: runId,
              source_staging_record_id: sid,
              source_record_id: rec.source_record_id,
              raw_record: rec.raw_record,
              mapped_record: rec.mapped_record,
            });

            if (insertErr) {
              if (insertErr.message.includes("duplicate key") || insertErr.code === "23505") {
                promotionEvents.push({
                  ingestion_run_id: runId, staging_record_id: sid,
                  target_table: "wk_content_items", event_type: "skipped",
                  message: "Duplicate slug — already exists.",
                });
              } else {
                promotionEvents.push({
                  ingestion_run_id: runId, staging_record_id: sid,
                  target_table: "wk_content_items", event_type: "failed",
                  message: insertErr.message,
                });
              }
            } else {
              summary.content_items++;
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_content_items", event_type: "promoted",
                message: `Promoted ${targetEntity} record.`,
              });
            }
          }
        } else if (AUTHOR_ENTITIES.has(targetEntity)) {
          for (const sid of stagingIds) {
            const { data: rec, error: recErr } = await supabase
              .from("wk_import_staging_records")
              .select("*")
              .eq("id", sid)
              .maybeSingle();

            if (recErr || !rec) continue;

            const { error: insertErr } = await supabase.from("wk_authors").insert({
              slug: rec.target_slug || slugify(rec.title || sid),
              name: rec.title || "Unknown Author",
              email: rec.mapped_record?.email || null,
              url: rec.mapped_record?.url || null,
              source_kind: rec.source_kind,
              source_ingestion_run_id: runId,
              source_staging_record_id: sid,
              source_record_id: rec.source_record_id,
              raw_record: rec.raw_record,
              mapped_record: rec.mapped_record,
            });

            if (insertErr) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_authors", event_type: insertErr.code === "23505" ? "skipped" : "failed",
                message: insertErr.message,
              });
            } else {
              summary.authors++;
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_authors", event_type: "promoted",
                message: "Promoted author record.",
              });
            }
          }
        } else if (TAXONOMY_ENTITIES.has(targetEntity)) {
          for (const sid of stagingIds) {
            const { data: rec, error: recErr } = await supabase
              .from("wk_import_staging_records")
              .select("*")
              .eq("id", sid)
              .maybeSingle();

            if (recErr || !rec) continue;

            const taxonomy = rec.mapped_record?.taxonomy || "term";
            const { error: insertErr } = await supabase.from("wk_taxonomy_terms").insert({
              taxonomy,
              slug: rec.target_slug || slugify(rec.title || sid),
              name: rec.title || "Unnamed",
              description: rec.body || null,
              source_kind: rec.source_kind,
              source_ingestion_run_id: runId,
              source_staging_record_id: sid,
              source_record_id: rec.source_record_id,
              raw_record: rec.raw_record,
              mapped_record: rec.mapped_record,
            });

            if (insertErr) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_taxonomy_terms", event_type: insertErr.code === "23505" ? "skipped" : "failed",
                message: insertErr.message,
              });
            } else {
              summary.taxonomy_terms++;
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_taxonomy_terms", event_type: "promoted",
                message: `Promoted ${taxonomy} term record.`,
              });
            }
          }
        } else if (MEDIA_ENTITIES.has(targetEntity)) {
          for (const sid of stagingIds) {
            const { data: rec, error: recErr } = await supabase
              .from("wk_import_staging_records")
              .select("*")
              .eq("id", sid)
              .maybeSingle();

            if (recErr || !rec) continue;

            if (!rec.source_url) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_media_assets", event_type: "skipped",
                message: "No source_url — media asset requires a URL.",
              });
              continue;
            }

            const { error: insertErr } = await supabase.from("wk_media_assets").insert({
              slug: rec.target_slug || slugify(rec.title || sid),
              title: rec.title || "Untitled Media",
              source_url: rec.source_url,
              mime_type: rec.mapped_record?.mime_type || null,
              status: "needs_review",
              source_kind: rec.source_kind,
              source_ingestion_run_id: runId,
              source_staging_record_id: sid,
              source_record_id: rec.source_record_id,
              raw_record: rec.raw_record,
              mapped_record: rec.mapped_record,
            });

            if (insertErr) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_media_assets", event_type: insertErr.code === "23505" ? "skipped" : "failed",
                message: insertErr.message,
              });
            } else {
              summary.media_assets++;
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_media_assets", event_type: "promoted",
                message: "Promoted media asset record.",
              });
            }
          }
        } else if (WAKILISHA_ENTITIES.has(targetEntity)) {
          // Promote to wk_wakilisha_entities
          for (const sid of stagingIds) {
            const { data: rec, error: recErr } = await supabase
              .from("wk_import_staging_records")
              .select("*")
              .eq("id", sid)
              .maybeSingle();

            if (recErr || !rec) continue;

            const status = rec.mapped_record?.source_status === "publish" ? "published" : "draft";
            const { error: insertErr } = await supabase.from("wk_wakilisha_entities").insert({
              entity_type: targetEntity,
              slug: rec.target_slug || slugify(rec.title || sid),
              title: rec.title || "Untitled",
              body: rec.body || "",
              excerpt: rec.excerpt || "",
              status,
              published_at: rec.published_at,
              source_url: rec.source_url,
              source_kind: rec.source_kind,
              source_ingestion_run_id: runId,
              source_staging_record_id: sid,
              source_record_id: rec.source_record_id,
              raw_record: rec.raw_record,
              mapped_record: rec.mapped_record,
            });

            if (insertErr) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_wakilisha_entities", event_type: insertErr.code === "23505" ? "skipped" : "failed",
                message: insertErr.message,
              });
            } else {
              summary.wakilisha_entities++;
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_wakilisha_entities", event_type: "promoted",
                message: `Promoted ${targetEntity} wakilisha entity record.`,
              });
            }
          }
        } else if (REVIEW_ENTITIES.has(targetEntity)) {
          for (const sid of stagingIds) {
            const { data: rec, error: recErr } = await supabase
              .from("wk_import_staging_records")
              .select("*")
              .eq("id", sid)
              .maybeSingle();

            if (recErr || !rec) continue;

            const { error: insertErr } = await supabase.from("wk_import_review_artifacts").insert({
              artifact_type: targetEntity,
              title: rec.title || null,
              source_kind: rec.source_kind,
              source_ingestion_run_id: runId,
              source_staging_record_id: sid,
              source_record_id: rec.source_record_id,
              raw_record: rec.raw_record,
              mapped_record: rec.mapped_record,
              review_status: "needs_review",
              notes: "Relationship/custom-field artifact preserved for resolver review.",
            });

            if (insertErr) {
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_import_review_artifacts", event_type: insertErr.code === "23505" ? "skipped" : "failed",
                message: insertErr.message,
              });
            } else {
              summary.review_artifacts++;
              promotionEvents.push({
                ingestion_run_id: runId, staging_record_id: sid,
                target_table: "wk_import_review_artifacts", event_type: "promoted",
                message: `Preserved ${targetEntity} as review artifact.`,
              });
            }
          }
        } else {
          // Unknown target entity — skip
          for (const sid of stagingIds) {
            promotionEvents.push({
              ingestion_run_id: runId, staging_record_id: sid,
              target_table: "unknown", event_type: "skipped",
              message: `Unknown target entity: ${targetEntity}`,
            });
          }
        }
      } catch (entityErr) {
        const msg = entityErr instanceof Error ? entityErr.message : "Unknown";
        errors.push(`${targetEntity}: ${msg}`);
      }
    }

    // Count also non-ready records that were skipped
    const { count: skippedCount } = await supabase
      .from("wk_import_staging_records")
      .select("*", { count: "exact", head: true })
      .eq("ingestion_run_id", runId)
      .neq("target_status", "ready");

    // Insert promotion events
    if (promotionEvents.length > 0) {
      await supabase.from("wk_import_promotion_events").insert(promotionEvents);
    }

    const totalFinalized = summary.content_items + summary.authors + summary.taxonomy_terms + summary.media_assets + summary.wakilisha_entities + summary.review_artifacts;
    const finalizationPayload = {
      finalized_at: new Date().toISOString(),
      processor: "finalize-wp-staging",
      version: "1.0.0",
      finalized: totalFinalized,
      skipped: skippedCount ?? 0,
      counts_by_target_entity: summary,
      only_ready_records: true,
    };

    const updatedManifest = {
      ...(run.source_manifest ?? {}),
      finalization: finalizationPayload,
    };

    const warnings = [
      ...(run.warnings ?? []),
      `Finalized ${totalFinalized} records across ${Object.values(summary).filter((v) => v > 0).length} target groups.`,
      skippedCount && skippedCount > 0 ? `${skippedCount} non-ready staging records were skipped (needs_review/blocked/draft).` : "",
      errors.length > 0 ? `${errors.length} entity group errors during finalization.` : "",
    ].filter(Boolean);

    await supabase.from("wk_ingestion_runs").update({
      status: "finalized",
      finished_at: new Date().toISOString(),
      source_manifest: updatedManifest,
      warnings,
      errors: errors.slice(0, 200),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true,
      runId,
      summary,
      totalFinalized,
      skipped: skippedCount ?? 0,
      promotionEvents: promotionEvents.length,
      errorCount: errors.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
