import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkIcon } from "@/components/design-system/Icon";
import { MetaTags } from "@/components/seo/MetaTags";
import { trackMusicProvenanceEvent } from "@/services/analytics";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  getMusicCreditInvite,
  respondMusicCreditInvitation,
  type MusicCreditInviteContext,
} from "@/services/musicProvenance";

export default function CreditInvitePage() {
  const { inviteRef = "" } = useParams<{ inviteRef: string }>();
  const authUser = useAuthUser();
  const location = useLocation();
  const [invite, setInvite] =
    useState<MusicCreditInviteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] =
    useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessage(null);

    void getMusicCreditInvite(inviteRef)
      .then((result) => {
        if (alive) setInvite(result);
      })
      .catch(() => {
        if (alive) setInvite(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [authUser.id, inviteRef]);

  const returnTo = useMemo(
    () => location.pathname + location.search,
    [location.pathname, location.search],
  );

  async function respond(
    mode: "accepted" | "disputed" | "declined",
  ) {
    if (!invite?.canRespond || working) return;
    setWorking(true);
    setMessage(null);
    try {
      await respondMusicCreditInvitation(
        inviteRef,
        mode,
        reason.trim() || null,
      );
      if (mode === "accepted") {
        trackMusicProvenanceEvent(
          "credit_confirmation_completed",
          {
            surface: "credit_invite",
            subjectKind:
              invite.subject?.kind,
            outcome: "accepted",
          },
        );
      } else if (mode === "disputed") {
        trackMusicProvenanceEvent(
          "credit_disputed",
          {
            surface: "credit_invite",
            subjectKind:
              invite.subject?.kind,
            outcome: "disputed",
          },
        );
      }
      const refreshed = await getMusicCreditInvite(inviteRef);
      setInvite(refreshed);
      setMessage({
        type: "success",
        text:
          mode === "accepted"
            ? "Your confirmation was recorded. It remains reviewable before any canonical Registry admission."
            : mode === "disputed"
              ? "Your dispute was recorded and the claim is no longer treated as uncontested."
              : "You declined this confirmation request.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "We could not record your response.",
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] px-6 py-12 md:py-20">
      <MetaTags
        title="Credit confirmation"
        description="Review a WAKILISHA music credit confirmation request."
        robots="noindex,nofollow"
      />

      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[11px] font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
        >
          <WkIcon name="ArrowLeft" size={13} />
          WAKILISHA
        </Link>

        {loading ? (
          <div
            className="mt-8 h-80 animate-pulse rounded-3xl bg-[var(--wk-surface-raised)]"
            aria-busy="true"
          />
        ) : !invite ? (
          <section className="mt-8 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-7 text-center md:p-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
              <WkIcon name="Link2" size={20} />
            </span>
            <h1 className="mt-5 text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
              This confirmation link is unavailable
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
              It may be invalid, expired, revoked, or bound to another Person.
            </p>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="border-b border-[var(--wk-divider)] p-6 md:p-8">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                Credit confirmation
              </div>
              <h1 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[var(--wk-text)] md:text-[34px]">
                {invite.subject?.title || "Music credit"}
              </h1>
              <p className="mt-3 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                {invite.inviter.name} asked you to review a{" "}
                <strong className="text-[var(--wk-text)]">
                  {invite.roleLabel}
                </strong>{" "}
                credit.
              </p>
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--wk-bg)] p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                    Credit
                  </div>
                  <div className="mt-1 text-[14px] font-black text-[var(--wk-text)]">
                    {invite.roleLabel}
                  </div>
                  {invite.instrument ? (
                    <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                      {invite.instrument}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-[var(--wk-bg)] p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                    Status
                  </div>
                  <div className="mt-1 capitalize text-[14px] font-black text-[var(--wk-text)]">
                    {invite.state}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {invite.detail ? (
                <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[12px] leading-6 text-[var(--wk-text-muted)]">
                  {invite.detail}
                </div>
              ) : null}

              {message ? (
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-[12px] leading-5",
                    message.type === "success"
                      ? "border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                      : "border-red-300/50 bg-red-50 text-red-800",
                  ].join(" ")}
                >
                  {message.text}
                </div>
              ) : null}

              {!authUser.loading && !authUser.id && invite.state === "pending" ? (
                <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
                  <h2 className="text-[14px] font-black text-[var(--wk-text)]">
                    Sign in to respond as yourself
                  </h2>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                    Your response is tied to your canonical WAKILISHA Person. Signing in does not automatically accept the claim.
                  </p>
                  <Link
                    to={"/auth?returnTo=" + encodeURIComponent(returnTo)}
                    className="mt-4 inline-flex rounded-xl bg-[var(--wk-brand)] px-4 py-2.5 text-[12px] font-black text-[var(--wk-brand-on)]"
                  >
                    Sign in to review
                  </Link>
                </div>
              ) : null}

              {authUser.id && invite.canRespond ? (
                <div>
                  <label className="block text-[11px] font-black text-[var(--wk-text)]">
                    Optional context
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={3}
                      maxLength={4000}
                      placeholder="Add context if you need to correct or dispute the claim."
                      className="mt-2 w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] font-medium leading-5 text-[var(--wk-text)]"
                    />
                  </label>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <WkButton
                      type="button"
                      variant="primary"
                      disabled={working}
                      onClick={() => void respond("accepted")}
                    >
                      Confirm
                    </WkButton>
                    <WkButton
                      type="button"
                      variant="ghost"
                      disabled={working}
                      onClick={() => void respond("disputed")}
                    >
                      Dispute
                    </WkButton>
                    <WkButton
                      type="button"
                      variant="ghost"
                      disabled={working}
                      onClick={() => void respond("declined")}
                    >
                      Decline
                    </WkButton>
                  </div>
                </div>
              ) : null}

              {invite.state !== "pending" ? (
                <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                  This request is {invite.state}. No further response is available from this link.
                </div>
              ) : null}

              <p className="text-[10px] leading-5 text-[var(--wk-text-faint)]">
                A confirmation is evidence, not a rights or royalty decision. Canonical WAKILISHA contribution records are admitted separately under reviewed Registry authority.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
