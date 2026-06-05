const PILLARS = [
  { k: "01", t: "Discover", d: "Make African creative work easy to find. A registry and charts that surface what's happening, not what an algorithm decides should trend." },
  { k: "02", t: "Document", d: "Build archives that outlast the moment. Names, scenes, lyrics and lineage recorded so culture becomes harder to erase." },
  { k: "03", t: "Fund & Value", d: "Connect creativity with capital, audiences and institutions — turning cultural value into visibility, participation and opportunity." },
  { k: "04", t: "Sustain", d: "Stand up the long-term structures — partnerships, experiences, commercial models — that let creatives thrive on their own terms." },
];

const STATS = [
  { n: "8", l: "cultural domains mapped" },
  { n: "2", l: "live today: Music & Guides" },
  { n: "7yr", l: "building how culture travels" },
  { n: "∞", l: "harder to erase" },
];

export function HomeMission() {
  return (
    <section
      className="border-t border-[var(--wk-divider)]"
      style={{ background: "var(--wk-bg-subtle)", padding: "80px clamp(20px,4vw,40px) 80px" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* Section header */}
        <div className="mb-12 max-w-[540px]">
          <div
            className="mb-4 text-[var(--wk-brand)]"
            style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".72rem", letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 600 }}
          >
            The mission
          </div>
          <h2
            className="font-bold tracking-[-0.025em] text-[var(--wk-text)] mb-4"
            style={{ fontSize: "clamp(1.7rem,3.2vw,2.4rem)", lineHeight: 1.05 }}
          >
            Four verbs. One commitment.
          </h2>
          <p className="text-[var(--wk-text-muted)] text-[15px] leading-relaxed">
            WAKILISHA exists to build structures that help African creative work travel further, last longer, and generate meaningful value.
          </p>
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {PILLARS.map((p) => (
            <div
              key={p.k}
              className="rounded-2xl border border-[var(--wk-border)] p-6 transition-all duration-300 hover:border-[var(--wk-border-2)]"
              style={{ background: "var(--wk-surface)" }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="shrink-0 mt-0.5 tabular-nums font-bold text-[var(--wk-brand)]"
                  style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".72rem", letterSpacing: ".1em", textTransform: "uppercase" }}
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

        {/* Stats bar */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 overflow-hidden rounded-2xl border border-[var(--wk-border)]"
          style={{ gap: 1, background: "var(--wk-border)" }}
        >
          {STATS.map((s) => (
            <div
              key={s.l}
              className="flex flex-col items-center justify-center py-9 px-4 text-center"
              style={{ background: "var(--wk-surface)" }}
            >
              <div
                className="font-black text-[var(--wk-text)] tabular-nums leading-none mb-2.5"
                style={{ fontSize: "clamp(2rem,3.8vw,3rem)", letterSpacing: "-0.04em" }}
              >
                {s.n}
              </div>
              <div className="text-[12px] text-[var(--wk-text-muted)] leading-snug max-w-[12ch] text-center">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}