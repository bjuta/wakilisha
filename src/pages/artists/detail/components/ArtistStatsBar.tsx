import { useEffect, useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface StatsBarItem {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: string;
}

interface ArtistStatsBarProps {
  stats: StatsBarItem[];
}

function AnimatedValue({ value, suffix }: { value: string | number; suffix?: string }) {
  const [display, setDisplay] = useState("0");
  const { ref, revealed } = useScrollReveal<HTMLSpanElement>(0.3);

  useEffect(() => {
    if (!revealed) return;
    const target = String(value);
    const num = parseFloat(target);
    if (isNaN(num)) {
      setDisplay(target);
      return;
    }
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = num * eased;
      if (Number.isInteger(num)) {
        setDisplay(Math.round(current).toLocaleString());
      } else {
        setDisplay(current.toFixed(1));
      }
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [revealed, value]);

  return (
    <span ref={ref} className="stat-count inline-block">
      {display}
      {suffix || ""}
    </span>
  );
}

export function ArtistStatsBar({ stats }: ArtistStatsBarProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.2);

  return (
    <div ref={ref} className="relative z-10 -mt-10 md:-mt-12 px-6">
      <div className="wk-container">
        <div
          className={`grid grid-cols-2 gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 md:grid-cols-4 md:gap-6 md:p-6 ${
            revealed ? "is-visible" : ""
          } reveal-up`}
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex flex-col items-start gap-1 md:items-center md:gap-1.5"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {stat.icon && (
                <i className={`${stat.icon} text-[16px] text-[var(--wk-brand)] md:text-[18px]`} />
              )}
              <div className="text-[22px] font-black tracking-[-0.04em] text-[var(--wk-text)] md:text-[28px]">
                <AnimatedValue value={stat.value} suffix={stat.suffix} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}