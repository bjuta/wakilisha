import { useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface TrackLyricsSectionProps {
  trackSlug: string;
  artistSlug: string;
  trackTitle: string;
  artistName: string;
  lyrics?: string | null;
  lyricsContributor?: { name: string; source?: string } | null;
}

export default function TrackLyricsSection({
  trackSlug,
  artistSlug,
  trackTitle,
  artistName,
  lyrics,
  lyricsContributor,
}: TrackLyricsSectionProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);
  const [expanded, setExpanded] = useState(false);

  const hasLyrics = !!lyrics && lyrics.trim().length > 0;
  const contributeUrl = `/tracks/${artistSlug}/${trackSlug}/lyrics/contribute`;

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--wk-border)]">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              <WkIcon name="FileText" size={12} />
              Lyrics
            </div>
            {hasLyrics && lyricsContributor && (
              <span className="text-[10px] font-semibold text-[var(--wk-text-faint)]">
                Contributed by {lyricsContributor.name}
              </span>
            )}
          </div>
          {hasLyrics && (
            <Link
              to={contributeUrl}
              className="text-[11px] font-bold text-[var(--wk-brand)] hover:opacity-80 transition-opacity"
            >
              Suggest correction
            </Link>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          {hasLyrics ? (
            <>
              <div
                className={`text-[14px] leading-[2.2] text-[var(--wk-text-soft)] whitespace-pre-wrap ${
                  expanded ? "" : "max-h-[300px] overflow-hidden relative"
                }`}
              >
                {lyrics}
                {!expanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--wk-surface)] to-transparent pointer-events-none" />
                )}
              </div>
              {!expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <i className="ri-arrow-down-s-line" />
                  Show full lyrics
                </button>
              )}
              {expanded && (
                <button
                  onClick={() => setExpanded(false)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <i className="ri-arrow-up-s-line" />
                  Collapse
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]/50">
                <WkIcon name="FileText" size={24} className="text-[var(--wk-brand)]" />
              </div>
              <h3 className="text-[15px] font-extrabold text-[var(--wk-text)] mb-2">
                No lyrics yet
              </h3>
              <p className="text-[13px] text-[var(--wk-text-muted)] mb-5 max-w-[320px] mx-auto leading-relaxed">
                Be the first to add lyrics for <strong className="text-[var(--wk-text)]">{trackTitle}</strong>.
                You can paste the words now. Timing is not required.
              </p>
              <Link
                to={contributeUrl}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--wk-brand)] text-white px-6 py-3 text-[13px] font-extrabold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <WkIcon name="Edit3" size={15} />
                Contribute Lyrics
              </Link>
              <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-shield-check-line" /> Verified before publishing
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-user-star-line" /> You get credit
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
