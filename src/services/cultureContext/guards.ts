const PUBLIC_BANNED_PATTERNS = [
  /\bregistry\b/i,
  /\bmetadata\b/i,
  /\bcanonical\b/i,
  /\bendpoint\b/i,
  /\bcache\b/i,
  /source provider/i,
  /\bclassified\b/i,
  /\bcatalogued\b/i,
  /\bdeterministic\b/i,
  /relationship graph/i,
  /data drawn from/i,
  /recorded in the registry/i,
  /chart appearances recorded/i,
  /active period/i,
  /label history/i,
  /genres represented/i,
  /key artists:/i,
  /tagged:/i,
];

export function validatePublicTone(text: string): string[] {
  const warnings: string[] = [];

  if (/[—–]/.test(text)) {
    warnings.push("Public copy must not use em dashes or en dashes.");
  }

  for (const pattern of PUBLIC_BANNED_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(`Public copy contains banned language: ${pattern.toString()}`);
    }
  }

  if (/released in\s*\./i.test(text)) {
    warnings.push("Public copy contains an empty release date phrase.");
  }

  if (/\([A-Z]{2}\)/.test(text)) {
    warnings.push("Public copy appears to contain a raw country code.");
  }

  return warnings;
}

export function normalizePublicPunctuation(text: string): string {
  return text
    .replace(/[,–]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}
