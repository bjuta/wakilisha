import { useState } from "react";
import {
  readingGuide,
  prologueChapter,
  classroomLibrary,
  homeEcosystem,
  readingInfrastructure,
  smartphoneShift,
  theReturn,
  largerQuestion,
} from "../readingData";

function ChapterHead({
  label,
  num,
  title,
  epigraph,
}: {
  label: string;
  num: string;
  title: string;
  epigraph?: { text: string; cite: string };
}) {
  return (
    <header className="mb-10 md:mb-14">
      <span
        className="block text-[11px] font-semibold tracking-[0.2em] uppercase mb-3"
        style={{ color: "var(--wk-text-muted)" }}
      >
        {label}
      </span>
      <div className="flex items-start gap-4">
        <span
          className="hidden md:block text-[72px] md:text-[96px] font-black leading-none select-none"
          style={{ color: "var(--wk-surface-strong)", fontFamily: "var(--wk-font-heading)" }}
          aria-hidden="true"
        >
          {num}
        </span>
        <div className="flex-1">
          <h2
            className="text-[28px] md:text-[36px] font-black leading-tight italic"
            style={{ color: "var(--wk-text)", fontFamily: "var(--wk-font-heading)" }}
          >
            {title}
          </h2>
        </div>
      </div>
      {/* Ornament */}
      <div className="mt-4 text-[20px]" style={{ color: "var(--wk-text-muted)" }} aria-hidden="true">
        ❧
      </div>
      {epigraph && (
        <blockquote className="mt-8 pl-5 border-l-2" style={{ borderColor: "#C4A35A" }}>
          <p className="text-[15px] md:text-[16px] leading-relaxed italic" style={{ color: "var(--wk-text-soft)" }}>
            {epigraph.text}
          </p>
          <cite className="block mt-2 text-[12px] font-medium not-italic tracking-wide" style={{ color: "var(--wk-text-muted)" }}>
            {epigraph.cite}
          </cite>
        </blockquote>
      )}
    </header>
  );
}

function SectionTitle({ id, num, title }: { id: string; num: string; title: string }) {
  return (
    <div id={id} className="my-10 md:my-14 flex items-center gap-4">
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--wk-text-muted)" }}>
        {num}
      </span>
      <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
      <span className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: "var(--wk-text)" }}>
        {title}
      </span>
      <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
    </div>
  );
}

function ProseParagraph({
  html,
  isDropCap,
  fontSize,
}: {
  html: string;
  isDropCap?: boolean;
  fontSize: number;
}) {
  if (isDropCap) {
    return (
      <p
        className="text-[15px] md:text-[16px] leading-[1.75] mb-5"
        style={{ fontSize: `${fontSize}px`, color: "var(--wk-text)" }}
        dangerouslySetInnerHTML={{
          __html: html.replace(
            /^The book/,
            `<span class="inline-block float-left text-[3.2em] font-black leading-[0.85] mr-2 mt-1" style="color:#C4A35A;font-family:var(--wk-font-heading)">T</span>he book`
          ),
        }}
      />
    );
  }
  return (
    <p
      className="text-[15px] md:text-[16px] leading-[1.75] mb-5"
      style={{ fontSize: `${fontSize}px`, color: "var(--wk-text)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PullQuote({ text, fontSize }: { text: string; fontSize: number }) {
  return (
    <div className="my-8 md:my-10 py-6 md:py-8 px-4 md:px-6 text-center" style={{ background: "var(--wk-surface-raised)" }}>
      <p
        className="text-[15px] md:text-[17px] font-medium italic leading-relaxed max-w-[540px] mx-auto"
        style={{ fontSize: `${fontSize + 1}px`, color: "var(--wk-text-soft)" }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

function Aside({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="my-8 md:my-10 p-5 md:p-6 rounded-lg border" style={{ background: "var(--wk-surface-raised)", borderColor: "var(--wk-divider)" }}>
      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "var(--wk-text-muted)" }}>
        {kicker}
      </span>
      <h4 className="mt-1 text-[15px] font-bold" style={{ color: "var(--wk-text)" }}>
        {title}
      </h4>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--wk-text-soft)" }}>
        {body}
      </p>
    </div>
  );
}

function ListBurst({ items }: { items: string[] }) {
  return (
    <div className="my-8 md:my-10 space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full mt-2.5 flex-shrink-0" style={{ background: "#C4A35A" }} />
          <p className="text-[15px] md:text-[16px] leading-relaxed" style={{ color: "var(--wk-text)" }}>
            {item}
          </p>
        </div>
      ))}
    </div>
  );
}

