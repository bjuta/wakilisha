/**
 * Shared Article Content Pipeline
 *
 * Single source of truth for all article content transformations.
 * Used by admin editor, admin preview, public article page, and the API.
 * Every code path that touches article content MUST go through this module.
 *
 * Pipeline order: sanitize → decode entities → embed media
 */

import { sanitizeVcShortcodes } from "@/utils/sanitizeVcShortcodes";
import { embedRichMedia } from "@/utils/embedRichMedia";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";
import { generateExcerpt as generateExcerptUtil } from "@/utils/generateExcerpt";
import { transformReleaseShortcodes, stripReleaseShortcodes } from "@/utils/transformReleaseShortcodes";
import { transformArtistShortcodes, stripArtistShortcodes } from "@/utils/transformArtistShortcodes";
import { transformTrackShortcodes, stripTrackShortcodes } from "@/utils/transformTrackShortcodes";

/**
 * Full content processing pipeline for article body HTML.
 * Applies: WP shortcode sanitization → entity decode → rich media embedding.
 */
export function processArticleContent(rawHtml: string | null | undefined): string {
  if (!rawHtml) return "";
  let html = rawHtml;
  html = sanitizeVcShortcodes(html);
  html = decodeHtmlEntities(html);
  html = transformReleaseShortcodes(html);
  html = transformArtistShortcodes(html);
  html = transformTrackShortcodes(html);
  html = embedRichMedia(html);
  return html;
}

/**
 * Light content processing for admin editor display.
 * Skips embedRichMedia so embedded players don't clutter the editing UI.
 * Applies: WP shortcode sanitization → entity decode.
 */
export function processArticleContentForEditor(rawHtml: string | null | undefined): string {
  if (!rawHtml) return "";
  let html = rawHtml;
  html = sanitizeVcShortcodes(html);
  html = decodeHtmlEntities(html);
  return html;
}

/**
 * Decode HTML entities in a text field (title, excerpt, author name).
 */
export function processText(raw: string | null | undefined): string {
  if (!raw) return "";
  return decodeHtmlEntities(raw);
}

/**
 * Generate a clean plain-text excerpt from article HTML.
 */
export function generateExcerpt(html: string | null | undefined, maxChars = 280): string {
  let stripped = stripReleaseShortcodes(html || "");
  stripped = stripArtistShortcodes(stripped);
  stripped = stripTrackShortcodes(stripped);
  return generateExcerptUtil(stripped, maxChars);
}

/**
 * Normalize WordPress taxonomy term objects/strings into a flat string array.
 */
export function normalizeTaxonomyTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && "name" in item) {
        return String((item as Record<string, unknown>).name ?? "");
      }
      return String(item);
    })
    .filter(Boolean);
}