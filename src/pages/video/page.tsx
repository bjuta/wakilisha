import "@/styles/wakilisha-workbook-p1-p11-authority.css";
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
  const [format, setFormat] = useState("all");

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

  const formats = useMemo(() => Array.from(new Set((index?.items ?? []).map((item) => item.classification).filter(Boolean))).sort(), [index?.items]);

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (index?.items ?? []).filter((publication) =>
      (format === "all" || publication.classification === format)
      && (!normalized || [
        publication.title,
        publication.summary || "",
        publication.show?.title || "",
        publication.classification,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized))
    );
  }, [index?.items, query, format]);

  const latestItems = query.trim() || format !== "all" ? items : items.slice(1);

  return (
    <>
      <MetaTags
        title="Video | WAKILISHA"
        description="Watch documentaries, performances, interviews, field footage and other cultural Video from WAKILISHA."
        url="https://wakilisha.africa/video"
      />

      <main data-wk-workbook-screen="video" className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <WkEditorialIntro eyebrow="Watch" title="Video" description="Films, sessions, documentaries, shorts, and live performances. Music and the people behind it stay connected.">
            <div className="mt-6 max-w-[420px]">
              <WkSearchField value={query} onChange={setQuery} ariaLabel="Search Video" placeholder="Search Video"
                inputClassName="min-h-11 rounded-md border-[var(--wk-border)] bg-[var(--wk-surface)] text-[16px] text-[var(--wk-text)]" />
            </div>
          </WkEditorialIntro>
          {formats.length > 1 && (
            <nav aria-label="Video formats" className="mb-7 flex flex-wrap gap-2">
              {["all", ...formats].map((item) => (
                <button key={item} type="button" aria-pressed={format === item} onClick={() => setFormat(item)}
                  className={`min-h-11 px-4 text-[12px] font-semibold capitalize transition-colors ${format === item ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)]"}`}>
                  {item === "all" ? "All" : item.replace(/[_-]+/g, " ")}
                </button>
              ))}
            </nav>
          )}
        </div>
        <section className="mx-auto max-w-[1180px] px-4 pb-14 sm:px-6 lg:pb-20">
          {!query.trim() && format === "all" && items.length > 0 ? (
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

          {latestItems.length ? (
            <>
              <div className="mt-10 flex items-center justify-between border-b border-[var(--wk-border)] pb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                  {query.trim() ? "Search results" : "Latest Video"}
                </p>
                <span className="text-[11px] font-semibold text-[var(--wk-text-faint)]">
                  {latestItems.length} {latestItems.length === 1 ? "Video" : "Videos"}
                </span>
              </div>

              <div className="mt-5 space-y-3 sm:hidden">
                {latestItems.map((publication) => (
                  <PublicVideoCard
                    key={publication.versionId}
                    publication={publication}
                    compact
                  />
                ))}
              </div>

              <div className="mt-6 hidden grid-cols-2 gap-x-5 gap-y-8 sm:grid lg:grid-cols-3">
                {latestItems.map((publication) => (
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
