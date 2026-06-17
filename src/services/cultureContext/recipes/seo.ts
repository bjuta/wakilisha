import type { CultureContextOutput } from "../types";

const MAX_META_DESCRIPTION_LENGTH = 160;

export function trimSeoDescription(output: CultureContextOutput): CultureContextOutput {
  if (output.text.length <= MAX_META_DESCRIPTION_LENGTH) return output;

  const trimmed = output.text.slice(0, MAX_META_DESCRIPTION_LENGTH - 1).trimEnd();
  const safeTrimmed = trimmed.replace(/[,.]\s*$/, "");

  return {
    ...output,
    text: `${safeTrimmed}.`,
    warnings: [...output.warnings, "SEO description was trimmed to fit the target length."],
  };
}
