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
  ArtistCountryPicker,
} from "@/components/artists/ArtistCountryPicker";
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
  submitNewArtistClaim,
} from "@/services/artists/claimedArtist";
import {
  clearNewArtistClaimDraft,
  readNewArtistClaimDraft,
  saveNewArtistClaimDraft,
} from "@/services/artists/newArtistClaimDraft";
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

const ARTIST_TYPES = [
  ["solo", "Solo Artist"],
  ["duo", "Duo"],
  ["group", "Group"],
  ["band", "Band"],
  ["collective", "Collective"],
  ["unknown", "Not Sure"],
] as const;

export function NewArtistClaimSheet({
  open,
  flowId,
  initialName,
  userId,
  authLoading,
  returnTo,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  flowId: string;
  initialName: string;
  userId?: string;
  authLoading: boolean;
  returnTo: string;
  onClose: () => void;
  onSubmitted?: (
    claimId: string,
  ) => void | Promise<void>;
}) {
  const navigate = useNavigate();

  useScrollLock(open);
  const [
    displayName,
    setDisplayName,
  ] = useState(initialName);
  const [
    artistType,
    setArtistType,
  ] = useState("solo");
  const [
    originIso2,
    setOriginIso2,
  ] = useState("");
  const [
    alternateNames,
    setAlternateNames,
  ] = useState("");
  const [
    claimantRole,
    setClaimantRole,
  ] = useState("artist");
  const [
    claimantRoleOther,
    setClaimantRoleOther,
  ] = useState("");
  const [
    phoneCountryIso2,
    setPhoneCountryIso2,
  ] = useState("");
  const [
    phoneNumber,
    setPhoneNumber,
  ] = useState("");
  const [
    statement,
    setStatement,
  ] = useState("");
  const [
    savedAt,
    setSavedAt,
  ] = useState<string | null>(
    null,
  );
  const [
    draftStorageAvailable,
    setDraftStorageAvailable,
  ] = useState(true);
  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);
  const [
    message,
    setMessage,
  ] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;

    const draft =
      readNewArtistClaimDraft(
        flowId,
      );

    setDisplayName(
      draft?.displayName ||
        initialName,
    );
    setArtistType(
      draft?.artistType ||
        "solo",
    );
    setOriginIso2(
      draft?.originIso2 ||
        "",
    );
    setAlternateNames(
      draft?.alternateNames ||
        "",
    );
    setClaimantRole(
      draft?.claimantRole ||
        "artist",
    );
    setClaimantRoleOther(
      draft?.claimantRoleOther ||
        "",
    );
    setPhoneCountryIso2(
      draft?.phoneCountryIso2 ||
        "",
    );
    setPhoneNumber(
      draft?.phoneNumber ||
        "",
    );
    setStatement(
      draft?.statement ||
        "",
    );
    setSavedAt(
      draft?.updatedAt ??
        null,
    );
    setDraftStorageAvailable(true);
    setMessage(null);
  }, [
    flowId,
    initialName,
    open,
  ]);

  useEffect(() => {
    if (!open) return;

    const hasDraft =
      displayName.trim()
        .length > 0 ||
      originIso2.length > 0 ||
      alternateNames.trim()
        .length > 0 ||
      phoneCountryIso2.length >
        0 ||
      phoneNumber.trim().length >
        0 ||
      statement.trim().length >
        0 ||
      claimantRoleOther.trim().length >
        0 ||
      artistType !== "solo" ||
      claimantRole !== "artist";

    if (!hasDraft) {
      setSavedAt(null);
      return;
    }

    const timer =
      window.setTimeout(() => {
        const result =
          saveNewArtistClaimDraft({
            flowId,
            displayName,
            artistType,
            originIso2,
            alternateNames,
            claimantRole,
            claimantRoleOther,
            phoneCountryIso2,
            phoneNumber,
            statement,
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
    flowId,
    displayName,
    artistType,
    originIso2,
    alternateNames,
    claimantRole,
    claimantRoleOther,
    phoneCountryIso2,
    phoneNumber,
    statement,
    open,
  ]);

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();
    setMessage(null);

    const cleanName =
      displayName.trim();

    if (
      cleanName.length < 2
    ) {
      setMessage({
        type: "error",
        text: "Enter the Artist name.",
      });
      return;
    }

    if (
      claimantRole === "other" &&
      (
        claimantRoleOther.trim().length < 1 ||
        claimantRoleOther.trim().length > 140
      )
    ) {
      setMessage({
        type: "error",
        text: "Tell us your role in 140 characters or fewer.",
      });
      return;
    }

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
      saveNewArtistClaimDraft({
        flowId,
        displayName:
          cleanName,
        artistType,
        originIso2,
        alternateNames,
        claimantRole,
        claimantRoleOther,
        phoneCountryIso2,
        phoneNumber,
        statement,
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
      const result =
        await submitNewArtistClaim({
          displayName:
            cleanName,
          artistType,
          originIso2,
          alternateNames:
            alternateNames
              .split(/[\n,]/)
              .map((value) =>
                value.trim(),
              )
              .filter(Boolean),
          claimantRole,
          claimantRoleOther:
            claimantRole === "other"
              ? claimantRoleOther.trim()
              : null,
          statement:
            statement.trim(),
          phone,
          evidence: [],
        });

      clearNewArtistClaimDraft(
        flowId,
      );
      setSavedAt(null);
      setDraftStorageAvailable(true);
      setMessage({
        type: "success",
        text: "We received this Artist claim. WAKILISHA will review it.",
      });

      await onSubmitted?.(
        result.claimId,
      );
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "We could not submit this Artist claim.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[121] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Propose an Artist"
      >
        <div
          className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl bg-[var(--wk-surface)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
              New Artist
            </div>
            <h2 className="mt-1 text-[22px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
              Propose an Artist
            </h2>
            <p className="mt-2 max-w-lg text-[13px] leading-6 text-[var(--wk-text-muted)]">
              We check the Registry again before your claim is submitted.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close New Artist Form"
            className="text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)]"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
                Artist Name
              </span>
              <input
                value={
                  displayName
                }
                onChange={(event) =>
                  setDisplayName(
                    event.target.value,
                  )
                }
                maxLength={200}
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
                Artist Type
              </span>
              <select
                value={
                  artistType
                }
                onChange={(event) =>
                  setArtistType(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
              >
                {ARTIST_TYPES.map(
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

            <ArtistCountryPicker
              value={originIso2}
              onChange={setOriginIso2}
            />

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
                Alternate or Former Names
              </span>
              <input
                value={
                  alternateNames
                }
                onChange={(event) =>
                  setAlternateNames(
                    event.target.value,
                  )
                }
                maxLength={500}
                placeholder="Separate names with commas"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
              />
            </label>
          </div>

          <div className="border-t border-[var(--wk-divider)] pt-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
                Your Role
              </span>
              <select
                value={
                  claimantRole
                }
                onChange={(event) =>
                  setClaimantRole(
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

            {claimantRole === "other" ? (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">
                  Other Role
                </span>
                <input
                  value={claimantRoleOther}
                  onChange={(event) =>
                    setClaimantRoleOther(
                      event.target.value,
                    )
                  }
                  maxLength={140}
                  required
                  autoComplete="off"
                  placeholder="Describe your role"
                  className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]"
                />
              </label>
            ) : null}

            <div className="mt-4">
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
            </div>

            <label className="mt-4 block">
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
                rows={4}
                maxLength={4000}
                placeholder="For example: I am the Artist, or I manage this Artist and can verify that relationship."
                className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]"
              />
            </label>

          </div>

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
                    ? "Submit Artist"
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
