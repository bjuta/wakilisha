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
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "ico"]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(["pdf"]);
const ALLOWED_EXTENSIONS = new Set([...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_DOCUMENT_EXTENSIONS]);

type UploadKind = "image" | "document";

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

async function requireAuthenticatedUser(authHeader: string) {
  const client = userClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw Object.assign(new Error("Not authenticated."), { status: 401 });
  }

  const { data: isAdmin } = await client.rpc("current_user_is_administrator");

  return {
    user: userData.user,
    isAdmin: isAdmin === true,
  };
}

function isOwnProfileMediaPath(storagePath: string, userId: string) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return storagePath.startsWith(`uploads/profiles/${safeUserId}/`);
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

function classifyUploadKind(file: File, ext: string): UploadKind {
  const mimeType = String(file.type || "").toLowerCase();

  if (ALLOWED_IMAGE_EXTENSIONS.has(ext) && (mimeType.startsWith("image/") || mimeType === "")) {
    return "image";
  }

  if (ALLOWED_DOCUMENT_EXTENSIONS.has(ext) && (mimeType === "application/pdf" || mimeType === "")) {
    return "document";
  }

  throw Object.assign(
    new Error(`Unsupported file type: ${mimeType || ext || "unknown"}`),
    { status: 415 },
  );
}

function contentTypeForUpload(file: File, kind: UploadKind) {
  if (file.type) return file.type;
  if (kind === "document") return "application/pdf";
  return "application/octet-stream";
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Only POST is supported." });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token." });

    const { user: actor, isAdmin } = await requireAuthenticatedUser(authHeader);

    const form = await req.formData();
    const fileValue = form.get("file");

    if (!(fileValue instanceof File)) {
      return json(400, { error: "file is required." });
    }

    if (fileValue.size <= 0) return json(400, { error: "File is empty." });
    if (fileValue.size > MAX_UPLOAD_BYTES) return json(413, { error: "File is too large." });

    const fileExtension = extensionFromName(fileValue.name || "");
    const uploadKind = classifyUploadKind(fileValue, fileExtension);

    const folder = String(form.get("folder") ?? "uploads");
    const existingPath = String(form.get("storage_path") ?? "").trim();

    if (existingPath) {
      return json(409, {
        error: "This file path is already in use. Upload the file to a new path.",
      });
    }

    const storagePath = buildStoragePath(
      folder,
      fileValue.name || "upload.png",
    );

    if (!isAdmin) {
      if (!isOwnProfileMediaPath(storagePath, actor.id)) {
        return json(403, { error: "You can only upload your own profile media." });
      }

      if (uploadKind !== "image") {
        return json(415, { error: "Profile media uploads must be images." });
      }
    }

    const receiverUrl = env("MEDIA_UPLOAD_RECEIVER_URL");
    const receiverSecret = env("MEDIA_UPLOAD_RECEIVER_SECRET");

    const uploadUrl = new URL(receiverUrl);
    uploadUrl.searchParams.set("path", storagePath);

    const fileBytes = await fileValue.arrayBuffer();
    const sha256 = await sha256Hex(fileBytes);

    const response = await fetch(uploadUrl.toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${receiverSecret}`,
        "Content-Type": contentTypeForUpload(fileValue, uploadKind),
      },
      body: fileBytes,
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
      mime_type: contentTypeForUpload(fileValue, uploadKind),
      size: fileValue.size,
      sha256,
      file_kind: uploadKind,
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
