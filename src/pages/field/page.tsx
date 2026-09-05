import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { WkButton } from "@/components/design-system/primitives/Button";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  cancelQueuedFieldSubmission,
  currentUserCanSubmitField,
  listFieldQueuesForOwner,
  resumeFieldQueue,
  submitFieldVideo,
  type FieldClientStage,
  type FieldDeclarations,
  type FieldProgress,
  type FieldQueueRecord,
} from "@/services/fieldIntakeService";

const INITIAL_PROGRESS: FieldProgress = {
  stage: "draft_local",
  progress: 0,
  processedBytes: 0,
  totalBytes: 0,
  uploadedParts: 0,
  totalParts: 0,
  message: "Choose or record a video when you are ready.",
};

const DURABILITY_PROOF_DECLARATIONS: FieldDeclarations = {
  newsroom_identity_mode: "standard",
  public_attribution_preference: "do_not_name",
  contact_preference: "account_contact",
  rights_declaration: "uncertain",
  rights_declaration_detail: null,
  consent_declaration: "uncertain",
  consent_declaration_detail: null,
  declared_sensitivity: "none",
  source_protection_request: "internal",
  embargo_request_mode: "none",
  requested_embargo_until: null,
  location_mode: "not_collected",
  location_description: null,
  content_captured_at: null,
  intake_notes: null,
};

function prettyBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / (1024 ** exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function stageLabel(stage: FieldClientStage): string {
  const labels: Record<FieldClientStage, string> = {
    draft_local: "Ready",
    hashing: "Checking video",
    creating_submission: "Preparing",
    creating_upload: "Preparing upload",
    uploading: "Uploading",
    waiting_for_network: "Waiting for network",
    paused: "Paused",
    verifying: "Verifying",
    received: "Received",
    submitting: "Finishing",
    submitted: "Received",
    failed_recoverably: "Needs retry",
    failed_terminally: "Stopped",
    cancelled: "Cancelled",
  };

  return labels[stage];
}

export default function FieldIntakePage() {
  const authUser = useAuthUser();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const replacementInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [canSubmit, setCanSubmit] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<FieldQueueRecord | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<FieldProgress>(INITIAL_PROGRESS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [showUploadHelp, setShowUploadHelp] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!authUser.id) return;

    Promise.all([
      currentUserCanSubmitField(),
      listFieldQueuesForOwner(authUser.id),
    ])
      .then(([allowed, queues]) => {
        if (!alive) return;

        setCanSubmit(allowed);
        setPending(queues[0] ?? null);

        if (queues[0]) {
          setProgress({
            stage: queues[0].localState,
            progress:
              queues[0].byteSize > 0
                ? queues[0].uploadedBytes / queues[0].byteSize
                : 0,
            processedBytes: queues[0].uploadedBytes,
            totalBytes: queues[0].byteSize,
            uploadedParts: queues[0].uploadedParts,
            totalParts: queues[0].totalParts,
            message: "Your upload can continue from where it stopped.",
          });
        }
      })
      .catch(() => {
        if (!alive) return;
        setCanSubmit(null);
      })
      .finally(() => {
        if (alive) setCapabilityChecked(true);
      });

    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [authUser.id]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setCompleted(false);
    setError("");
    setShowUploadHelp(false);
  }

  function openCamera() {
    if (!cameraInputRef.current) return;
    cameraInputRef.current.value = "";
    cameraInputRef.current.click();
  }

  function openLibrary() {
    if (!libraryInputRef.current) return;
    libraryInputRef.current.value = "";
    libraryInputRef.current.click();
  }

  function openReplacementFile() {
    if (!replacementInputRef.current) return;
    replacementInputRef.current.value = "";
    replacementInputRef.current.click();
  }

  async function refreshPending() {
    if (!authUser.id) return;
    const queues = await listFieldQueuesForOwner(authUser.id);
    setPending(queues[0] ?? null);
  }

  async function handleSubmit() {
    if (!authUser.id || !file || working) return;

    setError("");
    setCompleted(false);
    setShowUploadHelp(false);
    setWorking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await submitFieldVideo(
        authUser.id,
        file,
        DURABILITY_PROOF_DECLARATIONS,
        {
          signal: controller.signal,
          onProgress: setProgress,
        },
      );

      setCompleted(true);
      setPending(null);
      setFile(null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setProgress((current) => ({
          ...current,
          stage: "paused",
          message: "Upload paused. You can continue when you are ready.",
        }));
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not continue this upload.",
        );
      }

      await refreshPending();
    } finally {
      abortRef.current = null;
      setWorking(false);
    }
  }

  async function handleResume() {
    if (!authUser.id || !pending || working) return;

    setError("");
    setCompleted(false);
    setWorking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await resumeFieldQueue(pending.id, authUser.id, {
        replacementFile,
        signal: controller.signal,
        onProgress: setProgress,
      });

      setCompleted(true);
      setPending(null);
      setReplacementFile(null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setProgress((current) => ({
          ...current,
          stage: "paused",
          message: "Upload paused. You can continue when you are ready.",
        }));
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not resume this upload.",
        );
      }

      await refreshPending();
    } finally {
      abortRef.current = null;
      setWorking(false);
    }
  }

  async function handleCancel() {
    if (!authUser.id || !pending || working) return;

    setError("");
    setWorking(true);

    try {
      await cancelQueuedFieldSubmission(pending.id, authUser.id);
      setPending(null);
      setReplacementFile(null);
      setProgress({
        ...INITIAL_PROGRESS,
        stage: "cancelled",
        message: "Upload cancelled.",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not cancel this upload.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (authUser.loading || !capabilityChecked) {
    return (
      <main
        className="mx-auto min-h-[60vh] max-w-xl px-4 py-10"
        aria-busy="true"
      />
    );
  }

  if (!pending && canSubmit === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
            <i className="ri-wifi-off-line text-xl" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-[var(--wk-text)]">
            Connection unavailable
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[var(--wk-text-muted)]">
            WAKILISHA could not confirm Field access right now. Reconnect and
            try again. Saved uploads on this device remain available to resume.
          </p>
        </div>
      </main>
    );
  }

  if (canSubmit === false) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
            <i className="ri-lock-2-line text-xl" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-[var(--wk-text)]">
            Field submissions are not enabled for this account.
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[var(--wk-text-muted)]">
            This intake path is currently available only to approved
            contributor accounts.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-7 sm:pt-10">
      <input
        ref={cameraInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska"
        capture="environment"
        onChange={chooseFile}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska"
        onChange={chooseFile}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <input
        ref={replacementInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska"
        onChange={(event) =>
          setReplacementFile(event.target.files?.[0] ?? null)
        }
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <header>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          Field
        </div>
        <h1 className="mt-1 text-[30px] font-black tracking-tight text-[var(--wk-text)] sm:text-[34px]">
          Send a video to WAKILISHA
        </h1>
        <p className="mt-2 max-w-lg text-[14px] leading-6 text-[var(--wk-text-muted)]">
          Share footage with the newsroom. Your original stays private while
          we review it.
        </p>
      </header>

      {pending && !completed ? (
        <section className="mt-7 overflow-hidden rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-sm">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)] text-[var(--wk-brand)]">
                <i className="ri-video-line text-[22px]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                    Saved on this device
                  </p>
                  <span className="rounded-full bg-[var(--wk-surface-raised)] px-2.5 py-1 text-[11px] font-bold text-[var(--wk-text-muted)]">
                    {stageLabel(
                      working ? progress.stage : pending.localState,
                    )}
                  </span>
                </div>

                <h2 className="mt-1 truncate text-[17px] font-black text-[var(--wk-text)]">
                  {pending.originalFileName}
                </h2>
                <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                  {prettyBytes(pending.byteSize)} · Ref{" "}
                  {pending.submissionReference}
                </p>
              </div>
            </div>

            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-[var(--wk-brand)] transition-[width]"
                style={{
                  width: `${Math.max(
                    2,
                    Math.min(100, progress.progress * 100),
                  )}%`,
                }}
              />
            </div>

            <div className="mt-3 flex items-start gap-2">
              <i className="ri-information-line mt-0.5 shrink-0 text-[14px] text-[var(--wk-text-faint)]" />
              <p className="text-[12px] leading-5 text-[var(--wk-text-muted)]">
                {progress.message}
              </p>
            </div>

            {!pending.fileBlob ? (
              <div className="mt-5 rounded-2xl bg-[var(--wk-bg)] p-4">
                <p className="text-[12px] font-bold text-[var(--wk-text)]">
                  The original is no longer available in browser storage.
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                  Choose the exact same video to continue. WAKILISHA verifies
                  it before resuming.
                </p>
                <div className="mt-3">
                  <WkButton
                    type="button"
                    variant="soft"
                    onClick={openReplacementFile}
                  >
                    Choose original video
                  </WkButton>

                  {replacementFile ? (
                    <p className="mt-2 truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
                      {replacementFile.name} · {prettyBytes(replacementFile.size)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <WkButton
                type="button"
                variant="primary"
                disabled={working || (!pending.fileBlob && !replacementFile)}
                onClick={handleResume}
              >
                {working ? "Working…" : "Resume upload"}
              </WkButton>

              <WkButton
                type="button"
                variant="soft"
                disabled={!working}
                onClick={() => abortRef.current?.abort()}
              >
                Pause
              </WkButton>

              <WkButton
                type="button"
                variant="ghost"
                disabled={working}
                onClick={handleCancel}
              >
                Cancel
              </WkButton>
            </div>
          </div>

          <div className="border-t border-[var(--wk-divider)] bg-[var(--wk-bg)] px-5 py-3">
            <p className="text-[10px] leading-4 text-[var(--wk-text-faint)]">
              Browser storage can be cleared by the device. WAKILISHA does not
              promise background uploading when this page is closed.
            </p>
          </div>
        </section>
      ) : null}

      {completed ? (
        <section
          className="mt-7 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-sm"
          aria-live="polite"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <i className="ri-check-line text-[24px]" />
          </div>
          <h2 className="mt-4 text-[22px] font-black tracking-tight text-[var(--wk-text)]">
            Video received
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
            The upload completed and the local recovery copy was cleared from
            this browser.
          </p>
          <div className="mt-5">
            <WkButton
              type="button"
              variant="soft"
              onClick={() => {
                setCompleted(false);
                setProgress(INITIAL_PROGRESS);
              }}
            >
              Send another video
            </WkButton>
          </div>
        </section>
      ) : null}

      {!pending && !completed && canSubmit === true ? (
        <section className="mt-7">
          {!file ? (
            <>
              <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                  <i className="ri-video-add-line text-[27px]" />
                </div>

                <h2 className="mt-5 text-[19px] font-black tracking-tight text-[var(--wk-text)]">
                  What do you want to send?
                </h2>
                <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                  Record something now or choose a video already on your
                  device.
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <WkButton
                    type="button"
                    variant="primary"
                    className="w-full justify-center"
                    onClick={openCamera}
                  >
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-camera-line text-[16px]" />
                      Record video
                    </span>
                  </WkButton>

                  <WkButton
                    type="button"
                    variant="soft"
                    className="w-full justify-center"
                    onClick={openLibrary}
                  >
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-folder-video-line text-[16px]" />
                      Choose from device
                    </span>
                  </WkButton>
                </div>
              </div>

              <div className="relative mt-4">
                <button
                  type="button"
                  aria-expanded={showUploadHelp}
                  onClick={() => setShowUploadHelp((current) => !current)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                >
                  <i className="ri-shield-check-line text-[14px] text-[var(--wk-brand)]" />
                  Private & resumable
                  <i
                    className={`ri-arrow-down-s-line text-[14px] transition-transform ${
                      showUploadHelp ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showUploadHelp ? (
                  <div
                    role="note"
                    className="mt-2 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-black text-[var(--wk-text)]">
                          Built for unreliable connections
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                          If your connection drops, accepted parts can be
                          reused when you return. Upload access is not saved in
                          browser storage.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close upload information"
                        onClick={() => setShowUploadHelp(false)}
                        className="shrink-0 text-[var(--wk-text-faint)] transition-colors hover:text-[var(--wk-text)]"
                      >
                        <i className="ri-close-line text-[17px]" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                  <i className="ri-video-line text-[25px]" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                    Ready to send
                  </p>
                  <h2 className="mt-1 truncate text-[17px] font-black text-[var(--wk-text)]">
                    {file.name}
                  </h2>
                  <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                    {prettyBytes(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove selected video"
                  className="shrink-0 rounded-full p-2 text-[var(--wk-text-faint)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                >
                  <i className="ri-close-line text-[18px]" />
                </button>
              </div>

              {working ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-bold text-[var(--wk-text)]">
                      {stageLabel(progress.stage)}
                    </span>
                    <span className="font-semibold text-[var(--wk-text-muted)]">
                      {Math.round(progress.progress * 100)}%
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--wk-brand)] transition-[width]"
                      style={{
                        width: `${Math.max(
                          2,
                          Math.min(100, progress.progress * 100),
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                    {progress.message}
                  </p>

                  <p className="mt-1 text-[10px] leading-4 text-[var(--wk-text-faint)]">
                    Keep this page open while the upload is active.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <WkButton
                  type="button"
                  variant="primary"
                  disabled={working}
                  onClick={handleSubmit}
                >
                  {working ? "Sending…" : "Send video"}
                </WkButton>

                {working ? (
                  <WkButton
                    type="button"
                    variant="soft"
                    onClick={() => abortRef.current?.abort()}
                  >
                    Pause
                  </WkButton>
                ) : (
                  <WkButton
                    type="button"
                    variant="ghost"
                    onClick={openLibrary}
                  >
                    Change
                  </WkButton>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {error ? (
        <div
          className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-[12px] leading-5 text-red-900"
          role="alert"
        >
          <i className="ri-error-warning-line mt-0.5 shrink-0 text-[16px]" />
          <span>{error}</span>
        </div>
      ) : null}
    </main>
  );
}
