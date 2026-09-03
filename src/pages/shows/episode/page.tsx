import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { PublicAudioListeningSurface } from "@/components/audio/PublicAudioListeningSurface";
import { PublicVideoWatchingSurface } from "@/components/video/PublicVideoWatchingSurface";
import { WkIcon } from "@/components/design-system/Icon";
import { usePlayer } from "@/context/PlayerContext";
import { publicAudioPlayerItem } from "@/services/audio/audioPlayerAdapter";
import type { PublicShowEpisode } from "@/services/shows/showPublicModel";
import { getPublicShowEpisode } from "@/services/shows/showPublicService";

const SITE_URL = "https://wakilisha.africa";

export default function PublicShowEpisodePage() {
  const {
    showSlug = "",
    episodeSlug = "",
  } = useParams<{
    showSlug: string;
    episodeSlug: string;
  }>();
  const [episode, setEpisode] = useState<PublicShowEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    openFullPlayer,
  } = usePlayer();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    getPublicShowEpisode(showSlug, episodeSlug)
      .then((next) => {
        if (alive) setEpisode(next);
      })
      .catch(() => {
        if (alive) {
          setEpisode(null);
          setError(true);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [episodeSlug, showSlug]);

  const audioPlayerItem = useMemo(
    () => episode?.audio
      ? publicAudioPlayerItem(episode.audio)
      : null,
    [episode],
  );

  if (loading) {
    return (
      <main
        className="wk-container-wide min-h-[60vh] px-5 py-10 md:px-6"
        aria-busy="true"
        aria-label="Loading Episode"
      >
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-4 w-20 rounded bg-wk-surface-raised" />
          <div className="h-12 w-3/4 rounded bg-wk-surface-raised" />
          <div className="h-64 rounded-[28px] bg-wk-surface" />
        </div>
      </main>
    );
  }

  if (!episode) {
    return (
      <main className="wk-container-wide min-h-[60vh] px-5 py-16 md:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-wk-border bg-wk-surface px-6 py-12 text-center">
          <WkIcon name="PlayCircle" size={30} className="mx-auto text-wk-text-faint" />
          <h1 className="mt-4 text-2xl font-black text-wk-text">Episode unavailable</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-wk-text-muted">
            {error
              ? "We could not load this Episode."
              : "This Episode is not published or could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const canonicalUrl = `${SITE_URL}${episode.episode.canonicalPath}`;
  const description =
    episode.episode.summary
    || episode.video?.summary
    || episode.audio?.summary
    || `Watch or listen to ${episode.episode.title} on WAKILISHA.`;

  if (episode.audio && !episode.video) {
    return (
      <>
        <MetaTags
          title={episode.episode.title}
          description={description}
          url={canonicalUrl}
        />
        <PublicAudioListeningSurface publication={episode.audio} />
      </>
    );
  }

  if (episode.video && !episode.audio) {
    return (
      <>
        <MetaTags
          title={episode.episode.title}
          description={description}
          url={canonicalUrl}
          imageUrl={episode.video.poster?.url || undefined}
        />
        <PublicVideoWatchingSurface publication={episode.video} />
      </>
    );
  }

  if (!episode.video || !episode.audio || !audioPlayerItem) {
    return null;
  }

  const audioActive = currentTrack?.id === episode.audio.publicationId;

  const toggleAudio = () => {
    if (audioActive) {
      togglePlay();
      return;
    }

    playTrack(audioPlayerItem, [audioPlayerItem], {
      pageType: "show_episode",
      entityType: "audio_episode",
      entitySlug: episode.episode.slug,
      sourceSection: "episode_listen",
    });
  };

  return (
    <>
      <MetaTags
        title={episode.episode.title}
        description={description}
        url={canonicalUrl}
        imageUrl={episode.video.poster?.url || undefined}
      />

      <PublicVideoWatchingSurface publication={episode.video} />

      <section
        className="border-t border-wk-border bg-wk-surface"
        aria-labelledby="listen-to-episode"
      >
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wk-brand">
              Listen
            </p>
            <h2
              id="listen-to-episode"
              className="mt-2 text-2xl font-semibold tracking-tight text-wk-text"
            >
              Audio edition
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-wk-text-muted">
              This Episode also has a published Audio edition under the same Show identity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleAudio}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-wk-text px-5 py-3 text-sm font-semibold text-wk-bg"
            >
              <WkIcon
                name={audioActive && isPlaying ? "Pause" : "Play"}
                size={16}
                fill="currentColor"
              />
              {audioActive && isPlaying ? "Pause" : "Listen"}
            </button>

            {audioActive ? (
              <button
                type="button"
                onClick={openFullPlayer}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-wk-border px-5 py-3 text-sm font-semibold text-wk-text"
              >
                Open Player
                <WkIcon name="Expand" size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
