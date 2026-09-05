import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type JsonObject = Record<string, unknown>;

type BoundSession = {
  submission_resource_id: string;
  media_intake_id: string;
  slot_number: number;
  attempt_number: number;
  intake_state: string;
  session_id: string;
  session_state: string;
  storage_provider: string;
  storage_namespace: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  expected_byte_size: number;
  expected_sha256: string;
  part_size_bytes: number;
  total_parts: number;
  expires_at: string;
  correlation_id: string;
};

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function integerValue(value: unknown): number {
  const number = numberValue(value);
  return Number.isInteger(number) ? number : Number.NaN;
}

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get("FIELD_INTAKE_ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

  return new Set([
    "https://wakilisha.africa",
    "https://www.wakilisha.africa",
    "http://localhost:5173",
    ...configured,
  ]);
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function responseJson(origin: string, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requestOrigin(req: Request): string {
  const origin = req.headers.get("Origin")?.trim() ?? "";
  if (!origin || !allowedOrigins().has(origin)) {
    throw Object.assign(new Error("Origin is not allowed."), { status: 403 });
  }
  return origin;
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

async function requireFieldActor(authHeader: string) {
  const client = userClient(authHeader);
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError || !userResult.user) {
    throw Object.assign(new Error("Authentication is required."), { status: 401 });
  }

  const { data: hasCapability, error: capabilityError } = await client.rpc(
    "current_user_has_capability",
    { required_capability: "submit_field_capture" },
  );
  if (capabilityError) {
    throw Object.assign(new Error("Field intake authorization failed."), { status: 403 });
  }
  if (hasCapability !== true) {
    throw Object.assign(new Error("Field intake is not enabled for this account."), { status: 403 });
  }

  return userResult.user;
}

function rpcErrorStatus(error: { code?: unknown }): number {
  const code = stringValue(error.code);
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (code === "23505") return 409;
  if (code === "22023" || code === "22P02") return 400;
  return 500;
}

async function userRpc(
  authHeader: string,
  functionName: string,
  args: JsonObject,
): Promise<JsonObject> {
  const { data, error } = await userClient(authHeader).rpc(functionName, args);
  if (error) {
    throw Object.assign(
      new Error(error.message),
      { status: rpcErrorStatus(error) },
    );
  }
  const value = Array.isArray(data) ? data[0] : data;
  return objectValue(value);
}

async function serviceRpc(
  functionName: string,
  args: JsonObject,
): Promise<JsonObject> {
  const { data, error } = await serviceClient().rpc(functionName, args);
  if (error) {
    throw Object.assign(
      new Error(error.message),
      { status: rpcErrorStatus(error) },
    );
  }
  const value = Array.isArray(data) ? data[0] : data;
  return objectValue(value);
}

function receiverSessionBaseUrl(): string {
  const configured = new URL(env("MEDIA_UPLOAD_RECEIVER_URL"));
  return `${configured.origin}/__admin/media-upload-session`;
}

async function receiverAdminFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; payload: JsonObject }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env("MEDIA_UPLOAD_RECEIVER_SECRET")}`);
  const response = await fetch(`${receiverSessionBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const payload = objectValue(await response.json().catch(() => null));
  return { response, payload };
}

