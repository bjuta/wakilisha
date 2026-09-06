import { supabase } from "@/lib/supabase";
import { hashBlobSha256, hashFileSha256 } from "@/services/mediaHash";

export type FieldIdentityMode = "standard" | "restricted";
export type FieldAttributionPreference = "may_name" | "do_not_name";
export type FieldContactPreference = "account_contact" | "no_follow_up";
export type FieldRightsDeclaration =
  | "owns_or_controls"
  | "authorized_by_rights_holder"
  | "uncertain"
  | "other";
export type FieldConsentDeclaration =
  | "granted"
  | "not_required"
  | "uncertain"
  | "not_obtained";
export type FieldSensitivity = "none" | "low" | "moderate" | "high" | "extreme";
export type FieldSourceProtection = "internal" | "restricted" | "confidential";
export type FieldEmbargoMode = "none" | "until_review" | "until_time";

export interface FieldDeclarations {
  newsroom_identity_mode: FieldIdentityMode;
  public_attribution_preference: FieldAttributionPreference;
  contact_preference: FieldContactPreference;
  rights_declaration: FieldRightsDeclaration;
  rights_declaration_detail?: string | null;
  consent_declaration: FieldConsentDeclaration;
  consent_declaration_detail?: string | null;
  declared_sensitivity: FieldSensitivity;
  source_protection_request: FieldSourceProtection;
  embargo_request_mode: FieldEmbargoMode;
  requested_embargo_until?: string | null;
  location_mode: "not_collected" | "coarse_text";
  location_description?: string | null;
  content_captured_at?: string | null;
  intake_notes?: string | null;
}

export type FieldClientStage =
  | "draft_local"
  | "hashing"
  | "creating_submission"
  | "creating_upload"
  | "uploading"
  | "waiting_for_network"
  | "paused"
  | "verifying"
  | "received"
  | "submitting"
  | "submitted"
  | "failed_recoverably"
  | "failed_terminally"
  | "cancelled";

export interface FieldProgress {
  stage: FieldClientStage;
  progress: number;
  processedBytes: number;
  totalBytes: number;
  uploadedParts: number;
  totalParts: number;
  message: string;
  submissionReference?: string;
}

export interface FieldReceipt {
  submissionResourceId: string;
  submissionReference: string;
  submissionState: string;
  currentRevision: number;
  submittedAt: string | null;
  receiptIssuedAt: string | null;
  adoptedMediaCount: number;
  receiptMessage: string;
}

export interface FieldQueueRecord {
  id: string;
  ownerUserId: string;
  submissionResourceId: string;
  submissionReference: string;
  submissionCurrentRevision: number;
  mediaIntakeId: string;
  mediaUploadSessionId: string;
  slotNumber: number;
  attemptNumber: number;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  partSizeBytes: number;
  totalParts: number;
  uploadedParts: number;
  uploadedBytes: number;
  fileBlob: Blob | null;
  localState: FieldClientStage;
  createdAt: string;
  updatedAt: string;
}

interface EdgeSession {
  submission_resource_id: string;
  media_intake_id: string;
  slot_number: number;
  attempt_number: number;
  intake_state: string;
  media_upload_session_id: string;
  media_upload_state: string;
  receiver_state: string;
  part_size_bytes: number;
  total_parts: number;
  uploaded_parts: number;
  uploaded_bytes: number;
  expires_at: string;
}

interface EdgeControlResult {
  ok?: boolean;
  error?: string;
  current_revision?: number;
  submission_state?: string;
  session?: EdgeSession;
  capability_token?: string;
  part_upload_base_url?: string;
}

const DB_NAME = "wakilisha-field-intake-v1";
const DB_VERSION = 1;
const STORE_NAME = "queue";
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "mkv"]);

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstObject(value: unknown): Record<string, unknown> {
  return objectValue(Array.isArray(value) ? value[0] : value);
}

