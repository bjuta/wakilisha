import { Link, useParams } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import {
  getLibraryCategoryLabel,
  getPublicLibraryEntry,
  getPublicLibraryEntryNavigation,
} from "@/services/libraryService";
import { MarkdownRenderer } from "../MarkdownRenderer";

export default function LibraryEntryPage() {
  const { category = "", slug = "" } = useParams();
  const entry = getPublicLibraryEntry(category, slug);

  if (!entry) {
    return <NotFound />;
  }

  const navigation = getPublicLibraryEntryNavigation(entry.category, entry.slug);
  const chapterLabel = entry.chapter ? `Chapter ${entry.chapter}` : getLibraryCategoryLabel(entry.category);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <article className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-[13px] font-black text-[var(--wk-brand)] hover:underline"
        >
          <i className="ri-arrow-left-line" />
          Back to the Library
        </Link>

        <div className="mt-8 grid gap-10 xl:grid-cols-[280px_1fr]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                Book One
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                {navigation.index >= 0 ? `${navigation.index + 1} of ${navigation.total}` : `${navigation.total} chapters`}
              </p>

              <nav className="mt-5 space-y-1" aria-label="Book One chapters">
                {navigation.entries.map((tocEntry) => {
                  const isActive = tocEntry.route === entry.route;

                  return (
                    <Link
                      key={tocEntry.route}
                      to={tocEntry.route}
                      className={`grid grid-cols-[38px_1fr] gap-3 rounded-2xl px-3 py-3 text-[13px] transition ${
                        isActive
                          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                          : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)] hover:text-[var(--wk-text)]"
                      }`}
                    >
                      <span className={isActive ? "font-black text-[var(--wk-brand)]" : "font-black text-[var(--wk-text-faint)]"}>
                        {tocEntry.chapter || "00"}
                      </span>
                      <span className="font-bold leading-5">{tocEntry.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="min-w-0">
            <header className="border-b border-[var(--wk-border)] pb-8 lg:pb-10">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                  {chapterLabel}
                </span>
                <span className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
                  {entry.status}
                </span>
              </div>

              <h1 className="max-w-4xl text-[clamp(40px,7vw,88px)] font-black leading-[0.92] tracking-[-0.08em] text-[var(--wk-text)]">
                {entry.title}
              </h1>

              <p className="mt-6 max-w-3xl text-[17px] leading-8 text-[var(--wk-text-muted)]">
                {entry.excerpt}
              </p>

              <dl className="mt-8 grid gap-3 rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-[13px] text-[var(--wk-text-muted)] sm:grid-cols-2 lg:grid-cols-4">
                {entry.book ? (
                  <div>
                    <dt className="font-black text-[var(--wk-text)]">Book</dt>
                    <dd>{entry.book}</dd>
                  </div>
                ) : null}
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
                {entry.origin ? (
                  <div>
                    <dt className="font-black text-[var(--wk-text)]">Origin</dt>
                    <dd>{entry.origin}</dd>
                  </div>
                ) : null}
              </dl>
            </header>

            <section className="mt-10 max-w-3xl">
              <MarkdownRenderer body={entry.body} />
            </section>

            <nav
              className="mt-14 grid gap-4 border-t border-[var(--wk-border)] pt-8 md:grid-cols-2"
              aria-label="Library chapter navigation"
            >
              {navigation.previous ? (
                <Link
                  to={navigation.previous.route}
                  className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--wk-brand)]"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                    Previous chapter
                  </span>
                  <p className="mt-2 text-[18px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
                    {navigation.previous.title}
                  </p>
                </Link>
              ) : (
                <div />
              )}

              {navigation.next ? (
                <Link
                  to={navigation.next.route}
                  className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--wk-brand)] md:text-right"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                    Next chapter
                  </span>
                  <p className="mt-2 text-[18px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
                    {navigation.next.title}
                  </p>
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </article>
    </main>
  );
}
