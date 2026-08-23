export interface TimedTextLine {
  id: string;
  text: string;
  startSeconds: number | null;
}

export interface TimedTextDocument {
  lines: TimedTextLine[];
  plainText: string;
}

function parseClock(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);

  if (
    parts.some((part) => !Number.isFinite(part)) ||
    parts.length < 2 ||
    parts.length > 3
  ) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function parseTimedText(
  input: string,
): TimedTextDocument {
  const raw = input.replace(/\r/g, "");
  const blocks = raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const lines: TimedTextLine[] = [];

  for (const block of blocks) {
    const blockLines = block.split("\n");
    const timingIndex = blockLines.findIndex(
      (line) => line.includes("-->"),
    );

    if (timingIndex >= 0) {
      const start = parseClock(
        blockLines[timingIndex].split("-->")[0] ?? "",
      );
      const text = blockLines
        .slice(timingIndex + 1)
        .join(" ")
        .trim();

      if (text) {
        lines.push({
          id: `cue-${lines.length + 1}`,
          text,
          startSeconds: start,
        });
      }
      continue;
    }

    for (const line of blockLines) {
      const text = line.trim();
      if (!text || text === "WEBVTT" || /^\d+$/.test(text)) {
        continue;
      }

      lines.push({
        id: `line-${lines.length + 1}`,
        text,
        startSeconds: null,
      });
    }
  }

  if (!lines.length && raw.trim()) {
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((text, index) => {
        lines.push({
          id: `line-${index + 1}`,
          text,
          startSeconds: null,
        });
      });
  }

  return {
    lines,
    plainText: lines.map((line) => line.text).join("\n"),
  };
}

export async function fetchTimedTextDocument(
  url: string,
): Promise<TimedTextDocument> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Transcript could not be opened (${response.status}).`,
    );
  }

  return parseTimedText(await response.text());
}
