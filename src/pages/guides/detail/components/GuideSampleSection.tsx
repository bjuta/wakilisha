import { useState, useCallback } from "react";
import { inMinorKeysData } from "../data";

export default function GuideSampleSection() {
  const { sample } = inMinorKeysData;
  const [currentPage, setCurrentPage] = useState(0);

  const nextPage = useCallback(() => {
    setCurrentPage((p) => (p + 1) % sample.pages.length);
  }, [sample.pages.length]);

  const prevPage = useCallback(() => {
    setCurrentPage((p) => (p - 1 + sample.pages.length) % sample.pages.length);
  }, [sample.pages.length]);

  return (
    <section className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
      <div className="wk-container-wide px-6">
        {/* Section head */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)] mb-3">
              {sample.eyebrow}
            </p>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
              {sample.title}{" "}
              <span className="italic font-light">{sample.titleItalic}</span>
            </h2>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">
            {sample.label}
          </span>
        </div>

        {/* Sample viewer */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevPage}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:bg-[var(--wk-surface-raised)] transition-colors cursor-pointer shrink-0"
            aria-label="Previous sample page"
          >
            <i className="ri-arrow-left-s-line text-xl text-[var(--wk-text)]" />
          </button>

          <div className="relative w-full max-w-[500px] aspect-[3/4] rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            {sample.pages.map((page, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  index === currentPage ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src={page.image}
                  alt={page.alt}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          <button
            onClick={nextPage}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] hover:bg-[var(--wk-surface-raised)] transition-colors cursor-pointer shrink-0"
            aria-label="Next sample page"
          >
            <i className="ri-arrow-right-s-line text-xl text-[var(--wk-text)]" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={prevPage}
            className="text-[13px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
          >
            Previous
          </button>
          <span className="text-[13px] font-bold text-[var(--wk-text)]">
            {currentPage + 1} / {sample.pages.length}
          </span>
          <button
            onClick={nextPage}
            className="text-[13px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {sample.pages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                index === currentPage
                  ? "w-6 bg-[var(--wk-v-intel)]"
                  : "w-2 bg-[var(--wk-border)] hover:bg-[var(--wk-text-faint)]"
              }`}
              aria-label={`Go to sample page ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}