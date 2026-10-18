import { Link } from "react-router-dom";
import { WkEditorialIntro, WkEditorialArtworkFrame } from "@/components/design-system/layout/WorkbookEditorial";
import { useEffect, useMemo, useState } from "react";
import { WkSearchField } from "@/components/design-system/primitives/Field";
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
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <WkEditorialIntro eyebrow="Watch" title="Video" description="Films, sessions, documentaries, shorts, and live performances. Music and the people behind it stay connected.">
            <div className="mt-6 max-w-[420px]">
              <WkSearchField value={query} onChange={setQuery} ariaLabel="Search Video" placeholder="Search Video"
                inputClassName="min-h-11 rounded-full border-[var(--wk-border)] bg-[var(--wk-surface)] text-[16px] text-[var(--wk-text)]" />
            </div>
          </WkEditorialIntro>
        </div>
        <section className="mx-auto max-w-[1180px] px-4 pb-14 sm:px-6 lg:pb-20">
          {!query.trim() && items.length > 0 ? (
            <Link to={items[0].canonicalPath} className="wk-editorial-media-feature" aria-label={`Watch ${items[0].title}`}>
              <WkEditorialArtworkFrame src={items[0].poster?.url} alt={items[0].title} ratio="cinema" />
              <div className="wk-editorial-feature-copy">
                <span className="wk-editorial-eyebrow">Featured Video</span>
                <h2 className="mt-3">{items[0].title}</h2>
                {items[0].summary ? <p className="line-clamp-2">{items[0].summary}</p> : null}
              </div>
            </Link>
          ) : null}
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
