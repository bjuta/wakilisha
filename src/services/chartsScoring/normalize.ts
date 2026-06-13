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
 * Scoring Policy: 1.0.2
 * Last updated: 2026-06-14
 *
 * §3.0 Hardening (2026-06-14):
 * - Added zero-width character stripping (v11 backfill lessons)
 * - Added combining diacritic stripping after NFKD decomposition (v13 backfill lessons)
 * - Added normalizeCoreNoBrackets variant for entity resolution — retains
 *   parenthetical content (e.g., "(Remix)", "(Acoustic)") as distinguishing tokens
 *   while still stripping brackets + feat credits for canonical identity
 *
 * These fixes prevent phantom different normalized keys caused by invisible
 * Unicode characters and ensure byte-for-byte equivalence with the backfill
 * artwork pipeline's normalization.
 */

// ─────────────────────────────────────────────────────────────────────────────
// §3.0 Character Class Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zero-width and invisible formatting characters that can corrupt
 * normalized keys without any visible effect.
 *
 * U+200B — Zero-width space
 * U+200C — Zero-width non-joiner
 * U+200D — Zero-width joiner
 * U+2060 — Word joiner
 * U+FEFF — Byte order mark / zero-width no-break space
 * U+00AD — Soft hyphen
 */
const ZERO_WIDTH_CHARS = /[\u200B\u200C-\u200D\u2060\uFEFF\u00AD]/g;

/**
 * Combining diacritical marks range (Unicode block 0300–036F).
 * After NFKD decomposition, accented characters become base + combining mark.
 * We strip the combining marks to get truly diacritic-free strings.
 *
 * Examples after NFKD:
 *   "Café"  → "cafe\u0301"  → strip → "cafe"
 *   "Nīūnyonaga" → "Ni\u0304u\u0304nyonaga" → strip → "niunyonaga"
 */
const COMBINING_DIACRITICS = /[\u0300-\u036F]/g;

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
 * Pipeline (v1.0.2 — hardened):
 * 0. Strip zero-width and invisible formatting characters
 * 1. Unicode NFKD decomposition (separates diacritics from base chars)
 * 2. Strip combining diacritical marks (\u0300-\u036F)
 * 3. Lowercase
 * 4. Strip bracketed content
 * 5. Strip featuring credits
 * 6. Replace hyphens, en-dashes, em-dashes, bullet with spaces
 * 7. Replace forward slashes and vertical bars with spaces
 * 8. Strip remaining ASCII punctuation (but preserve digits, letters, spaces)
 * 9. Collapse whitespace
 * 10. Trim
 */
function normalizeCore(text: string): string {
  if (!text || !text.trim()) return "";

  let result = text;

  // Step 0: Strip zero-width and invisible formatting characters
  // These silently corrupt keys without any visible effect
  result = result.replace(ZERO_WIDTH_CHARS, "");

  // Step 1: NFKD decomposition
  result = result.normalize("NFKD");

  // Step 2: Strip combining diacritical marks
  // After NFKD, "é" → "e\u0301". We strip \u0301 so we get plain "e".
  result = result.replace(COMBINING_DIACRITICS, "");

  // Step 3: Lowercase
  result = result.toLowerCase();

  // Step 4: Strip bracketed content
  result = stripBracketedContent(result);

  // Step 5: Strip featuring credits
  result = stripFeaturing(result);

  // Step 6: Replace dashes and hyphens with spaces
  result = result.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " ");

  result = result.replace(/[-–—‒―•·‧]/g, " ");

  // Step 7: Replace slashes and pipes with spaces
  result = result.replace(/[\/\\|]/g, " ");

  // Step 8: Strip remaining ASCII punctuation
  result = result.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷]/g, " ");

  // Step 9: Collapse whitespace
  result = collapseWhitespace(result);

  return result;
}

