// Phase 7B public Video protected-text transport adapter.
//
// Authority stays in PostgreSQL. This function receives only immutable
// published-version identity, asks service-only public RPCs for governed
// caption or transcript file targets, signs canonical Lightsail paths, and
// proxies public-safe text bytes. No private storage path is sent to the browser.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MEDIA_PRIVATE_DELIVERY_SECRET =
  Deno.env.get("MEDIA_PRIVATE_DELIVERY_SECRET") ?? "";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const headers: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

type JsonObject = Record<string, unknown>;

function response(
  body: BodyInit | null,
  status: number,
  extra: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      ...headers,
      ...extra,
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
    method === "HEAD" ? null : "Invalid public Video delivery request\n",
    400,
    {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  );
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function privateCaptionPath(value: unknown): string {
  const path = stringValue(value).replace(/^\/+/, "");

  if (
    !/^private-files\/captions\/[^/]+[.]vtt$/i.test(path)
    || path.includes("..")
  ) {
    throw new Error("Caption storage path is not public-delivery eligible.");
  }

  return path;
}

function privateTranscriptPath(value: unknown): string {
  const path = stringValue(value).replace(/^\/+/, "");

  if (
    !/^private-files\/transcripts\/[^/]+[.]txt$/i.test(path)
    || path.includes("..")
  ) {
    throw new Error(
      "Transcript storage path is not public-delivery eligible.",
    );
  }

  return path;
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function protectedPrivateUrl(storagePath: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + 60;
  const token = await hmacSha256Hex(
    MEDIA_PRIVATE_DELIVERY_SECRET,
    `${expires}\n${storagePath}`,
  );

  const url = new URL(
    `https://media.wakilisha.africa/__private/media-file/${encodeStoragePath(storagePath)}`,
  );
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("token", token);
  return url.toString();
}

serve(async (request) => {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return response(null, 204, {
      "Cache-Control": "public, max-age=86400",
    });
  }

  if (method !== "GET" && method !== "HEAD") {
    return response("Method not allowed\n", 405, {
      "Allow": "GET, HEAD, OPTIONS",
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
  }

  if (
    !SUPABASE_URL
    || !SUPABASE_SERVICE_ROLE_KEY
    || !MEDIA_PRIVATE_DELIVERY_SECRET
  ) {
    return response(
      method === "HEAD" ? null : "Public Video delivery unavailable\n",
      503,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    );
  }

  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") ?? "")
    .trim()
    .toLowerCase();

  if (kind !== "caption" && kind !== "transcript") {
    return badRequest(method);
  }

  const version = (url.searchParams.get("version") ?? "").trim();

  if (!UUID_PATTERN.test(version)) {
    return badRequest(method);
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  if (kind === "transcript") {
    const { data, error } = await supabase.rpc(
      "get_public_video_transcript_delivery_target",
      {
        p_publication_version_id: version,
      },
    );

    if (error || !data || typeof data !== "object") {
      return notFound(method);
    }

    const target = objectValue(data);
    const mimeType = stringValue(target.mime_type);
    const byteSize = Number(target.byte_size);

    if (
      mimeType !== "text/plain"
      || !Number.isFinite(byteSize)
      || byteSize <= 0
    ) {
      return notFound(method);
    }

    let storagePath: string;
    try {
      storagePath = privateTranscriptPath(target.storage_path);
    } catch {
      return notFound(method);
    }

    const signedUrl = await protectedPrivateUrl(storagePath);
    const mediaResponse = await fetch(signedUrl, {
      method,
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!mediaResponse.ok) {
      return notFound(method);
    }

    const etag = `"${stringValue(target.sha256)}"`;

    return response(
      method === "HEAD" ? null : mediaResponse.body,
      200,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": String(Math.round(byteSize)),
        "Cache-Control":
          "public, max-age=300, stale-while-revalidate=1800",
        "ETag": etag,
      },
    );
  }

  const trackText = (url.searchParams.get("track") ?? "").trim();
  const track = Number(trackText);

  if (!Number.isInteger(track) || track < 1) {
    return badRequest(method);
  }

  const { data, error } = await supabase.rpc(
    "get_public_video_caption_delivery_target",
    {
      p_publication_version_id: version,
      p_track_number: track,
    },
  );

  if (error || !data || typeof data !== "object") {
    return notFound(method);
  }

  const target = objectValue(data);
  const mimeType = stringValue(target.mime_type);
  const byteSize = Number(target.byte_size);

  if (
    mimeType !== "text/vtt"
    || !Number.isFinite(byteSize)
    || byteSize <= 0
  ) {
    return notFound(method);
  }

  let storagePath: string;
  try {
    storagePath = privateCaptionPath(target.storage_path);
  } catch {
    return notFound(method);
  }

  const signedUrl = await protectedPrivateUrl(storagePath);
  const mediaResponse = await fetch(signedUrl, {
    method,
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!mediaResponse.ok) {
    return notFound(method);
  }

  const etag = `"${stringValue(target.sha256)}"`;

  return response(
    method === "HEAD" ? null : mediaResponse.body,
    200,
    {
      "Content-Type": "text/vtt; charset=utf-8",
      "Content-Length": String(Math.round(byteSize)),
      "Cache-Control":
        "public, max-age=300, stale-while-revalidate=1800",
      "ETag": etag,
    },
  );
});
