// WAKILISHA media upload bridge.
// Browser/admin UI -> authenticated Edge Function -> protected Lightsail receiver.
// Large audio masters use a control-plane session plus direct resumable parts.
// Requires Supabase secrets:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY
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
const RESPONSIVE_DERIVATIVE_WIDTH = 640;
const RESPONSIVE_DERIVATIVE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
]);

type UploadKind = "image" | "document";
type JsonObject = Record<string, unknown>;

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

function serviceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
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

function requireAdmin(isAdmin: boolean) {
  if (!isAdmin) {
    throw Object.assign(
      new Error("Administrator access is required for resumable master uploads."),
      { status: 403 },
    );
  }
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function randomCapability() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

function receiverSessionBaseUrl() {
  const legacyReceiverUrl = new URL(env("MEDIA_UPLOAD_RECEIVER_URL"));
  return `${legacyReceiverUrl.origin}/__admin/media-upload-session`;
}

async function receiverAdminFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(
    "Authorization",
    `Bearer ${env("MEDIA_UPLOAD_RECEIVER_SECRET")}`,
  );
  const response = await fetch(`${receiverSessionBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload: objectValue(payload) };
}

async function userRpc(
  authHeader: string,
  functionName: string,
  args: JsonObject,
) {
  const { data, error } = await userClient(authHeader).rpc(functionName, args);
  if (error) {
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return objectValue(data);
}

async function serviceRpc(functionName: string, args: JsonObject) {
  const { data, error } = await serviceClient().rpc(functionName, args);
  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return objectValue(data);
}

async function createResumableSession(
  authHeader: string,
  body: JsonObject,
  version: "v1" | "v2" = "v1",
) {
  const idempotencyKey = stringValue(body.idempotency_key);
  const originalFilename = stringValue(body.original_filename);
  const mimeType = stringValue(body.mime_type).toLowerCase();
  const expectedByteSize = numberValue(body.expected_byte_size);
  const expectedSha256 = stringValue(body.expected_sha256).toLowerCase();
  const ttlCandidate = numberValue(body.ttl_seconds);
  const ttlSeconds = Number.isInteger(ttlCandidate) ? ttlCandidate : 86400;
  const correlationId = stringValue(body.correlation_id) || crypto.randomUUID();

  if (!idempotencyKey || !originalFilename || !mimeType || !Number.isInteger(expectedByteSize) || !expectedSha256) {
    throw Object.assign(new Error("Complete resumable upload metadata is required."), { status: 400 });
  }

  const session = await userRpc(
    authHeader,
    version === "v2"
      ? "create_media_upload_session_v2"
      : "create_media_upload_session_v1",
    {
      p_idempotency_key: idempotencyKey,
      p_original_filename: originalFilename,
      p_mime_type: mimeType,
      p_expected_byte_size: expectedByteSize,
      p_expected_sha256: expectedSha256,
      p_ttl_seconds: ttlSeconds,
      p_correlation_id: correlationId,
    },
  );

  const sessionId = stringValue(session.session_id);
  const capabilityToken = randomCapability();
  if (!sessionId) {
    throw Object.assign(new Error("Upload session was not created."), { status: 500 });
  }

  const { response, payload } = await receiverAdminFetch("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      storage_path: session.storage_path,
      expected_byte_size: session.expected_byte_size,
      expected_sha256: session.expected_sha256,
      part_size_bytes: session.part_size_bytes,
      total_parts: session.total_parts,
      expires_at: session.expires_at,
      capability_token: capabilityToken,
      mime_type: session.mime_type,
      original_filename: session.original_filename,
    }),
  });

  if (!response.ok) {
    throw Object.assign(
      new Error(stringValue(payload.error) || `Media receiver session creation failed with ${response.status}.`),
      { status: response.status },
    );
  }

  return {
    ok: true,
    mode:
      version === "v2"
        ? "resumable_media_master"
        : "resumable_audio_master",
    session: {
      ...session,
      receiver_state: payload.state,
      uploaded_parts: payload.uploaded_parts,
      uploaded_bytes: payload.uploaded_bytes,
    },
    capability_token: capabilityToken,
    part_upload_base_url: `${receiverSessionBaseUrl()}/sessions/${sessionId}/parts`,
  };
}

async function resumableSessionStatus(authHeader: string, body: JsonObject) {
  const sessionId = stringValue(body.session_id);
  if (!sessionId) {
    throw Object.assign(new Error("session_id is required."), { status: 400 });
  }

  const session = await userRpc(
    authHeader,
    "get_media_upload_session_v1",
    { p_session_id: sessionId },
  );

  const { response, payload } = await receiverAdminFetch(`/sessions/${sessionId}`);
  let durableSession = session;
  if (
    response.ok
    && stringValue(payload.state) === "expired"
    && stringValue(session.state) === "created"
  ) {
    durableSession = await serviceRpc(
      "expire_media_upload_session_v1",
      {
        p_session_id: sessionId,
        p_reason: "Receiver confirmed upload-session expiry and partial cleanup",
      },
    );
  }
  if (!response.ok && response.status !== 404) {
    throw Object.assign(
      new Error(stringValue(payload.error) || `Media receiver status failed with ${response.status}.`),
      { status: response.status },
    );
  }

  return {
    ok: true,
    session: durableSession,
    receiver: response.ok ? payload : { state: "missing" },
  };
}

async function finalizeResumableSession(authHeader: string, body: JsonObject) {
  const sessionId = stringValue(body.session_id);
  if (!sessionId) {
    throw Object.assign(new Error("session_id is required."), { status: 400 });
  }

  const session = await userRpc(
    authHeader,
    "get_media_upload_session_v1",
    { p_session_id: sessionId },
  );

  if (stringValue(session.state) === "verified" && stringValue(session.file_object_id)) {
    return { ok: true, idempotent: true, session };
  }

  const { response, payload } = await receiverAdminFetch(`/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (!response.ok) {
    if (response.status === 410) {
      await serviceRpc(
        "expire_media_upload_session_v1",
        {
          p_session_id: sessionId,
          p_reason: "Receiver confirmed upload-session expiry and partial cleanup",
        },
      );
    } else if (payload.terminal === true) {
      await serviceRpc(
        "fail_media_upload_session_v1",
        {
          p_session_id: sessionId,
          p_error: stringValue(payload.error) || "Receiver finalization failed.",
        },
      );
    }
    throw Object.assign(
      new Error(stringValue(payload.error) || `Media receiver finalization failed with ${response.status}.`),
      { status: response.status },
    );
  }

  const verified = await serviceRpc(
    "verify_media_upload_session_v1",
    {
      p_session_id: sessionId,
      p_storage_path: payload.storage_path,
      p_byte_size: payload.byte_size,
      p_sha256: payload.sha256,
      p_correlation_id: stringValue(session.correlation_id) || crypto.randomUUID(),
    },
  );

  return {
    ok: true,
    idempotent: false,
    session: verified,
    receiver: payload,
  };
}

async function cancelResumableSession(authHeader: string, body: JsonObject) {
  const sessionId = stringValue(body.session_id);
  const reason = stringValue(body.reason) || "Cancel resumable Media upload session";
  if (!sessionId) {
    throw Object.assign(new Error("session_id is required."), { status: 400 });
  }

  await userRpc(
    authHeader,
    "get_media_upload_session_v1",
    { p_session_id: sessionId },
  );

  const { response, payload } = await receiverAdminFetch(`/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw Object.assign(
      new Error(stringValue(payload.error) || `Media receiver cancellation failed with ${response.status}.`),
      { status: response.status },
    );
  }

  const session = await userRpc(
    authHeader,
    "cancel_media_upload_session_v1",
    {
      p_session_id: sessionId,
      p_reason: reason,
    },
  );

  return { ok: true, session, receiver: payload };
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

async function verifyResponsiveDerivative(
  originalUrl: string,
  storagePath: string,
  fileName: string,
  fileExtension: string,
): Promise<Record<string, unknown> | null> {
  if (!RESPONSIVE_DERIVATIVE_EXTENSIONS.has(fileExtension)) {
    return null;
  }

  const cleanStoragePath = storagePath.replace(/^\/+/, "");
  const derivativeStoragePath =
    `__image/w${RESPONSIVE_DERIVATIVE_WIDTH}/${cleanStoragePath}`;
  const derivativeUrl = new URL(originalUrl);

  derivativeUrl.pathname = `/${derivativeStoragePath}`;
  derivativeUrl.search = "";

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(
      derivativeUrl.toString(),
      {
        headers: {
          "Cache-Control": "no-cache",
        },
      },
    );

    if (response.ok) {
      const mimeType = (
        response.headers
          .get("content-type")
          ?.split(";")[0]
          ?.trim()
        || ""
      );

      if (!mimeType.startsWith("image/")) {
        return null;
      }

      const bytes = await response.arrayBuffer();
      const sha256 = await sha256Hex(bytes);

      return {
        variant_role: "responsive_width",
        file: {
          storage_provider: "lightsail_media",
          storage_namespace: "lightsail-media",
          storage_path: derivativeStoragePath,
          delivery_url: derivativeUrl.toString(),
          original_filename:
            `w${RESPONSIVE_DERIVATIVE_WIDTH}-${fileName}`,
          mime_type: mimeType,
          byte_size: bytes.byteLength,
          sha256,
          technical_metadata: {
            width: RESPONSIVE_DERIVATIVE_WIDTH,
            source_storage_path: cleanStoragePath,
            delivery_kind: "nginx_responsive_derivative",
          },
        },
        transformation_spec: {
          operation: "resize_width",
          width: RESPONSIVE_DERIVATIVE_WIDTH,
        },
        technical_metadata: {
          width: RESPONSIVE_DERIVATIVE_WIDTH,
          source_storage_path: cleanStoragePath,
        },
        generator_name: "nginx-image-filter",
        generator_version: "production",
      };
    }

    if (attempt < 3) {
      await new Promise((resolve) =>
        setTimeout(resolve, 250 * (attempt + 1))
      );
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Only POST is supported." });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token." });

    const { user: actor, isAdmin } = await requireAuthenticatedUser(authHeader);
    const requestContentType = req.headers.get("Content-Type") ?? "";

    if (requestContentType.toLowerCase().includes("application/json")) {
      requireAdmin(isAdmin);
      const body = objectValue(await req.json());
      const action = stringValue(body.action);

      if (action === "create_resumable_session") {
        return json(
          200,
          await createResumableSession(authHeader, body, "v1"),
        );
      }
      if (action === "create_resumable_session_v2") {
        return json(
          200,
          await createResumableSession(authHeader, body, "v2"),
        );
      }
      if (action === "resumable_session_status") {
        return json(200, await resumableSessionStatus(authHeader, body));
      }
      if (action === "finalize_resumable_session") {
        return json(200, await finalizeResumableSession(authHeader, body));
      }
      if (action === "cancel_resumable_session") {
        return json(200, await cancelResumableSession(authHeader, body));
      }

      return json(400, { error: "Unsupported resumable upload action." });
    }

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

    const publicUrl =
      payload.url
      || `https://media.wakilisha.africa/${storagePath}`;

    const responsiveDerivative =
      uploadKind === "image"
        ? await verifyResponsiveDerivative(
            publicUrl,
            storagePath,
            fileValue.name || "upload.png",
            fileExtension,
          )
        : null;

    return json(200, {
      ok: true,
      url: publicUrl,
      storage_path: payload.storage_path || storagePath,
      storage_bucket: "lightsail-media",
      mime_type: contentTypeForUpload(fileValue, uploadKind),
      size: fileValue.size,
      sha256,
      file_kind: uploadKind,
      responsive_derivative: responsiveDerivative,
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
