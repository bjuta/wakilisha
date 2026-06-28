import { Link, useParams } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import {
  getLibraryCategoryLabel,
  getPublicLibraryEntry,
} from "@/services/libraryService";
import { MarkdownRenderer } from "../MarkdownRenderer";

export default function LibraryEntryPage() {
  const { category = "", slug = "" } = useParams();
  const entry = getPublicLibraryEntry(category, slug);

  if (!entry) {
    return <NotFound />;
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-[13px] font-black text-[var(--wk-brand)] hover:underline"
        >
          <i className="ri-arrow-left-line" />
          Back to the Library
        </Link>

        <header className="mt-8 border-b border-[var(--wk-border)] pb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
              {getLibraryCategoryLabel(entry.category)}
            </span>
            <span className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
              {entry.status}
            </span>
          </div>

          <h1 className="text-[clamp(38px,6vw,76px)] font-black leading-[0.94] tracking-[-0.07em] text-[var(--wk-text)]">
            {entry.title}
          </h1>

          <dl className="mt-6 grid gap-3 text-[13px] text-[var(--wk-text-muted)] sm:grid-cols-2">
            {entry.version ? (
              <div>
                <dt className="font-black text-[var(--wk-text)]">Version</dt>
                <dd>{entry.version}</dd>
              </div>
            ) : null}
            {entry.created ? (
              <div>
                <dt className="font-black text-[var(--wk-text)]">Created</dt>
                <dd>{entry.created}</dd>
              </div>
            ) : null}
            {entry.author ? (
              <div>
                <dt className="font-black text-[var(--wk-text)]">Author</dt>
                <dd>{entry.author}</dd>
              </div>
            ) : null}
            {entry.origin ? (
              <div>
                <dt className="font-black text-[var(--wk-text)]">Origin</dt>
                <dd>{entry.origin}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        <section className="mt-10">
          <MarkdownRenderer body={entry.body} />
        </section>
      </article>
    </main>
  );
}
