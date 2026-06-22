import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "https://readdy.cc",
  "https://www.readdy.cc",
  "https://readdy.ai",
  "https://readdy-site.link",
  "https://readdy-site.com",
  "https://readdy-staging.com",
  "https://localhost:5173",
  "http://localhost:5173",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isReaddyPreview = origin === "https://readdy.cc" || origin.endsWith(".readdy.cc");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || isReaddyPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const ch = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: ch });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Only POST supported." }), {
      status: 405,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseKey);

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
      return new Response(JSON.stringify({ ok: false, error: "Insufficient permissions." }), {
        status: 403,
        headers: { ...ch, "Content-Type": "application/json" },
      });
    }
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response(JSON.stringify({ ok: false, error: "Expected multipart/form-data with a .p8 file." }), {
      status: 400,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const formData = await req.formData();
  const file = formData.get("p8_file");

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ ok: false, error: "No .p8 file found in form field 'p8_file'." }), {
      status: 400,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const keyContent = await file.text();

  if (!keyContent.includes("-----BEGIN PRIVATE KEY-----")) {
    return new Response(JSON.stringify({
      ok: false,
      error: "File does not appear to be a valid .p8 private key. Expected '-----BEGIN PRIVATE KEY-----' header.",
    }), {
      status: 400,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  if (!keyContent.includes("-----END PRIVATE KEY-----")) {
    return new Response(JSON.stringify({
      ok: false,
      error: "File does not appear to be a valid .p8 private key. Expected '-----END PRIVATE KEY-----' footer.",
    }), {
      status: 400,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const keyLength = keyContent.length;
  if (keyLength < 200 || keyLength > 10000) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Private key length (${keyLength} chars) is outside expected range (200-10000).`,
    }), {
      status: 400,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();
  const fileName = file.name || "uploaded.p8";

  const { error: upsertErr } = await adminClient
    .from("admin_settings_secrets")
    .upsert({
      setting_key: "apple_music_private_key",
      setting_value: keyContent,
      updated_by: user.id,
      updated_at: now,
      metadata: {
        uploaded_file_name: fileName,
        uploaded_at: now,
        file_size: keyLength,
        storage: "admin_settings_secrets",
      },
    }, { onConflict: "setting_key" });

  if (upsertErr) {
    console.error("[upload-key] Failed to store in admin_settings_secrets:", upsertErr.message);
    return new Response(JSON.stringify({
      ok: false,
      error: `Failed to store key: ${upsertErr.message}`,
    }), {
      status: 500,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  console.log(`[upload-key] Apple Music .p8 stored in admin_settings_secrets: ${keyLength} chars`);

  let vaultAction = "none";
  let vaultError: string | null = null;

  try {
    const vaultRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/create_secret`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          secret: keyContent,
          name: "apple_music_private_key",
          description: `Apple Music .p8 private key — ${fileName} (${keyLength} chars, uploaded ${now})`,
        }),
      },
    );

    if (vaultRes.ok) {
      vaultAction = "created";
    } else {
      vaultError = `Vault create_secret returned ${vaultRes.status}`;
    }
  } catch (err) {
    vaultError = `Vault RPC exception: ${err instanceof Error ? err.message : String(err)}`;
  }

  await adminClient.from("chart_ingest_audit_events").insert({
    run_id: null,
    actor: user.id,
    actor_email: user.email || null,
    action: "apple_music_key_uploaded",
    new_status: null,
    payload_json: {
      file_name: fileName,
      key_length: keyLength,
      vault_action: vaultAction,
      vault_error: vaultError,
    },
  });

  return new Response(JSON.stringify({
    ok: true,
    message: `Apple Music .p8 private key (${keyLength} chars) uploaded and stored securely.`,
    details: {
      file_name: fileName,
      key_length: keyLength,
      uploaded_at: now,
      vault_action: vaultAction,
      vault_error: vaultError,
    },
  }), {
    status: 200,
    headers: { ...ch, "Content-Type": "application/json" },
  });
});
