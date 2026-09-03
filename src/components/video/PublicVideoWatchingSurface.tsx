import {
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { MediaPresentationSurface } from "@/components/design-system/media/MediaPresentationSurface";
import { PublicVideoCard } from "./PublicVideoCard";
import {
  VideoPlaybackCanvas,
  type VideoPlaybackSource,
} from "./VideoPlaybackCanvas";
import {
  publicVideoCaptionUrl,
} from "@/services/video/videoPublicService";
import type {
  PublicVideoCitation,
  PublicVideoCredit,
  PublicVideoPublication,
} from "@/services/video/videoPublicModel";

function humanize(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function creditHref(credit: PublicVideoCredit): string | null {
  if (credit.authorSlug) return `/people/${credit.authorSlug}`;
  return credit.username ? `/u/${credit.username}` : null;
}

function locatorLabel(citation: PublicVideoCitation): string | null {
  const seconds =
    typeof citation.locator.seconds === "number"
      ? citation.locator.seconds
      : typeof citation.locator.timestamp_seconds === "number"
        ? citation.locator.timestamp_seconds
        : null;

  if (seconds !== null && Number.isFinite(seconds)) {
    return `At ${formatDuration(seconds)}`;
  }

  for (const key of ["chapter", "section", "page", "paragraph"]) {
    const raw = citation.locator[key];
    if (typeof raw === "string" && raw.trim()) {
      return `${humanize(key)} ${raw.trim()}`;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return `${humanize(key)} ${raw}`;
    }
  }

  return null;
}

function PublicationRecord({
  publication,
}: {
  publication: PublicVideoPublication;
}) {
  const published = formatDate(publication.provenance.firstPublishedAt);
  const current = formatDate(publication.provenance.publishedAt);

  return (
    <details className="group rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <span>
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            Record
          </span>
          <span className="mt-1 block text-[14px] font-black text-[var(--wk-text)]">
            Publication record
          </span>
        </span>
        <i className="ri-arrow-down-s-line text-lg text-[var(--wk-text-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-[var(--wk-border)] px-4 pb-5 pt-4 sm:px-5">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[var(--wk-text-muted)]">
          {published ? (
            <span>
              Published <strong className="text-[var(--wk-text)]">{published}</strong>
            </span>
          ) : null}
          {current ? (
            <span>
              Current edition <strong className="text-[var(--wk-text)]">{current}</strong>
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--wk-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--wk-text-soft)]">
            Version {publication.versionNumber}
          </span>
        </div>

        {publication.credits.length ? (
          <div className="mt-5 border-t border-[var(--wk-border)] pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
              Credits
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {publication.credits.map((credit) => {
                const href = creditHref(credit);
                const label = credit.roleLabel || humanize(credit.role || "Contributor");
                const body = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                    <strong className="text-[var(--wk-text)]">{credit.displayName}</strong>
                    <span>{label}</span>
                  </span>
                );
                return href ? (
                  <Link key={credit.creditId} to={href}>
                    {body}
                  </Link>
                ) : (
                  <span key={credit.creditId}>{body}</span>
                );
              })}
            </div>
          </div>
        ) : null}

        {publication.citations.length ? (
          <div className="mt-5 border-t border-[var(--wk-border)] pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
              Sources
            </p>
            <div className="mt-2 space-y-2">
              {publication.citations.map((citation) => {
                const label = citation.publicLabel || citation.source.title;
                const locator = locatorLabel(citation);
                return citation.source.url ? (
                  <a
                    key={citation.citationId}
                    href={citation.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--wk-border)] px-3 py-2 text-[12px] font-semibold text-[var(--wk-text)] transition hover:border-[var(--wk-brand)]"
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <span className="shrink-0 text-[10px] text-[var(--wk-text-faint)]">
                      {locator || "Source"}
                    </span>
                  </a>
                ) : (
                  <div
                    key={citation.citationId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--wk-border)] px-3 py-2 text-[12px] font-semibold text-[var(--wk-text)]"
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <span className="shrink-0 text-[10px] text-[var(--wk-text-faint)]">
                      {locator || "Source"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function PublicVideoWatchingSurface({
  publication,
  related = [],
}: {
  publication: PublicVideoPublication;
  related?: PublicVideoPublication[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerAnchorRef = useRef<HTMLDivElement>(null);
  const [playerDocked, setPlayerDocked] = useState(false);
  const [anchorHeight, setAnchorHeight] = useState<number | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const publishedDate = formatDate(publication.provenance.publishedAt);
  const duration = publication.delivery.kind === "native_media"
    ? formatDuration(publication.delivery.durationSeconds)
    : "";

  const source = useMemo<VideoPlaybackSource | null>(() => {
    if (publication.delivery.kind === "native_media") {
      return {
        kind: "native",
        url: publication.delivery.url,
        mimeType: publication.delivery.mimeType,
        adaptiveUrl: publication.adaptiveDelivery?.url || null,
        adaptiveMimeType:
          publication.adaptiveDelivery?.mimeType || null,
        adaptiveRenditions:
          publication.adaptiveDelivery?.renditions.map((rendition) => ({
            height: rendition.height,
            label: rendition.label,
            url: rendition.url,
            mimeType: rendition.mimeType,
          })) || [],
        poster: publication.poster?.url || null,
        captions: publication.captions.map((caption) => ({
          trackNumber: caption.trackNumber,
          languageTag: caption.languageTag,
          label: caption.label,
          kind: caption.trackKind,
          src: publicVideoCaptionUrl(publication, caption.trackNumber),
          isDefault: caption.isDefault,
        })),
      };
    }

    if (!publication.delivery.providerObjectId) return null;

    return {
      kind: "provider",
      providerKey: publication.delivery.providerKey,
      providerObjectId: publication.delivery.providerObjectId,
      canonicalUrl: publication.delivery.canonicalUrl,
    };
  }, [publication]);

  const collapsePlayer = () => {
    const anchor = playerAnchorRef.current;
    if (anchor) {
      setAnchorHeight(anchor.getBoundingClientRect().height);
    }
    setPlayerDocked(true);
  };

  const expandPlayer = () => {
    setPlayerDocked(false);
    requestAnimationFrame(() => {
      playerAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const closeDockedPlayer = () => {
    videoRef.current?.pause();
    setPlayerDocked(false);
  };

  const jumpToChapter = (startSeconds: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = startSeconds;
    void element.play();
    if (playerDocked) expandPlayer();
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <section className="mx-auto max-w-[1180px] px-0 pb-12 sm:px-6 lg:pb-16">
        <div
          ref={playerAnchorRef}
          className="relative scroll-mt-16"
          style={playerDocked && anchorHeight ? { minHeight: anchorHeight } : undefined}
        >
          {source ? (
            <MediaPresentationSurface
              mode={playerDocked ? "floating" : "inline"}
              draggable={playerDocked}
              className={
                playerDocked
                  ? "fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[250] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-[360px]"
                  : "relative overflow-hidden bg-black sm:mt-6 sm:rounded-[24px] sm:border sm:border-[var(--wk-border)] sm:shadow-sm"
              }
            >
              {({ dragHandleProps, dragging }) => (
                <>
                  {playerDocked ? (
                    <button
                      type="button"
                      {...dragHandleProps}
                      className="absolute left-1/2 top-1 z-40 flex h-5 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-black/50 text-white/75 backdrop-blur-sm"
                      style={dragHandleProps.style}
                      aria-label="Move floating video"
                      title={dragging ? "Moving video" : "Move floating video"}
                    >
                      <i className="ri-draggable text-[12px]" />
                    </button>
                  ) : null}
                  <VideoPlaybackCanvas
                    source={source}
                    title={publication.title}
                    videoRef={videoRef}
                    compact={playerDocked}
                    collapsed={playerDocked}
                    onCollapse={playerDocked ? undefined : collapsePlayer}
                    onExpand={playerDocked ? expandPlayer : undefined}
                    onClose={playerDocked ? closeDockedPlayer : undefined}
                  />
                </>
              )}
            </MediaPresentationSurface>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center bg-black p-8 text-center text-sm text-white/70 sm:mt-6 sm:rounded-[24px]">
              This Video provider does not have an embeddable public player.
            </div>
          )}
        </div>

        <div className="px-5 pt-6 sm:px-0 sm:pt-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                {humanize(publication.classification)}
                {publication.episode?.episodeNumber
                  ? ` · Episode ${publication.episode.episodeNumber}`
                  : ""}
              </p>

              <h1 className="mt-2 max-w-4xl text-[34px] font-black leading-[0.98] tracking-[-0.045em] sm:text-[46px] lg:text-[54px]">
                {publication.title}
              </h1>

              {publication.show ? (
                <div className="mt-4">
                  {publication.show.canonicalPath ? (
                    <Link
                      to={publication.show.canonicalPath}
                      className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--wk-text)] transition hover:text-[var(--wk-brand)]"
                    >
                      {publication.show.title}
                      <i className="ri-arrow-right-s-line text-base" />
                    </Link>
                  ) : (
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">
                      {publication.show.title}
                    </span>
                  )}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                {publishedDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-calendar-line" />
                    {publishedDate}
                  </span>
                ) : null}
                {duration ? (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-time-line" />
                    {duration}
                  </span>
                ) : null}
              </div>

              {publication.summary ? (
                <div className="mt-6 max-w-2xl">
                  <p
                    className={
                      descriptionExpanded
                        ? "text-[15px] leading-7 text-[var(--wk-text-muted)]"
                        : "line-clamp-3 text-[15px] leading-7 text-[var(--wk-text-muted)]"
                    }
                  >
                    {publication.summary}
                  </p>
                  {publication.summary.length > 180 ? (
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--wk-brand)]"
                    >
                      {descriptionExpanded ? "Show less" : "Show more"}
                      <i className={descriptionExpanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="lg:pt-1">
              <PublicationRecord publication={publication} />
            </div>
          </div>

          {publication.chapters.length ? (
            <section className="mt-10 border-t border-[var(--wk-border)] pt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                    Chapters
                  </p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[-0.025em]">
                    Move through the film
                  </h2>
                </div>
              </div>

              <div className="mt-4 divide-y divide-[var(--wk-border)] border-y border-[var(--wk-border)]">
                {publication.chapters.map((chapter) => (
                  <button
                    key={chapter.chapterNumber}
                    type="button"
                    onClick={() => jumpToChapter(chapter.startSeconds)}
                    disabled={publication.delivery.kind !== "native_media"}
                    className="group flex w-full items-start gap-4 py-4 text-left disabled:cursor-default"
                  >
                    <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] font-black text-[var(--wk-brand)]">
                      {formatDuration(chapter.startSeconds)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
                        {chapter.title}
                      </span>
                      {chapter.description ? (
                        <span className="mt-1 block text-[12px] leading-5 text-[var(--wk-text-muted)]">
                          {chapter.description}
                        </span>
                      ) : null}
                    </span>
                    {publication.delivery.kind === "native_media" ? (
                      <i className="ri-play-fill mt-0.5 text-sm text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)]" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {related.length ? (
            <section className="mt-10 border-t border-[var(--wk-border)] pt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                    Keep watching
                  </p>
                  <h2 className="mt-1 text-[22px] font-black tracking-[-0.025em]">
                    More from {publication.show?.title || "WAKILISHA Video"}
                  </h2>
                </div>
                <Link
                  to="/video"
                  className="shrink-0 text-[11px] font-black text-[var(--wk-brand)]"
                >
                  View all
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {related.slice(0, 6).map((item) => (
                  <PublicVideoCard
                    key={item.versionId}
                    publication={item}
                    compact
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
