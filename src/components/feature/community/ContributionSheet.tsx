import { useState, useRef, useCallback, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { trackEvent } from "@/services/analytics";
import { createContribution } from "@/services/community";
import type { CommunityEntity } from "@/services/community";
import {
  resolvePublicTrackMetadata,
  submitPublicMissingTrack,
} from "@/services/playlists/playlistContributionService";
import { Portal } from "@/components/base/Portal";

// ── Contribution types ─────────────────────────────────────────────────────

const CONTRIBUTION_TYPES = [
  { value: "correction", label: "Correction", icon: "ri-edit-line", description: "Fix inaccurate or outdated information" },
  { value: "missing_credit", label: "Missing Credit", icon: "ri-user-add-line", description: "Add uncredited artists, producers, or contributors" },
  { value: "missing_track", label: "Missing Track", icon: "ri-play-list-add-line", description: "Suggest a song that belongs in this Playlist" },
  { value: "genre_fix", label: "Genre Fix", icon: "ri-price-tag-3-line", description: "Correct or suggest genre classifications" },
  { value: "bio_correction", label: "Bio Correction", icon: "ri-file-text-line", description: "Fix biographical errors or outdated bios" },
  { value: "lyrics_correction", label: "Lyrics Correction", icon: "ri-music-2-line", description: "Fix incorrect or missing lyrics" },
  { value: "other", label: "Other", icon: "ri-more-line", description: "Something else that needs attention" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface ContributionSheetProps {
  entity: CommunityEntity;
  open: boolean;
  onClose: () => void;
  userId?: string;
  sourceCommentId?: string;
  initialType?: string;
  allowedTypes?: string[];
  title?: string;
  submitLabel?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  reviewNote?: string;
  playlistSubmission?: {
    playlistId: string;
    playlistSlug: string;
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export function ContributionSheet({
  entity,
  open,
  onClose,
  userId,
  sourceCommentId,
  initialType = "correction",
  allowedTypes,
  title = "Suggest a Correction",
  submitLabel = "Submit Correction",
  descriptionLabel = "Describe the issue",
  descriptionPlaceholder = "What information is incorrect or missing? Be as specific as possible...",
  reviewNote = "All contributions are reviewed by our editorial team before being published.",
  playlistSubmission,
}: ContributionSheetProps) {
  const visibleTypes =
    allowedTypes && allowedTypes.length > 0
      ? CONTRIBUTION_TYPES.filter(
          (type) =>
            allowedTypes.includes(type.value),
        )
      : CONTRIBUTION_TYPES.filter(
          (type) =>
            type.value !== "missing_track",
        );

  const resolvedInitialType =
    visibleTypes.some(
      (type) =>
        type.value === initialType,
    )
      ? initialType
      : visibleTypes[0]?.value ?? "correction";

  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedType, setSelectedType] = useState<string>(resolvedInitialType);
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [artistNames, setArtistNames] = useState<string[]>([""]);
  const [resolvingTrackUrl, setResolvingTrackUrl] = useState(false);
  const [trackMetadataMessage, setTrackMetadataMessage] =
    useState<string | null>(null);
  const [submissionKey, setSubmissionKey] =
    useState(() => crypto.randomUUID());
  const lastResolvedUrlRef = useRef("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);

  useScrollLock(open);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("form");
      setSelectedType(resolvedInitialType);
      setDescription("");
      setSourceUrl("");
      setTrackTitle("");
      setArtistNames([""]);
      setResolvingTrackUrl(false);
      setTrackMetadataMessage(null);
      setSubmissionKey(crypto.randomUUID());
      lastResolvedUrlRef.current = "";
      setError(null);
    }
  }, [open, resolvedInitialType]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag-to-dismiss
  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = dragStartY.current;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    dragCurrentY.current = e.touches[0].clientY;
    const delta = dragCurrentY.current - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = "none";
    }
  };
  const onTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = dragCurrentY.current - dragStartY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)";
      if (delta > 80) {
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(() => onClose(), 250);
      } else {
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  };

  const selectedTypeDef =
    visibleTypes.find(
      (type) =>
        type.value === selectedType,
    );

  const isMissingTrack =
    selectedType ===
    "missing_track";

  const normalizedArtistNames =
    artistNames
      .map(
        (
          name,
        ) =>
          name.trim(),
      )
      .filter(
        Boolean,
      );

  const resolveTrackUrl =
    useCallback(
      async (
        rawUrl: string,
      ) => {
        const url =
          rawUrl.trim();

        if (
          !url ||
          !isMissingTrack
        ) {
          return;
        }

        if (
          lastResolvedUrlRef.current ===
          url
        ) {
          return;
        }

        setResolvingTrackUrl(
          true,
        );
        setTrackMetadataMessage(
          null,
        );
        setError(
          null,
        );

        try {
          const metadata =
            await resolvePublicTrackMetadata(
              url,
            );

          lastResolvedUrlRef.current =
            url;

          if (
            metadata.title
          ) {
            setTrackTitle(
              metadata.title,
            );
          }

          if (
            metadata.artistNames.length >
            0
          ) {
            setArtistNames(
              metadata.artistNames,
            );
          }

          setTrackMetadataMessage(
            metadata.releaseTitle
              ? `Filled from ${metadata.providerKey.replace(/_/g, " ")} · ${metadata.releaseTitle}`
              : `Filled from ${metadata.providerKey.replace(/_/g, " ")}`,
          );
        } catch (reason) {
          setTrackMetadataMessage(
            null,
          );
          setError(
            reason instanceof Error
              ? reason.message
              : "Track details could not be read from that link.",
          );
        } finally {
          setResolvingTrackUrl(
            false,
          );
        }
      },
      [
        isMissingTrack,
      ],
    );

  useEffect(
    () => {
      if (
        !open ||
        !isMissingTrack
      ) {
        return;
      }

      const url =
        sourceUrl.trim();

      if (
        !url ||
        url ===
          lastResolvedUrlRef.current
      ) {
        return;
      }

      const timeout =
        window.setTimeout(
          () => {
            void resolveTrackUrl(
              url,
            );
          },
          700,
        );

      return () =>
        window.clearTimeout(
          timeout,
        );
    },
    [
      open,
      isMissingTrack,
      sourceUrl,
      resolveTrackUrl,
    ],
  );

  const handleSubmit = useCallback(async () => {
    if (!userId) return;

    if (
      isMissingTrack
    ) {
      if (
        !playlistSubmission
      ) {
        setError(
          "Playlist submission context is unavailable.",
        );
        return;
      }

      if (
        !trackTitle.trim()
      ) {
        setError(
          "Add the track title.",
        );
        return;
      }

      if (
        normalizedArtistNames.length <
        1
      ) {
        setError(
          "Add at least one artist.",
        );
        return;
      }
    } else if (
      !description.trim()
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (
        isMissingTrack &&
        playlistSubmission
      ) {
        await submitPublicMissingTrack({
          playlistId:
            playlistSubmission.playlistId,
          playlistSlug:
            playlistSubmission.playlistSlug,
          trackTitle:
            trackTitle.trim(),
          artistNames:
            normalizedArtistNames,
          details:
            description.trim() ||
            undefined,
          trackUrl:
            sourceUrl.trim() ||
            undefined,
          idempotencyKey:
            submissionKey,
        });
      } else {
        await createContribution({
        sourceCommentId: sourceCommentId || undefined,
        entityType: entity.type,
        entityId: entity.id,
        entitySlug: entity.slug,
        contributionType: selectedType,
        payload: {
          description: description.trim(),
          source_url: sourceUrl.trim() || null,
        },
      });
      }

      trackEvent("community_contribution", {
        pageType:
          entity.type === "playlist"
            ? "playlist"
            : "article",
        entitySlug: entity.slug,
        entityType: entity.type,
        context: {
          contribution_type: selectedType,
          source_comment_id: sourceCommentId || null,
          entity_title: entity.title,
        },
      });
      setStep("success");
      setTimeout(() => onClose(), 2000);
    } catch (e: any) {
      setError(e?.message || "Failed to submit contribution. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    userId,
    description,
    selectedType,
    sourceUrl,
    entity,
    sourceCommentId,
    onClose,
    isMissingTrack,
    playlistSubmission,
    trackTitle,
    normalizedArtistNames,
    submissionKey,
  ]);

  if (!open) return null;

  const isValid =
    isMissingTrack
      ? (
          trackTitle.trim().length >
            0 &&
          normalizedArtistNames.length >
            0
        )
      : description.trim().length >=
        10;

  return (
    <Portal>
      <div className="share-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div ref={sheetRef} className="share-sheet" onClick={(e) => e.stopPropagation()}>
          {/* Drag handle */}
          <div className="share-handle" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="share-handle-bar" />
          </div>

          <div className="share-sheet-scroll">
            {/* Header */}
            <div className="share-header">
              <div>
                <div className="share-title">
                  {step === "success" ? "Contribution submitted" : title}
                </div>
                {step === "form" && (
                  <div className="share-sub">
                    {entity.type === "artist" ? "Artist" : entity.type === "track" ? "Track" : entity.type === "release" ? "Release" : entity.type === "playlist" ? "Playlist" : entity.type} · {entity.title}
                  </div>
                )}
              </div>
              <button className="share-close-btn" onClick={onClose} aria-label="Close">
                <i className="ri-close-line text-[16px]" />
              </button>
            </div>

            {step === "success" ? (
              <div className="px-5 pb-6">
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--wk-brand-soft)] flex items-center justify-center">
                    <i className="ri-check-line text-[26px] text-[var(--wk-brand)]" />
                  </div>
                  <p className="text-[15px] font-bold text-[var(--wk-text)] mb-1">Thank you for contributing</p>
                  <p className="text-[12px] text-[var(--wk-text-muted)] max-w-xs mx-auto">
                    Your suggestion will be reviewed by our editorial team.
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-6">
                {/* Contribution type selector */}
                {visibleTypes.length > 1 && (
                  <div className="mb-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2">
                      Type of contribution
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {visibleTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setSelectedType(type.value)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl text-left border transition-all cursor-pointer ${
                            selectedType === type.value
                              ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                              : "border-[var(--wk-border-2)] hover:border-[var(--wk-border)] hover:bg-[var(--wk-surface)]"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            selectedType === type.value
                              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                              : "bg-[var(--wk-surface)] text-[var(--wk-text-muted)]"
                          }`}>
                            <i className={`${type.icon} text-[13px]`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[12px] font-bold whitespace-nowrap ${
                              selectedType === type.value ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"
                            }`}>
                              {type.label}
                            </p>
                            <p className="text-[10px] text-[var(--wk-text-muted)] leading-tight mt-0.5">
                              {type.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected type indicator */}
                {selectedTypeDef && (
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <i className={`${selectedTypeDef.icon} text-[14px] text-[var(--wk-brand)]`} />
                    <span className="text-[12px] font-semibold text-[var(--wk-brand)]">{selectedTypeDef.label}</span>
                  </div>
                )}

                {isMissingTrack ? (
                  <>
                    <div className="mb-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2 block">
                        Track link <span className="text-[10px] font-normal normal-case tracking-normal">(optional)</span>
                      </label>

                      <div className="relative">
                        <input
                          type="url"
                          value={sourceUrl}
                          onChange={(event) => {
                            setSourceUrl(event.target.value);
                            lastResolvedUrlRef.current = "";
                            setTrackMetadataMessage(null);
                            setError(null);
                          }}
                          onBlur={() => {
                            if (sourceUrl.trim()) {
                              void resolveTrackUrl(sourceUrl);
                            }
                          }}
                          placeholder="Spotify, Apple Music, YouTube, or SoundCloud"
                          className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-2.5 pr-11 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                        />

                        {resolvingTrackUrl ? (
                          <i className="ri-loader-4-line animate-spin absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-[var(--wk-brand)]" />
                        ) : null}
                      </div>

                      {trackMetadataMessage ? (
                        <p className="mt-1.5 text-[10px] font-semibold text-[var(--wk-brand)]">
                          {trackMetadataMessage}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[10px] text-[var(--wk-text-faint)]">
                          Paste a supported track link and WAKILISHA will fill what it can. You can edit everything below.
                        </p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2 block">
                        Track title <span className="text-[var(--wk-danger)]">*</span>
                      </label>

                      <input
                        value={trackTitle}
                        onChange={(event) => {
                          setTrackTitle(event.target.value);
                          setError(null);
                        }}
                        maxLength={500}
                        placeholder="Track title"
                        className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-2.5 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                      />
                    </div>

                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
                          Artist(s) <span className="text-[var(--wk-danger)]">*</span>
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            setArtistNames((current) => [
                              ...current,
                              "",
                            ])
                          }
                          className="text-[10px] font-bold text-[var(--wk-brand)] hover:underline"
                        >
                          Add artist
                        </button>
                      </div>

                      <div className="space-y-2">
                        {artistNames.map((artistName, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2"
                          >
                            <input
                              value={artistName}
                              onChange={(event) =>
                                setArtistNames((current) =>
                                  current.map((value, artistIndex) =>
                                    artistIndex === index
                                      ? event.target.value
                                      : value,
                                  ),
                                )
                              }
                              maxLength={300}
                              placeholder={`Artist ${index + 1}`}
                              className="min-w-0 flex-1 bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-2.5 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                            />

                            {artistNames.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setArtistNames((current) =>
                                    current.filter(
                                      (_, artistIndex) =>
                                        artistIndex !== index,
                                    ),
                                  )
                                }
                                aria-label={`Remove artist ${index + 1}`}
                                className="w-9 h-9 shrink-0 rounded-full border border-[var(--wk-border-2)] text-[var(--wk-text-muted)] hover:text-[var(--wk-danger)]"
                              >
                                <i className="ri-close-line text-[14px]" />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2 block">
                        {descriptionLabel} <span className="text-[10px] font-normal normal-case tracking-normal">(optional)</span>
                      </label>

                      <textarea
                        value={description}
                        onChange={(event) => {
                          setDescription(event.target.value);
                          setError(null);
                        }}
                        placeholder={descriptionPlaceholder}
                        rows={2}
                        maxLength={1000}
                        className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] resize-none focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Description */}
                    <div className="mb-4">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2 block">
                        {descriptionLabel} <span className="text-[var(--wk-danger)]">*</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setError(null);
                        }}
                        placeholder={descriptionPlaceholder}
                        rows={4}
                        maxLength={1000}
                        className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] resize-none focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-[10px] ${description.length >= 1000 ? "text-[var(--wk-danger)] font-bold" : "text-[var(--wk-text-faint)]"}`}>
                          {description.length}/1000
                        </span>
                        {description.length < 10 && description.length > 0 && (
                          <span className="text-[10px] text-[var(--wk-warning)]">At least 10 characters needed</span>
                        )}
                      </div>
                    </div>

                    {/* Source URL */}
                    <div className="mb-5">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2 block">
                        Source URL <span className="text-[10px] font-normal normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-[var(--wk-bg)] border border-[var(--wk-border-2)] rounded-xl px-4 py-2.5 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
                      />
                    </div>
                  </>
                )}

                {/* Error */}
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-[var(--wk-danger-soft)] border border-[var(--wk-danger-soft)]">
                    <p className="text-[12px] font-semibold text-[var(--wk-danger)]">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!isValid || submitting || !userId}
                  className="w-full h-12 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-bold cursor-pointer transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-[16px]" />
                      Submitting...
                    </>
                  ) : !userId ? (
                    "Sign in to contribute"
                  ) : (
                    <>
                      <i className="ri-send-plane-line text-[15px]" />
                      {submitLabel}
                    </>
                  )}
                </button>

                <p className="text-[10px] text-[var(--wk-text-faint)] text-center mt-3">
                  {reviewNote}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}