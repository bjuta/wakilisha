import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  ArticleTrustServiceError,
  attachArticleVersionCredit,
  createCredit,
  createExternalContributor,
} from "@/services/articles/articleTrustService";

const CREDIT_ROLES = [
  ["author", "Author"],
  ["editor", "Editor"],
  ["curator", "Curator"],
  ["researcher", "Researcher"],
  ["interviewer", "Interviewer"],
  ["producer", "Producer"],
  ["host", "Host"],
  ["guest", "Guest"],
  ["camera", "Camera"],
  ["audio", "Audio"],
  ["translator", "Translator"],
  ["photographer", "Photographer"],
  ["contributor", "Contributor"],
  ["reviewer", "Reviewer"],
  ["fact_checker", "Fact checker"],
  ["other", "Other"],
] as const;

const CONSENT_STATUSES = [
  ["unknown", "Unknown"],
  ["not_required", "Not required"],
  ["requested", "Requested"],
  ["granted", "Granted"],
  ["limited", "Limited"],
  ["declined", "Declined"],
  ["withdrawn", "Withdrawn"],
] as const;

interface Props {
  articleVersionId: string;
  expectedCreditRevision: number;
  nextDisplayOrder: number;
  hasPrimaryAuthor: boolean;
  onClose: () => void;
  onAttached: () => void;
  onConcurrency: () => void;
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

export function ArticleCreditForm({
  articleVersionId,
  expectedCreditRevision,
  nextDisplayOrder,
  hasPrimaryAuthor,
  onClose,
  onAttached,
  onConcurrency,
}: Props) {
  const [displayName, setDisplayName] =
    useState("");
  const [publicRole, setPublicRole] =
    useState("");
  const [publicUrl, setPublicUrl] =
    useState("");
  const [locationText, setLocationText] =
    useState("");
  const [contactEmail, setContactEmail] =
    useState("");
  const [contactPhone, setContactPhone] =
    useState("");
  const [consentStatus, setConsentStatus] =
    useState("unknown");
  const [internalNotes, setInternalNotes] =
    useState("");
  const [creditRole, setCreditRole] =
    useState("contributor");
  const [roleLabelOverride, setRoleLabelOverride] =
    useState("");
  const [creditNote, setCreditNote] =
    useState("");
  const [publicPresentation, setPublicPresentation] =
    useState(false);
  const [isPrimary, setIsPrimary] =
    useState(false);
  const [createdContributorId, setCreatedContributorId] =
    useState<string | null>(null);
  const [createdCreditId, setCreatedCreditId] =
    useState<string | null>(null);
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const contributorLocked =
    createdContributorId !== null;
  const creditLocked =
    createdCreditId !== null;
  const publicConsentAllowed =
    consentStatus === "granted" ||
    consentStatus === "not_required";

  useEffect(() => {
    if (!publicConsentAllowed) {
      setPublicPresentation(false);
    }
  }, [publicConsentAllowed]);

  useEffect(() => {
    if (creditRole !== "author") {
      setIsPrimary(false);
    }
  }, [creditRole]);

  function requestClose() {
    if (
      (createdContributorId || createdCreditId) &&
      !window.confirm(
        "A contributor or Credit has already been created. Closing now will leave it unattached. Continue?",
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

    if (!articleVersionId.trim()) {
      setErrorMessage(
        "The current Article version is unavailable.",
      );
      return;
    }

    if (!createdContributorId && !displayName.trim()) {
      setErrorMessage(
        "External contributor display name is required.",
      );
      return;
    }

    if (!isHttpUrl(publicUrl)) {
      setErrorMessage(
        "Public URL must use HTTP or HTTPS.",
      );
      return;
    }

    if (isPrimary && creditRole !== "author") {
      setErrorMessage(
        "Only an Author Credit can be primary.",
      );
      return;
    }

    if (isPrimary && hasPrimaryAuthor) {
      setErrorMessage(
        "This Article version already has a primary author Credit.",
      );
      return;
    }

    if (
      publicPresentation &&
      !publicConsentAllowed
    ) {
      setErrorMessage(
        "Public presentation requires granted or not-required consent.",
      );
      return;
    }

    setSubmitting(true);

    try {
      let contributorId = createdContributorId;

      if (!contributorId) {
        const contributorResult =
          await createExternalContributor({
            p_display_name: displayName.trim(),
            p_consent_status: consentStatus,
            p_public_safe: publicPresentation,
            ...(publicRole.trim()
              ? {
                  p_public_role:
                    publicRole.trim(),
                }
              : {}),
            ...(publicUrl.trim()
              ? {
                  p_public_url:
                    publicUrl.trim(),
                }
              : {}),
            ...(locationText.trim()
              ? {
                  p_location_text:
                    locationText.trim(),
                }
              : {}),
            ...(contactEmail.trim()
              ? {
                  p_contact_email:
                    contactEmail.trim(),
                }
              : {}),
            ...(contactPhone.trim()
              ? {
                  p_contact_phone:
                    contactPhone.trim(),
                }
              : {}),
            ...(internalNotes.trim()
              ? {
                  p_internal_notes:
                    internalNotes.trim(),
                }
              : {}),
          });

        contributorId = requiredId(
          contributorResult,
          "external_contributor_id",
          "Contributor creation returned no identity.",
        );

        setCreatedContributorId(contributorId);
      }

      let creditId = createdCreditId;

      if (!creditId) {
        const creditResult = await createCredit({
          p_credit_role: creditRole,
          p_external_contributor_id:
            contributorId,
          p_public_safe: publicPresentation,
          ...(roleLabelOverride.trim()
            ? {
                p_role_label_override:
                  roleLabelOverride.trim(),
              }
            : {}),
          ...(creditNote.trim()
            ? {
                p_credit_note:
                  creditNote.trim(),
              }
            : {}),
        });

        creditId = requiredId(
          creditResult,
          "credit_id",
          "Credit creation returned no identity.",
        );

        setCreatedCreditId(creditId);
      }

      await attachArticleVersionCredit({
        p_article_version_id: articleVersionId,
        p_credit_id: creditId,
        p_display_order: nextDisplayOrder,
        p_is_primary: isPrimary,
        p_public_safe: publicPresentation,
        p_expected_credit_revision:
          expectedCreditRevision,
      });

      onAttached();
    } catch (error) {
      if (
        error instanceof
          ArticleTrustServiceError &&
        error.kind === "concurrency"
      ) {
        setErrorMessage(
          "The Credit revision changed while this form was open. Trust has been refreshed. Retry the attachment.",
        );
        onConcurrency();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The Credit could not be created and attached.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = createdCreditId
    ? "Attach Created Credit"
    : createdContributorId
      ? "Create Credit and Attach"
      : "Create and Attach Credit";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-credit-form-title"
    >
      <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-wk-border bg-wk-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
              Governed Credit
            </div>
            <h2
              id="article-credit-form-title"
              className="mt-1 text-[18px] font-bold text-wk-text"
            >
              Add an External Contributor Credit
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-wk-text-muted">
              This first mutation flow creates an external
              contributor, creates one immutable Credit, and
              attaches it to the current working Article version.
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className="wk-button wk-button-ghost wk-button-sm shrink-0"
            aria-label="Close Credit form"
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

            {createdContributorId ||
            createdCreditId ? (
              <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3">
                <div className="text-[11px] font-bold text-wk-text">
                  Partial progress is preserved
                </div>
                <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                  The form will reuse the contributor and Credit
                  already created. Retry attachment instead of
                  creating duplicate records.
                </p>
              </div>
            ) : null}

            <section>
              <div className="mb-3">
                <h3 className="text-[13px] font-bold text-wk-text">
                  Contributor identity
                </h3>
                <p className="mt-1 text-[10px] text-wk-text-muted">
                  Contact details and internal notes stay inside
                  the editorial Workspace.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Display name
                  </span>
                  <input
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    required={!contributorLocked}
                    className="wk-input mt-1 w-full"
                    placeholder="Contributor name"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Public role
                  </span>
                  <input
                    value={publicRole}
                    onChange={(event) =>
                      setPublicRole(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Writer, photographer, guest"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Location
                  </span>
                  <input
                    value={locationText}
                    onChange={(event) =>
                      setLocationText(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Nairobi, Kenya"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Public URL
                  </span>
                  <input
                    type="url"
                    value={publicUrl}
                    onChange={(event) =>
                      setPublicUrl(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="https://"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Contact email
                  </span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(event) =>
                      setContactEmail(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Internal only"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Contact phone
                  </span>
                  <input
                    value={contactPhone}
                    onChange={(event) =>
                      setContactPhone(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Internal only"
                  />
                </label>

                <label>
                  <span className="wk-label">
                    Consent status
                  </span>
                  <select
                    value={consentStatus}
                    onChange={(event) =>
                      setConsentStatus(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
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

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Internal notes
                  </span>
                  <textarea
                    value={internalNotes}
                    onChange={(event) =>
                      setInternalNotes(
                        event.target.value,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      submitting
                    }
                    rows={3}
                    className="wk-input mt-1 w-full resize-y"
                    placeholder="Private editorial context"
                  />
                </label>
              </div>
            </section>

            <section className="border-t border-wk-border pt-5">
              <div className="mb-3">
                <h3 className="text-[13px] font-bold text-wk-text">
                  Credit
                </h3>
                <p className="mt-1 text-[10px] text-wk-text-muted">
                  The Credit identity is immutable after creation.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="wk-label">
                    Credit role
                  </span>
                  <select
                    value={creditRole}
                    onChange={(event) =>
                      setCreditRole(
                        event.target.value,
                      )
                    }
                    disabled={
                      creditLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                  >
                    {CREDIT_ROLES.map(
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
                    Role label override
                  </span>
                  <input
                    value={roleLabelOverride}
                    onChange={(event) =>
                      setRoleLabelOverride(
                        event.target.value,
                      )
                    }
                    disabled={
                      creditLocked ||
                      submitting
                    }
                    className="wk-input mt-1 w-full"
                    placeholder="Optional display wording"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="wk-label">
                    Credit note
                  </span>
                  <textarea
                    value={creditNote}
                    onChange={(event) =>
                      setCreditNote(
                        event.target.value,
                      )
                    }
                    disabled={
                      creditLocked ||
                      submitting
                    }
                    rows={3}
                    className="wk-input mt-1 w-full resize-y"
                    placeholder="Describe the contribution"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                  <input
                    type="checkbox"
                    checked={publicPresentation}
                    onChange={(event) =>
                      setPublicPresentation(
                        event.target.checked,
                      )
                    }
                    disabled={
                      contributorLocked ||
                      creditLocked ||
                      submitting ||
                      !publicConsentAllowed
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[11px] font-bold text-wk-text">
                      Allow public presentation
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                      Requires granted or not-required consent.
                      The choice locks after contributor creation.
                      This does not create payment rights.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(event) =>
                      setIsPrimary(
                        event.target.checked,
                      )
                    }
                    disabled={
                      submitting ||
                      creditRole !== "author" ||
                      hasPrimaryAuthor
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[11px] font-bold text-wk-text">
                      Primary author
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                      Available only for an Author Credit when
                      no primary author is already attached.
                    </span>
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <div className="grid gap-3 text-[10px] sm:grid-cols-3">
                <div>
                  <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Working version
                  </div>
                  <div className="mt-1 break-all font-mono text-wk-text">
                    {articleVersionId}
                  </div>
                </div>

                <div>
                  <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Expected Credit revision
                  </div>
                  <div className="mt-1 font-bold text-wk-text">
                    {expectedCreditRevision}
                  </div>
                </div>

                <div>
                  <div className="font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Display order
                  </div>
                  <div className="mt-1 font-bold text-wk-text">
                    {nextDisplayOrder}
                  </div>
                </div>
              </div>
            </section>
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
              disabled={submitting}
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
                ? "Saving Credit"
                : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
