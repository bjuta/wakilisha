import type { CultureContextOutput } from "../types";

export function markAdminOutput(output: CultureContextOutput): CultureContextOutput {
  return {
    ...output,
    warnings: output.text ? output.warnings : [...output.warnings, "Admin context produced no text."],
  };
}
