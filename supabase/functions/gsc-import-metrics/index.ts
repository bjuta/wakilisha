import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "1; mode=block",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

interface GscRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function extractPropertyFromUrl(url: string): string {
  let cleaned = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (cleaned.startsWith("sc-domain:")) return cleaned;
  if (!cleaned.startsWith("http")) cleaned = `https://${cleaned}`;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) return json(req, { ok: false, error: "Invalid or expired token" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Permission check
  const { data: roles } = await adminClient
    .from("user_role_assignments")
    .select("role_key")
    .eq("user_id", user.id)
    .eq("status", "active");
  const roleKeys = (roles ?? []).map((r: { role_key: string }) => r.role_key);
  if (!roleKeys.includes("administrator")) {
    const { data: caps } = await adminClient
      .from("role_capabilities")
      .select("capability_key")
      .in("role_key", roleKeys)
      .eq("capability_key", "manage_settings");
    if (!caps || caps.length === 0) {
      return json(req, { ok: false, error: "Insufficient permissions. Requires 'manage_settings' capability." }, 403);
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return json(req, { ok: false, error: "Invalid JSON body" }, 400);
  }

  const { action, connectionId, dateRangeStart, dateRangeEnd, rowLimit, includePages } = body as {
    action?: string;
    connectionId?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    rowLimit?: number;
    includePages?: string[];
  };

  if (action === "import") {
    if (!connectionId || !dateRangeStart || !dateRangeEnd) {
      return json(req, {
        ok: false,
        error: "connectionId, dateRangeStart, and dateRangeEnd are required for import action",
      }, 400);
    }

    // Read connection — need access token and property URL
    const { data: conn, error: connErr } = await adminClient
      .from("gsc_connections")
      .select("id, property_url, access_token, refresh_token, token_expiry")
      .eq("id", connectionId)
      .eq("status", "connected")
      .maybeSingle();

    if (connErr || !conn) {
      return json(req, { ok: false, error: "No connected GSC connection found with that ID." }, 404);
    }

    let accessToken = conn.access_token as string | null;
    if (!accessToken) {
      return json(req, { ok: false, error: "No access token stored for this connection. Reconnect via OAuth." }, 400);
    }

    // Check token expiry — if expired, try to refresh
    if (conn.token_expiry) {
      const expiry = new Date(conn.token_expiry);
      if (expiry <= new Date() && conn.refresh_token) {
        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
        if (googleClientId && googleClientSecret) {
          try {
            const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: googleClientId,
                client_secret: googleClientSecret,
                refresh_token: conn.refresh_token,
                grant_type: "refresh_token",
              }).toString(),
            });
            const refreshData = await refreshRes.json() as Record<string, unknown>;
            if (refreshRes.ok && refreshData.access_token) {
              accessToken = refreshData.access_token as string;
              const newExpiry = refreshData.expires_in
                ? new Date(Date.now() + (refreshData.expires_in as number) * 1000).toISOString()
                : null;
              await adminClient.from("gsc_connections").update({
                access_token: accessToken,
                token_expiry: newExpiry,
                updated_at: new Date().toISOString(),
              }).eq("id", connectionId);
            }
          } catch {
            // Refresh failed — continue with existing token, GSC API will reject if expired
          }
        }
      }
    }

    const propertyUrl = conn.property_url as string;
    const gscProperty = extractPropertyFromUrl(propertyUrl);

    // Create import run record
    const { data: run, error: runErr } = await adminClient
      .from("gsc_import_runs")
      .insert({
        connection_id: connectionId,
        status: "running",
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runErr) {
      return json(req, { ok: false, error: "internal_error" }, 500);
    }

    // Fetch from GSC API
    const limit = rowLimit || 5000;
    const dimensions = includePages && includePages.length > 0
      ? ["query", "page"]
      : ["query"];

    const gscPayload = {
      startDate: dateRangeStart,
      endDate: dateRangeEnd,
      dimensions: dimensions,
      rowLimit: limit,
    };

    let gscResponse: Response;
    try {
      gscResponse = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscProperty)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gscPayload),
        },
      );
    } catch (e) {
      await adminClient.from("gsc_import_runs").update({
        status: "failed",
        error_message: `GSC API unreachable: ${e instanceof Error ? e.message : String(e)}`,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      return json(req, { ok: false, error: `Failed to reach Google Search Console API: ${e instanceof Error ? e.message : String(e)}` }, 502);
    }

    if (!gscResponse.ok) {
      const errText = await gscResponse.text();
      let errMsg = `GSC API returned ${gscResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch { /* not JSON */ }

      await adminClient.from("gsc_import_runs").update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      // If 401/403, mark connection as needing re-auth
      if (gscResponse.status === 401 || gscResponse.status === 403) {
        await adminClient.from("gsc_connections").update({
          status: "needs_reauth",
          updated_at: new Date().toISOString(),
        }).eq("id", connectionId);
      }

      return json(req, { ok: false, error: `GSC API error: ${errMsg}`, gscStatus: gscResponse.status }, 400);
    }

    const gscData = await gscResponse.json() as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
    const rows: GscRow[] = (gscData.rows ?? []).map((row) => {
      const hasPage = dimensions.length > 1 && row.keys.length > 1;
      return {
        query: row.keys[0],
        page: hasPage ? row.keys[1] : "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      };
    });

    if (rows.length === 0) {
      await adminClient.from("gsc_import_runs").update({
        status: "completed",
        rows_imported: 0,
        rows_matched: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      return json(req, {
        ok: true,
        message: "Import completed but GSC returned no rows for this date range.",
        runId: run.id,
        rowsImported: 0,
      });
    }

    // Batch insert into gsc_query_page_metrics
    const BATCH_SIZE = 500;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((row) => ({
        import_run_id: run.id,
        property_url: propertyUrl,
        query: row.query,
        page: row.page || null,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        metric_date: dateRangeEnd,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
      }));

      const { error: insertErr } = await adminClient
        .from("gsc_query_page_metrics")
        .insert(batch);

      if (insertErr) {
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    // Update run record
    await adminClient.from("gsc_import_runs").update({
      status: "completed",
      rows_imported: inserted,
      rows_matched: 0, // Entity matching is a separate step
      rows_failed: failed,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    // Update connection last_import_at
    await adminClient.from("gsc_connections").update({
      last_import_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", connectionId);

    // Audit log
    await adminClient.from("admin_audit_events").insert({
      actor: user.id,
      actor_email: user.email ?? null,
      action: "gsc_import_completed",
      payload_json: {
        connection_id: connectionId,
        run_id: run.id,
        rows_imported: inserted,
        rows_failed: failed,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
      },
    }).catch(() => {});

    return json(req, {
      ok: true,
      message: `Imported ${inserted} query metrics from Google Search Console.`,
      runId: run.id,
      rowsImported: inserted,
      rowsFailed: failed,
    });
  }

  return json(req, { ok: false, error: `Unknown action: ${action}. Use 'import'.` }, 400);
});
