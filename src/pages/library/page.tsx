import { Link } from "react-router-dom";
import {
  LIBRARY_CATEGORY_ORDER,
  getBookOneLibraryEntries,
  getLibraryCategoryLabel,
  getPublicLibraryEntries,
  getPublicLibraryEntriesByCategory,
} from "@/services/libraryService";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  constitutions: "The principles that guide WAKILISHA.",
  "field-notes": "Moments of learning, change, disagreement, and discovery.",
  inquiries: "Long-running questions and research lines.",
  "founder-letters": "Occasional letters from JB and future institutional leaders.",
  "things-we-laughed-about": "The human moments, bugs, and absurdities worth remembering.",
};

export default function LibraryPage() {
  const publicEntries = getPublicLibraryEntries();
  const bookOneEntries = getBookOneLibraryEntries();
  const firstChapter = bookOneEntries[0] || null;
  const memoryCategories = LIBRARY_CATEGORY_ORDER.filter((category) => category !== "constitutions");

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-4xl">
            <span className="mb-5 inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Book One is public
            </span>

            <h1 className="text-[clamp(44px,8vw,100px)] font-black leading-[0.9] tracking-[-0.08em] text-[var(--wk-text)]">
              The WAKILISHA Library
            </h1>

            <div className="mt-8 max-w-3xl space-y-4 text-[17px] leading-8 text-[var(--wk-text-muted)]">
              <p>
                Every institution remembers what it decided. Few remember how they learned.
              </p>
              <p>
                The Library is where WAKILISHA keeps its Constitutions, Field Notes, Inquiries, Founder Letters, and institutional memory.
              </p>
            </div>

            {firstChapter ? (
              <div className="mt-8">
                <Link
                  to={firstChapter.route}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-black text-[var(--wk-brand-on)] transition hover:-translate-y-0.5"
                >
                  Start Book One
                  <i className="ri-arrow-right-line ml-2" />
                </Link>
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Reading status
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                  Public chapters
                </dt>
                <dd className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[var(--wk-text)]">
                  {bookOneEntries.length}
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
              Book One is the constitutional spine. The other wings remain quiet until their public memory is ready.
            </p>
          </div>
        </div>

        <section className="mt-14 rounded-[36px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 sm:p-7 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                Book One
              </p>
              <h2 className="mt-3 text-[clamp(30px,5vw,58px)] font-black leading-[0.95] tracking-[-0.07em] text-[var(--wk-text)]">
                The WAKILISHA Constitution
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-[var(--wk-text-muted)]">
                A public reading path for the people who want to understand what WAKILISHA is, why it exists, how it thinks, and what future builders must protect.
              </p>
            </div>

            <div className="grid gap-3">
              {bookOneEntries.map((entry) => (
                <Link
                  key={entry.route}
                  to={entry.route}
                  className="group grid gap-4 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--wk-brand)] sm:grid-cols-[76px_1fr_auto]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[18px] font-black tracking-[-0.04em] text-[var(--wk-brand)]">
                    {entry.chapter || "00"}
                  </div>
                  <div>
                    <h3 className="text-[16px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
                      {entry.title}
                    </h3>
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
          </div>
        </section>

        <section className="mt-14">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Other Library wings
            </p>
            <h2 className="mt-3 text-[32px] font-black tracking-[-0.05em] text-[var(--wk-text)]">
              The rest of the memory stays careful.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[var(--wk-text-muted)]">
              Field Notes, Inquiries, Founder Letters, and human archive material will become public when they are ready. Until then, the Library shows the boundary clearly.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {memoryCategories.map((category) => {
              const entries = getPublicLibraryEntriesByCategory(category);

              return (
                <section
                  key={category}
                  className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[22px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
                        {getLibraryCategoryLabel(category)}
                      </h3>
                      <p className="mt-2 text-[14px] leading-6 text-[var(--wk-text-muted)]">
                        {CATEGORY_DESCRIPTIONS[category]}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[12px] font-bold text-[var(--wk-text-muted)]">
                      {entries.length}
                    </span>
                  </div>

                  {entries.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {entries.map((entry) => (
                        <Link
                          key={entry.route}
                          to={entry.route}
                          className="block rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--wk-brand)]"
                        >
                          <div className="text-[15px] font-black text-[var(--wk-text)]">
                            {entry.title}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--wk-text-muted)]">
                            {entry.excerpt}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 rounded-2xl border border-dashed border-[var(--wk-border)] p-4 text-[13px] leading-6 text-[var(--wk-text-muted)]">
                      No public entries yet. This wing exists in the repository, but it is still internal or embargoed.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
