// ── SHARED BLOCK (Phase A) ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { canonicalTrackSlugCandidate } from "../_shared/registry-track-identity.ts";
import { parseArtistCreditLine } from "../_shared/registry-artist-credit-grammar.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","http://localhost:5173","http://localhost:3000"];
function corsO(): Record<string,string> { return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}; }
async function vJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }
async function rCap(userId: string, cap: string): Promise<boolean> { const c=createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }
function jRaw(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify(data),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
function slugify(s:string):string{return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,160);}
// ── END SHARED BLOCK ──

function parseArtistNames(artistName: string) {
  return parseArtistCreditLine(artistName);
}

async function findOrCreateArtist(db: ReturnType<typeof createClient>, artistName: string, now: string): Promise<string | null> {
  const slug = slugify(artistName);
  if (!slug) return null;
  const { data: existing } = await db.from("registry_artists").select("id").eq("slug", slug).in("status", ["active", "draft"]).maybeSingle();
  if (existing) return existing.id as string;
  const { data: byName } = await db.from("registry_artists").select("id").eq("display_name", artistName).in("status", ["active", "draft"]).maybeSingle();
  if (byName) return byName.id as string;
  const newId = crypto.randomUUID();
  const normalized = artistName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { error: insErr } = await db.from("registry_artists").insert({ id: newId, slug, display_name: artistName, normalized_name: normalized, sort_name: artistName, artist_type: "person", status: "active", metadata: {}, created_at: now, updated_at: now });
  if (insErr) { console.error(`[findOrCreateArtist] failed "${artistName}":`, insErr.message); return null; }
  return newId;
}

async function resolveReleaseCollision(db: ReturnType<typeof createClient>, shellId: string, releaseId: string, releaseTitle: string, now: string): Promise<{ releaseId: string; resolved: boolean } | null> {
  const { data: activeDup } = await db.from("registry_releases").select("id, title, slug").eq("title", releaseTitle).eq("status", "active").maybeSingle();
  if (!activeDup) return null;
  await db.from("registry_release_shells").update({ release_id: activeDup.id, updated_at: now }).eq("id", shellId);
  await db.from("registry_release_tracks").delete().eq("release_id", releaseId);
  await db.from("registry_releases").delete().eq("id", releaseId);
  return { releaseId: activeDup.id, resolved: true };
}

async function findOrCreateLabel(db: ReturnType<typeof createClient>, labelName: string, now: string): Promise<string | null> {
  if (!labelName) return null;
  const slug = slugify(labelName);
  const { data: existing } = await db.from("registry_labels").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
  if (existing) return existing.id as string;
  const newId = crypto.randomUUID();
  const normalized = labelName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { error: insErr } = await db.from("registry_labels").insert({ id: newId, slug, name: labelName, normalized_name: normalized, status: "active", metadata: {}, created_at: now, updated_at: now });
  if (insErr) { console.error(`[findOrCreateLabel] failed "${labelName}":`, insErr.message); return null; }
  return newId;
}

async function ensureEntityRelationship(db: ReturnType<typeof createClient>, sourceType: string, sourceSlug: string, targetType: string, targetSlug: string, relType: string, relRole: string, confidence: number, sortOrder: number, now: string): Promise<void> {
  const { data: existing } = await db.from("registry_entity_relationships").select("id").eq("source_entity_type", sourceType).eq("source_slug", sourceSlug).eq("target_entity_type", targetType).eq("target_slug", targetSlug).eq("relationship_type", relType).maybeSingle();
  if (existing) return;
  const { error } = await db.from("registry_entity_relationships").insert({ id: crypto.randomUUID(), source_entity_type: sourceType, source_slug: sourceSlug, target_entity_type: targetType, target_slug: targetSlug, relationship_type: relType, relationship_role: relRole, relationship_status: "active", confidence, sort_order: sortOrder, metadata: {}, created_at: now, updated_at: now });
  if (error) console.error(`[ensureEntityRelationship] failed ${sourceType}/${sourceSlug} -> ${targetType}/${targetSlug}:`, error.message);
}

