import {
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  ArticleTrustServiceError,
  setCreditGovernance,
  type ArticleTrustCredit,
} from "@/services/articles/articleTrustService";

const CREDIT_STATES = [
  ["active", "Active"],
  ["withdrawn", "Withdrawn"],
  ["archived", "Archived"],
] as const;

type CreditState =
  (typeof CREDIT_STATES)[number][0];

interface Props {
  credit: ArticleTrustCredit;
  versionLabel: string;
  onClose: () => void;
  onChanged: () => void;
  onConcurrency: () => void;
}

function normalizedState(
  value: string,
): CreditState {
  return CREDIT_STATES.some(
    ([candidate]) => candidate === value,
  )
    ? (value as CreditState)
    : "active";
}

export function ArticleCreditGovernanceForm({
  credit,
  versionLabel,
  onClose,
  onChanged,
  onConcurrency,
}: Props) {
  const [creditState, setCreditState] =
    useState<CreditState>(
      normalizedState(credit.creditState),
    );
  const [publicSafe, setPublicSafe] =
    useState(credit.governancePublicSafe);
  const [reason, setReason] =
    useState(credit.governanceReason ?? "");
  const [submitting, setSubmitting] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const reasonRequired =
    creditState === "withdrawn" ||
    creditState === "archived";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage(null);

    if (reasonRequired && !reason.trim()) {
      setErrorMessage(
        "A reason is required for Credit withdrawal or archival.",
      );
      return;
    }

    setSubmitting(true);

    try {
      await setCreditGovernance({
        p_credit_id: credit.creditId,
        p_credit_state: creditState,
        p_public_safe: publicSafe,
        p_expected_governance_revision:
          credit.governanceRevision,
        ...(reason.trim()
          ? {
              p_reason: reason.trim(),
            }
          : {}),
      });

      onChanged();
    } catch (error) {
      if (
        error instanceof ArticleTrustServiceError &&
        error.kind === "concurrency"
      ) {
        setErrorMessage(
          "Credit governance changed while this form was open. Trust has been refreshed. Reopen the Credit and retry.",
        );
        onConcurrency();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Credit governance could not be updated.",
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
      aria-labelledby="credit-governance-title"
    >
      <div className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-wk-border bg-wk-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
              Governed Credit
            </div>
            <h2
              id="credit-governance-title"
              className="mt-1 text-[18px] font-bold text-wk-text"
            >
              Manage Credit Governance
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
              {credit.displayNameSnapshot}
              {" · "}
              {versionLabel}
              {" · Governance revision "}
              {credit.governanceRevision}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="wk-button wk-button-ghost wk-button-sm shrink-0"
            aria-label="Close Credit governance form"
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

            <section>
              <label
                htmlFor="credit-governance-state"
                className="text-[11px] font-bold text-wk-text"
              >
                Credit state
              </label>
              <select
                id="credit-governance-state"
                value={creditState}
                onChange={(event) =>
                  setCreditState(
                    event.target.value as CreditState,
                  )
                }
                disabled={submitting}
                className="wk-input mt-2 w-full"
              >
                {CREDIT_STATES.map(
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
              <p className="mt-2 text-[10px] leading-4 text-wk-text-muted">
                Withdrawn and archived Credits remain in editorial history but are not publicly eligible.
              </p>
            </section>

            <label className="flex items-start gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <input
                type="checkbox"
                checked={publicSafe}
                onChange={(event) =>
                  setPublicSafe(event.target.checked)
                }
                disabled={submitting}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[11px] font-bold text-wk-text">
                  Governed as public-safe
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-wk-text-muted">
                  Public-safe governance is necessary but not sufficient. The Credit attachment, state and contributor must also remain eligible.
                </span>
              </span>
            </label>

            <section>
              <label
                htmlFor="credit-governance-reason"
                className="text-[11px] font-bold text-wk-text"
              >
                Governance reason
                {reasonRequired ? " *" : ""}
              </label>
              <textarea
                id="credit-governance-reason"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                disabled={submitting}
                rows={4}
                className="wk-input mt-2 w-full resize-y"
                placeholder={
                  reasonRequired
                    ? "Record why this Credit is being withdrawn or archived."
                    : "Optional reason for this governance change."
                }
              />
            </section>

            <div className="rounded-xl border border-wk-info/25 bg-wk-info-soft px-4 py-3 text-[10px] leading-4 text-wk-text-muted">
              Credit governance changes public eligibility without changing Article attachment order, primary-author selection or Article Credit revision. Credit does not determine payment or payout rights.
            </div>
          </div>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-wk-border px-5 py-4">
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
              {submitting ? (
                <WkIcon
                  name="Loader2"
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <WkIcon name="ShieldCheck" size={14} />
              )}
              Save Governance
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
