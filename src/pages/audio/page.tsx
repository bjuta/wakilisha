import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  usePlayer,
} from "@/context/PlayerContext";
import {
  getPublicAudioIndex,
  type PublicAudioIndex,
} from "@/services/audio/audioPublicService";
import {
  publicAudioPlayerItem,
} from "@/services/audio/audioPlayerAdapter";
import type {
  PublicAudioPublication,
} from "@/services/audio/audioPublicModel";

function publicationCredit(publication: PublicAudioPublication): string {
  return publication.credits.find((credit) => credit.isPrimary)?.displayName
    || publication.credits[0]?.displayName
    || publication.show?.title
    || "WAKILISHA";
}

function AudioCard({ publication }: { publication: PublicAudioPublication }) {
  const { playTrack } = usePlayer();
  const credit = publicationCredit(publication);
  return (
    <article data-wk-workbook-audio-card className="group min-w-0">
      <div className="wk-reference-audio-art">
        <button
          type="button"
          aria-label={`Play ${publication.title}`}
          onClick={() => {
            const track = publicAudioPlayerItem(publication);
            playTrack(track, [track], {
              pageType: "audio",
              entityType: "standalone_audio",
              entitySlug: publication.slug,
              sourceSection: "audio_index",
            });
          }}
        >
          <WkIcon name="Play" size={20} fill="currentColor" />
        </button>
      </div>
      <Link to={publication.canonicalPath} className="block pt-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-[1.3] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
          {publication.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-[13px] text-[var(--wk-text-muted)]">
          {credit}{publication.delivery.durationSeconds ? ` · ${Math.round(publication.delivery.durationSeconds / 60)} min` : ""}
        </p>
      </Link>
    </article>
  );
}

export default function PublicAudioPage() {
  const { playTrack, openFullPlayer } = usePlayer();
  const [index, setIndex] = useState<PublicAudioIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPublicAudioIndex(24)
      .then((value) => {
        if (!cancelled) setIndex(value);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Audio could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const standalone = index?.standalone ?? [];
  const shows = index?.shows ?? [];
  const featured = standalone[0] ?? null;
  const mixes = standalone.slice(1);

  return (
    <main data-wk-workbook-screen="audio" className="min-h-screen pb-24">
      <div className="mx-auto w-full max-w-[1320px] px-5 pt-9 sm:px-9 max-md:flex max-md:flex-col max-md:px-0 max-md:pt-0">
        <div className={`max-md:order-2 flex flex-wrap items-end justify-between gap-5 max-md:px-5 ${featured ? "max-md:pt-6" : "max-md:pt-[calc(70px+env(safe-area-inset-top))]"}`}>
          <h1 className="text-[clamp(48px,6vw,76px)] font-extrabold uppercase leading-[.95] tracking-[-.055em] text-[var(--wk-text)]">Audio</h1>
          <nav aria-label="Audio discovery" className="wk-reference-pills">
            <a href="#audio-listen" className="wk-reference-pill" aria-current="page">All</a>
            {shows.length > 0 && <a href="#audio-shows" className="wk-reference-pill">Podcasts</a>}
            {standalone.length > 1 && <a href="#audio-mixes" className="wk-reference-pill">Mixes</a>}
            <Link to="/shows" className="wk-reference-pill">Shows</Link>
          </nav>
        </div>
        {loading && (
          <div className="max-md:order-1 mt-8 grid gap-5 lg:grid-cols-[1.2fr_.85fr] max-md:mt-0" aria-busy="true">
            <div className="h-[370px] animate-pulse rounded-[20px] bg-[var(--wk-surface-raised)]" />
            <div className="h-[370px] animate-pulse rounded-[20px] bg-[var(--wk-surface-raised)]" />
          </div>
        )}
        {!loading && message && <p className="max-md:order-3 py-12 text-[14px] text-[var(--wk-text-muted)] max-md:px-5" role="alert">Audio is temporarily unavailable.</p>}
        {!loading && !message && featured && (
          <section id="audio-listen" className="max-md:order-1 mt-7 grid gap-5 lg:grid-cols-[1.23fr_.88fr] max-md:mt-0" data-wk-mobile-top-hero="audio">
            <div className="relative flex min-h-[365px] flex-col justify-end overflow-hidden rounded-[20px] bg-[linear-gradient(145deg,#ab655a,#5b2917_56%,#17110f)] p-7 sm:p-9 max-md:rounded-none">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white">
                {featured.publicationKind === "episode" ? "Episode" : "Listen"}
              </span>
              <h2 className="mt-4 max-w-[17ch] text-[clamp(30px,4vw,51px)] font-extrabold uppercase leading-[.94] tracking-[-.045em] text-white">
                {featured.title}
              </h2>
              <p className="mt-3 text-[14px] text-white/75">{publicationCredit(featured)}</p>
              {featured.summary && <p className="mt-2 max-w-[56ch] line-clamp-2 text-[14px] leading-[1.55] text-white/75">{featured.summary}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-[#0b0b0b]"
                  onClick={() => {
                    const track = publicAudioPlayerItem(featured);
                    playTrack(track, [track], {
                      pageType: "audio",
                      entityType: "standalone_audio",
                      entitySlug: featured.slug,
                      sourceSection: "audio_hero",
                    });
                    openFullPlayer();
                  }}
                >
                  <WkIcon name="Play" size={16} fill="currentColor" /> Listen
                </button>
                <Link to={featured.canonicalPath} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-white">Recording details ↗</Link>
              </div>
            </div>
            {shows.length > 0 && (
              <div id="audio-shows" className="max-md:px-5">
                <h2 className="wk-reference-section-heading mb-3">Shows</h2>
                <div className="grid gap-3">
                  {shows.slice(0,4).map(({ show }) => (
                    <Link key={show.resourceId} to={show.canonicalPath} className="wk-reference-audio-station group">
                      <span aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">{show.title}</span>
                        <span className="mt-1 block truncate text-[12px] text-[var(--wk-text-muted)]">{show.episodeCount} episodes</span>
                      </span>
                      <WkIcon name="ArrowUpRight" size={17} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        {!loading && !message && mixes.length > 0 && (
          <section id="audio-mixes" className="max-md:order-3 mt-9 max-md:px-5">
            <h2 className="wk-reference-section-heading mb-4">Listen next</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3 xl:grid-cols-5">
              {mixes.map((publication) => <AudioCard key={publication.publicationId} publication={publication} />)}
            </div>
          </section>
        )}
        {!loading && !message && shows.length > 4 && (
          <section className="max-md:order-3 mt-10 max-md:px-5">
            <h2 className="wk-reference-section-heading mb-4">More shows</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shows.slice(4).map(({show}) => (
                <Link key={show.resourceId} to={show.canonicalPath} className="wk-reference-audio-station">
                  <span aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{show.title}</span>
                    <span className="text-[12px] text-[var(--wk-text-muted)]">{show.episodeCount} episodes</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {!loading && !message && !standalone.length && !shows.length && (
          <p className="max-md:order-3 py-12 text-[14px] text-[var(--wk-text-muted)] max-md:px-5">No public audio has been released yet.</p>
        )}
      </div>
    </main>
  );
}
