type UnknownRecord = Record<string, unknown>;

export interface PublicVideoShow {
  resourceId: string;
  slug: string;
  title: string;
  description: string | null;
  canonicalPath: string | null;
}

export interface PublicVideoEpisode {
  resourceId: string;
  slug: string;
  title: string;
  summary: string | null;
  episodeNumber: number | null;
}

export interface PublicVideoNativeDelivery {
  kind: "native_media";
  url: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  durationSeconds: number | null;
}

export interface PublicVideoProviderDelivery {
  kind: "provider";
  providerKey: string;
  providerObjectId: string | null;
  canonicalUrl: string | null;
}

export type PublicVideoDelivery =
  | PublicVideoNativeDelivery
  | PublicVideoProviderDelivery;

export interface PublicVideoPoster {
  url: string;
  mimeType: string;
}

export interface PublicVideoCaption {
  trackNumber: number;
  languageTag: string;
  trackKind: "captions" | "subtitles" | "forced_subtitles";
  label: string;
  isDefault: boolean;
  mimeType: string;
  deliveryPath: string;
}

export interface PublicVideoChapter {
  chapterNumber: number;
  startSeconds: number;
  title: string;
  description: string | null;
}

export interface PublicVideoProvenance {
  versionNumber: number;
  firstPublishedAt: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
}

