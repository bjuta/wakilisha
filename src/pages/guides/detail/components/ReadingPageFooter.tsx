import { readingGuide } from "../readingData";

export default function ReadingPageFooter() {
  return (
    <footer
      className="py-6 border-t"
      style={{ background: "var(--wk-bg)", borderColor: "var(--wk-divider)" }}
    >
      <div className="max-w-[720px] mx-auto px-6 md:px-8 flex items-center justify-between text-[12px]" style={{ color: "var(--wk-text-muted)" }}>
        <span className="font-medium">{readingGuide.publisher}</span>
        <span>{readingGuide.issue}</span>
        <span>Prologue</span>
      </div>
    </footer>
  );
}