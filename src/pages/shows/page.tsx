import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import type { PublicShowHeader, PublicShowDetail } from "@/services/shows/showPublicModel";
import { getPublicShow, getPublicShowIndex } from "@/services/shows/showPublicService";

const SITE_URL = "https://wakilisha.africa";

export default function PublicShowsPage() {
  const [shows, setShows] = useState<PublicShowHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [featuredShow, setFeaturedShow] = useState<PublicShowDetail | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getPublicShowIndex(48)
      .then((result) => {
        if (active) setShows(result.items);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Shows could not load.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const first = shows[0];
    if (!first) { setFeaturedShow(null); return; }
    let active = true;
    getPublicShow(first.slug)
      .then((show) => { if (active) setFeaturedShow(show); })
      .catch(() => { if (active) setFeaturedShow(null); });
    return () => { active = false; };
  }, [shows]);

  return (
    <>
      <MetaTags
        title="Podcasts | WAKILISHA"
        description="Published podcasts, their episodes, transcripts and audio from WAKILISHA."
        url={`${SITE_URL}/shows`}
      />
      <main data-wk-workbook-screen="podcasts" className="min-h-screen pb-24">
        <div className={`mx-auto w-full max-w-[1320px] px-5 pb-9 sm:px-9 sm:pt-9 ${!shows[0] ? "pt-[calc(56px+env(safe-area-inset-top))]" : "pt-0"}`}>
          {!shows[0] && (
            <h1 className="mb-6 text-[clamp(38px,5vw,62px)] font-extrabold uppercase leading-[.95] tracking-[-.05em] text-[var(--wk-text)]">Podcasts</h1>
          )}
          {loading && (
            <div className="grid gap-9 lg:grid-cols-[.74fr_1.26fr]" aria-busy="true">
              <div className="aspect-square animate-pulse rounded-[18px] bg-[var(--wk-surface-raised)]" />
              <div className="space-y-4">
                {[0,1,2].map(i => <div key={i} className="h-28 animate-pulse rounded-[16px] bg-[var(--wk-surface-raised)]" />)}
              </div>
            </div>
          )}
          {!loading && error && <p role="alert" className="text-[14px] text-[var(--wk-text-muted)]">Podcasts are temporarily unavailable.</p>}
          {!loading && !error && shows.length === 0 && <p className="py-10 text-[14px] text-[var(--wk-text-muted)]">No podcasts have been published yet.</p>}
          {!loading && !error && shows[0] && (
            <div className="grid gap-9 lg:grid-cols-[.74fr_1.26fr] lg:gap-11">
              <section className="min-w-0">
                <Link to={shows[0].canonicalPath} className="wk-reference-podcast-cover group max-md:-mx-5 max-md:rounded-none" style={{ background: "#1B1B1B", color: "#FFFFFF" }} aria-label={`Open ${shows[0].title}`}>
                  <span className="max-w-[80%] break-words text-center text-[clamp(32px,5vw,56px)] font-extrabold leading-[1.06] tracking-[-.05em] text-white">
                    {shows[0].title}
                  </span>
                </Link>
                <div className="mt-5 text-[11px] font-bold uppercase tracking-[.15em] text-[var(--wk-brand)]">Podcast</div>
                <h1 className="mt-2 text-[clamp(34px,4vw,52px)] font-extrabold uppercase leading-[.95] tracking-[-.045em] text-[var(--wk-text)]">
                  {shows[0].title}
                </h1>
                {shows[0].description && (
                  <p id="podcast-about" className="mt-4 max-w-[48ch] text-[15px] leading-[1.6] text-[var(--wk-text-soft)]">
                    {shows[0].description}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={shows[0].canonicalPath} className="inline-flex min-h-11 items-center rounded-full bg-[var(--wk-text)] px-5 text-[14px] font-bold text-[var(--wk-bg)]">
                    Explore show ↗
                  </Link>
                  <a href="#podcast-episodes" className="inline-flex min-h-11 items-center rounded-full border border-[var(--wk-border-2)] px-5 text-[14px] font-semibold text-[var(--wk-text)]">
                    Episodes
                  </a>
                </div>
                <p className="mt-5 text-[13px] text-[var(--wk-text-muted)]">
                  <strong className="text-[var(--wk-text)]">{shows[0].episodeCount}</strong> episodes
                </p>
              </section>
              <section id="podcast-episodes" className="min-w-0">
                <div className="wk-reference-pills mb-4">
                  <a href="#podcast-episodes" className="wk-reference-pill" aria-current="page">Episodes</a>
                  <a href="#podcast-about" className="wk-reference-pill">About</a>
                </div>
                {featuredShow?.episodes.length ? (
                  <div className="grid gap-1">
                    {[...featuredShow.episodes].reverse().map(({episode,audio,video}) => (
                      <Link key={episode.resourceId} to={episode.canonicalPath} className="group flex min-w-0 gap-4 border-b border-[var(--wk-border)] px-2 py-4 hover:bg-[var(--wk-surface)]">
                        <div className="aspect-square w-[76px] shrink-0 rounded-[12px] bg-[linear-gradient(155deg,#9c91c4,#4d355c)] sm:w-[96px]" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-[var(--wk-brand)]">{episode.episodeNumber ? `Ep ${episode.episodeNumber}` : "Episode"}{audio?.delivery.durationSeconds ? ` · ${Math.round(audio.delivery.durationSeconds / 60)} min` : ""}</p>
                          <h2 className="mt-2 line-clamp-2 text-[17px] font-bold leading-[1.2] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">{episode.title}</h2>
                          {episode.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-[var(--wk-text-muted)]">{episode.summary}</p>}
                          {video && <span className="mt-2 inline-block text-[11px] text-[var(--wk-text-muted)]">Watch or listen</span>}
                        </div>
                        <span aria-hidden="true" className="self-center text-[23px] text-[var(--wk-text)]">↗</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link to={shows[0].canonicalPath} className="block border-t border-[var(--wk-border)] py-5 text-[14px] font-semibold text-[var(--wk-text)]">
                    See published episodes ↗
                  </Link>
                )}
              </section>
            </div>
          )}
          {!loading && !error && shows.length > 1 && (
            <section className="mt-12">
              <h2 className="wk-reference-section-heading mb-5">More podcasts</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shows.slice(1).map(show => (
                  <Link key={show.resourceId} to={show.canonicalPath} className="group min-w-0">
                    <div className="aspect-square rounded-[12px] bg-[linear-gradient(155deg,#9879a8,#33253d)]" />
                    <h3 className="mt-3 text-[17px] font-bold leading-[1.2] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">{show.title}</h3>
                    <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">{show.episodeCount} episodes</p>
                    {show.description && <p className="mt-2 line-clamp-2 text-[13px] leading-[1.5] text-[var(--wk-text-muted)]">{show.description}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
