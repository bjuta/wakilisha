import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { PublicAudioListeningSurface } from "@/components/audio/PublicAudioListeningSurface";
import { getPublicStandaloneAudio } from "@/services/audio/audioPublicService";
import type { PublicAudioPublication } from "@/services/audio/audioPublicModel";

export default function PublicAudioDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [publication, setPublication] = useState<PublicAudioPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);

    getPublicStandaloneAudio(slug)
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

  if (loading) {
    return (
      <main
        className="wk-container-wide min-h-[60vh] px-5 py-10 md:px-6"
        aria-busy="true"
        aria-label="Loading Audio"
      >
        <div className="mx-auto max-w-5xl animate-pulse space-y-4">
          <div className="h-4 w-20 rounded bg-wk-surface-raised" />
          <div className="h-12 w-3/4 rounded bg-wk-surface-raised" />
          <div className="h-64 rounded-[28px] bg-wk-surface" />
        </div>
      </main>
    );
  }

  if (!publication) {
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

  return <PublicAudioListeningSurface publication={publication} />;
}