function freshCapability(): string {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

function safeBoundSession(value: JsonObject): BoundSession {
  const bound = {
    submission_resource_id: stringValue(value.submission_resource_id),
    media_intake_id: stringValue(value.media_intake_id),
    slot_number: integerValue(value.slot_number),
    attempt_number: integerValue(value.attempt_number),
    intake_state: stringValue(value.intake_state),
    session_id: stringValue(value.session_id),
    session_state: stringValue(value.session_state),
    storage_provider: stringValue(value.storage_provider),
    storage_namespace: stringValue(value.storage_namespace),
    storage_path: stringValue(value.storage_path),
    original_filename: stringValue(value.original_filename),
    mime_type: stringValue(value.mime_type),
    expected_byte_size: integerValue(value.expected_byte_size),
    expected_sha256: stringValue(value.expected_sha256).toLowerCase(),
    part_size_bytes: integerValue(value.part_size_bytes),
    total_parts: integerValue(value.total_parts),
    expires_at: stringValue(value.expires_at),
    correlation_id: stringValue(value.correlation_id),
  } satisfies BoundSession;

  if (
    !bound.submission_resource_id
    || !bound.media_intake_id
    || !bound.session_id
    || bound.slot_number < 1
    || bound.attempt_number < 1
    || !bound.storage_path.startsWith("masters/video/")
    || !bound.mime_type.startsWith("video/")
    || bound.expected_byte_size < 1
    || !/^[0-9a-f]{64}$/.test(bound.expected_sha256)
    || bound.part_size_bytes < 1
    || bound.total_parts < 1
    || !bound.expires_at
  ) {
    throw Object.assign(new Error("Bound Field upload metadata is incomplete."), { status: 500 });
  }

  return bound;
}

async function getBoundSession(
  actorId: string,
  submissionId: string,
  intakeId: string,
): Promise<BoundSession> {
  if (!submissionId || !intakeId) {
    throw Object.assign(new Error("Submission and Media intake are required."), { status: 400 });
  }

  const result = await serviceRpc(
    "get_field_media_receiver_session_v1",
    {
      p_actor_id: actorId,
      p_submission_resource_id: submissionId,
      p_media_intake_id: intakeId,
    },
  );
  const bound = safeBoundSession(result);

  if (
    bound.submission_resource_id !== submissionId
    || bound.media_intake_id !== intakeId
  ) {
    throw Object.assign(new Error("Field upload binding mismatch."), { status: 403 });
  }

  return bound;
}

async function provisionReceiverCapability(
  bound: BoundSession,
): Promise<{ capabilityToken: string; receiver: JsonObject }> {
  const capabilityToken = freshCapability();
  const { response, payload } = await receiverAdminFetch("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: bound.session_id,
      storage_path: bound.storage_path,
      expected_byte_size: bound.expected_byte_size,
      expected_sha256: bound.expected_sha256,
      part_size_bytes: bound.part_size_bytes,
      total_parts: bound.total_parts,
      expires_at: bound.expires_at,
      capability_token: capabilityToken,
      mime_type: bound.mime_type,
      original_filename: bound.original_filename,
    }),
  });

  if (!response.ok) {
    const status = response.status === 409 ? 409 : 502;
    throw Object.assign(
      new Error(
        stringValue(payload.error)
        || "The protected Media receiver did not accept the Field upload session.",
      ),
      { status },
    );
  }

  return { capabilityToken, receiver: payload };
}

function safeSessionResponse(
  bound: BoundSession,
  receiver: JsonObject,
): JsonObject {
  return {
    submission_resource_id: bound.submission_resource_id,
    media_intake_id: bound.media_intake_id,
    slot_number: bound.slot_number,
    attempt_number: bound.attempt_number,
    intake_state: bound.intake_state,
    media_upload_session_id: bound.session_id,
    media_upload_state: bound.session_state,
    receiver_state: stringValue(receiver.state) || bound.session_state,
    part_size_bytes: bound.part_size_bytes,
    total_parts: bound.total_parts,
    uploaded_parts: Math.max(0, integerValue(receiver.uploaded_parts) || 0),
    uploaded_bytes: Math.max(0, integerValue(receiver.uploaded_bytes) || 0),
    expires_at: bound.expires_at,
  };
}

async function reconcileReceiverState(
  actorId: string,
  submissionId: string,
  intakeId: string,
  correlationId: string,
  bound: BoundSession,
  receiver: JsonObject,
): Promise<BoundSession> {
  if (bound.session_state !== "created") return bound;

  const receiverState = stringValue(receiver.state);

  if (receiverState === "verified") {
    const storagePath = stringValue(receiver.storage_path);
    const byteSize = integerValue(receiver.verified_byte_size);
    const sha256 = stringValue(receiver.verified_sha256).toLowerCase();

    if (
      storagePath !== bound.storage_path
      || byteSize !== bound.expected_byte_size
      || sha256 !== bound.expected_sha256
    ) {
      await serviceRpc(
        "fail_media_upload_session_v1",
        {
          p_session_id: bound.session_id,
          p_error: "Field receiver verified-state metadata did not match durable upload authority.",
        },
      );
    } else {
      await serviceRpc(
        "verify_media_upload_session_v1",
        {
          p_session_id: bound.session_id,
          p_storage_path: storagePath,
          p_byte_size: byteSize,
          p_sha256: sha256,
          p_correlation_id: correlationId,
        },
      );
    }

    await serviceRpc(
      "sync_field_media_intake_v1",
      {
        p_actor_id: actorId,
        p_submission_resource_id: submissionId,
        p_media_intake_id: intakeId,
        p_correlation_id: correlationId,
      },
    );

    const reconciled = await getBoundSession(
      actorId,
      submissionId,
      intakeId,
    );

    if (reconciled.session_state !== "verified") {
      throw Object.assign(
        new Error("The receiver's verified state did not match durable Field upload authority."),
        { status: 409 },
      );
    }

    return reconciled;
  }

  if (receiverState === "expired") {
    await serviceRpc(
      "expire_media_upload_session_v1",
      {
        p_session_id: bound.session_id,
        p_reason: "Field receiver confirmed upload-session expiry and partial cleanup",
      },
    );
  } else if (new Set(["failed", "cancelled"]).has(receiverState)) {
    await serviceRpc(
      "fail_media_upload_session_v1",
      {
        p_session_id: bound.session_id,
        p_error: `Field receiver reported terminal upload state: ${receiverState}.`,
      },
    );
  } else {
    return bound;
  }

  await serviceRpc(
    "sync_field_media_intake_v1",
    {
      p_actor_id: actorId,
      p_submission_resource_id: submissionId,
      p_media_intake_id: intakeId,
      p_correlation_id: correlationId,
    },
  );

  return await getBoundSession(
    actorId,
    submissionId,
    intakeId,
  );
}

