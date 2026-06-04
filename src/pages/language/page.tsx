import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";

const VERTICAL = {
  key: "language",
  label: "Language",
  colorVar: "--wk-v-language",
  icon: "ri-translate-2",
  description:
    "Indigenous language archives, translations, lyric annotation, proverbs, oral histories, pronunciation guides, language pages, children's language content, and vernacular music and culture documentation.",
};

export default function LanguagePage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 md:py-32 border-b border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6 text-center">
          <div
            className="flex h-20 w-20 mx-auto mb-6 items-center justify-center rounded-2xl"
            style={{ background: `var(${VERTICAL.colorVar})`, color: "#fff" }}
          >
            <i className={`${VERTICAL.icon} text-3xl`} />
          </div>
          <div className="wk-eyebrow mb-4 justify-center">
            <span className="hidden">—</span>
            Coming Soon
          </div>
          <h1 className="font-black text-[clamp(32px,5vw,56px)] leading-[0.94] tracking-[-0.04em] text-[var(--wk-text)] mb-4">
            WAKILISHA {VERTICAL.label}
          </h1>
          <p className="text-[clamp(15px,1.6vw,18px)] leading-relaxed text-[var(--wk-text-soft)] max-w-[640px] mx-auto mb-8">
            {VERTICAL.description}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="whitespace-nowrap">
              <WkButton variant="primary">
                <i className="ri-arrow-left-line" />
                Back to WAKILISHA
              </WkButton>
            </Link>
            <Link to="/guides" className="whitespace-nowrap">
              <WkButton variant="ghost">
                <i className="ri-compass-3-line" />
                Browse Guides
              </WkButton>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          <h2 className="text-center font-black text-[clamp(22px,2.5vw,32px)] leading-[1.02] tracking-[-0.03em] text-[var(--wk-text)] mb-12">
            What to expect
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[900px] mx-auto">
            {[
              { title: "Language Archives", desc: "Preserving indigenous languages with audio recordings, scripts, and usage examples." },
              { title: "Lyric Annotation", desc: "Translating and contextualizing music lyrics across African languages." },
              { title: "Oral Histories", desc: "Recording proverbs, stories, and spoken traditions passed through generations." },
              { title: "Pronunciation Guides", desc: "Making African languages accessible with audio and phonetic tools." },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center"
              >
                <div
                  className="flex h-10 w-10 mx-auto mb-3 items-center justify-center rounded-xl"
                  style={{ background: `var(${VERTICAL.colorVar})`, color: "#fff" }}
                >
                  <i className="ri-book-open-line text-lg" />
                </div>
                <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1">{item.title}</h3>
                <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}