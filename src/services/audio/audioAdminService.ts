import { supabase } from "@/lib/supabase";
import { getAdminMediaAssetById } from "@/services/adminMediaReadService";
import type { Json } from "@/types/database.types";

type JsonObject = Record<string, unknown>;

export interface AudioShowSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  authorityRevision: number;
}

export interface AudioSeasonSummary {
  id: string;
  showId: string;
  seasonNumber: number;
  title: string;
  authorityRevision: number;
}

export interface AudioPublicationSummary {
  id: string;
  publicationKind: "episode" | "standalone";
  showId: string | null;
  seasonId: string | null;
  episodeNumber: number | null;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  authorityRevision: number;
  updatedAt: string;
}

export interface AudioChapter {
  id?: string;
  chapterNumber: number;
  startSeconds: number;
  title: string;
  chapterUrl: string | null;
  imageUrl: string | null;
}

export interface AudioTrustCitation {
  attachmentId: string;
  citationId: string;
  citationPurpose: string;
  targetAnchorType: string;
  targetAnchorData: Json;
  displayOrder: number;
  publicSafe: boolean;
  publicLabel: string | null;
  quotation: string | null;
  citationState: string;
}

export interface AudioTrustCredit {
  attachmentId: string;
  creditId: string;
  displayOrder: number;
  isPrimary: boolean;
  publicSafe: boolean;
  creditRole: string;
  displayName: string;
  roleLabel: string | null;
}

