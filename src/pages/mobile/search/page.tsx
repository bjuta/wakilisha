import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ARTISTS } from "@/mocks/artists";
import { TRACK_DETAILS } from "@/mocks/trackDetails";
import { RELEASES } from "@/mocks/releases";
import { GENRES } from "@/mocks/genres";
import { LABELS } from "@/mocks/labels";
import { CHART_DATA } from "@/mocks/charts";

const TABS = ["All", "Artists", "Tracks", "Releases", "Genres", "Labels"] as const;
type Tab = (typeof TABS)[number];

export default function MobileSearch() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [loading, setLoading] = useState(false);
  const { playTrack } = usePlayer();

  const q = query.trim().toLowerCase();

  useEffect(() => {
    if (!q) { setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => {
    if (!q) return { artists: [], tracks: [], releases: [], genres: [], labels: [], charts: [] };
    const artists = ARTISTS.filter((a) => a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q)));
    const tracks = TRACK_DETAILS.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    const releases = RELEASES.filter((r) => r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q));
    const genres = GENRES.filter((g) => g.name.toLowerCase().includes(q));
    const labels = LABELS.filter((l) => l.name.toLowerCase().includes(q) || (l.country || "").toLowerCase().includes(q));
    const charts = CHART_DATA.filter((c) => c.title.toLowerCase().includes(q) || c.artist.toLowerCase().includes(q));
    return { artists, tracks, releases, genres, labels, charts };
  }, [q]);

  const total = results.artists.length + results.tracks.length + results.releases.length + results.genres.length + results.labels.length + results.charts.length;

  const showArtists = activeTab === "All" || activeTab === "Artists";
  const showTracks = activeTab === "All" || activeTab === "Tracks";
  const showReleases = activeTab === "All" || activeTab === "Releases";
  const showGenres = activeTab === "All" || activeTab === "Genres";
  const showLabels = activeTab === "All" || activeTab === "Labels";

  const handlePlayTrack = (track: (typeof TRACK_DETAILS)[0]) => {
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source },
      [{ id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source }]
    );
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Search bar */}
      <div className="px-5 py-4">
        <div className="relative">
          <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search music, artists, charts..."
            className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-3 pl-11 pr-10 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]">
              <i className="ri-close-line" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {q && (
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const count = tab === "All" ? total : tab === "Artists" ? results.artists.length : tab === "Tracks" ? results.tracks.length : tab === "Releases" ? results.releases.length : tab === "Genres" ? results.genres.length : results.labels.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "border border-[var(--wk-border)] text-[var(--wk-text-soft)]"
                }`}
              >
                {tab} {count > 0 && <span className="ml-1 opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="px-5 py-2">
        {!q && (
          <div className="space-y-8">
            {/* Recent searches */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Trending</div>
              <div className="flex flex-wrap gap-2">
                {["Burna Boy", "Afrobeats", "Amapiano", "Tems", "Wizkid", "Asake", "Davido", "Rema"].map((term) => (
                  <button key={term} onClick={() => setQuery(term)} className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)]">
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Browse</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "ri-bar-chart-line", label: "Charts", to: "/charts" },
                  { icon: "ri-user-line", label: "Artists", to: "/artists" },
                  { icon: "ri-album-line", label: "Releases", to: "/releases" },
                  { icon: "ri-folder-music-line", label: "Genres", to: "/genres" },
                  { icon: "ri-building-2-line", label: "Labels", to: "/labels" },
                  { icon: "ri-article-line", label: "Magazine", to: "/magazine" },
                ].map((c) => (
                  <Link key={c.to} to={c.to} className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[var(--wk-text)]">
                    <i className={`${c.icon} text-[var(--wk-brand)]`} />
                    <span className="text-[12px] font-bold">{c.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {q && loading && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--wk-brand)] border-t-transparent" />
            <div className="mt-2 text-[12px]">Searching...</div>
          </div>
        )}

        {q && !loading && total === 0 && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-search-line mb-3 block text-4xl" />
            <div className="text-[15px] font-bold text-[var(--wk-text)]">No results</div>
            <div className="text-[12px] mt-1">Try a different search term.</div>
          </div>
        )}

        {q && !loading && (
          <div className="space-y-8">
            {/* Artists */}
            {showArtists && results.artists.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Artists · {results.artists.length}</div>
                <div className="grid grid-cols-2 gap-3">
                  {results.artists.slice(0, activeTab === "All" ? 4 : undefined).map((artist) => (
                    <Link key={artist.slug} to={`/artists/${artist.slug}`} className="block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                      <div className="relative aspect-[4/3] bg-[var(--wk-surface-raised)]">
                        {artist.imageUrl ? (
                          <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <i className="ri-user-3-line text-3xl text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                      <div className="p-3">
                        <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{artist.name}</div>
                        <div className="text-[11px] text-[var(--wk-text-muted)]">{artist.genres.slice(0, 2).join(", ")}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Tracks */}
            {showTracks && results.tracks.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Tracks · {results.tracks.length}</div>
                <div className="space-y-2">
                  {results.tracks.slice(0, activeTab === "All" ? 6 : undefined).map((track) => (
                    <div key={track.slug} className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                      <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-[var(--wk-surface-raised)]">
                        <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/tracks/${track.slug}`} className="text-[13px] font-bold text-[var(--wk-text)] truncate block">{track.title}</Link>
                        <div className="text-[11px] text-[var(--wk-text-muted)]">{track.artist}</div>
                      </div>
                      <button onClick={() => handlePlayTrack(track)} disabled={!track.isPlayable} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] disabled:opacity-40">
                        <i className="ri-play-mini-fill text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Releases */}
            {showReleases && results.releases.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Releases · {results.releases.length}</div>
                <div className="grid grid-cols-2 gap-3">
                  {results.releases.slice(0, activeTab === "All" ? 4 : undefined).map((release) => (
                    <Link key={release.slug} to={`/releases/${release.slug}`} className="block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                      <div className="aspect-square bg-[var(--wk-surface-raised)]">
                        {release.artworkUrl ? (
                          <img src={release.artworkUrl} alt={release.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <i className="ri-album-line text-3xl text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{release.title}</div>
                        <div className="text-[11px] text-[var(--wk-text-muted)]">{release.artist}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">{release.releaseType}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Genres */}
            {showGenres && results.genres.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Genres · {results.genres.length}</div>
                <div className="space-y-2">
                  {results.genres.map((genre) => (
                    <Link key={genre.slug} to={`/genres/${genre.slug}`} className="block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                      <div className="text-[16px] font-bold text-[var(--wk-text)]">{genre.name}</div>
                      <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{genre.artistCount} artists · {genre.trackCount} tracks</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Labels */}
            {showLabels && results.labels.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Labels · {results.labels.length}</div>
                <div className="space-y-2">
                  {results.labels.map((label) => (
                    <div key={label.slug} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                      <div className="text-[14px] font-bold text-[var(--wk-text)]">{label.name}</div>
                      <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{label.artistCount} artists · {label.releaseCount} releases</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}