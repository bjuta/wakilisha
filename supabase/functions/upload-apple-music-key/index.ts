import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Only POST supported." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Parse multipart form data to extract the .p8 file
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response(JSON.stringify({ ok: false, error: "Expected multipart/form-data with a .p8 file." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const formData = await req.formData();
  const file = formData.get("p8_file");

  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ ok: false, error: "No .p8 file found in form field 'p8_file'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!keyContent.includes("-----END PRIVATE KEY-----")) {
    return new Response(JSON.stringify({
      ok: false,
      error: "File does not appear to be a valid .p8 private key. Expected '-----END PRIVATE KEY-----' footer.",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const keyLength = keyContent.length;
  if (keyLength < 200 || keyLength > 10000) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Private key length (${keyLength} chars) is outside expected range (200-10000).`,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Store in a secure table (only accessible by service_role / admin via RLS)
  const now = new Date().toISOString();
  const fileName = file.name || "uploaded.p8";

  // Upsert into provider_credentials or a dedicated secrets store
  const { error: insertErr } = await adminClient
    .from("admin_settings_secrets")
    .upsert({
      setting_key: "apple_music_private_key",
      setting_value: keyContent,
      updated_by: user.id,
      updated_at: now,
      metadata: { uploaded_file_name: fileName, uploaded_at: now, file_size: keyLength },
    }, { onConflict: "setting_key" });

  if (insertErr) {
    console.error("Failed to store Apple Music key:", insertErr.message);
    return new Response(JSON.stringify({ ok: false, error: "Failed to store private key securely." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    message: "Apple Music .p8 private key uploaded and stored securely.",
    details: {
      file_name: fileName,
      key_length: keyLength,
      uploaded_at: now,
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
