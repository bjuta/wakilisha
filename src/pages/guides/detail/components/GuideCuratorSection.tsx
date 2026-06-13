import { inMinorKeysData } from "../data";

export default function GuideCuratorSection() {
  const { curator } = inMinorKeysData;

  return (
    <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="wk-container-wide px-6">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Image */}
          <div className="lg:w-[45%] flex-shrink-0">
            <div className="rounded-2xl overflow-hidden border border-[var(--wk-border)]">
              <img
                src={curator.image}
                alt={curator.title}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Copy */}
          <div className="lg:w-[55%] flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-v-intel)] mb-3">
              {curator.eyebrow}
            </p>
            <h2 className="text-[clamp(32px,4vw,56px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)] mb-6">
              {curator.title}{" "}
              <span className="italic font-light">{curator.titleItalic}</span>
            </h2>
            <p className="text-[15px] md:text-[16px] leading-relaxed text-[var(--wk-text-soft)] mb-8">
              {curator.bio}
            </p>

            {/* Timeline */}
            <div className="space-y-4" aria-label="Koyo Kouoh career milestones">
              {curator.timeline.map((item, index) => (
                <div key={item.year} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] border border-[var(--wk-border)]">
                      <span className="text-[11px] font-bold text-[var(--wk-v-intel)]">{item.year.slice(2)}</span>
                    </div>
                    {index < curator.timeline.length - 1 && (
                      <div className="w-px h-6 bg-[var(--wk-border)] mt-1" />
                    )}
                  </div>
                  <div className="pt-1">
                    <time className="text-[12px] font-bold text-[var(--wk-text)]">{item.year}</time>
                    <p className="text-[13px] text-[var(--wk-text-muted)] mt-0.5">
                      {item.event}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}