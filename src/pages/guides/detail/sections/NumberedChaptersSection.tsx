import type { NumberedChaptersData } from "../sectionTypes";

export default function NumberedChaptersSection({ data }: { data: NumberedChaptersData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";
  const label = data.chaptersLabel || data.chapters_label || "Chapters";

  return (
    <section className="w-full py-16 md:py-24" style={{ background: "var(--wk-bg)" }}>
      <div className="wk-container-wide px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left column — prose */}
          <div className="space-y-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">{data.label}</div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--wk-text)] leading-tight">
              {data.title}{" "}
              {titleItalic && <em className="not-italic italic">{titleItalic}</em>}
            </h2>
            {data.prose && (
              <div className="space-y-4 text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
                {data.prose.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </div>

          {/* Right column — chapters */}
          <div className="lg:pt-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-4">{label}</div>
            <ol className="space-y-4">
              {data.chapters.map((ch) => (
                <li key={ch.number} className="flex gap-4 items-start">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-bold text-[var(--wk-text-muted)] border border-[var(--wk-divider)] rounded-full">
                    {ch.number}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-[var(--wk-text)] mb-1">{ch.title}</div>
                    <p className="text-sm text-[var(--wk-text-soft)] leading-relaxed">{ch.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}