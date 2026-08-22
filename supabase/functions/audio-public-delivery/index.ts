// Phase 6B M2 Audio transport adapter for shared Show identity.
//
// This function owns no Show or Audio authority. It uses only anonymous public
// RPCs and presents their governed projection as RSS XML or a stable Audio
// enclosure redirect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderShowAudioRss } from "./rss.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE_URL = "https://wakilisha.africa";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const securityHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

function response(
  body: BodyInit | null,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      ...securityHeaders,
      ...headers,
    },
  });
}

function notFound(method: string): Response {
  return response(
    method === "HEAD" ? null : "Not found\n",
    404,
    {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=30",
    },
  );
}

function badRequest(method: string): Response {
  return response(
    method === "HEAD" ? null : "Invalid public delivery request\n",
    400,
    {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return response(null, 204, {
      "Cache-Control": "public, max-age=86400",
    });
  }

  if (method !== "GET" && method !== "HEAD") {
    return response(
      "Method not allowed\n",
      405,
      {
        "Allow": "GET, HEAD, OPTIONS",
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    );
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response(
      method === "HEAD" ? null : "Public delivery unavailable\n",
      503,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    );
  }

  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") ?? "").trim().toLowerCase();

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  if (kind === "enclosure") {
    const publicationId = (url.searchParams.get("id") ?? "").trim();
    if (!UUID_PATTERN.test(publicationId)) return badRequest(method);

    const { data, error } = await supabase.rpc(
      "get_public_audio_enclosure",
      { p_publication_id: publicationId },
    );

    if (error || !data || typeof data !== "object") {
      return notFound(method);
    }

    const payload = data as Record<string, unknown>;
    const enclosureUrl = typeof payload.enclosure_url === "string"
      ? payload.enclosure_url.trim()
      : "";
    const sourceUrl = typeof payload.source_url === "string"
      ? payload.source_url.trim()
      : "";
    const mimeType = typeof payload.mime_type === "string"
      ? payload.mime_type.trim()
      : "";

    const expectedEnclosure = `${SITE_URL}/audio/enclosures/${publicationId}.mp3`;

    if (
      enclosureUrl !== expectedEnclosure ||
      !sourceUrl.startsWith("https://media.wakilisha.africa/derivatives/") ||
      mimeType !== "audio/mpeg"
    ) {
      return notFound(method);
    }

    return response(
      null,
      307,
      {
        "Location": sourceUrl,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    );
  }

  if (kind === "rss") {
    const showSlug = (url.searchParams.get("show") ?? "").trim().toLowerCase();
    if (!SLUG_PATTERN.test(showSlug)) return badRequest(method);

    const { data, error } = await supabase.rpc(
      "get_public_show",
      { p_slug: showSlug },
    );

    if (error || !data) return notFound(method);

    let xml: string;
    try {
      xml = renderShowAudioRss(data);
    } catch {
      return notFound(method);
    }

    const etag = `"${await sha256(xml)}"`;

    if (request.headers.get("if-none-match") === etag) {
      return response(null, 304, {
        "ETag": etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      });
    }

    return response(
      method === "HEAD" ? null : xml,
      200,
      {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "ETag": etag,
      },
    );
  }

  return badRequest(method);
});
