import {
  useMemo,
  useRef,
} from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { PublicTrustSummary } from "@/components/design-system/trust/PublicTrustSummary";
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
    month: "long",
    day: "numeric",
  }).format(date);
}

function creditHref(credit: PublicVideoCredit): string | null {
  if (credit.authorSlug) return `/people/${credit.authorSlug}`;
  return credit.username ? `/u/${credit.username}` : null;
}

function locatorScalar(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function citationLocatorLabel(citation: PublicVideoCitation): string | null {
  const timestamp =
    typeof citation.locator.seconds === "number"
      ? citation.locator.seconds
      : typeof citation.locator.timestamp_seconds === "number"
        ? citation.locator.timestamp_seconds
        : null;

  if (timestamp !== null && Number.isFinite(timestamp)) {
    return `At ${formatDuration(timestamp)}`;
  }

  for (const key of ["chapter", "section", "page", "paragraph"]) {
    const value = locatorScalar(citation.locator[key]);
    if (value) return `${humanize(key)} ${value}`;
  }

  return citation.locatorType === "whole_source" || !citation.locatorType
    ? null
    : humanize(citation.locatorType);
}

function buildTrustPresentation(publication: PublicVideoPublication) {
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

function providerEmbedUrl(
  publication: PublicVideoPublication,
): string | null {
  if (publication.delivery.kind !== "provider") return null;

  const id = publication.delivery.providerObjectId;
  if (publication.delivery.providerKey === "youtube" && id) {
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }
  if (publication.delivery.providerKey === "vimeo" && id) {
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
  }
  return null;
}

function trackKind(
  kind: string,
): "captions" | "subtitles" {
  return kind === "captions" ? "captions" : "subtitles";
}

export function PublicVideoWatchingSurface({
  publication,
}: {
  publication: PublicVideoPublication;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trust = useMemo(
    () => buildTrustPresentation(publication),
    [publication],
  );
  const providerUrl = providerEmbedUrl(publication);
  const publishedDate = formatDate(publication.provenance.publishedAt);
  const duration = publication.delivery.kind === "native_media"
    ? formatDuration(publication.delivery.durationSeconds)
    : "";

  const jumpToChapter = (startSeconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = startSeconds;
    void videoRef.current.play();
  };

  return (
    <main className="min-h-screen bg-wk-bg text-wk-text">
      <section className="wk-container-wide px-4 pb-8 pt-7 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-wk-text-faint">
            <Link
              to="/video"
              className="transition hover:text-wk-brand"
            >
              WAKILISHA Video
            </Link>
            {publication.show ? (
              <>
                <span aria-hidden="true">/</span>
                <Link
                  to={publication.show.canonicalPath}
                  className="transition hover:text-wk-brand"
                >
                  {publication.show.title}
                </Link>
              </>
            ) : null}
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-wk-brand">
                {humanize(publication.classification)}
                {publication.episode?.episodeNumber
                  ? ` · Episode ${publication.episode.episodeNumber}`
                  : ""}
              </p>
              <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                {publication.title}
              </h1>
            </div>

            <div className="lg:pb-1">
              {publication.summary ? (
                <p className="text-[15px] leading-7 text-wk-text-muted">
                  {publication.summary}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-wk-text-faint">
                {publishedDate ? <span>{publishedDate}</span> : null}
                {duration ? <span>{duration}</span> : null}
                {publication.captions.length ? (
                  <span>
                    {publication.captions.length}
                    {" "}
                    {publication.captions.length === 1
                      ? "caption track"
                      : "caption tracks"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[28px] border border-wk-border bg-black shadow-sm">
            {publication.delivery.kind === "native_media" ? (
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={publication.poster?.url || undefined}
                className="mx-auto block max-h-[78vh] min-h-[240px] w-full bg-black object-contain"
              >
                <source
                  src={publication.delivery.url}
                  type={publication.delivery.mimeType}
                />
                {publication.captions.map((caption) => (
                  <track
                    key={caption.trackNumber}
                    kind={trackKind(caption.trackKind)}
                    src={publicVideoCaptionUrl(
                      publication,
                      caption.trackNumber,
                    )}
                    srcLang={caption.languageTag}
                    label={caption.label}
                    default={caption.isDefault}
                  />
                ))}
                Your browser does not support HTML video.
              </video>
            ) : providerUrl ? (
              <div className="aspect-video w-full">
                <iframe
                  src={providerUrl}
                  title={publication.title}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center p-8 text-center text-sm text-white/70">
                This Video provider does not have an embeddable public player.
              </div>
            )}
          </div>
        </div>
      </section>

      {publication.chapters.length ? (
        <section className="wk-container-wide px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-wk-brand">
                Chapters
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">
                Move through the film
              </h2>
            </div>

            <div className="mt-6 divide-y divide-wk-border border-y border-wk-border">
              {publication.chapters.map((chapter) => (
                <button
                  key={chapter.chapterNumber}
                  type="button"
                  onClick={() => jumpToChapter(chapter.startSeconds)}
                  disabled={publication.delivery.kind !== "native_media"}
                  className="group flex w-full items-start gap-4 py-4 text-left disabled:cursor-default"
                >
                  <span className="w-14 shrink-0 pt-0.5 font-mono text-xs font-bold text-wk-brand">
                    {formatDuration(chapter.startSeconds)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black group-hover:text-wk-brand">
                      {chapter.title}
                    </span>
                    {chapter.description ? (
                      <span className="mt-1 block text-sm leading-6 text-wk-text-muted">
                        {chapter.description}
                      </span>
                    ) : null}
                  </span>
                  {publication.delivery.kind === "native_media" ? (
                    <WkIcon
                      name="Play"
                      size={15}
                      className="mt-0.5 text-wk-text-faint group-hover:text-wk-brand"
                    />
                  ) : null}
                </button>
              ))}
            </div>
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
