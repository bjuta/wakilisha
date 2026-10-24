import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";

/** Quiet editorial byline, rather than three decorative metadata pills. */
export function formatMagazineHeroDate(value: string): string {
  if (!value.trim()) return "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(`${value.trim()}T00:00:00Z`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function MagazineHeroMeta({
  author,
  authorPersonPath,
  date,
  readingTime,
}: {
  author: string;
  authorPersonPath?: string | null;
  date: string;
  readingTime: number;
}) {
  return (
    <div
      data-wk-magazine-hero-byline
      className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px] font-medium leading-relaxed text-white/80"
    >
      <ArticleAuthorIdentity
        name={author}
        personPath={authorPersonPath}
        className="font-semibold text-white hover:text-white hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {author}
      </ArticleAuthorIdentity>
      {date ? (
        <>
          <span aria-hidden="true" className="text-white/45">·</span>
          <span>{formatMagazineHeroDate(date)}</span>
        </>
      ) : null}
      <span aria-hidden="true" className="text-white/45">·</span>
      <span>{readingTime} min read</span>
    </div>
  );
}