function requiredString(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`Field response is missing ${label}.`);
  return text;
}

function integer(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function extensionFromName(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function assertVideoFile(file: File) {
  if (!file.type.toLowerCase().startsWith("video/")) {
    throw new Error("Choose a supported video file.");
  }
  if (!VIDEO_EXTENSIONS.has(extensionFromName(file.name))) {
    throw new Error("Supported video files are MP4, MOV, M4V, WebM, or MKV.");
  }
  if (file.size <= 0) throw new Error("The selected video is empty.");
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Field videos cannot exceed 2 GiB.");
}

function requireOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new FieldRecoverableError("waiting_for_network", "Waiting for a network connection.");
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw new DOMException("Field upload was paused.", "AbortError");
}

export class FieldRecoverableError extends Error {
  stage: FieldClientStage;
  constructor(stage: FieldClientStage, message: string) {
    super(message);
    this.name = "FieldRecoverableError";
    this.stage = stage;
  }
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!store.indexNames.contains("ownerUserId")) {
        store.createIndex("ownerUserId", "ownerUserId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Field queue storage is unavailable."));
  });
}

async function putQueue(record: FieldQueueRecord): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the local Field queue."));
  });
  db.close();
}

async function getQueue(id: string): Promise<FieldQueueRecord | null> {
  const db = await openQueueDb();
  const result = await new Promise<FieldQueueRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as FieldQueueRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local Field queue."));
  });
  db.close();
  return result;
}

async function deleteQueue(id: string): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clear the local Field queue."));
  });
  db.close();
}

export async function listFieldQueuesForOwner(ownerUserId: string): Promise<FieldQueueRecord[]> {
  const db = await openQueueDb();
  const result = await new Promise<FieldQueueRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).index("ownerUserId").getAll(ownerUserId);
    request.onsuccess = () => resolve((request.result as FieldQueueRecord[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Could not load the local Field queue."));
  });
  db.close();
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function invokeRpc(functionName: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(error.message);
  return firstObject(data);
}

async function invokeFieldControl(body: Record<string, unknown>): Promise<EdgeControlResult> {
  requireOnline();
  const { data, error } = await supabase.functions.invoke("field-intake-api", { body });
  if (error) throw new FieldRecoverableError("failed_recoverably", error.message);
  const result = objectValue(data) as EdgeControlResult;
  if (result.ok !== true) {
    throw new Error(typeof result.error === "string" ? result.error : "Field intake control returned an invalid response.");
  }
  return result;
}

export async function currentUserCanSubmitField(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("current_user_has_capability", {
    required_capability: "submit_field_capture",
  });
  if (error) return null;
  return data === true;
}

export async function getMyFieldSubmission(submissionResourceId: string) {
  return invokeRpc("get_my_field_submission_v1", {
    p_submission_resource_id: submissionResourceId,
  });
}

function report(
  callback: ((progress: FieldProgress) => void) | undefined,
  progress: FieldProgress,
) {
  callback?.(progress);
}

function edgeSession(result: EdgeControlResult): EdgeSession {
  if (!result.session) throw new Error("Field upload control did not return a session.");
  return result.session;
}

function capability(result: EdgeControlResult): { token: string; baseUrl: string } {
  const token = requiredString(result.capability_token, "upload capability");
  const baseUrl = requiredString(result.part_upload_base_url, "part upload base URL");
  return { token, baseUrl };
}

async function uploadPartWithRetry(
  url: string,
  token: string,
  part: Blob,
  partSha256: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const delays = [0, 600, 1800];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    throwIfAborted(signal);
    requireOnline();
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-Part-SHA256": partSha256,
        },
        body: part,
        signal,
      });
      const payload = objectValue(await response.json().catch(() => null));
      if (response.ok) return payload;
      const message = typeof payload.error === "string" ? payload.error : `Upload part failed with ${response.status}.`;
      if ([401, 403, 409, 410].includes(response.status)) throw new Error(message);
      lastError = new Error(message);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error instanceof Error ? error : new Error("Upload part failed.");
      if (attempt === delays.length - 1) break;
    }
  }
  throw new FieldRecoverableError("failed_recoverably", lastError?.message ?? "The upload paused after repeated network errors.");
}

