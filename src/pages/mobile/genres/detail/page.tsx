import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ch19Background } from "@/utils/ch19";
import { getGenre, type RepairedGenreDetail } from "@/services/repaired/client";

export default function MobileGenreDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<RepairedGenreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) { setLoading(false); setError("No genre slug"); return; }
    setLoading(true);
    getGenre(slug)
      .then((data) => { if (!alive) return; if (!data) { setError("Genre not found"); setLoading(false); return; } setDetail(data); setLoading(false); })
      .catch((err) => { if (!alive) return; setError(err instanceof Error ? err.message : "Error"); setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[14px] font-semibold text-[var(--wk-text-muted)]">Loading genre...</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen px-6 py-16 text-center">
        <WkIcon name="Compass" size={36} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <h1 className="mb-2 text-[22px] font-black text-[var(--wk-text)]">Genre not found</h1>
        <p className="text-[var(--wk-text-muted)]">{error || "Not found"}</p>
        <Link to="/genres" className="mt-5 inline-block rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)]">Back to genres</Link>
      </div>
    );
  }

  const { genre, artists, topTracks, relatedGenres } = detail;
  const heroBg = ch19Background({ slug: genre.slug, name: genre.name });

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">

      {/* Hero */}
      <section className="relative flex min-h-[260px] items-end overflow-hidden">
        <div className="absolute inset-0" style={{ background: heroBg }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative w-full px-5 pb-6 pt-16">
          <Link to="/genres" className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50">
            <i className="ri-arrow-left-line text-[11px]" /> Genres
          </Link>
          <h1 className="text-[32px] font-black leading-[0.92] tracking-[-0.03em] text-white">{genre.name}</h1>
          {genre.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">{genre.description}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1"><strong className="text-white/80">{artists.length}</strong> artists</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1"><strong className="text-white/80">{topTracks.length}</strong> tracks</span>
          </div>
        </div>
      </section>

      <div className="px-5 py-8 space-y-8">

        {/* Artists */}
        {artists.length > 0 && (
          <section>
            <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Artists · {artists.length}</h2>
            <div className="grid grid-cols-3 gap-2">
              {artists.slice(0, 12).map((a) => (
                <Link key={a.slug} to={`/artists/${a.slug}`} className="overflow-hidden rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                  <div className="aspect-square bg-[var(--wk-surface-raised)]">
                    {a.imageUrl ? <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" /> : <Chapter19FallbackImage slug={a.slug} name={a.name} className="h-full" />}
                  </div>
                  <div className="p-2"><div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{a.name}</div></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Tracks */}
        {topTracks.length > 0 && (
          <section>
            <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Top tracks · {topTracks.length}</h2>
            <div className="divide-y divide-[var(--wk-divider)] rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              {topTracks.slice(0, 10).map((t, i) => (
                <Link key={t.slug} to={`/tracks/${t.slug}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-center text-[12px] font-bold text-[var(--wk-text-faint)]">{i + 1}</span>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                    {t.artworkUrl ? <img src={t.artworkUrl} alt={t.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><WkIcon name="Music2" size={14} className="text-[var(--wk-text-faint)]" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{t.title}</div>
                    <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{t.artistName}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related genres */}
        {relatedGenres.length > 0 && (
          <section>
            <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Related genres</h2>
            <div className="flex flex-wrap gap-2">
              {relatedGenres.map((rg) => (
                <Link key={rg.slug} to={`/genres/${rg.slug}`} className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--wk-text-soft)]">
                  {rg.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <Link to="/genres" className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--wk-brand)] py-3 text-[14px] font-bold text-[var(--wk-brand-on)]">
          <i className="ri-compass-line text-[15px]" /> Browse all genres
        </Link>
      </div>
    </div>
  );
}