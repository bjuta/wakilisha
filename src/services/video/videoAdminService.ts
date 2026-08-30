import { supabase } from "@/lib/supabase";
import { getAdminMediaAssetById } from "@/services/adminMediaReadService";

type JsonObject = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message?: string } | null };

export type VideoPublicationKind = "standalone" | "episode";
export type VideoSourceKind = "native_media" | "external_provider";
export type VideoReviewDecision = "request_changes" | "approve";

export interface VideoSourceSummary {
  id: string;
  sourceKind: VideoSourceKind;
  providerKey: string | null;
  providerObjectId: string | null;
  canonicalUrl: string | null;
  mediaAssetId: string | null;
  mediaAssetRevisionId: string | null;
  sourceMetadata?: JsonObject;
  capabilities?: JsonObject;
}

export interface VideoShowSummary {
  resourceId: string;
  slug: string;
  title: string;
  description?: string | null;
  authorityRevision?: number;
  lifecycleState?: string;
}

export interface VideoShowEpisodeSummary {
  resourceId: string;
  showResourceId?: string;
  slug: string;
  title: string;
  summary?: string | null;
  episodeNumber: number | null;
  authorityRevision?: number;
  lifecycleState?: string;
  videoPublicationId?: string | null;
}

export interface VideoPublicationSummary {
  id: string;
  resourceId: string;
  resourceKind: "standalone_video" | "video_episode";
  publicationKind: VideoPublicationKind;
  slug: string;
  title: string;
  summary: string | null;
  classification: string;
  authorityRevision: number;
  lifecycleState: string;
  selectedSource: VideoSourceSummary | null;
  show: VideoShowSummary | null;
  showEpisode: VideoShowEpisodeSummary | null;
  versions: {
    working: string | null;
    submitted: string | null;
    approved: string | null;
    published: string | null;
  };
  updatedAt: string;
}

export interface VideoAdminVocabularyItem {
  key: string;
  label: string;
  description: string;
}

export interface VideoNativeMediaContext {
  assetId: string;
  title: string | null;
  primaryDeliveryUrl: string | null;
  deliveryReady: boolean;
  mimeType: string | null;
  durationSeconds: number | null;
  posterFrameUrl: string | null;
  thumbnailUrl: string | null;
}

export interface VideoAdminIndex {
  publications: VideoPublicationSummary[];
  shows: VideoShowSummary[];
  showEpisodes: VideoShowEpisodeSummary[];
  classifications: VideoAdminVocabularyItem[];
  sourceProviders: VideoAdminVocabularyItem[];
  captionTrackKinds: VideoAdminVocabularyItem[];
}

export interface VideoCaptionTrack {
  id?: string;
  assetId: string;
  assetRevisionId?: string;
  languageTag: string;
  trackKind: string;
  label: string;
  isDefault: boolean;
  displayOrder?: number;
}

export interface VideoChapter {
  id?: string;
  chapterNumber?: number;
  startSeconds: number;
  title: string;
  description: string | null;
}

export interface VideoTrustCitation {
  attachmentId: string;
  citationId: string;
  citationPurpose: string;
  targetAnchorType: string;
  targetAnchorData: JsonObject;
  displayOrder: number;
  publicSafe: boolean;
  publicLabel: string | null;
  quotation: string | null;
  citationState: string;
}

export interface VideoTrustCredit {
  attachmentId: string;
  creditId: string;
  displayOrder: number;
  isPrimary: boolean;
  publicSafe: boolean;
  creditRole: string;
  displayName: string;
  roleLabel: string | null;
}

