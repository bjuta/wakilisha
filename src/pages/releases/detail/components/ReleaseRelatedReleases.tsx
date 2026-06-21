import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { releaseUrl } from "@/utils/releaseUrl";
import type { PublicRelease } from "@/services/publicContent/client";

interface ReleaseRelatedReleasesProps {
  releases: PublicRelease[];
  currentReleaseSlug: string;
  artistName: string;
}

export default function ReleaseRelatedReleases({
  releases,
  currentReleaseSlug,
  artistName,
}: ReleaseRelatedReleasesProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);

  const filtered = releases
    .filter((r) => r.slug !== currentReleaseSlug)
    .slice(0, 6);

  if (filtered.length === 0) return null;

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Disc3" size={12} />
            Related releases
          </div>
          <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
            From {artistName}'s catalog
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {filtered.map((release) => (
            <Link
              key={release.slug}
              to={releaseUrl(release)}
              className="group flex flex-col"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-[var(--wk-bg)] border border-[var(--wk-border)] mb-3">
                {release.artworkUrl ? (
                  <img
                    src={release.artworkUrl}
                    alt={release.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--wk-surface-raised)]">
                    <WkIcon name="Album" size={24} className="text-[var(--wk-text-faint)]" />
                  </div>
                )}
              </div>
              <div className="text-[13px] font-extrabold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors leading-tight">
                {release.title}
              </div>
              <div className="text-[11px] font-semibold text-[var(--wk-text-muted)] truncate mt-0.5">
                {release.releaseType} · {release.year}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}