type UnknownRecord = Record<string, unknown>;

export interface PublicAudioShow {
  id: string;
  resourceId: string;
  slug: string;
  title: string;
  description: string | null;
}

export interface PublicAudioSeason {
  id: string;
  resourceId: string;
  seasonNumber: number;
  title: string;
  description: string | null;
}

export interface PublicAudioDelivery {
  url: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  durationSeconds: number | null;
  waveformUrl: string | null;
}

export interface PublicAudioTranscript {
  assetId: string;
  assetRevisionId: string;
  url: string | null;
  mimeType: string | null;
  filename: string | null;
}

export interface PublicAudioChapter {
  chapterNumber: number;
  startSeconds: number;
  title: string;
  chapterUrl: string | null;
  imageUrl: string | null;
}

export interface PublicAudioFeedIdentity {
  guid: string;
  enclosureUrl: string;
}

export interface PublicAudioProvenance {
  versionNumber: number;
  firstPublishedAt: string | null;
  publishedAt: string | null;
}

export interface PublicAudioCredit {
  resourceId: string;
  resourceKind: string;
  displayOrder: number;
  isPrimary: boolean;
  creditId: string;
  role: string;
  roleLabel: string | null;
  displayName: string;
  note: string | null;
  authorSlug: string | null;
  username: string | null;
}

export interface PublicAudioCitationSource {
  sourceId: string;
  sourceVersionId: string;
  type: string;
  title: string;
  creator: string | null;
  publisher: string | null;
  url: string | null;
  publicationDate: string | null;
  creditLine: string | null;
}

export interface PublicAudioCitation {
  resourceId: string;
  resourceKind: string;
  displayOrder: number;
  purpose: string;
  anchorType: string;
  anchor: UnknownRecord;
  citationId: string;
  publicLabel: string | null;
  locatorType: string;
  locator: UnknownRecord;
  source: PublicAudioCitationSource;
}

