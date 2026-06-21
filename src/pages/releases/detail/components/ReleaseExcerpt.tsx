import { useScrollReveal } from "@/hooks/useScrollReveal";
import type { PublicReleaseDetail } from "@/services/publicContent/client";
import { buildReleaseCultureText } from "@/services/cultureContext/releaseAdapters";

interface ReleaseExcerptProps {
  release: PublicReleaseDetail;
}

export default function ReleaseExcerpt({ release }: ReleaseExcerptProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);
  const whyItMatters = buildReleaseCultureText(release, "whyItMatters");

  const chips: string[] = [
    release.trackCount > 0 ? `${release.trackCount} track${release.trackCount === 1 ? "" : "s"}` : "",
    release.labelName && release.labelName !== "WAKILISHA Registry" && release.labelName !== "WAKILISHA" && release.labelName !== "Independent" && release.labelName !== "Unknown" ? release.labelName : "",
  ].filter(Boolean);

  if (!whyItMatters) return null;

  return (
    <section
      ref={ref}
      className={`${revealed ? "is-visible" : ""} reveal-up`}
    >
      <div className="relative border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] overflow-hidden">
        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-[var(--wk-brand)]" />

        <div className="px-6 py-5 pl-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center text-[var(--wk-brand)]">
                <i className="ri-compass-3-line text-[14px]" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                Why this release matters
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-end">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-text-muted)] whitespace-nowrap"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {whyItMatters && (
            <p className="text-[14px] leading-[1.8] text-[var(--wk-text-soft)]">
              {whyItMatters}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
