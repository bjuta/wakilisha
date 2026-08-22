import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { PublicAudioListeningSurface } from "@/components/audio/PublicAudioListeningSurface";
import type { PublicShowEpisode } from "@/services/shows/showPublicModel";
import { getPublicShowEpisode } from "@/services/shows/showPublicService";

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
          <WkIcon name="AudioLines" size={30} className="mx-auto text-wk-text-faint" />
          <h1 className="mt-4 text-2xl font-black text-wk-text">Episode Unavailable</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-wk-text-muted">
            {error
              ? "We could not load this Episode."
              : "This Episode is not published or could not be found."}
          </p>
        </div>
      </main>
    );
  }

  return <PublicAudioListeningSurface publication={episode.audio} />;
}
