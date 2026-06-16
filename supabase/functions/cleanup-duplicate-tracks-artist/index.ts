
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) return respond({ error: "Supabase config missing" }, 500);

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* ok */ }

    const artistSlug = String(body.artistSlug ?? "").trim();
    const dryRun = body.dryRun !== false; // default to dry run for safety

    if (!artistSlug) return respond({ error: "Missing artistSlug" }, 400);

    // 1. Get all tracks for this artist
    const { data: trackRows, error: trackErr } = await supabase
      .from("registry_track_artists")
      .select("track_id, artist_slug, artist_id")
      .eq("artist_slug", artistSlug)
      .eq("status", "active");

    if (trackErr || !trackRows) {
      return respond({ error: `Failed to fetch track artists: ${trackErr?.message}` }, 500);
    }

    const trackIds = [...new Set(trackRows.map(r => r.track_id))];

    // 2. Get the actual track records
    const { data: tracks, error: tracksErr } = await supabase
      .from("registry_tracks")
      .select("id, slug, title, normalized_title, status")
      .in("id", trackIds)
      .eq("status", "active");

    if (tracksErr || !tracks) {
      return respond({ error: `Failed to fetch tracks: ${tracksErr?.message}` }, 500);
    }

    const scopedPrefix = `${artistSlug}--`;

    // Build lookup: normalized_title → scoped track (the canonical one to keep)
    const scopedByNormTitle = new Map<string, { id: string; slug: string; title: string }>();
    const simpleTracks: Array<{ id: string; slug: string; title: string; normalized_title: string }> = [];

    for (const t of tracks) {
      if (t.slug.startsWith(scopedPrefix)) {
        scopedByNormTitle.set(t.normalized_title, { id: t.id, slug: t.slug, title: t.title });
      } else {
        simpleTracks.push({ id: t.id, slug: t.slug, title: t.title, normalized_title: t.normalized_title });
      }
    }

    // 3. Find simple tracks that have a scoped counterpart
    const toDeactivate: Array<{ simple: typeof simpleTracks[0]; scoped: { id: string; slug: string; title: string } }> = [];
    const unmatched: typeof simpleTracks = [];

    for (const st of simpleTracks) {
      const scoped = scopedByNormTitle.get(st.normalized_title);
      if (scoped) {
        toDeactivate.push({ simple: st, scoped });
      } else {
        unmatched.push(st);
      }
    }

    const results: Record<string, unknown> = {
      artist_slug: artistSlug,
      dry_run: dryRun,
      total_tracks: tracks.length,
      scoped_tracks: scopedByNormTitle.size,
      simple_tracks: simpleTracks.length,
      matched_pairs: toDeactivate.length,
      unmatched_simple: unmatched.length,
      unmatched_list: unmatched.map(t => ({ slug: t.slug, title: t.title })),
      actions: [] as Array<Record<string, unknown>>,
    };

    // 4. For each pair: remap references then deactivate the simple track
    for (const { simple, scoped } of toDeactivate) {
      const action: Record<string, unknown> = {
        simple_slug: simple.slug,
        simple_id: simple.id,
        scoped_slug: scoped.slug,
        scoped_id: scoped.id,
        title: simple.title,
        steps: [] as string[],
      };

      // 4a. Remap chart entries
      const { data: chartEntries, error: ceErr } = await supabase
        .from("wk_chart_entries_v2")
        .select("id")
        .eq("track_slug", simple.slug);

      if (!ceErr && chartEntries && chartEntries.length > 0) {
        action.steps.push(`chart_entries_to_remap: ${chartEntries.length}`);
        if (!dryRun) {
          const { error: updateErr } = await supabase
            .from("wk_chart_entries_v2")
            .update({ track_slug: scoped.slug })
            .eq("track_slug", simple.slug);
          if (updateErr) {
            action.steps.push(`chart_entries_error: ${updateErr.message}`);
          } else {
            action.steps.push(`chart_entries_remapped: ${chartEntries.length}`);
          }
        }
      }

      // 4b. Remap release_tracks
      const { data: releaseTracks } = await supabase
        .from("registry_release_tracks")
        .select("release_id")
        .eq("track_id", simple.id);

      if (releaseTracks && releaseTracks.length > 0) {
        action.steps.push(`release_tracks_to_remap: ${releaseTracks.length}`);
        if (!dryRun) {
          for (const rt of releaseTracks) {
            const { error: rtErr } = await supabase
              .from("registry_release_tracks")
              .upsert({
                release_id: rt.release_id,
                track_id: scoped.id,
                source: "cleanup_dedup",
                status: "active",
              }, { onConflict: "release_id,track_id", ignoreDuplicates: true });

            if (!rtErr) {
              await supabase
                .from("registry_release_tracks")
                .update({ status: "inactive" })
                .eq("release_id", rt.release_id)
                .eq("track_id", simple.id);
            }
          }
          action.steps.push(`release_tracks_remapped: ${releaseTracks.length}`);
        }
      }

      // 4c. Remap entity relationships
      const { data: rels } = await supabase
        .from("registry_entity_relationships")
        .select("id")
        .eq("target_slug", simple.slug)
        .eq("target_entity_type", "track");

      if (rels && rels.length > 0) {
        action.steps.push(`entity_rels_to_remap: ${rels.length}`);
        if (!dryRun) {
          const { error: relErr } = await supabase
            .from("registry_entity_relationships")
            .update({ target_slug: scoped.slug })
            .eq("target_slug", simple.slug)
            .eq("target_entity_type", "track");
          if (relErr) {
            action.steps.push(`entity_rels_error: ${relErr.message}`);
          } else {
            action.steps.push(`entity_rels_remapped: ${rels.length}`);
          }
        }
      }

      // 4d. Deactivate simple track
      action.steps.push("deactivate_simple_track");
      if (!dryRun) {
        const { error: deactErr } = await supabase
          .from("registry_tracks")
          .update({ status: "inactive" })
          .eq("id", simple.id);
        if (deactErr) {
          action.steps.push(`deactivate_error: ${deactErr.message}`);
        }
      }

      // 4e. Deactivate associated track_artists for simple track
      action.steps.push("deactivate_track_artists");
      if (!dryRun) {
        await supabase
          .from("registry_track_artists")
          .update({ status: "inactive" })
          .eq("track_id", simple.id)
          .eq("status", "active");
      }

      (results.actions as Array<Record<string, unknown>>).push(action);
    }

    return respond(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return respond({ error: "Internal error", detail: msg }, 500);
  }
});
