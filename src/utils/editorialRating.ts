import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";
import { canonicalRating } from "@/components/admin/editor/RatingNode";

export interface PublishedReviewVerdict {
  value: number;
  subject: string;
}

/**
 * Only the explicitly authored verdict is syndicated.
 * Inline, block and breakdown scores remain editorial text only.
 * A reviewed work's name must be provided; never invent a Review target.
 */
export function extractPublishedReviewVerdict(contentHtml: string): PublishedReviewVerdict | null {
  const tags = contentHtml.match(/<span\b[^>]*\bdata-wk-rating(?:\s|=|>)[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => {
    const pattern = new RegExp("\\b" + name + '="([^"]*)"');
    return pattern.exec(tag)?.[1] ?? "";
  };
  let result: PublishedReviewVerdict | null = null;
  for (const tag of tags) {
    if (attr(tag, "data-wk-rating-role") !== "verdict") continue;
    const score = canonicalRating(attr(tag, "data-wk-rating-value"));
    const subject = decodeHtmlEntities(attr(tag, "data-wk-rating-subject")).trim();
    if (score === null || !subject) continue;
    result = { value: score, subject: subject.slice(0, 160) };
  }
  return result;
}
