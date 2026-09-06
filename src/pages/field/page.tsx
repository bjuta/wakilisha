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
  FieldRecoverableError,
  type FieldClientStage,
  type FieldDeclarations,
  type FieldProgress,
  type FieldQueueRecord,
  type FieldReceipt,
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

type FieldDeclarationDraft = {
  newsroomIdentityMode: FieldDeclarations["newsroom_identity_mode"];
  publicAttributionPreference:
    FieldDeclarations["public_attribution_preference"];
  contactPreference: FieldDeclarations["contact_preference"];
  rightsDeclaration: FieldDeclarations["rights_declaration"] | "";
  consentDeclaration: FieldDeclarations["consent_declaration"] | "";
  declaredSensitivity: FieldDeclarations["declared_sensitivity"];
  sourceProtectionRequest:
    FieldDeclarations["source_protection_request"];
  embargoRequestMode: FieldDeclarations["embargo_request_mode"];
  requestedEmbargoUntilLocal: string;
  locationMode: FieldDeclarations["location_mode"];
  locationDescription: string;
};

const INITIAL_DECLARATION_DRAFT: FieldDeclarationDraft = {
  newsroomIdentityMode: "standard",
  publicAttributionPreference: "do_not_name",
  contactPreference: "account_contact",
  rightsDeclaration: "",
  consentDeclaration: "",
  declaredSensitivity: "none",
  sourceProtectionRequest: "internal",
  embargoRequestMode: "none",
  requestedEmbargoUntilLocal: "",
  locationMode: "not_collected",
  locationDescription: "",
};

function buildFieldDeclarations(
  draft: FieldDeclarationDraft,
): FieldDeclarations {
  const rightsDeclaration = draft.rightsDeclaration;
  const consentDeclaration = draft.consentDeclaration;

  if (!rightsDeclaration) {
    throw new Error(
      "Tell us what you know about the rights to this video.",
    );
  }

  if (!consentDeclaration) {
    throw new Error(
      "Tell us what you know about permission from people shown.",
    );
  }

  let requestedEmbargoUntil: string | null = null;

  if (draft.embargoRequestMode === "until_time") {
    if (!draft.requestedEmbargoUntilLocal) {
      throw new Error("Choose a date and time for the hold.");
    }

    const embargoDate = new Date(draft.requestedEmbargoUntilLocal);

    if (
      Number.isNaN(embargoDate.getTime())
      || embargoDate.getTime() <= Date.now()
    ) {
      throw new Error("Choose a future date and time for the hold.");
    }

    requestedEmbargoUntil = embargoDate.toISOString();
  }

  const locationDescription = draft.locationDescription.trim();

  if (
    draft.locationMode === "coarse_text"
    && !locationDescription
  ) {
    throw new Error(
      "Add a broad location or choose not to add one.",
    );
  }

  return {
    newsroom_identity_mode: draft.newsroomIdentityMode,
    public_attribution_preference:
      draft.publicAttributionPreference,
    contact_preference: draft.contactPreference,
    rights_declaration: rightsDeclaration,
    rights_declaration_detail: null,
    consent_declaration: consentDeclaration,
    consent_declaration_detail: null,
    declared_sensitivity: draft.declaredSensitivity,
    source_protection_request: draft.sourceProtectionRequest,
    embargo_request_mode: draft.embargoRequestMode,
    requested_embargo_until: requestedEmbargoUntil,
    location_mode: draft.locationMode,
    location_description:
      draft.locationMode === "coarse_text"
        ? locationDescription
        : null,
    content_captured_at: null,
    intake_notes: null,
  };
}

