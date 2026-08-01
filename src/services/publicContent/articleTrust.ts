type UnknownRecord = Record<string, unknown>;

export interface PublicArticleSource {
  label: string;
  title: string;
  creator: string | null;
  publisher: string | null;
  url: string | null;
  publicationDate: string | null;
  retrievalDate: string | null;
  locatorType: string;
  locatorData: unknown;
  purpose: string;
  displayOrder: number;
}

export interface PublicArticleCredit {
  displayName: string;
  role: string;
  isPrimary: boolean;
  registryAuthorSlug: string | null;
  username: string | null;
  displayOrder: number;
}

export interface PublicArticleTrust {
  sources: PublicArticleSource[];
  credits: PublicArticleCredit[];
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeSource(value: unknown): PublicArticleSource {
  const row = record(value);
  return {
    label: text(row.label),
    title: text(row.title),
    creator: nullableText(row.creator),
    publisher: nullableText(row.publisher),
    url: nullableText(row.url),
    publicationDate: nullableText(row.publication_date),
    retrievalDate: nullableText(row.retrieval_date),
    locatorType: text(row.locator_type),
    locatorData: row.locator_data ?? null,
    purpose: text(row.purpose),
    displayOrder: number(row.display_order),
  };
}

function normalizeCredit(value: unknown): PublicArticleCredit {
  const row = record(value);
  return {
    displayName: text(row.display_name),
    role: text(row.role),
    isPrimary: row.is_primary === true,
    registryAuthorSlug: nullableText(row.registry_author_slug),
    username: nullableText(row.username),
    displayOrder: number(row.display_order),
  };
}

export function emptyPublicArticleTrust(): PublicArticleTrust {
  return { sources: [], credits: [] };
}

export function normalizePublicArticleTrust(
  value: unknown,
): PublicArticleTrust {
  const row = record(value);
  return {
    sources: Array.isArray(row.sources)
      ? row.sources
          .map(normalizeSource)
          .sort((left, right) => left.displayOrder - right.displayOrder)
      : [],
    credits: Array.isArray(row.credits)
      ? row.credits
          .map(normalizeCredit)
          .sort((left, right) => left.displayOrder - right.displayOrder)
      : [],
  };
}
