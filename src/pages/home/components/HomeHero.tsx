import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { ChartEditionEntry } from "@/services/chartsPublic/types";
import type { PublicStory } from "@/services/publicContent/client";

interface Props {
  chartEntries: ChartEditionEntry[];
  stories: PublicStory[];
  loading: boolean;
}

function ChartPortalCard({ entries, loading }: { entries: ChartEditionEntry[]; loading: boolean }) {
  const top3 = entries.slice(0, 3);

  return (
    <Link
      to="/charts"
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5 transition-all duration-400 hover:border-white/25 hover:bg-black/55 hover:-translate-y-1 cursor-pointer overflow-hidden"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--wk-brand)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

      <div className="relative z-10 flex items-center gap-2.5 mb-4">
        <span className="w-2 h-2 rounded-full bg-[var(--wk-brand)] animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">Charting Now</span>
      </div>

      <h3 className="relative z-10 text-[17px] font-black text-white tracking-[-0.02em] mb-4 leading-tight">
        The Charts
      </h3>

      {loading ? (
        <div className="relative z-10 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 text-[11px] font-bold text-white/25 tabular-nums">{String(i).padStart(2, "0")}</div>
              <div className="w-9 h-9 rounded-md bg-white/5 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-1/2 rounded bg-white/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 space-y-1.5">
          {top3.map((entry, i) => (
            <div key={entry.trackSlug || i} className="flex items-center gap-3 py-1.5">
              <span className="w-5 text-[11px] font-bold text-white/40 tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
              {entry.artworkUrl ? (
                <img src={entry.artworkUrl} alt={entry.title} loading="lazy" className="w-9 h-9 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-md bg-white/5 shrink-0 flex items-center justify-center">
                  <i className="ri-music-line text-white/25 text-sm" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-white/90 truncate leading-tight">{entry.trackTitle}</div>
                <div className="text-[10px] text-white/45 truncate">{entry.artistNames?.[0] || "Unknown"}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10 mt-auto pt-4 flex items-center gap-1.5 text-[12px] font-semibold text-white/60 group-hover:text-white transition-colors">
        <span>View all charts</span>
        <i className="ri-arrow-right-line text-[11px] group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function MagazinePortalCard({ stories, loading }: { stories: PublicStory[]; loading: boolean }) {
  const latest = stories[0];

  return (
    <Link
      to="/magazine"
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5 transition-all duration-400 hover:border-white/25 hover:bg-black/55 hover:-translate-y-1 cursor-pointer overflow-hidden"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--wk-v-film)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

      <div className="relative z-10 flex items-center gap-2.5 mb-4">
        <span className="w-2 h-2 rounded-full bg-[var(--wk-v-film)]" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-v-film)]">Latest Issue</span>
      </div>

      <h3 className="relative z-10 text-[17px] font-black text-white tracking-[-0.02em] mb-4 leading-tight">
        The Magazine
      </h3>

      {loading ? (
        <div className="relative z-10 space-y-3">
          <div className="aspect-[16/9] rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
          <div className="h-2.5 w-full rounded bg-white/5 animate-pulse" />
        </div>
      ) : latest ? (
        <div className="relative z-10 flex-1">
          {latest.heroUrl && (
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-3">
              <img src={latest.heroUrl} alt={latest.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              {latest.section && (
                <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-[var(--wk-v-film)]/20 text-[var(--wk-v-film)] border border-[var(--wk-v-film)]/25">
                  {latest.section}
                </span>
              )}
            </div>
          )}
          <div className="text-[13px] font-bold text-white/90 line-clamp-2 leading-snug mb-1.5">{latest.title}</div>
          <div className="text-[10px] text-white/45">
            {latest.author && <span>{latest.author}</span>}
            {latest.readingTime && <span>{latest.author ? " · " : ""}{latest.readingTime} min read</span>}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex items-center justify-center flex-1 text-white/25 text-[13px]">
          Stories coming soon
        </div>
      )}

      <div className="relative z-10 mt-auto pt-4 flex items-center gap-1.5 text-[12px] font-semibold text-white/60 group-hover:text-white transition-colors">
        <span>Open magazine</span>
        <i className="ri-arrow-right-line text-[11px] group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function RegistryPortalCard() {
  return (
    <Link
      to="/artists"
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5 transition-all duration-400 hover:border-white/25 hover:bg-black/55 hover:-translate-y-1 cursor-pointer overflow-hidden"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--wk-v-music)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

      <div className="relative z-10 flex items-center gap-2.5 mb-4">
        <span className="w-2 h-2 rounded-full bg-[var(--wk-v-music)]" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-v-music)]">Living Archive</span>
      </div>

      <h3 className="relative z-10 text-[17px] font-black text-white tracking-[-0.02em] mb-4 leading-tight">
        The Archive
      </h3>

      <div className="relative z-10 flex-1 space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-10 h-10 rounded-full bg-[var(--wk-v-music)]/15 flex items-center justify-center shrink-0">
            <i className="ri-mic-line text-[var(--wk-v-music)] text-lg" />
          </div>
          <div>
            <div className="text-[12px] font-bold text-white/90">Artists</div>
            <div className="text-[10px] text-white/40">Profiles, discographies, chart history</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-10 h-10 rounded-full bg-[var(--wk-v-intel)]/15 flex items-center justify-center shrink-0">
            <i className="ri-price-tag-3-line text-[var(--wk-v-intel)] text-lg" />
          </div>
          <div>
            <div className="text-[12px] font-bold text-white/90">Genres & Labels</div>
            <div className="text-[10px] text-white/40">Map the scenes and imprints</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div className="w-10 h-10 rounded-full bg-[var(--wk-v-food)]/15 flex items-center justify-center shrink-0">
            <i className="ri-album-line text-[var(--wk-v-food)] text-lg" />
          </div>
          <div>
            <div className="text-[12px] font-bold text-white/90">Releases</div>
            <div className="text-[10px] text-white/40">Albums, EPs, singles — catalogued</div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-auto pt-4 flex items-center gap-1.5 text-[12px] font-semibold text-white/60 group-hover:text-white transition-colors">
        <span>Explore the archive</span>
        <i className="ri-arrow-right-line text-[11px] group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

export function HomeHero({ chartEntries, stories, loading }: Props) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const on = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <section className="relative overflow-hidden md:-mt-16" style={{ minHeight: "100vh" }}>
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://readdy.ai/api/search-image?query=Abstract%20artistic%20composition%20inspired%20by%20African%20cultural%20patterns%20and%20textures%20warm%20earthy%20tones%20deep%20ochre%20amber%20terracotta%20rich%20dark%20green%20subtle%20gold%20accents%20flowing%20organic%20shapes%20contemporary%20art%20gallery%20quality%20cinematic%20lighting%20with%20soft%20volumetric%20rays%20dramatic%20shadows%20artistic%20installation%20photography%20refined%20sophisticated%20aesthetic%20cultural%20depth%20modern%20minimal%20composition&width=1600&height=1100&seq=hero-main-wk26-v2&orientation=landscape"
          alt=""
          className="w-full h-full object-cover"
          style={{
            transform: `scale(1.08) translateY(${scrollY * 0.04}px)`,
            transition: "transform 0.1s linear",
          }}
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[var(--wk-bg)]" />
      <div className="absolute inset-0 bg-black/25" />

      {/* Mobile inline header — logo + tagline */}
      <div className="absolute top-0 left-0 right-0 z-10 md:hidden pt-[calc(16px+env(safe-area-inset-top))] px-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white font-bold text-[22px] tracking-tight" style={{ fontFamily: "var(--wk-font-display)" }}>
              WAKILISHA
            </div>
            <span className="text-[11px] text-white/60 font-medium tracking-wide">
              Culture. Music. Charts. Editorial.
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center" style={{ minHeight: "100vh", padding: "clamp(80px,12vh,140px) clamp(20px,4vw,40px) clamp(40px,6vh,80px)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          {/* Headline */}
          <div className="max-w-[720px] mb-10 md:mb-14">
            <div
              className="inline-flex items-center gap-3 mb-6"
              style={{
                fontFamily: "var(--wk-font-mono, monospace)",
                fontSize: "0.7rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--wk-brand)",
                fontWeight: 600,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" style={{ boxShadow: "0 0 0 4px rgba(132,194,65,0.18)" }} />
              African creative life, starting with music
            </div>

            <h1
              className="font-black tracking-[-0.04em] text-white mb-6"
              style={{ fontSize: "clamp(3rem,6.5vw,5.5rem)", lineHeight: 0.94 }}
            >
              Your people
              <br />
              <span style={{ color: "var(--wk-brand)" }}>are here.</span>
            </h1>

            <p
              className="text-white/60 leading-relaxed max-w-[52ch]"
              style={{ fontSize: "clamp(1rem,1.4vw,1.2rem)" }}
            >
              WAKILISHA is where African creative life comes together. Music,
              stories, artists, charts, scenes, places, language, style, food,
              film, and the everyday culture that makes us us.
            </p>
          </div>

          {/* Portal cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ perspective: "1000px" }}>
            <div style={{ transform: `translateY(${scrollY * -0.015}px)`, transition: "transform 0.1s linear" }}>
              <ChartPortalCard entries={chartEntries} loading={loading} />
            </div>
            <div style={{ transform: `translateY(${scrollY * -0.01}px)`, transition: "transform 0.1s linear" }}>
              <MagazinePortalCard stories={stories} loading={loading} />
            </div>
            <div style={{ transform: `translateY(${scrollY * -0.005}px)`, transition: "transform 0.1s linear" }}>
              <RegistryPortalCard />
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="flex justify-center mt-12 md:mt-16">
            <div className="flex flex-col items-center gap-2 text-white/30">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
              <i className="ri-arrow-down-line text-sm animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}