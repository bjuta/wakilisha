import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const service = read("src/services/fieldIntakeService.ts");
const page = read("src/pages/field/page.tsx");
const routes = read("src/router/config.tsx");
const lazyPublic = read("src/router/lazyPublic.tsx");

describe("Phase 8A.4 mobile local durability", () => {
  it("persists secretless resumable recovery state in IndexedDB", () => {
    expect(service).toContain('const DB_NAME = "wakilisha-field-intake-v1"');
    expect(service).toContain("indexedDB.open(DB_NAME, DB_VERSION)");
    expect(service).not.toContain("localStorage");
    expect(service).not.toContain("sessionStorage");

    const queueInterface =
      service.match(/export interface FieldQueueRecord \{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(queueInterface).toContain("ownerUserId: string");
    expect(queueInterface).toContain("submissionResourceId: string");
    expect(queueInterface).toContain("submissionReference: string");
    expect(queueInterface).toContain("sha256: string");
    expect(queueInterface).toContain("uploadedParts: number");
    expect(queueInterface).toContain("uploadedBytes: number");
    expect(queueInterface).toContain("fileBlob: Blob | null");
    expect(queueInterface).toContain("localState: FieldClientStage");

    expect(queueInterface).not.toContain("capability");
    expect(queueInterface).not.toContain("storagePath");
    expect(queueInterface).not.toContain("partUploadBaseUrl");
  });

  it("resumes from exact local bytes and server-authoritative progress", () => {
    expect(service).toContain('action: "upload_status"');
    expect(service).toContain('action: "reissue_upload_capability"');
    expect(service).toContain("authoritative.uploaded_parts");
    expect(service).toContain("exactLocalFile");
    expect(service).toContain("const sha256 = await hashBlobSha256(file);");
    expect(service).toContain("sha256 !== queue.sha256");
    expect(service).toMatch(
      /try\s*\{\s*const file = queue\.fileBlob;[\s\S]*if \(!file\)[\s\S]*if \(file\.size !== queue\.byteSize\)[\s\S]*const sha256 = await hashBlobSha256\(file\);[\s\S]*if \(sha256 !== queue\.sha256\)/,
    );
    expect(service).not.toContain(
      "fileBlob: options.replacementFile ?? queue.fileBlob",
    );
    expect(service).toContain("queue.fileBlob = file;");
    expect(service).toContain("queue.fileBlob = null;");
    expect(service).toContain("queueSnapshot?: FieldQueueRecord | null");
    expect(service).toContain(
      "options.queueSnapshot ?? await getQueue(queueId)",
    );
    expect(page).toContain("queueSnapshot: pending");
    expect(service).toContain("submissionResourceId: queue.submissionResourceId");
    expect(service).toContain("attemptNumber: Math.max(queue.attemptNumber + 1");
    expect(service).toContain(
      "The browser can no longer read the saved video. Choose the exact original to continue.",
    );
  });

  it("persists recoverable pause and network state before rethrow", () => {
    expect(service).toContain("const recoverableState: FieldClientStage | null");
    expect(service).toContain(
      'error instanceof DOMException && error.name === "AbortError"',
    );
    expect(service).toContain("isUnreadableLocalObjectError");
    expect(service).toContain('error.name === "NotFoundError"');
    expect(service).toContain("/object can not be found here/i");
    expect(service).toContain("fileBlob: null");
    expect(service).toContain(
      "The browser can no longer read the saved video. Choose the exact original to continue.",
    );
    expect(service).toContain('? "paused"');
    expect(service).toContain("error instanceof FieldRecoverableError");
    expect(service).toContain("? error.stage");
    expect(service).toContain("localState: recoverableState");
    expect(service).toContain("await putQueue(current)");
    expect(service).toContain("throw error");
  });

  it("keeps exact video validation and large-byte transfer in the browser", () => {
    expect(service).toContain('from "@/services/mediaHash"');
    expect(service).toContain("hashFileSha256(file");
    expect(service).toContain("hashBlobSha256(part");

    for (const extension of ["mp4", "mov", "m4v", "webm", "mkv"]) {
      expect(service).toContain(`"${extension}"`);
    }

    expect(service).toContain("2 * 1024 * 1024 * 1024");
    expect(service).toContain('file.type.toLowerCase().startsWith("video/")');
    expect(service).toContain('method: "PUT"');
    expect(service).toContain('"Content-Type": "application/octet-stream"');
    expect(service).toContain('"X-Part-SHA256": partSha256');
  });

  it("supports cancellation and local cleanup without a second server queue", () => {
    expect(service).toContain(
      "export async function cancelQueuedFieldSubmission",
    );
    expect(service).toContain('action: "cancel_submission"');
    expect(service).toContain('invokeRpc("cancel_field_submission_v1"');
    expect(service).toContain("await deleteQueue(queue.id)");
    expect(service).toContain(
      "export async function removeLocalFieldDraft",
    );
  });

  it("registers one authenticated contributor route", () => {
    expect(lazyPublic).toContain("export const FieldIntakePage = lazy(");
    expect(lazyPublic).toContain('import("../pages/field/page")');
    expect(routes).toContain("FieldIntakePage,");
    expect(routes).toContain("function AuthenticatedFieldRoute()");
    expect(routes).toContain(
      '{ path: "/field", element: <AuthenticatedFieldRoute /> }',
    );
  });

  it("keeps saved recovery visible when capability authority is temporarily unreachable", () => {
    expect(service).toContain(
      "currentUserCanSubmitField(): Promise<boolean | null>",
    );
    expect(service).toContain("if (error) return null");
    expect(page).toContain("if (!pending && canSubmit === null)");
    expect(page).toContain("if (canSubmit === false)");
    expect(page).toContain("Connection unavailable");
    expect(page).toContain(
      "!pending && !completed && canSubmit === true",
    );
  });

  it("uses the WAKILISHA interaction system instead of visible native file UI", () => {
    expect(page).toContain(
      'from "@/components/design-system/primitives/Button"',
    );
    expect(page).toContain("<WkButton");
    expect(page).toContain("Record video");
    expect(page).toContain("Choose from device");
    expect(page).toContain('className="sr-only"');
    expect(page).toContain('capture="environment"');
    expect(page).toContain("Ready to send");
    expect(page).toContain("Send video");
    expect(page).toContain("replacementInputRef");
    expect(page).toContain("openReplacementFile");
    expect(page).toContain("Choose original video");
    expect(page).toContain("!pending.fileBlob && !working");
    expect(service).toContain("submissionReference?: string");
    expect(service).toContain("submissionReference: queue.submissionReference");
    expect(page).toContain("progress.submissionReference");
    expect(page).toContain("FieldRecoverableError");
    expect(page).not.toContain("file:mr-3");
  });

  it("uses progressive disclosure and contextual recovery language", () => {
    expect(page).toContain("Private & resumable");
    expect(page).toContain("showUploadHelp");
    expect(page).toContain('aria-expanded={showUploadHelp}');
    expect(page).toContain("Saved on this device");
    expect(page).toContain("Resume upload");
    expect(page).toContain("savedStageLabel");
    expect(page).toContain("SAVED_NETWORK_RESUME_STAGES");
    expect(page).toContain("savedStageNeedsNetwork");
    expect(page).toContain("Ready to resume");
    expect(page).toContain("Waiting for network");
    expect(page).toContain(
      "savedStageLabel(progress.stage, isOnline)",
    );
    expect(page).toContain(
      'window.addEventListener("online", handleOnline)',
    );
    expect(page).toContain(
      'window.addEventListener("offline", handleOffline)',
    );
    expect(page).toContain(
      "Waiting for a network connection.",
    );
    expect(page).toContain(
      'className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"',
    );
    expect(page).toContain(
      'className="col-span-2 w-full justify-center sm:w-auto"',
    );
    expect(page).toContain("Keep this page open while the upload is active.");
    expect(page).toContain("FRESH_UPLOAD_SETUP_MESSAGES");
    expect(page).toContain("RESUME_UPLOAD_SETUP_MESSAGES");
    expect(page).toContain("preparingActivityIndex");
    expect(page).toContain("preparingActivityMessage");
    expect(page).toContain('progress.stage === "creating_upload"');
    expect(page).toContain("ri-loader-4-line");
    expect(page).toContain("animate-spin");
    expect(page).toContain("Creating a private upload for this video.");
    expect(page).toContain(
      "Making the upload resumable if your connection drops.",
    );
    expect(page).toContain("Getting the first video section ready to send.");
    expect(page).toContain("Restoring your saved upload.");
    expect(page).toContain("Reopening secure upload access.");
    expect(page).toContain("Getting the next video section ready to send.");
    expect(page).not.toContain("formatElapsed");
    expect(page).not.toContain("preparingElapsedSeconds");
    expect(page).not.toContain(" elapsed");
    expect(page).not.toContain("Upload setup is in progress");
    expect(page).toContain(
      "Checking the selected original before resuming…",
    );
    expect(page).toContain(
      "Restoring your saved upload…",
    );
    expect(service).toContain(
      "Setting up a resumable upload. Video transfer begins next.",
    );
    expect(service).toContain(
      "Restoring your resumable upload. Video transfer begins next.",
    );
    expect(page).toContain(
      "Browser storage can be cleared by the device",
    );
    expect(page).toMatch(
      /working\s*\?\s*stageLabel\(progress\.stage\)\s*:\s*savedStageLabel\(progress\.stage,\s*isOnline\)/,
    );
  });

  it("does not expose engineering phase language or future 8A.5 form walls", () => {
    for (const forbidden of [
      "Phase 8A.4",
      "durability proof",
      "Identity and contact",
      "Rights and consent",
      "Safety and timing",
      "Submission receipt",
      "Who may resolve your identity in the newsroom?",
      "Public naming preference",
      "Source-protection request",
      "Embargo request",
      "Approximate place",
      "We do not request device GPS",
      "This is not anonymous intake.",
    ]) {
      expect(page).not.toContain(forbidden);
    }

    expect(page).not.toContain("navigator.geolocation");
    expect(page).not.toContain("latitude");
    expect(page).not.toContain("longitude");
  });
});
