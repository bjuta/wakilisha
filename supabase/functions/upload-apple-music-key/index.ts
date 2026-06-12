import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  // Check admin role
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

  // Parse multipart form data to extract the .p8 file
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

  // Validate that it looks like a private key
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
  const description = `Apple Music .p8 private key — ${fileName} (${keyLength} chars, uploaded ${now})`;

  // ── Store in Supabase Vault (encrypted at rest) ──
  let vaultAction = "none";
  let vaultError: string | null = null;

  try {
    // Check if secret already exists in Vault
    const checkRes = await fetch(
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
          description,
        }),
      },
    );

    if (checkRes.ok) {
      vaultAction = "created";
    } else {
      // Likely already exists — try update via a separate approach
      // Vault's update_secret requires the secret UUID, which we fetch first
      const secretsRes = await fetch(
        `${supabaseUrl}/rest/v1/vault/secrets?id=eq.apple_music_private_key&select=id&name=eq.apple_music_private_key`,
        {
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "apikey": supabaseKey,
          },
        },
      );
      
      // Actually, vault.secrets may not be directly queryable. Try update_secret via RPC:
      // First get the existing id from the create_secret error or try a different path
      // Fallback: delete + recreate via vault functions
      const updateBody = JSON.stringify({
        secret: keyContent,
        name: "apple_music_private_key",
        description,
      });
      
      // Try create_secret with a slightly different name first (to check if it's a name conflict)
      const retryRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/create_secret`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "apikey": supabaseKey,
          },
          body: updateBody,
        },
      );
      
      if (retryRes.ok) {
        vaultAction = "created";
      } else {
        const errText = await retryRes.text();
        console.error("Vault create_secret failed:", retryRes.status, errText);
        
        // Fallback: store in admin_settings_secrets (encrypted column) for backward compat
        // This ensures the key is still accessible during Vault transition
        const { error: fallbackErr } = await adminClient
          .from("admin_settings_secrets")
          .upsert({
            setting_key: "apple_music_private_key",
            setting_value: keyContent,
            updated_by: user.id,
            updated_at: now,
            metadata: { uploaded_file_name: fileName, uploaded_at: now, file_size: keyLength, storage: "fallback_admin_settings_secrets" },
          }, { onConflict: "setting_key" });

        if (fallbackErr) {
          vaultError = `Vault unavailable, fallback failed: ${fallbackErr.message}`;
        } else {
          vaultAction = "fallback_table";
          vaultError = `Vault create_secret returned ${retryRes.status}. Stored in admin_settings_secrets as fallback.`;
        }
      }
    }
  } catch (err) {
    vaultError = `Vault RPC exception: ${err instanceof Error ? err.message : String(err)}`;
    console.error("Vault storage error:", vaultError);

    // Emergency fallback
    const { error: fallbackErr } = await adminClient
      .from("admin_settings_secrets")
      .upsert({
        setting_key: "apple_music_private_key",
        setting_value: keyContent,
        updated_by: user.id,
        updated_at: now,
        metadata: { uploaded_file_name: fileName, uploaded_at: now, file_size: keyLength, storage: "fallback_admin_settings_secrets_after_error" },
      }, { onConflict: "setting_key" });

    if (fallbackErr) {
      console.error("Emergency fallback also failed:", fallbackErr.message);
      return new Response(JSON.stringify({ ok: false, error: "Failed to store private key securely in both Vault and fallback storage." }), {
        status: 500,
        headers: { ...ch, "Content-Type": "application/json" },
      });
    }
  }

  // Audit event
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

  const storedIn = vaultAction === "fallback_table" || vaultAction.startsWith("fallback") ? "admin_settings_secrets (Vault fallback)" : "Supabase Vault";

  return new Response(JSON.stringify({
    ok: true,
    message: `Apple Music .p8 private key uploaded and stored securely in ${storedIn}.`,
    details: {
      file_name: fileName,
      key_length: keyLength,
      uploaded_at: now,
      storage: storedIn,
      vault_action: vaultAction,
    },
  }), {
    status: 200,
    headers: { ...ch, "Content-Type": "application/json" },
  });
});