async function findTrackByArtistAndSlug(
  db: ReturnType<typeof createClient>,
  artistSlug: string,
  trackSlug: string,
): Promise<{ id: string; slug: string } | null> {
  if (!artistSlug || !trackSlug) return null;

  const { data: links, error: linksError } =
    await db
      .from("registry_track_artists")
      .select("track_id")
      .eq("artist_slug", artistSlug)
      .eq("status", "active")
      .eq("is_primary", true)
      .limit(100);

  if (linksError) {
    throw new Error(
      "Track scope lookup failed: " +
        linksError.message,
    );
  }

  const trackIds = [
    ...new Set(
      (links ?? []).map(
        (link) =>
          String(link.track_id),
      ),
    ),
  ];

  if (trackIds.length === 0) {
    return null;
  }

  const { data: tracks, error: tracksError } =
    await db
      .from("registry_tracks")
      .select("id, slug")
      .in("id", trackIds)
      .eq("slug", trackSlug)
      .eq("status", "active")
      .limit(2);

  if (tracksError) {
    throw new Error(
      "Track identity lookup failed: " +
        tracksError.message,
    );
  }

  if ((tracks ?? []).length > 1) {
    throw new Error(
      "Ambiguous Track identity in artist scope: " +
        artistSlug +
        "/" +
        trackSlug,
    );
  }

  const match = tracks?.[0];
  return match
    ? {
        id: String(match.id),
        slug: String(match.slug),
      }
    : null;
}

