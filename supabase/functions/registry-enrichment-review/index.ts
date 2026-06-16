import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

/** Parse Apple Music artistName like "Bensoul & Bien" or "Bensoul, Mordecai Dex & Okello Max" */
function parseArtistNames(artistName: string): { primary: string; featured: string[] } {
  if (!artistName) return { primary: "", featured: [] };
  const parts = artistName.split(/\s*&\s*/);
  const firstPart = parts[0] ?? "";
  const firstCommaParts = firstPart.split(/\s*,\s*/);
  const primary = firstCommaParts[0]?.trim() ?? "";
  const featured = [...firstCommaParts.slice(1), ...parts.slice(1)].map((s) => s.trim()).filter(Boolean);
  return { primary, featured };
}

async function findOrCreateArtist(
  db: ReturnType<typeof getSupabaseClient>,
  artistName: string,
  now: string,
): Promise<string | null> {
  const slug = slugify(artistName);
  if (!slug) return null;
  // Match both active AND draft artists — draft profiles from discography intake are valid
  const { data: existing } = await db.from("registry_artists").select("id").eq("slug", slug).in("status", ["active", "draft"]).maybeSingle();
  if (existing) return existing.id as string;
  const { data: byName } = await db.from("registry_artists").select("id").eq("display_name", artistName).in("status", ["active", "draft"]).maybeSingle();
  if (byName) return byName.id as string;
  const newId = crypto.randomUUID();
  const normalized = artistName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { error: insErr } = await db.from("registry_artists").insert({
    id: newId, slug, display_name: artistName, normalized_name: normalized,
    sort_name: artistName, artist_type: "person", status: "active",
    metadata: {}, created_at: now, updated_at: now,
  });
  if (insErr) { console.error(`[findOrCreateArtist] failed "${artistName}":`, insErr.message); return null; }
  console.log(`[findOrCreateArtist] created "${artistName}" (${slug})`);
  return newId;
}

async function resolveReleaseCollision(
  db: ReturnType<typeof getSupabaseClient>, shellId: string, releaseId: string, releaseTitle: string, now: string,
): Promise<{ releaseId: string; release: Record<string, unknown>; resolved: boolean } | null> {
  const { data: activeDup } = await db.from("registry_releases").select("id, title, release_date, artwork_url, status, slug").eq("title", releaseTitle).eq("status", "active").maybeSingle();
  if (!activeDup) return null;
  await db.from("registry_release_shells").update({ release_id: activeDup.id, updated_at: now }).eq("id", shellId);
  await db.from("registry_release_tracks").delete().eq("release_id", releaseId);
  await db.from("registry_releases").delete().eq("id", releaseId);
  return { releaseId: activeDup.id, release: activeDup, resolved: true };
}

async function findOrCreateLabel(
  db: ReturnType<typeof getSupabaseClient>, labelName: string, now: string,
): Promise<string | null> {
  if (!labelName) return null;
  const slug = slugify(labelName);
  const { data: existing } = await db.from("registry_labels").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
  if (existing) return existing.id as string;
  const newId = crypto.randomUUID();
  const normalized = labelName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { error: insErr } = await db.from("registry_labels").insert({
    id: newId, slug, name: labelName, normalized_name: normalized, status: "active", metadata: {}, created_at: now, updated_at: now,
  });
  if (insErr) { console.error(`[findOrCreateLabel] failed "${labelName}":`, insErr.message); return null; }
  console.log(`[findOrCreateLabel] created "${labelName}" (${slug})`);
  return newId;
}

