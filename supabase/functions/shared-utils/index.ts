// ── Shared Utils module for Edge Functions ──
// Text normalization, slug generation, date helpers

/** Slugify a string for use in URLs. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

/** Normalize a title for dedup matching. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/** Collapse whitespace and strip special spaces. */
export function collapseWhitespace(text: string): string {
  return text
    .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip bracketed content. */
export function stripBracketedContent(text: string): string {
  let r = text;
  r = r.replace(/\([^)]*\)/g, " ");
  r = r.replace(/\[[^\]]*\]/g, " ");
  r = r.replace(/\{[^}]*\}/g, " ");
  r = r.replace(/「[^」]*」/g, " ");
  r = r.replace(/〈[^〉]*〉/g, " ");
  return r;
}

/** Strip "feat. X" / "ft. X" / "featuring X" from text. */
const FEAT_PATTERNS = [
  /\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)*/gi,
];

export function stripFeaturing(text: string): string {
  let r = text;
  for (const p of FEAT_PATTERNS) r = r.replace(p, " ");
  r = r.replace(/\s+x\s+/gi, " ");
  r = r.replace(/\s+&\s+/g, " ");
  r = r.replace(/\bwith\s+(?!(?:the|a\s))(?:[A-Z][^\s,;]+(?:\s+[^\s,;]+)*)/g, " ");
  return r;
}

/** Full normalisation: NFKD → lowercase → strip brackets → strip featuring → collapse. */
export function normalizeCore(text: string): string {
  if (!text || !text.trim()) return "";
  let r = text;
  r = r.normalize("NFKD");
  r = r.toLowerCase();
  r = stripBracketedContent(r);
  r = stripFeaturing(r);
  r = r.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " ");
  r = r.replace(/[-\u2013\u2014\u2012\u2015\u2022\u00B7\u2027]/g, " ");
  r = r.replace(/[\/\\|]/g, " ");
  r = r.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~\u00A1-\u00BF\u00D7\u00F7]/g, " ");
  r = collapseWhitespace(r);
  return r;
}

/** Extract lead artist key from an artist line. */
export function leadArtistKey(fullArtistLine: string): string {
  if (!fullArtistLine || !fullArtistLine.trim()) return "";
  let extracted = fullArtistLine;
  const featSplit = extracted.split(/\s+(?:feat\.|ft\.|featuring)\s+/i);
  if (featSplit.length > 1) extracted = featSplit[0];
  const collabSplit = extracted.split(/\s+(?:x|&)\s+/i);
  if (collabSplit.length > 1) extracted = collabSplit[0];
  const commaSplit = extracted.split(/\s*,\s*/);
  extracted = commaSplit[0];
  return normalizeCore(extracted);
}

/** Build a normalized key: "title::artist". */
export function buildNormalizedKey(title: string, artistLine: string): string {
  const nt = normalizeCore(title);
  const lk = leadArtistKey(artistLine);
  if (!nt || !lk) return "";
  return nt + "::" + lk;
}

/** Normalize an artist name for display (strip feat./ft./featuring). */
export function normalizeArtistName(name: string): string {
  return name
    .split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]
    .split(/\s*,\s*/)[0]
    .trim();
}

/** Normalize ISO2 country code. */
export function normalizeIso2(raw: string): string {
  const u = raw.toUpperCase();
  const fixes: Record<string, string> = {
    KENYA: "KE", HAITI: "HT", UK: "GB", CANADA: "CA", USA: "US",
    FRANCE: "FR", GERMANY: "DE", NIGERIA: "NG", TANZANIA: "TZ",
    UGANDA: "UG", GHANA: "GH",
  };
  return fixes[u] || u;
}

/** Sanitize a date string to YYYY-MM-DD or null. */
export function sanitizeDate(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const r = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(r)) return r;
  if (/^\d{4}-\d{2}$/.test(r)) return r + "-01";
  if (/^\d{4}$/.test(r)) return r + "-01-01";
  try {
    const d = new Date(r);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch { /* ignore */ }
  return null;
}

/** Strip HTML tags. */
export function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[^;]+;/g, "")
    .trim();
}

/** Generate a smart excerpt (maxChars, ends at word boundary). */
export function generateSmartExcerpt(html: string | null | undefined, maxChars = 280): string {
  if (!html) return "";
  const withoutHeadings = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  let plain = withoutHeadings.replace(/<[^>]*>/g, "");
  plain = plain
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, "");
  plain = plain.replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= maxChars) return plain;
  const chopped = plain.slice(0, maxChars);
  const lastSpace = chopped.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) return chopped.slice(0, lastSpace).replace(/[,\s]+$/, "") + "\u2026";
  return chopped.replace(/[,\s]+$/, "") + "\u2026";
}

Deno.serve(() => new Response("shared-utils", { status: 404 }));