async function createUploadSession(
  authHeader: string,
  actorId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const submissionId = stringValue(body.submission_resource_id);
  const expectedRevision = integerValue(body.expected_current_revision);
  const slotNumber = integerValue(body.slot_number);
  const originalFilename = stringValue(body.original_filename);
  const mimeType = stringValue(body.mime_type).toLowerCase();
  const expectedByteSize = integerValue(body.expected_byte_size);
  const expectedSha256 = stringValue(body.expected_sha256).toLowerCase();
  const idempotencyKey = stringValue(body.idempotency_key);
  const ttlSeconds = Number.isInteger(integerValue(body.ttl_seconds))
    ? integerValue(body.ttl_seconds)
    : 86400;
  const correlationId = stringValue(body.correlation_id) || crypto.randomUUID();

  if (
    !submissionId
    || expectedRevision < 1
    || slotNumber < 1
    || !originalFilename
    || !mimeType.startsWith("video/")
    || expectedByteSize < 1
    || !/^[0-9a-f]{64}$/.test(expectedSha256)
    || !idempotencyKey
  ) {
    throw Object.assign(new Error("Complete Field upload metadata is required."), { status: 400 });
  }

  const started = await userRpc(
    authHeader,
    "create_field_media_upload_session_v1",
    {
      p_submission_resource_id: submissionId,
      p_expected_current_revision: expectedRevision,
      p_slot_number: slotNumber,
      p_original_filename: originalFilename,
      p_mime_type: mimeType,
      p_expected_byte_size: expectedByteSize,
      p_expected_sha256: expectedSha256,
      p_idempotency_key: idempotencyKey,
      p_ttl_seconds: ttlSeconds,
      p_correlation_id: correlationId,
    },
  );

  const receiptStatus = stringValue(started.receipt_status);
  if (receiptStatus !== "succeeded") {
    throw Object.assign(
      new Error(
        "Field upload session was not accepted. Refresh the submission state before retrying.",
      ),
      { status: 409 },
    );
  }

  const intakeId = stringValue(started.media_intake_id);
  const sessionId = stringValue(started.media_upload_session_id);
  if (!intakeId || !sessionId) {
    throw Object.assign(new Error("Field upload session creation returned incomplete authority."), { status: 500 });
  }

  let bound = await getBoundSession(actorId, submissionId, intakeId);
  if (bound.session_id !== sessionId) {
    throw Object.assign(new Error("Field Media intake and upload session do not match."), { status: 500 });
  }
  if (bound.session_state !== "created") {
    throw Object.assign(
      new Error("This Field upload attempt is no longer available for direct upload."),
      { status: 409 },
    );
  }

  const { capabilityToken, receiver } = await provisionReceiverCapability(bound);
  bound = await reconcileReceiverState(
    actorId,
    submissionId,
    intakeId,
    correlationId,
    bound,
    receiver,
  );
  if (bound.session_state !== "created") {
    throw Object.assign(
      new Error("This Field upload attempt no longer needs an upload capability."),
      { status: 409 },
    );
  }

  return {
    ok: true,
    command_receipt_id: stringValue(started.command_receipt_id),
    receipt_status: stringValue(started.receipt_status),
    current_revision: integerValue(started.current_revision),
    submission_state: stringValue(started.submission_state),
    idempotent_replay: started.idempotent_replay === true,
    session: safeSessionResponse(bound, receiver),
    capability_token: capabilityToken,
    part_upload_base_url: `${receiverSessionBaseUrl()}/sessions/${bound.session_id}/parts`,
  };
}

