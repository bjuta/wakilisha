import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  PublicMusicContribution,
  PublicProvenanceReceipt,
  PublicTrackWorkProvenance,
} from "@/services/publicApi/types";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { WkIcon } from "@/components/design-system/Icon";
import { trackMusicProvenanceEvent } from "@/services/analytics";

function creditHref(credit: PublicMusicContribution): string | null {
  return credit.resolvedEntity?.path || null;
}

function CreditRow({ credit }: { credit: PublicMusicContribution }) {
  const href = creditHref(credit);
  const name = credit.creditedName || credit.resolvedEntity?.name || "Contributor";

  return (
    <div className="flex items-start justify-between gap-4 border-t border-[var(--wk-divider)] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
          {credit.roleLabel}
        </div>
        {href ? (
          <Link
            to={href}
            onClick={() =>
              trackMusicProvenanceEvent(
                "contributor_opened",
                {
                  surface: "track",
                  contributorKind:
                    credit.resolvedEntity?.kind,
                },
              )
            }
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[14px] font-extrabold text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
          >
            <span className="truncate">{name}</span>
            <WkIcon name="ArrowUpRight" size={12} />
          </Link>
        ) : (
          <div className="mt-1 truncate text-[14px] font-extrabold text-[var(--wk-text)]">
            {name}
          </div>
        )}
        {(credit.instrument || credit.detail) && (
          <div className="mt-1 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            {[credit.instrument, credit.detail].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function CreditGroup({
  title,
  credits,
}: {
  title: string;
  credits: PublicMusicContribution[];
}) {
  if (credits.length === 0) return null;

  return (
    <div>
      <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
        {title}
      </div>
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
        {credits.map((credit) => (
          <CreditRow key={credit.id} credit={credit} />
        ))}
      </div>
    </div>
  );
}

export default function TrackCreditsSection({
  trackId,
  recordingContributions,
  works,
  provenanceReceipt,
}: {
  trackId: string;
  recordingContributions: PublicMusicContribution[];
  works: PublicTrackWorkProvenance[];
  provenanceReceipt: PublicProvenanceReceipt | null;
}) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const workCredits = works.flatMap((work) => work.contributions);
  const hasCredits =
    recordingContributions.length > 0 ||
    workCredits.length > 0;

  useEffect(() => {
    trackMusicProvenanceEvent(
      "credits_section_viewed",
      {
        surface: "track",
        subjectKind: "track",
        hasCanonicalCredits: hasCredits,
        recordingCreditCount:
          recordingContributions.length,
        workCreditCount:
          workCredits.length,
      },
    );
  }, [
    trackId,
    hasCredits,
    recordingContributions.length,
    workCredits.length,
  ]);

  return (
    <section
      aria-labelledby="track-credits-heading"
      className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            Credits
          </div>
          <h2
            id="track-credits-heading"
            className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] md:text-[24px]"
          >
            Who worked on this
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasCredits ? (
            <button
              type="button"
              onClick={() => {
                trackMusicProvenanceEvent(
                  "credits_expanded",
                  {
                    surface: "track",
                    subjectKind: "track",
                    hasCanonicalCredits: true,
                    recordingCreditCount:
                      recordingContributions.length,
                    workCreditCount:
                      workCredits.length,
                  },
                );
                trackMusicProvenanceEvent(
                  "provenance_opened",
                  {
                    surface: "track",
                    subjectKind: "track",
                    hasCanonicalCredits: true,
                  },
                );
                setReceiptOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] font-bold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)]"
            >
              <WkIcon name="Info" size={13} />
              How we know this
            </button>
          ) : null}
          <Link
            to={`/credits?track_id=${encodeURIComponent(trackId)}&claim=1`}
            onClick={() =>
              trackMusicProvenanceEvent(
                "credit_claim_started",
                {
                  surface: "track",
                  subjectKind: "track",
                },
              )
            }
            className="inline-flex items-center justify-center rounded-xl bg-[var(--wk-brand)] px-3 py-2 text-[12px] font-extrabold text-[var(--wk-brand-on)] transition-opacity hover:opacity-90"
          >
            I worked on this
          </Link>
        </div>
      </div>

      {hasCredits ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <CreditGroup
            title="Recording credits"
            credits={recordingContributions}
          />
          <CreditGroup
            title="Songwriting and work credits"
            credits={workCredits}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
          <p className="max-w-xl text-[13px] font-semibold leading-6 text-[var(--wk-text-muted)]">
            Credits for this recording have not been confirmed yet.
          </p>
        </div>
      )}

      <Sheet
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="How we know this"
        side="bottom"
        bodyClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]"
      >
        <div className="space-y-4">
          <p className="text-[14px] font-semibold leading-6 text-[var(--wk-text)]">
            {provenanceReceipt?.summary ||
              "These credits are shown from WAKILISHA’s reviewed contribution records."}
          </p>
          {provenanceReceipt?.lastCheckedAt && (
            <p className="text-[12px] font-semibold text-[var(--wk-text-muted)]">
              Last checked{" "}
              {new Date(provenanceReceipt.lastCheckedAt).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" },
              )}
            </p>
          )}
          <p className="text-[12px] leading-5 text-[var(--wk-text-muted)]">
            Pending claims and unresolved identity suggestions are not shown publicly.
          </p>
        </div>
      </Sheet>
    </section>
  );
}
