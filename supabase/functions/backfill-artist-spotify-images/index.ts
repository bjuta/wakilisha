// Backfill Artist Spotify Profile Images
// Fetches real artist profile pics from Spotify API for artists
// that have a spotify_id in metadata but missing/invalid public_image_url.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://wakilisha.africa",
  "https://wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function readCredential(
  db: ReturnType<typeof createClient>,
  envVar: string,
  dbKey: string
): Promise<string | null> {
  const ev = Deno.env.get(envVar);
  if (ev?.trim()) return ev.trim();
  try {
    const { data } = await db
      .from("admin_settings_secrets")
      .select("setting_value")
      .eq("setting_key", dbKey)
      .maybeSingle();
    if (data?.setting_value?.trim()) return String(data.setting_value).trim();
  } catch { /* ignore */ }
  return null;
}

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

interface SpotifyArtistImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: SpotifyArtistImage[];
  followers?: { total: number };
  popularity?: number;
  genres?: string[];
}

async function fetchSpotifyArtist(
  artistId: string,
  token: string
): Promise<SpotifyArtist | null> {
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as SpotifyArtist;
  } catch {
    return null;
  }
}

/** Pick the best image from Spotify's array — prefer 640px, fallback to largest available */
function pickBestImage(images: SpotifyArtistImage[]): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url ?? null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, { error: "unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) {
    return json(req, { error: "unauthorized" }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* no body */ }

  const dryRun = body.dry_run === true;
  const batchSize = Math.min(Number(body.batch_size) || 60, 100);
  const specificSlug = body.artist_slug ? String(body.artist_slug) : null;

  const clientId = await readCredential(db, "SPOTIFY_CLIENT_ID", "spotify_client_id");
  const clientSecret = await readCredential(db, "SPOTIFY_CLIENT_SECRET", "spotify_client_secret");

  if (!clientId || !clientSecret) {
    return json(req, {
      error: "spotify_credentials_not_configured",
      message: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Settings → Integrations.",
    }, 400);
  }

  const spotifyToken = await getSpotifyToken(clientId, clientSecret);
  if (!spotifyToken) {
    return json(req, { error: "spotify_auth_failed", message: "Could not authenticate with Spotify API." }, 500);
  }

  // Find artists that need backfill (active + draft)
  // Use filter() with not.is for JSONB null check — .not() with JSONB is unreliable
  let query = db
    .from("registry_artists")
    .select("id, slug, display_name, public_image_url, metadata")
    .in("status", ["active", "draft"])
    .filter("metadata->>spotify_id", "not.is", null)
    .filter("metadata->>spotify_id", "not.eq", "");

  if (specificSlug) {
    query = query.eq("slug", specificSlug);
  } else {
    // Only target artists with missing or non-URL image
    query = query.or("public_image_url.is.null,public_image_url.not.like.http%");
    query = query.limit(batchSize);
  }

  const { data: artists, error: artistErr } = await query;

  if (artistErr) {
    return json(req, { error: "db_query_failed", detail: artistErr.message }, 500);
  }

  if (!artists || artists.length === 0) {
    return json(req, {
      ok: true,
      message: "No artists need image backfill — all are already set!",
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      results: [],
    });
  }

  const results: Array<{
    slug: string;
    name: string;
    spotify_id: string;
    status: "updated" | "skipped" | "no_image" | "error";
    old_image?: string | null;
    new_image?: string | null;
    message?: string;
  }> = [];

  let updated = 0;
  let skipped = 0;
  let noImage = 0;
  let errors = 0;

  const now = new Date().toISOString();
  const SPOTIFY_BATCH = 10;

  for (let i = 0; i < artists.length; i += SPOTIFY_BATCH) {
    const batch = artists.slice(i, i + SPOTIFY_BATCH);

    await Promise.all(batch.map(async (artist: Record<string, unknown>) => {
      const meta = (artist.metadata || {}) as Record<string, unknown>;
      const spotifyId = String(meta.spotify_id || "").trim();

      if (!spotifyId) {
        skipped++;
        results.push({ slug: String(artist.slug), name: String(artist.display_name), spotify_id: "", status: "skipped", message: "No spotify_id in metadata" });
        return;
      }

      const currentImage = artist.public_image_url ? String(artist.public_image_url) : null;
      if (currentImage && currentImage.startsWith("http") && !specificSlug) {
        skipped++;
        results.push({ slug: String(artist.slug), name: String(artist.display_name), spotify_id: spotifyId, status: "skipped", message: "Already has valid image URL" });
        return;
      }

      const spotifyArtist = await fetchSpotifyArtist(spotifyId, spotifyToken);

      if (!spotifyArtist) {
        errors++;
        results.push({ slug: String(artist.slug), name: String(artist.display_name), spotify_id: spotifyId, status: "error", old_image: currentImage, message: "Spotify API returned no data" });
        return;
      }

      const imageUrl = pickBestImage(spotifyArtist.images);

      if (!imageUrl) {
        noImage++;
        results.push({ slug: String(artist.slug), name: String(artist.display_name), spotify_id: spotifyId, status: "no_image", old_image: currentImage, message: "Spotify has no images for this artist" });
        return;
      }

      if (!dryRun) {
        const updatedMeta = {
          ...meta,
          spotify_followers: spotifyArtist.followers?.total ?? meta.spotify_followers,
          spotify_popularity: spotifyArtist.popularity ?? meta.spotify_popularity,
        };

        const { error: updateErr } = await db
          .from("registry_artists")
          .update({
            public_image_url: imageUrl,
            image_source_provider: "spotify",
            metadata: updatedMeta,
            updated_at: now,
          })
          .eq("id", String(artist.id));

        if (updateErr) {
          errors++;
          results.push({ slug: String(artist.slug), name: String(artist.display_name), spotify_id: spotifyId, status: "error", old_image: currentImage, message: "DB update failed: " + updateErr.message });
          return;
        }
      }

      updated++;
      results.push({
        slug: String(artist.slug),
        name: String(artist.display_name),
        spotify_id: spotifyId,
        status: "updated",
        old_image: currentImage,
        new_image: imageUrl,
      });
    }));

    if (i + SPOTIFY_BATCH < artists.length) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return json(req, {
    ok: true,
    dry_run: dryRun,
    total_found: artists.length,
    updated,
    skipped,
    no_image: noImage,
    errors,
    results,
  });
});
