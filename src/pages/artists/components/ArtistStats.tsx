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
            const startVal = 0;

            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplay(startVal + (value - startVal) * eased);
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
    <div className="border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container grid grid-cols-2 gap-px md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center px-4 py-8 md:py-10"
          >
            <div className="mb-1 text-[clamp(28px,3vw,40px)] font-black leading-[1] tracking-[-0.04em]" style={{ color: "var(--wk-brand)" }}>
              <AnimatedNumber value={stat.value} suffix={stat.suffix} prefix={stat.prefix} decimals={stat.decimals} />
            </div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--wk-text-muted)" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}