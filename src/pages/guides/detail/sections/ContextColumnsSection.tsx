import type { ContextColumnsData } from "../sectionTypes";

export default function ContextColumnsSection({ data }: { data: ContextColumnsData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";

  return (
    <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="wk-container-wide px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)] mb-3">{data.eyebrow}</p>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
              {data.title}{" "}
              {titleItalic && <span className="italic font-light">{titleItalic}</span>}
            </h2>
          </div>
          {data.label && (
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">{data.label}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.columns.map((col) => (
            <article key={col.title} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6 transition-all hover:border-[var(--wk-border-2)]">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text)] mb-3">{col.title}</h3>
              <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{col.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}