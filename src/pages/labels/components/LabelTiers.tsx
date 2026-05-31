import { Link } from "react-router-dom";

interface Label {
  slug: string;
  name: string;
  country?: string;
  artistCount: number;
  releaseCount: number;
  isFeatured?: boolean;
}

interface LabelTiersProps {
  labels: Label[];
}

export function LabelTiers({ labels }: LabelTiersProps) {
  const powerhouses = labels.filter((l) => l.artistCount >= 10);
  const mid = labels.filter((l) => l.artistCount >= 5 && l.artistCount < 10);
  const boutique = labels.filter((l) => l.artistCount < 5);

  const tiers = [
    {
      title: "Powerhouses",
      subtitle: "Large labels with global rosters and distribution",
      labels: powerhouses,
      badge: "🔥",
    },
    {
      title: "Mid-size",
      subtitle: "Established labels with focused artist catalogs",
      labels: mid,
      badge: "🏢",
    },
    {
      title: "Boutique",
      subtitle: "Small labels, tight curation, big impact",
      labels: boutique,
      badge: "💎",
    },
  ];

  return (
    <section className="bg-[var(--wk-surface)]">
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mb-10">
          <div className="wk-eyebrow mb-3">By size</div>
          <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Label ecosystem
          </h3>
        </div>

        <div className="space-y-10">
          {tiers.map((tier) => {
            if (tier.labels.length === 0) return null;
            return (
              <div key={tier.title}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="text-[20px]">{tier.badge}</span>
                  <div>
                    <h4 className="text-[16px] font-bold text-[var(--wk-text)]">{tier.title}</h4>
                    <p className="text-[12px] text-[var(--wk-text-muted)]">{tier.subtitle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tier.labels.map((label) => (
                    <Link
                      key={label.slug}
                      to={`/labels/${label.slug}`}
                      className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition-all hover:border-[var(--wk-border-2)]"
                    >
                      {/* Monogram */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[18px] font-black text-[var(--wk-brand-on)]">
                        {label.name.split(/[\s&]/)[0].charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{label.name}</h5>
                          {label.isFeatured && (
                            <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                          <span className="inline-flex items-center gap-1">
                            <i className="ri-user-line text-[10px]" />
                            {label.artistCount} artists
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <i className="ri-album-line text-[10px]" />
                            {label.releaseCount} releases
                          </span>
                          {label.country && <span>{label.country}</span>}
                        </div>
                      </div>
                      <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-text)]" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}