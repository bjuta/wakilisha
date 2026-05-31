import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { LabelCard } from "@/components/design-system/registry/LabelCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import { LabelsStats } from "./components/LabelsStats";
import { LabelSpotlight } from "./components/LabelSpotlight";
import { FeaturedLabelsShelf } from "./components/FeaturedLabelsShelf";
import { LabelTiers } from "./components/LabelTiers";
import { CountryLabels } from "./components/CountryLabels";
import { LABELS, FEATURED_LABELS } from "@/mocks/labels";
import { RELEASES } from "@/mocks/releases";

const PAGE_SIZE = 12;

// Derive label-to-artists mapping from releases
const LABEL_ARTISTS: Record<string, string[]> = {};
RELEASES.forEach((r) => {
  if (!LABEL_ARTISTS[r.labelName]) {
    LABEL_ARTISTS[r.labelName] = [];
  }
  if (!LABEL_ARTISTS[r.labelName].includes(r.artist)) {
    LABEL_ARTISTS[r.labelName].push(r.artist);
  }
});

// Get label names for matching
const LABEL_NAME_MAP: Record<string, typeof LABELS[0]> = {};
LABELS.forEach((l) => {
  LABEL_NAME_MAP[l.name] = l;
  // Also map by common variations
  if (l.name.includes("Mavin")) LABEL_NAME_MAP["Mavin Records"] = l;
  if (l.name.includes("YBNL")) LABEL_NAME_MAP["YBNL Nation"] = l;
  if (l.name.includes("Atlantic")) LABEL_NAME_MAP["Atlantic Records"] = l;
  if (l.name.includes("RCA")) LABEL_NAME_MAP["RCA Records"] = l;
  if (l.name.includes("Interscope")) LABEL_NAME_MAP["Interscope"] = l;
});

