import { Link } from "react-router-dom";
import {
  LIBRARY_CATEGORY_ORDER,
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

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <span className="mb-5 inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            Quiet preview
          </span>

          <h1 className="text-[clamp(42px,8vw,92px)] font-black leading-[0.9] tracking-[-0.075em] text-[var(--wk-text)]">
            The WAKILISHA Library
          </h1>

          <div className="mt-8 space-y-4 text-[17px] leading-8 text-[var(--wk-text-muted)]">
            <p>
              Every institution remembers what it decided. Few remember how they learned.
            </p>
            <p>
              The Library is where WAKILISHA preserves its Constitutions, Field Notes, Inquiries, Founder Letters, and institutional memory.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {LIBRARY_CATEGORY_ORDER.map((category) => {
            const entries = getPublicLibraryEntriesByCategory(category);

            return (
              <section
                key={category}
                className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[22px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
                      {getLibraryCategoryLabel(category)}
                    </h2>
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
                    No public entries yet. The Library exists in the repository, but this wing is still internal or embargoed.
                  </p>
                )}
              </section>
            );
          })}
        </div>

        {publicEntries.length === 0 ? (
          <section className="mt-10 rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 sm:p-8">
            <h2 className="text-[24px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
              Why this page is quiet
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--wk-text-muted)]">
              This first version wires the Library into WAKILISHA without exposing internal memory too early. Public entries will appear here when their front matter says they are ready.
            </p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