export interface AudioReviewEvent {
  id: string;
  eventNumber: number;
  action: string;
  targetVersionId: string | null;
  resultVersionId: string | null;
  priorStatus: string | null;
  resultingStatus: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface AudioPublicationWorkspace {
  publication: AudioPublicationSummary & {
    metadata: JsonObject;
    createdAt: string;
  };
  resourceId: string;
  versions: {
    working: string | null;
    submitted: string | null;
    approved: string | null;
    published: string | null;
  };
  master: {
    usageLinkId: string;
    assetId: string;
    assetRevisionId: string;
    audioDeliveryVariantId: string | null;
  } | null;
  transcript: {
    usageLinkId: string;
    assetId: string;
    assetRevisionId: string;
  } | null;
  chapters: AudioChapter[];
  reviewEvents: AudioReviewEvent[];
  trust: {
    citationRevision: number;
    creditRevision: number;
    citations: AudioTrustCitation[];
    credits: AudioTrustCredit[];
  };
  feedIdentity: {
    guid: string;
    enclosureUrl: string;
  } | null;
  canEdit: boolean;
  canManageReview: boolean;
  canPublish: boolean;
}

export interface AudioAdminIndex {
  shows: AudioShowSummary[];
  seasons: AudioSeasonSummary[];
  publications: AudioPublicationSummary[];
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function jsonValue(value: unknown): Json {
  return value as Json;
}

function unwrapRow(data: unknown): JsonObject {
  if (Array.isArray(data)) return object(data[0]);
  return object(data);
}

function throwRpc(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

export function slugifyAudioTitle(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function fetchAudioAdminIndex(): Promise<AudioAdminIndex> {
  const { data, error } = await supabase.rpc("list_admin_audio_publications");
  throwRpc(error, "Audio could not load.");
  const root = object(data);

  return {
    shows: array(root.shows).map((value) => {
      const row = object(value);
      return {
        id: text(row.id),
        title: text(row.title),
        slug: text(row.slug),
        description: nullableText(row.description),
        authorityRevision: numberValue(row.authority_revision, 1),
      };
    }),
    seasons: array(root.seasons).map((value) => {
      const row = object(value);
      return {
        id: text(row.id),
        showId: text(row.show_id),
        seasonNumber: numberValue(row.season_number),
        title: text(row.title),
        authorityRevision: numberValue(row.authority_revision, 1),
      };
    }),
    publications: array(root.publications).map((value) => {
      const row = object(value);
      return {
        id: text(row.id),
        publicationKind: text(row.publication_kind) === "episode"
          ? "episode"
          : "standalone",
        showId: nullableText(row.show_id),
        seasonId: nullableText(row.season_id),
        episodeNumber: nullableNumber(row.episode_number),
        title: text(row.title),
        slug: text(row.slug),
        summary: nullableText(row.summary),
        status: text(row.status, "draft"),
        authorityRevision: numberValue(row.authority_revision, 1),
        updatedAt: text(row.updated_at),
      };
    }),
  };
}

export async function fetchAudioPublicationWorkspace(
  publicationId: string,
): Promise<AudioPublicationWorkspace> {
  const { data, error } = await supabase.rpc(
    "get_admin_audio_publication_workspace",
    { p_publication_id: publicationId },
  );
  throwRpc(error, "Audio Editor could not load.");
  const root = object(data);
  const publication = object(root.publication);
  const versions = object(root.versions);
  const master = object(root.master);
  const transcript = object(root.transcript);
  const trust = object(root.trust);
  const feed = object(root.feed_identity);

  return {
    publication: {
      id: text(publication.id),
      publicationKind: text(publication.publication_kind) === "episode"
        ? "episode"
        : "standalone",
      showId: nullableText(publication.show_id),
      seasonId: nullableText(publication.season_id),
      episodeNumber: nullableNumber(publication.episode_number),
      title: text(publication.title),
      slug: text(publication.slug),
      summary: nullableText(publication.summary),
      status: text(publication.status, "draft"),
      authorityRevision: numberValue(publication.authority_revision, 1),
      updatedAt: text(publication.updated_at),
      createdAt: text(publication.created_at),
      metadata: object(publication.metadata),
    },
    resourceId: text(root.resource_id),
    versions: {
      working: nullableText(versions.working),
      submitted: nullableText(versions.submitted),
      approved: nullableText(versions.approved),
      published: nullableText(versions.published),
    },
    master: master.asset_id
      ? {
          usageLinkId: text(master.usage_link_id),
          assetId: text(master.asset_id),
          assetRevisionId: text(master.asset_revision_id),
          audioDeliveryVariantId: nullableText(master.audio_delivery_variant_id),
        }
      : null,
    transcript: transcript.asset_id
      ? {
          usageLinkId: text(transcript.usage_link_id),
          assetId: text(transcript.asset_id),
          assetRevisionId: text(transcript.asset_revision_id),
        }
      : null,
    chapters: array(root.chapters).map((value) => {
      const row = object(value);
      return {
        id: nullableText(row.id) ?? undefined,
        chapterNumber: numberValue(row.chapter_number),
        startSeconds: numberValue(row.start_seconds),
        title: text(row.title),
        chapterUrl: nullableText(row.chapter_url),
        imageUrl: nullableText(row.image_url),
      };
    }),
    reviewEvents: array(root.review_events).map((value) => {
      const row = object(value);
      return {
        id: text(row.id),
        eventNumber: numberValue(row.event_number),
        action: text(row.action),
        targetVersionId: nullableText(row.target_version_id),
        resultVersionId: nullableText(row.result_version_id),
        priorStatus: nullableText(row.prior_status),
        resultingStatus: text(row.resulting_status),
        reason: nullableText(row.reason),
        actorId: nullableText(row.actor_id),
        createdAt: text(row.created_at),
      };
    }),
    trust: {
      citationRevision: numberValue(trust.citation_revision, 1),
      creditRevision: numberValue(trust.credit_revision, 1),
      citations: array(trust.citations).map((value) => {
        const row = object(value);
        return {
          attachmentId: text(row.attachment_id),
          citationId: text(row.citation_id),
          citationPurpose: text(row.citation_purpose, "supports"),
          targetAnchorType: text(row.target_anchor_type, "whole_version"),
          targetAnchorData: jsonValue(row.target_anchor_data ?? {}),
          displayOrder: numberValue(row.display_order),
          publicSafe: bool(row.public_safe),
          publicLabel: nullableText(row.public_label),
          quotation: nullableText(row.quotation),
          citationState: text(row.citation_state),
        };
      }),
      credits: array(trust.credits).map((value) => {
        const row = object(value);
        return {
          attachmentId: text(row.attachment_id),
          creditId: text(row.credit_id),
          displayOrder: numberValue(row.display_order),
          isPrimary: bool(row.is_primary),
          publicSafe: bool(row.public_safe),
          creditRole: text(row.credit_role),
          displayName: text(row.display_name),
          roleLabel: nullableText(row.role_label),
        };
      }),
    },
    feedIdentity: feed.guid
      ? {
          guid: text(feed.guid),
          enclosureUrl: text(feed.enclosure_url),
        }
      : null,
    canEdit: bool(root.can_edit),
    canManageReview: bool(root.can_manage_review),
    canPublish: bool(root.can_publish),
  };
}

function idempotency(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

export async function createAudioShow(input: {
  title: string;
  slug: string;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_audio_show", {
    p_title: input.title.trim(),
    p_slug: slugifyAudioTitle(input.slug || input.title),
    p_description: input.description?.trim() || null,
    p_visibility: "internal",
    p_metadata: {},
    p_idempotency_key: idempotency("audio-show-create"),
  });
  throwRpc(error, "Show could not be created.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded" || !row.show_id) {
    throw new Error("Show could not be created.");
  }
  return text(row.show_id);
}

export async function createAudioSeason(input: {
  showId: string;
  seasonNumber: number;
  title: string;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_audio_season", {
    p_show_id: input.showId,
    p_season_number: input.seasonNumber,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_metadata: {},
    p_idempotency_key: idempotency("audio-season-create"),
  });
  throwRpc(error, "Season could not be created.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded" || !row.season_id) {
    throw new Error("Season could not be created.");
  }
  return text(row.season_id);
}

export async function createAudioPublication(input: {
  publicationKind: "episode" | "standalone";
  title: string;
  slug: string;
  summary?: string;
  showId?: string | null;
  seasonId?: string | null;
  episodeNumber?: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_audio_publication", {
    p_publication_kind: input.publicationKind,
    p_title: input.title.trim(),
    p_slug: slugifyAudioTitle(input.slug || input.title),
    p_show_id: input.publicationKind === "episode" ? input.showId ?? null : null,
    p_season_id: input.publicationKind === "episode" ? input.seasonId ?? null : null,
    p_episode_number: input.publicationKind === "episode"
      ? input.episodeNumber ?? null
      : null,
    p_summary: input.summary?.trim() || null,
    p_visibility: "internal",
    p_metadata: {},
    p_idempotency_key: idempotency("audio-publication-create"),
  });
  throwRpc(error, "Audio could not be created.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded" || !row.publication_id) {
    throw new Error("Audio could not be created.");
  }
  return text(row.publication_id);
}

export async function saveAudioMetadata(
  workspace: AudioPublicationWorkspace,
  input: { title: string; slug: string; summary: string },
): Promise<void> {
  const { data, error } = await supabase.rpc("update_audio_publication_metadata", {
    p_publication_id: workspace.publication.id,
    p_expected_authority_revision: workspace.publication.authorityRevision,
    p_payload: {
      title: input.title.trim(),
      slug: slugifyAudioTitle(input.slug || input.title),
      summary: input.summary.trim() || null,
    },
    p_idempotency_key: idempotency("audio-publication-metadata"),
  });
  throwRpc(error, "Audio details could not be saved.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Audio details changed somewhere else. Reload and try again.");
  }
}

export async function snapshotAudioWorkingVersion(
  workspace: AudioPublicationWorkspace,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "snapshot_audio_publication_working_version",
    {
      p_publication_id: workspace.publication.id,
      p_expected_authority_revision: workspace.publication.authorityRevision,
      p_idempotency_key: idempotency("audio-working-snapshot"),
    },
  );
  throwRpc(error, "Working version could not be saved.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Working version could not be saved.");
  }
}

