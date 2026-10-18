import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import { Link } from "react-router-dom";
import { WkEditorialArtworkFrame } from "@/components/design-system/layout/WorkbookEditorial";
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

  const featured = query.trim() || format !== "all" ? null : items[0] ?? null;
  const remaining = featured ? items.slice(1) : items;
  const groups = [
    { title: "Series", test: /series|episod/i },
    { title: "Sessions", test: /session|performance/i },
    { title: "Shorts", test: /short|reel/i },
    { title: "Live", test: /live/i },
  ];
  const groupedItems = groups.map(({ title, test }) => ({
    title, items: remaining.filter((item) => test.test(item.classification)),
  })).filter((group) => group.items.length > 0);
  const generalItems = remaining.filter((item) => !groups.some((group) => group.test.test(item.classification)));

  return (
    <>
      <MetaTags
        title="Video | WAKILISHA"
        description="Watch documentaries, sessions, series, shorts and live video from WAKILISHA."
        url="https://wakilisha.africa/video"
      />
      <main data-wk-workbook-screen="video" className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
        <div className="mx-auto w-full max-w-[1320px]">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-9">
            <nav aria-label="Video formats" className="wk-reference-pills">
              {["all", ...formats].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={format === value}
                  onClick={() => setFormat(value)}
                  className="wk-reference-pill capitalize"
                >
                  {value === "all" ? "All" : value.replace(/[_-]+/g, " ")}
                </button>
              ))}
            </nav>
            <div className="min-w-[170px] max-w-[300px] flex-1">
              <WkSearchField
                value={query}
                onChange={setQuery}
                ariaLabel="Search Video"
                placeholder="Search video"
                inputClassName="min-h-11 rounded-full border-[var(--wk-border)] bg-[var(--wk-surface)] text-[16px] text-[var(--wk-text)]"
              />
            </div>
          </div>

          {!featured && (
            <header className="px-5 pb-5 pt-3 sm:px-9">
              <h1 className="text-[clamp(38px,5vw,62px)] font-extrabold uppercase leading-[.95] tracking-[-.05em] text-[var(--wk-text)]">Video</h1>
            </header>
          )}
          {featured && (
            <Link to={featured.canonicalPath} className="wk-reference-media-hero group" aria-label={`Watch ${featured.title}`}>
              <WkEditorialArtworkFrame src={featured.poster?.url} alt={featured.title} ratio="cinema" />
              <div className="wk-reference-media-hero-copy">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#85c441]">
                  {featured.classification.replace(/[_-]+/g, " ")}
                  {featured.delivery.kind === "native_media" && featured.delivery.durationSeconds
                    ? ` · ${Math.round(featured.delivery.durationSeconds / 60)} min`
                    : ""}
                </span>
                <h1 className="wk-reference-media-hero-title mt-4">{featured.title}</h1>
                {featured.summary && <p className="wk-reference-hero-caption line-clamp-3">{featured.summary}</p>}
                <span className="wk-reference-play-button mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-[#0b0b0b]">
                  Watch <span aria-hidden="true">↗</span>
                </span>
              </div>
            </Link>
          )}

          {error && (
            <p className="mx-5 my-8 border-l-2 border-[var(--wk-brand)] pl-4 text-[14px] text-[var(--wk-text-muted)]" role="alert">
              Video is temporarily unavailable.
            </p>
          )}
          {!index && !error && (
            <div className="grid grid-cols-2 gap-4 px-5 py-10 sm:grid-cols-3 sm:px-9" aria-busy="true">
              {[0,1,2].map((i) => <div key={i} className="aspect-video animate-pulse rounded-[12px] bg-[var(--wk-surface-raised)]" />)}
            </div>
          )}
          {index && items.length === 0 && (
            <p className="mx-5 py-12 text-[15px] text-[var(--wk-text-muted)]">
              {query.trim() || format !== "all" ? "No video matches those filters." : "No video is published yet."}
            </p>
          )}
          {groupedItems.map((group) => (
            <section key={group.title} className="px-5 py-8 sm:px-9">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="wk-reference-section-heading">{group.title}</h2>
                <span className="text-[12px] text-[var(--wk-text-muted)]">{group.items.length}</span>
              </div>
              <div className={group.title === "Shorts"
                ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 [&_.wk-video-card-frame]:aspect-[9/16]"
                : "wk-reference-media-grid"}>
                {group.items.map((publication) => (
                  <PublicVideoCard key={publication.versionId} publication={publication} />
                ))}
              </div>
            </section>
          ))}
          {generalItems.length > 0 && (
            <section className="px-5 py-8 sm:px-9">
              <h2 className="wk-reference-section-heading mb-5">
                {query.trim() || format !== "all" ? "Results" : "Films & documentaries"}
              </h2>
              <div className="wk-reference-media-grid">
                {generalItems.map((publication) => (
                  <PublicVideoCard key={publication.versionId} publication={publication} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