async function uploadRemainingParts(
  queue: FieldQueueRecord,
  file: Blob,
  token: string,
  baseUrl: string,
  serverUploadedParts: number,
  onProgress?: (progress: FieldProgress) => void,
  signal?: AbortSignal,
): Promise<FieldQueueRecord> {
  let current = { ...queue, uploadedParts: serverUploadedParts };
  current.uploadedBytes = Math.min(file.size, serverUploadedParts * current.partSizeBytes);

  try {
    for (let partNumber = serverUploadedParts; partNumber < current.totalParts; partNumber += 1) {
      throwIfAborted(signal);
      const start = partNumber * current.partSizeBytes;
      const end = Math.min(start + current.partSizeBytes, file.size);
      const part = file.slice(start, end);
      const partSha256 = await hashBlobSha256(part, {
        chunkSizeBytes: 1024 * 1024,
        signal,
      });

      const payload = await uploadPartWithRetry(
        `${baseUrl}/${partNumber}`,
        token,
        part,
        partSha256,
        signal,
      );

      current = {
        ...current,
        uploadedParts: integer(payload.uploaded_parts, partNumber + 1),
        uploadedBytes: integer(payload.uploaded_bytes, end),
        localState: "uploading",
        updatedAt: new Date().toISOString(),
      };

      await putQueue(current);

      report(onProgress, {
        stage: "uploading",
        progress: current.byteSize ? current.uploadedBytes / current.byteSize : 0,
        processedBytes: current.uploadedBytes,
        totalBytes: current.byteSize,
        uploadedParts: current.uploadedParts,
        totalParts: current.totalParts,
        message: `Uploaded ${current.uploadedParts} of ${current.totalParts} parts`,
      });
    }
  } catch (error) {
    const recoverableState: FieldClientStage | null =
      error instanceof DOMException && error.name === "AbortError"
        ? "paused"
        : error instanceof FieldRecoverableError
          ? error.stage
          : null;

    if (recoverableState) {
      current = {
        ...current,
        localState: recoverableState,
        updatedAt: new Date().toISOString(),
      };
      await putQueue(current);
    }

    throw error;
  }

  return current;
}

function queueFromSession(
  queue: FieldQueueRecord,
  session: EdgeSession,
  state: FieldClientStage,
): FieldQueueRecord {
  return {
    ...queue,
    mediaIntakeId: session.media_intake_id,
    mediaUploadSessionId: session.media_upload_session_id,
    slotNumber: session.slot_number,
    attemptNumber: session.attempt_number,
    partSizeBytes: session.part_size_bytes,
    totalParts: session.total_parts,
    uploadedParts: session.uploaded_parts,
    uploadedBytes: session.uploaded_bytes,
    localState: state,
    updatedAt: new Date().toISOString(),
  };
}

async function startOrRestartUpload(
  queue: FieldQueueRecord,
  attemptKey: string,
): Promise<{ queue: FieldQueueRecord; control: EdgeControlResult }> {
  const control = await invokeFieldControl({
    action: "create_upload_session",
    submission_resource_id: queue.submissionResourceId,
    expected_current_revision: queue.submissionCurrentRevision,
    slot_number: queue.slotNumber || 1,
    original_filename: queue.originalFileName,
    mime_type: queue.mimeType,
    expected_byte_size: queue.byteSize,
    expected_sha256: queue.sha256,
    idempotency_key: attemptKey,
    ttl_seconds: 86400,
    correlation_id: crypto.randomUUID(),
  });
  const session = edgeSession(control);
  const updated = queueFromSession(queue, session, "creating_upload");
  await putQueue(updated);
  return { queue: updated, control };
}

