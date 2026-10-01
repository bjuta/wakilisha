import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";
import { ClaimComposer } from "@/components/music/ClaimComposer";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkIcon } from "@/components/design-system/Icon";
import { MetaTags } from "@/components/seo/MetaTags";
import { trackMusicProvenanceEvent } from "@/services/analytics";
import {
  getMyMusicCredits,
  setMyMusicCreditPermission,
  transitionMyMusicCreditAttestation,
  type MusicCreditPermissionItem,
  type MusicCreditsWorkspace,
  type MusicCreditWorkspaceItem,
} from "@/services/musicProvenance";

function statusLabel(state: string): string {
  const labels: Record<string, string> = {
    asserted: "Pending",
    under_review: "In review",
    corroborated: "In review",
    confirmed: "Confirmed",
    canonical: "Verified",
    disputed: "Disputed",
    withdrawn: "Withdrawn",
    superseded: "Updated",
    pending: "Needs response",
  };
  return labels[state] || state.replace(/_/g, " ");
}

function CreditSubject({
  item,
}: {
  item: MusicCreditWorkspaceItem;
}) {
  const subject = item.subject;
  if (!subject) return null;

  const body = (
    <>
      {subject.artworkUrl ? (
        <img
          src={subject.artworkUrl}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)] text-[var(--wk-brand)]">
          <WkIcon name="Music" size={18} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-black text-[var(--wk-text)]">
          {subject.title}
        </span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
          {subject.kind}
        </span>
      </span>
    </>
  );

  if (subject.path) {
    return (
      <Link
        to={subject.path}
        className="flex min-w-0 items-center gap-3 hover:opacity-80"
      >
        {body}
      </Link>
    );
  }

  return <div className="flex min-w-0 items-center gap-3">{body}</div>;
}

