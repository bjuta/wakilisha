import { WkEditorialIntro } from "@/components/design-system/layout/WorkbookEditorial";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { WkIcon } from "@/components/design-system/Icon";
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
        title="Podcasts | WAKILISHA"
        description="Podcasts and shows from WAKILISHA."
        url={`${SITE_URL}/shows`}
      />

      <main data-wk-workbook-screen="podcasts" className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:pt-14">
        <WkEditorialIntro eyebrow="Listen and follow" title="Podcasts" description="Shows and episodes with their own histories. Listen, watch, and follow the people behind each story." />
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
              Please try again later.
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
                className="group flex items-start gap-5 border-t border-wk-border py-6 transition-colors hover:text-wk-brand"
              >
                <div className="flex aspect-square w-[112px] shrink-0 items-center justify-center bg-wk-surface-raised text-wk-brand sm:w-[152px]" aria-hidden="true">
                  <WkIcon name="Radio" size={32} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-wk-brand">Podcast · Show</p>
                <h2 className="mt-2 text-[22px] font-black leading-tight tracking-[-0.03em] text-wk-text group-hover:text-wk-brand">
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
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </main>
    </>
  );
}
