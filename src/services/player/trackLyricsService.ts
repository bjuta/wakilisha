import { supabase } from "@/lib/supabase";
import type { TimedTextLine } from "@/services/player/timedText";

type UnknownRecord = Record<string, unknown>;

export type TrackLyricsCommunityRevisionMode =
  | "as_submitted"
  | "with_revisions";

export interface TrackLyricsDocument {
  trackId: string;
  versionId: string;
  versionNumber: number;
  languageCode: string;
  timingMode: "plain" | "line";
  lines: TimedTextLine[];
  plainText: string;
  sourceKind: string;
  rightsNote: string | null;
  sourceContributionId: string | null;
  sourceContributorLabel: string | null;
  communityRevisionMode: TrackLyricsCommunityRevisionMode | null;
}

export interface TrackLyricsContribution {
  id: string;
  trackId: string;
  contributorId: string | null;
  languageCode: string;
  timingMode: "plain" | "line";
  lines: TimedTextLine[];
  plainText: string;
  sourceDescription: string | null;
  status: "submitted" | "promoted" | "rejected";
  acceptanceMode: TrackLyricsCommunityRevisionMode | null;
  acceptedVersionId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface AdminTrackLyricsWorkspace {
  trackId: string;
  authorityRevision: number;
  currentWorkingVersionId: string | null;
  currentPublishedVersionId: string | null;
  working: TrackLyricsDocument | null;
  published: TrackLyricsDocument | null;
  canEdit: boolean;
  canManageReview: boolean;
  canPublish: boolean;
}

function record(value: unknown): UnknownRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as UnknownRecord
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

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeRevisionMode(
  value: unknown,
): TrackLyricsCommunityRevisionMode | null {
  return value === "as_submitted" || value === "with_revisions"
    ? value
    : null;
}

function decodeLines(value: unknown): TimedTextLine[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate, index) => {
    const line = record(candidate);
    const lineText = text(line.text).trim();
    if (!lineText) return [];

    const rawStart = line.start_seconds;
    const parsedStart =
      rawStart === null || rawStart === undefined
        ? null
        : Number(rawStart);

    return [{
      id: text(line.id) || `line-${index + 1}`,
      text: lineText,
      startSeconds:
        parsedStart !== null && Number.isFinite(parsedStart)
          ? parsedStart
          : null,
    }];
  });
}

function decodeDocument(
  value: unknown,
  trackIdFallback = "",
): TrackLyricsDocument | null {
  if (!value) return null;
  const row = record(value);
  const provenance = record(row.provenance);
  const versionId = text(row.version_id ?? row.id);
  if (!versionId) return null;

  return {
    trackId: text(row.track_id) || trackIdFallback,
    versionId,
    versionNumber: numberValue(row.version_number, 1),
    languageCode: text(row.language_code, "und"),
    timingMode: text(row.timing_mode) === "line" ? "line" : "plain",
    lines: decodeLines(row.lines),
    plainText: text(row.plain_text),
    sourceKind: text(row.source_kind, "editorial"),
    rightsNote: nullableText(row.rights_note),
    sourceContributionId: nullableText(row.source_contribution_id),
    sourceContributorLabel: nullableText(
      row.source_contributor_label ?? provenance.contributor_label,
    ),
    communityRevisionMode: decodeRevisionMode(
      row.community_revision_mode ?? provenance.revision_mode,
    ),
  };
}

function decodeContribution(value: unknown): TrackLyricsContribution | null {
  const row = record(value);
  const id = text(row.id ?? row.contribution_id);
  const trackId = text(row.track_id);
  if (!id || !trackId) return null;

  const rawStatus = text(row.status);
  const status: TrackLyricsContribution["status"] =
    rawStatus === "promoted" || rawStatus === "rejected"
      ? rawStatus
      : "submitted";

  return {
    id,
    trackId,
    contributorId: nullableText(row.contributor_id),
    languageCode: text(row.language_code, "und"),
    timingMode: text(row.timing_mode) === "line" ? "line" : "plain",
    lines: decodeLines(row.lines),
    plainText: text(row.plain_text),
    sourceDescription: nullableText(row.source_description),
    status,
    acceptanceMode: decodeRevisionMode(row.acceptance_mode),
    acceptedVersionId: nullableText(row.accepted_version_id),
    reviewedAt: nullableText(row.reviewed_at),
    reviewNote: nullableText(row.review_note),
    createdAt: text(row.created_at),
  };
}

export function trackLyricsPublicAttribution(
  document: TrackLyricsDocument | null,
): string | null {
  if (!document?.sourceContributorLabel) return null;

  if (document.communityRevisionMode === "with_revisions") {
    return `Original Lyrics submitted by ${document.sourceContributorLabel}. WAKILISHA Community revisions were accepted.`;
  }

  if (document.communityRevisionMode === "as_submitted") {
    return `Lyrics submitted by ${document.sourceContributorLabel}.`;
  }

  return null;
}

export async function fetchPublicTrackLyrics(
  trackId: string,
): Promise<TrackLyricsDocument | null> {
  const { data, error } = await supabase.rpc(
    "get_public_track_lyrics",
    { p_track_id: trackId },
  );

  if (error) {
    throw new Error(error.message || "Lyrics could not load.");
  }

  return decodeDocument(data, trackId);
}