export default function Labels() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filtered = LABELS.filter(
    (l) =>
      !query.trim() ||
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      (l.country || "").toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = [
    { label: "Labels", value: LABELS.length },
    { label: "Artists rostered", value: LABELS.reduce((s, l) => s + l.artistCount, 0) },
    { label: "Releases", value: LABELS.reduce((s, l) => s + l.releaseCount, 0) },
    { label: "Countries", value: new Set(LABELS.map((l) => l.country).filter(Boolean)).size },
    { label: "Featured", value: FEATURED_LABELS.length },
    {
      label: "Avg roster size",
      value: Math.round(LABELS.reduce((s, l) => s + l.artistCount, 0) / LABELS.length),
    },
  ];

  // Pick the top featured label for spotlight
  const spotlightLabel = useMemo(() => {
    const top = FEATURED_LABELS.sort((a, b) => b.artistCount - a.artistCount)[0];
    if (!top) return null;
    const artists = LABEL_ARTISTS[top.name] || [];
    const topReleases = RELEASES.filter((r) => r.labelName === top.name)
      .sort((a, b) => b.year - a.year)
      .slice(0, 3)
      .map((r) => r.title);
    return {
      ...top,
      topArtists: artists.slice(0, 5),
      topReleases,
      imageUrl:
        "https://readdy.ai/api/search-image?query=Abstract%20music%20studio%20interior%20with%20warm%20golden%20lighting%2C%20vinyl%20records%20on%20shelves%2C%20sound%20mixing%20equipment%2C%20editorial%20music%20industry%20photography%2C%20dramatic%20shadows%2C%20professional%20aesthetic%2C%20no%20text%20visible%2C%20dark%20moody%20atmosphere%20with%20amber%20and%20gold%20tones&width=1400&height=800&seq=label-spotlight-v1&orientation=landscape",
    };
  }, []);

  const goToPage = (p: number) => {
    setPage(p);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <PageHero
        eyebrow="Registry"
        title="Labels"
        subtitle={`${LABELS.length} record labels building the African music ecosystem. From global majors to local independents.`}
        variant="full"
        imageUrl="https://readdy.ai/api/search-image?query=Abstract%20music%20industry%20institutional%20background%2C%20geometric%20patterns%2C%20vinyl%20records%20and%20sound%20waves%2C%20dark%20professional%20aesthetic%20with%20warm%20gold%20and%20amber%20accents%2C%20no%20text%2C%20cinematic%20lighting%2C%20editorial%20style%2C%20dramatic%20moody%20atmosphere&width=1400&height=800&seq=label-hero-v3&orientation=landscape"
      />

      {/* Ecosystem Stats */}
      <LabelsStats stats={stats} />

      {/* Label Spotlight */}
      {!loading && spotlightLabel && (
        <LabelSpotlight
          slug={spotlightLabel.slug}
          name={spotlightLabel.name}
          country={spotlightLabel.country}
          artistCount={spotlightLabel.artistCount}
          releaseCount={spotlightLabel.releaseCount}
          description={
            spotlightLabel.description ||
            `${spotlightLabel.name} is a ${spotlightLabel.country} label with ${spotlightLabel.artistCount} artists and ${spotlightLabel.releaseCount} releases in the WAKILISHA ecosystem.`
          }
          topArtists={spotlightLabel.topArtists}
          topReleases={spotlightLabel.topReleases}
          year={
            "year" in spotlightLabel && typeof spotlightLabel.year === "string"
              ? spotlightLabel.year
              : undefined
          }
          imageUrl={spotlightLabel.imageUrl}
        />
      )}

      {/* Featured Labels Shelf */}
      {!loading && (
        <FeaturedLabelsShelf
          labels={FEATURED_LABELS.map((l) => ({
            ...l,
            description:
              "description" in l && typeof l.description === "string"
                ? l.description
                : undefined,
          }))}
        />
      )}

      {/* Label Tiers */}
      {!loading && <LabelTiers labels={LABELS} />}

      {/* Country Groups */}
      {!loading && <CountryLabels labels={LABELS} />}

      {/* Cross-sell: Artists on these labels */}
      {!loading && (
        <section className="bg-[var(--wk-surface)]">
          <div className="wk-container px-6 py-14 md:py-20">
            <div className="mb-10">
              <div className="wk-eyebrow mb-3">Rosters</div>
              <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                The artists they signed
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURED_LABELS.map((label) => {
                const artists = LABEL_ARTISTS[label.name] || [];
                if (artists.length === 0) return null;
                return (
                  <Link
                    key={label.slug}
                    to={`/labels/${label.slug}`}
                    className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[16px] font-black text-[var(--wk-brand-on)]">
                        {label.name.split(/[\s&]/)[0].charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-[var(--wk-text)]">
                          {label.name}
                        </h4>
                        <span className="text-[12px] text-[var(--wk-text-muted)]">
                          {artists.length} artist{artists.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {artists.map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-[12px] font-bold text-[var(--wk-brand)] transition-colors group-hover:text-[var(--wk-brand-2)]">
                      See full roster
                      <i className="ri-arrow-right-line text-[11px]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Directory — search, paginated grid */}
      <div ref={gridRef} className="wk-container-wide px-6 py-14 md:py-20">
        <div className="mb-6 flex items-center gap-3">
          <div className="wk-eyebrow">Full directory</div>
          <span className="text-[12px] text-[var(--wk-text-muted)]">
            {LABELS.length} labels
          </span>
        </div>

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

        <div className="mb-4 flex items-center justify-between text-[13px]">
          <span className="text-[var(--wk-text-muted)]">
            {filtered.length} label{filtered.length !== 1 ? "s" : ""}
            {query.trim() && ` matching "${query.trim()}"`}
          </span>
          {totalPages > 1 && (
            <span className="text-[var(--wk-text-faint)]">
              Page {page} of {totalPages}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonSquare key={i} />)
            : paginated.map((label) => (
                <LabelCard
                  key={label.slug}
                  slug={label.slug}
                  name={label.name}
                  country={label.country}
                  artistCount={label.artistCount}
                  releaseCount={label.releaseCount}
                  isFeatured={label.isFeatured}
                />
              ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-left-line text-sm" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 5) {
                if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`h-9 min-w-[36px] rounded-lg px-2 text-[13px] font-bold transition-all ${
                    page === p
                      ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                      : "border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        )}

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