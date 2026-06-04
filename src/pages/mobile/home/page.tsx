import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import {
  HOME_CHART_ENTRIES,
  HOME_EDITORIAL_STORIES,
} from "@/mocks/home";

const PILLARS = [
  { key: "music", label: "Music", icon: "Music2", colorVar: "--wk-v-music", href: "/charts", status: "active" as const, desc: "Charts, artists, tracks, releases — the complete index." },
  { key: "guides", label: "Guides", icon: "Compass", colorVar: "--wk-v-intel", href: "/guides", status: "new" as const, desc: "Where to go, what to experience, who to know." },
  { key: "film", label: "Film", icon: "Film", colorVar: "--wk-v-film", href: "/film", status: "coming" as const, desc: "Filmmakers, cinema, festival coverage, documentary." },
  { key: "fashion", label: "Fashion", icon: "Shirt", colorVar: "--wk-v-fashion", href: "/fashion", status: "coming" as const, desc: "Designers, textiles, street style, beauty." },
  { key: "food", label: "Food", icon: "Utensils", colorVar: "--wk-v-food", href: "/food", status: "coming" as const, desc: "Chefs, street food, culinary routes, food histories." },
  { key: "language", label: "Language", icon: "Languages", colorVar: "--wk-v-language", href: "/language", status: "coming" as const, desc: "Indigenous archives, oral histories, vernacular." },
  { key: "places", label: "Places", icon: "MapPin", colorVar: "--wk-v-places", href: "/places", status: "coming" as const, desc: "Venues, cities, festivals, cultural routes." },
];

const trackPayload = (track: {
  slug?: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlayable?: boolean;
  source?: string;
}) => ({
  id: track.slug || `${track.title}-${track.artist}`.toLowerCase().replace(/\s+/g, "-"),
  title: track.title,
  artist: track.artist,
  artworkUrl: track.artworkUrl,
  isPlayable: track.isPlayable,
  source: track.source,
});

const MovementIcon = ({ movement }: { movement?: string }) => {
  if (movement === "up") return <WkIcon name="ArrowUp" size={13} className="text-[var(--wk-success)]" />;
  if (movement === "down") return <WkIcon name="ArrowDown" size={13} className="text-[var(--wk-danger)]" />;
  if (movement === "new") return <WkIcon name="Star" size={13} className="text-[var(--wk-brand)]" />;
  return null;
};

