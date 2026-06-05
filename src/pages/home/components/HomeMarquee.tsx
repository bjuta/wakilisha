const DOMAINS = ["Music", "Guides", "Film", "Style", "Food", "Language", "Places", "Movement"];

export function HomeMarquee() {
  return (
    <div
      className="border-y border-[var(--wk-divider)] py-4 overflow-hidden"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}
    >
      <div
        className="flex w-max"
        style={{ animation: "wkMarquee 34s linear infinite" }}
      >
        {[0, 1].flatMap((k) =>
          DOMAINS.map((domain, i) => (
            <span
              key={`${k}-${i}`}
              className="inline-flex items-center gap-3 px-8"
              style={{
                fontWeight: 700,
                fontSize: "clamp(1.1rem,1.8vw,1.35rem)",
                letterSpacing: "-0.01em",
                color: i < 2 ? "var(--wk-text)" : "var(--wk-text-faint)",
              }}
            >
              {domain}
              <span style={{ color: "var(--wk-brand)", fontSize: "0.9em" }}>✳</span>
            </span>
          ))
        )}
      </div>
      <style>{`
        @keyframes wkMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}