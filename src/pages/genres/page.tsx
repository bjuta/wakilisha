import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/design-system/PageHero";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { listGenres, type RepairedGenre } from "@/services/repairedContent/client";

const genreVisual = (slug: string) =>
  `linear-gradient(135deg, rgba(132,194,65,.35), rgba(8,9,8,.92)), url(https://picsum.photos/seed/wk-genre-${slug}/800/1100)`;

const filters = ["All", "High activity", "Artist-rich", "Track-rich", "Recently updated"];

function accentVarForGenre(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("dance") || lower.includes("piano") || lower.includes("gqom") || lower.includes("kwaito") || lower.includes("gengetone")) return "--wk-v-dance";
  if (lower.includes("highlife") || lower.includes("soul") || lower.includes("gospel")) return "--wk-v-intel";
  if (lower.includes("bongo") || lower.includes("swahili") || lower.includes("east")) return "--wk-v-places";
  if (lower.includes("r&b") || lower.includes("rap") || lower.includes("trap") || lower.includes("film")) return "--wk-v-film";
  return "--wk-v-music";
}

export default function Genres() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<RepairedGenre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGenres();
      setGenres(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load genres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalArtists = genres.reduce((s, g) => s + g.artistCount, 0);
  const totalTracks = genres.reduce((s, g) => s + g.trackCount, 0);
  const featured = genres[0];
  const sideGenres = genres.slice(1, 4);

  const filteredGenres = useMemo(() => {
    const q = query.trim().toLowerCase();
    return genres.filter((genre) => {
      const matchesQuery =
        !q ||
        genre.name.toLowerCase().includes(q) ||
        genre.representativeArtists?.some((artist) =>
          artist.toLowerCase().includes(q)
        );
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "High activity" && genre.trackCount >= 100) ||
        (activeFilter === "Artist-rich" && genre.artistCount >= 25) ||
        (activeFilter === "Track-rich" && genre.trackCount >= 50) ||
        activeFilter === "Recently updated";
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query, genres]);

  const trendingGenres = useMemo(() => {
    return [...genres]
      .sort((a, b) => b.trackCount - a.trackCount)
      .slice(0, 4);
  }, [genres]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="wk-container-wide px-4 md:px-6 py-20">
          <div className="space-y-4">
            <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            <div className="h-12 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Compass" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load genres</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={loadData} className="wk-button wk-button-primary">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="wk-container-wide px-4 md:px-6">
        <PageHero
          variant="default"
          eyebrow={
            <>
              <WkIcon name="Compass" size={14} /> Cultural territories
            </>
          }
          title="Genre directory"
          subtitle="Browse WAKILISHA by genre as living cultural territory: artists, tracks, activity, representative voices, and routes into discovery."
          stats={[
            { value: genres.length, label: "Genres" },
            { value: totalArtists.toLocaleString(), label: "Artists" },
            { value: totalTracks.toLocaleString(), label: "Tracks" },
          ]}
          actions={
            <ShareButton
              item={{
                title: "WAKILISHA Genre Directory",
                subtitle: `${genres.length} genres`,
                description: "Browse the WAKILISHA cultural map by genre.",
                type: "page",
              }}
            />
          }
        />

        <div className="directory-toolbar">
          <div className="directory-filters">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`directory-filter ${activeFilter === filter ? "on" : ""}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <input
            className="directory-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search genre or representative artist"
          />
        </div>

        {featured && (
          <section className="genre-featured">
            <Link to={`/genres/${featured.slug}`} className="genre-feature-card">
              <div
                className="genre-feature-art"
                style={{ backgroundImage: genreVisual(featured.slug) }}
              />
              <div className="genre-feature-shade" />
              <div className="genre-feature-body">
                <div className="genre-feature-kicker">Genre of the week</div>
                <h2 className="genre-feature-title">{featured.name}</h2>
                <p className="genre-feature-copy">
                  {featured.artistCount} artists and {featured.trackCount} tracks
                  currently mapped in this territory. Representative voices:{" "}
                  {featured.representativeArtists?.slice(0, 3).join(", ") ||
                    "registry pending"}
                  .
                </p>
              </div>
            </Link>
            <div className="genre-side-stack">
              {sideGenres.map((genre) => (
                <Link key={genre.slug} to={`/genres/${genre.slug}`} className="genre-side-card">
                  <div className="genre-side-icon">
                    <WkIcon name="AudioWaveform" size={28} />
                  </div>
                  <div className="min-w-0">
                    <div className="artist-list-name">{genre.name}</div>
                    <div className="artist-list-sub">
                      {genre.artistCount} artists · {genre.trackCount} tracks
                    </div>
                    <div className="artist-card-tags">
                      {genre.representativeArtists?.slice(0, 2).map((artist) => (
                        <span key={artist} className="tag tag-sm">
                          {artist}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Featured genres</div>
              <h2 className="section-title">Cultural entry points</h2>
            </div>
            <p className="section-copy">
              Genre cards use color, texture, iconography, and activity signals
              instead of fake human faces.
            </p>
          </div>
          <div className="genre-grid">
            {trendingGenres.map((genre) => (
              <GenreTile key={genre.slug} genre={genre} featured />
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Full genre grid</div>
              <h2 className="section-title">All mapped territories</h2>
            </div>
            <p className="section-copy">
              Showing {filteredGenres.length} of {genres.length} imported genres.
            </p>
          </div>
          <div className="genre-grid">
            {filteredGenres.map((genre) => (
              <GenreTile key={genre.slug} genre={genre} />
            ))}
          </div>
          {filteredGenres.length === 0 && (
            <div className="artist-empty">
              <WkIcon name="Compass" size={32} />
              <div className="mt-3">No genres match this search.</div>
            </div>
          )}
        </section>

        <section className="pg-layout cols-2 pb-10">
          <div className="pg-block">
            <div className="pg-block-label">Recently updated</div>
            <div className="space-y-3">
              {genres.slice(0, 5).map((genre) => (
                <Link
                  key={genre.slug}
                  to={`/genres/${genre.slug}`}
                  className="artist-list-item px-0"
                >
                  <div className="artist-list-ava flex items-center justify-center">
                    <WkIcon name="Radio" size={20} />
                  </div>
                  <div>
                    <div className="artist-list-name">{genre.name}</div>
                    <div className="artist-list-sub">
                      {genre.representativeArtists?.slice(0, 2).join(", ") ||
                        "Representative artists pending"}
                    </div>
                  </div>
                  <div className="artist-list-stat">{genre.trackCount}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">Directory rule</div>
            <h3 className="pg-block-title">Genres are portals, not people.</h3>
            <p className="pg-block-body">
              This chapter uses abstract visual treatment, metadata density,
              iconography, and cultural routing. Human photography belongs to
              artist pages, not genre cards.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function GenreTile({
  genre,
  featured = false,
}: {
  genre: RepairedGenre;
  featured?: boolean;
}) {
  return (
    <Link to={`/genres/${genre.slug}`} className="genre-card">
      <div
        className="genre-card-bg"
        style={{ backgroundImage: genreVisual(genre.slug) }}
      />
      <div className="genre-card-overlay" />
      <div className="genre-card-icon">
        <WkIcon name={featured ? "Flame" : "Music2"} size={15} />
      </div>
      <div className="genre-card-body">
        <div className="genre-card-name">{genre.name}</div>
        <div className="genre-card-count">
          {genre.artistCount} artists · {genre.trackCount} tracks
        </div>
      </div>
    </Link>
  );
}