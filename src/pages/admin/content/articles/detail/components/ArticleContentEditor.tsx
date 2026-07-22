import {
  type KeyboardEvent,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { RichTextEditor } from "@/components/design-system/editorial/RichTextEditor";

interface Props {
  title: string;
  excerpt: string;
  content: string;
  onTitleChange: (v: string) => void;
  onExcerptChange: (v: string) => void;
  onContentChange: (v: string) => void;
  readOnly?: boolean;
  onSaveDraft?: () => void | Promise<void>;
  onPreviewArticle?: () => void | Promise<void>;
  onOpenArticleDetails?: () => void;
  onCloseArticle?: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

interface TextMatch {
  node: Text;
  start: number;
  end: number;
}

function plainTextFromHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [ref, value]);
}

function collectTextMatches(
  root: ParentNode,
  findText: string,
): TextMatch[] {
  if (!findText) return [];

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );

  const matches: TextMatch[] = [];
  let node = walker.nextNode();

  while (node) {
    const text = node.nodeValue || "";
    let searchFrom = 0;

    while (searchFrom <= text.length) {
      const start = text.indexOf(findText, searchFrom);

      if (start === -1) break;

      matches.push({
        node: node as Text,
        start,
        end: start + findText.length,
      });

      searchFrom = start + Math.max(findText.length, 1);
    }

    node = walker.nextNode();
  }

  return matches;
}

function editorTextMatches(findText: string): TextMatch[] {
  const editor = document.querySelector(
    "[data-article-editor-canvas] .ProseMirror",
  );

  if (!editor) return [];

  return collectTextMatches(editor, findText);
}

function selectEditorMatch(
  findText: string,
  requestedIndex: number,
): { index: number; count: number } | null {
  const matches = editorTextMatches(findText);

  if (matches.length === 0) return null;

  const index =
    ((requestedIndex % matches.length) + matches.length) %
    matches.length;

  const match = matches[index];
  const range = document.createRange();

  range.setStart(match.node, match.start);
  range.setEnd(match.node, match.end);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  match.node.parentElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  return {
    index,
    count: matches.length,
  };
}