async function finalizeReceivedSubmission(
  queue: FieldQueueRecord,
  expectedRevision: number,
  onProgress?: (progress: FieldProgress) => void,
): Promise<FieldReceipt> {
  report(onProgress, {
    stage: "submitting",
    progress: 1,
    processedBytes: queue.byteSize,
    totalBytes: queue.byteSize,
    uploadedParts: queue.totalParts,
    totalParts: queue.totalParts,
    message: "Finalizing your private submission…",
  });

  const finalized = await invokeRpc("finalize_field_submission_v1", {
    p_submission_resource_id: queue.submissionResourceId,
    p_expected_current_revision: expectedRevision,
    p_idempotency_key: `field.finalize.${queue.id}`,
    p_correlation_id: crypto.randomUUID(),
  });

  const receipt: FieldReceipt = {
    submissionResourceId: queue.submissionResourceId,
    submissionReference: requiredString(finalized.submission_reference, "submission reference"),
    submissionState: requiredString(finalized.submission_state, "submission state"),
    currentRevision: integer(finalized.current_revision, expectedRevision),
    submittedAt: typeof finalized.submitted_at === "string" ? finalized.submitted_at : null,
    receiptIssuedAt: typeof finalized.receipt_issued_at === "string" ? finalized.receipt_issued_at : null,
    adoptedMediaCount: integer(finalized.adopted_media_count),
    receiptMessage: typeof finalized.receipt_message === "string"
      ? finalized.receipt_message
      : "We received your submission for review.",
  };
  await deleteQueue(queue.id);
  report(onProgress, {
    stage: "submitted",
    progress: 1,
    processedBytes: queue.byteSize,
    totalBytes: queue.byteSize,
    uploadedParts: queue.totalParts,
    totalParts: queue.totalParts,
    message: "Submission received for review.",
  });
  return receipt;
}

async function adoptAndFinalize(
  queue: FieldQueueRecord,
  onProgress?: (progress: FieldProgress) => void,
): Promise<FieldReceipt> {
  report(onProgress, {
    stage: "received",
    progress: 1,
    processedBytes: queue.byteSize,
    totalBytes: queue.byteSize,
    uploadedParts: queue.totalParts,
    totalParts: queue.totalParts,
    message: "The exact original was verified. Attaching it to your submission…",
  });

  const adoption = await invokeRpc("adopt_verified_field_media_upload_session_v1", {
    p_submission_resource_id: queue.submissionResourceId,
    p_expected_current_revision: queue.submissionCurrentRevision,
    p_media_intake_id: queue.mediaIntakeId,
    p_idempotency_key: `field.media.adopt.${queue.id}.${queue.attemptNumber}`,
    p_correlation_id: crypto.randomUUID(),
  });
  const adoptedRevision = integer(adoption.current_revision, queue.submissionCurrentRevision);
  return finalizeReceivedSubmission(queue, adoptedRevision, onProgress);
}

