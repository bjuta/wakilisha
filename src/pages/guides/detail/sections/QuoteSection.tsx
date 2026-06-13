import type { QuoteData } from "../sectionTypes";

export default function QuoteSection({ data }: { data: QuoteData }) {
  const quoteText = data.quote || data.text || "";

  return (
    <section className="relative py-20 md:py-32 overflow-hidden" style={{ background: "var(--wk-bg)" }}>
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full border border-[var(--wk-text)]" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-[var(--wk-text)]" />
        <div className="absolute w-[200px] h-[200px] rounded-full border border-[var(--wk-text)]" />
      </div>

      <div className="relative wk-container-wide px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="flex items-start gap-6">
            <div className="hidden md:block w-[3px] h-full min-h-[120px] bg-[var(--wk-v-intel)] rounded-full flex-shrink-0 mt-4" />
            <div>
              <blockquote className="text-[clamp(20px,3vw,32px)] leading-[1.5] font-light italic text-[var(--wk-text)] tracking-[-0.01em]">
                &ldquo;{quoteText}&rdquo;
              </blockquote>
              <p className="mt-8 text-[12px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">
                {data.attribution}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}