interface ReadingArticleProps {
  fontSize: number;
}

export default function ReadingArticle({ fontSize }: ReadingArticleProps) {
  const [selectedText, setSelectedText] = useState("");

  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      setSelectedText(sel.toString().trim());
    } else {
      setSelectedText("");
    }
  };

  return (
    <article
      id="prologue"
      className="relative max-w-[720px] mx-auto px-6 md:px-8 pb-16 md:pb-24"
      style={{ color: "var(--wk-text)" }}
      onMouseUp={handleSelection}
    >
      {/* Selection toolbar */}
      {selectedText && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-3 py-2 rounded-lg shadow-lg" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-divider)" }}>
          <span className="text-[12px] mr-2 max-w-[160px] truncate" style={{ color: "var(--wk-text-muted)" }}>
            {selectedText.length > 20 ? `${selectedText.slice(0, 20)}...` : selectedText}
          </span>
          <button
            type="button"
            onClick={() => setSelectedText("")}
            className="px-2 py-1 text-[11px] font-medium rounded"
            style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }}
          >
            Highlight
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(selectedText);
              setSelectedText("");
            }}
            className="px-2 py-1 text-[11px] font-medium rounded"
            style={{ background: "var(--wk-surface-strong)", color: "var(--wk-text)" }}
          >
            Copy
          </button>
        </div>
      )}

      {/* Prologue */}
      <ChapterHead
        label={prologueChapter.label}
        num={prologueChapter.num}
        title={prologueChapter.title}
        epigraph={prologueChapter.epigraph}
      />

      <div className="space-y-1">
        {prologueChapter.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} isDropCap={p.isDropCap} fontSize={fontSize} />
        ))}
      </div>

      <PullQuote text={prologueChapter.pullQuote} fontSize={fontSize} />

      {/* Section I */}
      <SectionTitle id={classroomLibrary.id} num={classroomLibrary.num} title={classroomLibrary.title} />

      <div className="space-y-1">
        {classroomLibrary.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      {/* Section II */}
      <SectionTitle id={homeEcosystem.id} num={homeEcosystem.num} title={homeEcosystem.title} />

      <div className="space-y-1">
        {homeEcosystem.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      <Aside kicker={homeEcosystem.aside.kicker} title={homeEcosystem.aside.title} body={homeEcosystem.aside.body} />

      <div className="space-y-1">
        {homeEcosystem.paragraphsAfter.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      <PullQuote text={homeEcosystem.pullQuote} fontSize={fontSize} />

      <div className="space-y-1">
        {homeEcosystem.paragraphsAfterPull.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      {/* Section III */}
      <SectionTitle id={readingInfrastructure.id} num={readingInfrastructure.num} title={readingInfrastructure.title} />

      <div className="space-y-1">
        {readingInfrastructure.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      <ListBurst items={readingInfrastructure.listBurst} />

      <div className="space-y-1">
        {readingInfrastructure.paragraphsAfter.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      {/* Section IV */}
      <SectionTitle id={smartphoneShift.id} num={smartphoneShift.num} title={smartphoneShift.title} />

      <div className="space-y-1">
        {smartphoneShift.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      {/* Section V */}
      <SectionTitle id={theReturn.id} num={theReturn.num} title={theReturn.title} />

      <div className="space-y-1">
        {theReturn.paragraphs.map((p, i) => (
          <ProseParagraph key={i} html={p.html} fontSize={fontSize} />
        ))}
      </div>

      <PullQuote text={theReturn.pullQuote} fontSize={fontSize} />

      {/* Section VI */}
      <SectionTitle id={largerQuestion.id} num={largerQuestion.num} title={largerQuestion.title} />

      <div className="space-y-1">
        {largerQuestion.paragraphs.map((p, i) => (
          <ProseParagraph
            key={i}
            html={p.html}
            fontSize={fontSize}
          />
        ))}
      </div>

      {/* End ornament */}
      <div className="mt-14 md:mt-20 text-center text-[20px] tracking-widest" style={{ color: "var(--wk-text-muted)" }} aria-hidden="true">
        · · ·
      </div>
    </article>
  );
}