export default function MobileHome() {
  const { playTrack } = usePlayer();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const chartTracks = HOME_CHART_ENTRIES.map(trackPayload);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="wk-mobile-v5">
      {/* ════════════════════════════════════════
          HERO — Immersive, layered, breathing
      ════════════════════════════════════════ */}
      <section ref={heroRef} className="relative h-[100dvh] flex items-end overflow-hidden">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translateY(${scrollY * 0.06}px) scale(${1 + scrollY * 0.0001})`,
          }}
        >
          <img
            src="https://readdy.ai/api/search-image?query=Warm%20rich%20textured%20abstract%20composition%20evoking%20African%20cultural%20heritage%20with%20layered%20woven%20textile%20patterns%20flowing%20musical%20rhythm%20lines%20and%20organic%20handcrafted%20surfaces%2C%20amber%20ochre%20terracotta%20and%20deep%20olive%20green%20tones%2C%20golden%20light%20filtering%20through%20like%20gallery%20illumination%2C%20museum%20archival%20quality%20with%20contemporary%20artistic%20sensibility%2C%20subtle%20geometric%20motifs%20inspired%20by%20traditional%20African%20craft%20dissolving%20into%20abstract%20expression%2C%20atmospheric%20depth%20with%20soft%20painterly%20edges%2C%20warm%20emotional%20resonance%20no%20cold%20corporate%20aesthetic%2C%20editorial%20art%20direction%20with%20soul%20and%20texture&width=800&height=1000&seq=hero-wakilisha-art-v3&orientation=portrait"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20" />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {[...Array(12)].map((_, i) => {
            const shapes = ["◆", "○", "◈"];
            const shape = shapes[i % 3];
            const left = 8 + (i * 7) % 84;
            const delay = (i * 0.8) % 6;
            const size = 5 + (i % 2) * 3;
            return (
              <span
                key={i}
                className="absolute text-[var(--wk-brand)]/12 animate-float-slow"
                style={{
                  left: `${left}%`,
                  top: `${15 + (i * 15) % 55}%`,
                  fontSize: `${size}px`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${7 + (i % 3) * 2}s`,
                }}
              >
                {shape}
              </span>
            );
          })}
        </div>

        <div className="relative z-10 w-full px-5 pb-24">
          {/* Five verbs */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-5 animate-hero-fade" style={{ animationDelay: "0.15s" }}>
            {["Discovered", "Documented", "Funded", "Valued", "Sustained"].map((verb) => (
              <span key={verb} className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.18em]">
                {verb}
              </span>
            ))}
          </div>

          <h1
            className="font-black leading-[0.90] tracking-[-0.05em] text-white animate-hero-fade"
            style={{ fontSize: "clamp(32px, 10vw, 52px)", animationDelay: "0.3s" }}
          >
            African culture,{" "}
            <span className="relative inline-block">
              <span className="text-[var(--wk-brand)]">built to last</span>
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--wk-brand)]/25 rounded-full" />
            </span>.
          </h1>

          <p
            className="mt-4 text-[13px] leading-relaxed text-white/55 animate-hero-fade max-w-[380px]"
            style={{ animationDelay: "0.5s" }}
          >
            Building the infrastructure African creativity deserves — across music, film, fashion, food, language, and place.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 animate-hero-fade" style={{ animationDelay: "0.65s" }}>
            <Link
              to="/charts"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
            >
              <WkIcon name="BarChart3" size={16} />
              Explore Charts
            </Link>
            <Link
              to="/guides"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-3 text-[13px] font-semibold text-white active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
            >
              <WkIcon name="Compass" size={16} />
              Browse Guides
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CHARTS — Front and center, as art
      ════════════════════════════════════════ */}
      <section className="home-section pt-5">
        <div className="home-section-header">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-[2px] bg-[var(--wk-brand)]/50 rounded-full" />
            <span className="text-[9px] font-black text-[var(--wk-brand)] uppercase tracking-[0.2em]">Flagship</span>
          </div>
          <div className="home-section-title">WAKILISHA Charts</div>
          <Link to="/charts" className="home-section-more">Full chart</Link>
        </div>

        {/* #1 — Artistic treatment */}
        {HOME_CHART_ENTRIES[0] && (
          <Link
            to={`/tracks/${HOME_CHART_ENTRIES[0].slug}`}
            className="mx-5 mb-5 block overflow-hidden rounded-[18px] mobile-pressable"
            style={{ background: "var(--wk-surface)" }}
          >
            <div className="relative aspect-[4/3] bg-[var(--wk-surface-raised)] overflow-hidden">
              <img
                src={HOME_CHART_ENTRIES[0].artworkUrl}
                alt=""
                className="h-full w-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* Rank badge */}
              <div className="absolute top-4 left-4">
                <div className="relative">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-brand)]/90 backdrop-blur-sm text-white font-black text-[22px] leading-none">
                    1
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--wk-v-music)] animate-pulse-slow" />
                </div>
              </div>
              {/* Track info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-[var(--wk-brand)]/20 px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">#1 This Week</span>
                </div>
                <div className="text-[18px] font-black text-white leading-tight">{HOME_CHART_ENTRIES[0].title}</div>
                <div className="text-[13px] text-white/70">{HOME_CHART_ENTRIES[0].artist}</div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    playTrack(chartTracks[0], chartTracks);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand)] px-4 py-2 text-[12px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
                >
                  <WkIcon name="Play" size={14} /> Play #1
                </button>
              </div>
            </div>
          </Link>
        )}

        {/* Chart list 2-9 */}
        <div className="chart-row-list">
          {HOME_CHART_ENTRIES.slice(0, 8).map((entry, idx) => (
            <Link
              key={`${entry.rank}-${entry.slug}`}
              to={`/tracks/${entry.slug}`}
              className="chart-row mobile-pressable"
            >
              <div className="chart-row-num">{entry.rank}</div>
              <div className="chart-row-art"><img src={entry.artworkUrl} alt="" /></div>
              <div className="min-w-0 flex-1">
                <div className="chart-row-title">{entry.title}</div>
                <div className="chart-row-sub">{entry.artist}</div>
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold shrink-0">
                <MovementIcon movement={entry.movement} />
                {entry.movementAmount && entry.movementAmount > 0 && entry.movement !== "new" && (
                  <span style={{ color: entry.movement === "up" ? "var(--wk-success)" : "var(--wk-danger)" }}>
                    {entry.movementAmount}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  playTrack(chartTracks[idx], chartTracks);
                }}
                className="chart-delta delta-new"
                aria-label={`Play ${entry.title}`}
              >
                <WkIcon name="Play" size={14} />
              </button>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          MISSION — Short, weighty, woven in
      ════════════════════════════════════════ */}
      <section className="home-section">
        <div className="mx-5 rounded-2xl p-5" style={{ background: "var(--wk-bg-subtle)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-[2px] bg-[var(--wk-brand)]/50 rounded-full" />
            <span className="text-[9px] font-black text-[var(--wk-brand)] uppercase tracking-[0.18em]">Our Mission</span>
          </div>
          <p className="text-[16px] leading-relaxed font-semibold text-[var(--wk-text)]">
            African culture does not lack talent. What it often lacks are the{" "}
            <span className="relative inline-block">
              <span className="text-[var(--wk-brand)] font-bold">structures</span>
              <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-[var(--wk-brand)]/20 rounded-full" />
            </span>{" "}
            that help creative work travel further and generate meaningful value.
          </p>
          <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">
            WAKILISHA builds those structures — across music, film, fashion, food, language, and place.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          VERTICALS — Scrollable visual gallery
      ════════════════════════════════════════ */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-[2px] bg-[var(--wk-v-fashion)]/60 rounded-full" />
            <span className="text-[9px] font-black text-[var(--wk-text-faint)] uppercase tracking-[0.18em]">Cultural Verticals</span>
          </div>
          <div className="home-section-title">Seven pillars. One ecosystem.</div>
        </div>

        <div className="flex gap-3 overflow-x-auto px-5 pb-3 scrollbar-hide">
          {/* Music — larger, flagship */}
          <Link
            to="/charts"
            className="flex-none w-[200px] rounded-2xl overflow-hidden mobile-pressable"
            style={{ background: "var(--wk-surface)" }}
          >
            <div className="relative h-[100px] bg-[var(--wk-surface-raised)] overflow-hidden">
              <img
                src="https://readdy.ai/api/search-image?query=Rich%20warm%20amber%20textured%20abstract%20celebrating%20African%20music%20culture%2C%20flowing%20organic%20shapes%20suggesting%20sound%20waves%20and%20rhythm%20patterns%2C%20deep%20ochre%20and%20olive%20green%20tones%20with%20golden%20highlights%2C%20layered%20textures%20evoking%20vinyl%20grooves%20woven%20textiles%20and%20musical%20notation%2C%20atmospheric%20gallery%20lighting%20with%20warm%20glow%2C%20artistic%20interpretation%20of%20sound%20as%20visual%20form%2C%20no%20text%20no%20logos%2C%20editorial%20quality&width=400&height=200&seq=pillar-music-v2&orientation=landscape"
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-v-music)]" />
                  <span className="text-[9px] font-black text-[var(--wk-v-music)] uppercase">Active</span>
                </div>
                <div className="text-[16px] font-black text-white">Music</div>
              </div>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] text-[var(--wk-text-muted)] leading-relaxed">
                Charts, artists, tracks, releases — the complete index.
              </p>
            </div>
          </Link>

          {/* Guides */}
          <Link
            to="/guides"
            className="flex-none w-[200px] rounded-2xl overflow-hidden mobile-pressable"
            style={{ background: "var(--wk-surface)" }}
          >
            <div className="relative h-[100px] bg-[var(--wk-surface-raised)] overflow-hidden">
              <img
                src="https://readdy.ai/api/search-image?query=Artistic%20abstract%20composition%20in%20deep%20purple%20and%20violet%20tones%20evoking%20discovery%20exploration%20and%20cultural%20navigation%2C%20layered%20textures%20suggesting%20maps%20compass%20roses%20and%20journey%20paths%2C%20rich%20atmospheric%20depth%20with%20soft%20glowing%20highlights%2C%20contemporary%20gallery%20aesthetic%20with%20warm%20undertones%2C%20abstract%20interpretation%20of%20guidance%20wayfinding%20and%20cultural%20discovery%2C%20editorial%20quality%20no%20text%20no%20logos&width=400&height=200&seq=pillar-guides-v2&orientation=landscape"
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <span className="inline-flex items-center rounded-full bg-[var(--wk-v-intel)]/25 px-1.5 py-0.5 text-[8px] font-bold text-[var(--wk-v-intel)] uppercase mb-0.5">New</span>
                <div className="text-[16px] font-black text-white">Guides</div>
              </div>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] text-[var(--wk-text-muted)] leading-relaxed">Where to go, what to experience, who to know.</p>
            </div>
          </Link>

          {/* Remaining pillars */}
          {PILLARS.filter((p) => !["music", "guides"].includes(p.key)).map((pillar) => (
            <Link
              key={pillar.key}
              to={pillar.href}
              className="flex-none w-[150px] rounded-2xl border mobile-pressable active:scale-[0.97] transition-transform"
              style={{ background: "var(--wk-surface)", borderColor: "var(--wk-border)" }}
            >
              <div className="p-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                  style={{ background: `var(${pillar.colorVar})`, color: "#fff" }}
                >
                  <WkIcon name={pillar.icon} size={18} />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <h3 className="text-[14px] font-black text-[var(--wk-text)]">{pillar.label}</h3>
                  <span className="text-[9px] font-semibold text-[var(--wk-text-faint)]">Soon</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] line-clamp-2">
                  {pillar.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          GUIDES — Just launched, warm
      ════════════════════════════════════════ */}
      <section className="home-section">
        <div className="mx-5 rounded-2xl p-5 overflow-hidden relative" style={{ background: "var(--wk-surface)" }}>
          <div className="absolute top-0 right-0 w-[180px] h-full opacity-[0.04] pointer-events-none"
            style={{ background: `radial-gradient(circle at center, var(--wk-v-intel), transparent 70%)` }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-[var(--wk-v-intel)]/15 px-2 py-0.5 text-[9px] font-bold text-[var(--wk-v-intel)] uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-v-intel)]" />
                Just Launched
              </span>
            </div>
            <h2 className="text-[18px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-1">WAKILISHA Guides</h2>
            <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] mb-4">
              Your practical discovery layer — where to go, what to experience, who to know, and how to navigate African creative life.
            </p>
            <Link
              to="/guides"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
            >
              <WkIcon name="Compass" size={16} />
              Browse Guides
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MAGAZINE — Editorial gallery
      ════════════════════════════════════════ */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-[2px] bg-[var(--wk-v-film)]/60 rounded-full" />
            <span className="text-[9px] font-black text-[var(--wk-text-faint)] uppercase tracking-[0.18em]">Magazine</span>
          </div>
          <div className="home-section-title">Editorial</div>
          <Link to="/magazine" className="home-section-more">Read</Link>
        </div>
        <div className="mag-cards pt-0">
          {HOME_EDITORIAL_STORIES.map((story) => (
            <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card mobile-pressable">
              <div className="mag-card-art"><img src={story.heroUrl} alt="" /></div>
              <div>
                <div className="mag-card-tag">{story.section}</div>
                <div className="mag-card-title">{story.title}</div>
                <div className="mag-card-meta">{story.readingTime} min read · {story.date}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          NEWSLETTER — Warm community invite
      ════════════════════════════════════════ */}
      <section className="home-section pb-8">
        <div className="mx-5 rounded-2xl p-5 overflow-hidden relative" style={{ background: "var(--wk-surface)" }}>
          <div className="absolute -bottom-16 -left-16 w-[200px] h-[200px] opacity-[0.04] pointer-events-none rounded-full"
            style={{ background: `var(--wk-brand)` }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-[2px] bg-[var(--wk-brand)]/50 rounded-full" />
              <span className="text-[9px] font-black text-[var(--wk-brand)] uppercase tracking-[0.18em]">Stay Connected</span>
            </div>
            <h2 className="text-[18px] font-black tracking-[-0.04em] text-[var(--wk-text)] mb-1">The ecosystem, in your inbox.</h2>
            <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] mb-4">
              Chart updates, new guides, editorial deep-dives, and early access to new verticals across African creative life.
            </p>
            {subscribed ? (
              <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--wk-brand)]">
                <WkIcon name="Check" size={18} /> Subscribed! Check your inbox.
              </div>
            ) : (
              <form
                action="https://readdy.ai/api/form/d8gs0igb91vaa813drjg"
                method="POST"
                data-readdy-form=""
                className="flex flex-col gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) {
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    fetch(form.action, { method: "POST", body: new URLSearchParams(formData as any) })
                      .then(() => setSubscribed(true))
                      .catch(() => setSubscribed(true));
                  }
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/40 transition-colors"
                  style={{ borderColor: "var(--wk-border)" }}
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--wk-brand)] py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
                >
                  <WkIcon name="Send" size={15} className="mr-1 inline" />
                  Subscribe
                </button>
                <div className="flex items-center gap-4 text-[10px] text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1"><WkIcon name="ShieldCheck" size={12} /> No spam</span>
                  <span className="inline-flex items-center gap-1"><WkIcon name="CircleX" size={12} /> Unsubscribe anytime</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Animation styles */}
      <style>{`
        @keyframes heroFade {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-6px) rotate(3deg); }
          66% { transform: translateY(3px) rotate(-2deg); }
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .animate-hero-fade {
          opacity: 0;
          animation: heroFade 0.7s var(--wk-ease-snap) forwards;
        }
        .animate-float-slow {
          animation: floatSlow 8s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulseSlow 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-hero-fade, .animate-float-slow, .animate-pulse-slow {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}