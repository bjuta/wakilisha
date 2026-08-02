import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  ArticleTrustServiceError,
  createSource,
  reviewSourceVersion,
  submitSourceVersionForReview,
  type ArticleTrustSourceType,
} from "@/services/articles/articleTrustService";

const RIGHTS_STATUSES = [
  ["unknown", "Unknown"],
  ["owned", "Owned"],
  ["licensed", "Licensed"],
  ["public_domain", "Public Domain"],
  ["fair_use", "Fair Use"],
  ["needs_clearance", "Needs Clearance"],
  ["restricted", "Restricted"],
] as const;

const CONSENT_STATUSES = [
  ["unknown", "Unknown"],
  ["not_required", "Not Required"],
  ["requested", "Requested"],
  ["granted", "Granted"],
  ["limited", "Limited"],
  ["declined", "Declined"],
  ["withdrawn", "Withdrawn"],
] as const;

const SENSITIVITY_LEVELS = [
  ["none", "None"],
  ["low", "Low"],
  ["moderate", "Moderate"],
  ["high", "High"],
  ["extreme", "Extreme"],
] as const;

type ReviewMode =
  | "draft"
  | "submit"
  | "approve_internal"
  | "approve_public"
  | "approve_public_redacted";

interface Props {
  sourceTypes: ArticleTrustSourceType[];
  canReview: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function record(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredId(
  value: unknown,
  key: string,
  message: string,
): string {
  const candidate = record(value)[key];

  if (
    typeof candidate !== "string" ||
    !candidate.trim()
  ) {
    throw new Error(message);
  }

  return candidate.trim();
}

function requiredNumber(
  value: unknown,
  key: string,
  message: string,
): number {
  const candidate = record(value)[key];
  const parsed =
    typeof candidate === "number"
      ? candidate
      : Number(candidate);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(message);
  }

  return parsed;
}

function isHttpUrl(value: string): boolean {
  if (!value.trim()) return true;

  try {
    const parsed = new URL(value.trim());

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function optionalText(
  value: string,
): string | undefined {
  const normalized = value.trim();

  return normalized || undefined;
}

function exposureForMode(
  mode: ReviewMode,
):
  | "internal"
  | "public"
  | "public_redacted"
  | null {
  if (mode === "approve_internal") {
    return "internal";
  }

  if (mode === "approve_public") {
    return "public";
  }

  if (mode === "approve_public_redacted") {
    return "public_redacted";
  }

  return null;
}

export function ArticleSourceForm({
  sourceTypes,
  canReview,
  onClose,
  onCreated,
}: Props) {
  const [sourceType, setSourceType] =
    useState(
      sourceTypes[0]?.sourceType ?? "article",
    );
  const [title, setTitle] = useState("");
  const [creatorDisplay, setCreatorDisplay] =
    useState("");
  const [publisherDisplay, setPublisherDisplay] =
    useState("");
  const [sourceUrl, setSourceUrl] =
    useState("");
  const [archiveIdentifier, setArchiveIdentifier] =
    useState("");
  const [publicationDate, setPublicationDate] =
    useState("");
  const [captureDate, setCaptureDate] =
    useState("");
  const [retrievalDate, setRetrievalDate] =
    useState("");
  const [languageCode, setLanguageCode] =
    useState("");
  const [countryCode, setCountryCode] =
    useState("");
  const [placeText, setPlaceText] =
    useState("");
  const [rightsStatus, setRightsStatus] =
    useState("unknown");
  const [consentStatus, setConsentStatus] =
    useState("unknown");
  const [sensitivity, setSensitivity] =
    useState("none");
  const [reliabilityNote, setReliabilityNote] =
    useState("");
  const [creditLine, setCreditLine] =
    useState("");
  const [internalNotes, setInternalNotes] =
    useState("");
  const [reviewMode, setReviewMode] =
    useState<ReviewMode>(
      canReview ? "approve_internal" : "submit",
    );
  const [reviewReason, setReviewReason] =
    useState("");
  const [
    publicApprovalConfirmed,
    setPublicApprovalConfirmed,
  ] = useState(false);
  const [
    createdSourceId,
    setCreatedSourceId,
  ] = useState<string | null>(null);
  const [
    createdSourceVersionId,
    setCreatedSourceVersionId,
  ] = useState<string | null>(null);
  const [
    workingRevision,
    setWorkingRevision,
  ] = useState<number | null>(null);
  const [submitted, setSubmitted] =
    useState(false);
  const [approved, setApproved] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const sourceLocked = createdSourceId !== null;
  const reviewLocked = submitted || approved;
  const exposureClass =
    exposureForMode(reviewMode);
  const publicApproval =
    exposureClass === "public" ||
    exposureClass === "public_redacted";

  useEffect(() => {
    if (
      sourceTypes.length > 0 &&
      !sourceTypes.some(
        (item) =>
          item.sourceType === sourceType,
      )
    ) {
      setSourceType(
        sourceTypes[0].sourceType,
      );
    }
  }, [sourceType, sourceTypes]);

  useEffect(() => {
    if (!publicApproval) {
      setPublicApprovalConfirmed(false);
    }
  }, [publicApproval]);

  function requestClose() {
    if (
      (
        createdSourceId ||
        createdSourceVersionId ||
        submitted
      ) &&
      !approved &&
      !window.confirm(
        "This Source already has saved progress. Closing will keep that progress in the Source Library. Continue?",
      )
    ) {
      return;
    }

    onClose();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage(
        "Source title is required.",
      );
      return;
    }

    if (!sourceType.trim()) {
      setErrorMessage(
        "Source type is required.",
      );
      return;
    }

    if (!isHttpUrl(sourceUrl)) {
      setErrorMessage(
        "Source URL must use HTTP or HTTPS.",
      );
      return;
    }

    if (
      reviewMode.startsWith("approve_") &&
      !canReview
    ) {
      setErrorMessage(
        "Source review authority is required for approval.",
      );
      return;
    }

    if (
      publicApproval &&
      !publicApprovalConfirmed
    ) {
      setErrorMessage(
        "Confirm the public review before approving this Source.",
      );
      return;
    }

    setSubmitting(true);

    try {
      let sourceId = createdSourceId;
      let sourceVersionId =
        createdSourceVersionId;
      let revision = workingRevision;

      if (
        !sourceId ||
        !sourceVersionId ||
        !revision
      ) {
        const created = await createSource({
          p_metadata: {
            source_type: sourceType,
            title: title.trim(),
            rights_status: rightsStatus,
            consent_status: consentStatus,
            sensitivity,
            ...(optionalText(creatorDisplay)
              ? {
                  creator_display:
                    creatorDisplay.trim(),
                }
              : {}),
            ...(optionalText(publisherDisplay)
              ? {
                  publisher_display:
                    publisherDisplay.trim(),
                }
              : {}),
            ...(optionalText(sourceUrl)
              ? {
                  source_url:
                    sourceUrl.trim(),
                }
              : {}),
            ...(optionalText(archiveIdentifier)
              ? {
                  archive_identifier:
                    archiveIdentifier.trim(),
                }
              : {}),
            ...(optionalText(publicationDate)
              ? {
                  publication_date:
                    publicationDate,
                }
              : {}),
            ...(optionalText(captureDate)
              ? {
                  capture_date:
                    captureDate,
                }
              : {}),
            ...(optionalText(retrievalDate)
              ? {
                  retrieval_date:
                    retrievalDate,
                }
              : {}),
            ...(optionalText(languageCode)
              ? {
                  language_code:
                    languageCode
                      .trim()
                      .toLowerCase(),
                }
              : {}),
            ...(optionalText(countryCode)
              ? {
                  country_code:
                    countryCode
                      .trim()
                      .toUpperCase(),
                }
              : {}),
            ...(optionalText(placeText)
              ? {
                  place_text:
                    placeText.trim(),
                }
              : {}),
            ...(optionalText(reliabilityNote)
              ? {
                  reliability_note:
                    reliabilityNote.trim(),
                }
              : {}),
            ...(optionalText(creditLine)
              ? {
                  credit_line:
                    creditLine.trim(),
                }
              : {}),
            ...(optionalText(internalNotes)
              ? {
                  internal_notes:
                    internalNotes.trim(),
                }
              : {}),
          },
          p_registry_links: [],
        });

        sourceId = requiredId(
          created,
          "source_id",
          "Source creation returned no Source identity.",
        );
        sourceVersionId = requiredId(
          created,
          "source_version_id",
          "Source creation returned no Source version.",
        );
        revision = requiredNumber(
          created,
          "working_revision",
          "Source creation returned no working revision.",
        );

        setCreatedSourceId(sourceId);
        setCreatedSourceVersionId(
          sourceVersionId,
        );
        setWorkingRevision(revision);
      }

      if (reviewMode === "draft") {
        onCreated();
        return;
      }

      if (!submitted) {
        await submitSourceVersionForReview({
          p_source_id: sourceId,
          p_source_version_id:
            sourceVersionId,
          p_expected_working_revision:
            revision,
          ...(optionalText(reviewReason)
            ? {
                p_reason:
                  reviewReason.trim(),
              }
            : {}),
        });

        setSubmitted(true);
      }

      if (reviewMode === "submit") {
        onCreated();
        return;
      }

      if (!approved && exposureClass) {
        await reviewSourceVersion({
          p_source_id: sourceId,
          p_source_version_id:
            sourceVersionId,
          p_decision: "approve",
          p_exposure_class:
            exposureClass,
          ...(optionalText(reviewReason)
            ? {
                p_reason:
                  reviewReason.trim(),
              }
            : {}),
        });

        setApproved(true);
      }

      onCreated();
    } catch (error) {
      if (
        error instanceof
          ArticleTrustServiceError &&
        error.kind === "concurrency"
      ) {
        setErrorMessage(
          "The Source revision changed while this form was open. Review the Source Library before retrying.",
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The Source could not be created.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel =
    reviewMode === "draft"
      ? "Create Source"
      : reviewMode === "submit"
        ? "Create and Submit Source"
        : "Create, Submit and Approve";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-source-form-title"
    >
      <div className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-wk-border bg-wk-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
              Governed Source
            </div>
            <h2
              id="article-source-form-title"
              className="mt-1 text-[18px] font-bold text-wk-text"
            >
              Add a Source
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-wk-text-muted">
              Create one reusable Source. Approval
              is one requirement for a future Citation
              to appear publicly.
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className="wk-button wk-button-ghost wk-button-sm shrink-0"
            aria-label="Close Source form"
          >
            <WkIcon name="X" size={16} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {errorMessage ? (
              <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-4 py-3 text-[11px] leading-5 text-wk-danger">
                {errorMessage}
              </div>
            ) : null}

            {sourceLocked ? (
              <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3">
                <div className="text-[11px] font-bold text-wk-text">
                  Source identity created
                </div>
                <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                  The form will reuse the Source and
                  Source version already created. The
                  saved metadata is now locked.
                </p>
              </div>
            ) : null}

            <fieldset
              disabled={
                sourceLocked || submitting
              }
            >
              <legend className="text-[13px] font-bold text-wk-text">
                Source Identity
              </legend>
              <p className="mt-1 text-[10px] text-wk-text-muted">
                Record the Source itself before
                creating any Article Citation.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="wk-label">
                    Source Type
                  </span>
                  <select
                    value={sourceType}
                    onChange={(event) =>
                      setSourceType(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  >
                    {sourceTypes.map((item) => (
                      <option
                        key={item.sourceType}
                        value={item.sourceType}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="wk-label">
                    Title
                  </span>
                  <input
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                    required
                    className="wk-input mt-1 w-full"
                    placeholder="Source title"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Creator
                  </span>
                  <input
                    value={creatorDisplay}
                    onChange={(event) =>
                      setCreatorDisplay(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Author, speaker, or creator"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Publisher
                  </span>
                  <input
                    value={publisherDisplay}
                    onChange={(event) =>
                      setPublisherDisplay(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Publisher or institution"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Source URL
                  </span>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(event) =>
                      setSourceUrl(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="https://"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Archive Identifier
                  </span>
                  <input
                    value={archiveIdentifier}
                    onChange={(event) =>
                      setArchiveIdentifier(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Optional reference"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Language Code
                  </span>
                  <input
                    value={languageCode}
                    onChange={(event) =>
                      setLanguageCode(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="en"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Publication Date
                  </span>
                  <input
                    type="date"
                    value={publicationDate}
                    onChange={(event) =>
                      setPublicationDate(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Capture Date
                  </span>
                  <input
                    type="date"
                    value={captureDate}
                    onChange={(event) =>
                      setCaptureDate(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Retrieval Date
                  </span>
                  <input
                    type="date"
                    value={retrievalDate}
                    onChange={(event) =>
                      setRetrievalDate(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Country Code
                  </span>
                  <input
                    value={countryCode}
                    onChange={(event) =>
                      setCountryCode(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="KE"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Place
                  </span>
                  <input
                    value={placeText}
                    onChange={(event) =>
                      setPlaceText(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Nairobi, Kenya"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset
              disabled={
                sourceLocked || submitting
              }
              className="border-t border-wk-border pt-5"
            >
              <legend className="text-[13px] font-bold text-wk-text">
                Rights and Safety
              </legend>
              <p className="mt-1 text-[10px] text-wk-text-muted">
                These fields guide review. Citation
                does not grant reuse permission.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label>
                  <span className="wk-label">
                    Rights Status
                  </span>
                  <select
                    value={rightsStatus}
                    onChange={(event) =>
                      setRightsStatus(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  >
                    {RIGHTS_STATUSES.map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="wk-label">
                    Consent Status
                  </span>
                  <select
                    value={consentStatus}
                    onChange={(event) =>
                      setConsentStatus(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  >
                    {CONSENT_STATUSES.map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="wk-label">
                    Sensitivity
                  </span>
                  <select
                    value={sensitivity}
                    onChange={(event) =>
                      setSensitivity(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                  >
                    {SENSITIVITY_LEVELS.map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="sm:col-span-3">
                  <span className="wk-label">
                    Reliability Note
                  </span>
                  <textarea
                    value={reliabilityNote}
                    onChange={(event) =>
                      setReliabilityNote(
                        event.target.value,
                      )
                    }
                    rows={2}
                    className="wk-input mt-1 w-full resize-y"
                    placeholder="What should an editor know about reliability?"
                  />
                </label>

                <label className="sm:col-span-3">
                  <span className="wk-label">
                    Credit Line
                  </span>
                  <input
                    value={creditLine}
                    onChange={(event) =>
                      setCreditLine(
                        event.target.value,
                      )
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Optional attribution wording"
                  />
                </label>

                <label className="sm:col-span-3">
                  <span className="wk-label">
                    Internal Notes
                  </span>
                  <textarea
                    value={internalNotes}
                    onChange={(event) =>
                      setInternalNotes(
                        event.target.value,
                      )
                    }
                    rows={3}
                    className="wk-input mt-1 w-full resize-y"
                    placeholder="Private editorial context"
                  />
                </label>
              </div>
            </fieldset>

            <section className="border-t border-wk-border pt-5">
              <h3 className="text-[13px] font-bold text-wk-text">
                Review Path
              </h3>
              <p className="mt-1 text-[10px] text-wk-text-muted">
                Approval governs Source exposure. It
                does not attach the Source to this
                Article.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="wk-label">
                    Next Step
                  </span>
                  <select
                    value={reviewMode}
                    onChange={(event) =>
                      setReviewMode(
                        event.target
                          .value as ReviewMode,
                      )
                    }
                    disabled={
                      reviewLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                  >
                    <option value="draft">
                      Save as Draft
                    </option>
                    <option value="submit">
                      Submit for Review
                    </option>
                    {canReview ? (
                      <>
                        <option value="approve_internal">
                          Approve for Internal Use
                        </option>
                        <option value="approve_public">
                          Approve for Public Reference
                        </option>
                        <option value="approve_public_redacted">
                          Approve with URL Redacted
                        </option>
                      </>
                    ) : null}
                  </select>
                </label>

                <label>
                  <span className="wk-label">
                    Review Note
                  </span>
                  <input
                    value={reviewReason}
                    onChange={(event) =>
                      setReviewReason(
                        event.target.value,
                      )
                    }
                    disabled={
                      approved || submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Optional review context"
                  />
                </label>
              </div>

              {publicApproval ? (
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                  <input
                    type="checkbox"
                    checked={
                      publicApprovalConfirmed
                    }
                    onChange={(event) =>
                      setPublicApprovalConfirmed(
                        event.target.checked,
                      )
                    }
                    disabled={
                      approved || submitting
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[11px] font-bold text-wk-text">
                      Confirm Public Review
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                      I reviewed rights, consent,
                      sensitivity, and exposure for
                      public presentation.
                    </span>
                  </span>
                </label>
              ) : null}
            </section>

            {sourceLocked ? (
              <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div className="grid gap-3 text-[10px] sm:grid-cols-3">
                  <div>
                    <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Source ID
                    </div>
                    <div className="mt-1 break-all font-mono text-wk-text">
                      {createdSourceId}
                    </div>
                  </div>

                  <div>
                    <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Source Version
                    </div>
                    <div className="mt-1 break-all font-mono text-wk-text">
                      {createdSourceVersionId}
                    </div>
                  </div>

                  <div>
                    <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Working Revision
                    </div>
                    <div className="mt-1 font-bold text-wk-text">
                      {workingRevision}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-wk-border px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="wk-button wk-button-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                sourceTypes.length === 0
              }
              className="wk-button wk-button-primary"
            >
              <WkIcon
                name={
                  submitting
                    ? "Loader2"
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
                : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
