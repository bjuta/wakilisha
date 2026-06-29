export function cleanText(value?: string | null): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function hasText(value?: string | null): boolean {
  return cleanText(value).length > 0;
}

export function uniqueClean(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach((value) => {
    const clean = cleanText(value);

    if (!clean) return;

    const key = clean.toLowerCase();

    if (seen.has(key)) return;

    seen.add(key);
    output.push(clean);
  });

  return output;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function humanCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}

export function joinHumanList(items: string[], limit = 3): string {
  const visible = items.slice(0, limit);

  if (visible.length === 0) return "";
  if (visible.length === 1) return visible[0] || "";
  if (visible.length === 2) return `${visible[0]} and ${visible[1]}`;

  const last = visible[visible.length - 1];
  const rest = visible.slice(0, -1);

  return `${rest.join(", ")}, and ${last}`;
}

export function sentenceFromParts(parts: Array<string | null | undefined>): string {
  const clean = parts.map(cleanText).filter(Boolean);

  if (!clean.length) return "";

  const sentence = clean.join(" ");

  return sentence.endsWith(".") || sentence.endsWith("?") || sentence.endsWith("!")
    ? sentence
    : `${sentence}.`;
}

export function clampText(value: string, maxLength = 220): string {
  const clean = cleanText(value);

  if (clean.length <= maxLength) return clean;

  return `${clean.slice(0, maxLength - 3).replace(/[\s,.;:!?-]+$/, "")}...`;
}
