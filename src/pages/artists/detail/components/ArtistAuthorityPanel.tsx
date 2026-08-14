import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import {
  acceptArtistRepresentation,
  getArtistRepresentationState,
  submitArtistClaim,
  type ArtistPublicAuthority,
  type ArtistRepresentationState,
} from "@/services/artists/claimedArtist";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  facebook: "Facebook",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
};

const CLAIM_ROLES = [
  ["artist", "Artist"],
  ["manager", "Manager"],
  ["label", "Label"],
  ["publicist", "Publicist"],
  ["team_member", "Team Member"],
  ["other", "Other"],
] as const;

export function ArtistAuthorityPanel({
  artistId,
  artistSlug,
  artistName,
  authority,
  userId,
  authLoading,
}: {
  artistId: string;
  artistSlug: string;
  artistName: string;
  authority: ArtistPublicAuthority | null;
  userId?: string;
  authLoading: boolean;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<ArtistRepresentationState | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimRole, setClaimRole] = useState("artist");
  const [statement, setStatement] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const presentation = authority?.presentation;
  const publicLinks = useMemo(() => {
    const items: Array<{ label: string; href: string }> = [];
    if (presentation?.websiteUrl) items.push({ label: "Website", href: presentation.websiteUrl });
    for (const [key, href] of Object.entries(presentation?.socialLinks ?? {})) {
      if (!href) continue;
      items.push({ label: SOCIAL_LABELS[key] ?? key, href });
    }
    if (presentation?.publicEmail) items.push({ label: "Email", href: `mailto:${presentation.publicEmail}` });
    return items;
  }, [presentation]);

  async function refreshState() {
    if (!userId) {
      setState(null);
      return;
    }
    setStateLoading(true);
    try {
      setState(await getArtistRepresentationState(artistId));
    } catch {
      setState(null);
    } finally {
      setStateLoading(false);
    }
  }

  useEffect(() => {
    void refreshState();
  }, [artistId, userId]);

  useEffect(() => {
    if (!userId || !state?.canClaim) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("claim") === "1") setClaimOpen(true);
  }, [state?.canClaim, userId]);

  function startClaim() {
    if (authLoading) return;
    if (!userId) {
      const returnTo = `/artists/${artistSlug}?claim=1`;
      navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setClaimOpen(true);
  }

  async function handleSubmitClaim(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (statement.trim().length < 10) {
      setMessage({ type: "error", text: "Tell us how you are connected to this Artist." });
      return;
    }
    setActionLoading(true);
    try {
      await submitArtistClaim({
        artistId,
        claimantRole: claimRole,
        statement: statement.trim(),
        evidence: proofLink.trim()
          ? [{ type: "official_social", reference: proofLink.trim() }]
          : [],
      });
      setClaimOpen(false);
      setStatement("");
      setProofLink("");
      setMessage({ type: "success", text: "We received your claim. WAKILISHA will review it." });
      await refreshState();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not submit this claim." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptInvitation() {
    if (!state?.representation?.id) return;
    setMessage(null);
    setActionLoading(true);
    try {
      await acceptArtistRepresentation(state.representation.id);
      setMessage({ type: "success", text: `You can now manage ${artistName} within your assigned permissions.` });
      await refreshState();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not accept this invitation." });
    } finally {
      setActionLoading(false);
    }
  }

  const activeRepresentation = state?.representation?.status === "active" ? state.representation : null;
  const pendingInvitation = state?.representation?.status === "pending" ? state.representation : null;
  const pendingClaim = state?.latestClaim?.status === "pending" ? state.latestClaim : null;

  return (
    <section className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-text)]">
                {authority?.official ? "Official Artist" : "WAKILISHA Registry"}
              </span>
              {stateLoading && <span className="text-[12px] text-[var(--wk-text-muted)]">Checking access…</span>}
            </div>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--wk-text-muted)]">
              {authority?.official
                ? "Managed by the Artist or their team."
                : "Built from WAKILISHA's reviewed music records."}
            </p>
            {publicLinks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {publicLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    target={item.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={item.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                    className="text-[12px] font-bold text-[var(--wk-brand)] hover:underline"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeRepresentation ? (
              <Link to={`/artists/${artistSlug}/manage`}>
                <WkButton variant="primary">Manage Artist</WkButton>
              </Link>
            ) : pendingInvitation ? (
              <WkButton variant="primary" onClick={handleAcceptInvitation} disabled={actionLoading}>
                Accept Invitation
              </WkButton>
            ) : pendingClaim ? (
              <div className="text-right">
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-4 py-2 text-[12px] font-bold text-[var(--wk-brand)]">
                  Claim Under Review
                </span>
                <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">WAKILISHA is reviewing your claim.</p>
              </div>
            ) : !authority?.official ? (
              <WkButton variant="soft" onClick={startClaim} disabled={authLoading || stateLoading}>
                Claim This Artist
              </WkButton>
            ) : null}
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-[13px] ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {claimOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" onClick={() => setClaimOpen(false)}>
          <div className="w-full max-w-xl rounded-t-3xl bg-[var(--wk-surface)] p-6 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Claim {artistName}</h2>
                <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                  Tell us who you are and how you represent this Artist. WAKILISHA reviews every claim.
                </p>
              </div>
              <button type="button" onClick={() => setClaimOpen(false)} className="text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]" aria-label="Close Claim Form">
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmitClaim}>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Your Role</span>
                <select value={claimRole} onChange={(event) => setClaimRole(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]">
                  {CLAIM_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">How Are You Connected?</span>
                <textarea
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                  rows={5}
                  maxLength={4000}
                  placeholder="For example: I am the Artist, or I manage this Artist and can verify that relationship."
                  className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Proof Link</span>
                <input
                  type="url"
                  value={proofLink}
                  onChange={(event) => setProofLink(event.target.value)}
                  placeholder="https://"
                  className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
                />
                <span className="mt-1.5 block text-[11px] leading-5 text-[var(--wk-text-muted)]">An official website, social account, announcement, or other public proof helps us review the claim.</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <WkButton variant="ghost" onClick={() => setClaimOpen(false)}>Cancel</WkButton>
                <WkButton type="submit" variant="primary" disabled={actionLoading}>
                  {actionLoading ? "Submitting…" : "Submit Claim"}
                </WkButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
