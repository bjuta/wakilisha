import { dakarData } from "../dakarData";

export default function DakarWatchlistSection() {
  const { watchlist } = dakarData;

  return (
    <section id="signals" className="w-full py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-alt, var(--wk-bg))" }}>
      <div className="wk-container-wide px-6 md:px-10 lg:px-16">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
          {watchlist.label}
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--wk-text)] leading-tight mb-12">
          {watchlist.title}{" "}
          <em className="not-italic italic">{watchlist.titleItalic}</em>
        </h2>

        <ol className="space-y-8">
          {watchlist.items.map((item) => (
            <li
              key={item.number}
              className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6 pb-8 border-b border-[var(--wk-divider)] last:border-0 last:pb-0"
            >
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-bold text-[var(--wk-text-muted)] border border-[var(--wk-divider)] rounded-full">
                {item.number}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-v-fashion)] mb-1">
                  {item.signal}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-[var(--wk-text)] mb-2">
                  {item.question}
                </h3>
                <p className="text-sm text-[var(--wk-text-soft)] leading-relaxed">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}