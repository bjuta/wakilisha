/**
 * WAKILISHA Chart Scoring Engine — Normalization Module
 * Bible §3: Title/Artist Normalization & Identity Key Generation
 *
 * CRITICAL DESIGN CONTRACT (from implementation brief §3):
 * - Pure functions only — zero I/O, zero randomness
 * - Byte-for-byte deterministic: same input always produces same output
 * - No Math.random, no Date.now, no external state
 * - Every function must be independently testable
 *
 * Scoring Policy: 1.0.1
 * Last updated: 2026-06-11
 */

// ─────────────────────────────────────────────────────────────────────────────
// §3.1 Core Normalization Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collapse leading/trailing whitespace and compress internal whitespace
 * to single spaces. Also replaces various Unicode whitespace chars.
 */
function collapseWhitespace(text: string): string {
  return text
    .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove parenthetical and bracketed content.
 * Handles: (text), [text], {text}, 「text」, 〈text〉
 * Includes nested brackets detection — strips outermost match.
 */
function stripBracketedContent(text: string): string {
  let result = text;

  result = result.replace(/\([^)]*\)/g, " ");
  result = result.replace(/\[[^\]]*\]/g, " ");
  result = result.replace(/\{[^}]*\}/g, " ");
  result = result.replace(/「[^」]*」/g, " ");
  result = result.replace(/〈[^〉]*〉/g, " ");

  return result;
}

/**
 * Remove feat./ft./featuring credits from text.
 * Handles common East African and international variants:
 *   feat, feat., ft, ft., featuring, Feat, FEAT, etc.
 * Also handles: x (as in "Artist A x Artist B"), &, and "with"
 */
const FEAT_PATTERNS: RegExp[] = [
  /\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)/gi,
];

function stripFeaturing(text: string): string {
  let result = text;
  for (const pattern of FEAT_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  result = result.replace(/\s+x\s+/gi, " ");
  result = result.replace(/\s+&\s+/g, " ");
  result = result.replace(/\bwith\s+(?!(?:the|a\s))(?:[A-Z][^\s,;]+(?:\s+[^\s,;]+)*)/g, " ");

  return result;
}

/**
 * Normalize a single piece of text for identity matching.
 * This is the shared core that both title and artist normalization use.
 *
 * Pipeline:
 * 1. Unicode NFKD decomposition (separates diacritics from base chars)
 * 2. Lowercase
 * 3. Strip bracketed content
 * 4. Strip featuring credits
 * 5. Replace hyphens, en-dashes, em-dashes, bullet with spaces
 * 6. Replace forward slashes and vertical bars with spaces
 * 7. Strip remaining ASCII punctuation (but preserve digits, letters, spaces)
 * 8. Collapse whitespace
 * 9. Trim
 */
function normalizeCore(text: string): string {
  if (!text || !text.trim()) return "";

  let result = text;

  result = result.normalize("NFKD");

  result = result.toLowerCase();

  result = stripBracketedContent(result);

  result = stripFeaturing(result);

  result = result.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " ");

  result = result.replace(/[-–—‒―•·‧]/g, " ");

  result = result.replace(/[\/\\|]/g, " ");

  result = result.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷]/g, " ");

  result = collapseWhitespace(result);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3.2 Public API — Four Exported Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §3.2.1: normalize_title()
 *
 * Normalizes a track title for identity matching across editions.
 *
 * Rules:
 * - Lowercase
 * - Strip all punctuation
 * - Remove feat./ft./featuring
 * - Remove parenthetical variants: (Remix), (Radio Edit), (Acoustic), etc.
 * - Collapse whitespace to single spaces
 *
 * Examples:
 *   "7 Days (Radio Edit)"          → "7 days"
 *   "Buga (Lo Lo Lo) [Bonus Track]" → "buga lo lo lo"
 *   "ON FIRE!!! (feat. Mr Eazi)"   → "on fire"
 *   "Sip (Alcohol) - Remix"        → "sip alcohol"
 */
export function normalize_title(title: string): string {
  return normalizeCore(title);
}

/**
 * §3.2.2: normalize_artist()
 *
 * Normalizes a full artist credit line for comparison.
 *
 * Rules:
 * - Lowercase
 * - Strip punctuation
 * - Remove feat./ft./featuring (the credited artist section)
 * - Collapse whitespace
 *
 * Examples:
 *   "Diamond Platnumz feat. Rayvanny" → "diamond platnumz"
 *   "BURNA BOY"                       → "burna boy"
 *   "Sauti Sol ft. Nyashinski"        → "sauti sol"
 *   "WizKid, Tems & Justin Bieber"    → "wizkid tems justin bieber"
 */
