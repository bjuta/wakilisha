import { supabase } from "@/lib/supabase";

// Review bridge for Inquiry Court assistant runs. The assistant creates
// candidates; this service only reads runs, requests new ones, and records
// human decisions on suggestions. It never writes canonical inquiry data.

export type AssistantJobType = "question_clinic" | "next_step_recommender" | "evidence_reader";

export type AssistantJobInput = { evidenceItemId?: string };

export type AssistantSuggestionStatus =
  | "suggested"
  | "accepted"
  | "edited_and_accepted"
  | "rejected"
  | "saved_as_doubt";

export type AssistantSuggestion = {
  id: string;
  runId: string;
  inquiryId: string;
  suggestionType: string;
  title: string;
  body: string;
  reason: string | null;
  confidence: number | null;
  payload: Record<string, unknown>;
  status: AssistantSuggestionStatus | string;
  reviewedAt: string | null;
  createdAt: string;
};

export type AssistantRun = {
  id: string;
  task: string;
  modelName: string | null;
  promptVersion: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | string;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
};

type SuggestionRow = {
  id: string;
  assistant_run_id: string;
  inquiry_id: string;
  suggestion_type: string;
  title: string | null;
  body: string;
  reason: string | null;
  confidence: number | string | null;
  payload: Record<string, unknown> | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
};

type RunRow = {
  id: string;
  task: string;
  model_name: string | null;
  prompt_version: string;
  status: string;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
  completed_at: string | null;
};

function normalizeConfidence(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSuggestion(row: SuggestionRow): AssistantSuggestion {
  return {
    id: row.id,
    runId: row.assistant_run_id,
    inquiryId: row.inquiry_id,
    suggestionType: row.suggestion_type,
    title: row.title ?? "",
    body: row.body,
    reason: row.reason,
    confidence: normalizeConfidence(row.confidence),
    payload: row.payload ?? {},
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapRun(row: RunRow): AssistantRun {
  return {
    id: row.id,
    task: row.task,
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    status: row.status,
    errorMessage: row.error_message,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function runAssistantJob(
  inquiryId: string,
  jobType: AssistantJobType,
  input?: AssistantJobInput,
): Promise<{ runId: string }> {
  const { data, error } = await supabase.functions.invoke("institute-assistant", {
    body: { inquiryId, jobType, ...(input ? { input } : {}) },
  });

  if (error) {
    throw new Error("The assistant could not finish this run. Check the run log for details.");
  }
  const payload = data as { ok?: boolean; data?: { runId?: string }; error?: { message?: string } } | null;
  if (!payload?.ok || !payload.data?.runId) {
    throw new Error(payload?.error?.message || "The assistant could not finish this run.");
  }
  return { runId: payload.data.runId };
}

export async function listAssistantRuns(inquiryId: string, limit = 20): Promise<AssistantRun[]> {
  const { data, error } = await supabase
    .from("institute_assistant_runs")
    .select("id, task, model_name, prompt_version, status, error_message, latency_ms, created_at, completed_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as RunRow[]).map(mapRun);
}

export async function listAssistantSuggestions(inquiryId: string, limit = 100): Promise<AssistantSuggestion[]> {
  const { data, error } = await supabase
    .from("institute_assistant_suggestions")
    .select("id, assistant_run_id, inquiry_id, suggestion_type, title, body, reason, confidence, payload, status, reviewed_at, created_at")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as SuggestionRow[]).map(mapSuggestion);
}

export async function decideSuggestion(
  suggestionId: string,
  decision: Exclude<AssistantSuggestionStatus, "suggested">,
  editedBody?: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();

  const patch: Record<string, unknown> = {
    status: decision,
    reviewed_by: userData?.user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  };
  if (decision === "edited_and_accepted" && typeof editedBody === "string" && editedBody.trim()) {
    patch.body = editedBody.trim();
  }

  const { error } = await supabase.from("institute_assistant_suggestions").update(patch).eq("id", suggestionId);
  if (error) throw error;
}
