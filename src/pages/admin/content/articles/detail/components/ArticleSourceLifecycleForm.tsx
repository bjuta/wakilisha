import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  ArticleTrustServiceError,
  restoreSource,
  reviewSourceVersion,
  submitSourceVersionForReview,
  withdrawSource,
  type ArticleTrustSourceSummary,
} from "@/services/articles/articleTrustService";

export type ArticleSourceLifecycleMode =
  | "withdraw"
  | "restore"
  | "submit"
  | "review";

interface Props {
  source: ArticleTrustSourceSummary;
  mode: ArticleSourceLifecycleMode;
  onClose: () => void;
  onChanged: () => void;
  onStale: () => void;
}

type ReviewDecision =
  | "approve"
  | "request_changes"
  | "reject";

type ExposureClass =
  | "internal"
  | "public"
  | "public_redacted";

function modeTitle(
  mode: ArticleSourceLifecycleMode,
): string {
  switch (mode) {
    case "withdraw":
      return "Withdraw Source";
    case "restore":
      return "Restore Source";
    case "submit":
      return "Submit Source for Review";
    case "review":
      return "Review Source";
  }
}

function modeDescription(
  mode: ArticleSourceLifecycleMode,
): string {
  switch (mode) {
    case "withdraw":
      return "Withdraw the Source without deleting its versions, Citations, or editorial history.";
    case "restore":
      return "Restore the Source to active editorial work without automatically restoring public eligibility.";
    case "submit":
      return "Submit the exact current working Source version for governed review.";
    case "review":
      return "Review the exact submitted Source version and choose its resulting exposure.";
  }
}

