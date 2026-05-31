import { Link } from "react-router-dom";
import { GENRES, TRENDING_GENRES } from "@/mocks/genres";
import { WkIcon } from "@/components/design-system/Icon";

const bg = (slug: string, accentVar?: string) => ({
  background: `linear-gradient(135deg, var(${accentVar ?? "--wk-brand"}), var(--wk-bg)), url(https://picsum.photos/seed/genre-${slug}/400/540) center/cover`,
  backgroundBlendMode: "multiply",
});

export default function MobileGenres() {
  const totalTracks = GENRES.reduce((s, g) => s + g.trackCount, 0).toLocaleString();
  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><WkIcon name="Compass" size={14} /> Discovery</div>
        <h1 className="charts-title">Genres</h1>
        <p className="charts-meta">{GENRES.length} cultural territories · {totalTracks} tracks mapped</p>
      </section>

      <div className="grid grid-cols-3 gap-px border-y border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { label: "Genres", value: GENRES.length },
          { label: "Tracks", value: totalTracks },
          { label: "Trending", value: TRENDING_GENRES.length },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-2 py-3 text-center">
            <div className="truncate text-[15px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="spec-section-hd">Trending territories</div>
      <div className="phn-scroll-row">
        {TRENDING_GENRES.map((genre) => (
          <Link key={genre.slug} to={`/genres/${genre.slug}`} className="gcard-mob mobile-pressable" style={{ width: 156 }}>
            <div className="gcard-mob-bg" style={bg(genre.slug, genre.accentVar)} />
            <div className="gcard-mob-overlay" />
            <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"><WkIcon name="AudioWaveform" size={15} /></div>
            <div className="gcard-mob-name">{genre.name}</div>
            <div className="gcard-mob-count">{genre.artistCount} artists · {genre.trackCount} tracks</div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">All genres</div>
      <div className="genre-grid-mobile">
        {GENRES.map((genre) => (
          <Link key={genre.slug} to={`/genres/${genre.slug}`} className="gcard-mob mobile-pressable">
            <div className="gcard-mob-bg" style={bg(genre.slug, genre.accentVar)} />
            <div className="gcard-mob-overlay" />
            <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"><WkIcon name="Music2" size={15} /></div>
            <div className="gcard-mob-name">{genre.name}</div>
            <div className="gcard-mob-count">{genre.artistCount} artists · {genre.trackCount} tracks</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
