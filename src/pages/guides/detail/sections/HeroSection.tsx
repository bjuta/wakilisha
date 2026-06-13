import { useState } from "react";
import type { HeroData, StatItem, FactItem, ButtonItem, ActionItem } from "../sectionTypes";

/* ─── Helpers ─── */

function StatsBar({ stats }: { stats: StatItem[] }) {
  return (
    <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="wk-container-wide px-6 py-6 md:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center md:text-left">
              <div className="text-[clamp(28px,4vw,48px)] font-black leading-none text-white">{stat.number}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FactsBar({ facts }: { facts: FactItem[] }) {
  return (
    <div className="flex flex-wrap gap-4 md:gap-8 mb-8">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col">
          <span className="text-[10px] md:text-xs uppercase tracking-wider text-white/50 font-semibold">{fact.label}</span>
          <span className="text-sm md:text-base text-white font-medium">{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function ActionButtons({ actions }: { actions: ActionItem[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {actions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          className={
            action.primary
              ? "inline-flex items-center px-5 py-2.5 text-sm font-semibold bg-white text-black rounded-md hover:bg-white/90 transition-colors whitespace-nowrap"
              : "inline-flex items-center px-5 py-2.5 text-sm font-semibold bg-transparent text-white border border-white/40 rounded-md hover:bg-white/10 transition-colors whitespace-nowrap"
          }
        >
          {action.label}
        </a>
      ))}
    </div>
  );
}

function GuideButtons({ buttons }: { buttons: ButtonItem[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {buttons.map((btn) => {
        const isPrimary = btn.variant === "primary";
        return (
          <a
            key={btn.label}
            href={btn.url}
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[13px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              isPrimary
                ? "bg-[var(--wk-v-intel)] text-white hover:bg-[var(--wk-v-intel-hover)]"
                : "border border-white/30 text-white hover:bg-white/10"
            }`}
          >
            {isPrimary ? <i className="ri-download-line" /> : <i className="ri-compass-3-line" />}
            {btn.label}
          </a>
        );
      })}
    </div>
  );
}

/* ─── Hero: Venice Biennale style ─── */

function VeniceHero({ data }: { data: HeroData }) {
  const heroSrc = data.heroImage || data.hero_image || "";
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative min-h-[85vh] md:min-h-[90vh] flex flex-col justify-between overflow-hidden">
      <div className="absolute inset-0 z-0">
        {heroSrc && (
          <img
            src={heroSrc}
            alt={data.title}
            className={`w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div className="relative z-10 wk-container-wide px-6 pt-8 md:pt-12">
        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
            <span className="text-white/50">WAKILISHA.AFRICA</span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">GUIDES</span>
            <span className="text-white/30">/</span>
            <span className="text-white/90 uppercase">{data.title.replace(/\s+/g, "-")}</span>
          </nav>
          {(data.issueBadge || data.issue_badge) && (
            <span className="inline-flex items-center rounded-full bg-[var(--wk-v-intel)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white">
              {data.issueBadge || data.issue_badge}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 wk-container-wide px-6 py-8 md:py-12">
        <div className="max-w-[900px]">
          <h1 className="text-[clamp(48px,10vw,120px)] font-black leading-[0.92] tracking-[-0.04em] text-white">
            {data.title}
          </h1>
        </div>
      </div>

      <div className="relative z-10 wk-container-wide px-6 pb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-2">
            {(data.curatorLabel || data.curator_label) && (
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">
                {data.curatorLabel || data.curator_label}
              </p>
            )}
            {(data.curatorName || data.curator_name) && (
              <p className="text-[18px] md:text-[22px] font-semibold text-white leading-snug">
                {data.curatorName || data.curator_name}
              </p>
            )}
            {(data.eventDate || data.event_date || data.locations) && (
              <p className="text-[13px] text-white/70 leading-relaxed">
                {data.eventDate || data.event_date}
                {(data.eventDate || data.event_date) && data.locations && <br />}
                {data.locations}
              </p>
            )}
          </div>
          {data.buttons && <GuideButtons buttons={data.buttons} />}
        </div>
      </div>

      {data.stats && <StatsBar stats={data.stats} />}
    </section>
  );
}

/* ─── Hero: Dakar dossier style ─── */

function DossierHero({ data }: { data: HeroData }) {
  const heroSrc = data.mastheadImage || data.masthead_image || data.heroImage || data.hero_image || "";

  return (
    <header className="relative w-full min-h-[85vh] md:min-h-[90vh] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0 z-0">
        {heroSrc && (
          <img src={heroSrc} alt={data.title} className="w-full h-full object-cover" width={1920} height={1072} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />
      </div>

      <div className="relative z-10 w-full px-6 md:px-10 lg:px-16 pb-8 md:pb-12 pt-32">
        <nav className="mb-6 text-xs tracking-wide text-white/70" aria-label="Breadcrumb">
          <span className="text-white/50">wakilisha.africa</span>
          <span className="mx-2 text-white/40">/</span>
          <span className="text-white/50">guides</span>
          <span className="mx-2 text-white/40">/</span>
          <span className="text-white/90 font-medium">{data.title.toLowerCase().replace(/\s+/g, "-")}</span>
        </nav>

        {data.badge && (
          <div className="inline-block mb-4 px-3 py-1 text-xs font-semibold tracking-wider uppercase bg-white/10 backdrop-blur-sm text-white rounded-full border border-white/20">
            {data.badge}
          </div>
        )}

        {data.kicker && (
          <div className="mb-3 text-sm md:text-base font-medium tracking-wider uppercase text-white/80">{data.kicker}</div>
        )}

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[0.95] mb-4">
          {data.title}
        </h1>

        {data.subtitle && (
          <p className="text-base md:text-lg text-white/70 font-medium mb-8">{data.subtitle}</p>
        )}

        {data.facts && <FactsBar facts={data.facts} />}
        {data.actions && <ActionButtons actions={data.actions} />}

        <a href="#dossier" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors">
          <span className="w-px h-6 bg-white/40 inline-block" />
          <span>Scroll</span>
        </a>
      </div>
    </header>
  );
}

/* ─── Hero: Literary reading style ─── */

function LiteraryHero({ data }: { data: HeroData }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <section className="relative overflow-hidden" style={{ background: "var(--wk-bg)" }}>
      <div className="absolute inset-0 bg-[#C4A35A]/[0.04] pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10 md:pb-16">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-12 gap-8">
          <div className="flex-1 lg:pt-4">
            <a href="/guides" className="inline-flex items-center gap-2 text-[13px] font-medium tracking-wide uppercase" style={{ color: "var(--wk-text-muted)" }}>
              <i className="ri-arrow-left-line" /> Guides
            </a>

            <div className="mt-6 mb-4">
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-widest uppercase" style={{ color: "var(--wk-text-muted)" }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C4A35A]" />
                {data.issueBadge || data.issue_badge || "Guide"} · {data.badge || "Open"}
              </span>
            </div>

            <h1 className="text-[36px] md:text-[52px] lg:text-[64px] font-black leading-[1.05] tracking-tight" style={{ color: "var(--wk-text)", fontFamily: "var(--wk-font-heading)" }}>
              {data.title}
            </h1>

            {data.lede && (
              <p className="mt-6 text-[16px] md:text-[18px] leading-relaxed italic max-w-[520px]" style={{ color: "var(--wk-text-soft)" }} dangerouslySetInnerHTML={{ __html: data.lede }} />
            )}

            {(data.author || data.publisher) && (
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" style={{ color: "var(--wk-text-muted)" }}>
                {data.author && (
                  <span>
                    By{" "}
                    <a href={data.author.url} className="underline underline-offset-2 hover:no-underline" style={{ color: "var(--wk-text)" }}>
                      {data.author.name}
                    </a>
                  </span>
                )}
                {data.publisher && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span>{data.publisher}</span>
                  </>
                )}
              </div>
            )}

            <div className="mt-8">
              <a href="#prologue" className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-[14px] font-semibold text-white transition-colors hover:opacity-90" style={{ background: "#C4A35A" }}>
                Start reading <i className="ri-arrow-down-line" />
              </a>
            </div>
          </div>

          {(data.coverImage || data.cover_image) && (
            <div className="lg:w-[320px] xl:w-[360px] flex-shrink-0">
              <div className="relative mx-auto w-[220px] md:w-[280px] lg:w-full">
                <div className="absolute -bottom-3 left-[8%] right-[8%] h-6 rounded-[50%] blur-lg opacity-40" style={{ background: "#8B7355" }} />
                <div className="relative aspect-[3/4] rounded-r-md overflow-hidden" style={{ background: "#2C2418" }}>
                  <div className="absolute left-0 top-0 bottom-0 w-3 bg-[#3D3224] z-10" />
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)] z-10 pointer-events-none" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C4A35A]/70 mb-3">WAKILISHA Guides</span>
                    <strong className="text-[22px] md:text-[26px] font-black leading-tight text-[#F5F0E8]">{data.title}</strong>
                    <em className="mt-3 text-[11px] text-[#C4A35A]/60 leading-relaxed max-w-[180px]">{data.subtitle || "A WAKILISHA guide."}</em>
                    {data.author && <i className="mt-4 text-[12px] text-[#F5F0E8]/50">{data.author.name}</i>}
                  </div>
                  <img
                    src={data.coverImage || data.cover_image}
                    alt={`${data.title} cover`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setImageLoaded(true)}
                  />
                </div>
                <div className="absolute -right-1 top-[10%] bottom-[10%] w-2 bg-[#1A150F] rounded-r-sm opacity-60" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Main export ─── */

export default function HeroSection({ data, variant }: { data: HeroData; variant?: string }) {
  // Auto-detect variant based on data shape
  if (variant === "literary" || data.lede || data.coverImage || data.cover_image) {
    return <LiteraryHero data={data} />;
  }
  if (variant === "dossier" || data.mastheadImage || data.masthead_image || data.facts || data.actions) {
    return <DossierHero data={data} />;
  }
  return <VeniceHero data={data} />;
}