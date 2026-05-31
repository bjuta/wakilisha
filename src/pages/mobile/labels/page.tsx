import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { LabelCard } from "@/components/design-system/registry/LabelCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import { CountryLabels } from "@/pages/labels/components/CountryLabels";
import { LabelTiers } from "@/pages/labels/components/LabelTiers";
import { LABELS, FEATURED_LABELS } from "@/mocks/labels";
import { RELEASES } from "@/mocks/releases";

const PAGE_SIZE = 8;

const LABEL_ARTISTS: Record<string, string[]> = {};
RELEASES.forEach((r) => {
  if (!LABEL_ARTISTS[r.labelName]) {
    LABEL_ARTISTS[r.labelName] = [];
  }
  if (!LABEL_ARTISTS[r.labelName].includes(r.artist)) {
    LABEL_ARTISTS[r.labelName].push(r.artist);
  }
});

export default function MobileLabels() {
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
    { label: "Artists", value: LABELS.reduce((s, l) => s + l.artistCount, 0) },
    { label: "Releases", value: LABELS.reduce((s, l) => s + l.releaseCount, 0) },
  ];

  const spotlightLabel = useMemo(() => {
    const top = FEATURED_LABELS.sort((a, b) => b.artistCount - a.artistCount)[0];
    if (!top) return null;
    const artists = LABEL_ARTISTS[top.name] || [];
    return { ...top, artists: artists.slice(0, 5) };
  }, []);

  const goToPage = (p: number) => {
    setPage(p);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20music%20industry%20institutional%20background%2C%20geometric%20patterns%2C%20vinyl%20records%20and%20sound%20waves%2C%20dark%20professional%20aesthetic%20with%20warm%20gold%20and%20amber%20accents%2C%20no%20text%2C%20cinematic%20lighting%2C%20editorial%20style%2C%20dramatic%20moody%20atmosphere&width=1400&height=800&seq=label-hero-v3&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Registry
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[#F0EFE8]" style={{ fontSize: "clamp(42px, 14vw, 64px)" }}>
            Labels
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
            {LABELS.length} record labels building the African music ecosystem.
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
            <div className="text-[18px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Spotlight */}
      {!loading && spotlightLabel && (
        <div className="px-5 py-6">
          <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Spotlight
          </div>
          <Link
            to={`/labels/${spotlightLabel.slug}`}
            className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)]"
          >
            <div className="h-1.5 bg-[var(--wk-brand)]" />
            <div className="bg-[var(--wk-surface)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--wk-brand)] text-[24px] font-black text-[var(--wk-brand-on)]">
                  {spotlightLabel.name.split(/[\s&]/)[0].charAt(0)}
                </div>
                <div>
                  <h2 className="text-[20px] font-black text-[var(--wk-text)]">{spotlightLabel.name}</h2>
                  <span className="text-[12px] text-[var(--wk-text-muted)]">{spotlightLabel.country}</span>
                </div>
              </div>
              {"description" in spotlightLabel && typeof spotlightLabel.description === "string" && (
                <p className="mb-4 text-[13px] leading-[1.5] text-[var(--wk-text-muted)]">
                  {spotlightLabel.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-user-line text-[10px] text-[var(--wk-brand)]" />
                  {spotlightLabel.artistCount} artists
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-album-line text-[10px] text-[var(--wk-brand)]" />
                  {spotlightLabel.releaseCount} releases
                </span>
              </div>
              {spotlightLabel.artists.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {spotlightLabel.artists.map((a: string) => (
                    <span key={a} className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                      {a}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 py-2 text-[12px] font-bold text-[var(--wk-brand-on)]">
                Explore label
                <i className="ri-arrow-right-line" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Featured shelf */}
      {!loading && (
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              Featured
            </div>
            <span className="text-[10px] text-[var(--wk-text-muted)]">{FEATURED_LABELS.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {FEATURED_LABELS.map((label) => (
              <Link
                key={label.slug}
                to={`/labels/${label.slug}`}
                className="group relative block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
                style={{ width: "260px" }}
              >
                <div className="h-1.5 bg-[var(--wk-brand)]" />
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                      <i className="ri-star-line text-[9px]" />
                      Featured
                    </span>
                    <span className="text-[10px] text-[var(--wk-text-muted)]">{label.country}</span>
                  </div>
                  <h4 className="text-[16px] font-black text-[var(--wk-text)]">{label.name}</h4>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                    <span><i className="ri-user-line text-[10px] mr-1" />{label.artistCount}</span>
                    <span><i className="ri-album-line text-[10px] mr-1" />{label.releaseCount}</span>
                  </div>
                  {"description" in label && typeof label.description === "string" && (
                    <p className="mt-2 line-clamp-2 text-[11px] text-[var(--wk-text-muted)]">
                      {label.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tiers */}
      {!loading && <LabelTiers labels={LABELS} />}

      {/* Countries */}
      {!loading && <CountryLabels labels={LABELS} />}

      {/* Roster cross-sell */}
      {!loading && (
        <div className="px-5 py-6">
          <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Roster
          </div>
          <div className="space-y-2">
            {FEATURED_LABELS.slice(0, 3).map((label) => {
              const artists = LABEL_ARTISTS[label.name] || [];
              if (artists.length === 0) return null;
              return (
                <Link
                  key={label.slug}
                  to={`/labels/${label.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[16px] font-black text-[var(--wk-brand-on)]">
                    {label.name.split(/[\s&]/)[0].charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13px] font-bold text-[var(--wk-text)]">{label.name}</h4>
                    <div className="flex flex-wrap gap-1">
                      {artists.slice(0, 3).map((a) => (
                        <span key={a} className="text-[11px] text-[var(--wk-text-muted)]">{a}</span>
                      ))}
                      {artists.length > 3 && (
                        <span className="text-[11px] text-[var(--wk-text-faint)]">+{artists.length - 3}</span>
                      )}
                    </div>
                  </div>
                  <i className="ri-arrow-right-line text-[var(--wk-text-faint)]" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Directory */}
      <div ref={gridRef} className="px-5 py-6">
        <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          Full directory
        </div>

        <div className="relative mb-4">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search labels..."
            className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2.5 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
          />
        </div>

        <div className="mb-3 flex items-center justify-between text-[12px]">
          <span className="text-[var(--wk-text-muted)]">
            {filtered.length} label{filtered.length !== 1 ? "s" : ""}
          </span>
          {totalPages > 1 && (
            <span className="text-[var(--wk-text-faint)]">
              {page}/{totalPages}
            </span>
          )}
        </div>

        <div className="space-y-2">
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
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
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
                  className={`h-8 min-w-[32px] rounded-lg px-1.5 text-[12px] font-bold transition-all ${
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="py-12 text-center text-[var(--wk-text-muted)]">
            <i className="ri-building-2-line mb-3 block text-4xl" />
            No labels match this search.
          </div>
        )}
      </div>
    </div>
  );
}