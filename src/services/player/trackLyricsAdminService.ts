import { supabase } from "@/lib/supabase";
import type { TimedTextLine } from "@/services/player/timedText";

export type TrackLyricsContributionStatus =
  | "submitted"
  | "promoted"
  | "rejected";

export type TrackLyricsAcceptanceMode =
  | "as_submitted"
  | "with_revisions";

export type TrackLyricsContributionKind =
  | "submission"
  | "correction";

export interface TrackLyricsInboxItem {
  id: string;
  trackId: string;
  trackTitle: string;
  trackSlug: string;
  artworkUrl: string | null;
  artists: string[];
  contributorId: string | null;
  contributorLabel: string;
  contributorUsername: string | null;
  contributionKind: TrackLyricsContributionKind;
  languageCode: string;
  timingMode: "plain" | "line";
  lines: TimedTextLine[];
  plainText: string;
  sourceDescription: string | null;
  status: TrackLyricsContributionStatus;
  acceptanceMode: TrackLyricsAcceptanceMode | null;
  acceptedVersionId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface TrackLyricsAdminTrackResult {
  id: string;
  slug: string;
  title: string;
  artworkUrl: string | null;
  artists: string[];
  hasPublishedLyrics: boolean;
  pendingContributionCount: number;
}

type AnyRecord = Record<string, unknown>;

type UntypedRpcResponse = {
  data: unknown;
  error: { message: string } | null;
};

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as AnyRecord
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function decodeLines(value: unknown): TimedTextLine[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate, index) => {
    const row = record(candidate);
    const lineText = text(row.text).trim();
    if (!lineText) return [];

    const rawStart = row.start_seconds;
    const start =
      rawStart === null || rawStart === undefined
        ? null
        : Number(rawStart);

    return [{
      id: text(row.id) || `line-${index + 1}`,
      text: lineText,
      startSeconds:
        start !== null && Number.isFinite(start)
          ? start
          : null,
    }];
  });
}

async function invokeUntypedRpc(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<UntypedRpcResponse>;
  };

  const { data, error } = await client.rpc(functionName, payload);
  if (error) throw new Error(error.message);
  return data;
}

function decodeInboxItem(value: unknown): TrackLyricsInboxItem | null {
  const row = record(value);
  const id = text(row.id ?? row.contribution_id);
  const trackId = text(row.track_id);
  if (!id || !trackId) return null;

  const rawStatus = text(row.status);
  const status: TrackLyricsContributionStatus =
    rawStatus === "promoted" || rawStatus === "rejected"
      ? rawStatus
      : "submitted";

  const rawAcceptance = text(row.acceptance_mode);
  const acceptanceMode: TrackLyricsAcceptanceMode | null =
    rawAcceptance === "as_submitted" || rawAcceptance === "with_revisions"
      ? rawAcceptance
      : null;

  return {
    id,
    trackId,
    trackTitle: text(row.track_title, "Untitled Track"),
    trackSlug: text(row.track_slug),
    artworkUrl: nullableText(row.artwork_url),
    artists: stringArray(row.artists),
    contributorId: nullableText(row.contributor_id),
    contributorLabel: text(row.contributor_label, "WAKILISHA contributor"),
    contributorUsername: nullableText(row.contributor_username),
    contributionKind:
      text(row.contribution_kind) === "correction"
        ? "correction"
        : "submission",
    languageCode: text(row.language_code, "und"),
    timingMode: text(row.timing_mode) === "line" ? "line" : "plain",
    lines: decodeLines(row.lines),
    plainText: text(row.plain_text),
    sourceDescription: nullableText(row.source_description),
    status,
    acceptanceMode,
    acceptedVersionId: nullableText(row.accepted_version_id),
    reviewedAt: nullableText(row.reviewed_at),
    reviewedBy: nullableText(row.reviewed_by),
    reviewNote: nullableText(row.review_note),
    createdAt: text(row.created_at),
  };
}

export async function fetchTrackLyricsContributionInbox({
  search = "",
  status = "submitted",
  limit = 100,
  offset = 0,
}: {
  search?: string;
  status?: TrackLyricsContributionStatus | "all";
  limit?: number;
  offset?: number;
} = {}): Promise<TrackLyricsInboxItem[]> {
  const data = await invokeUntypedRpc(
    "get_admin_track_lyrics_contribution_inbox",
    {
      p_search: search.trim() || null,
      p_status: status === "all" ? null : status,
      p_limit: limit,
      p_offset: offset,
    },
  );

  return Array.isArray(data)
    ? data.flatMap((row) => {
        const decoded = decodeInboxItem(row);
        return decoded ? [decoded] : [];
      })
    : [];
}

export async function searchTrackLyricsAdminTracks(
  query: string,
  limit = 50,
): Promise<TrackLyricsAdminTrackResult[]> {
  const data = await invokeUntypedRpc(
    "search_admin_track_lyrics_tracks",
    {
      p_query: query.trim() || null,
      p_limit: limit,
    },
  );

  if (!Array.isArray(data)) return [];

  return data.flatMap((value) => {
    const row = record(value);
    const id = text(row.id ?? row.track_id);
    if (!id) return [];

    return [{
      id,
      slug: text(row.slug ?? row.track_slug),
      title: text(row.title ?? row.track_title, "Untitled Track"),
      artworkUrl: nullableText(row.artwork_url),
      artists: stringArray(row.artists),
      hasPublishedLyrics: row.has_published_lyrics === true,
      pendingContributionCount: Number(row.pending_contribution_count ?? 0) || 0,
    }];
  });
}

export async function acceptTrackLyricsContribution(input: {
  contributionId: string;
  expectedAuthorityRevision: number;
  languageCode: string;
  timingMode: "plain" | "line";
  lines: Array<{ text: string; start_seconds?: number }>;
  acceptanceMode: TrackLyricsAcceptanceMode;
  reviewNote?: string | null;
}): Promise<{
  versionId: string;
  authorityRevision: number;
}> {
  const data = record(
    await invokeUntypedRpc(
      "review_track_lyrics_contribution",
      {
        p_contribution_id: input.contributionId,
        p_expected_authority_revision: input.expectedAuthorityRevision,
        p_language_code: input.languageCode.trim() || "und",
        p_timing_mode: input.timingMode,
        p_lines: input.lines,
        p_acceptance_mode: input.acceptanceMode,
        p_review_note: input.reviewNote?.trim() || null,
      },
    ),
  );

  const versionId = text(data.version_id);
  const authorityRevision = Number(data.authority_revision ?? 0);
  if (!versionId || !Number.isFinite(authorityRevision) || authorityRevision < 1) {
    throw new Error("Lyrics review did not return the accepted working version.");
  }

  return { versionId, authorityRevision };
}

export async function rejectTrackLyricsContributionWithNote(
  contributionId: string,
  reviewNote: string,
): Promise<void> {
  const note = reviewNote.trim();
  if (!note) {
    throw new Error("Add a decision note before rejecting this Lyrics contribution.");
  }

  await invokeUntypedRpc(
    "reject_track_lyrics_contribution",
    {
      p_contribution_id: contributionId,
      p_review_note: note,
    },
  );
}
