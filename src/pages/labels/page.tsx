import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { LabelCard } from "@/components/design-system/registry/LabelCard";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { LABELS, FEATURED_LABELS } from "@/mocks/labels";

export default function Labels() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = LABELS.filter(
    (l) =>
      !query.trim() ||
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      (l.country || "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      {/* Institutional Hero — ecosystem feel */}
      <PageHero
        eyebrow="Registry"
        title="Labels directory"
        subtitle="Record labels active in the African music industry, indexed from the repaired release graph."
        variant="standard"
        imageUrl="https://readdy.ai/api/search-image?query=Abstract%20music%20industry%20institutional%20background%2C%20geometric%20patterns%2C%20vinyl%20records%20and%20sound%20waves%2C%20dark%20professional%20aesthetic%20with%20green%20and%20gold%20accents%2C%20no%20text%2C%20cinematic%20lighting%2C%20editorial%20style&width=1400&height=600&seq=label-hero-v2&orientation=landscape"
      />

      <div className="wk-container-wide px-6 py-10">
        {/* Featured labels — horizontal shelf with visual weight */}
        {!loading && (
          <div className="mb-12">
            <div className="mb-5 flex items-center gap-3">
              <div className="wk-eyebrow">Featured labels</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {FEATURED_LABELS.map((label) => (
                <div
                  key={label.slug}
                  className="relative flex-none w-[320px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5"
                >
                  <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[var(--wk-brand-soft)] opacity-40" />
                  <div className="mb-3 flex items-center gap-2">
                    <WkTag variant="brand">Featured</WkTag>
                    {label.country && (
                      <span className="text-[11px] text-[var(--wk-text-muted)]">{label.country}</span>
                    )}
                  </div>
                  <h3 className="text-[18px] font-black text-[var(--wk-text)]">{label.name}</h3>
                  <div className="mt-3 flex items-center gap-4 text-[13px] text-[var(--wk-text-muted)]">
                    <span className="inline-flex items-center gap-1"><i className="ri-user-line" /> {label.artistCount} artists</span>
                    <span className="inline-flex items-center gap-1"><i className="ri-album-line" /> {label.releaseCount} releases</span>
                  </div>
                  {label.featuredArtists && label.featuredArtists.length > 0 && (
                    <div className="mt-4 border-t border-[var(--wk-divider)] pt-3 text-[12px] text-[var(--wk-text-faint)]">
                      {label.featuredArtists.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search labels or countries..."
              className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2.5 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
            />
          </div>
        </div>

        <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
          {filtered.length} label{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                  <div className="h-5 w-40 rounded bg-[var(--wk-surface-raised)] mb-2" />
                  <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)] mb-4" />
                  <div className="flex gap-4">
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ))
            : filtered.map((label) => <LabelCard key={label.slug} {...label} />)}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-building-2-line mb-3 block text-4xl" />
            No labels match this search.
          </div>
        )}
      </div>
    </div>
  );
}