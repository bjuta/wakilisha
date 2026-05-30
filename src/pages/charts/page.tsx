import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
import { CHART_DATA, CHART_SERIES } from "@/mocks/charts";

export default function Charts() {
  const [activeSeries, setActiveSeries] = useState("weekly-top-40");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <PageHero
        eyebrow="WAKILISHA charts"
        title="Weekly Top 40"
        subtitle="Ranked by streams, radio airplay, and digital activity across Africa. Updated every Monday."
      />

      <div className="wk-container px-6 py-10">
        <div className="mb-6 flex flex-wrap gap-2">
          {CHART_SERIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSeries(s.id)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeSeries === s.id
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="text-[13px] text-[var(--wk-text-muted)]">
            {CHART_DATA.length} entries · Edition May 27, 2024
          </div>
          <WkTag>Methodology</WkTag>
        </div>

        <WkSurface className="overflow-hidden">
          <div className="divide-y divide-[var(--wk-divider)]">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonChartRow key={i} />)
              : CHART_DATA.map((entry) => <ChartRow key={entry.rank} {...entry} />)}
          </div>
        </WkSurface>
      </div>
    </>
  );
}