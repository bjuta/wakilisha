import type { ArtistsGridData } from "../sectionTypes";

export default function ArtistsGridSection({ data }: { data: ArtistsGridData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";

  return (
    <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data.artists.map((artist) => (
            <article key={artist.name} className="group rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]">
              <div className="aspect-square overflow-hidden">
                <img src={artist.image} alt={artist.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-3">
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-0.5">{artist.name}</h3>
                <p className="text-[12px] text-[var(--wk-text-muted)]">{artist.origin}{artist.location ? ` · ${artist.location}` : ""}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}