async function exactMediaRevision(assetId: string): Promise<string> {
  const asset = await getAdminMediaAssetById(assetId);
  const revisionId = asset?.current_revision_id;
  if (!revisionId) {
    throw new Error("Choose Media with a verified current revision.");
  }
  return revisionId;
}

export async function setAudioMaster(
  workspace: AudioPublicationWorkspace,
  assetId: string | null,
): Promise<void> {
  const revisionId = assetId ? await exactMediaRevision(assetId) : null;
  const { data, error } = await supabase.rpc("set_audio_publication_master", {
    p_publication_id: workspace.publication.id,
    p_expected_authority_revision: workspace.publication.authorityRevision,
    p_asset_id: assetId,
    p_asset_revision_id: revisionId,
    p_idempotency_key: idempotency("audio-master-set"),
  });
  throwRpc(error, "Master audio could not be changed.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Master audio changed somewhere else. Reload and try again.");
  }
}

export async function setAudioTranscript(
  workspace: AudioPublicationWorkspace,
  assetId: string | null,
): Promise<void> {
  const revisionId = assetId ? await exactMediaRevision(assetId) : null;
  const { data, error } = await supabase.rpc("set_audio_publication_transcript", {
    p_publication_id: workspace.publication.id,
    p_expected_authority_revision: workspace.publication.authorityRevision,
    p_asset_id: assetId,
    p_asset_revision_id: revisionId,
    p_idempotency_key: idempotency("audio-transcript-set"),
  });
  throwRpc(error, "Transcript could not be changed.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Transcript changed somewhere else. Reload and try again.");
  }
}