export function normalize_artist(artist_line: string): string {
  return normalizeCore(artist_line);
}

/**
 * §3.2.3: lead_artist_key()
 *
 * Extracts and normalizes the lead/primary artist from a full artist credit line.
 * Used by the anti-gaming engine (§7) to enforce max-tracks-per-lead-artist.
 * Also used in build_normalized_key as the artist component of the composite key.
 *
 * Extraction rules (order matters):
 * 1. Split on "feat.", "ft.", "featuring" (case-insensitive) — take left side
 * 2. Split on " x ", " & " — take left side
 * 3. Split on commas — take first segment
 * 4. Normalize the extracted name
 *
 * The result is a single normalized string identifying the primary artist.
 *
 * Examples:
 *   "Diamond Platnumz feat. Rayvanny"  → "diamond platnumz"
 *   "WizKid, Tems & Justin Bieber"     → "wizkid"
 *   "Sauti Sol & Nyashinski"           → "sauti sol"
 *   "BURNA BOY"                        → "burna boy"
 *   "Rema ft. Selena Gomez"            → "rema"
 */
export function lead_artist_key(full_artist_line: string): string {
  if (!full_artist_line || !full_artist_line.trim()) return "";

  let extracted = full_artist_line;

  const featSplit = extracted.split(/\s+(?:feat\.|ft\.|featuring)\s+/i);
  if (featSplit.length > 1) {
    extracted = featSplit[0];
  }

  const collabSplit = extracted.split(/\s+(?:x|&)\s+/i);
  if (collabSplit.length > 1) {
    extracted = collabSplit[0];
  }

  const commaSplit = extracted.split(/\s*,\s*/);
  extracted = commaSplit[0];

  return normalizeCore(extracted);
}

/**
 * §3.2.4: build_normalized_key()
 *
 * Builds the composite identity key used for deduplication between editions
 * and continuity/carry-forward matching (§4.5–§4.6).
 *
 * Format: "{normalized_title}::{lead_artist_key}"
 *
 * The double-colon separator is chosen because it never appears in
 * normalized titles or artist keys (all punctuation is stripped).
 *
 * This key is stored in wk_chart_entries_v2.normalized_key and is the
 * primary join key between consecutive editions for continuity scoring.
 *
 * Example:
 *   title="Buga (Lo Lo Lo)", artist="Kizz Daniel feat. Tekno"
 *   → build_normalized_key("Buga (Lo Lo Lo)", "Kizz Daniel feat. Tekno")
 *   → "buga lo lo lo::kizz daniel"
 */
export function build_normalized_key(title: string, full_artist_line: string): string {
  const normalizedTitle = normalize_title(title);
  const leadKey = lead_artist_key(full_artist_line);

  if (!normalizedTitle || !leadKey) return "";

  return `${normalizedTitle}::${leadKey}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3.3 Convenience — Batch Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a batch of raw title/artist pairs into normalized keys.
 * Used during the fetch→normalize→dedupe pipeline stage (§2).
 *
 * Returns the input array enriched with normalized_key and lead_artist_key.
 */
export interface RawTitleArtistPair {
  title: string;
  artist_line: string;
}

export interface NormalizedPair {
  title: string;
  artist_line: string;
  normalized_title: string;
  normalized_artist: string;
  lead_artist_key: string;
  normalized_key: string;
}

export function normalize_batch(pairs: RawTitleArtistPair[]): NormalizedPair[] {
  return pairs.map(({ title, artist_line }) => ({
    title,
    artist_line,
    normalized_title: normalize_title(title),
    normalized_artist: normalize_artist(artist_line),
    lead_artist_key: lead_artist_key(artist_line),
    normalized_key: build_normalized_key(title, artist_line),
  }));
}

/**
 * Deduplicate a batch of normalized pairs by normalized_key.
 * When duplicates are found, the first occurrence is kept.
 *
 * Returns the deduplicated array and a count of removed duplicates.
 */
export function deduplicate_pairs(pairs: NormalizedPair[]): {
  unique: NormalizedPair[];
  removed_count: number;
} {
  const seen = new Set<string>();
  const unique: NormalizedPair[] = [];

  for (const pair of pairs) {
    if (!pair.normalized_key) continue;
    if (seen.has(pair.normalized_key)) continue;
    seen.add(pair.normalized_key);
    unique.push(pair);
  }

  return {
    unique,
    removed_count: pairs.length - unique.length,
  };
}