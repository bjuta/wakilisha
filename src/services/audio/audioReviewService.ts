import { supabase } from "@/lib/supabase";

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        functionName: string,
        parameters: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message?: string } | null;
      }>;
    }
  ).rpc(name, args);

  if (error) throw new Error(error.message || "Audio review request failed.");
  return data;
}

export interface AudioReviewChapter {
  chapterNumber: number;
  startSeconds: number;
  title: string;
}

export interface AudioReviewTargetVersion {
  id: string;
  versionNumber: number;
  versionKind: string;
  contentFingerprint: string;
  createdBy: string | null;
  createdAt: string;
  deliveryUrl: string | null;
  waveformUrl: string | null;
  durationSeconds: number | null;
  sourceProbe: Row;
  chapters: AudioReviewChapter[];
}

export interface AudioReviewComment {
  id: string;
  threadId: string;
  bodyHtml: string;
  bodyText: string;
  createdBy: string | null;
  createdByLabel: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface AudioReviewThread {
  id: string;
  resourceId: string;
  publicationId: string;
  targetVersionId: string;
  anchorKind: "time_point" | "time_range";
  anchorStartSeconds: number;
  anchorEndSeconds: number | null;
  status: "open" | "resolved";
  createdBy: string | null;
  createdByLabel: string;
  resolvedBy: string | null;
  resolvedByLabel: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: AudioReviewComment[];
}

export interface AudioEditorialWorkbench {
  publicationId: string;
  resourceId: string;
  currentSubmittedVersionId: string | null;
  canParticipateReview: boolean;
  targetVersion: AudioReviewTargetVersion | null;
  threads: AudioReviewThread[];
}

function parseComment(value: unknown): AudioReviewComment {
  const item = row(value);
  return {
    id: text(item.id),
    threadId: text(item.thread_id),
    bodyHtml: text(item.body_html),
    bodyText: text(item.body_text),
    createdBy: nullableText(item.created_by),
    createdByLabel: text(item.created_by_label) || "system",
    createdAt: text(item.created_at),
    editedAt: nullableText(item.edited_at),
    deletedAt: nullableText(item.deleted_at),
  };
}

function parseThread(value: unknown): AudioReviewThread {
  const item = row(value);
  return {
    id: text(item.id),
    resourceId: text(item.resource_id),
    publicationId: text(item.publication_id),
    targetVersionId: text(item.target_version_id),
    anchorKind: text(item.anchor_kind) === "time_range" ? "time_range" : "time_point",
    anchorStartSeconds: number(item.anchor_start_seconds),
    anchorEndSeconds: nullableNumber(item.anchor_end_seconds),
    status: text(item.status) === "resolved" ? "resolved" : "open",
    createdBy: nullableText(item.created_by),
    createdByLabel: text(item.created_by_label) || "system",
    resolvedBy: nullableText(item.resolved_by),
    resolvedByLabel: nullableText(item.resolved_by_label),
    resolvedAt: nullableText(item.resolved_at),
    createdAt: text(item.created_at),
    updatedAt: text(item.updated_at),
    comments: array(item.comments).map(parseComment),
  };
}

function parseTarget(value: unknown): AudioReviewTargetVersion | null {
  if (value == null) return null;
  const item = row(value);
  const id = text(item.id);
  if (!id) return null;
  return {
    id,
    versionNumber: number(item.version_number),
    versionKind: text(item.version_kind),
    contentFingerprint: text(item.content_fingerprint),
    createdBy: nullableText(item.created_by),
    createdAt: text(item.created_at),
    deliveryUrl: nullableText(item.delivery_url),
    waveformUrl: nullableText(item.waveform_url),
    durationSeconds: nullableNumber(item.duration_seconds),
    sourceProbe: row(item.source_probe),
    chapters: array(item.chapters).map((value) => {
      const chapter = row(value);
      return {
        chapterNumber: number(chapter.chapter_number),
        startSeconds: number(chapter.start_seconds),
        title: text(chapter.title),
      };
    }),
  };
}

export async function fetchAudioEditorialWorkbench(
  publicationId: string,
): Promise<AudioEditorialWorkbench> {
  const value = row(await rpc("get_audio_editorial_workbench", {
    p_publication_id: publicationId,
  }));

  return {
    publicationId: text(value.publication_id),
    resourceId: text(value.resource_id),
    currentSubmittedVersionId: nullableText(value.current_submitted_version_id),
    canParticipateReview: value.can_participate_review === true,
    targetVersion: parseTarget(value.target_version),
    threads: array(value.threads).map(parseThread),
  };
}

export async function createAudioTimeReviewThread(input: {
  publicationId: string;
  targetVersionId: string;
  anchorKind: "time_point" | "time_range";
  anchorStartSeconds: number;
  anchorEndSeconds: number | null;
  bodyHtml: string;
  bodyText: string;
}): Promise<void> {
  await rpc("create_audio_time_review_thread", {
    p_publication_id: input.publicationId,
    p_target_version_id: input.targetVersionId,
    p_anchor_kind: input.anchorKind,
    p_anchor_start_seconds: input.anchorStartSeconds,
    p_anchor_end_seconds: input.anchorEndSeconds,
    p_body_html: input.bodyHtml,
    p_body_text: input.bodyText,
  });
}

export async function addAudioReviewComment(input: {
  threadId: string;
  bodyHtml: string;
  bodyText: string;
}): Promise<void> {
  await rpc("add_audio_review_comment", {
    p_thread_id: input.threadId,
    p_body_html: input.bodyHtml,
    p_body_text: input.bodyText,
  });
}

export async function setAudioReviewThreadStatus(
  threadId: string,
  status: "open" | "resolved",
): Promise<void> {
  await rpc("set_audio_review_thread_status", {
    p_thread_id: threadId,
    p_status: status,
  });
}
