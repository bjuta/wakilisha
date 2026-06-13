import { useState } from "react";
import { inMinorKeysData } from "../data";

export default function GuideHeroSection() {
  const { heroImage, issueBadge, title, curatorLabel, curatorName, eventDate, locations, stats } = inMinorKeysData;
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative min-h-[85vh] md:min-h-[90vh] flex flex-col justify-between overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="In Minor Keys guide hero"
          className={`w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImageLoaded(true)}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
        {/* Atmospheric bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 wk-container-wide px-6 pt-8 md:pt-12">
        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
            <span className="text-white/50">WAKILISHA.AFRICA</span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">GUIDES</span>
            <span className="text-white/30">/</span>
            <span className="text-white/90">IN-MINOR-KEYS</span>
          </nav>
          <span className="inline-flex items-center rounded-full bg-[var(--wk-v-intel)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white">
            {issueBadge}
          </span>
        </div>
      </div>

      {/* Title block */}
      <div className="relative z-10 wk-container-wide px-6 py-8 md:py-12">
        <div className="max-w-[900px]">
          <h1 className="text-[clamp(48px,10vw,120px)] font-black leading-[0.92] tracking-[-0.04em] text-white">
            <span className="block">In Minor</span>
            <span className="block italic font-light">Keys</span>
          </h1>
        </div>
      </div>

      {/* Sub-row */}
      <div className="relative z-10 wk-container-wide px-6 pb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">
              {curatorLabel}
            </p>
            <p className="text-[18px] md:text-[22px] font-semibold text-white leading-snug">
              <span className="text-white">Koyo Kouoh</span>
              <span className="text-white/60"> | </span>
              <span className="italic font-light">In Minor Keys</span>
            </p>
            <p className="text-[13px] text-white/70 leading-relaxed">
              {eventDate}
              <br />
              {locations}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="#download" className="inline-flex items-center gap-2 rounded-lg bg-[var(--wk-v-intel)] px-6 py-3 text-[13px] font-bold text-white hover:bg-[var(--wk-v-intel-hover)] transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-download-line" /> Download Free Guide
            </a>
            <a href="#inside" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-[13px] font-bold text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-compass-3-line" /> Explore Preview
            </a>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="wk-container-wide px-6 py-6 md:py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <div className="text-[clamp(28px,4vw,48px)] font-black leading-none text-white">
                  {stat.number}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}