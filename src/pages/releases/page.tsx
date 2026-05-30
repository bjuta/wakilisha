import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { ReleaseCard } from "@/components/design-system/registry/ReleaseCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import { RELEASES, RELEASE_FILTERS } from "@/mocks/releases";

export default function Releases() {
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = filter === "All" ? RELEASES : RELEASES.filter((r) => r.releaseType === filter);

  return (
    <>
      <PageHero
        eyebrow="Registry"
        title="Release catalog"
        subtitle={`${RELEASES.length} releases catalogued. Albums, EPs, and singles from the repaired graph.`}
      />

      <div className="wk-container px-6 py-10">
        <div className="mb-6 flex flex-wrap gap-2">
          {RELEASE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
          {filtered.length} release{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonSquare key={i} />)
            : filtered.map((release) => <ReleaseCard key={release.slug} {...release} />)}
        </div>
      </div>
    </>
  );
}