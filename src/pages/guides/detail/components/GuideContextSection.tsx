import { inMinorKeysData } from "../data";

export default function GuideContextSection() {
  const { context } = inMinorKeysData;

  return (
    <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="wk-container-wide px-6">
        {/* Section head */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)] mb-3">
              {context.eyebrow}
            </p>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
              {context.title}{" "}
              <span className="italic font-light">{context.titleItalic}</span>
            </h2>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">
            {context.label}
          </span>
        </div>

        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {context.columns.map((col) => (
            <article
              key={col.title}
              className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6 transition-all hover:border-[var(--wk-border-2)]"
            >
              <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text)] mb-3">
                {col.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                {col.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}