export interface PublicAudioPublication {
  publicationId: string;
  resourceId: string;
  versionId: string;
  versionNumber: number;
  publicationKind: "episode" | "standalone";
  canonicalPath: string;
  slug: string;
  title: string;
  summary: string | null;
  episodeNumber: number | null;
  show: PublicAudioShow | null;
  season: PublicAudioSeason | null;
  delivery: PublicAudioDelivery;
  transcript: PublicAudioTranscript | null;
  chapters: PublicAudioChapter[];
  feed: PublicAudioFeedIdentity;
  provenance: PublicAudioProvenance;
  credits: PublicAudioCredit[];
  citations: PublicAudioCitation[];
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  return stringValue(value) || null;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = numberValue(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeShow(value: unknown): PublicAudioShow | null {
  if (!value) return null;
  const input = record(value);
  const id = stringValue(input.id);
  const resourceId = stringValue(input.resource_id);
  const slug = stringValue(input.slug);
  const title = stringValue(input.title);
  if (!id || !resourceId || !slug || !title) return null;
  return {
    id,
    resourceId,
    slug,
    title,
    description: nullableString(input.description),
  };
}

function decodeSeason(value: unknown): PublicAudioSeason | null {
  if (!value) return null;
  const input = record(value);
  const id = stringValue(input.id);
  const resourceId = stringValue(input.resource_id);
  const title = stringValue(input.title);
  if (!id || !resourceId || !title) return null;
  return {
    id,
    resourceId,
    seasonNumber: numberValue(input.season_number),
    title,
    description: nullableString(input.description),
  };
}

function decodeDelivery(value: unknown): PublicAudioDelivery | null {
  const input = record(value);
  const url = stringValue(input.url);
  const mimeType = stringValue(input.mime_type);
  const sha256 = stringValue(input.sha256);
  if (!url || !mimeType || !sha256) return null;
  return {
    url,
    mimeType,
    byteSize: numberValue(input.byte_size),
    sha256,
    durationSeconds: nullableNumber(input.duration_seconds),
    waveformUrl: nullableString(input.waveform_url),
  };
}

function decodeTranscript(value: unknown): PublicAudioTranscript | null {
  if (!value) return null;
  const input = record(value);
  const assetId = stringValue(input.asset_id);
  const assetRevisionId = stringValue(input.asset_revision_id);
  if (!assetId || !assetRevisionId) return null;
  return {
    assetId,
    assetRevisionId,
    url: nullableString(input.url),
    mimeType: nullableString(input.mime_type),
    filename: nullableString(input.filename),
  };
}

function decodeChapter(value: unknown): PublicAudioChapter | null {
  const input = record(value);
  const title = stringValue(input.title);
  if (!title) return null;
  return {
    chapterNumber: numberValue(input.chapter_number),
    startSeconds: numberValue(input.start_seconds),
    title,
    chapterUrl: nullableString(input.chapter_url),
    imageUrl: nullableString(input.image_url),
  };
}

function decodeCredit(value: unknown): PublicAudioCredit | null {
  const input = record(value);
  const resourceId = stringValue(input.resource_id);
  const creditId = stringValue(input.credit_id);
  const displayName = stringValue(input.display_name);
  if (!resourceId || !creditId || !displayName) return null;
  return {
    resourceId,
    resourceKind: stringValue(input.resource_kind),
    displayOrder: numberValue(input.display_order),
    isPrimary: input.is_primary === true,
    creditId,
    role: stringValue(input.role),
    roleLabel: nullableString(input.role_label),
    displayName,
    note: nullableString(input.note),
    authorSlug: nullableString(input.author_slug),
    username: nullableString(input.username),
  };
}

function decodeCitationSource(value: unknown): PublicAudioCitationSource | null {
  const input = record(value);
  const sourceId = stringValue(input.source_id);
  const sourceVersionId = stringValue(input.source_version_id);
  const title = stringValue(input.title);
  if (!sourceId || !sourceVersionId || !title) return null;
  return {
    sourceId,
    sourceVersionId,
    type: stringValue(input.type),
    title,
    creator: nullableString(input.creator),
    publisher: nullableString(input.publisher),
    url: nullableString(input.url),
    publicationDate: nullableString(input.publication_date),
    creditLine: nullableString(input.credit_line),
  };
}

function decodeCitation(value: unknown): PublicAudioCitation | null {
  const input = record(value);
  const resourceId = stringValue(input.resource_id);
  const citationId = stringValue(input.citation_id);
  const source = decodeCitationSource(input.source);
  if (!resourceId || !citationId || !source) return null;
  return {
    resourceId,
    resourceKind: stringValue(input.resource_kind),
    displayOrder: numberValue(input.display_order),
    purpose: stringValue(input.purpose),
    anchorType: stringValue(input.anchor_type),
    anchor: record(input.anchor),
    citationId,
    publicLabel: nullableString(input.public_label),
    locatorType: stringValue(input.locator_type),
    locator: record(input.locator),
    source,
  };
}

export function decodePublicAudioPublication(
  value: unknown,
): PublicAudioPublication | null {
  if (!value) return null;
  const input = record(value);
  const publicationId = stringValue(input.publication_id);
  const resourceId = stringValue(input.resource_id);
  const versionId = stringValue(input.version_id);
  const slug = stringValue(input.slug);
  const title = stringValue(input.title);
  const canonicalPath = stringValue(input.canonical_path);
  const publicationKind = stringValue(input.publication_kind);
  const delivery = decodeDelivery(input.delivery);
  const feedInput = record(input.feed);
  const guid = stringValue(feedInput.guid);
  const enclosureUrl = stringValue(feedInput.enclosure_url);
  const provenanceInput = record(input.provenance);

  if (
    !publicationId ||
    !resourceId ||
    !versionId ||
    !slug ||
    !title ||
    !canonicalPath ||
    !delivery ||
    !guid ||
    !enclosureUrl ||
    !["episode", "standalone"].includes(publicationKind)
  ) {
    return null;
  }

  return {
    publicationId,
    resourceId,
    versionId,
    versionNumber: numberValue(input.version_number),
    publicationKind: publicationKind as "episode" | "standalone",
    canonicalPath,
    slug,
    title,
    summary: nullableString(input.summary),
    episodeNumber: nullableNumber(input.episode_number),
    show: decodeShow(input.show),
    season: decodeSeason(input.season),
    delivery,
    transcript: decodeTranscript(input.transcript),
    chapters: array(input.chapters)
      .map(decodeChapter)
      .filter((chapter): chapter is PublicAudioChapter => chapter !== null),
    feed: { guid, enclosureUrl },
    provenance: {
      versionNumber: numberValue(provenanceInput.version_number),
      firstPublishedAt: nullableString(provenanceInput.first_published_at),
      publishedAt: nullableString(provenanceInput.published_at),
    },
    credits: array(input.credits)
      .map(decodeCredit)
      .filter((credit): credit is PublicAudioCredit => credit !== null),
    citations: array(input.citations)
      .map(decodeCitation)
      .filter((citation): citation is PublicAudioCitation => citation !== null),
  };
}
