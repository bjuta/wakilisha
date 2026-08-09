import {
  Link,
} from "react-router-dom";

import {
  WkIcon,
} from "@/components/design-system/Icon";

export interface PublicTrustCreditItem {
  id: string;
  displayName: string;
  roleLabel: string;
  note: string | null;
  href: string | null;
  contextLabel: string | null;
}

export interface PublicTrustSourceItem {
  id: string;
  label: string;
  title: string;
  creator: string | null;
  publisher: string | null;
  url: string | null;
  publicationDate: string | null;
  creditLine: string | null;
  locatorLabel: string | null;
  contextLabel: string | null;
}

export interface PublicTrustCorrectionItem {
  id: string;
  note: string;
  publishedAt: string | null;
  contextLabel: string | null;
}

export interface PublicTrustProvenance {
  firstPublishedAt: string | null;
  publishedAt: string | null;
  versionNumber: number;
}

interface PublicTrustSummaryProps {
  provenance: PublicTrustProvenance;
  credits: PublicTrustCreditItem[];
  sources: PublicTrustSourceItem[];
  corrections: PublicTrustCorrectionItem[];
}

function formatPublicDate(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",
      month:
        "short",
      year:
        "numeric",
    },
  ).format(
    date,
  );
}

function CreditName({
  credit,
}: {
  credit: PublicTrustCreditItem;
}) {
  if (
    credit.href
  ) {
    return (
      <Link
        to={
          credit.href
        }
        className="font-extrabold text-[var(--wk-text)] transition-colors hover:text-[var(--wk-brand)] hover:underline"
      >
        {
          credit.displayName
        }
      </Link>
    );
  }

  return (
    <span className="font-extrabold text-[var(--wk-text)]">
      {
        credit.displayName
      }
    </span>
  );
}

