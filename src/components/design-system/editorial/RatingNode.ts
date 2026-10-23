import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";

/** Workbook (3), Chapter 24: locally rendered, portable rating document atom. */
export type RatingRole = "inline" | "block" | "breakdown" | "verdict";
export type RatingDisplay = "both" | "stars" | "number";
export type RatingPart = { label: string; value: number };
export interface RatingAttrs {
  value: number;
  role: RatingRole;
  display: RatingDisplay;
  label: string;
  breakdown: RatingPart[];
}

export const WK_STAR_PATH =
  "M12 2.4c.3 0 .55.17.69.45l2.74 5.58 6.16.9c.65.09.91.89.44 1.35l-4.46 4.36 1.05 6.15c.11.66-.59 1.15-1.17.84L12 19.14l-5.45 2.89c-.58.31-1.28-.18-1.17-.84l1.05-6.15-4.46-4.36c-.47-.46-.21-1.26.44-1.35l6.16-.9 2.74-5.58c.14-.28.39-.45.69-.45Z";

export function canonicalRating(value: unknown): number | null {
  const v = typeof value === "number" ? value : Number(value);
  return Number.isFinite(v) && v >= 1 && v <= 5 && v * 2 === Math.round(v * 2)
    ? v : null;
}

export function ratingParts(value: unknown): RatingPart[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const entry = row as Record<string, unknown>;
    const valid = canonicalRating(entry.value);
    const label = typeof entry.label === "string" ? entry.label.trim().slice(0, 80) : "";
    return valid !== null && label ? [{ label, value: valid }] : [];
  });
}

function stars(value: number): DOMOutputSpec {
  return ["span", { class: "wk-rating-stars", "aria-hidden": "true" },
    ...Array.from({ length: 5 }, (_, index): DOMOutputSpec => {
      const fill = Math.max(0, Math.min(1, value - index)) * 100;
      const shape: DOMOutputSpec = ["svg", { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", focusable: "false" },
        ["path", { d: WK_STAR_PATH, fill: "currentColor" }]];
      return ["span", { class: "wk-rating-star" },
        ["span", { class: "wk-rating-star-empty" }, shape],
        ["span", { class: "wk-rating-star-filled", style: "width:" + fill + "%" }, shape]];
    }),
  ];
}

function label(value: number, display: RatingDisplay): DOMOutputSpec {
  return ["span", { class: "wk-rating-number" },
    ...(display === "stars" ? [] : [value.toFixed(1)])];
}

export function ratingHtml(attrs: RatingAttrs): DOMOutputSpec {
  const score = canonicalRating(attrs.value) ?? 3.5;
  const role: RatingRole = ["inline", "block", "breakdown", "verdict"].includes(attrs.role) ? attrs.role : "inline";
  const display: RatingDisplay = ["both", "stars", "number"].includes(attrs.display) ? attrs.display : "both";
  const text = attrs.label.trim().slice(0, 160);
  const parts = ratingParts(attrs.breakdown);
  return ["span", {
    "data-wk-rating": "",
    "data-wk-rating-value": score.toFixed(1),
    "data-wk-rating-role": role,
    "data-wk-rating-display": display,
    "data-wk-rating-label": text,
    "data-wk-rating-breakdown": JSON.stringify(parts),
    class: "wk-rating wk-rating--" + role + " wk-rating--" + display,
    role: "img",
    "aria-label": (text ? text + ": " : "") + "Rated " + score.toFixed(1) + " out of 5",
    contenteditable: "false",
  },
    ...(role === "verdict" || role === "breakdown"
      ? [["span", { class: "wk-rating-heading" }, "Verdict"] as DOMOutputSpec] : []),
    ...(display !== "number" ? [stars(score)] : []),
    label(score, display),
    ...(role === "verdict" || role === "breakdown"
      ? [["span", { class: "wk-rating-out-of" }, "/5"] as DOMOutputSpec] : []),
    ...(text ? [["span", { class: "wk-rating-caption" }, text] as DOMOutputSpec] : []),
    ...(role === "breakdown" && parts.length ? [
      ["span", { class: "wk-rating-breakdown" },
        ...parts.map((part): DOMOutputSpec => ["span", { class: "wk-rating-breakdown-row" },
          ["span", {}, part.label], stars(part.value),
          ["span", { class: "wk-rating-breakdown-score" }, part.value.toFixed(1)]])] as DOMOutputSpec
    ] : []),
  ];
}

export const RatingNode = Node.create({
  name: "wkRating",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      value: { default: 3.5, parseHTML: (el: HTMLElement) => canonicalRating(el.getAttribute("data-wk-rating-value")) ?? 3.5 },
      role: { default: "inline", parseHTML: (el: HTMLElement) => el.getAttribute("data-wk-rating-role") || "inline" },
      display: { default: "both", parseHTML: (el: HTMLElement) => el.getAttribute("data-wk-rating-display") || "both" },
      label: { default: "", parseHTML: (el: HTMLElement) => el.getAttribute("data-wk-rating-label") || "" },
      breakdown: { default: [], parseHTML: (el: HTMLElement) => {
        try { return ratingParts(JSON.parse(el.getAttribute("data-wk-rating-breakdown") || "[]")); }
        catch { return []; }
      } },
    };
  },
  parseHTML() { return [{ tag: "span[data-wk-rating]" }]; },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as RatingAttrs;
    const markup = ratingHtml(attrs) as [string, Record<string, unknown>, ...DOMOutputSpec[]];
    return [markup[0], mergeAttributes(HTMLAttributes, markup[1]), ...markup.slice(2)] as DOMOutputSpec;
  },
});
