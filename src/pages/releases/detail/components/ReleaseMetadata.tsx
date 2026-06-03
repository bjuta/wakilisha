import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { releaseUrl } from "@/services/repairedContent/client";
import type { RepairedReleaseDetail } from "@/services/repairedContent/client";

export default function ReleaseMetadata({
  release,
  related,
  chartTracks,
  chartPositions,
}: {
  release: RepairedReleaseDetail;
  related: Array<{
    slug: string;
    title: string;
    artist: string;
    year: string;
    releaseType: string;
    artworkUrl: string;
  }>;
  chartTracks?: string[];
  chartPositions?: number[];
}) {
  const { ref: sidebarRef, revealed } = useScrollReveal<HTMLDivElement>(0.05);
  const minutes = Math.round(release.totalDuration / 60);
  const hasChartData = chartTracks && chartTracks.length > 0;

  return (
    <aside ref={sidebarRef} className={`${revealed ? "is-visible" : ""} reveal-up space-y-5 lg:sticky lg:top-[88px] lg:self-start`}>
      {/* Stats */}
      <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="Activity" size={13} />
          Release stats
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={release.trackCount} label="Tracks" />
          <StatCard value={minutes} label="Minutes" />
          <StatCard value={release.year} label="Year" />
          <StatCard value={hasChartData ? chartTracks.length : 0} label="Chart tracks" />
        </div>
      </div>

      {/* Label */}
      <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          <WkIcon name="Building2" size={13} />
          Label
        </div>
        <div className="text-[15px] font-extrabold text-[var(--wk-text)]">{release.labelName}</div>
        <div className="text-[12px] font-semibold text-[var(--wk-text-muted)] mt-1">
          {release.releaseType} · {release.year}
        </div>
        {release.labelSlug && (
          <Link
            to={`/labels/${release.labelSlug}`}
            className="inline-flex items-center gap-2 mt-4 text-[12px] font-bold text-[var(--wk-brand)] hover:underline"
          >
            Open label
            <WkIcon name="ArrowUpRight" size={12} />
          </Link>
        )}
      </div>

      {/* Chart performance */}
      {hasChartData && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="BarChart3" size={13} />
            Chart performance
          </div>
          <div className="space-y-3">
            {chartTracks.map((track, index) => (
              <div key={track} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--wk-brand)]/10 text-[13px] font-extrabold text-[var(--wk-brand)]">
                  #{chartPositions?.[index] ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-[var(--wk-text)] truncate">{track}</div>
                  <div className="text-[11px] font-semibold text-[var(--wk-text-muted)]">Chart-connected</div>
                </div>
                <WkIcon name="TrendingUp" size={14} className="text-[var(--wk-brand)]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related releases */}
      {related.length > 0 && (
        <div className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
          <div className="flex items-center gap-2 mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Disc3" size={13} />
            Related releases
          </div>
          <div className="space-y-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                to={releaseUrl(item)}
                className="group flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--wk-surface-raised)] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--wk-bg)] border border-[var(--wk-border)]">
                  <img src={item.artworkUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-[var(--wk-text)] truncate">{item.title}</div>
                  <div className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    {item.artist} · {item.year}
                  </div>
                </div>
                <WkIcon
                  name="ArrowRight"
                  size={14}
                  className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)] transition-colors"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-3.5">
      <div className="text-[22px] font-black text-[var(--wk-text)] leading-none tracking-[-0.03em]">{value}</div>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-1.5">
        {label}
      </div>
    </div>
  );
}