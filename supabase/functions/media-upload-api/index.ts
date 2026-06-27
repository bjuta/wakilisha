// WAKILISHA media upload bridge.
// Browser/admin UI -> this authenticated Edge Function -> protected Lightsail receiver.
// Requires Supabase secrets:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - MEDIA_UPLOAD_RECEIVER_URL
// - MEDIA_UPLOAD_RECEIVER_SECRET

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "ico"]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function userClient(authHeader: string) {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

async function requireAdministrator(authHeader: string) {
  const client = userClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw Object.assign(new Error("Not authenticated."), { status: 401 });
  }

  const { data: ok, error } = await client.rpc("current_user_is_administrator");
  if (error || ok !== true) {
    throw Object.assign(new Error("Only administrators can upload media."), { status: 403 });
  }

  return userData.user;
}

function slugPart(value: string, fallback = "upload") {
  const cleaned = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return cleaned || fallback;
}

function extensionFromName(fileName: string) {
  const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function buildStoragePath(folder: string, fileName: string) {
  const ext = extensionFromName(fileName);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw Object.assign(new Error(`Unsupported file extension: ${ext || "none"}`), { status: 400 });
  }

  const cleanFolder = String(folder || "uploads")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => slugPart(part))
    .join("/");

  const safeFolder = cleanFolder.startsWith("uploads") ? cleanFolder : `uploads/${cleanFolder || "admin"}`;
  const baseName = slugPart(fileName.replace(/\.[^.]+$/, ""), "media").slice(0, 44);
  const rand = crypto.randomUUID().slice(0, 8);

  return `${safeFolder}/${Date.now()}-${rand}-${baseName}.${ext}`;
}

function validateExistingPath(path: string) {
  const cleaned = String(path || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned.startsWith("uploads/")) {
    throw Object.assign(new Error("Existing storage path must start with uploads/."), { status: 400 });
  }
  if (cleaned.includes("../") || cleaned.includes("/..") || cleaned === "..") {
    throw Object.assign(new Error("Invalid storage path."), { status: 400 });
  }

  const ext = extensionFromName(cleaned);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw Object.assign(new Error(`Unsupported file extension: ${ext || "none"}`), { status: 400 });
  }

  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Only POST is supported." });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token." });

    const actor = await requireAdministrator(authHeader);

    const form = await req.formData();
    const fileValue = form.get("file");

    if (!(fileValue instanceof File)) {
      return json(400, { error: "file is required." });
    }

    if (!fileValue.type.startsWith("image/")) {
      return json(415, { error: `Only image uploads are supported. Got: ${fileValue.type || "unknown"}` });
    }

    if (fileValue.size <= 0) return json(400, { error: "File is empty." });
    if (fileValue.size > MAX_UPLOAD_BYTES) return json(413, { error: "File is too large." });

    const folder = String(form.get("folder") ?? "uploads");
    const existingPath = String(form.get("storage_path") ?? "").trim();

    const storagePath = existingPath
      ? validateExistingPath(existingPath)
      : buildStoragePath(folder, fileValue.name || "upload.png");

    const receiverUrl = env("MEDIA_UPLOAD_RECEIVER_URL");
    const receiverSecret = env("MEDIA_UPLOAD_RECEIVER_SECRET");

    const uploadUrl = new URL(receiverUrl);
    uploadUrl.searchParams.set("path", storagePath);

    const response = await fetch(uploadUrl.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${receiverSecret}`,
        "Content-Type": fileValue.type,
      },
      body: await fileValue.arrayBuffer(),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof payload?.error === "string"
        ? payload.error
        : `Lightsail media receiver failed with ${response.status}`;
      return json(response.status, { error: message });
    }

    return json(200, {
      ok: true,
      url: payload.url || `https://media.wakilisha.africa/${storagePath}`,
      storage_path: payload.storage_path || storagePath,
      storage_bucket: "lightsail-media",
      mime_type: fileValue.type,
      size: fileValue.size,
      uploaded_by: actor.id,
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : 500;

    return json(status, {
      error: error instanceof Error ? error.message : "Upload failed.",
    });
  }
});
