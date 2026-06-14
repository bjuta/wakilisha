import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action = "remap", dry_run = false } = body;

    if (action === "remap") {
      // Step 1: Get all orphan entries (entries whose track_slug doesn't match any active registry track)
      const { data: orphans, error: orphanErr } = await supabase
        .from("wk_chart_entries_v2")
        .select("id, edition_id, rank, track_slug, track_title, artist_name, artist_slug, previous_rank, movement, source_payload, normalized_key, source_urls_seen, artwork_url, release_date, release_recency_days, canonical_track_id, canonical_release_id, canonical_artist_id, source_score, cross_source_bonus, overlap_bonus, recency_score, continuity_score, carry_forward_bonus, airplay_score, anti_gaming_penalty, total_score, carry_forward_only, continuity_locked, airplay_candidate_only, overlap_bonus_capped, lead_artist_overflow, stale_carry_forward_demoted, eligibility_status, eligibility_warnings, scoring_policy_version, methodology_version, eligibility_policy_version, created_at")
        .order("edition_id")
        .order("rank");

      if (orphanErr) throw orphanErr;

      // Get all active scoped track slugs
      const { data: allActiveSlugs, error: slugErr } = await supabase
        .from("registry_tracks")
        .select("slug")
        .eq("status", "active");

      if (slugErr) throw slugErr;

      const activeSlugSet = new Set(allActiveSlugs.map((r: { slug: string }) => r.slug));
      const orphanEntries = orphans.filter((e) => !activeSlugSet.has(e.track_slug));

      console.log(`Found ${orphanEntries.length} orphan entries out of ${orphans.length} total`);

      if (orphanEntries.length === 0) {
        return new Response(JSON.stringify({ success: true, summary: "No orphan entries found - all entries already have scoped slugs." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Get all scoped tracks (with artists) for matching
      const { data: scopedTracks, error: tracksErr } = await supabase
        .from("registry_tracks")
        .select("slug, title, id")
        .eq("status", "active")
        .like("slug", "%-%-%");

      if (tracksErr) throw tracksErr;

      const { data: trackArtists, error: taErr } = await supabase
        .from("registry_track_artists")
        .select("track_id, artist_slug, artist_name");

      if (taErr) throw taErr;

      const { data: artists, error: artistsErr } = await supabase
        .from("registry_artists")
        .select("slug, name");

      if (artistsErr) throw artistsErr;

      // Build lookup: track_id -> artist_slugs, artist_names
      const trackArtistMap = new Map<string, { slugs: string[]; names: string[] }>();
      for (const ta of trackArtists) {
        if (!trackArtistMap.has(ta.track_id)) {
          trackArtistMap.set(ta.track_id, { slugs: [], names: [] });
        }
        const entry = trackArtistMap.get(ta.track_id)!;
        if (ta.artist_slug) entry.slugs.push(ta.artist_slug.toLowerCase());
        if (ta.artist_name) entry.names.push(ta.artist_name.toLowerCase());
      }

      // Build title-based index: lowercased title -> [scoped tracks]
      const titleIndex = new Map<string, Array<{ slug: string; id: string }>>();
      for (const t of scopedTracks) {
        const key = t.title.toLowerCase().trim();
        if (!titleIndex.has(key)) titleIndex.set(key, []);
        titleIndex.get(key)!.push({ slug: t.slug, id: t.id });
      }

      // Step 3: Match each orphan entry
      const updates: Record<string, unknown>[] = [];
      const unmatched: Array<{ track_title: string; artist_name: string; old_slug: string }> = [];
      const ambiguous: Array<{ track_title: string; artist_name: string; candidates: string[]; chosen: string }> = [];

      for (const entry of orphanEntries) {
        const titleLower = (entry.track_title || "").toLowerCase().trim();
        const candidates = titleIndex.get(titleLower) || [];

        if (candidates.length === 0) {
          unmatched.push({
            track_title: entry.track_title,
            artist_name: entry.artist_name || "",
            old_slug: entry.track_slug,
          });
          continue;
        }

        let chosenSlug: string | null = null;

        if (candidates.length === 1) {
          chosenSlug = candidates[0].slug;
        } else {
          // Multiple candidates — disambiguate by artist name
          const entryArtists = (entry.artist_name || "").toLowerCase().split(",").map((s: string) => s.trim());
          
          let bestScore = -1;
          for (const cand of candidates) {
            const trackArts = trackArtistMap.get(cand.id);
            if (!trackArts) continue;
            
            let score = 0;
            for (const ea of entryArtists) {
              // Check if any track artist name or slug matches the entry artist
              for (const tn of trackArts.names) {
                if (tn.includes(ea) || ea.includes(tn)) {
                  score += 2;
                }
              }
              for (const ts of trackArts.slugs) {
                const slugName = ts.replace(/-/g, " ");
                if (slugName.includes(ea) || ea.includes(slugName)) {
                  score += 1;
                }
              }
            }
            
            if (score > bestScore) {
              bestScore = score;
              chosenSlug = cand.slug;
            }
          }

          if (chosenSlug && bestScore > 0) {
            ambiguous.push({
              track_title: entry.track_title,
              artist_name: entry.artist_name || "",
              candidates: candidates.map((c) => c.slug),
              chosen: chosenSlug,
            });
          } else if (chosenSlug && candidates.length > 0) {
            // No artist match found but there are candidates — pick first
            chosenSlug = candidates[0].slug;
          }
        }

        if (chosenSlug) {
          // Get the scoped track's artist info
          const chosenTrack = candidates.find((c) => c.slug === chosenSlug);
          const trackArts = chosenTrack ? trackArtistMap.get(chosenTrack.id) : null;
          const primaryArtistSlug = trackArts && trackArts.slugs.length > 0 ? trackArts.slugs[0] : null;

          const updateRow: Record<string, unknown> = {
            id: entry.id,
            track_slug: chosenSlug,
          };
          if (primaryArtistSlug) {
            updateRow.artist_slug = primaryArtistSlug;
          }
          updates.push(updateRow);
        } else {
          unmatched.push({
            track_title: entry.track_title,
            artist_name: entry.artist_name || "",
            old_slug: entry.track_slug,
          });
        }
      }

      console.log(`Matched: ${updates.length}, Ambiguous: ${ambiguous.length}, Unmatched: ${unmatched.length}`);

      // Step 4: Apply updates (unless dry_run)
      let updated = 0;
      let deleted = 0;

      if (!dry_run && updates.length > 0) {
        // Batch upsert in chunks of 200
        for (let i = 0; i < updates.length; i += 200) {
          const batch = updates.slice(i, i + 200);
          const { error: updErr } = await supabase
            .from("wk_chart_entries_v2")
            .upsert(batch, { onConflict: "id" });
          if (updErr) {
            console.error(`Batch ${i} update failed:`, updErr.message);
          } else {
            updated += batch.length;
          }
        }
      }

      // Step 5: Update remaining unmatched entries - remove them (they reference nonexistent tracks)
      if (!dry_run && unmatched.length > 0) {
        const unmatchedIds = orphanEntries
          .filter((e) => {
            const titleLower = (e.track_title || "").toLowerCase().trim();
            const candidates = titleIndex.get(titleLower) || [];
            const entryArtists = (e.artist_name || "").toLowerCase().split(",").map((s: string) => s.trim());
            
            let chosen = candidates.length > 0 ? candidates[0].slug : null;
            if (candidates.length > 1) {
              let bestScore = -1;
              for (const cand of candidates) {
                const trackArts = trackArtistMap.get(cand.id);
                if (!trackArts) continue;
                let score = 0;
                for (const ea of entryArtists) {
                  for (const tn of trackArts.names) {
                    if (tn.includes(ea) || ea.includes(tn)) score += 2;
                  }
                  for (const ts of trackArts.slugs) {
                    const slugName = ts.replace(/-/g, " ");
                    if (slugName.includes(ea) || ea.includes(slugName)) score += 1;
                  }
                }
                if (score > bestScore) { bestScore = score; chosen = cand.slug; }
              }
            }
            return !chosen || (chosen !== null && bestScore !== undefined && bestScore === 0 && candidates.length === 0) || candidates.length === 0;
          })
          .map((e) => e.id);

        if (unmatchedIds.length > 0) {
          // Delete in chunks
          for (let i = 0; i < unmatchedIds.length; i += 200) {
            const batch = unmatchedIds.slice(i, i + 200);
            const { error: delErr } = await supabase
              .from("wk_chart_entries_v2")
              .delete()
              .in("id", batch);
            if (delErr) {
              console.error(`Delete batch ${i} failed:`, delErr.message);
            } else {
              deleted += batch.length;
            }
          }
        }
      }

      // Step 6: Update edition entry_counts
      if (!dry_run) {
        // Recompute entry_count for all editions
        const { data: editions, error: edErr } = await supabase
          .from("wk_chart_editions_v2")
          .select("id");

        if (!edErr && editions) {
          for (const ed of editions) {
            const { count, error: countErr } = await supabase
              .from("wk_chart_entries_v2")
              .select("id", { count: "exact", head: true })
              .eq("edition_id", ed.id);

            if (!countErr && count != null) {
              await supabase
                .from("wk_chart_editions_v2")
                .update({ entry_count: count, updated_at: new Date().toISOString() })
                .eq("id", ed.id);
            }
          }
        }
      }

      const summary = {
        total_orphans_found: orphanEntries.length,
        matched_and_updated: updated,
        deleted_unmatched: deleted,
        still_unmatched: unmatched.length,
        ambiguous_but_handled: ambiguous.length,
        dry_run,
        unmatched_samples: unmatched.slice(0, 30),
        ambiguous_samples: ambiguous.slice(0, 10),
      };

      return new Response(JSON.stringify({ success: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