function replaceHtmlMatch(
  html: string,
  findText: string,
  replacement: string,
  targetIndex: number | null,
): {
  html: string;
  count: number;
  replaced: number;
} {
  if (
    !html ||
    !findText ||
    typeof document === "undefined"
  ) {
    return {
      html,
      count: 0,
      replaced: 0,
    };
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const matches = collectTextMatches(
    template.content,
    findText,
  );

  if (matches.length === 0) {
    return {
      html,
      count: 0,
      replaced: 0,
    };
  }

  if (targetIndex !== null) {
    const index =
      ((targetIndex % matches.length) + matches.length) %
      matches.length;

    const match = matches[index];
    const text = match.node.nodeValue || "";

    match.node.nodeValue =
      text.slice(0, match.start) +
      replacement +
      text.slice(match.end);

    return {
      html: template.innerHTML,
      count: matches.length,
      replaced: 1,
    };
  }

  const matchesByNode = new Map<Text, TextMatch[]>();

  for (const match of matches) {
    const existing = matchesByNode.get(match.node) || [];
    existing.push(match);
    matchesByNode.set(match.node, existing);
  }

  for (const [node, nodeMatches] of matchesByNode) {
    let text = node.nodeValue || "";

    for (const match of [...nodeMatches].reverse()) {
      text =
        text.slice(0, match.start) +
        replacement +
        text.slice(match.end);
    }

    node.nodeValue = text;
  }

  return {
    html: template.innerHTML,
    count: matches.length,
    replaced: matches.length,
  };
}

export function ArticleContentEditor({
  title,
  excerpt,
  content,
  onTitleChange,
  onExcerptChange,
  onContentChange,
  readOnly = false,
  onSaveDraft,
  onPreviewArticle,
  onOpenArticleDetails,
  onCloseArticle,
  focusMode = false,
  onToggleFocusMode,
}: Props) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const writingStatsRef = useRef<HTMLDivElement>(null);

  const [showFindReplace, setShowFindReplace] =
    useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);
  const [matchCount, setMatchCount] = useState(0);
  const [replaceStatus, setReplaceStatus] =
    useState<string | null>(null);

  useAutosizeTextarea(titleRef, title);
  useAutosizeTextarea(summaryRef, excerpt);

  const plainText = plainTextFromHtml(content);
  const wordCount = plainText
    ? plainText.split(/\s+/).length
    : 0;
  const charCount = plainText.length;
  const readingMinutes = Math.max(
    1,
    Math.ceil(wordCount / 220),
  );

  function clearEditorTextSelection() {
    const editor = document.querySelector(
      "[data-article-editor-canvas] .ProseMirror",
    );
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;

    if (
      editor &&
      selection &&
      anchorNode &&
      editor.contains(anchorNode)
    ) {
      selection.removeAllRanges();
    }
  }

  function resetFindState({
    clearSelection = false,
  }: {
    clearSelection?: boolean;
  } = {}) {
    setMatchIndex(-1);
    setMatchCount(0);
    setReplaceStatus(null);

    if (clearSelection) {
      clearEditorTextSelection();
    }
  }

  function handleFindVisibilityChange() {
    setShowFindReplace((current) => {
      const next = !current;

      if (!next) {
        clearEditorTextSelection();
      }

      return next;
    });

    setMatchIndex(-1);
    setMatchCount(0);
    setReplaceStatus(null);
  }

  function openFindReplace() {
    setShowFindReplace(true);
    setMatchIndex(-1);
    setMatchCount(0);
    setReplaceStatus(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      });
    });
  }

  function showWritingStats() {
    writingStatsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }


  function handleTitleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    summaryRef.current?.focus();
  }

  function moveToMatch(direction: 1 | -1) {
    if (!findText) {
      setReplaceStatus("Enter text to find.");
      return;
    }

    const requestedIndex =
      matchIndex === -1
        ? direction === 1
          ? 0
          : -1
        : matchIndex + direction;

    const result = selectEditorMatch(
      findText,
      requestedIndex,
    );

    if (!result) {
      setMatchIndex(-1);
      setMatchCount(0);
      setReplaceStatus("No matches found.");
      return;
    }

    setMatchIndex(result.index);
    setMatchCount(result.count);
    setReplaceStatus(
      `${result.index + 1} of ${result.count} ${
        result.count === 1 ? "match" : "matches"
      }.`,
    );
  }

  function handleReplaceCurrent() {
    if (!findText || readOnly) return;

    const currentIndex = matchIndex >= 0 ? matchIndex : 0;

    const result = replaceHtmlMatch(
      content,
      findText,
      replaceText,
      currentIndex,
    );

    if (result.replaced === 0) {
      setMatchIndex(-1);
      setMatchCount(0);
      setReplaceStatus("No matches found.");
      return;
    }

    onContentChange(result.html);
    setMatchIndex(-1);
    setMatchCount(Math.max(0, result.count - 1));
    setReplaceStatus(
      "Current match replaced. Choose Next to continue.",
    );
  }

  function handleReplaceAll() {
    if (!findText || readOnly) return;

    const result = replaceHtmlMatch(
      content,
      findText,
      replaceText,
      null,
    );

    if (result.replaced === 0) {
      setMatchIndex(-1);
      setMatchCount(0);
      setReplaceStatus("No matches found.");
      return;
    }

    onContentChange(result.html);
    setMatchIndex(-1);
    setMatchCount(0);
    setReplaceStatus(
      `${result.replaced} ${
        result.replaced === 1 ? "match" : "matches"
      } replaced.`,
    );
  }

  function handleFindKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      setShowFindReplace(false);
      resetFindState({
        clearSelection: true,
      });
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    moveToMatch(event.shiftKey ? -1 : 1);
  }

  return (
    <WkSurface
      data-article-editor-canvas
      className="overflow-hidden"
    >
      <div className="border-b border-wk-border px-5 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[820px]">
          <label
            htmlFor="article-title"
            className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint"
          >
            Article Title
          </label>

          <textarea
            ref={titleRef}
            id="article-title"
            value={title}
            onChange={(event) =>
              onTitleChange(event.target.value)
            }
            onKeyDown={handleTitleKeyDown}
            disabled={readOnly}
            rows={1}
            placeholder="Article title"
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[26px] font-black leading-tight tracking-tight text-wk-text outline-none placeholder:text-wk-text-faint disabled:cursor-not-allowed disabled:opacity-70 sm:text-[32px]"
            style={{
              overflowWrap: "anywhere",
            }}
          />

          <label
            htmlFor="article-summary"
            className="mb-2 mt-6 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint"
          >
            Summary
          </label>

          <textarea
            ref={summaryRef}
            id="article-summary"
            value={excerpt}
            onChange={(event) =>
              onExcerptChange(event.target.value)
            }
            disabled={readOnly}
            rows={1}
            placeholder="A clear summary for readers, listings, and search."
            maxLength={500}
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-6 text-wk-text-muted outline-none placeholder:text-wk-text-faint disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-wk-border pt-4">
            <div
              ref={writingStatsRef}
              data-writing-stats
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-wk-text-faint"
            >
              <span>
                {wordCount.toLocaleString()} words
              </span>

              <span>{readingMinutes} min read</span>

              <span>
                {charCount.toLocaleString()} characters
              </span>

              <span>
                {excerpt.length} / 500 summary characters
              </span>
            </div>

            {!readOnly ? (
              <button
                type="button"
                onClick={handleFindVisibilityChange}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text"
              >
                <WkIcon
                  name={
                    showFindReplace ? "X" : "Search"
                  }
                  size={13}
                />

                {showFindReplace
                  ? "Close Find"
                  : "Find and Replace"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showFindReplace && !readOnly ? (
        <div className="border-b border-wk-border bg-wk-bg-subtle px-5 py-4 sm:px-8">
          <div className="mx-auto max-w-[820px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">
                  Find
                </span>

                <input
                  ref={findInputRef}
                  type="text"
                  value={findText}
                  onChange={(event) => {
                    setFindText(event.target.value);
                    setMatchIndex(-1);
                    setMatchCount(0);
                    setReplaceStatus(null);
                  }}
                  onKeyDown={handleFindKeyDown}
                  placeholder="Find text"
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">
                  Replace
                </span>

                <input
                  type="text"
                  value={replaceText}
                  onChange={(event) => {
                    setReplaceText(event.target.value);
                    setReplaceStatus(null);
                  }}
                  placeholder="Replace with"
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => moveToMatch(-1)}
                disabled={!findText}
                className="wk-button wk-button-ghost wk-button-sm"
              >
                <WkIcon name="ChevronUp" size={13} />
                Previous
              </button>

              <button
                type="button"
                onClick={() => moveToMatch(1)}
                disabled={!findText}
                className="wk-button wk-button-ghost wk-button-sm"
              >
                <WkIcon name="ChevronDown" size={13} />
                Next
              </button>

              <button
                type="button"
                onClick={handleReplaceCurrent}
                disabled={!findText}
                className="wk-button wk-button-secondary wk-button-sm"
              >
                Replace
              </button>

              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={!findText}
                className="wk-button wk-button-secondary wk-button-sm"
              >
                Replace All
              </button>

              {matchCount > 0 ? (
                <span className="ml-auto text-[10px] font-bold text-wk-text-faint">
                  {matchIndex >= 0 ? matchIndex + 1 : 0} /{" "}
                  {matchCount}
                </span>
              ) : null}
            </div>

            <div
              aria-live="polite"
              className="mt-2 min-h-4 text-[10px] font-semibold text-wk-text-faint"
            >
              {replaceStatus}
            </div>
          </div>
        </div>
      ) : null}

      <RichTextEditor
        value={content}
        onChange={onContentChange}
        placeholder="Start writing your Article."
        minHeight={620}
        readOnly={readOnly}
        onSaveDraft={onSaveDraft}
        onPreviewArticle={onPreviewArticle}
        onOpenArticleDetails={onOpenArticleDetails}
        onCloseArticle={onCloseArticle}
        onOpenFindReplace={openFindReplace}
        onShowWritingStats={showWritingStats}
        focusMode={focusMode}
        onToggleFocusMode={onToggleFocusMode}
        wordCount={wordCount}
        readingMinutes={readingMinutes}
      />
    </WkSurface>
  );
}
