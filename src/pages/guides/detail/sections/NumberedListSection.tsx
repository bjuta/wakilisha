import type { NumberedListData } from "../sectionTypes";

export default function NumberedListSection({ data }: { data: NumberedListData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";

  return (
    <section className="w-full py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-alt, var(--wk-bg))" }}>
      <div className="wk-container-wide px-6 md:px-10 lg:px-16">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">{data.label}</div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--wk-text)] leading-tight mb-12">
          {data.title}{" "}
          {titleItalic && <em className="not-italic italic">{titleItalic}</em>}
        </h2>

        <ol className="space-y-6">
          {data.items.map((item) => (
            <li key={item.number} className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6 pb-6 border-b border-[var(--wk-divider)] last:border-0">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-bold text-[var(--wk-text-muted)] border border-[var(--wk-divider)] rounded-full">{item.number}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-[var(--wk-text)] mb-1">{item.name}</h3>
                    {item.description && <p className="text-sm text-[var(--wk-text-soft)] leading-relaxed">{item.description}</p>}
                  </div>
                  {item.route && (
                    <span className="inline-flex px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] bg-[var(--wk-surface)] border border-[var(--wk-divider)] rounded-full whitespace-nowrap">{item.route}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}