export function ArticleSourceLifecycleForm({
  source,
  mode,
  onClose,
  onChanged,
  onStale,
}: Props) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] =
    useState(false);
  const [decision, setDecision] =
    useState<ReviewDecision>("approve");
  const [exposureClass, setExposureClass] =
    useState<ExposureClass>("internal");
  const [
    publicReviewConfirmed,
    setPublicReviewConfirmed,
  ] = useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const publicApproval =
    mode === "review" &&
    decision === "approve" &&
    exposureClass !== "internal";

  useEffect(() => {
    if (!publicApproval) {
      setPublicReviewConfirmed(false);
    }
  }, [publicApproval]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedReason = reason.trim();

    if (
      (
        mode === "withdraw" ||
        mode === "restore"
      ) &&
      !normalizedReason
    ) {
      setErrorMessage(
        `A Source ${
          mode === "withdraw"
            ? "withdrawal"
            : "restoration"
        } reason is required.`,
      );
      return;
    }

    if (
      mode === "review" &&
      (
        decision === "request_changes" ||
        decision === "reject"
      ) &&
      !normalizedReason
    ) {
      setErrorMessage(
        "A review reason is required for this decision.",
      );
      return;
    }

    if (
      (
        mode === "withdraw" ||
        mode === "restore"
      ) &&
      !confirmed
    ) {
      setErrorMessage(
        "Confirm the Source lifecycle consequence before continuing.",
      );
      return;
    }

    if (
      publicApproval &&
      !publicReviewConfirmed
    ) {
      setErrorMessage(
        "Confirm the public Source review before approval.",
      );
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "withdraw") {
        await withdrawSource({
          p_source_id: source.id,
          p_reason: normalizedReason,
          p_withdrawal_public_mode:
            "hide_public_reference",
        });
      } else if (mode === "restore") {
        await restoreSource({
          p_source_id: source.id,
          p_reason: normalizedReason,
        });
      } else if (mode === "submit") {
        if (!source.currentWorkingVersionId) {
          throw new Error(
            "The current working Source version is unavailable.",
          );
        }

        await submitSourceVersionForReview({
          p_source_id: source.id,
          p_source_version_id:
            source.currentWorkingVersionId,
          p_expected_working_revision:
            source.workingRevision,
          ...(normalizedReason
            ? {
                p_reason:
                  normalizedReason,
              }
            : {}),
        });
      } else {
        if (!source.currentSubmittedVersionId) {
          throw new Error(
            "The submitted Source version is unavailable.",
          );
        }

        await reviewSourceVersion({
          p_source_id: source.id,
          p_source_version_id:
            source.currentSubmittedVersionId,
          p_decision: decision,
          ...(normalizedReason
            ? {
                p_reason:
                  normalizedReason,
              }
            : {}),
          ...(decision === "approve"
            ? {
                p_exposure_class:
                  exposureClass,
              }
            : {}),
        });
      }

      onChanged();
    } catch (error) {
      if (
        error instanceof
          ArticleTrustServiceError &&
        error.kind === "concurrency"
      ) {
        setErrorMessage(
          "The Source changed while this form was open. The Source Library has been refreshed.",
        );
        onStale();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The Source lifecycle action could not be completed.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-source-lifecycle-title"
    >
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-wk-border bg-wk-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
              Governed Source
            </div>
            <h2
              id="article-source-lifecycle-title"
              className="mt-1 text-[18px] font-bold text-wk-text"
            >
              {modeTitle(mode)}
            </h2>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-wk-text-muted">
              {modeDescription(mode)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="wk-button wk-button-ghost wk-button-sm shrink-0"
            aria-label="Close Source lifecycle form"
          >
            <WkIcon name="X" size={16} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {errorMessage ? (
              <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-4 py-3 text-[11px] leading-5 text-wk-danger">
                {errorMessage}
              </div>
            ) : null}

            <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                Source
              </div>
              <h3 className="mt-1 text-[14px] font-bold text-wk-text">
                {source.title}
              </h3>
              <div className="mt-3 grid gap-3 text-[10px] sm:grid-cols-3">
                <div>
                  <div className="font-bold text-wk-text-faint">
                    State
                  </div>
                  <div className="mt-1 text-wk-text">
                    {source.sourceState}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-wk-text-faint">
                    Review
                  </div>
                  <div className="mt-1 text-wk-text">
                    {source.reviewStatus}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-wk-text-faint">
                    Exposure
                  </div>
                  <div className="mt-1 text-wk-text">
                    {source.exposureClass}
                  </div>
                </div>
              </div>
            </section>

            {mode === "withdraw" ? (
              <section className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4">
                <h3 className="text-[12px] font-bold text-wk-text">
                  Public response: Hide Public Reference
                </h3>
                <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                  Current Citations remain attached for
                  editorial history, but they become
                  ineligible at read time while the
                  Source is withdrawn. Retain and redact
                  withdrawal modes are not exposed until
                  public delivery supports them.
                </p>
              </section>
            ) : null}

            {mode === "restore" ? (
              <section className="rounded-xl border border-wk-info/30 bg-wk-info-soft p-4">
                <h3 className="text-[12px] font-bold text-wk-text">
                  Restoration requires a fresh review
                </h3>
                <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                  Restoration returns the Source to
                  Active, Changes Requested, and Internal.
                  It clears the current approved version.
                  Existing public Citations do not become
                  eligible automatically.
                </p>
              </section>
            ) : null}

            {mode === "submit" ? (
              <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <h3 className="text-[12px] font-bold text-wk-text">
                  Exact working Source version
                </h3>
                <p className="mt-1 break-all font-mono text-[10px] text-wk-text-muted">
                  {source.currentWorkingVersionId}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-wk-text-muted">
                  Submission starts review. It does not
                  make the Source public.
                </p>
              </section>
            ) : null}

            {mode === "review" ? (
              <>
                <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                  <h3 className="text-[12px] font-bold text-wk-text">
                    Exact submitted Source version
                  </h3>
                  <p className="mt-1 break-all font-mono text-[10px] text-wk-text-muted">
                    {source.currentSubmittedVersionId}
                  </p>
                </section>

                <label className="block">
                  <span className="wk-label">
                    Review Decision
                  </span>
                  <select
                    value={decision}
                    onChange={(event) =>
                      setDecision(
                        event.target
                          .value as ReviewDecision,
                      )
                    }
                    disabled={submitting}
                    className="wk-input mt-1 w-full"
                  >
                    <option value="approve">
                      Approve
                    </option>
                    <option value="request_changes">
                      Request Changes
                    </option>
                    <option value="reject">
                      Reject
                    </option>
                  </select>
                </label>

                {decision === "approve" ? (
                  <label className="block">
                    <span className="wk-label">
                      Approved Exposure
                    </span>
                    <select
                      value={exposureClass}
                      onChange={(event) =>
                        setExposureClass(
                          event.target
                            .value as ExposureClass,
                        )
                      }
                      disabled={submitting}
                      className="wk-input mt-1 w-full"
                    >
                      <option value="internal">
                        Internal Use
                      </option>
                      <option value="public">
                        Public Reference
                      </option>
                      <option value="public_redacted">
                        Public Reference with URL Redacted
                      </option>
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}

            <label className="block">
              <span className="wk-label">
                {mode === "review"
                  ? "Review Reason"
                  : mode === "submit"
                    ? "Submission Note"
                    : mode === "withdraw"
                      ? "Withdrawal Reason"
                      : "Restoration Reason"}
              </span>
              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                rows={4}
                disabled={submitting}
                className="wk-input mt-1 w-full resize-y"
                placeholder={
                  mode === "submit"
                    ? "Optional review context"
                    : "Record the real editorial reason"
                }
              />
            </label>

            {mode === "withdraw" ||
            mode === "restore" ? (
              <label className="flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) =>
                    setConfirmed(
                      event.target.checked,
                    )
                  }
                  disabled={submitting}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[11px] font-bold text-wk-text">
                    Confirm Source Lifecycle Change
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                    I understand that this action changes
                    Source eligibility without deleting
                    Source versions, Citations, or
                    attachment history.
                  </span>
                </span>
              </label>
            ) : null}

            {publicApproval ? (
              <label className="flex items-start gap-3 rounded-xl border border-wk-success/30 bg-wk-success-soft p-4">
                <input
                  type="checkbox"
                  checked={
                    publicReviewConfirmed
                  }
                  onChange={(event) =>
                    setPublicReviewConfirmed(
                      event.target.checked,
                    )
                  }
                  disabled={submitting}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-[11px] font-bold text-wk-text">
                    Confirm Public Source Review
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                    I reviewed rights, consent,
                    sensitivity, exposure, and the exact
                    submitted Source version for public
                    reference.
                  </span>
                </span>
              </label>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-wk-border px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="wk-button wk-button-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="wk-button wk-button-primary"
            >
              <WkIcon
                name={
                  submitting
                    ? "Loader2"
                    : mode === "withdraw"
                      ? "TriangleAlert"
                      : mode === "restore"
                        ? "RefreshCw"
                        : mode === "review"
                          ? "ShieldCheck"
                          : "Plus"
                }
                size={15}
                className={
                  submitting
                    ? "animate-spin"
                    : undefined
                }
              />
              {submitting
                ? "Saving Source"
                : modeTitle(mode)}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
