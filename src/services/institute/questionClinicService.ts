import { supabase } from "@/lib/supabase";
import { logLearningEvent } from "@/services/institute/learningEventsService";

// Question Clinic service. Sharpens questions without ever overwriting them:
// every change is a new version with a reason, the old versions stay, and a
// learning event records what changed and why. No hard delete exists here.

export type ClinicAssessmentState =
  | "raw_but_promising"
  | "ready"
  | "too_broad"
  | "too_narrow"
  | "loaded"
  | "false_assumption"
  | "too_speculative"
  | "not_answerable_yet"
  | "already_answered"
  | "different_question"
  | "should_fork"
  | "should_merge"
  | "should_pause";

export const CLINIC_ASSESSMENT_OPTIONS: Array<{
  value: ClinicAssessmentState;
  label: string;
  hint: string;
}> = [
  { value: "ready", label: "Ready for inquiry", hint: "Clear, answerable, and worth the work." },
  { value: "raw_but_promising", label: "Raw but promising", hint: "Keep it. It needs shaping before evidence." },
  { value: "too_broad", label: "Too broad", hint: "It covers too much to answer honestly." },
  { value: "too_narrow", label: "Too narrow", hint: "It cuts off the interesting part." },
  { value: "loaded", label: "Loaded", hint: "It assumes its own answer." },
  { value: "false_assumption", label: "Built on a false assumption", hint: "Something it takes for granted is not true." },
  { value: "too_speculative", label: "Too speculative", hint: "No evidence could settle it yet." },
  { value: "not_answerable_yet", label: "Not answerable yet", hint: "The material to answer it does not exist yet." },
  { value: "already_answered", label: "Already answered", hint: "Good work already covers this." },
  { value: "different_question", label: "Actually a different question", hint: "The real question is hiding inside it." },
  { value: "should_fork", label: "Should fork", hint: "A second inquiry is trying to get out." },
  { value: "should_merge", label: "Should merge", hint: "It belongs inside an existing inquiry." },
  { value: "should_pause", label: "Should pause", hint: "Hold it as doubt for now." },
];

export type QuestionVersion = {
  id: string;
  versionNumber: number;
  questionText: string;
  versionType: string;
  reason: string | null;
  assessmentState: ClinicAssessmentState | null;
  createdAt: string;
};

type VersionRow = {
  id: string;
  version_number: number;
  question_text: string;
  version_type: string;
  reason: string | null;
  assessment_state: string | null;
  created_at: string;
};

function mapVersion(row: VersionRow): QuestionVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    questionText: row.question_text,
    versionType: row.version_type,
    reason: row.reason,
    assessmentState: (row.assessment_state as ClinicAssessmentState) ?? null,
    createdAt: row.created_at,
  };
}

export async function listQuestionVersions(inquiryId: string): Promise<QuestionVersion[]> {
  const { data, error } = await supabase
    .from("institute_question_versions")
    .select("id, version_number, question_text, version_type, reason, assessment_state, created_at")
    .eq("inquiry_id", inquiryId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as VersionRow[]).map(mapVersion);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export type RefinementInput = {
  questionText: string;
  reason: string;
  assessmentState: ClinicAssessmentState;
  sourceSuggestionId?: string | null;
};

/**
 * Makes a refined question the working question. Creates a new
 * clinic_refinement version, points the inquiry at it, records a learning
 * event, and (when the refinement came from an assistant suggestion) marks
 * that suggestion accepted. Old versions are never touched.
 */
export async function applyQuestionRefinement(
  inquiry: { id: string; currentQuestion: string },
  input: RefinementInput,
): Promise<QuestionVersion> {
  const questionText = input.questionText.trim();
  const reason = input.reason.trim();
  if (questionText.length < 8) throw new Error("The refined question is too short.");
  if (reason.length < 4) throw new Error("Say why the question changed. Lineage needs the reason.");

  // Read the latest version number from the source of truth, not local state.
  const { data: latest, error: latestError } = await supabase
    .from("institute_question_versions")
    .select("id, version_number, question_text")
    .eq("inquiry_id", inquiry.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  const nextNumber = ((latest?.version_number as number) ?? 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from("institute_question_versions")
    .insert({
      inquiry_id: inquiry.id,
      version_number: nextNumber,
      question_text: questionText,
      version_type: "clinic_refinement",
      reason,
      assessment_state: input.assessmentState,
      metadata: input.sourceSuggestionId ? { sourceSuggestionId: input.sourceSuggestionId } : {},
    })
    .select("id, version_number, question_text, version_type, reason, assessment_state, created_at")
    .single();

  if (versionError) throw versionError;

  const { error: inquiryError } = await supabase
    .from("institute_inquiries")
    .update({
      current_question: questionText,
      current_question_version_id: version.id,
    })
    .eq("id", inquiry.id);

  if (inquiryError) throw inquiryError;

  await logLearningEvent(
    inquiry.id,
    "question_refined",
    "Question Clinic refined the working question",
    { question: inquiry.currentQuestion, versionId: latest?.id ?? null },
    { question: questionText, versionId: version.id, assessment: input.assessmentState },
    { source: input.sourceSuggestionId ? "assistant_suggestion" : "manual", reason },
  );

  if (input.sourceSuggestionId) {
    const actorId = await currentUserId();
    await supabase
      .from("institute_assistant_suggestions")
      .update({ status: "accepted", reviewed_by: actorId, reviewed_at: new Date().toISOString() })
      .eq("id", input.sourceSuggestionId);
  }

  return mapVersion(version as VersionRow);
}

/**
 * Records a clinic assessment of the current question without changing its
 * text. The assessment lands on the current version and in the learning log.
 */
export async function recordClinicAssessment(
  inquiry: { id: string; currentQuestion: string },
  versionId: string,
  assessmentState: ClinicAssessmentState,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from("institute_question_versions")
    .update({ assessment_state: assessmentState })
    .eq("id", versionId);

  if (error) throw error;

  await logLearningEvent(
    inquiry.id,
    "clinic_assessment_recorded",
    "Question Clinic assessed the working question",
    { question: inquiry.currentQuestion },
    { assessment: assessmentState },
    { note: note.trim() },
  );
}
