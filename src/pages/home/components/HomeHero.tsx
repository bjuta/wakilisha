import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const VERBS = ["discovered", "documented", "funded", "valued", "sustained"];

interface Props {
  scrollY: number;
}

export function HomeHero({ scrollY }: Props) {
  const [verbIdx, setVerbIdx] = useState(0);
  const [verbVisible, setVerbVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVerbVisible(false);
      const t = setTimeout(() => {
        setVerbIdx((v) => (v + 1) % VERBS.length);
        setVerbVisible(true);
      }, 300);
      return () => clearTimeout(t);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="relative overflow-hidden"
      style={{ padding: "clamp(52px,8vh,96px) clamp(20px,4vw,40px) clamp(52px,7vh,80px)", maxWidth: 1180, margin: "0 auto" }}
    >
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">

        {/* ── Left: Text ── */}
        <div>
          {/* Mission label */}
          <div
            className="inline-flex items-center gap-2.5 mb-8"
            style={{
              fontFamily: "var(--wk-font-mono, monospace)",
              fontSize: ".72rem",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--wk-brand)",
              fontWeight: 600,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--wk-brand)", boxShadow: "0 0 0 4px rgba(132,194,65,0.15)" }}
            />
            Cultural infrastructure for African creative life
          </div>

          {/* Headline */}
          <h1
            className="font-black leading-[1.01] tracking-[-0.03em] text-[var(--wk-text)] mb-7"
            style={{ fontSize: "clamp(2.5rem,5vw,4.3rem)" }}
          >
            African culture,
            <br />
            made easier to be{" "}
            <span
              className="text-[var(--wk-brand)]"
              style={{
                display: "inline-block",
                minWidth: "5ch",
                opacity: verbVisible ? 1 : 0,
                transform: verbVisible ? "none" : "translateY(10px)",
                transition: "opacity 0.3s ease, transform 0.35s ease",
              }}
            >
              {VERBS[verbIdx]}.
            </span>
          </h1>

          {/* Body */}
          <p
            className="text-[var(--wk-text-muted)] leading-relaxed mb-9 max-w-[48ch]"
            style={{ fontSize: "clamp(1rem,1.5vw,1.15rem)" }}
          >
            Africa doesn&apos;t lack talent, imagination or relevance. It lacks the structures
            that let creative work travel further, last longer, and generate real value for
            the people behind it. WAKILISHA builds those structures.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/charts"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold transition-all duration-300 hover:opacity-90 hover:gap-3 whitespace-nowrap cursor-pointer"
              style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)" }}
            >
              Explore the registry
              <i className="ri-arrow-right-line text-[13px]" />
            </Link>
            <Link
              to="/magazine"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] px-6 py-3.5 text-[14px] font-semibold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] whitespace-nowrap cursor-pointer"
            >
              Read the mission
            </Link>
          </div>
        </div>

        {/* ── Right: Hero image ── */}
        <div className="relative hidden lg:block">
          {/* Main tall card */}
          <div
            className="relative rounded-3xl overflow-hidden border border-[var(--wk-border-2)] shadow-2xl"
            style={{ aspectRatio: "4/5" }}
          >
            <img
              src="https://readdy.ai/api/search-image?query=African%20performing%20artist%20on%20stage%20dramatic%20concert%20lighting%20colorful%20beam%20lights%20cutting%20through%20atmospheric%20haze%20crowd%20energy%20silhouette%20against%20bright%20stage%20light%20warm%20amber%20deep%20purple%20tones%20emotional%20cinematic%20concert%20photography%20editorial%20quality%20dark%20dramatic%20moody%20authentic%20African%20live%20music%20performance%20cultural%20expression%20powerful%20image&width=900&height=1100&seq=hero-stage-wk2026&orientation=portrait"
              alt="African artist performing"
              className="w-full h-full object-cover object-top"
              style={{
                transform: `translateY(${scrollY * 0.025}px) scale(1.06)`,
                transition: "transform 0.1s linear",
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,9,8,0) 40%, rgba(8,9,8,.60) 75%, rgba(8,9,8,.92) 100%)" }} />

            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-brand)] mb-1.5">
                    Now charting
                  </div>
                  <div className="text-[15px] font-bold text-white leading-snug">
                    The living scene, recorded
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 backdrop-blur-sm shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" style={{ animation: "wkPulse 2.4s ease-in-out infinite" }} />
                  <span className="text-[10px] font-bold text-white uppercase tracking-[0.1em]">Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating thumbnail — top-right */}
          <div
            className="absolute -top-4 -right-4 w-[38%] aspect-square rounded-2xl overflow-hidden shadow-xl border-2"
            style={{
              borderColor: "var(--wk-bg)",
              transform: `translateY(${scrollY * -0.035}px)`,
              transition: "transform 0.1s linear",
            }}
          >
            <img
              src="https://readdy.ai/api/search-image?query=Close%20up%20vibrant%20African%20kente%20woven%20textile%20bold%20geometric%20patterns%20rich%20colors%20orange%20green%20deep%20indigo%20blue%20traditional%20West%20African%20weaving%20craft%20detail%20photography%20warm%20golden%20light%20highlighting%20thread%20texture%20and%20color%20depth%20cultural%20material%20heritage%20handcrafted%20quality%20beautiful%20artisanal%20fabric&width=500&height=500&seq=hero-float-wk2026&orientation=squarish"
              alt="African textile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wkPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
      `}</style>
    </section>
  );
}