function WorkspaceCard({
  item,
  onRefresh,
}: {
  item: MusicCreditWorkspaceItem;
  onRefresh: () => void | Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const canChange =
    Boolean(item.attestationId)
    && !["canonical", "withdrawn", "superseded"].includes(item.state);

  async function transition(action: "withdrawn" | "disputed") {
    if (!item.attestationId || working) return;
    setWorking(true);
    try {
      await transitionMyMusicCreditAttestation(
        item.attestationId,
        action,
        action === "withdrawn"
          ? "Creator withdrew this credit."
          : "Creator disputed this credit.",
      );
      if (action === "disputed") {
        trackMusicProvenanceEvent(
          "credit_disputed",
          {
            surface: "your_credits",
            subjectKind:
              item.subject?.kind,
            outcome: "disputed",
          },
        );
      }
      await onRefresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CreditSubject item={item} />
        <span className="rounded-full bg-[var(--wk-bg)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
          {statusLabel(item.state)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-black text-[var(--wk-text)]">
          {item.roleLabel || "Credit"}
        </span>
        {item.instrument ? (
          <span className="text-[var(--wk-text-muted)]">· {item.instrument}</span>
        ) : null}
        {item.creditedAs ? (
          <span className="text-[var(--wk-text-muted)]">· {item.creditedAs}</span>
        ) : null}
      </div>

      {item.inviter?.name ? (
        <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">
          Requested by {item.inviter.name}
        </p>
      ) : null}

      {item.canonicalPath ? (
        <Link
          to={item.canonicalPath}
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-black text-[var(--wk-brand)]"
        >
          Respond
          <WkIcon name="ArrowRight" size={12} />
        </Link>
      ) : null}

      {canChange ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.state !== "disputed" ? (
            <button
              type="button"
              disabled={working}
              onClick={() => void transition("disputed")}
              className="rounded-lg border border-[var(--wk-border)] px-3 py-2 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
            >
              Dispute
            </button>
          ) : null}
          <button
            type="button"
            disabled={working}
            onClick={() => void transition("withdrawn")}
            className="rounded-lg border border-[var(--wk-border)] px-3 py-2 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
          >
            Withdraw assertion
          </button>
        </div>
      ) : null}
    </article>
  );
}

function PermissionCard({
  item,
  onRefresh,
}: {
  item: MusicCreditPermissionItem;
  onRefresh: () => void | Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const permission = item.permission;

  async function update(
    next: Partial<{
      publicDisplay: boolean;
      thirdPartyCommercialReuse: boolean;
    }>,
  ) {
    if (working) return;
    setWorking(true);
    try {
      await setMyMusicCreditPermission(item, next);
      await onRefresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-black text-[var(--wk-text)]">
            {item.roleLabel}
          </div>
          <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
            {item.subject?.title || "Credit"}
          </div>
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
          Sharing
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          role="switch"
          aria-checked={permission.publicDisplay}
          disabled={working}
          onClick={() =>
            void update({
              publicDisplay: !permission.publicDisplay,
            })
          }
          className="flex w-full items-center justify-between rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-3 text-left disabled:opacity-60"
        >
          <span>
            <span className="block text-[11px] font-black text-[var(--wk-text)]">
              Show this credit publicly
            </span>
            <span className="mt-0.5 block text-[10px] text-[var(--wk-text-muted)]">
              Turn this on to show the credit on WAKILISHA.
            </span>
          </span>
          <span
            className={[
              "relative h-6 w-11 shrink-0 rounded-full",
              permission.publicDisplay
                ? "bg-[var(--wk-brand)]"
                : "bg-[var(--wk-border)]",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                permission.publicDisplay ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={permission.thirdPartyCommercialReuse}
          disabled={working}
          onClick={() =>
            void update({
              thirdPartyCommercialReuse:
                !permission.thirdPartyCommercialReuse,
            })
          }
          className="flex w-full items-center justify-between rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-3 text-left disabled:opacity-60"
        >
          <span>
            <span className="block text-[11px] font-black text-[var(--wk-text)]">
              Allow commercial reuse
            </span>
            <span className="mt-0.5 block text-[10px] text-[var(--wk-text-muted)]">
              Allow approved third parties to reuse this credit commercially.
            </span>
          </span>
          <span
            className={[
              "relative h-6 w-11 shrink-0 rounded-full",
              permission.thirdPartyCommercialReuse
                ? "bg-[var(--wk-brand)]"
                : "bg-[var(--wk-border)]",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                permission.thirdPartyCommercialReuse
                  ? "translate-x-6"
                  : "translate-x-1",
              ].join(" ")}
            />
          </span>
        </button>
      </div>
    </article>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-8 text-center text-[12px] font-semibold leading-5 text-[var(--wk-text-muted)]">
      {text}
    </div>
  );
}

export default function CreditsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] =
    useState<MusicCreditsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimOpen, setClaimOpen] = useState(
    searchParams.get("claim") === "1",
  );

  const initialTrackId = searchParams.get("track_id");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setWorkspace(await getMyMusicCredits());
    } catch (error) {
      console.error(
        "Could not load credits workspace:",
        error,
      );
      setLoadError(
        "We couldn’t load your credits. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("claim") === "1") {
      setClaimOpen(true);
    }
  }, [searchParams]);

  const counts = useMemo(
    () => ({
      needsYou: workspace?.needsYou.length ?? 0,
      yourWork: workspace?.yourWork.length ?? 0,
      activity: workspace?.activity.length ?? 0,
      permissions: workspace?.sharingPermissions.length ?? 0,
    }),
    [workspace],
  );

  function closeComposer() {
    setClaimOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("claim");
    next.delete("track_id");
    setSearchParams(next, { replace: true });
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] pb-28 md:pb-16">
      <MetaTags
        title="Your Credits"
        description="Review your music credits, confirmation requests, activity, and sharing permissions on WAKILISHA."
        robots="noindex,nofollow"
      />

      <div className="wk-container px-6 py-10 md:py-14">
        <header className="flex flex-col gap-6 border-b border-[var(--wk-divider)] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
              Credits
            </div>
            <h1 className="mt-2 text-[34px] font-black tracking-[-0.045em] text-[var(--wk-text)] md:text-[44px]">
              Your Credits
            </h1>
            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[var(--wk-text-muted)]">
              Review your credits, confirmation requests, disputes, and sharing choices.
            </p>
          </div>
          <WkButton
            type="button"
            variant="primary"
            onClick={() => {
              trackMusicProvenanceEvent(
                "credit_claim_started",
                {
                  surface: "your_credits",
                  subjectKind:
                    initialTrackId
                      ? "track"
                      : undefined,
                },
              );
              setClaimOpen(true);
            }}
          >
            Add a credit
          </WkButton>
        </header>

        {loadError ? (
          <div className="mt-6 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-[12px] text-red-800">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]"
              />
            ))}
          </div>
        ) : workspace ? (
          <div className="mt-10 space-y-14">
            <section aria-labelledby="credits-needs-you">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 id="credits-needs-you" className="text-[21px] font-black tracking-[-0.025em] text-[var(--wk-text)]">
                    Needs you
                  </h2>
                  <p className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                    Confirmation requests and disputes waiting for your attention.
                  </p>
                </div>
                <span className="text-[11px] font-black text-[var(--wk-text-faint)]">
                  {counts.needsYou}
                </span>
              </div>
              {workspace.needsYou.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {workspace.needsYou.map((item, index) => (
                    <WorkspaceCard
                      key={item.invitationId || item.attestationId || index}
                      item={item}
                      onRefresh={load}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="Nothing needs your response right now." />
              )}
            </section>

            <section aria-labelledby="credits-your-work">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 id="credits-your-work" className="text-[21px] font-black tracking-[-0.025em] text-[var(--wk-text)]">
                    Your work
                  </h2>
                  <p className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                    Credits you’ve added or confirmed.
                  </p>
                </div>
                <span className="text-[11px] font-black text-[var(--wk-text-faint)]">
                  {counts.yourWork}
                </span>
              </div>
              {workspace.yourWork.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {workspace.yourWork.map((item, index) => (
                    <WorkspaceCard
                      key={item.attestationId || item.canonicalContributionId || index}
                      item={item}
                      onRefresh={load}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="You haven’t added any credits yet." />
              )}
            </section>

            <section aria-labelledby="credits-activity">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 id="credits-activity" className="text-[21px] font-black tracking-[-0.025em] text-[var(--wk-text)]">
                    Activity
                  </h2>
                  <p className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                    A record of your credit activity and confirmation requests.
                  </p>
                </div>
                <span className="text-[11px] font-black text-[var(--wk-text-faint)]">
                  {counts.activity}
                </span>
              </div>
              {workspace.activity.length ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                  {workspace.activity.map((item, index) => (
                    <div
                      key={(item.attestationId || item.invitationId || "activity") + String(index)}
                      className="flex items-start gap-3 border-t border-[var(--wk-divider)] px-4 py-4 first:border-t-0"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                        <WkIcon name="History" size={14} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-[var(--wk-text)]">
                          {statusLabel(item.state)}
                          {item.roleLabel ? " · " + item.roleLabel : ""}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                          {item.subject?.title || "Credit activity"}
                          {item.at
                            ? " · " + new Date(item.at).toLocaleDateString()
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Your credit history will appear here." />
              )}
            </section>

            <section aria-labelledby="credits-permissions">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <h2 id="credits-permissions" className="text-[21px] font-black tracking-[-0.025em] text-[var(--wk-text)]">
                    Sharing permissions
                  </h2>
                  <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[var(--wk-text-muted)]">
                    Choose where your credit can appear and whether others may reuse it commercially. This doesn’t change ownership or royalties.
                  </p>
                </div>
                <span className="text-[11px] font-black text-[var(--wk-text-faint)]">
                  {counts.permissions}
                </span>
              </div>
              {workspace.sharingPermissions.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {workspace.sharingPermissions.map((item) => (
                    <PermissionCard
                      key={item.attestationId}
                      item={item}
                      onRefresh={load}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="Sharing options will appear after you add a credit." />
              )}
            </section>
          </div>
        ) : null}
      </div>

      <ClaimComposer
        open={claimOpen}
        onClose={closeComposer}
        initialTrackId={initialTrackId}
        onSaved={load}
      />
    </main>
  );
}
