import { Link } from "react-router-dom";

interface DestinationCard {
  label: string;
  sub: string;
  href: string;
  img: string;
  accent: string;
  icon: string;
}

const DESTINATIONS: DestinationCard[] = [
  {
    label: "Charts",
    sub: "Weekly rankings across African markets",
    href: "/charts",
    img: "https://readdy.ai/api/search-image?query=Abstract%20vibrant%20visualization%20of%20music%20charts%20and%20rankings%20with%20glowing%20luminous%20data%20points%20floating%20in%20dark%20space%20warm%20golden%20amber%20and%20green%20highlights%20flowing%20organic%20data%20patterns%20modern%20minimal%20data%20art%20aesthetic%20refined%20sophisticated%20technology%20meets%20culture%20editorial%20quality%20rich%20depth&width=800&height=500&seq=explore-charts-wk26&orientation=landscape",
    accent: "var(--wk-brand)",
    icon: "ri-bar-chart-line",
  },
  {
    label: "Artists",
    sub: "Profiles, chart moments, and full discographies.",
    href: "/artists",
    img: "https://readdy.ai/api/search-image?query=Abstract%20artistic%20portrait%20composition%20with%20warm%20golden%20amber%20light%20rays%20intersecting%20organic%20flowing%20forms%20dark%20background%20with%20rich%20earthy%20tones%20terracotta%20and%20ochre%20contemporary%20fine%20art%20aesthetic%20cultural%20depth%20sophisticated%20minimal%20gallery%20quality%20refined%20texture%20subtle%20human%20presence%20suggested%20through%20light%20and%20form&width=800&height=500&seq=explore-artists-wk26&orientation=landscape",
    acc: "var(--wk-v-music)",
    icon: "ri-mic-line",
  },
  {
    label: "Genres",
    sub: "Every sound has a story. Start here.",
    href: "/genres",
    img: "https://readdy.ai/api/search-image?query=Abstract%20interconnected%20network%20visualization%20with%20colorful%20warm%20nodes%20and%20flowing%20lines%20representing%20musical%20genre%20relationships%20dark%20background%20with%20amber%20coral%20teal%20and%20gold%20highlights%20organic%20flowing%20connections%20data%20art%20style%20sophisticated%20editorial%20quality%20modern%20minimal%20aesthetic%20cultural%20mapping%20concept&width=800&height=500&seq=explore-genres-wk26&orientation=landscape",
    accent: "var(--wk-v-intel)",
    icon: "ri-price-tag-3-line",
  },
  {
    label: "Magazine",
    sub: "Stories, interviews, reviews, essays, and field notes.",
    href: "/magazine",
    img: "https://readdy.ai/api/search-image?query=Abstract%20editorial%20composition%20with%20layered%20warm%20toned%20paper%20textures%20typography%20elements%20and%20photographic%20fragments%20floating%20in%20space%20rich%20amber%20ochre%20and%20dark%20green%20palette%20contemporary%20art%20direction%20sophisticated%20magazine%20aesthetic%20cultural%20storytelling%20visual%20poetry%20refined%20artistic%20arrangement&width=800&height=500&seq=explore-magazine-wk26&orientation=landscape",
    accent: "var(--wk-v-film)",
    icon: "ri-newspaper-line",
  },
  {
    label: "Guides",
    sub: "Where to go, what to hear, who to know.",
    href: "/guides",
    img: "https://readdy.ai/api/search-image?query=Abstract%20composition%20suggesting%20a%20curated%20journey%20through%20layered%20cultural%20landscapes%20warm%20golden%20light%20pathways%20through%20dark%20rich%20textured%20terrain%20organic%20flowing%20forms%20amber%20and%20ochre%20tones%20refined%20contemporary%20art%20aesthetic%20exploration%20and%20discovery%20theme%20sophisticated%20minimal%20composition%20editorial%20quality%20depth%20and%20mystery&width=800&height=500&seq=explore-guides-wk26&orientation=landscape",
    accent: "var(--wk-v-places)",
    icon: "ri-compass-line",
  },
  {
    label: "Labels",
    sub: "The labels, imprints, and collectives behind the music.",
    href: "/labels",
    img: "https://readdy.ai/api/search-image?query=Abstract%20geometric%20composition%20with%20overlapping%20translucent%20circular%20forms%20suggesting%20vinyl%20records%20and%20music%20labels%20warm%20dark%20amber%20and%20gold%20tones%20with%20subtle%20coral%20highlights%20rich%20layered%20textures%20contemporary%20minimal%20art%20aesthetic%20sophisticated%20cultural%20branding%20visual%20refined%20editorial%20quality%20elegant%20composition&width=800&height=500&seq=explore-labels-wk26&orientation=landscape",
    accent: "var(--wk-v-food)",
    icon: "ri-disc-line",
  },
];

export function HomeExplore() {
  return (
    <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
        {/* Header */}
        <div className="mb-10 md:mb-14 max-w-[600px]">
          <div
            className="mb-3 text-[var(--wk-brand)]"
            style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".7rem", letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 600 }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)]" />
              Everything in one place
            </span>
          </div>
          <h2
            className="font-black tracking-[-0.03em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(1.7rem,3.3vw,2.5rem)", lineHeight: 1.05 }}
          >
            Start Where the Culture Moves
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
            Jump into charts, artists, releases, stories, guides, genres, and labels. Find what you know.
            Discover what you missed. Argue with the rankings.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DESTINATIONS.map((dest) => (
            <Link
              key={dest.label}
              to={dest.href}
              className="group relative rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-400 hover:-translate-y-1.5 hover:border-[var(--wk-border-2)] cursor-pointer block"
            >
              {/* Image */}
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={dest.img}
                  alt={dest.label}
                  className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-105"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 transition-opacity duration-400"
                  style={{
                    background: `linear-gradient(135deg, ${dest.accent}15 0%, transparent 50%, rgba(8,9,8,0.75) 100%)`,
                  }}
                />
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-center gap-3 mb-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${dest.accent}18`, color: dest.accent }}
                  >
                    <i className={`${dest.icon} text-base`} />
                  </div>
                  <h3 className="text-[16px] font-black text-[var(--wk-text)] tracking-[-0.01em] group-hover:opacity-80 transition-opacity">
                    {dest.label}
                  </h3>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
                  {dest.sub}
                </p>
              </div>

              {/* Hover accent bar */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left"
                style={{ backgroundColor: dest.accent }}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}