export interface VideoCorrectionProvenanceCase {
  caseResourceId: string;
  caseReference: string;
  caseState: string;
  correctionKind: string | null;
  priority: string | null;
  targetId: string;
  targetVersionId: string;
  targetVersionType: string;
  targetRole: string;
  targetSummary: string | null;
  observedContentFingerprint: string | null;
  versionKind: string;
  versionNumber: number;
  currentDecisionOutcome: string | null;
  currentDecisionPublicSafeExplanation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoPublicationWorkspace {
  publication: {
    id: string;
    publicationKind: VideoPublicationKind;
    slug: string;
    title: string;
    summary: string | null;
    classification: string;
    authorityRevision: number;
    metadata: JsonObject;
    createdAt: string;
    updatedAt: string;
  };
  resource: {
    id: string;
    resourceKind: "standalone_video" | "video_episode";
    ownerId: string | null;
    visibility: string;
    lifecycleState: string;
    versions: VideoPublicationSummary["versions"];
  };
  show: VideoShowSummary | null;
  showEpisode: VideoShowEpisodeSummary | null;
  selectedSource: VideoSourceSummary | null;
  selectedMedia: VideoNativeMediaContext | null;
  poster: { usageLinkId: string; assetId: string; assetRevisionId: string } | null;
  transcript: { usageLinkId: string; assetId: string; assetRevisionId: string } | null;
  captions: VideoCaptionTrack[];
  chapters: VideoChapter[];
  versionHistory: JsonObject[];
  reviewEvents: JsonObject[];
  lifecycleEvents: JsonObject[];
  trust: {
    citationRevision: number;
    creditRevision: number;
    citations: VideoTrustCitation[];
    credits: VideoTrustCredit[];
  };
  correctionProvenance: {
    canView: boolean;
    cases: VideoCorrectionProvenanceCase[];
  };
  classifications: VideoAdminVocabularyItem[];
  sourceProviders: VideoAdminVocabularyItem[];
  captionTrackKinds: VideoAdminVocabularyItem[];
  capabilities: {
    canView: boolean;
    canEdit: boolean;
    canManageReview: boolean;
    canPublish: boolean;
  };
}

function rpc(): (
  name: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult> {
  return supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult>;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function row(data: unknown): JsonObject {
  return object(Array.isArray(data) ? data[0] : data);
}

function idempotency(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function throwRpc(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

function requireSucceeded(value: JsonObject, fallback: string): JsonObject {
  if (text(value.receipt_status) === "rejected") {
    throw new Error(
      text(object(value.result_payload).error_message) ||
        text(value.error_message) ||
        fallback,
    );
  }
  return value;
}

function parseSource(value: unknown): VideoSourceSummary | null {
  const source = object(value);
  if (!text(source.id)) return null;
  return {
    id: text(source.id),
    sourceKind: text(source.source_kind) === "native_media"
      ? "native_media"
      : "external_provider",
    providerKey: nullableText(source.provider_key),
    providerObjectId: nullableText(source.provider_object_id),
    canonicalUrl: nullableText(source.canonical_url),
    mediaAssetId: nullableText(source.media_asset_id),
    mediaAssetRevisionId: nullableText(source.media_asset_revision_id),
    sourceMetadata: object(source.source_metadata),
    capabilities: object(source.capabilities),
  };
}

function parseShow(value: unknown): VideoShowSummary | null {
  const show = object(value);
  if (!text(show.resource_id)) return null;
  return {
    resourceId: text(show.resource_id),
    slug: text(show.slug),
    title: text(show.title),
    description: nullableText(show.description),
    authorityRevision: numberValue(show.authority_revision, 1),
    lifecycleState: nullableText(show.lifecycle_state) ?? undefined,
  };
}

function parseEpisode(value: unknown): VideoShowEpisodeSummary | null {
  const episode = object(value);
  if (!text(episode.resource_id)) return null;
  return {
    resourceId: text(episode.resource_id),
    showResourceId: nullableText(episode.show_resource_id) ?? undefined,
    slug: text(episode.slug),
    title: text(episode.title),
    summary: nullableText(episode.summary),
    episodeNumber: episode.episode_number == null
      ? null
      : numberValue(episode.episode_number),
    authorityRevision: numberValue(episode.authority_revision, 1),
    lifecycleState: nullableText(episode.lifecycle_state) ?? undefined,
    videoPublicationId: nullableText(episode.video_publication_id),
  };
}

function versions(value: unknown): VideoPublicationSummary["versions"] {
  const item = object(value);
  return {
    working: nullableText(item.working),
    submitted: nullableText(item.submitted),
    approved: nullableText(item.approved),
    published: nullableText(item.published),
  };
}

function vocabulary(
  value: unknown,
  keyName: "classification" | "provider_key" | "track_kind",
): VideoAdminVocabularyItem[] {
  return array(value).map((item) => {
    const entry = object(item);
    return {
      key: text(entry[keyName]),
      label: text(entry.label),
      description: text(entry.description),
    };
  });
}

function parseSummary(value: unknown): VideoPublicationSummary {
  const item = object(value);
  return {
    id: text(item.id),
    resourceId: text(item.resource_id),
    resourceKind: text(item.resource_kind) === "video_episode"
      ? "video_episode"
      : "standalone_video",
    publicationKind: text(item.publication_kind) === "episode"
      ? "episode"
      : "standalone",
    slug: text(item.slug),
    title: text(item.title),
    summary: nullableText(item.summary),
    classification: text(item.classification),
    authorityRevision: numberValue(item.authority_revision, 1),
    lifecycleState: text(item.lifecycle_state, "draft"),
    selectedSource: parseSource(item.selected_source),
    show: parseShow(item.show),
    showEpisode: parseEpisode(item.show_episode),
    versions: versions(item.versions),
    updatedAt: text(item.updated_at),
  };
}

export async function fetchVideoAdminIndex(): Promise<VideoAdminIndex> {
  const { data, error } = await rpc()("list_admin_video_publications");
  throwRpc(error, "Video could not load.");
  const root = object(data);
  return {
    publications: array(root.publications).map(parseSummary),
    shows: array(root.shows).map(parseShow).filter((value): value is VideoShowSummary => Boolean(value)),
    showEpisodes: array(root.show_episodes).map(parseEpisode).filter((value): value is VideoShowEpisodeSummary => Boolean(value)),
    classifications: vocabulary(root.classifications, "classification"),
    sourceProviders: vocabulary(root.source_providers, "provider_key"),
    captionTrackKinds: vocabulary(root.caption_track_kinds, "track_kind"),
  };
}

export async function fetchVideoPublicationWorkspace(
  publicationId: string,
): Promise<VideoPublicationWorkspace> {
  const { data, error } = await rpc()(
    "get_admin_video_publication_workspace",
    { p_publication_id: publicationId },
  );
  throwRpc(error, "Video Editor could not load.");

  const root = object(data);
  const publication = object(root.publication);
  const resource = object(root.resource);
  const poster = object(root.poster);
  const transcript = object(root.transcript);
  const capabilities = object(root.capabilities);
  const trust = object(root.trust);
  const correctionProvenance = object(root.correction_provenance);
  const selectedSource = parseSource(root.selected_source);
  const mediaAsset = selectedSource?.sourceKind === "native_media" && selectedSource.mediaAssetId
    ? await getAdminMediaAssetById(selectedSource.mediaAssetId)
    : null;
  const mediaMetadata = object(mediaAsset?.metadata);
  const transcodeMetadata = object(
    mediaAsset?.selected_derivatives?.video_transcode?.technical_metadata,
  );
  const durationCandidate =
    mediaMetadata.duration_seconds
    ?? mediaMetadata.duration
    ?? transcodeMetadata.duration_seconds
    ?? transcodeMetadata.duration;

  return {
    publication: {
      id: text(publication.id),
      publicationKind: text(publication.publication_kind) === "episode"
        ? "episode"
        : "standalone",
      slug: text(publication.slug),
      title: text(publication.title),
      summary: nullableText(publication.summary),
      classification: text(publication.classification),
      authorityRevision: numberValue(publication.authority_revision, 1),
      metadata: object(publication.metadata),
      createdAt: text(publication.created_at),
      updatedAt: text(publication.updated_at),
    },
    resource: {
      id: text(resource.id),
      resourceKind: text(resource.resource_kind) === "video_episode"
        ? "video_episode"
        : "standalone_video",
      ownerId: nullableText(resource.owner_id),
      visibility: text(resource.visibility, "internal"),
      lifecycleState: text(resource.lifecycle_state, "draft"),
      versions: versions(resource.versions),
    },
    show: parseShow(root.show),
    showEpisode: parseEpisode(root.show_episode),
    selectedSource,
    selectedMedia: mediaAsset
      ? {
          assetId: mediaAsset.id,
          title: mediaAsset.title ?? null,
          primaryDeliveryUrl: mediaAsset.primary_delivery_url ?? mediaAsset.url ?? null,
          deliveryReady: mediaAsset.delivery_ready === true,
          mimeType: mediaAsset.mime_type ?? null,
          durationSeconds: durationCandidate == null
            ? null
            : numberValue(durationCandidate),
          posterFrameUrl:
            mediaAsset.selected_derivatives?.poster_frame?.url ?? null,
          thumbnailUrl:
            mediaAsset.selected_derivatives?.thumbnail?.url ?? null,
        }
      : null,
    poster: poster.asset_id
      ? {
          usageLinkId: text(poster.usage_link_id),
          assetId: text(poster.asset_id),
          assetRevisionId: text(poster.asset_revision_id),
        }
      : null,
    transcript: transcript.asset_id
      ? {
          usageLinkId: text(transcript.usage_link_id),
          assetId: text(transcript.asset_id),
          assetRevisionId: text(transcript.asset_revision_id),
        }
      : null,
    captions: array(root.captions).map((value) => {
      const item = object(value);
      return {
        id: nullableText(item.id) ?? undefined,
        assetId: text(item.media_asset_id),
        assetRevisionId: text(item.media_asset_revision_id),
        languageTag: text(item.language_tag),
        trackKind: text(item.track_kind),
        label: text(item.label),
        isDefault: bool(item.is_default),
        displayOrder: numberValue(item.display_order),
      };
    }),
    chapters: array(root.chapters).map((value) => {
      const item = object(value);
      return {
        id: nullableText(item.id) ?? undefined,
        chapterNumber: numberValue(item.chapter_number),
        startSeconds: numberValue(item.start_seconds),
        title: text(item.title),
        description: nullableText(item.description),
      };
    }),
    versionHistory: array(root.version_history).map(object),
    reviewEvents: array(root.review_events).map(object),
    lifecycleEvents: array(root.lifecycle_events).map(object),
    trust: {
      citationRevision: numberValue(trust.citation_revision, 1),
      creditRevision: numberValue(trust.credit_revision, 1),
      citations: array(trust.citations).map((value) => {
        const item = object(value);
        return {
          attachmentId: text(item.attachment_id),
          citationId: text(item.citation_id),
          citationPurpose: text(item.citation_purpose, "supports"),
          targetAnchorType: text(item.target_anchor_type, "whole_version"),
          targetAnchorData: object(item.target_anchor_data),
          displayOrder: numberValue(item.display_order),
          publicSafe: bool(item.public_safe),
          publicLabel: nullableText(item.public_label),
          quotation: nullableText(item.quotation),
          citationState: text(item.citation_state),
        };
      }),
      credits: array(trust.credits).map((value) => {
        const item = object(value);
        return {
          attachmentId: text(item.attachment_id),
          creditId: text(item.credit_id),
          displayOrder: numberValue(item.display_order),
          isPrimary: bool(item.is_primary),
          publicSafe: bool(item.public_safe),
          creditRole: text(item.credit_role),
          displayName: text(item.display_name),
          roleLabel: nullableText(item.role_label),
        };
      }),
    },
    correctionProvenance: {
      canView: bool(correctionProvenance.can_view),
      cases: array(correctionProvenance.cases).map((value) => {
        const item = object(value);
        return {
          caseResourceId: text(item.case_resource_id),
          caseReference: text(item.case_reference),
          caseState: text(item.case_state),
          correctionKind: nullableText(item.correction_kind),
          priority: nullableText(item.priority),
          targetId: text(item.target_id),
          targetVersionId: text(item.target_version_id),
          targetVersionType: text(item.target_version_type),
          targetRole: text(item.target_role),
          targetSummary: nullableText(item.target_summary),
          observedContentFingerprint: nullableText(item.observed_content_fingerprint),
          versionKind: text(item.version_kind),
          versionNumber: numberValue(item.version_number),
          currentDecisionOutcome: nullableText(item.current_decision_outcome),
          currentDecisionPublicSafeExplanation: nullableText(
            item.current_decision_public_safe_explanation,
          ),
          createdAt: text(item.created_at),
          updatedAt: text(item.updated_at),
        };
      }),
    },
    classifications: vocabulary(root.classifications, "classification"),
    sourceProviders: vocabulary(root.source_providers, "provider_key"),
    captionTrackKinds: vocabulary(root.caption_track_kinds, "track_kind"),
    capabilities: {
      canView: bool(capabilities.can_view),
      canEdit: bool(capabilities.can_edit),
      canManageReview: bool(capabilities.can_manage_review),
      canPublish: bool(capabilities.can_publish),
    },
  };
}

async function command(
  name: string,
  args: Record<string, unknown>,
  fallback: string,
): Promise<JsonObject> {
  const { data, error } = await rpc()(name, args);
  throwRpc(error, fallback);
  return requireSucceeded(row(data), fallback);
}

async function currentRevision(assetId: string): Promise<string> {
  const asset = await getAdminMediaAssetById(assetId);
  if (!asset?.current_revision_id) {
    throw new Error("Select a canonical Media asset with a current revision.");
  }
  return asset.current_revision_id;
}

export async function createVideoPublication(input: {
  publicationKind: VideoPublicationKind;
  classification: string;
  title?: string;
  slug?: string;
  summary?: string;
  showEpisodeResourceId?: string;
  visibility?: "private" | "internal" | "public";
  metadata?: JsonObject;
}): Promise<JsonObject> {
  return command("create_video_publication", {
    p_publication_kind: input.publicationKind,
    p_title: input.title?.trim() || null,
    p_slug: input.slug?.trim() || null,
    p_classification: input.classification,
    p_idempotency_key: idempotency("video-publication-create"),
    p_show_episode_resource_id: input.showEpisodeResourceId || null,
    p_summary: input.summary?.trim() || null,
    p_visibility: input.visibility ?? "internal",
    p_metadata: input.metadata ?? {},
    p_correlation_id: crypto.randomUUID(),
  }, "Video publication could not be created.");
}

export async function updateVideoPublicationMetadata(
  publicationId: string,
  authorityRevision: number,
  payload: JsonObject,
): Promise<JsonObject> {
  return command("update_video_publication_metadata", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_payload: payload,
    p_idempotency_key: idempotency("video-metadata"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video metadata could not be saved.");
}

export async function registerExternalVideoSource(
  publicationId: string,
  authorityRevision: number,
  input: {
    providerKey: string;
    providerObjectId: string;
    canonicalUrl: string;
    sourceMetadata?: JsonObject;
  },
): Promise<JsonObject> {
  return command("register_video_source", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_source_kind: "external_provider",
    p_idempotency_key: idempotency("video-source-provider"),
    p_media_asset_id: null,
    p_media_asset_revision_id: null,
    p_provider_key: input.providerKey,
    p_provider_object_id: input.providerObjectId,
    p_canonical_url: input.canonicalUrl,
    p_source_metadata: input.sourceMetadata ?? {},
    p_correlation_id: crypto.randomUUID(),
  }, "Video provider source could not be registered.");
}

export async function registerNativeVideoSource(
  publicationId: string,
  authorityRevision: number,
  assetId: string,
): Promise<JsonObject> {
  const revisionId = await currentRevision(assetId);
  return command("register_video_source", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_source_kind: "native_media",
    p_idempotency_key: idempotency("video-source-native"),
    p_media_asset_id: assetId,
    p_media_asset_revision_id: revisionId,
    p_provider_key: null,
    p_provider_object_id: null,
    p_canonical_url: null,
    p_source_metadata: {},
    p_correlation_id: crypto.randomUUID(),
  }, "Native Video source could not be registered.");
}

export async function setVideoPublicationSource(
  publicationId: string,
  authorityRevision: number,
  sourceId: string,
): Promise<JsonObject> {
  return command("set_video_publication_source", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_source_id: sourceId,
    p_idempotency_key: idempotency("video-source-select"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video source could not be selected.");
}

export async function bindVideoPublicationShowEpisode(
  publicationId: string,
  authorityRevision: number,
  showEpisodeResourceId: string,
): Promise<JsonObject> {
  return command("bind_video_publication_show_episode", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_show_episode_resource_id: showEpisodeResourceId,
    p_idempotency_key: idempotency("video-show-episode"),
    p_correlation_id: crypto.randomUUID(),
  }, "Shared Show Episode could not be bound.");
}

async function setExactVideoMedia(
  rpcName: "set_video_publication_poster" | "set_video_publication_transcript",
  prefix: string,
  publicationId: string,
  authorityRevision: number,
  assetId: string | null,
  placementData: JsonObject = {},
): Promise<JsonObject> {
  const revisionId = assetId ? await currentRevision(assetId) : null;
  return command(rpcName, {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_asset_id: assetId,
    p_asset_revision_id: revisionId,
    p_placement_data: placementData,
    p_idempotency_key: idempotency(prefix),
    p_correlation_id: crypto.randomUUID(),
  }, "Video Media relationship could not be saved.");
}

export function setVideoPublicationPoster(
  publicationId: string,
  authorityRevision: number,
  assetId: string | null,
  placementData: JsonObject = {},
): Promise<JsonObject> {
  return setExactVideoMedia(
    "set_video_publication_poster",
    "video-poster",
    publicationId,
    authorityRevision,
    assetId,
    placementData,
  );
}

export function setVideoPublicationTranscript(
  publicationId: string,
  authorityRevision: number,
  assetId: string | null,
  placementData: JsonObject = {},
): Promise<JsonObject> {
  return setExactVideoMedia(
    "set_video_publication_transcript",
    "video-transcript",
    publicationId,
    authorityRevision,
    assetId,
    placementData,
  );
}

export async function replaceVideoPublicationCaptions(
  publicationId: string,
  authorityRevision: number,
  tracks: Array<{
    assetId: string;
    languageTag: string;
    trackKind: string;
    label: string;
    isDefault?: boolean;
  }>,
): Promise<JsonObject> {
  const resolved = await Promise.all(
    tracks.map(async (track) => ({
      media_asset_id: track.assetId,
      media_asset_revision_id: await currentRevision(track.assetId),
      language_tag: track.languageTag,
      track_kind: track.trackKind,
      label: track.label,
      is_default: track.isDefault ?? false,
    })),
  );

  return command("replace_video_publication_captions", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_tracks: resolved,
    p_idempotency_key: idempotency("video-captions"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video captions could not be saved.");
}

export function replaceVideoPublicationChapters(
  publicationId: string,
  authorityRevision: number,
  chapters: Array<{
    startSeconds: number;
    title: string;
    description?: string | null;
  }>,
): Promise<JsonObject> {
  return command("replace_video_publication_chapters", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_chapters: chapters.map((chapter) => ({
      start_seconds: chapter.startSeconds,
      title: chapter.title,
      description: chapter.description ?? null,
    })),
    p_idempotency_key: idempotency("video-chapters"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video chapters could not be saved.");
}

export function replaceVideoPublicationVersionCitations(
  workspace: VideoPublicationWorkspace,
  citationIds: string[],
): Promise<JsonObject> {
  if (!workspace.resource.versions.working) {
    throw new Error("Save a working Video version before changing Citations.");
  }
  return command("replace_video_publication_version_citations", {
    p_publication_version_id: workspace.resource.versions.working,
    p_attachments: citationIds.map((citationId) => ({
      citation_id: citationId,
      citation_purpose: "supports",
      target_anchor_type: "whole_version",
      target_anchor_data: {},
      public_safe: true,
    })),
    p_expected_citation_revision: workspace.trust.citationRevision,
    p_idempotency_key: idempotency("video-citations-replace"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video Citations could not be saved.");
}

export function replaceVideoPublicationVersionCredits(
  workspace: VideoPublicationWorkspace,
  creditIds: string[],
): Promise<JsonObject> {
  if (!workspace.resource.versions.working) {
    throw new Error("Save a working Video version before changing Credits.");
  }
  return command("replace_video_publication_version_credits", {
    p_publication_version_id: workspace.resource.versions.working,
    p_attachments: creditIds.map((creditId) => ({
      credit_id: creditId,
      is_primary: false,
      public_safe: true,
    })),
    p_expected_credit_revision: workspace.trust.creditRevision,
    p_idempotency_key: idempotency("video-credits-replace"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video Credits could not be saved.");
}

export function snapshotVideoPublicationWorkingVersion(
  publicationId: string,
  authorityRevision: number,
): Promise<JsonObject> {
  return command("snapshot_video_publication_working_version", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_idempotency_key: idempotency("video-snapshot"),
    p_correlation_id: crypto.randomUUID(),
  }, "Video working version could not be snapshotted.");
}

export function submitVideoPublicationForReview(
  publicationId: string,
  authorityRevision: number,
  note?: string,
): Promise<JsonObject> {
  return command("submit_video_publication_for_review", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_idempotency_key: idempotency("video-review-submit"),
    p_note: note?.trim() || null,
    p_correlation_id: crypto.randomUUID(),
  }, "Video could not be submitted for review.");
}

export function reviewVideoPublication(
  publicationId: string,
  authorityRevision: number,
  submittedVersionId: string,
  decision: VideoReviewDecision,
  note?: string,
): Promise<JsonObject> {
  return command("review_video_publication", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_submitted_version_id: submittedVersionId,
    p_decision: decision,
    p_idempotency_key: idempotency("video-review-decision"),
    p_note: note?.trim() || null,
    p_correlation_id: crypto.randomUUID(),
  }, "Video review decision could not be saved.");
}

export function publishVideoPublicationVersion(
  publicationId: string,
  authorityRevision: number,
  approvedVersionId: string,
  note?: string,
): Promise<JsonObject> {
  return command("publish_video_publication_version", {
    p_publication_id: publicationId,
    p_expected_authority_revision: authorityRevision,
    p_approved_version_id: approvedVersionId,
    p_idempotency_key: idempotency("video-publish"),
    p_note: note?.trim() || null,
    p_correlation_id: crypto.randomUUID(),
  }, "Video could not be published.");
}