function formatReceiptTime(value: string | null): string {
  if (!value) return "Received";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Received";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ChoiceButton({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
          : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:bg-[var(--wk-surface-raised)]"
      }`}
    >
      <span className="block text-[12px] font-black text-[var(--wk-text)]">
        {title}
      </span>
      {description ? (
        <span className="mt-1 block text-[11px] leading-5 text-[var(--wk-text-muted)]">
          {description}
        </span>
      ) : null}
    </button>
  );
}

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

const FRESH_UPLOAD_SETUP_MESSAGES = [
  "Creating a private upload for this video.",
  "Making the upload resumable if your connection drops.",
  "Getting the first video section ready to send.",
] as const;

const RESUME_UPLOAD_SETUP_MESSAGES = [
  "Restoring your saved upload.",
  "Reopening secure upload access.",
  "Getting the next video section ready to send.",
] as const;

function stageLabel(stage: FieldClientStage): string {
  const labels: Record<FieldClientStage, string> = {
    draft_local: "Ready",
    hashing: "Checking video",
    creating_submission: "Preparing",
    creating_upload: "Getting ready",
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

const SAVED_NETWORK_RESUME_STAGES: readonly FieldClientStage[] = [
  "creating_upload",
  "uploading",
  "waiting_for_network",
  "verifying",
  "received",
  "submitting",
];

function savedStageNeedsNetwork(stage: FieldClientStage): boolean {
  return SAVED_NETWORK_RESUME_STAGES.includes(stage);
}

function savedStageLabel(
  stage: FieldClientStage,
  isOnline: boolean,
): string {
  if (!isOnline && savedStageNeedsNetwork(stage)) {
    return "Waiting for network";
  }

  if (savedStageNeedsNetwork(stage)) {
    return "Ready to resume";
  }

  return stageLabel(stage);
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
  const [declarationDraft, setDeclarationDraft] =
    useState<FieldDeclarationDraft>(INITIAL_DECLARATION_DRAFT);
  const [receipt, setReceipt] = useState<FieldReceipt | null>(null);
  const [showProtectionOptions, setShowProtectionOptions] =
    useState(false);
  const [pending, setPending] = useState<FieldQueueRecord | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<FieldProgress>(INITIAL_PROGRESS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [showUploadHelp, setShowUploadHelp] = useState(false);
  const [preparingActivityIndex, setPreparingActivityIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

  useEffect(() => {
    if (!working || progress.stage !== "creating_upload") {
      setPreparingActivityIndex(0);
      return;
    }

    setPreparingActivityIndex(0);

    const timer = window.setInterval(() => {
      setPreparingActivityIndex((current) => current + 1);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [working, progress.stage]);

  const preparingMessages = pending
    ? RESUME_UPLOAD_SETUP_MESSAGES
    : FRESH_UPLOAD_SETUP_MESSAGES;

  const preparingActivityMessage =
    preparingMessages[
      preparingActivityIndex % preparingMessages.length
    ];

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setCompleted(false);
    setReceipt(null);
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

    let declarations: FieldDeclarations;

    try {
      declarations = buildFieldDeclarations(declarationDraft);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Check the submission details before sending.",
      );
      return;
    }

    setCompleted(false);
    setReceipt(null);
    setShowUploadHelp(false);
    setWorking(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const nextReceipt = await submitFieldVideo(
        authUser.id,
        file,
        declarations,
        {
          signal: controller.signal,
          onProgress: (next) =>
            setProgress((current) => ({
              ...next,
              submissionReference:
                next.submissionReference ?? current.submissionReference,
            })),
        },
      );

      setReceipt(nextReceipt);
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
    setReceipt(null);
    setWorking(true);

    setProgress((current) => ({
      ...current,
      stage: replacementFile ? "hashing" : "creating_upload",
      message: replacementFile
        ? "Checking the selected original before resuming…"
        : "Restoring your saved upload…",
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const nextReceipt = await resumeFieldQueue(
        pending.id,
        authUser.id,
        {
        replacementFile,
        queueSnapshot: pending,
        signal: controller.signal,
          onProgress: (next) =>
            setProgress((current) => ({
              ...next,
              submissionReference:
                next.submissionReference ?? current.submissionReference,
            })),
        },
      );

      setReceipt(nextReceipt);
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
      } else if (cause instanceof FieldRecoverableError) {
        setProgress((current) => ({
          ...current,
          stage: cause.stage,
          message: cause.message,
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
      setReceipt(null);
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
                    {working
                      ? stageLabel(progress.stage)
                      : savedStageLabel(progress.stage, isOnline)}
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
              <i
                className={
                  working && progress.stage === "creating_upload"
                    ? "ri-loader-4-line mt-0.5 shrink-0 animate-spin text-[15px] text-[var(--wk-brand)]"
                    : "ri-information-line mt-0.5 shrink-0 text-[14px] text-[var(--wk-text-faint)]"
                }
              />
              <p
                className="text-[12px] leading-5 text-[var(--wk-text-muted)]"
                aria-live="polite"
              >
                {working && progress.stage === "creating_upload"
                  ? preparingActivityMessage
                  : !working
                    && !isOnline
                    && savedStageNeedsNetwork(progress.stage)
                    ? "Waiting for a network connection."
                    : !working
                      && isOnline
                      && progress.stage === "waiting_for_network"
                      ? "Your upload can continue from where it stopped."
                      : progress.message}
              </p>
            </div>

            {!pending.fileBlob && !working ? (
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

            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <WkButton
                type="button"
                variant="primary"
                className="col-span-2 w-full justify-center sm:w-auto"
                disabled={working || (!pending.fileBlob && !replacementFile)}
                onClick={handleResume}
              >
                {working ? "Working…" : "Resume upload"}
              </WkButton>

              <WkButton
                type="button"
                variant="soft"
                className="w-full justify-center sm:w-auto"
                disabled={!working}
                onClick={() => abortRef.current?.abort()}
              >
                Pause
              </WkButton>

              <WkButton
                type="button"
                variant="ghost"
                className="w-full justify-center sm:w-auto"
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

      {completed && receipt ? (
        <section
          className="mt-7 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-sm"
          aria-live="polite"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <i className="ri-check-line text-[24px]" />
          </div>

          <h2 className="mt-4 text-[22px] font-black tracking-tight text-[var(--wk-text)]">
            Submission Received
          </h2>

          <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
            {receipt.receiptMessage}
          </p>

          <p className="mt-2 text-[12px] leading-5 text-[var(--wk-text-muted)]">
            This confirms intake for review. It does not mean the video is
            approved or will be published.
          </p>

          <div className="mt-5 rounded-2xl bg-[var(--wk-bg)] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              Reference
            </p>
            <p className="mt-1 break-all text-[17px] font-black text-[var(--wk-text)]">
              {receipt.submissionReference}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[var(--wk-text-muted)]">
              Received{" "}
              {formatReceiptTime(
                receipt.receiptIssuedAt ?? receipt.submittedAt,
              )}
            </p>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-[var(--wk-text-faint)]">
            Keep this reference if you contact WAKILISHA about this
            submission.
          </p>

          <div className="mt-5">
            <WkButton
              type="button"
              variant="soft"
              onClick={() => {
                setCompleted(false);
                setReceipt(null);
                setDeclarationDraft(INITIAL_DECLARATION_DRAFT);
                setShowProtectionOptions(false);
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
                  {progress.submissionReference ? (
                    <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                      Ref {progress.submissionReference}
                    </p>
                  ) : null}
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

              {!working ? (
                <div className="mt-6 border-t border-[var(--wk-divider)] pt-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                    Before You Send
                  </p>
                  <h3 className="mt-1 text-[18px] font-black tracking-tight text-[var(--wk-text)]">
                    Tell Us What You Know
                  </h3>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--wk-text-muted)]">
                    These answers help the newsroom handle your video safely.
                    They do not approve it for publication.
                  </p>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-black text-[var(--wk-text)]">
                        Who Controls This Video?
                      </p>
                      <span className="text-[10px] font-bold text-[var(--wk-text-faint)]">
                        Required
                      </span>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <ChoiceButton
                        selected={
                          declarationDraft.rightsDeclaration
                          === "owns_or_controls"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            rightsDeclaration: "owns_or_controls",
                          }))
                        }
                        title="I own or control this video"
                      />
                      <ChoiceButton
                        selected={
                          declarationDraft.rightsDeclaration
                          === "authorized_by_rights_holder"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            rightsDeclaration:
                              "authorized_by_rights_holder",
                          }))
                        }
                        title="The rights holder allowed me to send it"
                      />
                      <ChoiceButton
                        selected={
                          declarationDraft.rightsDeclaration
                          === "uncertain"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            rightsDeclaration: "uncertain",
                          }))
                        }
                        title="I’m not sure"
                      />
                      <ChoiceButton
                        selected={
                          declarationDraft.rightsDeclaration === "other"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            rightsDeclaration: "other",
                          }))
                        }
                        title="Something else"
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-black text-[var(--wk-text)]">
                        What Do You Know About Permission?
                      </p>
                      <span className="text-[10px] font-bold text-[var(--wk-text-faint)]">
                        Required
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                      Tell us what you know about permission from people shown
                      or recorded.
                    </p>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <ChoiceButton
                        selected={
                          declarationDraft.consentDeclaration === "granted"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            consentDeclaration: "granted",
                          }))
                        }
                        title="People shown gave permission"
                      />
                      <ChoiceButton
                        selected={
                          declarationDraft.consentDeclaration
                          === "not_required"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            consentDeclaration: "not_required",
                          }))
                        }
                        title="Permission is not required"
                      />
                      <ChoiceButton
                        selected={
                          declarationDraft.consentDeclaration === "uncertain"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            consentDeclaration: "uncertain",
                          }))
                        }
                        title="I’m not sure"
                      />
                      <ChoiceButton
                        selected={
                          declarationDraft.consentDeclaration
                          === "not_obtained"
                        }
                        onClick={() =>
                          setDeclarationDraft((current) => ({
                            ...current,
                            consentDeclaration: "not_obtained",
                          }))
                        }
                        title="Permission was not obtained"
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)]">
                    <button
                      type="button"
                      aria-expanded={showProtectionOptions}
                      onClick={() =>
                        setShowProtectionOptions((current) => !current)
                      }
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                    >
                      <span>
                        <span className="block text-[12px] font-black text-[var(--wk-text)]">
                          Protection Options
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-[var(--wk-text-muted)]">
                          Name, contact, source handling, holds, and broad
                          location.
                        </span>
                      </span>
                      <i
                        className={`ri-arrow-down-s-line shrink-0 text-[17px] text-[var(--wk-text-faint)] transition-transform ${
                          showProtectionOptions ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {showProtectionOptions ? (
                      <div className="border-t border-[var(--wk-divider)] px-4 pb-4 pt-5">
                        <div>
                          <p className="text-[12px] font-black text-[var(--wk-text)]">
                            How Should We Handle Your Name?
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                            Your account stays attached to this submission.
                            Restricted access limits who can connect it to you.
                          </p>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <ChoiceButton
                              selected={
                                declarationDraft.newsroomIdentityMode
                                === "standard"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  newsroomIdentityMode: "standard",
                                }))
                              }
                              title="Standard newsroom access"
                              description="Authorized newsroom staff can connect this submission to your account."
                            />
                            <ChoiceButton
                              selected={
                                declarationDraft.newsroomIdentityMode
                                === "restricted"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  newsroomIdentityMode: "restricted",
                                }))
                              }
                              title="Restricted newsroom access"
                              description="Fewer newsroom staff can connect this submission to your account."
                            />
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-[12px] font-black text-[var(--wk-text)]">
                            Can WAKILISHA Name You Publicly?
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <ChoiceButton
                              selected={
                                declarationDraft.publicAttributionPreference
                                === "do_not_name"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  publicAttributionPreference:
                                    "do_not_name",
                                }))
                              }
                              title="Do not name me publicly"
                            />
                            <ChoiceButton
                              selected={
                                declarationDraft.publicAttributionPreference
                                === "may_name"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  publicAttributionPreference: "may_name",
                                }))
                              }
                              title="You may name me publicly"
                            />
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-[12px] font-black text-[var(--wk-text)]">
                            Can We Contact You About This?
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <ChoiceButton
                              selected={
                                declarationDraft.contactPreference
                                === "account_contact"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  contactPreference: "account_contact",
                                }))
                              }
                              title="You may contact me"
                              description="Use the contact details already linked to my account."
                            />
                            <ChoiceButton
                              selected={
                                declarationDraft.contactPreference
                                === "no_follow_up"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  contactPreference: "no_follow_up",
                                }))
                              }
                              title="No follow-up"
                            />
                          </div>
                        </div>

                        <div className="mt-5">
                          <label
                            htmlFor="field-sensitivity"
                            className="text-[12px] font-black text-[var(--wk-text)]"
                          >
                            How Sensitive Is This?
                          </label>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                            Choose the level that best reflects the risk if
                            this submission is exposed.
                          </p>
                          <select
                            id="field-sensitivity"
                            value={declarationDraft.declaredSensitivity}
                            onChange={(event) =>
                              setDeclarationDraft((current) => ({
                                ...current,
                                declaredSensitivity:
                                  event.target.value as FieldDeclarations["declared_sensitivity"],
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[12px] font-semibold text-[var(--wk-text)] outline-none"
                          >
                            <option value="none">
                              Not especially sensitive
                            </option>
                            <option value="low">Low sensitivity</option>
                            <option value="moderate">
                              Moderate sensitivity
                            </option>
                            <option value="high">High sensitivity</option>
                            <option value="extreme">
                              Extreme sensitivity
                            </option>
                          </select>
                        </div>

                        <div className="mt-5">
                          <label
                            htmlFor="field-source-protection"
                            className="text-[12px] font-black text-[var(--wk-text)]"
                          >
                            Who Should See Source Details?
                          </label>
                          <select
                            id="field-source-protection"
                            value={
                              declarationDraft.sourceProtectionRequest
                            }
                            onChange={(event) =>
                              setDeclarationDraft((current) => ({
                                ...current,
                                sourceProtectionRequest:
                                  event.target.value as FieldDeclarations["source_protection_request"],
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[12px] font-semibold text-[var(--wk-text)] outline-none"
                          >
                            <option value="internal">
                              Newsroom staff handling the submission
                            </option>
                            <option value="restricted">
                              A smaller newsroom group
                            </option>
                            <option value="confidential">
                              Treat source details as confidential
                            </option>
                          </select>
                        </div>

                        <div className="mt-5">
                          <label
                            htmlFor="field-hold"
                            className="text-[12px] font-black text-[var(--wk-text)]"
                          >
                            Should We Hold This Video?
                          </label>
                          <select
                            id="field-hold"
                            value={declarationDraft.embargoRequestMode}
                            onChange={(event) =>
                              setDeclarationDraft((current) => ({
                                ...current,
                                embargoRequestMode:
                                  event.target.value as FieldDeclarations["embargo_request_mode"],
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[12px] font-semibold text-[var(--wk-text)] outline-none"
                          >
                            <option value="none">No hold request</option>
                            <option value="until_review">
                              Hold until the newsroom reviews it
                            </option>
                            <option value="until_time">
                              Hold until a date and time
                            </option>
                          </select>

                          {declarationDraft.embargoRequestMode
                          === "until_time" ? (
                            <input
                              type="datetime-local"
                              value={
                                declarationDraft.requestedEmbargoUntilLocal
                              }
                              onChange={(event) =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  requestedEmbargoUntilLocal:
                                    event.target.value,
                                }))
                              }
                              aria-label="Hold until"
                              className="mt-2 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[12px] text-[var(--wk-text)] outline-none"
                            />
                          ) : null}
                        </div>

                        <div className="mt-5">
                          <p className="text-[12px] font-black text-[var(--wk-text)]">
                            Add a Broad Location?
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                            Keep it broad. Avoid an exact address if that
                            could put someone at risk.
                          </p>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <ChoiceButton
                              selected={
                                declarationDraft.locationMode
                                === "not_collected"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  locationMode: "not_collected",
                                  locationDescription: "",
                                }))
                              }
                              title="Do not add a location"
                            />
                            <ChoiceButton
                              selected={
                                declarationDraft.locationMode
                                === "coarse_text"
                              }
                              onClick={() =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  locationMode: "coarse_text",
                                }))
                              }
                              title="Add a broad location"
                            />
                          </div>

                          {declarationDraft.locationMode === "coarse_text" ? (
                            <input
                              type="text"
                              value={declarationDraft.locationDescription}
                              onChange={(event) =>
                                setDeclarationDraft((current) => ({
                                  ...current,
                                  locationDescription: event.target.value,
                                }))
                              }
                              placeholder="City, area, or landmark"
                              aria-label="Broad location"
                              className="mt-2 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[12px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {working ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-bold text-[var(--wk-text)]">
                      {stageLabel(progress.stage)}
                    </span>
                    <span className="font-semibold text-[var(--wk-text-muted)]">
                      {progress.stage === "creating_upload"
                        ? "Working"
                        : `${Math.round(progress.progress * 100)}%`}
                    </span>
                  </div>

                  {progress.stage === "creating_upload" ? (
                    <div
                      className="mt-3 flex items-start gap-2 rounded-2xl bg-[var(--wk-bg)] px-3 py-3"
                      role="status"
                      aria-live="polite"
                    >
                      <i className="ri-loader-4-line mt-0.5 shrink-0 animate-spin text-[16px] text-[var(--wk-brand)]" />
                      <p className="text-[11px] leading-5 text-[var(--wk-text-muted)]">
                        {preparingActivityMessage}
                      </p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}

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
