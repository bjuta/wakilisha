import { Link } from "react-router-dom";

const PILLARS = [
  {
    title: "Inquiry",
    body: "Every meaningful piece of work begins with a question worth following.",
  },
  {
    title: "Evidence",
    body: "Trust is earned through sources, corrections, context, and honest uncertainty.",
  },
  {
    title: "Relationships",
    body: "Culture becomes meaningful through the links between people, works, places, ideas, and memory.",
  },
  {
    title: "Understanding",
    body: "The Institute exists to help people see African culture more clearly than they did before.",
  },
  {
    title: "Memory",
    body: "Field Notes, Constitutions, letters, and decisions preserve how WAKILISHA learned.",
  },
  {
    title: "Community",
    body: "People hold culture. The Institute creates responsible ways for that memory to strengthen the record.",
  },
];

const WINGS = [
  {
    title: "The Library",
    body: "The Library preserves WAKILISHA’s Constitutions, Field Notes, Inquiries, Founder Letters, and institutional memory.",
    to: "/library",
    cta: "Enter the Library",
  },
  {
    title: "The Inquiries",
    body: "Inquiries are long-running questions that guide research, product work, community contribution, and public understanding.",
    to: "/library",
    cta: "View public Inquiries",
  },
  {
    title: "The Field Notes",
    body: "Field Notes preserve moments where thinking changed, evidence corrected us, or a better question appeared.",
    to: "/library",
    cta: "Visit Field Notes",
  },
];

export default function InstitutePage() {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <section className="relative overflow-hidden border-b border-[var(--wk-border)]">
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]">
          <div className="absolute left-[-12%] top-[-20%] h-[420px] w-[420px] rounded-full bg-[var(--wk-brand)] blur-3xl" />
          <div className="absolute bottom-[-22%] right-[-10%] h-[360px] w-[360px] rounded-full bg-[var(--wk-text)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <span className="mb-6 inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            The intellectual home
          </span>

          <h1 className="max-w-5xl text-[clamp(44px,8vw,104px)] font-black leading-[0.9] tracking-[-0.08em] text-[var(--wk-text)]">
            The WAKILISHA Institute
          </h1>

          <p className="mt-8 max-w-3xl text-[clamp(18px,2vw,24px)] leading-9 text-[var(--wk-text-muted)]">
            The Institute is where WAKILISHA asks better questions, follows evidence, preserves memory, and strengthens understanding of African culture.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/library"
              className="inline-flex items-center justify-center rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-black text-[var(--wk-brand-on)] transition hover:-translate-y-0.5"
            >
              Enter the Library
            </Link>
            <a
              href="#model"
              className="inline-flex items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-3 text-[14px] font-black text-[var(--wk-text)] transition hover:-translate-y-0.5"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Why it exists
            </span>
            <h2 className="mt-3 text-[clamp(32px,4vw,56px)] font-black leading-[0.95] tracking-[-0.06em] text-[var(--wk-text)]">
              Culture deserves patient inquiry.
            </h2>
          </div>

          <div className="space-y-5 text-[16px] leading-8 text-[var(--wk-text-muted)]">
            <p>
              African culture is too vast, too connected, and too alive to be reduced to news cycles, databases, playlists, or archives.
            </p>
            <p>
              WAKILISHA builds public experiences for discovery and understanding. The Institute protects the thinking underneath those experiences.
            </p>
            <p>
              Its responsibility is not to know everything. Its responsibility is to help people ask and answer better questions about African culture.
            </p>
          </div>
        </div>
      </section>

      <section id="model" className="border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              The model
            </span>
            <h2 className="mt-3 text-[clamp(32px,4vw,56px)] font-black leading-[0.95] tracking-[-0.06em] text-[var(--wk-text)]">
              Most institutions organize knowledge. WAKILISHA organizes curiosity.
            </h2>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-7">
            {["Question", "Inquiry", "Evidence", "Relationships", "Understanding", "Memory", "Better Questions"].map((step, index) => (
              <div
                key={step}
                className="rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[13px] font-black text-[var(--wk-brand-on)]">
                  {index + 1}
                </div>
                <div className="text-[14px] font-black leading-tight text-[var(--wk-text)]">
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            The pillars
          </span>
          <h2 className="mt-3 text-[clamp(32px,4vw,56px)] font-black leading-[0.95] tracking-[-0.06em] text-[var(--wk-text)]">
            What the Institute protects.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6"
            >
              <h3 className="text-[22px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
                {pillar.title}
              </h3>
              <p className="mt-3 text-[14px] leading-7 text-[var(--wk-text-muted)]">
                {pillar.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-4 lg:grid-cols-3">
            {WINGS.map((wing) => (
              <article
                key={wing.title}
                className="rounded-[30px] border border-[var(--wk-border)] bg-[var(--wk-bg)] p-6"
              >
                <h3 className="text-[24px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                  {wing.title}
                </h3>
                <p className="mt-3 text-[14px] leading-7 text-[var(--wk-text-muted)]">
                  {wing.body}
                </p>
                <Link
                  to={wing.to}
                  className="mt-6 inline-flex items-center gap-2 text-[13px] font-black text-[var(--wk-brand)] hover:underline"
                >
                  {wing.cta}
                  <i className="ri-arrow-right-line" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="rounded-[36px] border border-[var(--wk-border)] bg-[var(--wk-text)] p-8 text-[var(--wk-bg)] sm:p-10 lg:p-12">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] opacity-70">
            The sixty-year principle
          </span>
          <h2 className="mt-4 max-w-4xl text-[clamp(32px,5vw,68px)] font-black leading-[0.95] tracking-[-0.07em]">
            If someone asks us sixty years from now why we made this decision, will we still be proud of our answer?
          </h2>
          <p className="mt-6 max-w-3xl text-[16px] leading-8 opacity-80">
            That question does not slow down small reversible work. It protects the decisions that shape what WAKILISHA becomes.
          </p>
        </div>
      </section>
    </main>
  );
}