export async function submitTrackLyricsContribution(input: {
  trackId: string;
  languageCode?: string;
  lines: Array<{ text: string; start_seconds?: number }>;
  sourceDescription?: string | null;
}): Promise<{ contributionId: string; status: "submitted" }> {
  const { data, error } = await supabase.rpc(
    "submit_track_lyrics_contribution",
    {
      p_track_id: input.trackId,
      p_language_code: input.languageCode?.trim() || "und",
      p_timing_mode: "plain",
      p_lines: input.lines,
      p_source_description: input.sourceDescription?.trim() || null,
    },
  );

  if (error) {
    throw new Error(error.message || "Lyrics could not be submitted.");
  }

  const root = record(data);
  const contributionId = text(root.contribution_id);
  if (!contributionId) {
    throw new Error("Lyrics submission did not return a contribution id.");
  }

  return {
    contributionId,
    status: "submitted",
  };
}

export async function fetchAdminTrackLyricsWorkspace(
  trackId: string,
): Promise<AdminTrackLyricsWorkspace> {
  const { data, error } = await supabase.rpc(
    "get_admin_track_lyrics_workspace",
    { p_track_id: trackId },
  );

  if (error) {
    throw new Error(
      error.message || "Lyrics workspace could not load.",
    );
  }

  const root = record(data);

  return {
    trackId: text(root.track_id) || trackId,
    authorityRevision: numberValue(root.authority_revision, 1),
    currentWorkingVersionId: nullableText(root.current_working_version_id),
    currentPublishedVersionId: nullableText(root.current_published_version_id),
    working: decodeDocument(root.working, trackId),
    published: decodeDocument(root.published, trackId),
    canEdit: root.can_edit === true,
    canManageReview: root.can_manage_review === true,
    canPublish: root.can_publish === true,
  };
}

export async function fetchAdminTrackLyricsContributions(
  trackId: string,
): Promise<TrackLyricsContribution[]> {
  const { data, error } = await supabase.rpc(
    "get_admin_track_lyrics_contributions",
    { p_track_id: trackId },
  );

  if (error) {
    throw new Error(
      error.message || "Lyrics contributions could not load.",
    );
  }

  return Array.isArray(data)
    ? data.flatMap((row) => {
        const contribution = decodeContribution(row);
        return contribution ? [contribution] : [];
      })
    : [];
}

function parseTimestamp(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);

  if (
    parts.some((part) => !Number.isFinite(part)) ||
    parts.length < 2 ||
    parts.length > 3
  ) {
    return null;
  }

  return parts.length === 2
    ? parts[0] * 60 + parts[1]
    : parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function parseLyricsEditorText(
  input: string,
  timingMode: "plain" | "line",
): Array<{ text: string; start_seconds?: number }> {
  const rows = input
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) {
    throw new Error("Add at least one Lyrics line.");
  }

  if (timingMode === "plain") {
    return rows.map((line) => ({ text: line }));
  }

  return rows.map((line) => {
    const match = line.match(
      /^\[([0-9]{1,2}:[0-9]{2}(?:\.[0-9]{1,3})?|[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?)\]\s*(.+)$/,
    );

    if (!match) {
      throw new Error(
        "Timed Lyrics use [mm:ss.xx] before every line.",
      );
    }

    const startSeconds = parseTimestamp(match[1]);

    if (startSeconds === null) {
      throw new Error(`Invalid Lyrics timestamp: ${match[1]}`);
    }

    return {
      text: match[2].trim(),
      start_seconds: startSeconds,
    };
  });
}

export function lyricsDocumentToEditorText(
  document: TrackLyricsDocument | null,
): string {
  if (!document) return "";

  if (document.timingMode === "plain") {
    return document.lines.map((line) => line.text).join("\n");
  }

  return document.lines
    .map((line) => {
      const total = Math.max(0, line.startSeconds ?? 0);
      const minutes = Math.floor(total / 60);
      const seconds = (total % 60).toFixed(2).padStart(5, "0");
      return `[${String(minutes).padStart(2, "0")}:${seconds}] ${line.text}`;
    })
    .join("\n");
}

export async function saveTrackLyricsDraft(
  workspace: AdminTrackLyricsWorkspace,
  input: {
    languageCode: string;
    timingMode: "plain" | "line";
    lines: Array<{ text: string; start_seconds?: number }>;
    rightsNote?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc(
    "save_track_lyrics_draft",
    {
      p_track_id: workspace.trackId,
      p_expected_authority_revision: workspace.authorityRevision,
      p_language_code: input.languageCode.trim() || "und",
      p_timing_mode: input.timingMode,
      p_lines: input.lines,
      p_source_kind: "editorial",
      p_rights_note: input.rightsNote?.trim() || null,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Lyrics draft could not be saved.",
    );
  }
}

export async function promoteTrackLyricsContributionToDraft(
  workspace: AdminTrackLyricsWorkspace,
  contributionId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "promote_track_lyrics_contribution_to_draft",
    {
      p_contribution_id: contributionId,
      p_expected_authority_revision: workspace.authorityRevision,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Lyrics contribution could not become a draft.",
    );
  }
}

export async function rejectTrackLyricsContribution(
  contributionId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "reject_track_lyrics_contribution",
    {
      p_contribution_id: contributionId,
      p_review_note: null,
    },
  );

  if (error) {
    throw new Error(
      error.message || "Lyrics contribution could not be rejected.",
    );
  }
}

export async function publishTrackLyrics(
  workspace: AdminTrackLyricsWorkspace,
): Promise<void> {
  if (!workspace.currentWorkingVersionId) {
    throw new Error("Save a Lyrics draft before publishing.");
  }

  const { error } = await supabase.rpc(
    "publish_track_lyrics_version",
    {
      p_track_id: workspace.trackId,
      p_version_id: workspace.currentWorkingVersionId,
      p_expected_authority_revision: workspace.authorityRevision,
    },
  );

  if (error) {
    throw new Error(error.message || "Lyrics could not be published.");
  }
}
