import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { PublicTrustSummary } from "@/components/design-system/trust/PublicTrustSummary";
import { usePlayer } from "@/context/PlayerContext";
import { publicAudioPlayerItem } from "@/services/audio/audioPlayerAdapter";
import { getPublicAudioPublication } from "@/services/audio/audioPublicService";
import type {
  PublicAudioCitation,
  PublicAudioCredit,
  PublicAudioPublication,
} from "@/services/audio/audioPublicModel";
import { formatPlayerClock } from "@/services/player/playerExperience";

function humanize(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function creditHref(credit: PublicAudioCredit): string | null {
  if (credit.authorSlug) return `/people/${credit.authorSlug}`;
  return credit.username ? `/u/${credit.username}` : null;
}

function locatorScalar(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function citationLocatorLabel(citation: PublicAudioCitation): string | null {
  const timestamp =
    typeof citation.locator.seconds === "number"
      ? citation.locator.seconds
      : typeof citation.locator.timestamp_seconds === "number"
        ? citation.locator.timestamp_seconds
        : null;

  if (timestamp !== null && Number.isFinite(timestamp)) {
    return `At ${formatPlayerClock(timestamp)}`;
  }

  for (const key of ["chapter", "section", "page", "paragraph"]) {
    const value = locatorScalar(citation.locator[key]);
    if (value) return `${humanize(key)} ${value}`;
  }

  return citation.locatorType === "whole_source" || !citation.locatorType
    ? null
    : humanize(citation.locatorType);
}

function buildTrustPresentation(publication: PublicAudioPublication) {
  return {
    credits: publication.credits.map((credit) => ({
      id: credit.creditId,
      displayName: credit.displayName,
      roleLabel: credit.roleLabel ?? humanize(credit.role || "contributor"),
      note: credit.note,
      href: creditHref(credit),
      contextLabel: null,
    })),
    sources: publication.citations.map((citation) => ({
      id: citation.citationId,
      label: citation.publicLabel ?? citation.source.title,
      title: citation.source.title,
      creator: citation.source.creator,
      publisher: citation.source.publisher,
      url: citation.source.url,
      publicationDate: citation.source.publicationDate,
      creditLine: citation.source.creditLine,
      locatorLabel: citationLocatorLabel(citation),
      contextLabel: null,
    })),
  };
}

export default function PublicAudioDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [publication, setPublication] = useState<PublicAudioPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playTrack,
    togglePlay,
    seek,
    openFullPlayer,
  } = usePlayer();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    getPublicAudioPublication(slug)
      .then((next) => {
        if (alive) setPublication(next);
      })
      .catch(() => {
        if (alive) {
          setPublication(null);
          setError(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  const playerItem = useMemo(
    () => publication ? publicAudioPlayerItem(publication) : null,
    [publication],
  );

  const trust = useMemo(
    () => publication ? buildTrustPresentation(publication) : null,
    [publication],
  );

  if (loading) {
    return (
      <main className="wk-container-wide min-h-[60vh] px-5 py-10 md:px-6" aria-busy="true" aria-label="Loading Audio">
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-4 w-20 rounded bg-wk-surface-raised" />
          <div className="h-12 w-3/4 rounded bg-wk-surface-raised" />
          <div className="h-64 rounded-[28px] bg-wk-surface" />
        </div>
      </main>
    );
  }

  if (!publication || !playerItem) {
    return (
      <main className="wk-container-wide min-h-[60vh] px-5 py-16 md:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-wk-border bg-wk-surface px-6 py-12 text-center">
          <WkIcon name="AudioLines" size={30} className="mx-auto text-wk-text-faint" />
          <h1 className="mt-4 text-2xl font-black text-wk-text">Audio Unavailable</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-wk-text-muted">
            {error
              ? "We could not load this recording."
              : "This recording is not published or could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const active =
    currentTrack?.id === publication.publicationId;
  const activeDuration =
    active
      ? duration || publication.delivery.durationSeconds || 0
      : publication.delivery.durationSeconds || 0;
  const activeTime = active ? currentTime : 0;

  const startListening = () => {
    if (active) {
      togglePlay();
      return;
    }

    playTrack(
      playerItem,
      [playerItem],
      {
        pageType: "audio_detail",
        entityType:
          publication.publicationKind === "episode"
            ? "audio_episode"
            : "standalone_audio",
        entitySlug: publication.slug,
        sourceSection: "audio_detail_listen",
      },
    );
  };

  const playChapter = (startSeconds: number) => {
    if (!active) {
      playTrack(
        playerItem,
        [playerItem],
        {
          pageType: "audio_detail",
          entityType:
            publication.publicationKind === "episode"
              ? "audio_episode"
              : "standalone_audio",
          entitySlug: publication.slug,
          sourceSection: "audio_detail_chapter",
        },
      );

      window.requestAnimationFrame(() => {
        seek(startSeconds);
      });
      return;
    }

    seek(startSeconds);
  };

  return (
    <main>
      <section className="wk-container-wide px-5 pb-10 pt-10 md:px-6 md:pb-14 md:pt-14">
        <div className="mx-auto grid max-w-5xl gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <div className="wk-eyebrow mb-3">Audio</div>
            {publication.show || publication.season || publication.episodeNumber !== null ? (
              <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-wk-text-muted">
                {publication.show ? (
                  <Link
                    to={`/audio/shows/${publication.show.slug}`}
                    className="underline-offset-4 hover:text-wk-text hover:underline"
                  >
                    {publication.show.title}
                  </Link>
                ) : null}
                {publication.season ? (
                  <>
                    {publication.show ? <span className="text-wk-text-faint">·</span> : null}
                    <span>Season {publication.season.seasonNumber}</span>
                  </>
                ) : null}
                {publication.episodeNumber !== null ? (
                  <>
                    {publication.show || publication.season ? <span className="text-wk-text-faint">·</span> : null}
                    <span>Episode {publication.episodeNumber}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <h1 className="max-w-4xl text-4xl font-black tracking-[-0.035em] text-wk-text md:text-6xl">
              {publication.title}
            </h1>
            {publication.summary ? (
              <p className="mt-5 max-w-3xl text-base leading-7 text-wk-text-muted md:text-lg md:leading-8">
                {publication.summary}
              </p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startListening}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-wk-text px-5 py-3 text-sm font-black text-wk-bg"
              >
                <WkIcon
                  name={active && isPlaying ? "Pause" : "Play"}
                  size={17}
                  fill="currentColor"
                />
                {active && isPlaying ? "Pause" : active && activeTime > 0 ? "Continue" : "Listen"}
              </button>

              {active ? (
                <button
                  type="button"
                  onClick={openFullPlayer}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-wk-border bg-wk-surface px-5 py-3 text-sm font-black text-wk-text-muted hover:text-wk-text"
                >
                  Open Player
                  <i className="ri-expand-diagonal-line" />
                </button>
              ) : null}

              <span className="text-xs font-semibold tabular-nums text-wk-text-faint">
                {active
                  ? `${formatPlayerClock(activeTime)} / ${formatPlayerClock(activeDuration)}`
                  : formatPlayerClock(activeDuration)}
              </span>
            </div>
          </div>

          <div className="aspect-square overflow-hidden rounded-[28px] border border-wk-border bg-wk-surface-raised shadow-xl">
            <Ch19GradientImage
              slug={publication.slug}
              name={publication.title}
            />
          </div>
        </div>
      </section>

      {publication.chapters.length || publication.transcript?.url ? (
        <section className="wk-container-wide px-5 pb-10 md:px-6 md:pb-14">
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
            {publication.chapters.length ? (
              <div className="rounded-2xl border border-wk-border bg-wk-surface p-5 md:p-6">
                <h2 className="text-xl font-black text-wk-text">Chapters</h2>
                <p className="mt-1 text-sm text-wk-text-muted">
                  Jump into the recording without leaving the listening session.
                </p>
                <div className="mt-4 divide-y divide-wk-border">
                  {publication.chapters.map((chapter) => (
                    <button
                      key={chapter.chapterNumber}
                      type="button"
                      onClick={() => playChapter(chapter.startSeconds)}
                      className="group flex w-full items-center gap-4 py-3 text-left"
                    >
                      <span className="w-12 shrink-0 font-mono text-xs font-bold text-wk-brand">
                        {formatPlayerClock(chapter.startSeconds)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-bold text-wk-text group-hover:text-wk-brand">
                        {chapter.title}
                      </span>
                      <WkIcon
                        name="Play"
                        size={14}
                        className="text-wk-text-faint group-hover:text-wk-brand"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : <div />}

            {publication.transcript?.url ? (
              <div className="h-fit rounded-2xl border border-wk-border bg-wk-surface p-5">
                <WkIcon name="FileText" size={20} className="text-wk-brand" />
                <h2 className="mt-3 text-lg font-black text-wk-text">Transcript</h2>
                <p className="mt-2 text-sm leading-6 text-wk-text-muted">
                  Read alongside the recording or return to it later.
                </p>
                <a
                  href={publication.transcript.url}
                  target="_blank"
                  rel="noreferrer"
                  className="wk-button wk-button-ghost wk-button-sm mt-4 inline-flex"
                >
                  Open Transcript
                  <WkIcon name="ExternalLink" size={13} />
                </a>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {trust ? (
        <PublicTrustSummary
          provenance={{
            firstPublishedAt: publication.provenance.firstPublishedAt,
            publishedAt: publication.provenance.publishedAt,
            versionNumber: publication.provenance.versionNumber,
          }}
          credits={trust.credits}
          sources={trust.sources}
          corrections={[]}
        />
      ) : null}
    </main>
  );
}
