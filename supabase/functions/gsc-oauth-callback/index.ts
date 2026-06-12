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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!googleClientId || !googleClientSecret) {
    return json(req, { ok: false, error: "Server configuration missing: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set as Edge Function secrets." }, 500);
  }

  // Verify caller is authenticated
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

  // Check permissions — must be administrator or have manage_settings
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

  const { action, code, redirectUri, connectionId } = body as {
    action?: string;
    code?: string;
    redirectUri?: string;
    connectionId?: string;
  };

  if (action === "exchange_code") {
    if (!code || !redirectUri) {
      return json(req, { ok: false, error: "code and redirectUri are required for exchange_code action" }, 400);
    }

    // Exchange authorization code for tokens
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });
    } catch (e) {
      return json(req, { ok: false, error: `Failed to reach Google OAuth endpoint: ${e instanceof Error ? e.message : String(e)}` }, 502);
    }

    const tokenData = await tokenResponse.json() as Record<string, unknown>;
    if (!tokenResponse.ok) {
      const errMsg = (tokenData.error_description as string) || (tokenData.error as string) || `HTTP ${tokenResponse.status}`;
      return json(req, { ok: false, error: `Google OAuth token exchange failed: ${errMsg}` }, 400);
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = tokenData.expires_in as number | undefined;

    if (!accessToken) {
      return json(req, { ok: false, error: "Google returned no access_token" }, 500);
    }

    const tokenExpiry = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Find pending connection to update, or update the one specified
    const now = new Date().toISOString();

    if (connectionId) {
      const { error: updateErr } = await adminClient
        .from("gsc_connections")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          token_expiry: tokenExpiry,
          status: "connected",
          connected_at: now,
          updated_at: now,
        })
        .eq("id", connectionId);

      if (updateErr) {
        return json(req, { ok: false, error: "internal_error" }, 500);
      }
    } else {
      // Find the most recent pending connection
      const { data: pending, error: findErr } = await adminClient
        .from("gsc_connections")
        .select("id")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findErr) {
        return json(req, { ok: false, error: "internal_error" }, 500);
      }

      if (!pending) {
        return json(req, { ok: false, error: "No pending GSC connection found. Create a connection first." }, 404);
      }

      const { error: updateErr } = await adminClient
        .from("gsc_connections")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          token_expiry: tokenExpiry,
          status: "connected",
          connected_at: now,
          updated_at: now,
        })
        .eq("id", pending.id);

      if (updateErr) {
        return json(req, { ok: false, error: "internal_error" }, 500);
      }
    }

    // Audit log
    await adminClient.from("admin_audit_events").insert({
      actor: user.id,
      actor_email: user.email ?? null,
      action: "gsc_oauth_connected",
      payload_json: {
        connection_id: connectionId,
        token_expiry: tokenExpiry,
        has_refresh_token: !!refreshToken,
      },
    }).catch(() => {});

    return json(req, {
      ok: true,
      message: "Google Search Console connected successfully. Access token stored securely.",
    });
  }

  if (action === "refresh_token") {
    if (!connectionId) {
      return json(req, { ok: false, error: "connectionId is required for refresh_token action" }, 400);
    }

    // Read current connection
    const { data: conn, error: connErr } = await adminClient
      .from("gsc_connections")
      .select("refresh_token, property_url")
      .eq("id", connectionId)
      .maybeSingle();

    if (connErr || !conn) {
      return json(req, { ok: false, error: "Connection not found" }, 404);
    }

    if (!conn.refresh_token) {
      return json(req, { ok: false, error: "No refresh token available. Reconnect via OAuth." }, 400);
    }

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: conn.refresh_token,
          grant_type: "refresh_token",
        }).toString(),
      });
    } catch (e) {
      return json(req, { ok: false, error: `Failed to reach Google OAuth endpoint: ${e instanceof Error ? e.message : String(e)}` }, 502);
    }

    const tokenData = await tokenResponse.json() as Record<string, unknown>;
    if (!tokenResponse.ok) {
      const errMsg = (tokenData.error_description as string) || (tokenData.error as string) || `HTTP ${tokenResponse.status}`;
      return json(req, { ok: false, error: `Token refresh failed: ${errMsg}` }, 400);
    }

    const accessToken = tokenData.access_token as string;
    const expiresIn = tokenData.expires_in as number | undefined;
    const tokenExpiry = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const { error: updateErr } = await adminClient
      .from("gsc_connections")
      .update({
        access_token: accessToken,
        token_expiry: tokenExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    if (updateErr) return json(req, { ok: false, error: "internal_error" }, 500);

    return json(req, { ok: true, message: "Token refreshed successfully.", expires_at: tokenExpiry });
  }

  if (action === "disconnect") {
    if (!connectionId) {
      return json(req, { ok: false, error: "connectionId is required for disconnect action" }, 400);
    }

    const { error: updateErr } = await adminClient
      .from("gsc_connections")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    if (updateErr) return json(req, { ok: false, error: "internal_error" }, 500);

    await adminClient.from("admin_audit_events").insert({
      actor: user.id,
      actor_email: user.email ?? null,
      action: "gsc_disconnected",
      payload_json: { connection_id: connectionId },
    }).catch(() => {});

    return json(req, { ok: true, message: "GSC disconnected. Tokens cleared." });
  }

  return json(req, { ok: false, error: `Unknown action: ${action}. Use 'exchange_code', 'refresh_token', or 'disconnect'.` }, 400);
});
