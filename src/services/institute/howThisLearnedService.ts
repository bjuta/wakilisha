import { supabase } from "@/lib/supabase";
import { CLINIC_ASSESSMENT_OPTIONS } from "@/services/institute/questionClinicService";
import { READER_VERDICT_OPTIONS } from "@/services/institute/evidenceReaderService";

// How This Learned. Assembles the inquiry's learning trail from records that
// already exist: question versions, learning events, decided suggestions,
// and evidence review states. Read-only; nothing here writes.

export type LearningGroup = "question" | "evidence" | "relationships" | "assistant" | "review" | "other";

export type LearningEntry = {
  id: string;
  at: string;
  group: LearningGroup;
  title: string;
  body: string;
  detail: string | null;
};

export const LEARNING_GROUP_LABELS: Record<LearningGroup, string> = {
  question: "The question",
  evidence: "Evidence",
  relationships: "Relationships",
  assistant: "Assistant suggestions",
  review: "Review",
  other: "Other",
};

type EventRow = {
  id: string;
  event_type: string;
  event_label: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type VersionRow = {
  id: string;
  version_number: number;
  question_text: string;
  version_type: string;
  reason: string | null;
  created_at: string;
};

type SuggestionRow = {
  id: string;
  suggestion_type: string;
  title: string | null;
  body: string;
  status: string;
  reviewed_at: string | null;
};

type PacketRow = {
  id: string;
  packet_version: number;
  status: string;
  editor_decision: string | null;
  reviewed_at: string | null;
  submitted_at: string;
};

const EVENT_GROUPS: Record<string, LearningGroup> = {
  question_refined: "question",
  clinic_assessment_recorded: "question",
  evidence_review_decided: "evidence",
  relationship_accepted: "relationships",
  relationship_status_changed: "relationships",
};

const SUGGESTION_DECISION_LABELS: Record<string, string> = {
  accepted: "accepted",
  edited_and_accepted: "edited and accepted",
  rejected: "rejected",
  saved_as_doubt: "kept as doubt",
  forked: "forked",
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Turn stored enum values back into the human labels the UI uses. */
function humanize(value: string): string {
  const assessment = CLINIC_ASSESSMENT_OPTIONS.find((o) => o.value === value);
  if (assessment) return assessment.label;
  const verdict = READER_VERDICT_OPTIONS.find((o) => o.value === value);
  if (verdict) return verdict.label;
  return value.replaceAll("_", " ");
}

/** Pure merge so the shape is testable without a database. */
export function buildLearningTimeline(
  events: EventRow[],
  versions: VersionRow[],
  decidedSuggestions: SuggestionRow[],
  packets: PacketRow[],
): LearningEntry[] {
  const entries: LearningEntry[] = [];

  versions.forEach((version) => {
    const isRaw = version.version_type === "raw";
    entries.push({
      id: `version-${version.id}`,
      at: version.created_at,
      group: "question",
      title: isRaw ? "The question arrived" : `The question moved to v${version.version_number}`,
      body: version.question_text,
      detail: version.reason,
    });
  });

  events.forEach((event) => {
    // question_refined events duplicate the version entries above; keep the
    // assessment and evidence events, and anything future services write.
    if (event.event_type === "question_refined") return;
    const after = event.after_value ?? {};
    const meta = event.metadata ?? {};
    entries.push({
      id: `event-${event.id}`,
      at: event.created_at,
      group: EVENT_GROUPS[event.event_type] ?? "other",
      title: event.event_label ?? event.event_type,
      body: (() => {
        const source = str(after.source);
        const kind = str(after.kind);
        const target = str(after.target);
        if (source && kind && target) return `${source} ${kind} ${target}.`;
        const coded = str(after.verdict) ?? str(after.assessment) ?? str(after.status);
        if (coded) return humanize(coded);
        return str(after.question) ?? "";
      })(),
      detail: str(meta.note) ?? str(meta.reason),
    });
  });

  decidedSuggestions.forEach((suggestion) => {
    if (!suggestion.reviewed_at) return;
    const decision = SUGGESTION_DECISION_LABELS[suggestion.status] ?? suggestion.status;
    entries.push({
      id: `suggestion-${suggestion.id}`,
      at: suggestion.reviewed_at,
      group: "assistant",
      title: `A suggestion was ${decision}`,
      body: suggestion.body,
      detail: suggestion.title,
    });
  });

  packets.forEach((packet) => {
    entries.push({
      id: `packet-${packet.id}`,
      at: packet.reviewed_at ?? packet.submitted_at,
      group: "review",
      title: packet.reviewed_at
        ? `Review packet v${packet.packet_version}: ${packet.status.replaceAll("_", " ")}`
        : `Review packet v${packet.packet_version} submitted`,
      body: packet.editor_decision ?? "",
      detail: null,
    });
  });

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function fetchLearningTimeline(inquiryId: string): Promise<LearningEntry[]> {
  const [{ data: events }, { data: versions }, { data: suggestions }, { data: packets }] = await Promise.all([
    supabase
      .from("institute_events")
      .select("id, event_type, event_label, before_value, after_value, metadata, created_at")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("institute_question_versions")
      .select("id, version_number, question_text, version_type, reason, created_at")
      .eq("inquiry_id", inquiryId)
      .order("version_number", { ascending: false }),
    supabase
      .from("institute_assistant_suggestions")
      .select("id, suggestion_type, title, body, status, reviewed_at")
      .eq("inquiry_id", inquiryId)
      .neq("status", "suggested")
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(200),
    supabase
      .from("institute_review_packets")
      .select("id, packet_version, status, editor_decision, reviewed_at, submitted_at")
      .eq("inquiry_id", inquiryId)
      .order("submitted_at", { ascending: false }),
  ]);

  return buildLearningTimeline(
    (events ?? []) as EventRow[],
    (versions ?? []) as VersionRow[],
    (suggestions ?? []) as SuggestionRow[],
    (packets ?? []) as PacketRow[],
  );
}
