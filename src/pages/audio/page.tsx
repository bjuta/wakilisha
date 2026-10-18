import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import { WkEditorialIntro } from "@/components/design-system/layout/WorkbookEditorial";
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

function AudioCard({
  publication,
}: {
  publication: PublicAudioPublication;
}) {
  const { playTrack, openFullPlayer } = usePlayer();
  const credit = publicationCredit(publication);

  return (
    <article data-wk-workbook-audio-card className="group overflow-hidden bg-[var(--wk-bg)]">
      <div className="aspect-square max-h-[340px] bg-[var(--wk-surface-raised)] p-5">
        <div className="flex h-full items-end justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] shadow-lg">
            <WkIcon name="AudioLines" size={21} />
          </div>
          <button
            type="button"
            onClick={() => {
              const item = publicAudioPlayerItem(publication);
              playTrack(item, [item], {
                pageType: "audio",
                entityType: "standalone_audio",
                entitySlug: publication.slug,
                sourceSection: "audio_index",
              });
              openFullPlayer();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] shadow-xl"
            aria-label={`Play ${publication.title}`}
          >
            <WkIcon name="Play" size={20} fill="currentColor" />
          </button>
        </div>
      </div>
      <Link to={publication.canonicalPath} className="block py-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
          {publication.publicationKind === "episode" ? "Episode" : "Audio"}
        </div>
        <h2 className="mt-2 text-[21px] font-black tracking-[-0.025em] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
          {publication.title}
        </h2>
        <div className="mt-1.5 text-[12px] font-bold text-[var(--wk-text-muted)]">
          {credit}
        </div>
        {publication.summary ? (
          <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[var(--wk-text-soft)]">
            {publication.summary}
          </p>
        ) : null}
      </Link>
    </article>
  );
}

export default function PublicAudioPage() {
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

  return (
    <div data-wk-workbook-screen="audio" className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <div className="wk-container-max px-6 md:px-10">
        <WkEditorialIntro eyebrow="Listen" title="Audio" description="Listen to published audio and shows. Each recording stays connected to its source and credits." />
      </div>
      <div className="wk-container-max px-6 py-12 md:px-10 md:py-16">
        {loading ? (
          <div className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-[14px] font-bold text-[var(--wk-text-muted)]" aria-busy="true">
            Loading Audio…
          </div>
        ) : null}

        {!loading && message ? (
          <div className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <h2 className="text-[24px] font-black tracking-[-0.03em]">Audio</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-[var(--wk-text-muted)]">
              Audio is temporarily unavailable. Please try again.
            </p>
          </div>
        ) : null}

        {!loading && !message && standalone.length ? (
          <section>
            <div className="flex items-end justify-between gap-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">Listen</div>
                <h2 className="mt-1 text-[32px] font-black tracking-[-0.04em]">Latest Audio</h2>
              </div>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {standalone.map((publication) => (
                <AudioCard key={publication.publicationId} publication={publication} />
              ))}
            </div>
          </section>
        ) : null}

        {!loading && !message && shows.length ? (
          <section className={standalone.length ? "mt-16" : ""}>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">Series</div>
              <h2 className="mt-1 text-[32px] font-black tracking-[-0.04em]">Shows</h2>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {shows.map((show) => (
                <Link
                  key={show.show.resourceId}
                  to={show.show.canonicalPath}
                  className="group flex flex-col items-start border-t border-[var(--wk-border)] bg-[var(--wk-bg)] py-5 transition-colors hover:text-[var(--wk-brand)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                    <WkIcon name="Radio" size={21} />
                  </div>
                  <h3 className="mt-4 text-[24px] font-black tracking-[-0.03em] group-hover:text-[var(--wk-brand)]">
                    {show.show.title}
                  </h3>
                  <div className="mt-1 text-[12px] font-bold text-[var(--wk-text-muted)]">
                    {show.show.episodeCount} {show.show.episodeCount === 1 ? "episode" : "episodes"}
                  </div>
                  {show.show.description ? (
                    <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-[var(--wk-text-soft)]">
                      {show.show.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && !message && !standalone.length && !shows.length ? (
          <div className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-[14px] text-[var(--wk-text-muted)]">
            No published Audio is available yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
