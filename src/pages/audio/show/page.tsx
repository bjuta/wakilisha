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
import {
  type PublicAudioShowDetail,
} from "@/services/audio/audioShowPublicModel";
import { getPublicAudioShow } from "@/services/audio/audioShowPublicService";

const SITE_URL = "https://wakilisha.africa";

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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export default function PublicAudioShowPage() {
  const { showSlug = "" } = useParams<{ showSlug: string }>();
  const [detail, setDetail] = useState<PublicAudioShowDetail | null>(null);
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

    getPublicAudioShow(showSlug)
      .then((result) => {
        if (!active) return;
        setDetail(result);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Audio Show could not load.",
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
    if (!detail) return;

    const href = `${SITE_URL}${detail.show.feedPath}`;
    const existing = document.querySelector<HTMLLinkElement>(
      'link[data-wakilisha-audio-rss="true"]',
    );
    const link = existing ?? document.createElement("link");

    link.rel = "alternate";
    link.type = "application/rss+xml";
    link.title = `${detail.show.title} RSS`;
    link.href = href;
    link.dataset.wakilishaAudioRss = "true";

    if (!existing) document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, [detail]);

  const playerItems = useMemo(
    () => detail?.episodes.map(publicAudioPlayerItem) ?? [],
    [detail],
  );

  const playEpisode = (index: number) => {
    if (!detail) return;
    const episode = detail.episodes[index];
    const item = playerItems[index];
    if (!episode || !item) return;

    if (currentTrack?.id === item.id && isPlaying) {
      pause();
      return;
    }

    playTrack(item, playerItems, {
      pageType: "audio_show",
      entityType: "audio_episode",
      entitySlug: episode.slug,
      sourceSection: "episode_list",
    });
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-neutral-500">Loading Audio Show.</p>
      </main>
    );
  }

  if (!detail || error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Audio
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
          Show unavailable
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          {error || "This Show has no currently published Episodes."}
        </p>
      </main>
    );
  }

  const { show, episodes } = detail;
  const feedUrl = `${SITE_URL}${show.feedPath}`;
  const canonicalUrl = `${SITE_URL}${show.canonicalPath}`;
  const latest = episodes[0];
  const latestActive = Boolean(latest && currentTrack?.id === latest.publicationId);

  return (
    <>
      <MetaTags
        title={show.title}
        description={show.description || `Listen to ${show.title} on WAKILISHA.`}
        url={canonicalUrl}
      />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <section className="grid gap-7 border-b border-neutral-200 pb-9 dark:border-neutral-800 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
          <div
            aria-hidden="true"
            className="aspect-square w-full max-w-[220px] rounded-[28px] border border-black/5 shadow-sm dark:border-white/10"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, rgba(255,255,255,.75), transparent 30%), linear-gradient(145deg, #f8d57e 0%, #ee8d68 42%, #714f7d 100%)",
            }}
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Audio Show
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-neutral-950 dark:text-white sm:text-5xl">
              {show.title}
            </h1>
            {show.description && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
                {show.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {latest && (
                <button
                  type="button"
                  onClick={() => playEpisode(0)}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  {latestActive && isPlaying ? (
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  )}
                  {latestActive && isPlaying ? "Pause" : "Listen to latest"}
                </button>
              )}

              <a
                href={feedUrl}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
              >
                <Rss className="h-4 w-4" aria-hidden="true" />
                RSS Feed
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            <p className="mt-5 text-sm text-neutral-500">
              {show.episodeCount} {show.episodeCount === 1 ? "Episode" : "Episodes"}
            </p>
          </div>
        </section>

        <section className="pt-9" aria-labelledby="episodes-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Published Audio
              </p>
              <h2
                id="episodes-heading"
                className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
              >
                Episodes
              </h2>
            </div>
          </div>

          <ol className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {episodes.map((episode, index) => {
              const active = currentTrack?.id === episode.publicationId;
              const duration = formatDuration(episode.delivery.durationSeconds);
              const publishedAt = formatDate(episode.provenance.publishedAt);
              const context = [
                episode.season
                  ? `Season ${episode.season.seasonNumber}`
                  : "",
                episode.episodeNumber !== null
                  ? `Episode ${episode.episodeNumber}`
                  : "Episode",
              ].filter(Boolean).join(" · ");

              return (
                <li
                  key={episode.publicationId}
                  className="grid gap-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => playEpisode(index)}
                    aria-label={`${active && isPlaying ? "Pause" : "Play"} ${episode.title}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 text-neutral-950 transition hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:text-white dark:hover:border-neutral-500"
                  >
                    {active && isPlaying ? (
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      {context}
                    </p>
                    <Link
                      to={episode.canonicalPath}
                      className="mt-1 block text-lg font-semibold text-neutral-950 underline-offset-4 hover:underline dark:text-white"
                    >
                      {episode.title}
                    </Link>
                    {episode.summary && (
                      <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                        {episode.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-neutral-500 sm:justify-end">
                    {publishedAt && <span>{publishedAt}</span>}
                    {duration && <span>{duration}</span>}
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
