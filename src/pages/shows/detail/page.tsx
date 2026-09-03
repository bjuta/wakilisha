import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ExternalLink,
  Pause,
  Play,
  Rss,
} from "lucide-react";
import { MetaTags } from "@/components/seo/MetaTags";
import { usePlayer } from "@/context/PlayerContext";
import { publicAudioPlayerItem } from "@/services/audio/audioPlayerAdapter";
import type {
  PublicShowDetail,
  PublicShowEpisode,
} from "@/services/shows/showPublicModel";
import { getPublicShow } from "@/services/shows/showPublicService";

const SITE_URL = "https://wakilisha.africa";

function episodeContext(item: PublicShowEpisode): string {
  const labels: string[] = [];
  if (item.episode.episodeNumber !== null) {
    labels.push(`Episode ${item.episode.episodeNumber}`);
  } else {
    labels.push("Episode");
  }
  if (item.video) labels.push("Watch");
  if (item.audio) labels.push("Listen");
  return labels.join(" · ");
}

export default function PublicShowPage() {
  const { showSlug = "" } = useParams<{ showSlug: string }>();
  const [detail, setDetail] = useState<PublicShowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    currentTrack,
    isPlaying,
    playTrack,
    pause,
  } = usePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getPublicShow(showSlug)
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Show could not load.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showSlug]);

  useEffect(() => {
    if (!detail?.show.feedPath) return;

    const href = `${SITE_URL}${detail.show.feedPath}`;
    const existing = document.querySelector<HTMLLinkElement>(
      'link[data-wakilisha-show-rss="true"]',
    );
    const link = existing ?? document.createElement("link");

    link.rel = "alternate";
    link.type = "application/rss+xml";
    link.title = `${detail.show.title} RSS`;
    link.href = href;
    link.dataset.wakilishaShowRss = "true";

    if (!existing) document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, [detail]);

  const audioQueue = useMemo(
    () =>
      detail?.episodes
        .filter((item) => item.audio)
        .map((item) => publicAudioPlayerItem(item.audio!)) ?? [],
    [detail],
  );

  const listenToEpisode = (item: PublicShowEpisode) => {
    if (!item.audio) return;

    const playerItem = publicAudioPlayerItem(item.audio);
    if (currentTrack?.id === playerItem.id && isPlaying) {
      pause();
      return;
    }

    playTrack(playerItem, audioQueue, {
      pageType: "show_detail",
      entityType: "audio_episode",
      entitySlug: item.episode.slug,
      sourceSection: "episode_list",
    });
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-wk-text-muted">Loading Show.</p>
      </main>
    );
  }

  if (!detail || error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wk-text-faint">
          Show
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-wk-text">
          Show unavailable
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-wk-text-muted">
          {error || "This Show has no currently published Episodes."}
        </p>
      </main>
    );
  }

  const { show, episodes } = detail;
  const canonicalUrl = `${SITE_URL}${show.canonicalPath}`;
  const firstVideo = episodes.find((item) => item.video);
  const firstAudio = episodes.find((item) => item.audio);

  return (
    <>
      <MetaTags
        title={show.title}
        description={show.description || `Watch and listen to ${show.title} on WAKILISHA.`}
        url={canonicalUrl}
      />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <section className="grid gap-7 border-b border-wk-border pb-9 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
          <div
            aria-hidden="true"
            className="aspect-square w-full max-w-[220px] rounded-[28px] border border-wk-border shadow-sm"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, rgba(255,255,255,.75), transparent 30%), linear-gradient(145deg, #f8d57e 0%, #ee8d68 42%, #714f7d 100%)",
            }}
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wk-text-faint">
              Show
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-wk-text sm:text-5xl">
              {show.title}
            </h1>

            {show.description ? (
              <p className="mt-4 max-w-2xl text-base leading-7 text-wk-text-muted">
                {show.description}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {firstVideo ? (
                <Link
                  to={firstVideo.episode.canonicalPath}
                  className="inline-flex items-center gap-2 rounded-full bg-wk-text px-5 py-3 text-sm font-semibold text-wk-bg transition hover:opacity-90"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Watch latest
                </Link>
              ) : null}

              {firstAudio ? (
                <button
                  type="button"
                  onClick={() => listenToEpisode(firstAudio)}
                  className="inline-flex items-center gap-2 rounded-full border border-wk-border bg-wk-surface px-5 py-3 text-sm font-semibold text-wk-text transition hover:bg-wk-surface-raised"
                >
                  {currentTrack?.id === firstAudio.audio?.publicationId && isPlaying ? (
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  )}
                  Listen to latest
                </button>
              ) : null}

              {show.feedPath ? (
                <a
                  href={`${SITE_URL}${show.feedPath}`}
                  className="inline-flex items-center gap-2 rounded-full border border-wk-border bg-wk-surface px-4 py-3 text-sm font-semibold text-wk-text transition hover:bg-wk-surface-raised"
                >
                  <Rss className="h-4 w-4" aria-hidden="true" />
                  RSS Feed
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>

            <p className="mt-5 text-sm text-wk-text-faint">
              {show.episodeCount} {show.episodeCount === 1 ? "Episode" : "Episodes"}
              {show.videoEpisodeCount ? ` · ${show.videoEpisodeCount} Watch` : ""}
              {show.audioEpisodeCount ? ` · ${show.audioEpisodeCount} Listen` : ""}
            </p>
          </div>
        </section>

        <section className="pt-9" aria-labelledby="episodes-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wk-text-faint">
            Published
          </p>
          <h2
            id="episodes-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-wk-text"
          >
            Episodes
          </h2>

          <ol className="mt-5 divide-y divide-wk-border border-y border-wk-border">
            {episodes.map((item) => {
              const audioActive =
                item.audio
                && currentTrack?.id === item.audio.publicationId
                && isPlaying;

              return (
                <li
                  key={item.episode.resourceId}
                  className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-wk-text-faint">
                      {episodeContext(item)}
                    </p>
                    <Link
                      to={item.episode.canonicalPath}
                      className="mt-1 block text-lg font-semibold text-wk-text underline-offset-4 hover:text-wk-brand hover:underline"
                    >
                      {item.episode.title}
                    </Link>
                    {item.episode.summary ? (
                      <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-wk-text-muted">
                        {item.episode.summary}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.video ? (
                      <Link
                        to={item.episode.canonicalPath}
                        className="inline-flex items-center gap-2 rounded-full bg-wk-text px-4 py-2 text-xs font-semibold text-wk-bg"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Watch
                      </Link>
                    ) : null}
                    {item.audio ? (
                      <button
                        type="button"
                        onClick={() => listenToEpisode(item)}
                        className="inline-flex items-center gap-2 rounded-full border border-wk-border px-4 py-2 text-xs font-semibold text-wk-text"
                      >
                        {audioActive ? (
                          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        )}
                        {audioActive ? "Pause" : "Listen"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </>
  );
}
