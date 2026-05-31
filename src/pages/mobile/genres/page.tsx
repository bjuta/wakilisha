import { Link } from "react-router-dom";
import { GENRES, TRENDING_GENRES } from "@/mocks/genres";

const bg = (slug: string, accentVar?: string) => ({
  background: `linear-gradient(135deg, var(${accentVar ?? "--wk-brand"}), var(--wk-bg)), url(https://picsum.photos/seed/genre-${slug}/400/540) center/cover`,
  backgroundBlendMode: "multiply",
});

export default function MobileGenres() {
  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><i className="ri-compass-3-line" /> Discovery</div>
        <h1 className="charts-title">Genres</h1>
        <p className="charts-meta">{GENRES.length} cultural territories · {GENRES.reduce((s, g) => s + g.trackCount, 0).toLocaleString()} tracks mapped</p>
      </section>

      <div className="spec-section-hd">Trending territories</div>
      <div className="phn-scroll-row">
        {TRENDING_GENRES.map((genre) => (
          <Link key={genre.slug} to={`/genres/${genre.slug}`} className="gcard-mob" style={{ width: 156 }}>
            <div className="gcard-mob-bg" style={bg(genre.slug, genre.accentVar)} />
            <div className="gcard-mob-overlay" />
            <div className="gcard-mob-name">{genre.name}</div>
            <div className="gcard-mob-count">{genre.artistCount} artists · {genre.trackCount} tracks</div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">All genres</div>
      <div className="genre-grid-mobile">
        {GENRES.map((genre) => (
          <Link key={genre.slug} to={`/genres/${genre.slug}`} className="gcard-mob">
            <div className="gcard-mob-bg" style={bg(genre.slug, genre.accentVar)} />
            <div className="gcard-mob-overlay" />
            <div className="gcard-mob-name">{genre.name}</div>
            <div className="gcard-mob-count">{genre.artistCount} artists · {genre.trackCount} tracks</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
