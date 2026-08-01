import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { useAdminUser } from "@/hooks/useAdminUser";
import { ArticleCreditForm } from "./ArticleCreditForm";
import type {
  ArticleTrustCitation,
  ArticleTrustCredit,
} from "@/services/articles/articleTrustService";
import type {
  ArticleTrustWorkspaceState,
} from "../hooks/useArticleTrustWorkspace";

interface Props {
  state: ArticleTrustWorkspaceState;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function externalHttpUrl(
  value: string | null,
): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function citationEligibilityExplanation(
  citation: ArticleTrustCitation,
): string {
  if (citation.publiclyEligible) {
    return "Eligible for public presentation.";
  }

  if (!citation.attachmentPublicSafe) {
    return "This Article attachment is internal only.";
  }

  if (!citation.citationPublicSafe) {
    return "The Citation is not marked public-safe.";
  }

  if (citation.citationState !== "active") {
    return "The Citation is not active.";
  }

  if (citation.sourceState !== "active") {
    return "The Source is withdrawn or inactive.";
  }

  if (citation.sourceReviewStatus !== "approved") {
    return "The Source version is not approved.";
  }

  if (
    citation.sourceExposureClass !== "public"
  ) {
    return "The Source exposure class is not public.";
  }

  if (!citation.sourceCurrentApprovedVersionId) {
    return "The Source has no approved current version.";
  }

  return "A public eligibility requirement is incomplete.";
}

function creditEligibilityExplanation(
  credit: ArticleTrustCredit,
): string {
  if (credit.publiclyEligible) {
    return "Eligible for public presentation.";
  }

  if (!credit.attachmentPublicSafe) {
    return "This Article attachment is internal only.";
  }

  if (!credit.governancePublicSafe) {
    return "The Credit is not governed as public-safe.";
  }

  if (credit.creditState !== "active") {
    return "The Credit is inactive.";
  }

  if (
    credit.contributorKind ===
      "external_contributor" &&
    credit.externalContributorState !== "active"
  ) {
    return "The external contributor is inactive.";
  }

  if (
    credit.contributorKind ===
      "external_contributor" &&
    credit.externalContributorPublicSafe !== true
  ) {
    return "The external contributor is not public-safe.";
  }

  return "A public eligibility requirement is incomplete.";
}

function EligibilityBadge({
  eligible,
}: {
  eligible: boolean;
}) {
  return (
    <span
      className={
        eligible
          ? "inline-flex items-center gap-1 rounded-full bg-wk-success-soft px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-wk-success"
          : "inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-wk-warning"
      }
    >
      <WkIcon
        name={
          eligible
            ? "ShieldCheck"
            : "ShieldAlert"
        }
        size={12}
      />
      {eligible
        ? "Publicly Eligible"
        : "Not Publicly Eligible"}
    </span>
  );
}

function VersionContext({
  state,
}: Props) {
  const { identity, workspace } = state;

  if (!identity || !workspace) return null;

  return (
    <section className="grid gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Working Version
        </div>
        <div className="mt-1 text-[14px] font-bold text-wk-text">
          {identity.workingVersionNumber}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Version Kind
        </div>
        <div className="mt-1 text-[12px] font-bold text-wk-text">
          {humanize(identity.workingVersionKind)}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Draft Version
        </div>
        <div className="mt-1 text-[14px] font-bold text-wk-text">
          {identity.articleDraftVersion}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Citation Revision
        </div>
        <div className="mt-1 text-[14px] font-bold text-wk-text">
          {workspace.citationRevision}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Credit Revision
        </div>
        <div className="mt-1 text-[14px] font-bold text-wk-text">
          {workspace.creditRevision}
        </div>
      </div>
    </section>
  );
}

function CitationCard({
  citation,
}: {
  citation: ArticleTrustCitation;
}) {
  const sourceHref = externalHttpUrl(
    citation.sourceUrl,
  );

  return (
    <article className="rounded-xl border border-wk-border bg-wk-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-info">
            {humanize(citation.sourceType || "Source")}
          </div>
          <h3 className="mt-1 text-[14px] font-bold leading-5 text-wk-text">
            {citation.sourceTitle || "Untitled Source"}
          </h3>
          <p className="mt-1 text-[11px] text-wk-text-muted">
            {humanize(
              citation.citationPurpose || "Reference",
            )}
            {" · "}
            {humanize(
              citation.locatorType || "Document",
            )}
          </p>
        </div>

        <EligibilityBadge
          eligible={citation.publiclyEligible}
        />
      </div>

      <div className="mt-4 grid gap-3 text-[11px] sm:grid-cols-2">
        <div>
          <div className="font-bold text-wk-text-faint">
            Creator or Publisher
          </div>
          <div className="mt-1 text-wk-text">
            {citation.creatorDisplay ||
              citation.publisherDisplay ||
              "Not recorded"}
          </div>
        </div>

        <div>
          <div className="font-bold text-wk-text-faint">
            Rights and Consent
          </div>
          <div className="mt-1 text-wk-text">
            {humanize(citation.rightsStatus)}
            {" · "}
            {humanize(citation.consentStatus)}
          </div>
        </div>

        <div>
          <div className="font-bold text-wk-text-faint">
            Source Review
          </div>
          <div className="mt-1 text-wk-text">
            {humanize(citation.sourceReviewStatus)}
            {" · "}
            {humanize(citation.sourceState)}
          </div>
        </div>

        <div>
          <div className="font-bold text-wk-text-faint">
            Sensitivity
          </div>
          <div className="mt-1 text-wk-text">
            {humanize(citation.sensitivity)}
          </div>
        </div>
      </div>

      {sourceHref ? (
        <a
          href={sourceHref}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-wk-brand hover:underline"
        >
          <WkIcon name="ExternalLink" size={12} />
          Open Source
        </a>
      ) : null}

      <p className="mt-4 rounded-lg bg-wk-bg-subtle px-3 py-2 text-[10px] leading-4 text-wk-text-muted">
        {citationEligibilityExplanation(citation)}
        {" "}
        Citation does not grant reuse permission.
      </p>
    </article>
  );
}

function CreditCard({
  credit,
}: {
  credit: ArticleTrustCredit;
}) {
  const primaryAuthor =
    credit.isPrimary &&
    credit.creditRole === "author";

  return (
    <article className="rounded-xl border border-wk-border bg-wk-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-bold text-wk-text">
              {credit.displayNameSnapshot ||
                "Unnamed Contributor"}
            </h3>

            {primaryAuthor ? (
              <span className="rounded-full bg-wk-brand-soft px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-wk-brand">
                Primary Author
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-[11px] text-wk-text-muted">
            {credit.roleLabelSnapshot ||
              humanize(credit.creditRole)}
            {" · "}
            {humanize(credit.contributorKind)}
          </p>
        </div>

        <EligibilityBadge
          eligible={credit.publiclyEligible}
        />
      </div>

      {credit.creditNote ? (
        <p className="mt-3 text-[11px] leading-5 text-wk-text-muted">
          {credit.creditNote}
        </p>
      ) : null}

      <p className="mt-4 rounded-lg bg-wk-bg-subtle px-3 py-2 text-[10px] leading-4 text-wk-text-muted">
        {creditEligibilityExplanation(credit)}
        {" "}
        Credit does not determine payment or payout rights.
      </p>
    </article>
  );
}

export function ArticleTrustPanel({
  state,
}: Props) {
  const {
    identity,
    workspace,
    loading,
    errorMessage,
    errorKind,
    refresh,
  } = state;

  const adminUser = useAdminUser();
  const [creditFormOpen, setCreditFormOpen] =
    useState(false);
  const canManageCredits =
    adminUser.can("manage_credits");
  const hasPrimaryAuthor =
    workspace?.credits.some(
      (credit) =>
        credit.isPrimary &&
        credit.creditRole === "author",
    ) ?? false;

  return (
    <div
      data-article-trust-panel
      className="w-full max-w-6xl space-y-5"
    >
      <header className="flex flex-col gap-3 rounded-xl border border-wk-border bg-wk-surface p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-wk-brand">
            <WkIcon name="BookOpenCheck" size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.14em]">
              Article Trust
            </span>
          </div>

          <h2 className="mt-2 text-[18px] font-bold text-wk-text">
            Sources, Citations and Credits
          </h2>

          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-wk-text-muted">
            This panel is bound to the current working Article
            version. Citation and Credit revisions move
            independently.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canManageCredits &&
          identity &&
          workspace ? (
            <button
              type="button"
              onClick={() =>
                setCreditFormOpen(true)
              }
              disabled={loading}
              className="wk-button wk-button-primary wk-button-sm"
            >
              <WkIcon name="Plus" size={14} />
              Add Credit
            </button>
          ) : null}

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="wk-button wk-button-secondary wk-button-sm"
          >
            <WkIcon
              name="RefreshCw"
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : undefined
              }
            />
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-wk-border bg-wk-surface px-5 py-10 text-center">
          <WkIcon
            name="Loader2"
            size={20}
            className="mx-auto animate-spin text-wk-brand"
          />
          <p className="mt-3 text-[12px] font-bold text-wk-text">
            Loading Article trust
          </p>
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-4">
          <div className="flex items-start gap-3">
            <WkIcon
              name="TriangleAlert"
              size={18}
              className="mt-0.5 shrink-0 text-wk-warning"
            />
            <div>
              <h3 className="text-[13px] font-bold text-wk-text">
                {errorKind === "concurrency"
                  ? "The working version changed"
                  : "Article trust could not be loaded"}
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={refresh}
                className="wk-button wk-button-secondary wk-button-sm mt-3"
              >
                Reload Trust
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading &&
      !errorMessage &&
      identity &&
      workspace ? (
        <>
          <VersionContext state={state} />

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-wk-text">
                  Sources and Citations
                </h2>
                <p className="mt-1 text-[10px] text-wk-text-muted">
                  {workspace.citations.length} attached to this
                  working version
                </p>
              </div>
            </div>

            {workspace.citations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-wk-border bg-wk-surface px-5 py-8 text-center">
                <WkIcon
                  name="Library"
                  size={22}
                  className="mx-auto text-wk-text-faint"
                />
                <p className="mt-3 text-[12px] font-bold text-wk-text">
                  No Sources or Citations
                </p>
                <p className="mt-1 text-[10px] text-wk-text-muted">
                  This working Article version has no attached
                  Citations.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {workspace.citations.map((citation) => (
                  <CitationCard
                    key={citation.attachmentId}
                    citation={citation}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-wk-text">
                  Credits
                </h2>
                <p className="mt-1 text-[10px] text-wk-text-muted">
                  {workspace.credits.length} attached to this
                  working version
                </p>
              </div>
            </div>

            {workspace.credits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-wk-border bg-wk-surface px-5 py-8 text-center">
                <WkIcon
                  name="UsersRound"
                  size={22}
                  className="mx-auto text-wk-text-faint"
                />
                <p className="mt-3 text-[12px] font-bold text-wk-text">
                  No Governed Credits
                </p>
                <p className="mt-1 text-[10px] text-wk-text-muted">
                  The legacy Article byline remains the fallback
                  until governed Credits are attached.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {workspace.credits.map((credit) => (
                  <CreditCard
                    key={credit.attachmentId}
                    credit={credit}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {creditFormOpen &&
      identity &&
      workspace ? (
        <ArticleCreditForm
          articleVersionId={
            identity.workingVersionId
          }
          expectedCreditRevision={
            workspace.creditRevision
          }
          nextDisplayOrder={
            workspace.credits.length
          }
          hasPrimaryAuthor={
            hasPrimaryAuthor
          }
          onClose={() =>
            setCreditFormOpen(false)
          }
          onAttached={() => {
            setCreditFormOpen(false);
            refresh();
          }}
          onConcurrency={refresh}
        />
      ) : null}
    </div>
  );
}