export async function submitFieldVideo(
  ownerUserId: string,
  file: File,
  declarations: FieldDeclarations,
  options: {
    onProgress?: (progress: FieldProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<FieldReceipt> {
  assertVideoFile(file);
  throwIfAborted(options.signal);

  const queueId = crypto.randomUUID();
  report(options.onProgress, {
    stage: "hashing",
    progress: 0,
    processedBytes: 0,
    totalBytes: file.size,
    uploadedParts: 0,
    totalParts: 0,
    message: "Checking the exact video before upload…",
  });
  const sha256 = await hashFileSha256(file, {
    signal: options.signal,
    onProgress: (progress) => report(options.onProgress, {
      stage: "hashing",
      progress: progress.progress,
      processedBytes: progress.processedBytes,
      totalBytes: progress.totalBytes,
      uploadedParts: 0,
      totalParts: 0,
      message: "Checking the exact video before upload…",
    }),
  });

  throwIfAborted(options.signal);
  requireOnline();
  report(options.onProgress, {
    stage: "creating_submission",
    progress: 0,
    processedBytes: 0,
    totalBytes: file.size,
    uploadedParts: 0,
    totalParts: 0,
    message: "Creating your private submission…",
  });
  const created = await invokeRpc("create_field_submission_v1", {
    p_declarations: declarations,
    p_idempotency_key: `field.create.${queueId}`,
    p_correlation_id: crypto.randomUUID(),
  });

  let queue: FieldQueueRecord = {
    id: queueId,
    ownerUserId,
    submissionResourceId: requiredString(created.submission_resource_id, "submission id"),
    submissionReference: requiredString(created.submission_reference, "submission reference"),
    submissionCurrentRevision: integer(created.current_revision, 1),
    mediaIntakeId: "",
    mediaUploadSessionId: "",
    slotNumber: 1,
    attemptNumber: 1,
    originalFileName: file.name,
    mimeType: file.type.toLowerCase(),
    byteSize: file.size,
    sha256,
    partSizeBytes: 0,
    totalParts: 0,
    uploadedParts: 0,
    uploadedBytes: 0,
    fileBlob: file,
    localState: "creating_upload",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putQueue(queue);

  report(options.onProgress, {
    stage: "creating_upload",
    progress: 0,
    processedBytes: 0,
    totalBytes: file.size,
    uploadedParts: 0,
    totalParts: 0,
    message: "Setting up a resumable upload. Video transfer begins next.",
    submissionReference: queue.submissionReference,
  });

  const started = await startOrRestartUpload(queue, `field.media.start.${queue.id}.1`);
  queue = started.queue;
  const auth = capability(started.control);
  queue = await uploadRemainingParts(
    queue,
    file,
    auth.token,
    auth.baseUrl,
    edgeSession(started.control).uploaded_parts,
    options.onProgress,
    options.signal,
  );

  report(options.onProgress, {
    stage: "verifying",
    progress: 1,
    processedBytes: file.size,
    totalBytes: file.size,
    uploadedParts: queue.totalParts,
    totalParts: queue.totalParts,
    message: "Verifying the exact original…",
  });
  await invokeFieldControl({
    action: "finalize_upload",
    submission_resource_id: queue.submissionResourceId,
    media_intake_id: queue.mediaIntakeId,
    correlation_id: crypto.randomUUID(),
  });

  return adoptAndFinalize(queue, options.onProgress);
}

async function exactLocalFile(queue: FieldQueueRecord, replacement?: File | null): Promise<Blob> {
  if (replacement) {
    if (replacement.size !== queue.byteSize) {
      throw new Error("The selected file is not the same size as the queued original.");
    }

    const sha256 = await hashBlobSha256(replacement);
    if (sha256 !== queue.sha256) {
      throw new Error("The selected file does not match the queued original.");
    }

    return replacement;
  }

  try {
    const file = queue.fileBlob;

    if (!file) {
      throw new FieldRecoverableError(
        "paused",
        "The browser no longer has the local video. Reselect the exact original to continue.",
      );
    }

    if (file.size !== queue.byteSize) {
      throw new Error("The selected file is not the same size as the queued original.");
    }

    const sha256 = await hashBlobSha256(file);
    if (sha256 !== queue.sha256) {
      throw new Error("The selected file does not match the queued original.");
    }

    return file;
  } catch (cause) {
    if (cause instanceof FieldRecoverableError) {
      throw cause;
    }

    queue.fileBlob = null;
    queue.localState = "paused";
    queue.updatedAt = new Date().toISOString();
    await putQueue(queue);

    throw new FieldRecoverableError(
      "paused",
      "The browser can no longer read the saved video. Choose the exact original to continue.",
    );
  }
}

export async function resumeFieldQueue(
  queueId: string,
  ownerUserId: string,
  options: {
    replacementFile?: File | null;
    queueSnapshot?: FieldQueueRecord | null;
    onProgress?: (progress: FieldProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<FieldReceipt> {
  let queue = options.queueSnapshot ?? await getQueue(queueId);
  if (!queue) throw new Error("This local Field queue no longer exists.");
  if (queue.id !== queueId) {
    throw new Error("The restored Field queue does not match this upload.");
  }
  if (queue.ownerUserId !== ownerUserId) {
    throw new Error("This queued submission belongs to another signed-in account.");
  }

  const own = await getMyFieldSubmission(queue.submissionResourceId);
  const state = requiredString(own.submission_state, "submission state");
  if (state === "submitted") {
    await deleteQueue(queue.id);
    return {
      submissionResourceId: queue.submissionResourceId,
      submissionReference: requiredString(own.submission_reference, "submission reference"),
      submissionState: state,
      currentRevision: integer(own.current_revision),
      submittedAt: typeof own.submitted_at === "string" ? own.submitted_at : null,
      receiptIssuedAt: typeof own.receipt_issued_at === "string" ? own.receipt_issued_at : null,
      adoptedMediaCount: integer(own.adopted_media_count),
      receiptMessage: "We received your submission for review.",
    };
  }
  if (["cancelled", "expired"].includes(state)) {
    await deleteQueue(queue.id);
    throw new Error("This Field Submission is no longer open for upload.");
  }

  if (state === "received") {
    queue.submissionCurrentRevision = integer(
      own.current_revision,
      queue.submissionCurrentRevision,
    );
    queue.fileBlob = null;
    queue.updatedAt = new Date().toISOString();
    await putQueue(queue);
    return finalizeReceivedSubmission(
      queue,
      queue.submissionCurrentRevision,
      options.onProgress,
    );
  }

  queue.submissionCurrentRevision = integer(
    own.current_revision,
    queue.submissionCurrentRevision,
  );
  queue.updatedAt = new Date().toISOString();

  const file = await exactLocalFile(queue, options.replacementFile);
  queue.fileBlob = file;
  await putQueue(queue);

  report(options.onProgress, {
    stage: "creating_upload",
    progress: queue.byteSize > 0
      ? queue.uploadedBytes / queue.byteSize
      : 0,
    processedBytes: queue.uploadedBytes,
    totalBytes: queue.byteSize,
    uploadedParts: queue.uploadedParts,
    totalParts: queue.totalParts,
    message: "Restoring your resumable upload. Video transfer begins next.",
    submissionReference: queue.submissionReference,
  });

  requireOnline();

  if (!queue.mediaIntakeId) {
    const started = await startOrRestartUpload(queue, `field.media.start.${queue.id}.${queue.attemptNumber}`);
    queue = started.queue;
    const auth = capability(started.control);
    queue = await uploadRemainingParts(
      queue,
      file,
      auth.token,
      auth.baseUrl,
      edgeSession(started.control).uploaded_parts,
      options.onProgress,
      options.signal,
    );
  } else {
    const status = await invokeFieldControl({
      action: "upload_status",
      submission_resource_id: queue.submissionResourceId,
      media_intake_id: queue.mediaIntakeId,
      correlation_id: crypto.randomUUID(),
    });
    const server = edgeSession(status);

    if (["expired", "failed", "cancelled", "superseded"].includes(server.media_upload_state)) {
      queue = {
        ...queue,
        mediaIntakeId: "",
        mediaUploadSessionId: "",
        attemptNumber: Math.max(queue.attemptNumber + 1, server.attempt_number + 1),
        uploadedParts: 0,
        uploadedBytes: 0,
        updatedAt: new Date().toISOString(),
      };
      await putQueue(queue);
      const restarted = await startOrRestartUpload(
        queue,
        `field.media.start.${queue.id}.${queue.attemptNumber}`,
      );
      queue = restarted.queue;
      const auth = capability(restarted.control);
      queue = await uploadRemainingParts(
        queue,
        file,
        auth.token,
        auth.baseUrl,
        edgeSession(restarted.control).uploaded_parts,
        options.onProgress,
        options.signal,
      );
    } else if (server.media_upload_state === "verified" || server.intake_state === "verified") {
      queue = queueFromSession(queue, server, "verifying");
      await putQueue(queue);
    } else {
      const reissued = await invokeFieldControl({
        action: "reissue_upload_capability",
        submission_resource_id: queue.submissionResourceId,
        media_intake_id: queue.mediaIntakeId,
        correlation_id: crypto.randomUUID(),
      });
      const auth = capability(reissued);
      const authoritative = edgeSession(reissued);
      queue = queueFromSession(queue, authoritative, "uploading");
      await putQueue(queue);
      queue = await uploadRemainingParts(
        queue,
        file,
        auth.token,
        auth.baseUrl,
        authoritative.uploaded_parts,
        options.onProgress,
        options.signal,
      );
    }
  }

  if (queue.uploadedParts >= queue.totalParts && queue.totalParts > 0) {
    report(options.onProgress, {
      stage: "verifying",
      progress: 1,
      processedBytes: queue.byteSize,
      totalBytes: queue.byteSize,
      uploadedParts: queue.totalParts,
      totalParts: queue.totalParts,
      message: "Verifying the exact original…",
    });
    await invokeFieldControl({
      action: "finalize_upload",
      submission_resource_id: queue.submissionResourceId,
      media_intake_id: queue.mediaIntakeId,
      correlation_id: crypto.randomUUID(),
    });
  }

  return adoptAndFinalize(queue, options.onProgress);
}

export async function cancelQueuedFieldSubmission(queueId: string, ownerUserId: string): Promise<void> {
  const queue = await getQueue(queueId);
  if (!queue) return;
  if (queue.ownerUserId !== ownerUserId) {
    throw new Error("This queued submission belongs to another signed-in account.");
  }
  if (!queue.mediaIntakeId) {
    const own = await getMyFieldSubmission(queue.submissionResourceId);
    const state = requiredString(own.submission_state, "submission state");

    if (state === "cancelled") {
      await deleteQueue(queue.id);
      return;
    }

    const cancelled = await invokeRpc("cancel_field_submission_v1", {
      p_submission_resource_id: queue.submissionResourceId,
      p_expected_current_revision: integer(
        own.current_revision,
        queue.submissionCurrentRevision,
      ),
      p_idempotency_key: `field.cancel.${queue.id}`,
      p_reason:
        "Contributor cancelled Field Submission before Media upload session creation",
      p_correlation_id: crypto.randomUUID(),
    });

    if (
      requiredString(cancelled.receipt_status, "cancellation status")
      !== "succeeded"
    ) {
      throw new Error(
        "Field cancellation was not accepted. Refresh the submission state before retrying.",
      );
    }

    await deleteQueue(queue.id);
    return;
  }

  const own = await getMyFieldSubmission(queue.submissionResourceId);
  await invokeFieldControl({
    action: "cancel_submission",
    submission_resource_id: queue.submissionResourceId,
    media_intake_id: queue.mediaIntakeId,
    expected_current_revision: integer(own.current_revision, queue.submissionCurrentRevision),
    idempotency_key: `field.cancel.${queue.id}`,
    reason: "Contributor cancelled Field Submission before canonical adoption",
    correlation_id: crypto.randomUUID(),
  });
  await deleteQueue(queue.id);
}

export async function removeLocalFieldDraft(queueId: string, ownerUserId: string): Promise<void> {
  const queue = await getQueue(queueId);
  if (!queue) return;
  if (queue.ownerUserId !== ownerUserId) throw new Error("This local draft belongs to another signed-in account.");
  if (queue.submissionResourceId) {
    throw new Error("A server Field Submission already exists. Use governed cancellation instead.");
  }
  await deleteQueue(queue.id);
}
