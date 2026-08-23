import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AudioHero,
  type AudioHeroMetaItem,
} from "@/components/design-system/audio/AudioHero";
import { WkIcon } from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { PublicTrustSummary } from "@/components/design-system/trust/PublicTrustSummary";
import { usePlayer } from "@/context/PlayerContext";
import { publicAudioPlayerItem } from "@/services/audio/audioPlayerAdapter";
import type {
  PublicAudioCitation,
  PublicAudioCredit,
  PublicAudioPublication,
} from "@/services/audio/audioPublicModel";
import { formatPlayerClock } from "@/services/player/playerExperience";
import { showPath } from "@/services/shows/showIdentity";

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

export function PublicAudioListeningSurface({
  publication,
}: {
  publication: PublicAudioPublication;
}) {
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

  const playerItem = useMemo(
    () => publicAudioPlayerItem(publication),
    [publication],
  );
  const trust = useMemo(
    () => buildTrustPresentation(publication),
    [publication],
  );

  const active = currentTrack?.id === publication.publicationId;
  const activeDuration = active
    ? duration || publication.delivery.durationSeconds || 0
    : publication.delivery.durationSeconds || 0;
  const activeTime = active ? currentTime : 0;
  const pageType = publication.publicationKind === "episode"
    ? "show_episode"
    : "audio_detail";
  const entityType = publication.publicationKind === "episode"
    ? "audio_episode"
    : "standalone_audio";

  const startListening = () => {
    if (active) {
      togglePlay();
      return;
    }

    playTrack(
      playerItem,
      [playerItem],
      {
        pageType,
        entityType,
        entitySlug: publication.slug,
        sourceSection: `${pageType}_listen`,
      },
    );
  };

  const playChapter = (startSeconds: number) => {
    if (!active) {
      playTrack(
        playerItem,
        [playerItem],
        {
          pageType,
          entityType,
          entitySlug: publication.slug,
          sourceSection: `${pageType}_chapter`,
        },
      );

      window.requestAnimationFrame(() => {
        seek(startSeconds);
      });
      return;
    }

    seek(startSeconds);
  };

  const meta: AudioHeroMetaItem[] = [];
  if (publication.show) {
    meta.push({ label: publication.show.title, icon: "Radio" });
  }
  if (publication.season) {
    meta.push({ label: `Season ${publication.season.seasonNumber}`, icon: "Layers3" });
  }
  if (publication.episodeNumber !== null) {
    meta.push({ label: `Episode ${publication.episodeNumber}`, icon: "ListOrdered" });
  }
  if (activeDuration > 0) {
    meta.push({ label: formatPlayerClock(activeDuration), icon: "Clock3" });
  }

  return (
    <main>
      <AudioHero
        eyebrow={publication.publicationKind === "episode" ? "WAKILISHA Audio · Episode" : "WAKILISHA Audio"}
        title={publication.title}
        description={publication.summary}
        meta={meta}
        visualLabel={`${publication.title} artwork`}
        visual={(
          <Ch19GradientImage
            slug={publication.slug}
            name={publication.title}
          />
        )}
        actions={(
          <>
            <button
              type="button"
              onClick={startListening}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--wk-text)] px-5 py-3 text-sm font-black text-[var(--wk-bg)] shadow-lg"
            >
              <WkIcon
                name={active && isPlaying ? "Pause" : "Play"}
                size={17}
                fill="currentColor"
              />
              {active && isPlaying
                ? "Pause"
                : active && activeTime > 0
                  ? "Continue"
                  : "Listen"}
            </button>

            {active ? (
              <button
                type="button"
                onClick={openFullPlayer}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 px-5 py-3 text-sm font-black text-[var(--wk-text-muted)] backdrop-blur-xl hover:text-[var(--wk-text)]"
              >
                Open Player
                <WkIcon name="Expand" size={14} />
              </button>
            ) : null}

            {publication.show ? (
              <Link
                to={showPath(publication.show.slug)}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-5 py-3 text-sm font-black text-[var(--wk-text-muted)] backdrop-blur-xl hover:text-[var(--wk-text)]"
              >
                View Show
                <WkIcon name="ArrowUpRight" size={14} />
              </Link>
            ) : null}
          </>
        )}
      />

      {publication.chapters.length || publication.transcript?.url ? (
        <section className="wk-container-wide px-5 py-10 md:px-6 md:py-14">
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
    </main>
  );
}