/** Create an entity relationship if it doesn't already exist */
async function ensureEntityRelationship(
  db: ReturnType<typeof getSupabaseClient>,
  sourceEntityType: string,
  sourceSlug: string,
  targetEntityType: string,
  targetSlug: string,
  relationshipType: string,
  relationshipRole: string,
  confidence: number,
  sortOrder: number,
  metadata: Record<string, unknown>,
  now: string,
): Promise<void> {
  const { data: existing } = await db.from("registry_entity_relationships")
    .select("id")
    .eq("source_entity_type", sourceEntityType)
    .eq("source_slug", sourceSlug)
    .eq("target_entity_type", targetEntityType)
    .eq("target_slug", targetSlug)
    .eq("relationship_type", relationshipType)
    .maybeSingle();
  if (existing) return; // already exists
  const { error } = await db.from("registry_entity_relationships").insert({
    id: crypto.randomUUID(),
    source_entity_type: sourceEntityType,
    source_slug: sourceSlug,
    target_entity_type: targetEntityType,
    target_slug: targetSlug,
    relationship_type: relationshipType,
    relationship_role: relationshipRole,
    relationship_status: "active",
    confidence,
    sort_order: sortOrder,
    metadata,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    console.error(`[ensureEntityRelationship] failed ${sourceEntityType}/${sourceSlug} -> ${targetEntityType}/${targetSlug} (${relationshipType}):`, error.message);
  }
}

async function writeTracksToRelease(
  db: ReturnType<typeof getSupabaseClient>,
  releaseId: string,
  releaseSlug: string,
  shellTracks: Array<Record<string, unknown>>,
  primaryArtistName: string,
  primaryArtistSlug: string,
  now: string,
): Promise<{ tracksCreated: number; trackJoinsCreated: number; trackArtistsCreated: number; featuredArtistsCreated: number; entityRelationshipsCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let tracksCreated = 0, trackJoinsCreated = 0, trackArtistsCreated = 0, featuredArtistsCreated = 0, entityRelationshipsCreated = 0;

  const { error: delErr } = await db.from("registry_release_tracks").delete().eq("release_id", releaseId);
  if (delErr) { errors.push(`delete old joins: ${delErr.message}`); console.error("[writeTracksToRelease] delete failed:", delErr.message); }

  console.log(`[writeTracksToRelease] processing ${shellTracks.length} tracks for release ${releaseId} (slug: ${releaseSlug})`);

  for (let i = 0; i < shellTracks.length; i++) {
    const t = shellTracks[i];
    const trackTitle = (t.title as string) || "Untitled";
    const isrc = (t.isrc as string) || null;
    const trackSlug = slugify(trackTitle);
    const scopedTrackSlug = `${primaryArtistSlug}--${trackSlug}`;
    const trackNumber = (t.trackNumber as number) ?? (i + 1);
    const rawArtistName = (t.artistName as string) || primaryArtistName || "Unknown";
    const { primary: parsedPrimary, featured: parsedFeatured } = parseArtistNames(rawArtistName);

    console.log(`[writeTracksToRelease] track ${i + 1}/${shellTracks.length}: "${trackTitle}" artistName="${rawArtistName}" -> primary="${parsedPrimary}" featured=[${parsedFeatured.join(", ")}]`);

    let trackId: string;
    if (isrc) {
      const { data: byIsrc } = await db.from("registry_tracks").select("id").eq("isrc", isrc).maybeSingle();
      if (byIsrc) {
        trackId = byIsrc.id as string;
        await db.from("registry_tracks").update({
          title: trackTitle,
          normalized_title: trackTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          slug: scopedTrackSlug, duration_ms: (t.durationMs as number) ?? null,
          preview_url: (t.previewUrl as string) ?? null, artwork_url: (t.artworkUrl as string) ?? null,
          track_number: trackNumber, disc_number: 1, updated_at: now,
        }).eq("id", trackId);
      } else {
        const { data: bySlug } = await db.from("registry_tracks").select("id, slug, isrc").eq("slug", scopedTrackSlug).maybeSingle();
        if (bySlug) {
          trackId = bySlug.id as string;
          console.log(`[writeTracksToRelease] ISRC not found but slug ${scopedTrackSlug} exists — updating with ISRC + metadata`);
          const { error: updErr } = await db.from("registry_tracks").update({
            title: trackTitle,
            normalized_title: trackTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            isrc, duration_ms: (t.durationMs as number) ?? null,
            preview_url: (t.previewUrl as string) ?? null, artwork_url: (t.artworkUrl as string) ?? null,
            track_number: trackNumber, disc_number: 1, updated_at: now,
          }).eq("id", trackId);
          if (updErr) { errors.push(`update slug-match "${trackTitle}": ${updErr.message}`); console.error("[writeTracksToRelease] update slug-match failed:", updErr); }
        } else {
          trackId = crypto.randomUUID();
          const { error: insErr } = await db.from("registry_tracks").insert({
            id: trackId, slug: scopedTrackSlug, title: trackTitle,
            normalized_title: trackTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            isrc, duration_ms: (t.durationMs as number) ?? null,
            preview_url: (t.previewUrl as string) ?? null, artwork_url: (t.artworkUrl as string) ?? null,
            track_number: trackNumber, disc_number: 1, status: "active", metadata: {}, created_at: now, updated_at: now,
          });
          if (insErr) { errors.push(`insert "${trackTitle}" (isrc=${isrc}): ${insErr.message}`); console.error("[writeTracksToRelease] insert failed:", insErr); continue; }
          tracksCreated++;
        }
      }
    } else {
      const { data: bySlug } = await db.from("registry_tracks").select("id").eq("slug", scopedTrackSlug).maybeSingle();
      if (bySlug) {
        trackId = bySlug.id as string;
        await db.from("registry_tracks").update({
          title: trackTitle, duration_ms: (t.durationMs as number) ?? null,
          preview_url: (t.previewUrl as string) ?? null, artwork_url: (t.artworkUrl as string) ?? null,
          track_number: trackNumber, disc_number: 1, updated_at: now,
        }).eq("id", trackId);
      } else {
        trackId = crypto.randomUUID();
        const { error: insErr } = await db.from("registry_tracks").insert({
          id: trackId, slug: scopedTrackSlug, title: trackTitle,
          normalized_title: trackTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          duration_ms: (t.durationMs as number) ?? null,
          preview_url: (t.previewUrl as string) ?? null, artwork_url: (t.artworkUrl as string) ?? null,
          track_number: trackNumber, disc_number: 1, status: "active", metadata: {}, created_at: now, updated_at: now,
        });
        if (insErr) { errors.push(`insert (no isrc) "${trackTitle}": ${insErr.message}`); console.error("[writeTracksToRelease] insert (no isrc) failed:", insErr); continue; }
        tracksCreated++;
      }
    }

    const attribution: Record<string, unknown> = { raw: rawArtistName, primary: parsedPrimary, featured: parsedFeatured };
    const joinMetadata: Record<string, unknown> = {
      artist_attribution: attribution,
      preview_url: (t.previewUrl as string) ?? null,
      artwork_url: (t.artworkUrl as string) ?? null,
      source_provider: "apple_music",
      source_track_id: (t.id as string) ?? null,
    };

    const { error: rtErr } = await db.from("registry_release_tracks").insert({
      id: crypto.randomUUID(), release_id: releaseId, track_id: trackId,
      disc_number: 1, track_number: trackNumber, source: "provider_intake", confidence: 90, status: "active",
      metadata: joinMetadata, created_at: now, updated_at: now,
    });
    if (rtErr) { errors.push(`join (release=${releaseId}, track=${trackId}): ${rtErr.message}`); console.error("[writeTracksToRelease] join failed:", rtErr); continue; }
    trackJoinsCreated++;

    // Primary track artist — match active AND draft artists
    if (parsedPrimary) {
      const primarySlug = slugify(parsedPrimary);
      const { data: pa } = await db.from("registry_artists").select("id").eq("slug", primarySlug).in("status", ["active", "draft"]).maybeSingle();
      let paId = pa ? pa.id as string : null;
      if (!paId) {
        paId = await findOrCreateArtist(db, parsedPrimary, now);
      }
      if (paId) {
        const { data: existTa } = await db.from("registry_track_artists").select("id").eq("track_id", trackId).eq("artist_id", paId).maybeSingle();
        if (!existTa) {
          const { error: taErr } = await db.from("registry_track_artists").insert({
            id: crypto.randomUUID(), track_id: trackId, artist_id: paId,
            artist_slug: primarySlug, artist_name_text: parsedPrimary,
            role: "primary", is_primary: true, is_featured: false, credit_order: 0,
            source: "provider_intake", confidence: 85, status: "active", metadata: {}, created_at: now, updated_at: now,
          });
          if (!taErr) trackArtistsCreated++; else errors.push(`primary "${parsedPrimary}" on "${trackTitle}": ${taErr.message}`);
        }
        // Entity relationship: track PERFORMED_BY primary artist
        await ensureEntityRelationship(db, "track", scopedTrackSlug, "artist", primarySlug, "PERFORMED_BY", "primary", 90, 0, {}, now);
        entityRelationshipsCreated++;
      }
    }

    // Featured track artists — match active AND draft artists
    for (let fi = 0; fi < parsedFeatured.length; fi++) {
      const fname = parsedFeatured[fi];
      const fslug = slugify(fname);
      if (!fslug) continue;
      const { data: fa } = await db.from("registry_artists").select("id").eq("slug", fslug).in("status", ["active", "draft"]).maybeSingle();
      let faId: string | null = fa ? fa.id as string : await findOrCreateArtist(db, fname, now);
      if (faId) {
        const { data: existFa } = await db.from("registry_track_artists").select("id").eq("track_id", trackId).eq("artist_id", faId).maybeSingle();
        if (!existFa) {
          const { error: faErr } = await db.from("registry_track_artists").insert({
            id: crypto.randomUUID(), track_id: trackId, artist_id: faId,
            artist_slug: fslug, artist_name_text: fname,
            role: "featured", is_primary: false, is_featured: true, credit_order: fi + 1,
            source: "provider_intake", confidence: 85, status: "active", metadata: {}, created_at: now, updated_at: now,
          });
          if (!faErr) featuredArtistsCreated++; else errors.push(`featured "${fname}" on "${trackTitle}": ${faErr.message}`);
        }
        // Entity relationship: track FEATURED_ON featured artist
        await ensureEntityRelationship(db, "track", scopedTrackSlug, "artist", fslug, "FEATURED_ON", "featured", 85, fi + 1, {}, now);
        entityRelationshipsCreated++;
      }
    }
  }

  console.log(`[writeTracksToRelease] done: created=${tracksCreated} joins=${trackJoinsCreated} primary=${trackArtistsCreated} featured=${featuredArtistsCreated} relationships=${entityRelationshipsCreated} errors=${errors.length}`);
  return { tracksCreated, trackJoinsCreated, trackArtistsCreated, featuredArtistsCreated, entityRelationshipsCreated, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    const supabase = getSupabaseClient();
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    const actor = user?.id ?? "system";
    const now = new Date().toISOString();

    // GET /release-comparison/:id
    const relCompMatch = path.match(/\/release-comparison\/([^/]+)/);
    if (relCompMatch && req.method === "GET") {
      const releaseId = relCompMatch[1];
      const { data: rel } = await supabase.from("registry_releases").select("id, slug, title, release_date, artwork_url, status").eq("id", releaseId).maybeSingle();
      if (!rel) return errorResponse("Release not found", 404);
      const { data: rts } = await supabase.from("registry_release_tracks").select("track_id, track_number, disc_number").eq("release_id", releaseId).order("disc_number").order("track_number");
      const trackIds = (rts ?? []).map((rt) => rt.track_id);
      let tracks: Array<Record<string, unknown>> = [];
      if (trackIds.length > 0) {
        const { data: td } = await supabase.from("registry_tracks").select("id, title, track_number, disc_number, duration_ms, isrc").in("id", trackIds);
        tracks = td ?? [];
      }
      return jsonResponse({ data: { id: rel.id, slug: rel.slug, title: rel.title, artistName: null, releaseDate: rel.release_date, artworkUrl: rel.artwork_url, status: rel.status, trackCount: tracks.length, tracks: tracks.map((t) => ({ title: t.title, trackNumber: t.track_number, durationMs: t.duration_ms, isrc: t.isrc })) } });
    }

    // POST /canonicalize
    if (path.endsWith("/canonicalize") && req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string;
      const overrides = (body.overrides as Record<string, unknown>) ?? {};
      if (!registryEntityId) return errorResponse("Missing registryEntityId", 400);

      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, title, primary_artist_name, primary_artist_slug, release_date, tracks, source_provenance, status").eq("id", registryEntityId).maybeSingle();
      if (!shell) return errorResponse("Shell not found", 404);
      let releaseId = shell.release_id as string;
      if (!releaseId) return errorResponse("Shell has no linked release", 400);

      const { data: release } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url, status, slug, upc, label_id, metadata").eq("id", releaseId).maybeSingle();
      if (!release) return errorResponse("Linked release not found", 404);

      let collisionResolved = false;
      if (release.status !== "active") {
        const resolved = await resolveReleaseCollision(supabase, registryEntityId, releaseId, release.title, now);
        if (resolved) { releaseId = resolved.releaseId; collisionResolved = true; }
      }

      const { data: targetRelease } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url, status, slug, upc, label_id, metadata").eq("id", releaseId).maybeSingle();
      if (!targetRelease) return errorResponse("Target release not found after collision resolution", 404);

      const releaseSlug = targetRelease.slug as string;

      const provenance = (shell.source_provenance ?? {}) as Record<string, unknown>;
      const releaseUpdates: Record<string, unknown> = { updated_at: now, status: "active" };
      const sTitle = (overrides.title ?? shell.title ?? targetRelease.title) as string;
      const sDate = (overrides.release_date ?? shell.release_date ?? targetRelease.release_date) as string;
      const sArtwork = (overrides.artwork_url ?? provenance.artwork_url ?? targetRelease.artwork_url) as string;
      const sLabel = (overrides.label ?? provenance.record_label) as string | null;
      const sUpc = (overrides.upc ?? provenance.upc) as string | null;
      const sGenres = (overrides.genre_names ?? provenance.genre_names) as string[] | null;

      if (sTitle && sTitle !== targetRelease.title) releaseUpdates.title = sTitle;
      if (sDate && sDate !== targetRelease.release_date) releaseUpdates.release_date = sDate;
      if (sArtwork && sArtwork !== targetRelease.artwork_url) releaseUpdates.artwork_url = sArtwork;
      if (sUpc && sUpc !== targetRelease.upc) releaseUpdates.upc = sUpc;
      if (sLabel) { const lid = await findOrCreateLabel(supabase, sLabel, now); if (lid) releaseUpdates.label_id = lid; }
      if (sGenres && sGenres.length > 0) {
        const em = (targetRelease.metadata ?? {}) as Record<string, unknown>;
        releaseUpdates.metadata = { ...em, apple_music_genres: sGenres };
      }
      const em = (releaseUpdates.metadata ?? (targetRelease.metadata ?? {})) as Record<string, unknown>;
      releaseUpdates.metadata = { ...em, provider: provenance.provider ?? em.provider, provider_url: provenance.provider_url ?? em.provider_url, provider_entity_id: provenance.provider_entity_id ?? em.provider_entity_id, artist_name: provenance.artist_name ?? em.artist_name };

      const { error: updErr } = await supabase.from("registry_releases").update(releaseUpdates).eq("id", releaseId);
      if (updErr) { console.error("[canonicalize] release update failed:", updErr.message); return errorResponse("Failed to update release: " + updErr.message, 500); }

      const shellTracks = (shell.tracks as Array<Record<string, unknown>>) ?? [];
      const paName = (shell.primary_artist_name as string) || "Unknown";
      const paSlug = (shell.primary_artist_slug as string) || slugify(paName);
      const trackResult = await writeTracksToRelease(supabase, releaseId, releaseSlug, shellTracks, paName, paSlug, now);

      // Release-artist — match active AND draft
      let releaseArtistsCreated = 0;
      const { data: raArtist } = await supabase.from("registry_artists").select("id").eq("slug", paSlug).in("status", ["active", "draft"]).maybeSingle();
      if (raArtist) {
        const { data: existRa } = await supabase.from("registry_release_artists").select("id").eq("release_id", releaseId).eq("artist_id", raArtist.id).maybeSingle();
        if (!existRa) {
          const { error: raErr } = await supabase.from("registry_release_artists").insert({
            id: crypto.randomUUID(), release_id: releaseId, artist_id: raArtist.id, artist_slug: paSlug, artist_name_text: paName,
            role: "album_artist", is_primary: true, is_featured: false, credit_order: 0,
            source: "provider_intake", confidence: 90, status: "active", metadata: {}, created_at: now, updated_at: now,
          });
          if (!raErr) releaseArtistsCreated++;
        }
        // Entity relationship: release RELEASED_BY primary artist
        await ensureEntityRelationship(supabase, "release", releaseSlug, "artist", paSlug, "RELEASED_BY", "album_artist", 90, 0, {}, now);
      }

      // Set shell to canonicalized LAST — after all operations succeed
      await supabase.from("registry_release_shells").update({ status: "canonicalized", updated_at: now }).eq("id", registryEntityId);
      await supabase.from("registry_canonical_write_events").insert({
        registry_entity_type: "release", registry_entity_id: registryEntityId, source_suggestion_id: null, source_table: "registry_release_shells",
        field_name: "canonicalize", target_path: "release", before_value: shell.status, after_value: "canonicalized",
        action: "canonicalize", status: "applied", error_message: null, actor, created_at: now,
      });

      return jsonResponse({ data: { registryEntityId, releaseId, collisionResolved, tracks: { created: trackResult.tracksCreated, joins: trackResult.trackJoinsCreated, primaryArtists: trackResult.trackArtistsCreated, featuredArtists: trackResult.featuredArtistsCreated, releaseArtists: releaseArtistsCreated, entityRelationships: trackResult.entityRelationshipsCreated }, errors: trackResult.errors, success: trackResult.errors.length === 0 } });
    }

    // POST /check-duplicate
    if (path.endsWith("/check-duplicate") && req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string;
      if (!registryEntityId) return errorResponse("Missing registryEntityId", 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, title").eq("id", registryEntityId).maybeSingle();
      if (!shell) return errorResponse("Shell not found", 404);
      const title = shell.title as string;
      const { data: candidates } = await supabase.from("registry_releases").select("id, slug, title, release_date, artwork_url, status").ilike("title", `%${title.slice(0, 20)}%`).neq("id", shell.release_id ?? "").limit(10);
      const duplicates = (candidates ?? []).map((r: Record<string, unknown>) => ({ registryEntityId: r.id, slug: r.slug, title: r.title, releaseDate: r.release_date, artworkUrl: r.artwork_url, status: r.status, matchReason: "Title similarity", matchScore: 0.85 }));
      return jsonResponse({ data: { registryEntityId, duplicates, hasDuplicates: duplicates.length > 0 } });
    }

    // POST /save-shell
    if (path.endsWith("/save-shell") && req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string;
      const updates = (body.updates as Record<string, unknown>) ?? {};
      if (!registryEntityId) return errorResponse("Missing registryEntityId", 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, title, primary_artist_name, primary_artist_slug, release_date, tracks, source_provenance, status").eq("id", registryEntityId).maybeSingle();
      if (!shell) return errorResponse("Shell not found", 404);
      let releaseId = shell.release_id as string;
      const shellUpdates: Record<string, unknown> = { updated_at: now };
      const releaseUpdates: Record<string, unknown> = { updated_at: now };
      if (updates.title !== undefined) { shellUpdates.title = updates.title; releaseUpdates.title = updates.title; }
      if (updates.primary_artist_name !== undefined) { shellUpdates.primary_artist_name = updates.primary_artist_name; shellUpdates.primary_artist_slug = slugify(updates.primary_artist_name as string); }
      if (updates.release_date !== undefined) { shellUpdates.release_date = updates.release_date; releaseUpdates.release_date = updates.release_date; }
      if (updates.label !== undefined) { const p = (shell.source_provenance as Record<string, unknown> | null) ?? {}; shellUpdates.source_provenance = { ...p, label: updates.label }; }
      if (updates.artwork_url !== undefined) { const p = (shell.source_provenance as Record<string, unknown> | null) ?? {}; shellUpdates.source_provenance = { ...p, artwork_url: updates.artwork_url }; releaseUpdates.artwork_url = updates.artwork_url; }
      if (updates.review_notes !== undefined) { shellUpdates.review_notes = updates.review_notes; }
      if (Object.keys(shellUpdates).length > 1) { const { error: e } = await supabase.from("registry_release_shells").update(shellUpdates).eq("id", registryEntityId); if (e) return errorResponse("Failed to save shell: " + e.message, 500); }
      if (releaseId && Object.keys(releaseUpdates).length > 1) {
        if (releaseUpdates.title) {
          const { data: cr } = await supabase.from("registry_releases").select("id, title, status").eq("id", releaseId).maybeSingle();
          if (cr && cr.status !== "active") { const r = await resolveReleaseCollision(supabase, registryEntityId, releaseId, cr.title as string, now); if (r) releaseId = r.releaseId; }
        }
        const { error: e } = await supabase.from("registry_releases").update(releaseUpdates).eq("id", releaseId);
        if (e) return errorResponse("Failed to save release: " + e.message, 500);
      }
      return jsonResponse({ data: { registryEntityId, saved: true } });
    }

    // POST /reject-shell
    if (path.endsWith("/reject-shell") && req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string;
      const reason = (body.reason as string) ?? "";
      if (!registryEntityId) return errorResponse("Missing registryEntityId", 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, status").eq("id", registryEntityId).maybeSingle();
      if (!shell) return errorResponse("Shell not found", 404);
      await supabase.from("registry_release_shells").update({ status: "rejected", updated_at: now }).eq("id", registryEntityId);
      if (shell.release_id) await supabase.from("registry_releases").update({ status: "rejected", updated_at: now }).eq("id", shell.release_id as string);
      await supabase.from("registry_canonical_write_events").insert({ registry_entity_type: "release", registry_entity_id: registryEntityId, source_suggestion_id: null, source_table: "registry_release_shells", field_name: "reject", target_path: "status", before_value: shell.status, after_value: "rejected", action: "reject", status: "applied", error_message: null, actor, created_at: now });
      return jsonResponse({ data: { registryEntityId, status: "rejected", reason } });
    }

    // POST /apply-approved
    if (path.endsWith("/apply-approved") && req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string;
      if (!registryEntityId) return errorResponse("Missing registryEntityId", 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, title, primary_artist_name, primary_artist_slug, release_date, tracks, source_provenance").eq("id", registryEntityId).maybeSingle();
      let releaseId = shell?.release_id as string | undefined;
      if (!releaseId) return errorResponse("Shell has no linked release", 400);
      const { data: release } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url, status, slug, upc, label_id, metadata").eq("id", releaseId).maybeSingle();
      if (!release) return errorResponse("Linked release not found", 404);
      let collisionResolved = false;
      if (release.status !== "active") { const r = await resolveReleaseCollision(supabase, registryEntityId, releaseId, release.title, now); if (r) { releaseId = r.releaseId; collisionResolved = true; } }
      const { data: targetRelease } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url").eq("id", releaseId).maybeSingle();
      if (!targetRelease) return errorResponse("Target release not found after collision resolution", 404);
      const releaseSlug = (await supabase.from("registry_releases").select("slug").eq("id", releaseId).maybeSingle())?.data?.slug as string || "";
      const { data: suggestions } = await supabase.from("registry_enrichment_suggestions").select("*").eq("registry_entity_id", registryEntityId).eq("registry_entity_type", "release").eq("decision_status", "approved");
      const approved = suggestions ?? [];
      const applied: Array<Record<string, unknown>> = [];
      const fieldMap: Record<string, string> = { title: "title", release_date: "release_date", artwork_url: "artwork_url" };
      const updates: Record<string, unknown> = {};
      for (const s of approved) {
        const fn = s.field_name as string;
        const tp = fieldMap[fn] ?? fn;
        if (tp && ["title", "release_date", "artwork_url"].includes(tp)) { updates[tp] = s.suggested_value; applied.push({ suggestionId: s.id, fieldName: fn, target: tp }); }
      }
      if (Object.keys(updates).length > 0) { const { error: e } = await supabase.from("registry_releases").update({ ...updates, updated_at: now }).eq("id", releaseId); if (e) return errorResponse("Failed to update release: " + e.message, 500); }
      const shellTracks = (shell?.tracks as Array<Record<string, unknown>>) ?? [];
      const paName = (shell?.primary_artist_name as string) || "Unknown";
      const paSlug = (shell?.primary_artist_slug as string) || slugify(paName);
      const trackResult = await writeTracksToRelease(supabase, releaseId, releaseSlug, shellTracks, paName, paSlug, now);
      const { data: raArtist } = await supabase.from("registry_artists").select("id").eq("slug", paSlug).in("status", ["active", "draft"]).maybeSingle();
      let releaseArtistsCreated = 0;
      if (raArtist) {
        const { data: existRa } = await supabase.from("registry_release_artists").select("id").eq("release_id", releaseId).eq("artist_id", raArtist.id).maybeSingle();
        if (!existRa) {
          await supabase.from("registry_release_artists").insert({ id: crypto.randomUUID(), release_id: releaseId, artist_id: raArtist.id, artist_slug: paSlug, artist_name_text: paName, role: "album_artist", is_primary: true, is_featured: false, credit_order: 0, source: "provider_intake", confidence: 90, status: "active", metadata: {}, created_at: now, updated_at: now });
          releaseArtistsCreated++;
        }
        await ensureEntityRelationship(supabase, "release", releaseSlug, "artist", paSlug, "RELEASED_BY", "album_artist", 90, 0, {}, now);
      }
      for (const a of applied) {
        await supabase.from("registry_enrichment_suggestions").update({ decision_status: "applied" }).eq("id", a.suggestionId as string);
        await supabase.from("registry_canonical_write_events").insert({ registry_entity_type: "release", registry_entity_id: registryEntityId, source_suggestion_id: a.suggestionId, source_table: "registry_enrichment_suggestions", field_name: a.fieldName, target_path: a.target, before_value: (targetRelease as Record<string, unknown>)[a.target as string], after_value: updates[a.target as string], action: "apply", status: "applied", error_message: null, actor, created_at: now });
      }
      if (trackResult.tracksCreated > 0 || trackResult.trackJoinsCreated > 0) {
        const { error: e } = await supabase.from("registry_releases").update({ status: "active", updated_at: now }).eq("id", releaseId);
        if (e) { const r = await resolveReleaseCollision(supabase, registryEntityId, releaseId, (targetRelease as Record<string, unknown>).title as string, now); if (r) await supabase.from("registry_releases").update({ status: "active", updated_at: now }).eq("id", r.releaseId); }
      }
      return jsonResponse({ data: { registryEntityId, applied, collisionResolved, tracks: { created: trackResult.tracksCreated, joins: trackResult.trackJoinsCreated, primaryArtists: trackResult.trackArtistsCreated, featuredArtists: trackResult.featuredArtistsCreated, releaseArtists: releaseArtistsCreated, entityRelationships: trackResult.entityRelationshipsCreated }, errors: trackResult.errors, success: trackResult.errors.length === 0 } });
    }

    // Legacy endpoints
    const suggMatch = path.match(/\/?suggestions\/([^/]+)\/decision/);
    if (suggMatch && req.method === "POST") {
      const suggId = suggMatch[1];
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      if (!body.decisionStatus) return errorResponse("Missing decisionStatus", 400);
      const { data, error } = await supabase.from("registry_enrichment_suggestions").update({ decision_status: body.decisionStatus }).eq("id", suggId).select("id, registry_entity_id, decision_status").single();
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ data: { decision: { suggestionId: data.id, registryEntityId: data.registry_entity_id, decisionStatus: data.decision_status } } });
    }

    if (path.endsWith("/preview-apply") && req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const reId = body.registryEntityId as string;
      if (!reId) return errorResponse("Missing registryEntityId", 400);
      const { data: sh } = await supabase.from("registry_release_shells").select("release_id").eq("id", reId).maybeSingle();
      const { data: rel } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url").eq("id", sh?.release_id ?? "").maybeSingle();
      const { data: sugs } = await supabase.from("registry_enrichment_suggestions").select("*").eq("registry_entity_id", reId).eq("registry_entity_type", "release").eq("decision_status", "approved");
      const app = sugs ?? [];
      const writable: Array<Record<string, unknown>> = [];
      const skipped: Array<Record<string, unknown>> = [];
      const fm: Record<string, string> = { title: "title", release_date: "release_date", artwork_url: "artwork_url" };
      for (const s of app) {
        const fn = s.field_name as string;
        const tp = fm[fn] ?? fn;
        const cv = rel ? (rel as Record<string, unknown>)[tp] : null;
        if (tp && ["title", "release_date", "artwork_url"].includes(tp)) writable.push({ suggestionId: s.id, fieldName: fn, targetPath: tp, currentValue: cv, proposedValue: s.suggested_value, writable: true, reason: null });
        else skipped.push({ suggestionId: s.id, fieldName: fn, targetPath: tp, currentValue: cv, proposedValue: s.suggested_value, writable: false, reason: "No matching release field" });
      }
      return jsonResponse({ data: { registryEntityId: reId, canonicalReleaseExists: !!rel, writable, skipped } });
    }

    const lcMatch = path.match(/\/?([^/]+)\/lifecycle/);
    if (lcMatch && !lcMatch[1].includes("suggestions") && req.method === "POST") {
      const reId = lcMatch[1];
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* no body */ }
      const status = body.status as string;
      if (!status) return errorResponse("Missing status", 400);
      const { data, error } = await supabase.from("registry_release_shell_lifecycle_events").insert({ registry_entity_type: "release", registry_entity_id: reId, status, reason: (body.reason as string) ?? "", actor, created_at: new Date().toISOString() }).select().single();
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ data: { lifecycle: { status: data.status, reason: data.reason, actor: data.actor, createdAt: data.created_at } } });
    }

    const auditMatch = path.match(/\/?([^/]+)\/audit/);
    if (auditMatch && req.method === "GET") {
      const reId = auditMatch[1];
      const { data, error } = await supabase.from("registry_canonical_write_events").select("*").eq("registry_entity_id", reId).eq("registry_entity_type", "release").order("created_at", { ascending: false }).limit(50);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ data: { events: data ?? [] } });
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal server error", 500);
  }
});