export function PublicTrustSummary({
  provenance,
  credits,
  sources,
  corrections,
}: PublicTrustSummaryProps) {
  const firstPublished =
    formatPublicDate(
      provenance.firstPublishedAt,
    );

  const currentPublished =
    formatPublicDate(
      provenance.publishedAt,
    );

  const hasDifferentCurrentEdition =
    Boolean(
      firstPublished &&
      currentPublished &&
      provenance.firstPublishedAt !==
        provenance.publishedAt,
    );

  const hasRecord =
    Boolean(
      firstPublished ||
      currentPublished ||
      provenance.versionNumber >
        0 ||
      credits.length >
        0 ||
      sources.length >
        0 ||
      corrections.length >
        0,
    );

  if (
    !hasRecord
  ) {
    return null;
  }

  return (
    <section className="wk-container-wide px-5 pb-10 md:px-6 md:pb-14">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-start md:px-6">
            <div>
              <div className="wk-eyebrow mb-1.5">
                Record
              </div>

              <h2 className="text-[20px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                Publication record
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--wk-text-muted)]">
                {
                  firstPublished
                    ? (
                        <span>
                          Published{" "}
                          <strong className="font-bold text-[var(--wk-text-soft)]">
                            {
                              firstPublished
                            }
                          </strong>
                        </span>
                      )
                    : currentPublished
                      ? (
                          <span>
                            Published{" "}
                            <strong className="font-bold text-[var(--wk-text-soft)]">
                              {
                                currentPublished
                              }
                            </strong>
                          </span>
                        )
                      : null
                }

                {
                  hasDifferentCurrentEdition
                    ? (
                        <span>
                          Current edition{" "}
                          <strong className="font-bold text-[var(--wk-text-soft)]">
                            {
                              currentPublished
                            }
                          </strong>
                        </span>
                      )
                    : null
                }
              </div>
            </div>

            {
              provenance.versionNumber >
                0
                ? (
                    <div className="inline-flex w-fit items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-text-muted)]">
                      Version{" "}
                      {
                        provenance.versionNumber
                      }
                    </div>
                  )
                : null
            }
          </div>

          {
            corrections.length >
              0
              ? (
                  <div className="border-t border-[var(--wk-border)] bg-[var(--wk-brand-soft)]/35 px-5 py-5 md:px-6">
                    <div className="mb-3 flex items-center gap-2">
                      <WkIcon
                        name="FilePenLine"
                        size={
                          15
                        }
                        className="text-[var(--wk-brand)]"
                      />

                      <h3 className="text-[13px] font-black text-[var(--wk-text)]">
                        Corrections
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {
                        corrections.map(
                          (
                            correction,
                          ) => {
                            const date =
                              formatPublicDate(
                                correction.publishedAt,
                              );

                            return (
                              <div
                                key={
                                  correction.id
                                }
                                className="rounded-xl border border-[var(--wk-brand)]/15 bg-[var(--wk-surface)] px-4 py-3"
                              >
                                <p className="text-[13px] leading-6 text-[var(--wk-text-soft)]">
                                  {
                                    correction.note
                                  }
                                </p>

                                {
                                  correction.contextLabel ||
                                  date
                                    ? (
                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-[var(--wk-text-faint)]">
                                          {
                                            correction.contextLabel
                                              ? (
                                                  <span>
                                                    {
                                                      correction.contextLabel
                                                    }
                                                  </span>
                                                )
                                              : null
                                          }

                                          {
                                            date
                                              ? (
                                                  <span>
                                                    {
                                                      date
                                                    }
                                                  </span>
                                                )
                                              : null
                                          }
                                        </div>
                                      )
                                    : null
                                }
                              </div>
                            );
                          },
                        )
                      }
                    </div>
                  </div>
                )
              : null
          }

          {
            credits.length >
              0
              ? (
                  <div className="border-t border-[var(--wk-border)] px-5 py-5 md:px-6">
                    <h3 className="mb-3 text-[12px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">
                      Credits
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {
                        credits.map(
                          (
                            credit,
                          ) => (
                            <div
                              key={
                                credit.id
                              }
                              className="min-w-[180px] rounded-xl bg-[var(--wk-surface-raised)] px-3.5 py-3"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--wk-brand)]">
                                {
                                  credit.roleLabel
                                }
                              </div>

                              <div className="mt-1 text-[13px]">
                                <CreditName
                                  credit={
                                    credit
                                  }
                                />
                              </div>

                              {
                                credit.contextLabel
                                  ? (
                                      <div className="mt-1 text-[10px] font-semibold text-[var(--wk-text-faint)]">
                                        {
                                          credit.contextLabel
                                        }
                                      </div>
                                    )
                                  : null
                              }

                              {
                                credit.note
                                  ? (
                                      <p className="mt-2 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                                        {
                                          credit.note
                                        }
                                      </p>
                                    )
                                  : null
                              }
                            </div>
                          ),
                        )
                      }
                    </div>
                  </div>
                )
              : null
          }

          {
            sources.length >
              0
              ? (
                  <details className="group border-t border-[var(--wk-border)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2">
                        <WkIcon
                          name="Library"
                          size={
                            15
                          }
                          className="text-[var(--wk-brand)]"
                        />

                        <span className="text-[13px] font-black text-[var(--wk-text)]">
                          Sources
                        </span>

                        <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-text-muted)]">
                          {
                            sources.length
                          }
                        </span>
                      </div>

                      <WkIcon
                        name="ChevronDown"
                        size={
                          14
                        }
                        className="text-[var(--wk-text-faint)] transition-transform group-open:rotate-180"
                      />
                    </summary>

                    <div className="border-t border-[var(--wk-border)] px-5 py-2 md:px-6">
                      {
                        sources.map(
                          (
                            source,
                          ) => (
                            <div
                              key={
                                source.id
                              }
                              className="border-b border-[var(--wk-border)] py-4 last:border-b-0"
                            >
                              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                                <div className="min-w-0">
                                  {
                                    source.contextLabel
                                      ? (
                                          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--wk-brand)]">
                                            {
                                              source.contextLabel
                                            }
                                          </div>
                                        )
                                      : null
                                  }

                                  {
                                    source.url
                                      ? (
                                          <a
                                            href={
                                              source.url
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[13px] font-extrabold text-[var(--wk-text)] transition-colors hover:text-[var(--wk-brand)] hover:underline"
                                          >
                                            {
                                              source.label
                                            }
                                          </a>
                                        )
                                      : (
                                          <div className="text-[13px] font-extrabold text-[var(--wk-text)]">
                                            {
                                              source.label
                                            }
                                          </div>
                                        )
                                  }

                                  {
                                    source.label !==
                                    source.title
                                      ? (
                                          <div className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
                                            {
                                              source.title
                                            }
                                          </div>
                                        )
                                      : null
                                  }
                                </div>

                                {
                                  source.locatorLabel
                                    ? (
                                        <div className="w-fit self-start shrink-0 rounded-full bg-[var(--wk-surface-raised)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-text-muted)] sm:self-auto">
                                          {
                                            source.locatorLabel
                                          }
                                        </div>
                                      )
                                    : null
                                }
                              </div>

                              {
                                source.creator ||
                                source.publisher ||
                                source.publicationDate
                                  ? (
                                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--wk-text-faint)]">
                                        {
                                          source.creator
                                            ? (
                                                <span>
                                                  {
                                                    source.creator
                                                  }
                                                </span>
                                              )
                                            : null
                                        }

                                        {
                                          source.publisher
                                            ? (
                                                <span>
                                                  {
                                                    source.publisher
                                                  }
                                                </span>
                                              )
                                            : null
                                        }

                                        {
                                          source.publicationDate
                                            ? (
                                                <span>
                                                  {
                                                    formatPublicDate(
                                                      source.publicationDate,
                                                    ) ??
                                                    source.publicationDate
                                                  }
                                                </span>
                                              )
                                            : null
                                        }
                                      </div>
                                    )
                                  : null
                              }

                              {
                                source.creditLine
                                  ? (
                                      <div className="mt-2 text-[10px] italic text-[var(--wk-text-faint)]">
                                        {
                                          source.creditLine
                                        }
                                      </div>
                                    )
                                  : null
                              }
                            </div>
                          ),
                        )
                      }
                    </div>
                  </details>
                )
              : null
          }
        </div>
      </div>
    </section>
  );
}
