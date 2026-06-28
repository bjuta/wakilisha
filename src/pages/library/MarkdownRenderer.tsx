import type { ReactNode } from "react";

function renderInline(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-black text-[var(--wk-text)]">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] px-1.5 py-0.5 text-[0.9em]"
        >
          {match[3]}
        </code>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

export function MarkdownRenderer({ body }: { body: string }) {
  const lines = body.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let unorderedList: string[] = [];
  let orderedList: string[] = [];
  let codeBlock: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      nodes.push(
        <p key={`p-${nodes.length}`} className="text-[15px] leading-8 text-[var(--wk-text-muted)]">
          {renderInline(text)}
        </p>,
      );
    }
    paragraph = [];
  };

  const flushUnorderedList = () => {
    if (!unorderedList.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="space-y-2 pl-5 text-[15px] leading-7 text-[var(--wk-text-muted)] list-disc">
        {unorderedList.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    unorderedList = [];
  };

  const flushOrderedList = () => {
    if (!orderedList.length) return;
    nodes.push(
      <ol key={`ol-${nodes.length}`} className="space-y-2 pl-5 text-[15px] leading-7 text-[var(--wk-text-muted)] list-decimal">
        {orderedList.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
      </ol>,
    );
    orderedList = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushUnorderedList();
    flushOrderedList();
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (codeBlock) {
        nodes.push(
          <pre
            key={`code-${nodes.length}`}
            className="overflow-x-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 text-[13px] leading-6 text-[var(--wk-text)]"
          >
            <code>{codeBlock.join("\n")}</code>
          </pre>,
        );
        codeBlock = null;
      } else {
        flushAll();
        codeBlock = [];
      }
      return;
    }

    if (codeBlock) {
      codeBlock.push(line);
      return;
    }

    if (!trimmed) {
      flushAll();
      return;
    }

    if (trimmed.startsWith("# ")) {
      flushAll();
      nodes.push(
        <h2 key={`h1-${index}`} className="pt-6 text-[clamp(28px,4vw,46px)] font-black tracking-[-0.05em] text-[var(--wk-text)]">
          {renderInline(trimmed.replace(/^#\s+/, ""))}
        </h2>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushAll();
      nodes.push(
        <h3 key={`h2-${index}`} className="pt-6 text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
          {renderInline(trimmed.replace(/^##\s+/, ""))}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushAll();
      nodes.push(
        <h4 key={`h3-${index}`} className="pt-4 text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
          {renderInline(trimmed.replace(/^###\s+/, ""))}
        </h4>,
      );
      return;
    }

    if (trimmed.startsWith(">")) {
      flushAll();
      nodes.push(
        <blockquote key={`quote-${index}`} className="rounded-2xl border-l-4 border-[var(--wk-brand)] bg-[var(--wk-surface)] px-5 py-4 text-[17px] font-semibold leading-8 text-[var(--wk-text)]">
          {renderInline(trimmed.replace(/^>\s?/, ""))}
        </blockquote>,
      );
      return;
    }

    const unordered = trimmed.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      flushParagraph();
      flushOrderedList();
      unorderedList.push(unordered[1] || "");
      return;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      flushUnorderedList();
      orderedList.push(ordered[1] || "");
      return;
    }

    paragraph.push(trimmed);
  });

  flushAll();

  return <div className="space-y-5">{nodes}</div>;
}