async function writeTracksToRelease(
  db: ReturnType<typeof createClient>,
  releaseId: string,
  releaseSlug: string,
  shellTracks: Array<Record<string, unknown>>,
  primaryArtistName: string,
  primaryArtistSlug: string,
  now: string,
): Promise<{
  tracksCreated: number;
  trackJoinsCreated: number;
  trackArtistsCreated: number;
  featuredArtistsCreated: number;
  entityRelationshipsCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let tracksCreated = 0;
  let trackJoinsCreated = 0;
  let trackArtistsCreated = 0;
  let featuredArtistsCreated = 0;
  let entityRelationshipsCreated = 0;

  void releaseSlug;

  await db
    .from("registry_release_tracks")
    .delete()
    .eq("release_id", releaseId);

  for (let i = 0; i < shellTracks.length; i++) {
    const t = shellTracks[i];
    const trackTitle =
      (t.title as string) || "Untitled";
    const isrc =
      (t.isrc as string) || null;
    const trackNumber =
      (t.trackNumber as number) ??
      (i + 1);
    const rawArtistName =
      (t.artistName as string) ||
      primaryArtistName ||
      "Unknown";
    const parsedArtistCredit =
      parseArtistNames(
        rawArtistName,
      );
    const parsedPrimary =
      parsedArtistCredit.leadName;
    const parsedParticipants =
      parsedArtistCredit.participants.slice(1);
    const trackPrimaryArtistSlug =
      slugify(
        parsedPrimary ||
          primaryArtistName,
      ) || primaryArtistSlug;
    const candidateTrackSlug =
      canonicalTrackSlugCandidate(
        trackTitle,
        {
          creditArtistNames:
            parsedParticipants.map(
              (participant) =>
                participant.name,
            ),
        },
      );

    let trackId: string;
    let resolvedTrackSlug =
      candidateTrackSlug;

    if (isrc) {
      const { data: byIsrc } =
        await db
          .from("registry_tracks")
          .select("id, slug")
          .eq("isrc", isrc)
          .maybeSingle();

      if (byIsrc) {
        trackId =
          String(byIsrc.id);
        resolvedTrackSlug =
          String(byIsrc.slug);

        await db
          .from("registry_tracks")
          .update({
            title: trackTitle,
            duration_ms:
              (t.durationMs as number) ??
              null,
            preview_url:
              (t.previewUrl as string) ??
              null,
            artwork_url:
              (t.artworkUrl as string) ??
              null,
            track_number:
              trackNumber,
            disc_number: 1,
            updated_at: now,
          })
          .eq("id", trackId);
      } else {
        const scopedMatch =
          await findTrackByArtistAndSlug(
            db,
            trackPrimaryArtistSlug,
            candidateTrackSlug,
          );

        if (scopedMatch) {
          trackId = scopedMatch.id;
          resolvedTrackSlug =
            scopedMatch.slug;

          await db
            .from("registry_tracks")
            .update({
              title: trackTitle,
              isrc,
              duration_ms:
                (t.durationMs as number) ??
                null,
              preview_url:
                (t.previewUrl as string) ??
                null,
              artwork_url:
                (t.artworkUrl as string) ??
                null,
              track_number:
                trackNumber,
              disc_number: 1,
              updated_at: now,
            })
            .eq("id", trackId);
        } else {
          trackId =
            crypto.randomUUID();

          const { error: insertError } =
            await db
              .from("registry_tracks")
              .insert({
                id: trackId,
                slug:
                  candidateTrackSlug,
                title: trackTitle,
                isrc,
                duration_ms:
                  (t.durationMs as number) ??
                  null,
                preview_url:
                  (t.previewUrl as string) ??
                  null,
                artwork_url:
                  (t.artworkUrl as string) ??
                  null,
                track_number:
                  trackNumber,
                disc_number: 1,
                status: "active",
                metadata: {},
                created_at: now,
                updated_at: now,
              });

          if (insertError) {
            errors.push(
              `insert "${trackTitle}": ${insertError.message}`,
            );
            continue;
          }

          tracksCreated++;
        }
      }
    } else {
      const scopedMatch =
        await findTrackByArtistAndSlug(
          db,
          trackPrimaryArtistSlug,
          candidateTrackSlug,
        );

      if (scopedMatch) {
        trackId = scopedMatch.id;
        resolvedTrackSlug =
          scopedMatch.slug;

        await db
          .from("registry_tracks")
          .update({
            title: trackTitle,
            duration_ms:
              (t.durationMs as number) ??
              null,
            preview_url:
              (t.previewUrl as string) ??
              null,
            artwork_url:
              (t.artworkUrl as string) ??
              null,
            track_number:
              trackNumber,
            disc_number: 1,
            updated_at: now,
          })
          .eq("id", trackId);
      } else {
        trackId =
          crypto.randomUUID();

        const { error: insertError } =
          await db
            .from("registry_tracks")
            .insert({
              id: trackId,
              slug:
                candidateTrackSlug,
              title: trackTitle,
              duration_ms:
                (t.durationMs as number) ??
                null,
              preview_url:
                (t.previewUrl as string) ??
                null,
              artwork_url:
                (t.artworkUrl as string) ??
                null,
              track_number:
                trackNumber,
              disc_number: 1,
              status: "active",
              metadata: {},
              created_at: now,
              updated_at: now,
            });

        if (insertError) {
          errors.push(
            `insert (no isrc) "${trackTitle}": ${insertError.message}`,
          );
          continue;
        }

        tracksCreated++;
      }
    }

    const { error: releaseTrackError } =
      await db
        .from("registry_release_tracks")
        .insert({
          id: crypto.randomUUID(),
          release_id: releaseId,
          track_id: trackId,
          disc_number: 1,
          track_number: trackNumber,
          source: "provider_intake",
          confidence: 90,
          status: "active",
          metadata: {},
          created_at: now,
          updated_at: now,
        });

    if (releaseTrackError) {
      errors.push(
        "join: " +
          releaseTrackError.message,
      );
      continue;
    }

    trackJoinsCreated++;

    if (parsedPrimary) {
      const primarySlug =
        slugify(parsedPrimary);
      const { data: primaryArtist } =
        await db
          .from("registry_artists")
          .select("id")
          .eq("slug", primarySlug)
          .in(
            "status",
            ["active", "draft"],
          )
          .maybeSingle();
      const primaryArtistId =
        primaryArtist
          ? String(primaryArtist.id)
          : await findOrCreateArtist(
              db,
              parsedPrimary,
              now,
            );

      if (primaryArtistId) {
        const { data: existingLink } =
          await db
            .from("registry_track_artists")
            .select("id")
            .eq("track_id", trackId)
            .eq(
              "artist_id",
              primaryArtistId,
            )
            .maybeSingle();

        if (!existingLink) {
          await db
            .from("registry_track_artists")
            .insert({
              id: crypto.randomUUID(),
              track_id: trackId,
              artist_id:
                primaryArtistId,
              artist_slug:
                primarySlug,
              artist_name_text:
                parsedPrimary,
              role: "primary",
              is_primary: true,
              is_featured: false,
              credit_order: 0,
              source:
                "provider_intake",
              confidence: 85,
              status: "active",
              metadata: {},
              created_at: now,
              updated_at: now,
            });
          trackArtistsCreated++;
        }

        await ensureEntityRelationship(
          db,
          "track",
          resolvedTrackSlug,
          "artist",
          primarySlug,
          "PERFORMED_BY",
          "primary",
          90,
          0,
          now,
        );
        entityRelationshipsCreated++;
      }
    }

    for (
      let pi = 0;
      pi < parsedParticipants.length;
      pi++
    ) {
      const participant =
        parsedParticipants[pi];
      const participantName =
        participant.name;
      const participantSlug =
        slugify(participantName);
      if (!participantSlug) continue;

      const { data: participantArtist } =
        await db
          .from("registry_artists")
          .select("id")
          .eq("slug", participantSlug)
          .in(
            "status",
            ["active", "draft"],
          )
          .maybeSingle();
      const participantArtistId =
        participantArtist
          ? String(participantArtist.id)
          : await findOrCreateArtist(
              db,
              participantName,
              now,
            );

      if (participantArtistId) {
        const { data: existingLink } =
          await db
            .from("registry_track_artists")
            .select("id")
            .eq("track_id", trackId)
            .eq(
              "artist_id",
              participantArtistId,
            )
            .maybeSingle();

        const explicitlyFeatured =
          participant.roleHint ===
          "featured";

        if (!existingLink) {
          await db
            .from("registry_track_artists")
            .insert({
              id: crypto.randomUUID(),
              track_id: trackId,
              artist_id:
                participantArtistId,
              artist_slug:
                participantSlug,
              artist_name_text:
                participantName,
              role: explicitlyFeatured
                ? "featured"
                : "credited_artist",
              is_primary: false,
              is_featured:
                explicitlyFeatured,
              credit_order: pi + 1,
              source:
                "provider_intake",
              confidence: 85,
              status: "active",
              metadata: {
                credit_separator_kind:
                  participant.separatorKind,
                credit_separator_token:
                  participant.separatorToken,
                role_source:
                  explicitlyFeatured
                    ? "structured_artist_line_feature_marker"
                    : "structured_artist_line_participant_only",
              },
              created_at: now,
              updated_at: now,
            });

          if (explicitlyFeatured) {
            featuredArtistsCreated++;
          }
        }

        await ensureEntityRelationship(
          db,
          "track",
          resolvedTrackSlug,
          "artist",
          participantSlug,
          explicitlyFeatured
            ? "FEATURED_ON"
            : "PERFORMED_BY",
          explicitlyFeatured
            ? "featured"
            : "credited",
          85,
          pi + 1,
          now,
        );
        entityRelationshipsCreated++;
      }
    }
  }

  return {
    tracksCreated,
    trackJoinsCreated,
    trackArtistsCreated,
    featuredArtistsCreated,
    entityRelationshipsCreated,
    errors,
  };
}

