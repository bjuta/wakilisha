import { Link } from "react-router-dom";

export interface GenreCluster {
  genre: string;
  count: number;
  description: string;
  artists: string[];
}

interface GenreClustersProps {
  clusters: GenreCluster[];
}

export function GenreClusters({ clusters }: GenreClustersProps) {
  return (
    <section className="bg-[var(--wk-surface)]">
      <div className="wk-container px-6 py-14 md:py-20">
        <div className="mb-8">
          <div className="wk-eyebrow mb-3">Explore by genre</div>
          <h3 className="wk-h-section">Find your sound</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((cluster) => (
            <div
              key={cluster.genre}
              className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-all hover:border-[var(--wk-border-2)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[18px] font-bold text-[var(--wk-text)]">{cluster.genre}</h4>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--wk-brand)]">
                  {cluster.count} artists
                </span>
              </div>
              <p className="mb-4 text-[13px] leading-[1.5]" style={{ color: "var(--wk-text-muted)" }}>
                {cluster.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {cluster.artists.slice(0, 5).map((name) => {
                  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                  return (
                    <Link
                      key={name}
                      to={`/artists/${slug}`}
                      className="rounded-full bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                    >
                      {name}
                    </Link>
                  );
                })}
                {cluster.artists.length > 5 && (
                  <span className="rounded-full bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] font-semibold" style={{ color: "var(--wk-text-faint)" }}>
                    +{cluster.artists.length - 5} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}