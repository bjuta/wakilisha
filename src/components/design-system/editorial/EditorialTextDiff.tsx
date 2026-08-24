import { useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export interface EditorialTextDiffSegment {
  type: "equal" | "added" | "removed";
  text: string;
}

export function buildEditorialTextDiff(
  previousText: string,
  nextText: string,
): EditorialTextDiffSegment[] {
  if (previousText === nextText) return [];

  const previousWords = previousText.split(/(\s+)/);
  const nextWords = nextText.split(/(\s+)/);
  const previousLength = previousWords.length;
  const nextLength = nextWords.length;
  const matrix: number[][] = Array.from(
    { length: previousLength + 1 },
    () => Array(nextLength + 1).fill(0),
  );

  for (let previousIndex = 1; previousIndex <= previousLength; previousIndex += 1) {
    for (let nextIndex = 1; nextIndex <= nextLength; nextIndex += 1) {
      if (previousWords[previousIndex - 1] === nextWords[nextIndex - 1]) {
        matrix[previousIndex][nextIndex] =
          matrix[previousIndex - 1][nextIndex - 1] + 1;
      } else {
        matrix[previousIndex][nextIndex] = Math.max(
          matrix[previousIndex - 1][nextIndex],
          matrix[previousIndex][nextIndex - 1],
        );
      }
    }
  }

  const backtrack: Array<{
    type: EditorialTextDiffSegment["type"];
    word: string;
  }> = [];
  let previousIndex = previousLength;
  let nextIndex = nextLength;

  while (previousIndex > 0 || nextIndex > 0) {
    if (
      previousIndex > 0 &&
      nextIndex > 0 &&
      previousWords[previousIndex - 1] === nextWords[nextIndex - 1]
    ) {
      backtrack.unshift({
        type: "equal",
        word: previousWords[previousIndex - 1],
      });
      previousIndex -= 1;
      nextIndex -= 1;
    } else if (
      nextIndex > 0 &&
      (
        previousIndex === 0 ||
        matrix[previousIndex][nextIndex - 1] >=
          matrix[previousIndex - 1][nextIndex]
      )
    ) {
      backtrack.unshift({
        type: "added",
        word: nextWords[nextIndex - 1],
      });
      nextIndex -= 1;
    } else {
      backtrack.unshift({
        type: "removed",
        word: previousWords[previousIndex - 1],
      });
      previousIndex -= 1;
    }
  }

  return backtrack.reduce<EditorialTextDiffSegment[]>((segments, item) => {
    const previous = segments[segments.length - 1];
    if (previous?.type === item.type) {
      previous.text += item.word;
    } else {
      segments.push({ type: item.type, text: item.word });
    }
    return segments;
  }, []);
}

function changedWordCount(
  segments: EditorialTextDiffSegment[],
  type: "added" | "removed",
): number {
  return segments
    .filter((segment) => segment.type === type)
    .reduce(
      (total, segment) =>
        total + segment.text.split(/\s+/).filter(Boolean).length,
      0,
    );
}

export function EditorialTextDiff({
  previousText,
  nextText,
  previousLabel = "Original",
  nextLabel = "Revision",
  emptyLabel = "No text changes.",
  className = "",
}: {
  previousText: string;
  nextText: string;
  previousLabel?: string;
  nextLabel?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const segments = useMemo(
    () => buildEditorialTextDiff(previousText, nextText),
    [nextText, previousText],
  );
  const addedWords = useMemo(
    () => changedWordCount(segments, "added"),
    [segments],
  );
  const removedWords = useMemo(
    () => changedWordCount(segments, "removed"),
    [segments],
  );

  if (!segments.length) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs text-wk-text-muted ${className}`.trim()}>
        <WkIcon name="CheckCircle2" size={14} className="text-wk-success" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <WkSurface className={`overflow-hidden border-wk-brand/30 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-wk-border bg-wk-bg-subtle px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-semibold text-wk-danger">{previousLabel}</span>
          <span className="text-wk-text-faint">vs</span>
          <span className="font-semibold text-wk-success">{nextLabel}</span>
        </div>
        <span className="text-[10px] text-wk-text-faint">
          {addedWords > 0 ? (
            <span className="text-wk-success">+{addedWords} words </span>
          ) : null}
          {removedWords > 0 ? (
            <span className="text-wk-danger">-{removedWords} words</span>
          ) : null}
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto p-4">
        <div className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
          {segments.map((segment, index) => (
            <span
              key={`${segment.type}-${index}`}
              className={
                segment.type === "added"
                  ? "bg-wk-success-soft text-wk-success"
                  : segment.type === "removed"
                    ? "bg-wk-danger-soft text-wk-danger line-through"
                    : "text-wk-text-soft"
              }
            >
              {segment.text}
            </span>
          ))}
        </div>
      </div>
    </WkSurface>
  );
}
