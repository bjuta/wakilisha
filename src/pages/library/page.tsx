import { Link } from "react-router-dom";
import {
  getLibraryBooks,
  getPublicLibraryEntries,
  type LibraryBook,
} from "@/services/libraryService";

function statusLabel(status: LibraryBook["status"]) {
  if (status === "public") return "public";
  if (status === "draft") return "draft";
  return "internal";
}

function statusClass(status: LibraryBook["status"]) {
  if (status === "public") {
    return "border-[var(--wk-brand)] bg-[var(--wk-brand)] text-[var(--wk-brand-on)]";
  }

  if (status === "draft") {
    return "border-[var(--wk-warning)] bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]";
  }

  return "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)]";
}

export default function LibraryPage() {
  const books = getLibraryBooks();
  const publicEntries = getPublicLibraryEntries();
  const bookOne = books.find((book) => book.key === "book-one") || books[0];
  const startEntry = bookOne?.entries[0] || null;
  const publicBookCount = books.filter((book) => book.status === "public").length;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="max-w-4xl">
            <span className="mb-5 inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Start here
            </span>

            <h1 className="text-[clamp(44px,8vw,100px)] font-black leading-[0.9] tracking-[-0.08em] text-[var(--wk-text)]">
              The WAKILISHA Library
            </h1>

            <div className="mt-8 max-w-3xl space-y-4 text-[17px] leading-8 text-[var(--wk-text-muted)]">
              <p>
                The Library is not a shelf. It is the public memory of how WAKILISHA thinks, what it protects, and which parts of the method are ready to be read.
              </p>
              <p>
                Start with Book One. Book Two and Book Three stay visible as architecture, but quiet as text until the Institute can carry them properly.
              </p>
            </div>

            {startEntry ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={startEntry.route}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-black text-[var(--wk-brand-on)] transition hover:-translate-y-0.5"
                >
                  Start with the Preface
                  <i className="ri-arrow-right-line ml-2" />
                </Link>
                <a
                  href="#books"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--wk-border)] px-5 py-3 text-[13px] font-black text-[var(--wk-text)] transition hover:-translate-y-0.5 hover:border-[var(--wk-brand)]"
                >
                  See the books
                </a>
              </div>
            ) : null}
          </div>

          <aside className="rounded-[32px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Reading status
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                  Books visible
                </dt>
                <dd className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[var(--wk-text)]">
                  {books.length}
                </dd>
              </div>
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                  Public books
                </dt>
                <dd className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[var(--wk-text)]">
                  {publicBookCount}
                </dd>
              </div>
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                  Public chapters
                </dt>
                <dd className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[var(--wk-text)]">
                  {bookOne?.entries.length ?? 0}
                </dd>
              </div>
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                  Public entries
                </dt>
                <dd className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[var(--wk-text)]">
                  {publicEntries.length}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-[13px] leading-6 text-[var(--wk-text-muted)]">
              Public does not mean everything is ready. The Library shows restraint so readers know what is available, what is internal, and why.
            </p>
          </aside>
        </div>

        <section className="mt-14 rounded-[36px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 sm:p-7 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                Reading order
              </p>
              <h2 className="mt-3 text-[clamp(30px,5vw,58px)] font-black leading-[0.95] tracking-[-0.07em] text-[var(--wk-text)]">
                Read the method before the memory.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-[var(--wk-text-muted)]">
                The Library begins with principles, then shows the shift into the Institute, then the operating system that governs Inquiries, evidence, relationships, and future AI.
              </p>
            </div>

            <ol className="grid gap-3">
              {books.map((book, index) => (
                <li key={book.key} className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                  <div className="grid gap-4 sm:grid-cols-[70px_1fr_auto] sm:items-start">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[18px] font-black tracking-[-0.04em] text-[var(--wk-brand)]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                          {book.label}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(book.status)}`}>
                          {statusLabel(book.status)}
                        </span>
                      </div>
                      <h3 className="mt-2 text-[19px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                        {book.title}
                      </h3>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                        {book.description}
                      </p>
                    </div>
                    {book.route ? (
                      <Link
                        to={book.route}
                        className="inline-flex items-center rounded-full border border-[var(--wk-border)] px-4 py-2 text-[12px] font-black text-[var(--wk-text)] transition hover:border-[var(--wk-brand)]"
                      >
                        {book.startLabel}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-[var(--wk-border)] px-4 py-2 text-[12px] font-black text-[var(--wk-text-muted)]">
                        {book.startLabel}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="books" className="mt-14 grid gap-5">
          {books.map((book) => (
            <article key={book.key} className="rounded-[36px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 sm:p-7 lg:p-9">
              <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                      {book.label}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(book.status)}`}>
                      {statusLabel(book.status)}
                    </span>
                    <span className="rounded-full border border-[var(--wk-border)] px-2.5 py-1 text-[11px] font-black text-[var(--wk-text-muted)]">
                      {book.stage}
                    </span>
                  </div>

                  <h2 className="mt-3 text-[clamp(30px,5vw,58px)] font-black leading-[0.95] tracking-[-0.07em] text-[var(--wk-text)]">
                    {book.title}
                  </h2>

                  <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--wk-text-muted)]">
                    {book.description}
                  </p>

                  <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                      Restraint
                    </p>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                      {book.restraint}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
                    <h3 className="text-[16px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
                      What this book governs
                    </h3>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {book.governs.map((item) => (
                        <li key={item} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-[13px] font-bold leading-5 text-[var(--wk-text-muted)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
                    <h3 className="text-[16px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
                      Decisions and surfaces shaped
                    </h3>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {book.shapedBy.map((item) => (
                        <li key={item} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-[13px] font-bold leading-5 text-[var(--wk-text-muted)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>

              {book.entries.length > 0 ? (
                <section className="mt-8">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                        Public chapters
                      </p>
                      <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                        Read {book.label} in order
                      </h3>
                    </div>
                    <span className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[12px] font-bold text-[var(--wk-text-muted)]">
                      {book.entries.length} chapters
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {book.entries.map((entry) => (
                      <Link
                        key={entry.route}
                        to={entry.route}
                        className="group grid gap-4 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--wk-brand)] sm:grid-cols-[76px_1fr_auto]"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[18px] font-black tracking-[-0.04em] text-[var(--wk-brand)]">
                          {entry.chapter || "00"}
                        </div>
                        <div>
                          <h4 className="text-[16px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
                            {entry.title}
                          </h4>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--wk-text-muted)]">
                            {entry.excerpt}
                          </p>
                        </div>
                        <div className="hidden items-center text-[20px] text-[var(--wk-text-faint)] transition group-hover:text-[var(--wk-brand)] sm:flex">
                          <i className="ri-arrow-right-line" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : (
                <p className="mt-8 rounded-3xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                  This book is visible as architecture, but its chapters are not public yet. The Library names the boundary instead of pretending the memory is ready.
                </p>
              )}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
