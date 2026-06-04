import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";

const makeMobilePage = (
  key: string,
  label: string,
  colorVar: string,
  icon: string,
  description: string,
  items: { title: string; desc: string; icon: string }[]
) => {
  return function MobileVerticalPage() {
    return (
      <div className="wk-mobile-v5">
        <section className="home-section">
          <div className="mx-5 text-center pt-6 pb-4">
            <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl" style={{ background: `var(${colorVar})`, color: "#fff" }}>
              <WkIcon name={icon as any} size={28} />
            </div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-text-muted)] mb-2 flex items-center justify-center gap-2">
              <span className="w-3 h-px bg-[var(--wk-text-faint)]" />
              Coming Soon
            </div>
            <h1 className="text-[24px] font-black tracking-[-0.04em] text-[var(--wk-text)] mb-2">WAKILISHA {label}</h1>
            <p className="text-[13px] leading-relaxed text-[var(--wk-text-soft)]">{description}</p>
          </div>
        </section>

        <section className="home-section">
          <div className="mx-5 space-y-3">
            {items.map((item) => (
              <div key={item.title} className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `var(${colorVar})`, color: "#fff" }}>
                  <WkIcon name={item.icon as any} size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[var(--wk-text)]">{item.title}</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section pb-8">
          <div className="mx-5 text-center">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
            >
              <WkIcon name="ArrowLeft" size={16} />
              Back to WAKILISHA
            </Link>
          </div>
        </section>
      </div>
    );
  };
};

export const MobileFilm = makeMobilePage(
  "film", "Film", "--wk-v-film", "Film",
  "Filmmaker profiles, cinema calendars, festival coverage, documentary showcases, and video-as-culture criticism.",
  [
    { title: "Filmmaker Profiles", desc: "Directors, cinematographers, and producers across Africa.", icon: "Star" },
    { title: "Cinema Calendar", desc: "Screenings, premieres, and film festivals — mapped.", icon: "Calendar" },
    { title: "Documentary Showcase", desc: "Curated documentary features.", icon: "Clapperboard" },
    { title: "Criticism & Coverage", desc: "Film reviews and festival dispatches.", icon: "PenTool" },
  ]
);

export const MobileFashion = makeMobilePage(
  "fashion", "Fashion", "--wk-v-fashion", "Shirt",
  "Designers, textiles, street style, lookbooks, fashion events, and African aesthetic systems.",
  [
    { title: "Designer Directory", desc: "African fashion designers and houses.", icon: "Star" },
    { title: "Street Style", desc: "Everyday fashion across African cities.", icon: "Camera" },
    { title: "Fashion Editorials", desc: "Original photography and visual storytelling.", icon: "Image" },
    { title: "Events & Shows", desc: "Fashion week and runway coverage.", icon: "Calendar" },
  ]
);

export const MobileFood = makeMobilePage(
  "food", "Food", "--wk-v-food", "Utensils",
  "Chefs, street food, regional food histories, culinary routes, and diaspora food stories.",
  [
    { title: "Chef Profiles", desc: "Chefs shaping African cuisine.", icon: "Star" },
    { title: "Culinary Routes", desc: "Food-focused travel guides.", icon: "MapPin" },
    { title: "Food Histories", desc: "Regional food traditions and ingredients.", icon: "BookOpen" },
    { title: "Markets & Clubs", desc: "Curated food experiences and gatherings.", icon: "Store" },
  ]
);

export const MobileLanguage = makeMobilePage(
  "language", "Language", "--wk-v-language", "Languages",
  "Indigenous language archives, lyric annotation, oral histories, and vernacular documentation.",
  [
    { title: "Language Archives", desc: "Preserving indigenous languages.", icon: "Archive" },
    { title: "Lyric Annotation", desc: "Translating music lyrics across languages.", icon: "Music2" },
    { title: "Oral Histories", desc: "Proverbs and spoken traditions.", icon: "Mic" },
    { title: "Pronunciation Guides", desc: "Audio and phonetic tools.", icon: "Volume2" },
  ]
);

export const MobilePlaces = makeMobilePage(
  "places", "Places", "--wk-v-places", "MapPin",
  "Venues, cities, galleries, festivals, cultural routes, creative spaces, and travel itineraries.",
  [
    { title: "Venue Directory", desc: "Creative spaces across Africa.", icon: "Building" },
    { title: "Cultural Routes", desc: "Curated cultural itineraries.", icon: "Map" },
    { title: "Festival Calendar", desc: "All festivals, mapped and tracked.", icon: "Calendar" },
    { title: "City Guides", desc: "Neighbourhood-by-neighbourhood guides.", icon: "Compass" },
  ]
);