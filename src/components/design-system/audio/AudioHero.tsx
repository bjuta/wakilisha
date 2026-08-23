import type { ReactNode } from "react";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";

export interface AudioHeroMetaItem {
  label: string;
  icon?: WkIconName;
}

export function AudioHero({
  eyebrow = "Audio",
  title,
  description,
  meta = [],
  actions,
  visual,
  visualLabel = "Audio artwork",
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  meta?: AudioHeroMetaItem[];
  actions?: ReactNode;
  visual?: ReactNode;
  visualLabel?: string;
  compact?: boolean;
}) {
  return (
    <section
      data-wk-audio-hero
      className={[
        "relative isolate overflow-hidden border-b border-[var(--wk-divider)]",
        compact ? "min-h-[62vh]" : "min-h-[72vh]",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_82%_18%,color-mix(in_srgb,var(--wk-brand)_20%,transparent),transparent_42%),linear-gradient(150deg,var(--wk-surface)_0%,var(--wk-bg)_58%,var(--wk-surface-raised)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-[16%] top-[12%] -z-10 h-[46vw] max-h-[560px] min-h-[300px] w-[46vw] min-w-[300px] rounded-full bg-[var(--wk-brand)]/10 blur-3xl"
      />

      <div className="wk-container-max grid min-h-[inherit] items-center gap-10 px-6 pb-14 pt-28 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)] md:px-10 md:pb-16 md:pt-24 lg:gap-16">
        <div className="max-w-[760px] self-center">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
            <span className="h-px w-9 bg-[var(--wk-brand)]" />
            <span>{eyebrow}</span>
          </div>

          <h1 className="mt-5 text-[clamp(44px,8vw,92px)] font-black leading-[0.94] tracking-[-0.055em] text-[var(--wk-text)]">
            {title}
          </h1>

          {description ? (
            <p className="mt-6 max-w-[680px] text-[clamp(16px,2.2vw,23px)] font-medium leading-[1.55] text-[var(--wk-text-muted)]">
              {description}
            </p>
          ) : null}

          {meta.length ? (
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-bold text-[var(--wk-text-soft)]">
              {meta.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-2">
                  {item.icon ? <WkIcon name={item.icon} size={14} /> : null}
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}

          {actions ? (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>

        <div
          role="img"
          aria-label={visualLabel}
          className="order-first mx-auto w-full max-w-[520px] self-center md:order-none"
        >
          <div className="relative aspect-square overflow-hidden rounded-[34px] border border-white/15 bg-[var(--wk-surface-raised)] shadow-[0_30px_90px_rgba(0,0,0,0.18)] md:rounded-[42px]">
            {visual ?? (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_28%_24%,color-mix(in_srgb,var(--wk-brand)_35%,transparent),transparent_35%),linear-gradient(145deg,var(--wk-surface-raised),var(--wk-bg))]">
                <WkIcon name="AudioLines" size={72} className="text-[var(--wk-brand)]" strokeWidth={1.35} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
