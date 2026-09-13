// Phase 9A.2 public query transport.
//
// This Edge Function owns transport only. Search authority remains in the
// anonymous bounded PostgreSQL RPC search_public_registry_v1. The browser
// reaches this adapter through the same-origin /api/public/v1/search route and
// never needs Supabase/RPC coordinates.
//
// The search projection is live over canonical Registry rows, so Registry
// mutations become authoritative immediately. Shared caches are deliberately
// short-lived: revalidation observes the new RPC result and therefore a new
// ETag without a second search-index invalidation lifecycle.
import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL")
  ?? "";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY")
  ?? "";

const ENTITY_TYPES = [
  "artist",
  "track",
  "release",
  "genre",
  "label",
] as const;

type EntityType =
  typeof ENTITY_TYPES[number];

type SearchCursor = {
  version: 1;
  query: string;
  types: EntityType[];
  score: number;
  typeRank: number;
  title: string;
  id: string;
};

type SearchRow = {
  entity_type: string;
  entity_id: string;
  slug: string;
  parent_slug: string | null;
  title: string;
  subtitle: string;
  image_url: string | null;
  payload: Record<string, unknown> | null;
  score: number;
  type_rank: number;
  overall_total: number | string;
  type_total: number | string;
  remaining_total: number | string;
  has_more: boolean;
  cursor_title: string;
  document_updated_at: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const securityHeaders: Record<
  string,
  string
> = {
  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options":
    "nosniff",
  "X-Frame-Options":
    "DENY",
  "Referrer-Policy":
    "same-origin",
};

const publicCacheHeaders: Record<
  string,
  string
> = {
  "Cache-Control":
    "public, max-age=15, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control":
    "public, s-maxage=60, stale-while-revalidate=300",
  "Vary":
    "Accept-Encoding",
};

function response(
  body: BodyInit | null,
  status: number,
  headers: Record<
    string,
    string
  > = {},
): Response {
  return new Response(
    body,
    {
      status,
      headers: {
        ...securityHeaders,
        ...headers,
      },
    },
  );
}

function errorResponse(
  message: string,
  status: number,
  method: string,
): Response {
  return response(
    method === "HEAD"
      ? null
      : JSON.stringify({
          error: message,
        }),
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",
      "Cache-Control":
        "no-store",
    },
  );
}

function parseTypes(
  value: string | null,
): EntityType[] {
  if (!value) {
    return [
      ...ENTITY_TYPES,
    ];
  }

  const requested =
    value
      .split(",")
      .map(
        (part) =>
          part
            .trim()
            .toLowerCase(),
      )
      .filter(Boolean);

  if (
    requested.length === 0
  ) {
    return [
      ...ENTITY_TYPES,
    ];
  }

  const allowed =
    new Set<string>(
      ENTITY_TYPES,
    );

  if (
    requested.some(
      (type) =>
        !allowed.has(type),
    )
  ) {
    throw new Error(
      "invalid_types",
    );
  }

  return ENTITY_TYPES.filter(
    (type) =>
      requested.includes(type),
  );
}

function clampLimit(
  value: string | null,
): number {
  const parsed =
    Number.parseInt(
      value ?? "",
      10,
    );

  if (
    !Number.isFinite(parsed)
  ) {
    return 20;
  }

  return Math.max(
    1,
    Math.min(
      parsed,
      50,
    ),
  );
}

function bytesToBase64Url(
  bytes: Uint8Array,
): string {
  let binary = "";

  for (
    const byte
    of bytes
  ) {
    binary +=
      String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(
  value: string,
): Uint8Array {
  const normalized =
    value
      .replaceAll("-", "+")
      .replaceAll("_", "/");

  const padding =
    "=".repeat(
      (
        4
        - (
          normalized.length
          % 4
        )
      ) % 4,
    );

  const binary =
    atob(
      normalized
      + padding,
    );

  return Uint8Array.from(
    binary,
    (character) =>
      character.charCodeAt(0),
  );
}

function encodeCursor(
  cursor: SearchCursor,
): string {
  return bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify(cursor),
    ),
  );
}

function decodeCursor(
  value: string | null,
  query: string,
  types: EntityType[],
): SearchCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: Partial<SearchCursor> =
      JSON.parse(
        new TextDecoder().decode(
          base64UrlToBytes(
            value,
          ),
        ),
      );

    if (
      parsed.version !== 1
      || parsed.query
        !== query
      || !Array.isArray(
        parsed.types,
      )
      || parsed.types.join(",")
        !== types.join(",")
      || !Number.isInteger(
        parsed.score,
      )
      || !Number.isInteger(
        parsed.typeRank,
      )
      || typeof parsed.title
        !== "string"
      || typeof parsed.id
        !== "string"
      || !UUID_PATTERN.test(
        parsed.id,
      )
    ) {
      return null;
    }

    return {
      version: 1,
      query,
      types,
      score:
        Number(
          parsed.score,
        ),
      typeRank:
        Number(
          parsed.typeRank,
        ),
      title:
        parsed.title,
      id:
        parsed.id,
    };
  } catch {
    return null;
  }
}

