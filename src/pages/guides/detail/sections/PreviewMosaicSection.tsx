import { useState } from "react";
import type { PreviewMosaicData } from "../sectionTypes";

export default function PreviewMosaicSection({ data }: { data: PreviewMosaicData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <section id="inside" className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.cards.map((card) => (
            <article
              key={card.number}
              className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${
                card.size === "large" ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""
              } ${hoveredCard === card.number ? "ring-2 ring-[var(--wk-v-intel)]" : ""}`}
              onMouseEnter={() => setHoveredCard(card.number)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className={`relative overflow-hidden ${card.size === "large" ? "aspect-[4/3]" : "aspect-[4/3]"}`}>
                <img src={card.image} alt={card.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-v-intel)]">{card.number} | {card.label}</p>
                  <h3 className={`font-bold text-white leading-snug ${card.size === "large" ? "text-[22px] md:text-[28px]" : "text-[16px] md:text-[18px]"}`}>{card.title}</h3>
                  <p className={`text-white/70 leading-relaxed ${card.size === "large" ? "text-[14px] md:text-[15px]" : "text-[12px] md:text-[13px]"}`}>{card.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}