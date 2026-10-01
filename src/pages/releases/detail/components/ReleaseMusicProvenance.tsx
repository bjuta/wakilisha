import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { WkIcon } from "@/components/design-system/Icon";
import { trackMusicProvenanceEvent } from "@/services/analytics";
import type {
  PublicMusicContribution,
} from "@/services/publicApi/types";
import type {
  PublicReleaseDetail,
  PublicReleaseTrackProvenance,
} from "@/services/publicContent/client";
import { canonicalTrackUrl } from "@/utils/trackUrl";

function contributionName(
  credit: PublicMusicContribution,
): string {
  return (
    credit.creditedName ||
    credit.resolvedEntity?.name ||
    "Contributor"
  );
}

function ContributionRow({
  credit,
}: {
  credit: PublicMusicContribution;
}) {
  const href =
    credit.resolvedEntity?.path || null;
  const name = contributionName(credit);

  const body = (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
          {credit.roleLabel}
        </div>
        <div className="mt-1 truncate text-[13px] font-extrabold text-[var(--wk-text)]">
          {name}
        </div>
        {(credit.instrument ||
          credit.detail) && (
          <div className="mt-1 text-[10px] font-semibold text-[var(--wk-text-muted)]">
            {[
              credit.instrument,
              credit.detail,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>
      {href ? (
        <WkIcon
          name="ArrowUpRight"
          size={12}
          className="mt-1 shrink-0 text-[var(--wk-text-faint)]"
        />
      ) : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link
      to={href}
      onClick={() =>
        trackMusicProvenanceEvent(
          "contributor_opened",
          {
            surface: "release",
            contributorKind:
              credit.resolvedEntity?.kind,
          },
        )
      }
      className="block border-t border-[var(--wk-divider)] first:border-t-0 hover:text-[var(--wk-brand)]"
    >
      {body}
    </Link>
  );
}

function CreditColumn({
  title,
  credits,
}: {
  title: string;
  credits: PublicMusicContribution[];
}) {
  if (credits.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-brand)]">
        {title}
      </div>
      <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3">
        {credits.map((credit) => (
          <ContributionRow
            key={credit.id}
            credit={credit}
          />
        ))}
      </div>
    </div>
  );
}

function trackHref(
  track: PublicReleaseTrackProvenance,
): string | null {
  if (
    !track.artistSlug ||
    !track.trackSlug
  ) {
    return null;
  }

  return canonicalTrackUrl(
    track.artistSlug,
    track.trackSlug,
  );
}

export default function ReleaseMusicProvenance({
  release,
}: {
  release: PublicReleaseDetail;
}) {
  const [receiptOpen, setReceiptOpen] =
    useState(false);

  const provenance =
    release.musicProvenance;

  const creditedTracks = useMemo(
    () =>
      (provenance?.tracks || []).filter(
        (track) =>
          track.recordingContributions
            .length > 0 ||
          track.works.some(
            (work) =>
              work.contributions.length > 0,
          ),
      ),
    [provenance],
  );

  const hasCredits =
    Boolean(
      provenance?.hasCanonicalCredits,
    );

  useEffect(() => {
    trackMusicProvenanceEvent(
      "credits_section_viewed",
      {
        surface: "release",
        hasCanonicalCredits:
          hasCredits,
        recordingCreditCount:
          provenance?.recordingCreditCount ||
          0,
        workCreditCount:
          provenance?.workCreditCount || 0,
      },
    );
  }, [
    release.id,
    hasCredits,
    provenance?.recordingCreditCount,
    provenance?.workCreditCount,
  ]);

  return (
    <section
      aria-labelledby="release-credits-heading"
      className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6"
      data-wk-release-provenance
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            Credits & people
          </div>
          <h2
            id="release-credits-heading"
            className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] md:text-[24px]"
          >
            Who worked on this release
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-[var(--wk-text-muted)]">
            Credits stay attached to the recording or Musical Work they belong to.
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-faint)]">
            Release Artist billing is separate from contribution roles.
          </p>
        </div>

        {hasCredits ? (
          <button
            type="button"
            onClick={() => {
              trackMusicProvenanceEvent(
                "credits_expanded",
                {
                  surface: "release",
                  hasCanonicalCredits: true,
                  recordingCreditCount:
                    provenance
                      .recordingCreditCount,
                  workCreditCount:
                    provenance.workCreditCount,
                },
              );
              trackMusicProvenanceEvent(
                "provenance_opened",
                {
                  surface: "release",
                  hasCanonicalCredits: true,
                },
              );
              setReceiptOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] font-bold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)]"
          >
            <WkIcon
              name="Info"
              size={13}
            />
            How we know this
          </button>
        ) : null}
      </div>

      {creditedTracks.length > 0 ? (
        <div className="mt-5 space-y-4">
          {creditedTracks.map((track) => {
            const href =
              trackHref(track);
            const workCredits =
              track.works.flatMap(
                (work) =>
                  work.contributions,
              );

            return (
              <article
                key={track.trackId}
                className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4"
                data-wk-release-provenance-track={track.trackId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                      Track
                    </div>
                    {href ? (
                      <Link
                        to={href}
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[15px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
                      >
                        <span className="truncate">
                          {track.title}
                        </span>
                        <WkIcon
                          name="ArrowUpRight"
                          size={12}
                        />
                      </Link>
                    ) : (
                      <div className="mt-1 truncate text-[15px] font-black text-[var(--wk-text)]">
                        {track.title}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <CreditColumn
                    title="Recording credits"
                    credits={
                      track.recordingContributions
                    }
                  />
                  <CreditColumn
                    title="Songwriting and work credits"
                    credits={workCredits}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
          <p className="max-w-2xl text-[13px] font-semibold leading-6 text-[var(--wk-text-muted)]">
            No confirmed contributor credits are public for these recordings yet.
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[var(--wk-text-faint)]">
            Open a Track to add or correct a credit.
          </p>
        </div>
      )}

      <Sheet
        open={receiptOpen}
        onClose={() =>
          setReceiptOpen(false)
        }
        title="How we know this"
        side="bottom"
        bodyClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]"
      >
        <div className="space-y-4">
          <p className="text-[14px] font-semibold leading-6 text-[var(--wk-text)]">
            These credits come from reviewed Track and Musical Work contribution records.
          </p>
          <p className="text-[12px] leading-5 text-[var(--wk-text-muted)]">
            WAKILISHA does not infer contribution from Release Artist billing.
          </p>
          <div className="space-y-3">
            {creditedTracks
              .filter(
                (track) =>
                  track.provenanceReceipt
                    ?.summary,
              )
              .map((track) => (
                <div
                  key={track.trackId}
                  className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
                >
                  <div className="text-[11px] font-black text-[var(--wk-text)]">
                    {track.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                    {
                      track
                        .provenanceReceipt
                        ?.summary
                    }
                  </p>
                </div>
              ))}
          </div>
          <p className="text-[12px] leading-5 text-[var(--wk-text-muted)]">
            Pending claims and unresolved identity suggestions are not shown publicly.
          </p>
        </div>
      </Sheet>
    </section>
  );
}
