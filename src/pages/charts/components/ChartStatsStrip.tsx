import { useEffect, useRef, useState } from "react";

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
}

function AnimatedStat({ value, suffix }: { value: number; suffix?: string }) {
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
            const duration = 1000;
            const start = performance.now();

            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplay(Math.round(value * eased));
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

  return (
    <span ref={ref}>
      {display.toLocaleString()}{suffix}
    </span>
  );
}

interface ChartStatsStripProps {
  stats: StatItem[];
}

export function ChartStatsStrip({ stats }: ChartStatsStripProps) {
  return (
    <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]"
    >
      <div className="wk-container grid grid-cols-2 gap-px md:grid-cols-4 lg:grid-cols-6"
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center px-4 py-6 md:py-8"
          >
            <div className="mb-1 text-[clamp(24px,2.5vw,36px)] font-black leading-[1] tracking-[-0.04em]" style={{ color: "var(--wk-brand)" }}
            >
              <AnimatedStat value={stat.value} suffix={stat.suffix} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--wk-text-muted)" }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}