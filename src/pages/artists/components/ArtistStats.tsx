import { useEffect, useRef, useState } from "react";

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

interface ArtistStatsProps {
  stats: StatItem[];
}

function AnimatedNumber({ value, suffix, prefix, decimals }: { value: number; suffix?: string; prefix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const duration = 1200;
            const start = performance.now();
            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplay((value) => value + (value - 0) * eased);
              if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  const formatted = decimals ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span ref={ref}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

export function ArtistStats({ stats }: ArtistStatsProps) {
  return (
    <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container flex items-center justify-between px-6 py-5 md:py-6">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[18px] font-black tracking-[-0.04em] text-[var(--wk-brand)] md:text-[22px]">
              <AnimatedNumber value={stat.value} suffix={stat.suffix} prefix={stat.prefix} decimals={stat.decimals} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}