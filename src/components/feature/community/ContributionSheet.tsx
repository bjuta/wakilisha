import { useState, useRef, useCallback, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { trackEvent } from "@/services/analytics";
import { createContribution } from "@/services/community";
import type { CommunityEntity } from "@/services/community";
import { Portal } from "@/components/base/Portal";

// ── Contribution types ─────────────────────────────────────────────────────

const CONTRIBUTION_TYPES = [
  { value: "correction", label: "Correction", icon: "ri-edit-line", description: "Fix inaccurate or outdated information" },
  { value: "missing_credit", label: "Missing Credit", icon: "ri-user-add-line", description: "Add uncredited artists, producers, or contributors" },
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
}

// ── Component ──────────────────────────────────────────────────────────────

export function ContributionSheet({
  entity,
  open,
  onClose,
  userId,
  sourceCommentId,
}: ContributionSheetProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedType, setSelectedType] = useState<string>("correction");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
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
      setSelectedType("correction");
      setDescription("");
      setSourceUrl("");
      setError(null);
    }
  }, [open]);

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

  const selectedTypeDef = CONTRIBUTION_TYPES.find((t) => t.value === selectedType);

  const handleSubmit = useCallback(async () => {
    if (!userId || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
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
      trackEvent("community_contribution", {
        pageType: "article",
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
  }, [userId, description, selectedType, sourceUrl, entity, sourceCommentId, onClose]);

  if (!open) return null;

  const isValid = description.trim().length >= 10;

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
                  {step === "success" ? "Contribution submitted" : "Suggest a Correction"}
                </div>
                {step === "form" && (
                  <div className="share-sub">
                    {entity.type === "artist" ? "Artist" : entity.type === "track" ? "Track" : entity.type === "release" ? "Release" : entity.type} · {entity.title}
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
                <div className="mb-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2">
                    Type of contribution
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CONTRIBUTION_TYPES.map((type) => (
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

                {/* Selected type indicator */}
                {selectedTypeDef && (
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <i className={`${selectedTypeDef.icon} text-[14px] text-[var(--wk-brand)]`} />
                    <span className="text-[12px] font-semibold text-[var(--wk-brand)]">{selectedTypeDef.label}</span>
                  </div>
                )}

                {/* Description */}
                <div className="mb-4">
                  <label className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] mb-2 block">
                    Describe the issue <span className="text-[var(--wk-danger)]">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setError(null);
                    }}
                    placeholder="What information is incorrect or missing? Be as specific as possible..."
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
                      Submit Correction
                    </>
                  )}
                </button>

                <p className="text-[10px] text-[var(--wk-text-faint)] text-center mt-3">
                  All contributions are reviewed by our editorial team before being published.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}