import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  AudioHero,
} from "@/components/design-system/audio/AudioHero";
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
    <article className="group overflow-hidden rounded-[26px] border border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="aspect-[16/10] bg-[radial-gradient(circle_at_25%_20%,color-mix(in_srgb,var(--wk-brand)_30%,transparent),transparent_38%),linear-gradient(145deg,var(--wk-surface-raised),var(--wk-bg))] p-5">
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
      <Link to={publication.canonicalPath} className="block p-5">
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
    <div className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <AudioHero
        eyebrow="WAKILISHA Audio"
        title="Listen Deeper"
        description="Stories, conversations, and sound-led work from WAKILISHA."
        meta={[
          { label: "Original Audio", icon: "Mic2" },
          { label: "Shows & Episodes", icon: "ListMusic" },
        ]}
        visualLabel="WAKILISHA Audio"
      />

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
              This environment does not have the public Audio directory authority yet. Individual published Audio remains available from its canonical link.
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
                  className="group rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                    <WkIcon name="Radio" size={21} />
                  </div>
                  <h3 className="mt-7 text-[24px] font-black tracking-[-0.03em] group-hover:text-[var(--wk-brand)]">
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