async function sha256(
  value: string,
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        value,
      ),
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map(
      (part) =>
        part
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}

function etagMatches(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  const expected =
    etag.replace(
      /^W\//i,
      "",
    );

  return ifNoneMatch
    .split(",")
    .map(
      (candidate) =>
        candidate.trim(),
    )
    .some(
      (candidate) =>
        candidate === "*"
        || candidate.replace(
          /^W\//i,
          "",
        ) === expected,
    );
}

Deno.serve(
  async (
    request,
  ) => {
    const method =
      request.method.toUpperCase();

    if (
      method !== "GET"
      && method !== "HEAD"
    ) {
      return errorResponse(
        "method_not_allowed",
        405,
        method,
      );
    }

    if (
      !SUPABASE_URL
      || !SUPABASE_ANON_KEY
    ) {
      return errorResponse(
        "public_query_unavailable",
        503,
        method,
      );
    }

    const url =
      new URL(
        request.url,
      );

    const query =
      (
        url.searchParams
          .get("q")
        ?? ""
      )
        .trim()
        .slice(
          0,
          128,
        );

    if (!query) {
      return errorResponse(
        "query_required",
        400,
        method,
      );
    }

    let types: EntityType[];

    try {
      types =
        parseTypes(
          url.searchParams
            .get(
              "types",
            ),
        );
    } catch {
      return errorResponse(
        "invalid_types",
        400,
        method,
      );
    }

    const limit =
      clampLimit(
        url.searchParams
          .get("limit"),
      );

    const normalizedQuery =
      query.toLowerCase();

    const rawCursor =
      url.searchParams
        .get("cursor");

    const cursor =
      decodeCursor(
        rawCursor,
        normalizedQuery,
        types,
      );

    if (
      rawCursor
      && !cursor
    ) {
      return errorResponse(
        "invalid_cursor",
        400,
        method,
      );
    }

    const supabase =
      createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
            detectSessionInUrl:
              false,
          },
        },
      );

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "search_public_registry_v1",
        {
          p_query:
            query,
          p_types:
            types,
          p_limit:
            limit,
          p_after_score:
            cursor?.score
            ?? null,
          p_after_type_rank:
            cursor?.typeRank
            ?? null,
          p_after_title:
            cursor?.title
            ?? null,
          p_after_id:
            cursor?.id
            ?? null,
        },
      );

    if (error) {
      console.error(
        "public-query-v1 search RPC failed",
        error.message,
      );

      return errorResponse(
        "public_query_failed",
        502,
        method,
      );
    }

    const rows: SearchRow[] =
      data
      ?? [];

    const last =
      rows.at(-1)
      ?? null;

    const hasMore =
      Boolean(
        last?.has_more,
      );

    const nextCursor =
      hasMore
      && last
        ? encodeCursor({
            version: 1,
            query:
              normalizedQuery,
            types,
            score:
              Number(
                last.score,
              ),
            typeRank:
              Number(
                last.type_rank,
              ),
            title:
              last.cursor_title,
            id:
              last.entity_id,
          })
        : null;

    const payload = {
      version:
        "v1",
      query,
      types,
      results:
        rows.map(
          (row) => ({
            type:
              row.entity_type,
            id:
              row.entity_id,
            slug:
              row.slug,
            parentSlug:
              row.parent_slug,
            title:
              row.title,
            subtitle:
              row.subtitle,
            imageUrl:
              row.image_url,
            payload:
              row.payload
              ?? {},
            updatedAt:
              row.document_updated_at,
          }),
        ),
      page: {
        limit,
        total:
          rows.length
            ? Number(
                rows[0]
                  .overall_total,
              )
            : 0,
        hasMore,
        nextCursor,
      },
    };

    const body =
      JSON.stringify(
        payload,
      );

    const etag =
      `"${await sha256(body)}"`;

    if (
      etagMatches(
        request.headers.get(
          "if-none-match",
        ),
        etag,
      )
    ) {
      return response(
        null,
        304,
        {
          ...publicCacheHeaders,
          "ETag":
            etag,
          "X-Wakilisha-ETag":
            etag,
        },
      );
    }

    return response(
      method === "HEAD"
        ? null
        : body,
      200,
      {
        ...publicCacheHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
        "ETag":
          etag,
        "X-Wakilisha-ETag":
          etag,
      },
    );
  },
);
