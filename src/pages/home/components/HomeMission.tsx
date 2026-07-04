const PILLARS = [
  {
    k: "01",
    t: "Discover",
    d: "Find the people, songs, stories, and scenes shaping the culture. Charts and deep catalogs that show you what's actually happening.",
    color: "var(--wk-brand)",
  },
  {
    k: "02",
    t: "Document",
    d: "Keep the culture visible before it disappears into someone’s camera roll. Names, scenes, lyrics, and lineage all recorded.",
    color: "var(--wk-v-intel)",
  },
  {
    k: "03",
    t: "Support",
    d: "Help artists, scenes, and cultural work find real audiences. Connect creativity with the people and institutions that care.",
    color: "var(--wk-v-food)",
  },
  {
    k: "04",
    t: "Sustain",
    d: "Stand up the long-term structures so creatives can thrive on their own terms. Culture should not vanish just because the internet moved on.",
    color: "var(--wk-v-places)",
  },
];

const STATS = [
  { n: "8", l: "cultural domains", sub: "mapped and connected" },
  { n: "2", l: "live today", sub: "Music & Guides" },
  { n: "7yr", l: "building", sub: "how culture travels" },
  { n: "∞", l: "harder to erase", sub: "because we are here" },
];

export function HomeMission() {
  return (
    <section
      className="py-16 md:py-24 border-t border-[var(--wk-divider)]"
      style={{ background: "var(--wk-bg)" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>

        {/* Header */}
        <div className="mb-12 max-w-[600px]">
          <div
            className="mb-3 text-[var(--wk-brand)]"
            style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".7rem", letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 600 }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" />
              The mission
            </span>
          </div>
          <h2
            className="font-black tracking-[-0.03em] text-[var(--wk-text)] mb-4"
            style={{ fontSize: "clamp(1.7rem,3.3vw,2.5rem)", lineHeight: 1.05 }}
          >
            We are building WAKILISHA so African culture has somewhere to live, grow, travel, and be remembered.
          </h2>
          <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
            We are starting with music because music moves fast. But the mission is bigger.
            We are here to help the culture be seen, remembered, shared, and celebrated.
          </p>
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-14">
          {PILLARS.map((p) => (
            <div
              key={p.k}
              className="group relative rounded-2xl border border-[var(--wk-border)] p-6 transition-all duration-300 hover:border-[var(--wk-border-2)] hover:-translate-y-0.5"
              style={{ background: "var(--wk-surface)" }}
            >
              {/* Accent top line */}
              <div
                className="absolute top-0 left-6 right-6 h-[2px] rounded-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400"
                style={{ backgroundColor: p.color }}
              />

              <div className="flex items-start gap-4">
                <span
                  className="shrink-0 mt-0.5 tabular-nums font-black"
                  style={{
                    fontFamily: "var(--wk-font-mono, monospace)",
                    fontSize: ".7rem",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: p.color,
                  }}
                >
                  {p.k}
                </span>
                <div>
                  <h3 className="text-[17px] font-bold text-[var(--wk-text)] mb-2 tracking-[-0.01em]">{p.t}</h3>
                  <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{p.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl" style={{ background: "var(--wk-border)" }}>
          {STATS.map((s, i) => (
            <div
              key={s.l}
              className="flex flex-col items-center justify-center py-10 px-4 text-center relative overflow-hidden group"
              style={{ background: "var(--wk-surface)" }}
            >
              <div
                className="font-black tabular-nums leading-none mb-2 transition-colors duration-300"
                style={{
                  fontSize: "clamp(2rem,3.8vw,3rem)",
                  letterSpacing: "-0.04em",
                  color: i === 0 ? "var(--wk-brand)" : i === 1 ? "var(--wk-v-intel)" : i === 2 ? "var(--wk-v-food)" : "var(--wk-v-places)",
                }}
              >
                {s.n}
              </div>
              <div className="text-[13px] font-bold text-[var(--wk-text)] leading-snug mb-0.5">
                {s.l}
              </div>
              <div className="text-[11px] text-[var(--wk-text-muted)] leading-snug">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}