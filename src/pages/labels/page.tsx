import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import {
  listLabels,
  listReleases,
  type RepairedLabel,
  type RepairedRelease,
} from "@/services/repairedContent/client";

const PAGE_SIZE = 24;
const initials = (name: string) =>
  name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function Labels() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All");
  const [page, setPage] = useState(1);
  const [labels, setLabels] = useState<RepairedLabel[]>([]);
  const [releases, setReleases] = useState<RepairedRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [labelsData, releasesData] = await Promise.all([
        listLabels(),
        listReleases(),
      ]);
      setLabels(labelsData);
      setReleases(releasesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load labels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const labelArtists = useMemo(() => {
    const map: Record<string, string[]> = {};
    releases.forEach((release) => {
      const label = release.labelName;
      if (!label) return;
      map[label] ||= [];
      if (!map[label].includes(release.artist)) {
        map[label].push(release.artist);
      }
    });
    return map;
  }, [releases]);

  const countries = useMemo(
    () =>
      ["All", ...Array.from(new Set(labels.map((label) => label.country).filter(Boolean)))],
    [labels]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labels.filter((label) => {
      const roster = labelArtists[label.name] || label.featuredArtists || [];
      const matchesQuery =
        !q ||
        label.name.toLowerCase().includes(q) ||
        (label.country || "").toLowerCase().includes(q) ||
        roster.some((artist) => artist.toLowerCase().includes(q));
      const matchesCountry = country === "All" || label.country === country;
      return matchesQuery && matchesCountry;
    });
  }, [query, country, labels, labelArtists]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const spotlight =
    [...labels]
      .sort(
        (a, b) =>
          b.artistCount + b.releaseCount - (a.artistCount + a.releaseCount)
      )[0] || labels[0];
  const sideLabels = labels
    .filter((label) => label.slug !== spotlight?.slug)
    .slice(0, 4);
  const totalArtists = labels.reduce((sum, label) => sum + label.artistCount, 0);
  const totalReleases = labels.reduce((sum, label) => sum + label.releaseCount, 0);
  const featuredCount = labels.filter((l) => l.isFeatured).length;
  const countryGroups = countries
    .filter((item) => item !== "All")
    .map((name) => ({
      name,
      count: labels.filter((label) => label.country === name).length,
    }))
    .sort((a, b) => b.count - a.count);

  const updateCountry = (next: string) => {
    setCountry(next);
    setPage(1);
  };

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="wk-container-wide px-4 py-20 md:px-6">
          <div className="space-y-4">
            <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            <div className="h-12 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon
            name="Building2"
            size={42}
            className="mx-auto mb-4 text-[var(--wk-text-faint)]"
          />
          <h1 className="wk-h-section mb-2">Could not load labels</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={loadData} className="wk-button wk-button-primary">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="label43-hero">
        <div className="label43-bg" />
        <div className="label43-inner wk-container-wide">
          <div>
            <div className="label43-kicker">
              <WkIcon name="Building2" size={14} /> Institutions
            </div>
            <h1 className="label43-title">Labels</h1>
            <p className="label43-sub">
              Record labels, imprints, distributors, and music institutions
              mapped as ecosystems: rosters, releases, chart presence, country
              footprint, and catalog relationships.
            </p>
            <div className="label43-actions">
              <a
                href="#label-directory"
                className="wk-button wk-button-lg wk-button-primary"
              >
                <WkIcon name="Search" size={18} /> Browse directory
              </a>
              <ShareButton
                item={{
                  title: "WAKILISHA Labels",
                  subtitle: `${labels.length} labels`,
                  description:
                    "Browse WAKILISHA labels and music institutions by country, roster, catalog and chart presence.",
                  type: "page",
                }}
              />
            </div>
          </div>
          <div className="label43-stats">
            <Stat value={labels.length} label="Labels" />
            <Stat value={totalArtists.toLocaleString()} label="Artists" />
            <Stat value={totalReleases.toLocaleString()} label="Releases" />
            <Stat value={featuredCount} label="Featured" />
          </div>
        </div>
      </section>

      <div className="label43-toolbar">
        <div className="directory-filters">
          {countries.slice(0, 14).map((item) => (
            <button
              key={item}
              onClick={() => updateCountry(item)}
              className={`directory-filter ${country === item ? "on" : ""}`}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          className="label43-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search label, country, or roster artist"
        />
      </div>

      <div className="wk-container-wide px-4 py-10 md:px-6">
        {spotlight && (
          <section className="label43-spotlight">
            <Link to={`/labels/${spotlight.slug}`} className="label43-spot-card">
              <div className="label43-spot-body">
                <div className="label43-logo">
                  {spotlight.logoUrl ? (
                    <img src={spotlight.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(spotlight.name)
                  )}
                </div>
                <div className="label43-spot-name">{spotlight.name}</div>
                <div className="label43-spot-meta">
                  {spotlight.country || "Global"} · {spotlight.artistCount}{" "}
                  artists · {spotlight.releaseCount} releases
                </div>
                <p className="label43-spot-copy">
                  {spotlight.description ||
                    `${spotlight.name} is represented in the WAKILISHA registry as a label ecosystem with roster, catalog and chart relationships.`}
                </p>
              </div>
            </Link>
            <div className="label43-side-stack">
              {sideLabels.map((label) => (
                <LabelMini key={label.slug} label={label} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Featured institutions</div>
              <h2 className="section-title">Labels with visible ecosystems</h2>
            </div>
            <p className="section-copy">
              Labels are not decorative logos. Each card exposes roster size,
              releases, chart presence, country, and known artists.
            </p>
          </div>
          <div className="label43-grid">
            {labels
              .filter((l) => l.isFeatured)
              .slice(0, 6)
              .map((label) => (
                <LabelTile key={label.slug} label={label} />
              ))}
          </div>
        </section>

        <section className="pg-layout cols-2">
          <div className="pg-block">
            <div className="pg-block-label">Country footprint</div>
            <div className="label43-country-grid">
              {countryGroups.slice(0, 10).map((group) => (
                <button
                  key={group.name}
                  onClick={() => updateCountry(group.name)}
                  className="label43-country text-left"
                >
                  <div className="label43-country-name">{group.name}</div>
                  <div className="label43-country-meta">
                    {group.count} label{group.count === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">Directory rule</div>
            <h3 className="pg-block-title">Labels are institutions.</h3>
            <p className="pg-block-body">
              A label page should show systems of influence: roster, releases,
              catalog activity, country, and chart presence. It should never
              reduce labels to logo tiles alone.
            </p>
          </div>
        </section>

        <section id="label-directory">
          <div className="section-head">
            <div>
              <div className="section-kicker">Full label directory</div>
              <h2 className="section-title">{filtered.length} labels found</h2>
            </div>
            <p className="section-copy">
              Showing page {page} of {totalPages}. Search and country filters
              apply to real label registry data.
            </p>
          </div>
          <div className="label43-grid">
            {paginated.map((label) => (
              <LabelTile key={label.slug} label={label} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="artist-empty">
              <WkIcon name="Building2" size={32} />
              <div className="mt-3">No labels match this search.</div>
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                className="directory-filter"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                <WkIcon name="ArrowLeft" size={14} />
              </button>
              <span className="text-[12px] font-bold text-[var(--wk-text-muted)]">
                Page {page} of {totalPages}
              </span>
              <button
                className="directory-filter"
                disabled={page === totalPages}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
              >
                <WkIcon name="ArrowRight" size={14} />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="label43-stat">
      <div className="label43-stat-val">{value}</div>
      <div className="label43-stat-lbl">{label}</div>
    </div>
  );
}

function LabelMini({ label }: { label: RepairedLabel }) {
  return (
    <Link to={`/labels/${label.slug}`} className="label43-mini">
      <div className="label43-mini-logo">
        {label.logoUrl ? (
          <img src={label.logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          initials(label.name)
        )}
      </div>
      <div className="min-w-0">
        <div className="label43-mini-name">{label.name}</div>
        <div className="label43-mini-meta">
          {label.country || "Global"} · {label.releaseCount} releases
        </div>
      </div>
      <WkIcon name="ArrowRight" size={15} />
    </Link>
  );
}

function LabelTile({ label }: { label: RepairedLabel }) {
  const roster = (label.featuredArtists || []).slice(0, 6);
  return (
    <Link to={`/labels/${label.slug}`} className="label43-card">
      <div className="label43-card-head">
        <div className="label43-card-logo">
          {label.logoUrl ? (
            <img src={label.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            initials(label.name)
          )}
        </div>
        <div className="min-w-0">
          <div className="label43-card-name">{label.name}</div>
          <div className="label43-card-country">
            {label.country || "Unknown"}
          </div>
        </div>
        {label.isFeatured && (
          <WkIcon
            name="BadgeCheck"
            size={17}
            className="text-[var(--wk-brand)]"
          />
        )}
      </div>
      <div className="label43-card-stats">
        <div className="label43-card-stat">
          <strong>{label.artistCount}</strong>
          <span>Artists</span>
        </div>
        <div className="label43-card-stat">
          <strong>{label.releaseCount}</strong>
          <span>Releases</span>
        </div>
        <div className="label43-card-stat">
          <strong>{roster.length}</strong>
          <span>Roster</span>
        </div>
      </div>
      {roster.length > 0 && (
        <div className="label43-roster">
          {roster.map((artist) => (
            <span key={artist} className="tag tag-sm">
              {artist}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}