Deno.serve(async (req) => {
  const cors = corsO();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  // ── CAPABILITY CHECK (Phase A security fix) ──
  const auth = await vJwt(req);
  if (!auth) return jRaw({ error: "Missing or invalid token" }, cors, 401);
  const canAccess = await rCap(auth.id, "manage_registry");
  if (!canAccess) return jRaw({ error: "Missing capability: manage_registry" }, cors, 403);

  const url = new URL(req.url); const path = url.pathname; const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const actor = auth.id; const now = new Date().toISOString();

  try {
    const relCompMatch = path.match(/\/release-comparison\/([^/]+)/);
    if (relCompMatch && req.method === "GET") {
      const releaseId = relCompMatch[1];
      const { data: rel } = await supabase.from("registry_releases").select("id, slug, title, release_date, artwork_url, status").eq("id", releaseId).maybeSingle();
      if (!rel) return jRaw({ error: "Release not found" }, cors, 404);
      const { data: rts } = await supabase.from("registry_release_tracks").select("track_id, track_number").eq("release_id", releaseId).order("track_number");
      const trackIds = (rts ?? []).map((rt) => rt.track_id);
      let tracks: Array<Record<string, unknown>> = [];
      if (trackIds.length > 0) { const { data: td } = await supabase.from("registry_tracks").select("id, title, track_number, duration_ms, isrc").in("id", trackIds); tracks = td ?? []; }
      return jRaw({ data: { id: rel.id, slug: rel.slug, title: rel.title, artistName: null, releaseDate: rel.release_date, artworkUrl: rel.artwork_url, status: rel.status, trackCount: tracks.length, tracks: tracks.map((t) => ({ title: t.title, trackNumber: t.track_number, durationMs: t.duration_ms, isrc: t.isrc })) } }, cors);
    }

    if (path.endsWith("/canonicalize") && req.method === "POST") {
      let body: Record<string, unknown> = {}; try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string; const overrides = (body.overrides as Record<string, unknown>) ?? {};
      if (!registryEntityId) return jRaw({ error: "Missing registryEntityId" }, cors, 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, title, primary_artist_name, primary_artist_slug, release_date, tracks, source_provenance, status").eq("id", registryEntityId).maybeSingle();
      if (!shell) return jRaw({ error: "Shell not found" }, cors, 404);
      let releaseId = shell.release_id as string; if (!releaseId) return jRaw({ error: "Shell has no linked release" }, cors, 400);
      const { data: release } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url, status, slug, upc, label_id, metadata").eq("id", releaseId).maybeSingle();
      if (!release) return jRaw({ error: "Linked release not found" }, cors, 404);
      let collisionResolved = false;
      if (release.status !== "active") { const r = await resolveReleaseCollision(supabase, registryEntityId, releaseId, release.title, now); if (r) { releaseId = r.releaseId; collisionResolved = true; } }
      const { data: targetRelease } = await supabase.from("registry_releases").select("id, title, release_date, artwork_url, status, slug, upc, label_id, metadata").eq("id", releaseId).maybeSingle();
      if (!targetRelease) return jRaw({ error: "Target release not found" }, cors, 404);
      const releaseSlug = targetRelease.slug as string;
      const provenance = (shell.source_provenance ?? {}) as Record<string, unknown>;
      const releaseUpdates: Record<string, unknown> = { updated_at: now, status: "active" };
      const sTitle = (overrides.title ?? shell.title ?? targetRelease.title) as string;
      if (sTitle && sTitle !== targetRelease.title) releaseUpdates.title = sTitle;
      const sDate = (overrides.release_date ?? shell.release_date ?? targetRelease.release_date) as string;
      if (sDate && sDate !== targetRelease.release_date) releaseUpdates.release_date = sDate;
      const sArtwork = (overrides.artwork_url ?? provenance.artwork_url ?? targetRelease.artwork_url) as string;
      if (sArtwork && sArtwork !== targetRelease.artwork_url) releaseUpdates.artwork_url = sArtwork;
      const sLabel = (overrides.label ?? provenance.record_label) as string | null;
      if (sLabel) { const lid = await findOrCreateLabel(supabase, sLabel, now); if (lid) releaseUpdates.label_id = lid; }
      const em = (releaseUpdates.metadata ?? (targetRelease.metadata ?? {})) as Record<string, unknown>;
      releaseUpdates.metadata = { ...em, provider: provenance.provider, provider_url: provenance.provider_url, provider_entity_id: provenance.provider_entity_id };
      await supabase.from("registry_releases").update(releaseUpdates).eq("id", releaseId);
      const shellTracks = (shell.tracks as Array<Record<string, unknown>>) ?? [];
      const paName = (shell.primary_artist_name as string) || "Unknown";
      const paSlug = (shell.primary_artist_slug as string) || slugify(paName);
      const trackResult = await writeTracksToRelease(supabase, releaseId, releaseSlug, shellTracks, paName, paSlug, now);
      let releaseArtistsCreated = 0;
      const { data: raArtist } = await supabase.from("registry_artists").select("id").eq("slug", paSlug).in("status", ["active", "draft"]).maybeSingle();
      if (raArtist) { const { data: existRa } = await supabase.from("registry_release_artists").select("id").eq("release_id", releaseId).eq("artist_id", raArtist.id).maybeSingle(); if (!existRa) { await supabase.from("registry_release_artists").insert({ id: crypto.randomUUID(), release_id: releaseId, artist_id: raArtist.id, artist_slug: paSlug, artist_name_text: paName, role: "album_artist", is_primary: true, is_featured: false, credit_order: 0, source: "provider_intake", confidence: 90, status: "active", metadata: {}, created_at: now, updated_at: now }); releaseArtistsCreated++; } await ensureEntityRelationship(supabase, "release", releaseSlug, "artist", paSlug, "RELEASED_BY", "album_artist", 90, 0, now); }
      await supabase.from("registry_release_shells").update({ status: "canonicalized", updated_at: now }).eq("id", registryEntityId);
      await supabase.from("registry_canonical_write_events").insert({ registry_entity_type: "release", registry_entity_id: registryEntityId, source_suggestion_id: null, source_table: "registry_release_shells", field_name: "canonicalize", target_path: "release", before_value: shell.status, after_value: "canonicalized", action: "canonicalize", status: "applied", error_message: null, actor, created_at: now });
      return jRaw({ data: { registryEntityId, releaseId, collisionResolved, tracks: { created: trackResult.tracksCreated, joins: trackResult.trackJoinsCreated, primaryArtists: trackResult.trackArtistsCreated, featuredArtists: trackResult.featuredArtistsCreated, releaseArtists: releaseArtistsCreated, entityRelationships: trackResult.entityRelationshipsCreated }, errors: trackResult.errors, success: trackResult.errors.length === 0 } }, cors);
    }

    if (path.endsWith("/check-duplicate") && req.method === "POST") {
      let body: Record<string, unknown> = {}; try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string; if (!registryEntityId) return jRaw({ error: "Missing registryEntityId" }, cors, 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, title").eq("id", registryEntityId).maybeSingle();
      if (!shell) return jRaw({ error: "Shell not found" }, cors, 404);
      const title = shell.title as string;
      const { data: candidates } = await supabase.from("registry_releases").select("id, slug, title, release_date, artwork_url, status").ilike("title", `%${title.slice(0, 20)}%`).neq("id", shell.release_id ?? "").limit(10);
      const duplicates = (candidates ?? []).map((r: Record<string, unknown>) => ({ registryEntityId: r.id, slug: r.slug, title: r.title, releaseDate: r.release_date, artworkUrl: r.artwork_url, status: r.status, matchReason: "Title similarity", matchScore: 0.85 }));
      return jRaw({ data: { registryEntityId, duplicates, hasDuplicates: duplicates.length > 0 } }, cors);
    }

    if (path.endsWith("/save-shell") && req.method === "POST") {
      let body: Record<string, unknown> = {}; try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string; const updates = (body.updates as Record<string, unknown>) ?? {};
      if (!registryEntityId) return jRaw({ error: "Missing registryEntityId" }, cors, 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, title").eq("id", registryEntityId).maybeSingle();
      if (!shell) return jRaw({ error: "Shell not found" }, cors, 404);
      let releaseId = shell.release_id as string;
      const shellUpdates: Record<string, unknown> = { updated_at: now };
      const releaseUpdates: Record<string, unknown> = { updated_at: now };
      if (updates.title !== undefined) { shellUpdates.title = updates.title; releaseUpdates.title = updates.title; }
      if (updates.primary_artist_name !== undefined) { shellUpdates.primary_artist_name = updates.primary_artist_name; shellUpdates.primary_artist_slug = slugify(updates.primary_artist_name as string); }
      if (updates.release_date !== undefined) { shellUpdates.release_date = updates.release_date; releaseUpdates.release_date = updates.release_date; }
      if (updates.artwork_url !== undefined) { releaseUpdates.artwork_url = updates.artwork_url; }
      if (updates.review_notes !== undefined) { shellUpdates.review_notes = updates.review_notes; }
      if (Object.keys(shellUpdates).length > 1) await supabase.from("registry_release_shells").update(shellUpdates).eq("id", registryEntityId);
      if (releaseId && Object.keys(releaseUpdates).length > 1) await supabase.from("registry_releases").update(releaseUpdates).eq("id", releaseId);
      return jRaw({ data: { registryEntityId, saved: true } }, cors);
    }

    if (path.endsWith("/reject-shell") && req.method === "POST") {
      let body: Record<string, unknown> = {}; try { body = await req.json(); } catch { /* no body */ }
      const registryEntityId = body.registryEntityId as string; if (!registryEntityId) return jRaw({ error: "Missing registryEntityId" }, cors, 400);
      const { data: shell } = await supabase.from("registry_release_shells").select("id, release_id, status").eq("id", registryEntityId).maybeSingle();
      if (!shell) return jRaw({ error: "Shell not found" }, cors, 404);
      await supabase.from("registry_release_shells").update({ status: "rejected", updated_at: now }).eq("id", registryEntityId);
      if (shell.release_id) await supabase.from("registry_releases").update({ status: "rejected", updated_at: now }).eq("id", shell.release_id as string);
      await supabase.from("registry_canonical_write_events").insert({ registry_entity_type: "release", registry_entity_id: registryEntityId, source_table: "registry_release_shells", field_name: "reject", target_path: "status", before_value: shell.status, after_value: "rejected", action: "reject", status: "applied", actor, created_at: now });
      return jRaw({ data: { registryEntityId, status: "rejected" } }, cors);
    }

    // Legacy endpoints preserved for backward compatibility
    const suggMatch = path.match(/\/?suggestions\/([^/]+)\/decision/);
    if (suggMatch && req.method === "POST") { const sId = suggMatch[1]; let body: Record<string, unknown> = {}; try { body = await req.json(); } catch { /* */ } if (!body.decisionStatus) return jRaw({ error: "Missing decisionStatus" }, cors, 400); const { data, error } = await supabase.from("registry_enrichment_suggestions").update({ decision_status: body.decisionStatus }).eq("id", sId).select("id, registry_entity_id, decision_status").single(); if (error) return jRaw({ error: error.message }, cors, 500); return jRaw({ data: { decision: { suggestionId: data.id, registryEntityId: data.registry_entity_id, decisionStatus: data.decision_status } } }, cors); }

    const lcMatch = path.match(/\/?([^/]+)\/lifecycle/);
    if (lcMatch && !lcMatch[1].includes("suggestions") && req.method === "POST") { const reId = lcMatch[1]; let body: Record<string, unknown> = {}; try { body = await req.json(); } catch { /* */ } const status = body.status as string; if (!status) return jRaw({ error: "Missing status" }, cors, 400); const { data, error } = await supabase.from("registry_release_shell_lifecycle_events").insert({ registry_entity_type: "release", registry_entity_id: reId, status, reason: (body.reason as string) ?? "", actor, created_at: now }).select().single(); if (error) return jRaw({ error: error.message }, cors, 500); return jRaw({ data: { lifecycle: { status: data.status, reason: data.reason, actor: data.actor, createdAt: data.created_at } } }, cors); }

    return jRaw({ error: "Not found" }, cors, 404);
  } catch (err) {
    return jRaw({ error: err instanceof Error ? err.message : "Internal server error" }, cors, 500);
  }
});