export async function replaceAudioChapters(
  workspace: AudioPublicationWorkspace,
  chapters: AudioChapter[],
): Promise<void> {
  const { data, error } = await supabase.rpc("replace_audio_publication_chapters", {
    p_publication_id: workspace.publication.id,
    p_expected_authority_revision: workspace.publication.authorityRevision,
    p_chapters: chapters.map((chapter) => ({
      start_seconds: chapter.startSeconds,
      title: chapter.title.trim(),
      chapter_url: chapter.chapterUrl,
      image_url: chapter.imageUrl,
    })),
    p_idempotency_key: idempotency("audio-chapters-replace"),
  });
  throwRpc(error, "Chapters could not be saved.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Chapters changed somewhere else. Reload and try again.");
  }
}

export async function replaceAudioCitations(
  workspace: AudioPublicationWorkspace,
  citationIds: string[],
): Promise<void> {
  if (!workspace.versions.working) {
    throw new Error("Save a working version before changing Citations.");
  }
  const { data, error } = await supabase.rpc(
    "replace_audio_publication_version_citations",
    {
      p_publication_version_id: workspace.versions.working,
      p_attachments: citationIds.map((citationId) => ({
        citation_id: citationId,
        citation_purpose: "supports",
        target_anchor_type: "whole_version",
        target_anchor_data: {},
        public_safe: true,
      })),
      p_expected_citation_revision: workspace.trust.citationRevision,
      p_idempotency_key: idempotency("audio-citations-replace"),
    },
  );
  throwRpc(error, "Citations could not be saved.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Citations changed somewhere else. Reload and try again.");
  }
}

export async function replaceAudioCredits(
  workspace: AudioPublicationWorkspace,
  creditIds: string[],
): Promise<void> {
  if (!workspace.versions.working) {
    throw new Error("Save a working version before changing Credits.");
  }
  const { data, error } = await supabase.rpc(
    "replace_audio_publication_version_credits",
    {
      p_publication_version_id: workspace.versions.working,
      p_attachments: creditIds.map((creditId, index) => ({
        credit_id: creditId,
        is_primary: index === 0,
        public_safe: true,
      })),
      p_expected_credit_revision: workspace.trust.creditRevision,
      p_idempotency_key: idempotency("audio-credits-replace"),
    },
  );
  throwRpc(error, "Credits could not be saved.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Credits changed somewhere else. Reload and try again.");
  }
}

export async function submitAudioForReview(
  workspace: AudioPublicationWorkspace,
  note: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "submit_audio_publication_for_review",
    {
      p_publication_id: workspace.publication.id,
      p_expected_authority_revision: workspace.publication.authorityRevision,
      p_idempotency_key: idempotency("audio-review-submit"),
      p_note: note.trim() || null,
    },
  );
  throwRpc(error, "Audio could not be sent to Review.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error(
      text(object(row.result_payload).message)
      || "Audio is not ready for Review.",
    );
  }
}

export async function reviewAudio(
  workspace: AudioPublicationWorkspace,
  decision: "start_review" | "request_changes" | "approve",
  note: string,
): Promise<void> {
  if (!workspace.versions.submitted) {
    throw new Error("There is no submitted version to review.");
  }
  const { data, error } = await supabase.rpc("review_audio_publication", {
    p_publication_id: workspace.publication.id,
    p_expected_authority_revision: workspace.publication.authorityRevision,
    p_submitted_version_id: workspace.versions.submitted,
    p_decision: decision,
    p_idempotency_key: idempotency(`audio-review-${decision}`),
    p_note: note.trim() || null,
  });
  throwRpc(error, "Review action could not be completed.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Review state changed somewhere else. Reload and try again.");
  }
}

export async function publishAudio(
  workspace: AudioPublicationWorkspace,
  note: string,
): Promise<void> {
  if (!workspace.versions.approved) {
    throw new Error("Approve an exact version before publishing.");
  }
  const { data, error } = await supabase.rpc(
    "publish_audio_publication_version",
    {
      p_publication_id: workspace.publication.id,
      p_expected_authority_revision: workspace.publication.authorityRevision,
      p_approved_version_id: workspace.versions.approved,
      p_idempotency_key: idempotency("audio-publish"),
      p_note: note.trim() || null,
    },
  );
  throwRpc(error, "Audio could not be published.");
  const row = unwrapRow(data);
  if (text(row.receipt_status) !== "succeeded") {
    throw new Error("Audio is not ready to publish.");
  }
}
