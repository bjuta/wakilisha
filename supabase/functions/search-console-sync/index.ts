import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_EMAIL = Deno.env.get("GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL") || "";
const GOOGLE_PRIVATE_KEY = Deno.env.get("GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY") || "";
const GOOGLE_SITE_URL = Deno.env.get("GOOGLE_SEARCH_CONSOLE_SITE_URL") || "https://wakilisha.africa/";

const SCOPES = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa")
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function base64Url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createJwtAssertion() {
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error("Google Search Console service account secrets are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(GOOGLE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${base64Url(signature)}`;
}

async function getGoogleAccessToken() {
  const assertion = await createJwtAssertion();

  const params = new URLSearchParams();
  params.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  params.set("assertion", assertion);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "Google token request failed.");
  }

  if (!payload.access_token) throw new Error("Google token response did not include an access token.");

  return String(payload.access_token);
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function isAdministrator(db: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await db
    .from("user_role_assignments")
    .select("role_key")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role_key", "administrator")
    .or("expires_at.is.null,expires_at.gt.now()")
    .limit(1);

  if (error) return false;
  return Boolean(data?.length);
}

async function fetchSearchAnalytics(args: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  startRow?: number;
}) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(args.siteUrl)}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: args.startDate,
      endDate: args.endDate,
      dimensions: args.dimensions,
      type: "web",
      rowLimit: 25000,
      startRow: args.startRow || 0,
      dataState: "final",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Search Analytics query failed.");
  }

  return payload;
}

function summarize(rows: any[]) {
  const totalClicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const totalImpressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const weightedPositionTotal = rows.reduce((sum, row) => sum + Number(row.position || 0) * Number(row.impressions || 0), 0);
  const averageCtr = totalImpressions ? totalClicks / totalImpressions : 0;
  const averagePosition = totalImpressions ? weightedPositionTotal / totalImpressions : 0;

  return {
    totalClicks,
    totalImpressions,
    averageCtr,
    averagePosition,
  };
}

async function latestPayload(db: ReturnType<typeof createClient>) {
  const { data: run } = await db
    .from("seo_search_console_sync_runs")
    .select("*")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return {
      run: null,
      rows: [],
    };
  }

  const { data: rows } = await db
    .from("seo_search_console_rows")
    .select("*")
    .eq("run_id", run.id)
    .order("impressions", { ascending: false })
    .limit(500);

  return {
    run,
    rows: rows || [],
  };
}

Deno.serve(async (req) => {
  const headers = cors(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const user = await getUser(req);

  if (!user) return json({ ok: false, error: "Unauthorized." }, headers, 401);

  const canManage = await isAdministrator(db, user.id);

  if (!canManage) return json({ ok: false, error: "Forbidden. Administrator access required." }, headers, 403);

  if (req.method === "GET") {
    return json({ ok: true, data: await latestPayload(db) }, headers);
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, headers, 405);
  }

  const body = await req.json().catch(() => ({}));
  const range = body?.startDate && body?.endDate
    ? { startDate: String(body.startDate), endDate: String(body.endDate) }
    : defaultDateRange();

  const siteUrl = String(body?.siteUrl || GOOGLE_SITE_URL || "").trim();
  if (!siteUrl) return json({ ok: false, error: "GOOGLE_SEARCH_CONSOLE_SITE_URL is not configured." }, headers, 400);

  const { data: run, error: runError } = await db
    .from("seo_search_console_sync_runs")
    .insert({
      status: "running",
      site_url: siteUrl,
      start_date: range.startDate,
      end_date: range.endDate,
      dimensions: ["query", "page"],
      created_by: user.id,
    })
    .select("*")
    .single();

  if (runError || !run) {
    return json({ ok: false, error: runError?.message || "Could not create Search Console sync run." }, headers, 500);
  }

  try {
    const accessToken = await getGoogleAccessToken();

    const allRows: any[] = [];
    let startRow = 0;

    while (true) {
      const payload = await fetchSearchAnalytics({
        accessToken,
        siteUrl,
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ["query", "page"],
        startRow,
      });

      const rows = payload.rows || [];
      allRows.push(...rows);

      if (rows.length < 25000) break;
      startRow += 25000;
      if (startRow >= 100000) break;
    }

    const rowsToInsert = allRows.map((row) => {
      const keys = row.keys || [];
      return {
        run_id: run.id,
        site_url: siteUrl,
        start_date: range.startDate,
        end_date: range.endDate,
        dimension_set: "query_page",
        query: keys[0] || null,
        page_url: keys[1] || null,
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
        raw_row: row,
      };
    });

    if (rowsToInsert.length) {
      const chunkSize = 1000;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const { error } = await db
          .from("seo_search_console_rows")
          .insert(rowsToInsert.slice(i, i + chunkSize));

        if (error) throw error;
      }
    }

    const summary = summarize(allRows);

    await db
      .from("seo_search_console_sync_runs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        row_count: allRows.length,
        total_clicks: summary.totalClicks,
        total_impressions: summary.totalImpressions,
        average_ctr: summary.averageCtr,
        average_position: summary.averagePosition,
      })
      .eq("id", run.id);

    return json({
      ok: true,
      data: {
        run: {
          ...run,
          status: "succeeded",
          row_count: allRows.length,
          total_clicks: summary.totalClicks,
          total_impressions: summary.totalImpressions,
          average_ctr: summary.averageCtr,
          average_position: summary.averagePosition,
        },
        rows: rowsToInsert.slice(0, 500),
      },
    }, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .from("seo_search_console_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", run.id);

    return json({ ok: false, error: message }, headers, 500);
  }
});
