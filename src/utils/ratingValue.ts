/** Workbook Chapter 24 numeric rating authority: do not import the editor in public renderers. */
export function canonicalRating(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const v = typeof value === "number" ? value : Number(/^[1-5],[05]$/.test(value.trim()) ? value.replace(",", ".") : value);
  return Number.isFinite(v) && v >= 1 && v <= 5 && v * 2 === Math.round(v * 2)
    ? v : null;
}
