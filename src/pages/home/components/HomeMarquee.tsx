const ITEMS = [
  { text: "The Weekly Top 40", accent: "var(--wk-brand)" },
  { text: "Artist Profiles", accent: "var(--wk-v-music)" },
  { text: "Genre Maps", accent: "var(--wk-v-intel)" },
  { text: "Magazine Stories", accent: "var(--wk-v-film)" },
  { text: "Cultural Guides", accent: "var(--wk-v-places)" },
  { text: "Label Pages", accent: "var(--wk-v-food)" },
  { text: "Every Release", accent: "var(--wk-v-fashion)" },
  { text: "Chart History", accent: "var(--wk-brand)" },
  { text: "Artist Discographies", accent: "var(--wk-v-music)" },
  { text: "Scene Reports", accent: "var(--wk-v-film)" },
];

export function HomeMarquee() {
  return (
    <div
      className="border-y border-[var(--wk-divider)] py-4 overflow-hidden select-none"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}
    >
      <div
        className="flex w-max"
        style={{ animation: "wkMarqueeV2 38s linear infinite" }}
      >
        {[0, 1].flatMap((k) =>
          ITEMS.map((item, i) => (
            <span
              key={`${k}-${i}`}
              className="inline-flex items-center gap-3 px-7"
              style={{
                fontWeight: 700,
                fontSize: "clamp(0.95rem,1.5vw,1.15rem)",
                letterSpacing: "-0.01em",
                color: "var(--wk-text-soft)",
              }}
            >
              {item.text}
              <span
                className="text-[0.85em]"
                style={{ color: item.accent }}
              >
                ✳
              </span>
            </span>
          ))
        )}
      </div>
      <style>{`
        @keyframes wkMarqueeV2 { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}