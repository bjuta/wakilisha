import { useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { slugify } from "@/services/publicContent/client";

interface FeaturedArtist {
  name: string;
  slug: string;
  imageUrl?: string | null;
}

export default function ReleaseFeaturedArtists({
  artists,
  releaseArtist,
}: {
  artists: FeaturedArtist[];
  releaseArtist: string;
}) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);

  if (!artists || artists.length === 0) return null;

  const uniqueArtists = artists.filter(
    (a, i, arr) => arr.findIndex((x) => (x.slug || slugify(x.name)) === (a.slug || slugify(a.name))) === i
  );

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="UserPlus" size={12} />
            Featured artists
          </div>
          <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
            {uniqueArtists.length} artist{uniqueArtists.length !== 1 ? "s" : ""}
          </h2>
        </div>

        <p className="text-[13px] font-semibold text-[var(--wk-text-muted)] mb-5">
          {releaseArtist} brought these artists together on this release — every feature adds a new voice to the project.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {uniqueArtists.map((artist) => {
            const artistSlug = artist.slug || slugify(artist.name);
            return (
              <Link
                key={artistSlug}
                to={`/artists/${artistSlug}`}
                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl bg-[var(--wk-bg)] border border-[var(--wk-border)] hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-surface-raised)] transition-all duration-200"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-[var(--wk-brand-soft)] flex items-center justify-center group-hover:bg-[var(--wk-brand)]/10 transition-colors">
                  <ArtistAvatar imageUrl={artist.imageUrl} name={artist.name} />
                </div>
                <span className="text-[13px] font-extrabold text-[var(--wk-text)] text-center leading-tight group-hover:text-[var(--wk-brand)] transition-colors">
                  {artist.name}
                </span>
                <span className="text-[10px] font-semibold text-[var(--wk-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity">
                  View profile
                  <WkIcon name="ArrowUpRight" size={10} className="inline ml-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ArtistAvatar({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <WkIcon
      name="User"
      size={22}
      className="text-[var(--wk-brand)] group-hover:text-[var(--wk-brand)] transition-colors"
    />
  );
}