async function reissueUploadCapability(
  actorId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const submissionId = stringValue(body.submission_resource_id);
  const intakeId = stringValue(body.media_intake_id);
  const correlationId = stringValue(body.correlation_id) || crypto.randomUUID();
  let bound = await getBoundSession(actorId, submissionId, intakeId);

  if (bound.session_state !== "created") {
    throw Object.assign(new Error("This upload attempt is no longer resumable."), { status: 409 });
  }

  const { capabilityToken, receiver } = await provisionReceiverCapability(bound);
  bound = await reconcileReceiverState(
    actorId,
    submissionId,
    intakeId,
    correlationId,
    bound,
    receiver,
  );
  if (bound.session_state !== "created") {
    throw Object.assign(new Error("This upload attempt is no longer resumable."), { status: 409 });
  }

  await serviceRpc(
    "record_field_media_upload_resume_v1",
    {
      p_actor_id: actorId,
      p_submission_resource_id: submissionId,
      p_media_intake_id: intakeId,
      p_correlation_id: correlationId,
    },
  );

  return {
    ok: true,
    session: safeSessionResponse(bound, receiver),
    capability_token: capabilityToken,
    part_upload_base_url: `${receiverSessionBaseUrl()}/sessions/${bound.session_id}/parts`,
  };
}

async function uploadStatus(
  actorId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const submissionId = stringValue(body.submission_resource_id);
  const intakeId = stringValue(body.media_intake_id);
  const correlationId = stringValue(body.correlation_id) || crypto.randomUUID();
  let bound = await getBoundSession(actorId, submissionId, intakeId);
  const { response, payload } = await receiverAdminFetch(`/sessions/${bound.session_id}`);

  if (response.status === 404) {
    return {
      ok: true,
      session: safeSessionResponse(bound, { state: "missing" }),
    };
  }

  if (!response.ok) {
    throw Object.assign(
      new Error(stringValue(payload.error) || "Field upload status is unavailable."),
      { status: response.status >= 500 ? 502 : response.status },
    );
  }

  bound = await reconcileReceiverState(
    actorId,
    submissionId,
    intakeId,
    correlationId,
    bound,
    payload,
  );

  return {
    ok: true,
    session: safeSessionResponse(bound, payload),
  };
}

