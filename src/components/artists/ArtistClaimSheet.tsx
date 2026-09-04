import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import {
  Portal,
} from "@/components/base/Portal";
import {
  ClaimantPhoneFields,
} from "@/components/artists/ClaimantPhoneFields";
import {
  WkButton,
} from "@/components/design-system/primitives/Button";
import {
  useScrollLock,
} from "@/hooks/useScrollLock";
import {
  submitArtistClaim,
} from "@/services/artists/claimedArtist";
import {
  clearArtistClaimDraft,
  readArtistClaimDraft,
  saveArtistClaimDraft,
} from "@/services/artists/artistClaimDraft";
import {
  normalizeClaimantPhone,
} from "@/utils/claimantPhone";

const CLAIM_ROLES = [
  ["artist", "Artist"],
  ["manager", "Manager"],
  ["label", "Label"],
  ["publicist", "Publicist"],
  ["team_member", "Team Member"],
  ["other", "Other"],
] as const;

export function ArtistClaimSheet({
  open,
  artistId,
  artistSlug,
  artistName,
  userId,
  authLoading,
  returnTo,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  artistId: string;
  artistSlug: string | null;
  artistName: string;
  userId?: string;
  authLoading: boolean;
  returnTo: string;
  onClose: () => void;
  onSubmitted?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();

  useScrollLock(open);
  const [claimRole, setClaimRole] =
    useState("artist");
  const [
    phoneCountryIso2,
    setPhoneCountryIso2,
  ] = useState("");
  const [
    phoneNumber,
    setPhoneNumber,
  ] = useState("");
  const [statement, setStatement] =
    useState("");
  const [proofLink, setProofLink] =
    useState("");
  const [savedAt, setSavedAt] =
    useState<string | null>(null);
  const [
    draftStorageAvailable,
    setDraftStorageAvailable,
  ] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);
  const [message, setMessage] =
    useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);

  useEffect(() => {
    if (!open) return;

    const draft =
      readArtistClaimDraft(artistId);

    setClaimRole(
      draft?.claimantRole ?? "artist",
    );
    setPhoneCountryIso2(
      draft?.phoneCountryIso2 ?? "",
    );
    setPhoneNumber(
      draft?.phoneNumber ?? "",
    );
    setStatement(
      draft?.statement ?? "",
    );
    setProofLink(
      draft?.proofLink ?? "",
    );
    setSavedAt(
      draft?.updatedAt ?? null,
    );
    setDraftStorageAvailable(true);
    setMessage(null);
  }, [
    artistId,
    open,
  ]);

  useEffect(() => {
    if (!open) return;

    const hasDraft =
      claimRole !== "artist" ||
      phoneCountryIso2.length > 0 ||
      phoneNumber.trim().length > 0 ||
      statement.trim().length > 0 ||
      proofLink.trim().length > 0;

    if (!hasDraft) {
      setSavedAt(null);
      return;
    }

    const timer =
      window.setTimeout(() => {
        const result =
          saveArtistClaimDraft({
            artistId,
            artistName,
            artistSlug,
            claimantRole:
              claimRole,
            phoneCountryIso2,
            phoneNumber,
            statement,
            proofLink,
          });

        setDraftStorageAvailable(
          result.saved,
        );
        setSavedAt(
          result.saved
            ? result.draft.updatedAt
            : null,
        );
      }, 180);

    return () =>
      window.clearTimeout(timer);
  }, [
    artistId,
    artistName,
    artistSlug,
    claimRole,
    phoneCountryIso2,
    phoneNumber,
    statement,
    proofLink,
    open,
  ]);

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();
    setMessage(null);

    if (
      statement.trim().length < 10
    ) {
      setMessage({
        type: "error",
        text: "Tell us how you’re connected to this Artist.",
      });
      return;
    }

    let phone;

    try {
      phone =
        normalizeClaimantPhone(
          phoneCountryIso2,
          phoneNumber,
        );
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Enter a valid phone number.",
      });
      return;
    }

    const draftResult =
      saveArtistClaimDraft({
        artistId,
        artistName,
        artistSlug,
        claimantRole:
          claimRole,
        phoneCountryIso2,
        phoneNumber,
        statement,
        proofLink,
      });

    setDraftStorageAvailable(
      draftResult.saved,
    );
    setSavedAt(
      draftResult.saved
        ? draftResult.draft.updatedAt
        : null,
    );

    if (authLoading) return;

    if (!userId) {
      if (!draftResult.saved) {
        setMessage({
          type: "error",
          text: "This browser could not save your draft. Keep this page open or enable site storage before signing in.",
        });
        return;
      }

      navigate(
        `/auth?returnTo=${encodeURIComponent(
          returnTo,
        )}`,
      );
      return;
    }

    setActionLoading(true);

    try {
      await submitArtistClaim({
        artistId,
        claimantRole:
          claimRole,
        statement:
          statement.trim(),
        phone,
        evidence:
          proofLink.trim()
            ? [
                {
                  type:
                    "official_social",
                  reference:
                    proofLink.trim(),
                },
              ]
            : [],
      });

      clearArtistClaimDraft(
        artistId,
      );
      setClaimRole("artist");
      setPhoneCountryIso2("");
      setPhoneNumber("");
      setStatement("");
      setProofLink("");
      setSavedAt(null);
      setDraftStorageAvailable(true);
      setMessage({
        type: "success",
        text: "We received your claim. WAKILISHA will review it.",
      });

      await onSubmitted?.();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "We could not submit this claim.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Claim ${artistName}`}
      >
        <div
          className="max-h-[92dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-[var(--wk-surface)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
              Artist Claim
            </div>
            <h2 className="mt-1 text-[22px] font-black tracking-tight text-[var(--wk-text)]">
              Claim {artistName}
            </h2>
            <p className="mt-1 max-w-md text-[13px] leading-6 text-[var(--wk-text-muted)]">
              Tell us who you are and how you represent this Artist. We review every claim.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)]"
            aria-label="Close Claim Form"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        {message ? (
          <div
            className={[
              "mt-4 rounded-xl border px-4 py-3 text-[13px]",
              message.type ===
              "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800",
            ].join(" ")}
          >
            {message.text}
          </div>
        ) : null}

        <form
          className="mt-6 space-y-4"
          onSubmit={
            handleSubmit
          }
        >
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
              Your Role
            </span>
            <select
              value={claimRole}
              onChange={(event) =>
                setClaimRole(
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
            >
              {CLAIM_ROLES.map(
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
          </label>

          <ClaimantPhoneFields
            countryIso2={
              phoneCountryIso2
            }
            phoneNumber={
              phoneNumber
            }
            onCountryChange={
              setPhoneCountryIso2
            }
            onPhoneNumberChange={
              setPhoneNumber
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
              How Are You Connected?
            </span>
            <textarea
              value={statement}
              onChange={(event) =>
                setStatement(
                  event.target.value,
                )
              }
              rows={5}
              maxLength={4000}
              placeholder="For example: I am the Artist, or I manage this Artist and can verify that relationship."
              className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
              Proof Link
            </span>
            <input
              type="url"
              value={proofLink}
              onChange={(event) =>
                setProofLink(
                  event.target.value,
                )
              }
              placeholder="https://"
              className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
            />
            <span className="mt-1.5 block text-[11px] leading-5 text-[var(--wk-text-muted)]">
              An official website, social account, announcement, or other public proof can help us review your claim.
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[10px] font-semibold text-[var(--wk-text-faint)]">
              {!draftStorageAvailable
                ? "Draft saving is unavailable in this browser."
                : savedAt
                  ? "Saved on this device."
                  : "Your entries will be saved on this device as you type."}
            </span>

            <div className="flex gap-2">
              <WkButton
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Close
              </WkButton>
              <WkButton
                type="submit"
                variant="primary"
                disabled={
                  actionLoading ||
                  authLoading
                }
              >
                {actionLoading
                  ? "Submitting…"
                  : userId
                    ? "Submit Claim"
                    : "Continue to Sign In"}
              </WkButton>
            </div>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}
