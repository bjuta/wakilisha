import type { DisciplineGridData } from "../sectionTypes";

export default function DisciplineGridSection({ data }: { data: DisciplineGridData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";

  return (
    <section className="w-full py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
      <div className="wk-container-wide px-6 md:px-10 lg:px-16">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">{data.label}</div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--wk-text)] leading-tight mb-2">
          {data.title}{" "}
          {titleItalic && <em className="not-italic italic">{titleItalic}</em>}
        </h2>
        {data.note && <p className="text-sm text-[var(--wk-text-muted)] mb-10">{data.note}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {data.items.map((item) => (
            <div key={item.number} className="flex items-center gap-3 px-4 py-3.5 rounded-lg border border-[var(--wk-divider)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-2)] transition-colors">
              <span className="text-xs font-bold text-[var(--wk-text-muted)] w-6">{item.number}</span>
              <span className="text-sm font-medium text-[var(--wk-text)]">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}