async function finalizeUpload(
  actorId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const submissionId = stringValue(body.submission_resource_id);
  const intakeId = stringValue(body.media_intake_id);
  const correlationId = stringValue(body.correlation_id) || crypto.randomUUID();
  let bound = await getBoundSession(actorId, submissionId, intakeId);

  if (bound.session_state !== "verified") {
    const { response, payload } = await receiverAdminFetch(
      `/sessions/${bound.session_id}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );

    if (!response.ok) {
      if (response.status === 410) {
        await serviceRpc(
          "expire_media_upload_session_v1",
          {
            p_session_id: bound.session_id,
            p_reason: "Field receiver confirmed upload-session expiry and partial cleanup",
          },
        );
        await serviceRpc(
          "sync_field_media_intake_v1",
          {
            p_actor_id: actorId,
            p_submission_resource_id: submissionId,
            p_media_intake_id: intakeId,
            p_correlation_id: correlationId,
          },
        );
        throw Object.assign(new Error("This upload attempt expired. Start a new attempt with the same submission."), { status: 410 });
      }

      if (payload.terminal === true) {
        await serviceRpc(
          "fail_media_upload_session_v1",
          {
            p_session_id: bound.session_id,
            p_error: stringValue(payload.error) || "Protected Field receiver finalization failed.",
          },
        );
        await serviceRpc(
          "sync_field_media_intake_v1",
          {
            p_actor_id: actorId,
            p_submission_resource_id: submissionId,
            p_media_intake_id: intakeId,
            p_correlation_id: correlationId,
          },
        );
      }

      throw Object.assign(
        new Error(stringValue(payload.error) || "The protected Field upload could not be finalized."),
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const storagePath = stringValue(payload.storage_path);
    const byteSize = integerValue(payload.byte_size);
    const sha256 = stringValue(payload.sha256).toLowerCase();
    if (
      storagePath !== bound.storage_path
      || byteSize !== bound.expected_byte_size
      || sha256 !== bound.expected_sha256
    ) {
      await serviceRpc(
        "fail_media_upload_session_v1",
        {
          p_session_id: bound.session_id,
          p_error: "Protected receiver returned immutable Field upload metadata mismatch.",
        },
      );
      await serviceRpc(
        "sync_field_media_intake_v1",
        {
          p_actor_id: actorId,
          p_submission_resource_id: submissionId,
          p_media_intake_id: intakeId,
          p_correlation_id: correlationId,
        },
      );
      throw Object.assign(new Error("The verified upload did not match the selected original."), { status: 409 });
    }

    await serviceRpc(
      "verify_media_upload_session_v1",
      {
        p_session_id: bound.session_id,
        p_storage_path: storagePath,
        p_byte_size: byteSize,
        p_sha256: sha256,
        p_correlation_id: correlationId,
      },
    );
  }

  const synced = await serviceRpc(
    "sync_field_media_intake_v1",
    {
      p_actor_id: actorId,
      p_submission_resource_id: submissionId,
      p_media_intake_id: intakeId,
      p_correlation_id: correlationId,
    },
  );
  bound = await getBoundSession(actorId, submissionId, intakeId);

  return {
    ok: true,
    session: {
      ...safeSessionResponse(bound, { state: bound.session_state }),
      intake_state: stringValue(synced.intake_state) || bound.intake_state,
      media_upload_state: stringValue(synced.media_upload_state) || bound.session_state,
    },
  };
}

async function cancelSubmission(
  authHeader: string,
  actorId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const submissionId = stringValue(body.submission_resource_id);
  const intakeId = stringValue(body.media_intake_id);
  const expectedRevision = integerValue(body.expected_current_revision);
  const idempotencyKey = stringValue(body.idempotency_key);
  const reason = stringValue(body.reason) || "Contributor cancelled Field Submission before canonical adoption";
  const correlationId = stringValue(body.correlation_id) || crypto.randomUUID();

  if (!submissionId || !intakeId || expectedRevision < 1 || !idempotencyKey) {
    throw Object.assign(new Error("Complete Field cancellation authority is required."), { status: 400 });
  }

  const bound = await getBoundSession(actorId, submissionId, intakeId);
  const cancelled = await userRpc(
    authHeader,
    "cancel_field_submission_v1",
    {
      p_submission_resource_id: submissionId,
      p_expected_current_revision: expectedRevision,
      p_idempotency_key: idempotencyKey,
      p_reason: reason,
      p_correlation_id: correlationId,
    },
  );

  if (stringValue(cancelled.receipt_status) !== "succeeded") {
    throw Object.assign(
      new Error(
        "Field cancellation was not accepted. Refresh the submission state before retrying.",
      ),
      { status: 409 },
    );
  }

  const { response, payload } = await receiverAdminFetch(`/sessions/${bound.session_id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw Object.assign(
      new Error(
        stringValue(payload.error)
        || "The submission was cancelled, but protected partial-upload cleanup needs another retry.",
      ),
      { status: 502 },
    );
  }

  return {
    ok: true,
    command_receipt_id: stringValue(cancelled.command_receipt_id),
    receipt_status: stringValue(cancelled.receipt_status),
    submission_resource_id: submissionId,
    current_revision: integerValue(cancelled.current_revision),
    submission_state: stringValue(cancelled.submission_state),
    idempotent_replay: cancelled.idempotent_replay === true,
    receiver_cleanup_state: response.ok
      ? stringValue(payload.state) || "cancelled"
      : "already_absent",
  };
}

function errorStatus(error: unknown): number {
  const status = Number((error as { status?: unknown })?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function safeErrorMessage(error: unknown, status: number): string {
  if (error instanceof Error && status < 500) return error.message;
  return "Field intake control could not complete this request.";
}

serve(async (req) => {
  let origin = "";
  try {
    origin = requestOrigin(req);
  } catch (error) {
    return new Response(JSON.stringify({ error: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return responseJson(origin, 405, { error: "Only POST is supported." });
  }

  try {
    const authHeader = req.headers.get("Authorization")?.trim() ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return responseJson(origin, 401, { error: "Authentication is required." });
    }

    const actor = await requireFieldActor(authHeader);
    const contentType = req.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      return responseJson(origin, 415, { error: "Field intake control accepts JSON only." });
    }

    const body = objectValue(await req.json());
    const action = stringValue(body.action);

    if (action === "create_upload_session") {
      return responseJson(origin, 200, await createUploadSession(authHeader, actor.id, body));
    }
    if (action === "reissue_upload_capability") {
      return responseJson(origin, 200, await reissueUploadCapability(actor.id, body));
    }
    if (action === "upload_status") {
      return responseJson(origin, 200, await uploadStatus(actor.id, body));
    }
    if (action === "finalize_upload") {
      return responseJson(origin, 200, await finalizeUpload(actor.id, body));
    }
    if (action === "cancel_submission") {
      return responseJson(origin, 200, await cancelSubmission(authHeader, actor.id, body));
    }

    return responseJson(origin, 400, { error: "Unsupported Field intake control action." });
  } catch (error) {
    const status = errorStatus(error);
    return responseJson(origin, status, { error: safeErrorMessage(error, status) });
  }
});
