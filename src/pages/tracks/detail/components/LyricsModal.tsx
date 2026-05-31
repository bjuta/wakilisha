import { useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { WkButton } from "@/components/design-system/primitives/Button";

interface LyricsContributor {
  name: string;
  submittedAt: string;
  source?: string;
}

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle: string;
  artistName: string;
  existingLyrics?: string;
  existingContributors?: LyricsContributor[];
}

export default function LyricsModal({
  isOpen,
  onClose,
  trackTitle,
  artistName,
  existingLyrics,
  existingContributors,
}: LyricsModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lyrics, setLyrics] = useState(existingLyrics || "");
  const [source, setSource] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name so we can credit you.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!lyrics.trim()) {
      setError("Please enter the lyrics you want to submit.");
      return;
    }
    if (lyrics.length > 5000) {
      setError("Lyrics are too long. Please keep it under 5000 characters.");
      return;
    }

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      data.append(key, value as string);
    }

    fetch("https://readdy.ai/api/form/d8doe97ejtnocflsndo0", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data.toString(),
    })
      .then(() => {
        setSubmitted(true);
      })
      .catch(() => {
        setError("Something went wrong. Please try again.");
      });
  };

  const isEditing = !!existingLyrics;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div data-scroll-lock="container" className="relative w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--wk-divider)] bg-[var(--wk-surface)] px-6 py-4">
          <div>
            <h3 className="text-[16px] font-bold text-[var(--wk-text)]">
              {isEditing ? "Suggest lyrics correction" : "Contribute lyrics"}
            </h3>
            <p className="text-[12px] text-[var(--wk-text-muted)]">
              {trackTitle} by {artistName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--wk-surface-raised)] transition-colors"
          >
            <i className="ri-close-line text-[var(--wk-text-muted)]" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]">
              <i className="ri-check-line text-3xl text-[var(--wk-brand)]" />
            </div>
            <h4 className="mb-2 text-[18px] font-bold text-[var(--wk-text)]">
              {isEditing ? "Correction submitted!" : "Lyrics submitted!"}
            </h4>
            <p className="text-[14px] text-[var(--wk-text-muted)] leading-relaxed mb-6">
              {isEditing
                ? `Thanks for helping keep the lyrics accurate. We will review your suggestion and update the page if approved.`
                : `Thanks, ${name}! Your lyrics are now under review. Once approved, you will be credited as the contributor on this track page.`}
            </p>
            <WkButton variant="primary" onClick={onClose}>
              Done
            </WkButton>
          </div>
        ) : (
          <form
            id="lyrics-contribution-form"
            data-readdy-form
            onSubmit={handleSubmit}
            className="px-6 py-5 space-y-5"
          >
            {/* Track info (hidden inputs) */}
            <input type="hidden" name="song_title" value={trackTitle} />
            <input type="hidden" name="artist_name" value={artistName} />

            {/* Description */}
            <div className="rounded-xl bg-[var(--wk-surface-raised)] p-4">
              <div className="flex items-start gap-3">
                <i className="ri-lightbulb-line text-[var(--wk-brand)] mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-[var(--wk-text)] mb-1">
                    {isEditing
                      ? "Suggest a correction to the existing lyrics"
                      : "Be the first to add lyrics for this track"}
                  </p>
                  <p className="text-[12px] text-[var(--wk-text-muted)] leading-relaxed">
                    {isEditing
                      ? "If you spot errors or missing sections, paste the corrected version below. Our team will review your changes."
                      : "Paste the lyrics below. We will review and publish them within 24 hours. You will get full credit as the contributor."}
                  </p>
                </div>
              </div>
            </div>

            {/* Contributor info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-[var(--wk-text-muted)] uppercase tracking-wider mb-2">
                  Your name <span className="text-[var(--wk-danger)]">*</span>
                </label>
                <input
                  type="text"
                  name="contributor_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aisha M."
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/50"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-[var(--wk-text-muted)] uppercase tracking-wider mb-2">
                  Email <span className="text-[var(--wk-danger)]">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aisha@example.com"
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/50"
                />
              </div>
            </div>

            {/* Lyrics text */}
            <div>
              <label className="block text-[12px] font-bold text-[var(--wk-text-muted)] uppercase tracking-wider mb-2">
                Lyrics <span className="text-[var(--wk-danger)]">*</span>
              </label>
              <textarea
                name="lyrics_text"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Paste the full lyrics here..."
                rows={10}
                maxLength={5000}
                className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/50 resize-none"
              />
              <div className="mt-1 text-right text-[11px] text-[var(--wk-text-faint)]">
                {lyrics.length}/5000
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-[12px] font-bold text-[var(--wk-text-muted)] uppercase tracking-wider mb-2">
                Source <span className="text-[var(--wk-text-faint)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="source_link"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Where did you find these lyrics? e.g. official website, CD booklet"
                className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/50"
              />
            </div>

            {/* Existing contributors note */}
            {existingContributors && existingContributors.length > 0 && !isEditing && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
                <i className="ri-user-heart-line text-[var(--wk-brand)]" />
                <span>
                  {existingContributors[0].name} contributed the current version.
                  Your submission will be reviewed as a correction.
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--wk-danger-soft)] px-4 py-3 text-[13px] text-[var(--wk-danger)]">
                <i className="ri-error-warning-line" />
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <WkButton
                type="submit"
                variant="primary"
                className="!w-auto"
              >
                <i className="ri-send-plane-line" />
                {isEditing ? "Submit correction" : "Submit lyrics"}
              </WkButton>
              <button
                type="button"
                onClick={onClose}
                className="text-[13px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Trust note */}
            <div className="flex items-center gap-4 text-[11px] text-[var(--wk-text-faint)] pt-2 border-t border-[var(--wk-divider)]">
              <span className="inline-flex items-center gap-1">
                <i className="ri-shield-check-line" /> Verified before publishing
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="ri-user-star-line" /> You get credit
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="ri-time-line" /> Reviewed in 24h
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}