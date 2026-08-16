import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { ArtistPostComposer } from "@/components/artists/ArtistPostComposer";
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

const SOCIAL_ICONS: Record<string, string> = {
  instagram: "ri-instagram-line",
  tiktok: "ri-tiktok-line",
  x: "ri-twitter-x-line",
  youtube: "ri-youtube-line",
  facebook: "ri-facebook-circle-line",
  spotify: "ri-spotify-line",
  soundcloud: "ri-soundcloud-line",
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
  navigation,
  showComposer = true,
  onPostSaved,
}: {
  artistId: string;
  artistSlug: string;
  artistName: string;
  authority: ArtistPublicAuthority | null;
  userId?: string;
  authLoading: boolean;
  navigation?: ReactNode;
  showComposer?: boolean;
  onPostSaved?: () => void;
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
    const items: Array<{
      label: string;
      href: string;
      icon: string;
    }> = [];

    if (presentation?.websiteUrl) {
      items.push({
        label: "Website",
        href: presentation.websiteUrl,
        icon: "ri-global-line",
      });
    }

    for (
      const [key, href] of
      Object.entries(
        presentation?.socialLinks ?? {},
      )
    ) {
      if (!href) continue;

      items.push({
        label:
          SOCIAL_LABELS[key] ?? key,
        href,
        icon:
          SOCIAL_ICONS[key] ??
          "ri-links-line",
      });
    }

    if (presentation?.publicEmail) {
      items.push({
        label: "Email",
        href:
          `mailto:${presentation.publicEmail}`,
        icon: "ri-mail-line",
      });
    }

    return items;
  }, [presentation]);

  const profileComposerMedia = useMemo(
    () =>
      Array.from(
        new Set(
          [
            presentation?.profileImageUrl ?? "",
            presentation?.heroImageUrl ?? "",
          ]
            .map((url) => url.trim())
            .filter(Boolean),
        ),
      ),
    [
      presentation?.profileImageUrl,
      presentation?.heroImageUrl,
    ],
  );

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

  const showAuthorityToolbar =
    publicLinks.length > 0 ||
    Boolean(activeRepresentation) ||
    Boolean(pendingInvitation) ||
    Boolean(pendingClaim) ||
    !authority?.official;

  return (
    <section className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container px-6">
        {showAuthorityToolbar ? (
          <div className="flex min-h-10 flex-wrap items-center justify-end gap-2 py-2.5">
            {publicLinks.length > 0 && (
              <div className="author-profile-hero-socials mr-auto !mb-0">
                {publicLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    target={item.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={item.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                    className="author-profile-hero-social-link"
                    aria-label={item.label}
                    title={item.label}
                  >
                    <i
                      className={`${item.icon} text-[17px]`}
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            )}

            {activeRepresentation ? (
              <>
                {activeRepresentation.permissions.profile && (
                  <Link to={`/artists/${artistSlug}/manage?section=settings&settings=profile`}>
                    <WkButton variant="soft">Edit Profile</WkButton>
                  </Link>
                )}
                <Link to={`/artists/${artistSlug}/manage`}>
                  <WkButton variant="primary">Artist Studio</WkButton>
                </Link>
              </>
            ) : pendingInvitation ? (
              <WkButton variant="primary" onClick={handleAcceptInvitation} disabled={actionLoading}>
                Accept Invitation
              </WkButton>
            ) : pendingClaim ? (
              <span className="rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand)]">
                Claim under review
              </span>
            ) : !authority?.official ? (
              <button
                type="button"
                onClick={startClaim}
                disabled={authLoading || stateLoading}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-bold text-[var(--wk-text-faint)] transition-colors hover:bg-[var(--wk-bg)] hover:text-[var(--wk-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i
                  className="ri-user-add-line text-[13px]"
                  aria-hidden="true"
                />
                Claim this Artist
              </button>
            ) : null}
          </div>
        ) : null}

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

        {navigation ?? null}

        {showComposer &&
          activeRepresentation?.permissions.updates && (
          <div className="mt-5">
            <ArtistPostComposer
              artistId={artistId}
              artistName={artistName}
              artistImageUrl={presentation?.profileImageUrl}
              mediaUrls={profileComposerMedia}
              onSaved={() => {
                setMessage({
                  type: "success",
                  text: "Post published.",
                });
                onPostSaved?.();
              }}
              onError={(text) =>
                setMessage({
                  type: "error",
                  text,
                })
              }
            />
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
