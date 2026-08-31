import { useEffect, useMemo, useState } from "react";
import { MetaTags } from "@/components/seo/MetaTags";
import { PublicVideoCard } from "@/components/video/PublicVideoCard";
import {
  getPublicVideoIndex,
  type PublicVideoIndex,
} from "@/services/video/videoPublicService";

export default function VideoIndexPage() {
  const [index, setIndex] = useState<PublicVideoIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return index?.items ?? [];
    return (index?.items ?? []).filter((publication) =>
      [
        publication.title,
        publication.summary || "",
        publication.show?.title || "",
        publication.classification,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [index?.items, query]);

  return (
    <>
      <MetaTags
        title="Video | WAKILISHA"
        description="Watch documentaries, performances, interviews, field footage and other cultural Video from WAKILISHA."
        url="https://wakilisha.africa/video"
      />

      <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
        <header className="border-b border-[var(--wk-border)]">
          <div className="mx-auto flex min-h-14 max-w-[1180px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">
                WAKILISHA
              </p>
              <h1 className="text-[18px] font-black tracking-[-0.025em]">
                Video
              </h1>
            </div>

            <label className="relative block w-full max-w-[260px]">
              <span className="sr-only">Search Video</span>
              <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--wk-text-faint)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Video"
                className="h-9 w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] pl-9 pr-3 text-[12px] font-semibold text-[var(--wk-text)] outline-none transition placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)]"
              />
            </label>
          </div>
        </header>

        <section className="mx-auto max-w-[1180px] px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:pb-20">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Watch
            </p>
            <h2 className="mt-2 text-[38px] font-black leading-[0.98] tracking-[-0.05em] sm:text-[52px]">
              The culture in motion.
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-6 text-[var(--wk-text-muted)] sm:text-[15px]">
              Films, performances, conversations and field recordings from
              African creative life.
            </p>
          </div>

          {error ? (
            <div className="mt-8 rounded-2xl border border-[var(--wk-danger)]/20 bg-[var(--wk-surface)] p-5 text-[13px] text-[var(--wk-danger)]">
              {error}
            </div>
          ) : null}

          {!index && !error ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, item) => (
                <div key={item}>
                  <div className="aspect-video animate-pulse rounded-2xl bg-[var(--wk-surface)]" />
                  <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-[var(--wk-surface)]" />
                </div>
              ))}
            </div>
          ) : null}

          {index && items.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-7">
              <p className="text-[14px] font-black">
                {query.trim() ? "No Video matches that search." : "No public Video has been released yet."}
              </p>
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 text-[12px] font-black text-[var(--wk-brand)]"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          ) : null}

          {items.length ? (
            <>
              <div className="mt-10 flex items-center justify-between border-b border-[var(--wk-border)] pb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                  {query.trim() ? "Search results" : "Latest Video"}
                </p>
                <span className="text-[11px] font-semibold text-[var(--wk-text-faint)]">
                  {items.length} {items.length === 1 ? "Video" : "Videos"}
                </span>
              </div>

              <div className="mt-5 space-y-3 sm:hidden">
                {items.map((publication) => (
                  <PublicVideoCard
                    key={publication.versionId}
                    publication={publication}
                    compact
                  />
                ))}
              </div>

              <div className="mt-6 hidden grid-cols-2 gap-x-5 gap-y-8 sm:grid lg:grid-cols-3">
                {items.map((publication) => (
                  <PublicVideoCard
                    key={publication.versionId}
                    publication={publication}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}
