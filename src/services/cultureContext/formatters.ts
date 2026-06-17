import type { ReleaseType } from "./types";

const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya",
  UG: "Uganda",
  TZ: "Tanzania",
  RW: "Rwanda",
  BI: "Burundi",
  ET: "Ethiopia",
  SO: "Somalia",
  SS: "South Sudan",
  NG: "Nigeria",
  GH: "Ghana",
  ZA: "South Africa",
  US: "United States",
  GB: "United Kingdom",
};

export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

export function humanList(items: string[], limit = 3): string {
  const cleanItems = items.filter(Boolean).slice(0, limit);
  if (cleanItems.length === 0) return "";
  if (cleanItems.length === 1) return cleanItems[0];
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  return `${cleanItems.slice(0, -1).join(", ")} and ${cleanItems[cleanItems.length - 1]}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function normalizeCountry(value: unknown): string | undefined {
  const clean = cleanText(value);
  if (!clean) return undefined;
  const upper = clean.toUpperCase();
  return COUNTRY_NAMES[upper] || clean;
}

export function extractYear(value: unknown): string | undefined {
  const clean = cleanText(value);
  if (!clean) return undefined;
  const match = clean.match(/^(\d{4})/);
  return match?.[1];
}

export function extractMonthName(value: unknown): string | undefined {
  const clean = cleanText(value);
  if (!clean) return undefined;
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", { month: "long" });
}

export function normalizeReleaseType(value: unknown): ReleaseType {
  const clean = cleanText(value).toLowerCase();
  if (!clean) return "unknown";

  // More specific release shapes must come before broad album/single checks.
  if (clean.includes("deluxe") || clean.includes("expanded edition")) return "deluxe";
  if (clean.includes("soundtrack") || clean.includes("ost")) return "soundtrack";
  if (clean.includes("live")) return "live";
  if (clean.includes("mixtape")) return "mixtape";
  if (clean.includes("compilation") || clean.includes("various artists")) return "compilation";
  if (clean === "ep" || clean.includes("extended play")) return "ep";
  if (clean.includes("single")) return "single";
  if (clean.includes("album") || clean.includes("lp")) return "album";

  return "unknown";
}

export function releaseTypeLabel(type: ReleaseType): string {
  if (type === "ep") return "EP";
  if (type === "live") return "live release";
  if (type === "deluxe") return "deluxe edition";
  return type;
}

export function sentenceJoin(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
