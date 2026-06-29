import type { ReactNode } from "react";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_#[\]()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      const href = match[3];
      const isExternal = /^https?:\/\//.test(href);

      nodes.push(
        <a
          key={`${match.index}-link`}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className="font-bold text-[var(--wk-brand)] underline decoration-[var(--wk-brand)]/30 underline-offset-4 transition hover:decoration-[var(--wk-brand)]"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-black text-[var(--wk-text)]">
          {match[4]}
        </strong>,
      );
    } else if (match[5]) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] px-1.5 py-0.5 text-[0.9em] text-[var(--wk-text)]"
        >
          {match[5]}
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
        <p key={`p-${nodes.length}`} className="text-[16px] leading-8 text-[var(--wk-text-muted)]">
          {renderInline(text)}
        </p>,
      );
    }

    paragraph = [];
  };

  const flushUnorderedList = () => {
    if (!unorderedList.length) return;

    nodes.push(
      <ul
        key={`ul-${nodes.length}`}
        className="space-y-2 rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-5 text-[15px] leading-7 text-[var(--wk-text-muted)]"
      >
        {unorderedList.map((item, index) => (
          <li key={`${item}-${index}`} className="relative pl-5">
            <span className="absolute left-0 top-[0.78em] h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)]" />
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );

    unorderedList = [];
  };

  const flushOrderedList = () => {
    if (!orderedList.length) return;

    nodes.push(
      <ol
        key={`ol-${nodes.length}`}
        className="space-y-3 rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-5 text-[15px] leading-7 text-[var(--wk-text-muted)]"
      >
        {orderedList.map((item, index) => (
          <li key={`${item}-${index}`} className="grid grid-cols-[28px_1fr] gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[11px] font-black text-[var(--wk-brand)]">
              {index + 1}
            </span>
            <span>{renderInline(item)}</span>
          </li>
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

    if (trimmed === "---" || trimmed === "***") {
      flushAll();
      nodes.push(
        <hr key={`hr-${index}`} className="my-10 border-0 border-t border-[var(--wk-border)]" />,
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      flushAll();
      const text = trimmed.replace(/^#\s+/, "");
      nodes.push(
        <h2
          key={`h1-${index}`}
          id={slugify(text)}
          className="scroll-mt-24 pt-8 text-[clamp(30px,5vw,54px)] font-black leading-[1] tracking-[-0.06em] text-[var(--wk-text)]"
        >
          {renderInline(text)}
        </h2>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushAll();
      const text = trimmed.replace(/^##\s+/, "");
      nodes.push(
        <h3
          key={`h2-${index}`}
          id={slugify(text)}
          className="scroll-mt-24 pt-8 text-[26px] font-black leading-tight tracking-[-0.04em] text-[var(--wk-text)]"
        >
          {renderInline(text)}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushAll();
      const text = trimmed.replace(/^###\s+/, "");
      nodes.push(
        <h4
          key={`h3-${index}`}
          id={slugify(text)}
          className="scroll-mt-24 pt-5 text-[19px] font-black tracking-[-0.02em] text-[var(--wk-text)]"
        >
          {renderInline(text)}
        </h4>,
      );
      return;
    }

    if (trimmed.startsWith(">")) {
      flushAll();
      nodes.push(
        <blockquote
          key={`quote-${index}`}
          className="rounded-[28px] border-l-4 border-[var(--wk-brand)] bg-[var(--wk-surface)] px-6 py-5 text-[18px] font-semibold leading-8 text-[var(--wk-text)]"
        >
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

  return <div className="space-y-6">{nodes}</div>;
}
