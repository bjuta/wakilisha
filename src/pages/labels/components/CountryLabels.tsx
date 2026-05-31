import { Link } from "react-router-dom";

const COUNTRY_FLAGS: Record<string, string> = {
  Nigeria: "🇳🇬",
  Ghana: "🇬🇭",
  "South Africa": "🇿🇦",
  Kenya: "🇰🇪",
  "USA / Pan-African": "🌍",
  "USA": "🇺🇸",
  "UK / Pan-African": "🇬🇧",
};

interface Label {
  slug: string;
  name: string;
  country: string;
  artistCount: number;
  releaseCount: number;
  isFeatured?: boolean;
}

interface CountryLabelsProps {
  labels: Label[];
}

export function CountryLabels({ labels }: CountryLabelsProps) {
  const groups: Record<string, { country: string; flag: string; labels: Label[] }> = {};
  labels.forEach((l) => {
    if (!groups[l.country]) {
      groups[l.country] = { country: l.country, flag: COUNTRY_FLAGS[l.country] || "🌍", labels: [] };
    }
    groups[l.country].labels.push(l);
  });

  const sorted = Object.values(groups).sort((a, b) => b.labels.length - a.labels.length);
  if (sorted.length === 0) return null;

  return (
    <section>
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mb-10">
          <div className="wk-eyebrow mb-3">By origin</div>
          <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Where labels are built
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((group) => {
            const totalArtists = group.labels.reduce((sum, l) => sum + l.artistCount, 0);
            const totalReleases = group.labels.reduce((sum, l) => sum + l.releaseCount, 0);
            const featuredCount = group.labels.filter((l) => l.isFeatured).length;
            return (
              <Link
                key={group.country}
                to={`/labels?country=${group.country}`}
                className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] transition-all hover:border-[var(--wk-border-2)]"
              >
                <div className="relative flex items-center gap-4 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[28px]">
                    {group.flag}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[18px] font-bold text-[var(--wk-text)]">{group.country}</h4>
                    <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                      <span>{group.labels.length} label{group.labels.length > 1 ? "s" : ""}</span>
                      <span>{totalArtists} artists</span>
                      <span>{totalReleases} releases</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {group.labels.slice(0, 4).map((l) => (
                        <span
                          key={l.slug}
                          className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                        >
                          {l.name}
                        </span>
                      ))}
                      {group.labels.length > 4 && (
                        <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-faint)]">
                          +{group.labels.length - 4}
                        </span>
                      )}
                    </div>
                    {featuredCount > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[var(--wk-brand)] uppercase">
                        <i className="ri-star-line text-[9px]" />
                        {featuredCount} featured
                      </div>
                    )}
                  </div>
                  <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-text)]" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}