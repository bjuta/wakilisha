import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { ArtistPostComposer } from "@/components/artists/ArtistPostComposer";
import { ArtistClaimSheet } from "@/components/artists/ArtistClaimSheet";
import {
  acceptArtistRepresentation,
  getArtistRepresentationState,
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
  const [state, setState] = useState<ArtistRepresentationState | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
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
    const params =
      new URLSearchParams(
        window.location.search,
      );

    if (
      params.get("claim") !== "1"
    ) {
      return;
    }

    if (
      !userId ||
      state?.canClaim
    ) {
      setClaimOpen(true);
    }
  }, [
    state?.canClaim,
    userId,
  ]);

  function startClaim() {
    if (authLoading) return;
    setClaimOpen(true);
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

  const canStartClaim =
    !userId ||
    state?.canClaim === true;

  const showAuthorityToolbar =
    publicLinks.length > 0 ||
    Boolean(activeRepresentation) ||
    Boolean(pendingInvitation) ||
    Boolean(pendingClaim) ||
    canStartClaim;

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
            ) : canStartClaim ? (
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

      <ArtistClaimSheet
        open={claimOpen}
        artistId={artistId}
        artistSlug={artistSlug}
        artistName={artistName}
        userId={userId}
        authLoading={authLoading}
        returnTo={`/artists/${artistSlug}?claim=1`}
        onClose={() =>
          setClaimOpen(false)
        }
        onSubmitted={async () => {
          setClaimOpen(false);
          setMessage({
            type: "success",
            text: "We received your claim. WAKILISHA will review it.",
          });
          await refreshState();
        }}
      />
    </section>
  );
}