export interface PublicVideoCredit {
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

export interface PublicVideoCitationSource {
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

export interface PublicVideoCitation {
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
  source: PublicVideoCitationSource;
}

export interface PublicVideoPublication {
  publicationId: string;
  resourceId: string;
  versionId: string;
  versionNumber: number;
  publicationKind: "episode" | "standalone";
  canonicalPath: string;
  slug: string;
  title: string;
  summary: string | null;
  classification: string;
  contentFingerprint: string;
  show: PublicVideoShow | null;
  episode: PublicVideoEpisode | null;
  delivery: PublicVideoDelivery;
  poster: PublicVideoPoster | null;
  captions: PublicVideoCaption[];
  chapters: PublicVideoChapter[];
  provenance: PublicVideoProvenance;
  credits: PublicVideoCredit[];
  citations: PublicVideoCitation[];
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
  const valueNumber = numberValue(value, Number.NaN);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

function decodeShow(value: unknown): PublicVideoShow | null {
  if (!value) return null;
  const input = record(value);
  const resourceId = stringValue(input.resource_id);
  const slug = stringValue(input.slug);
  const title = stringValue(input.title);
  const canonicalPath = nullableString(input.canonical_path);
  if (!resourceId || !slug || !title) return null;
  return {
    resourceId,
    slug,
    title,
    description: nullableString(input.description),
    canonicalPath,
  };
}

function decodeEpisode(value: unknown): PublicVideoEpisode | null {
  if (!value) return null;
  const input = record(value);
  const resourceId = stringValue(input.resource_id);
  const slug = stringValue(input.slug);
  const title = stringValue(input.title);
  if (!resourceId || !slug || !title) return null;
  return {
    resourceId,
    slug,
    title,
    summary: nullableString(input.summary),
    episodeNumber: nullableNumber(input.episode_number),
  };
}

function decodeDelivery(value: unknown): PublicVideoDelivery | null {
  const input = record(value);
  const kind = stringValue(input.kind);

  if (kind === "native_media") {
    const url = stringValue(input.url);
    const mimeType = stringValue(input.mime_type);
    const sha256 = stringValue(input.sha256);
    if (!url || mimeType !== "video/mp4" || !sha256) return null;
    return {
      kind,
      url,
      mimeType,
      byteSize: numberValue(input.byte_size),
      sha256,
      durationSeconds: nullableNumber(input.duration_seconds),
    };
  }

  if (kind === "provider") {
    const providerKey = stringValue(input.provider_key);
    if (!providerKey) return null;
    return {
      kind,
      providerKey,
      providerObjectId: nullableString(input.provider_object_id),
      canonicalUrl: nullableString(input.canonical_url),
    };
  }

  return null;
}

function decodeCaption(value: unknown): PublicVideoCaption | null {
  const input = record(value);
  const trackNumber = numberValue(input.track_number);
  const languageTag = stringValue(input.language_tag);
  const trackKind = stringValue(input.track_kind);
  const label = stringValue(input.label);
  const mimeType = stringValue(input.mime_type);
  const deliveryPath = stringValue(input.delivery_path);
  if (
    trackNumber < 1 ||
    !languageTag ||
    !label ||
    mimeType !== "text/vtt" ||
    !deliveryPath ||
    !["captions", "subtitles", "forced_subtitles"].includes(trackKind)
  ) {
    return null;
  }
  return {
    trackNumber,
    languageTag,
    trackKind: trackKind as PublicVideoCaption["trackKind"],
    label,
    isDefault: input.is_default === true,
    mimeType,
    deliveryPath,
  };
}

function decodeChapter(value: unknown): PublicVideoChapter | null {
  const input = record(value);
  const title = stringValue(input.title);
  const chapterNumber = numberValue(input.chapter_number);
  if (!title || chapterNumber < 1) return null;
  return {
    chapterNumber,
    startSeconds: numberValue(input.start_seconds),
    title,
    description: nullableString(input.description),
  };
}

function decodePoster(value: unknown): PublicVideoPoster | null {
  if (!value) return null;
  const input = record(value);
  const url = stringValue(input.url);
  const mimeType = stringValue(input.mime_type);
  if (!url || !mimeType.startsWith("image/")) return null;
  return { url, mimeType };
}

function decodeCredit(value: unknown): PublicVideoCredit | null {
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

function decodeCitation(value: unknown): PublicVideoCitation | null {
  const input = record(value);
  const sourceInput = record(input.source);
  const resourceId = stringValue(input.resource_id);
  const citationId = stringValue(input.citation_id);
  const sourceId = stringValue(sourceInput.source_id);
  const sourceVersionId = stringValue(sourceInput.source_version_id);
  const sourceTitle = stringValue(sourceInput.title);
  if (
    !resourceId ||
    !citationId ||
    !sourceId ||
    !sourceVersionId ||
    !sourceTitle
  ) {
    return null;
  }

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
    source: {
      sourceId,
      sourceVersionId,
      type: stringValue(sourceInput.type),
      title: sourceTitle,
      creator: nullableString(sourceInput.creator),
      publisher: nullableString(sourceInput.publisher),
      url: nullableString(sourceInput.url),
      publicationDate: nullableString(sourceInput.publication_date),
      creditLine: nullableString(sourceInput.credit_line),
    },
  };
}

export function decodePublicVideoPublication(
  value: unknown,
): PublicVideoPublication | null {
  if (!value) return null;
  const input = record(value);
  const publicationId = stringValue(input.publication_id);
  const resourceId = stringValue(input.resource_id);
  const versionId = stringValue(input.version_id);
  const canonicalPath = stringValue(input.canonical_path);
  const slug = stringValue(input.slug);
  const title = stringValue(input.title);
  const classification = stringValue(input.classification);
  const contentFingerprint = stringValue(input.content_fingerprint);
  const publicationKind = stringValue(input.publication_kind);
  const delivery = decodeDelivery(input.delivery);
  const provenanceInput = record(input.provenance);

  if (
    !publicationId ||
    !resourceId ||
    !versionId ||
    !canonicalPath ||
    !slug ||
    !title ||
    !classification ||
    !contentFingerprint ||
    !delivery ||
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
    classification,
    contentFingerprint,
    show: decodeShow(input.show),
    episode: decodeEpisode(input.episode),
    delivery,
    poster: decodePoster(input.poster),
    captions: array(input.captions)
      .map(decodeCaption)
      .filter((value): value is PublicVideoCaption => value !== null),
    chapters: array(input.chapters)
      .map(decodeChapter)
      .filter((value): value is PublicVideoChapter => value !== null),
    provenance: {
      versionNumber: numberValue(provenanceInput.version_number),
      firstPublishedAt: nullableString(provenanceInput.first_published_at),
      publishedAt: nullableString(provenanceInput.published_at),
      reviewedAt: nullableString(provenanceInput.reviewed_at),
    },
    credits: array(input.credits)
      .map(decodeCredit)
      .filter((value): value is PublicVideoCredit => value !== null),
    citations: array(input.citations)
      .map(decodeCitation)
      .filter((value): value is PublicVideoCitation => value !== null),
  };
}