/**
 * Normalize a single piece of text for identity matching — NO BRACKET STRIPPING variant.
 *
 * This variant RETAINS parenthetical content but still strips the bracket
 * characters themselves, so "(Remix)" becomes "remix" rather than being
 * completely removed. This preserves distinguishing tokens that can help
 * differentiate between a track and its remix during entity resolution.
 *
 * Used by entity resolution engines (canonicalMatch, entityResolution)
 * where parenthetical content carries meaningful distinguishing info.
 *
 * Pipeline:
 * 0. Strip zero-width chars
 * 1. NFKD decomposition
 * 2. Strip combining diacritics
 * 3. Lowercase
 * 4. Strip featuring credits (but NOT bracketed content — brackets replaced with spaces)
 * 5–9. Same as normalizeCore (dashes→spaces, slashes→spaces, strip punctuation, collapse, trim)
 */
function normalizeCoreNoBrackets(text: string): string {
  if (!text || !text.trim()) return "";

  let result = text;

  // Step 0: Strip zero-width and invisible formatting characters
  result = result.replace(ZERO_WIDTH_CHARS, "");

  // Step 1: NFKD decomposition
  result = result.normalize("NFKD");

  // Step 2: Strip combining diacritical marks
  result = result.replace(COMBINING_DIACRITICS, "");

  // Step 3: Lowercase
  result = result.toLowerCase();

  // Step 4: Replace brackets with spaces (keep the content)
  // Different from normalizeCore which strips content entirely
  result = result.replace(/[\(\)\[\]\{\}「」〈〉]/g, " ");

  // Step 5: Strip featuring credits
  result = stripFeaturing(result);

  // Step 6: Replace dashes and hyphens with spaces
  result = result.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " ");
  result = result.replace(/[-–—‒―•·‧]/g, " ");

  // Step 7: Replace slashes and pipes with spaces
  result = result.replace(/[\/\\|]/g, " ");

  // Step 8: Strip remaining ASCII punctuation
  result = result.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷]/g, " ");

  // Step 9: Collapse whitespace
  result = collapseWhitespace(result);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3.2 Public API — Five Exported Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §3.2.1: normalize_title()
 *
 * Normalizes a track title for identity matching across editions.
 *
 * Rules:
 * - Strip zero-width characters
 * - NFKD decomposition + combining diacritic stripping
 * - Lowercase
 * - Strip all punctuation
 * - Remove feat./ft./featuring
 * - Remove parenthetical variants: (Remix), (Radio Edit), (Acoustic), etc.
 * - Collapse whitespace to single spaces
 *
 * Examples:
 *   "7 Days (Radio Edit)"          → "7 days"
 *   "Buga (Lo Lo Lo) [Bonus Track]" → "buga"
 *   "ON FIRE!!! (feat. Mr Eazi)"   → "on fire"
 *   "Sip (Alcohol) - Remix"        → "sip alcohol"
 *   "Café del Mar"                 → "cafe del mar"
 *   "I\u2060HATED\u2060YOUR\u2060RELATIONSHIP" → "i hated your relationship"
 */
export function normalize_title(title: string): string {
  return normalizeCore(title);
}

/**
 * §3.2.1a: normalize_title_no_brackets()
 *
 * Normalizes a track title WITHOUT stripping parenthetical content.
 * Brackets → spaces, content kept. Useful for entity resolution
 * where "(Remix)" vs original is a meaningful distinction.
 *
 * Examples:
 *   "7 Days (Radio Edit)"  → "7 days radio edit"
 *   "Buga (Remix)"         → "buga remix"
 */
export function normalize_title_no_brackets(title: string): string {
  return normalizeCoreNoBrackets(title);
}

/**
 * §3.2.2: normalize_artist()
 *
 * Normalizes a full artist credit line for comparison.
 *
 * Rules:
 * - Strip zero-width characters
 * - NFKD decomposition + combining diacritic stripping
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
 *   "Björk"                           → "bjork"
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
 *   "Nīūnyonaga"                       → "niunyonaga"
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
 *   → "buga::kizz daniel"
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