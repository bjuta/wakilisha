import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import {
  getPublicVideoIndex,
  type PublicVideoIndex,
} from "@/services/video/videoPublicService";

export default function VideoIndexPage() {
  const [index, setIndex] = useState<PublicVideoIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getPublicVideoIndex()
      .then((value) => {
        if (alive) setIndex(value);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Video could not be loaded.",
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <MetaTags
        title="Video | WAKILISHA"
        description="Watch documentaries, performances, interviews, field footage and other cultural Video from WAKILISHA."
        canonicalPath="/video"
      />

      <main className="min-h-screen bg-wk-bg text-wk-text">
        <section className="wk-container-wide px-4 pb-10 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-wk-brand">
              WAKILISHA Video
            </p>
            <h1 className="mt-3 max-w-4xl text-5xl font-black tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Watch the culture move.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-wk-text-muted sm:text-lg">
              Films, performances, conversations and field recordings from the
              cultural record.
            </p>

            {error ? (
              <div className="mt-10 rounded-2xl border border-wk-danger/20 bg-wk-danger-soft p-5 text-sm text-wk-danger">
                {error}
              </div>
            ) : null}

            {!index && !error ? (
              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, indexValue) => (
                  <div
                    key={indexValue}
                    className="aspect-[4/5] animate-pulse rounded-3xl bg-wk-surface"
                  />
                ))}
              </div>
            ) : null}

            {index?.items.length === 0 ? (
              <div className="mt-12 rounded-3xl border border-wk-border bg-wk-surface p-8 text-sm text-wk-text-muted">
                No public Video has been released yet.
              </div>
            ) : null}

            {index?.items.length ? (
              <div className="mt-12 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {index.items.map((publication) => (
                  <Link
                    key={publication.versionId}
                    to={publication.canonicalPath}
                    className="group block"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-wk-border bg-black">
                      {publication.poster?.url ? (
                        <img
                          src={publication.poster.url}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-wk-surface to-black" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-5 pb-5 pt-16 text-white">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
                          {publication.classification.replace(/_/g, " ")}
                          {publication.episode?.episodeNumber
                            ? ` · Episode ${publication.episode.episodeNumber}`
                            : ""}
                        </p>
                        <h2 className="mt-1 text-2xl font-black leading-tight tracking-[-0.03em]">
                          {publication.title}
                        </h2>
                      </div>
                    </div>

                    {publication.summary ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-wk-text-muted">
                        {publication.summary}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
