import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import type { PublicShowHeader } from "@/services/shows/showPublicModel";
import { getPublicShowIndex } from "@/services/shows/showPublicService";

const SITE_URL = "https://wakilisha.africa";

export default function PublicShowsPage() {
  const [shows, setShows] = useState<PublicShowHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getPublicShowIndex(48)
      .then((result) => {
        if (active) setShows(result.items);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Shows could not load.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <MetaTags
        title="Shows | WAKILISHA"
        description="Watch and listen to WAKILISHA Shows."
        url={`${SITE_URL}/shows`}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wk-brand">
            Shows
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-wk-text sm:text-5xl">
            Stories that continue
          </h1>
          <p className="mt-4 text-base leading-7 text-wk-text-muted">
            Watch, listen, and follow Episodes under one shared Show identity.
          </p>
        </header>

        {loading ? (
          <div
            className="mt-10 grid gap-4 md:grid-cols-2"
            aria-busy="true"
            aria-label="Loading Shows"
          >
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-44 animate-pulse rounded-3xl border border-wk-border bg-wk-surface"
              />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="mt-10 rounded-2xl border border-wk-border bg-wk-surface p-6">
            <h2 className="text-lg font-semibold text-wk-text">
              Shows unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-wk-text-muted">
              {error}
            </p>
          </div>
        ) : null}

        {!loading && !error && shows.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-wk-border bg-wk-surface p-6">
            <p className="text-sm text-wk-text-muted">
              No public Shows are available yet.
            </p>
          </div>
        ) : null}

        {!loading && !error && shows.length ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {shows.map((show) => (
              <Link
                key={show.resourceId}
                to={show.canonicalPath}
                className="group rounded-3xl border border-wk-border bg-wk-surface p-6 transition hover:border-wk-brand hover:bg-wk-surface-raised"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wk-text-faint">
                  Show
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-wk-text group-hover:text-wk-brand">
                  {show.title}
                </h2>
                {show.description ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-wk-text-muted">
                    {show.description}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-wk-text-faint">
                  <span>
                    {show.episodeCount} {show.episodeCount === 1 ? "Episode" : "Episodes"}
                  </span>
                  {show.videoEpisodeCount ? (
                    <span>· {show.videoEpisodeCount} Watch</span>
                  ) : null}
                  {show.audioEpisodeCount ? (
                    <span>· {show.audioEpisodeCount} Listen</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </main>
    </>
  );
}
