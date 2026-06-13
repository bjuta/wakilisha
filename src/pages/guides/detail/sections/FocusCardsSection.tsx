import type { FocusCardsData } from "../sectionTypes";

export default function FocusCardsSection({ data }: { data: FocusCardsData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";

  return (
    <section id="kenya" className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="wk-container-wide px-6">
        <div className="flex flex-col md:flex-row md:items-start gap-8 mb-10 md:mb-14">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wk-v-intel)] text-white text-[18px] font-black">{data.number}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-v-intel)] mb-1">{data.eyebrow}</p>
              <h2 className="text-[clamp(28px,4vw,48px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
                {data.title}{" "}
                {titleItalic && <span className="italic font-light">{titleItalic}</span>}
              </h2>
            </div>
          </div>
        </div>

        <p className="text-[15px] md:text-[16px] leading-relaxed text-[var(--wk-text-soft)] max-w-[720px] mb-10 md:mb-14">{data.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.cards.map((card) => (
            <article key={card.number} className="group rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-v-intel)]">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={card.image} alt={card.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-v-intel)] mb-2">{card.number} | {card.label}</p>
                <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">{card.title}</h3>
                <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{card.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 p-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            <span className="font-bold text-[var(--wk-text)]">{data.note}</span>
          </p>
        </div>
      </div>
    </section>
  );
}