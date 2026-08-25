import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  fetchPublicTrackLyrics,
  lyricsDocumentToDisplayText,
  trackLyricsPublicAttribution,
  type TrackLyricsDocument,
} from "@/services/player/trackLyricsService";

interface TrackLyricsSectionProps {
  trackId?: string | null;
  trackSlug: string;
  artistSlug: string;
  trackTitle: string;
  artistName: string;
  lyrics?: string | null;
  lyricsContributor?: { name: string; source?: string } | null;
}

export default function TrackLyricsSection({
  trackId,
  trackSlug,
  artistSlug,
  trackTitle,
  artistName,
  lyrics,
  lyricsContributor,
}: TrackLyricsSectionProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);
  const [expanded, setExpanded] = useState(false);
  const [governedLyrics, setGovernedLyrics] =
    useState<TrackLyricsDocument | null>(null);
  const [governedLoaded, setGovernedLoaded] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!trackId) {
      setGovernedLyrics(null);
      setGovernedLoaded(true);
      return () => {
        alive = false;
      };
    }

    setGovernedLoaded(false);
    fetchPublicTrackLyrics(trackId)
      .then((document) => {
        if (alive) setGovernedLyrics(document);
      })
      .catch(() => {
        if (alive) setGovernedLyrics(null);
      })
      .finally(() => {
        if (alive) setGovernedLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [trackId]);

  const governedText =
    lyricsDocumentToDisplayText(governedLyrics);
  const fallbackText = lyrics?.trim() || "";
  const resolvedLyrics = governedText || fallbackText;
  const hasLyrics = resolvedLyrics.length > 0;
  const governedAttribution =
    trackLyricsPublicAttribution(governedLyrics);
  const fallbackAttribution =
    lyricsContributor?.name
      ? `Lyrics contributed by ${lyricsContributor.name}.`
      : null;
  const attribution = governedAttribution || fallbackAttribution;
  const contributeUrl = `/tracks/${artistSlug}/${trackSlug}/lyrics/contribute${
    trackId ? `?track_id=${encodeURIComponent(trackId)}` : ""
  }`;

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              <WkIcon name="FileText" size={12} />
              Lyrics
            </div>
            {hasLyrics && attribution ? (
              <span className="truncate text-[10px] font-semibold text-[var(--wk-text-faint)]">
                {attribution}
              </span>
            ) : null}
          </div>
          {hasLyrics ? (
            <Link
              to={contributeUrl}
              className="shrink-0 text-[11px] font-bold text-[var(--wk-brand)] transition-opacity hover:opacity-80"
            >
              Suggest correction
            </Link>
          ) : null}
        </div>

        <div className="px-5 py-5">
          {!governedLoaded && trackId ? (
            <div className="py-8 text-center text-[12px] text-[var(--wk-text-muted)]">
              Loading published Lyrics…
            </div>
          ) : hasLyrics ? (
            <>
              <div
                className={`whitespace-pre-wrap text-[14px] leading-[2.2] text-[var(--wk-text-soft)] ${
                  expanded ? "" : "relative max-h-[300px] overflow-hidden"
                }`}
              >
                {resolvedLyrics}
                {!expanded ? (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--wk-surface)] to-transparent" />
                ) : null}
              </div>
              {!expanded ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] transition-opacity hover:opacity-80"
                >
                  <i className="ri-arrow-down-s-line" />
                  Show full lyrics
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] transition-opacity hover:opacity-80"
                >
                  <i className="ri-arrow-up-s-line" />
                  Collapse
                </button>
              )}

              {governedAttribution ? (
                <p className="mt-5 border-t border-[var(--wk-border)] pt-4 text-[11px] leading-5 text-[var(--wk-text-faint)]">
                  {governedAttribution}
                </p>
              ) : null}
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]/50">
                <WkIcon name="FileText" size={24} className="text-[var(--wk-brand)]" />
              </div>
              <h3 className="mb-2 text-[15px] font-extrabold text-[var(--wk-text)]">
                No lyrics yet
              </h3>
              <p className="mx-auto mb-5 max-w-[320px] text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                Be the first to add lyrics for <strong className="text-[var(--wk-text)]">{trackTitle}</strong> by {artistName}.
                You can paste the words now. Timing is not required.
              </p>
              <Link
                to={contributeUrl}
                className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90"
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
