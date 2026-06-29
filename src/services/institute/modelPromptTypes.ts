import type { JsonValue } from "./instituteTypes";

export type ModelProviderType =
  | "hosted_closed"
  | "hosted_open_weight"
  | "self_hosted"
  | "local"
  | "custom_http"
  | "embedding"
  | "reranker"
  | "evaluation";

export type ModelProviderStatus = "active" | "paused" | "deprecated";

export type ModelType =
  | "chat"
  | "completion"
  | "embedding"
  | "reranker"
  | "evaluation"
  | "classification"
  | "local";

export type ModelHostingMode =
  | "hosted_closed"
  | "hosted_open_weight"
  | "self_hosted"
  | "local"
  | "custom_http";

export type ModelWeightAccess = "closed" | "open_weight" | "open_source" | "unknown";

export type ModelStatus = "active" | "paused" | "deprecated" | "experimental";

export type InstituteTaskType =
  | "relationship_suggestion"
  | "evidence_summary"
  | "contributor_triage"
  | "surface_draft"
  | "retrieval_test"
  | "evaluation"
  | "tone_check"
  | "overclaim_check";

export type InferenceTaskType = InstituteTaskType | "embedding";

export type InferenceProfileStatus = "draft" | "active" | "paused" | "deprecated";
export type PromptRecipeStatus = "draft" | "active" | "paused" | "deprecated";
export type PromptVersionStatus = "draft" | "active" | "paused" | "deprecated";

export type AiRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "rejected";

export type AiRunReviewStatus =
  | "not_reviewed"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_more_evidence";

export type AiRunSourceType =
  | "inquiry"
  | "inquiry_note"
  | "evidence"
  | "relationship"
  | "contributor_submission"
  | "surface_draft"
  | "correction"
  | "memory_embedding"
  | "registry_artist"
  | "registry_track"
  | "registry_release"
  | "registry_label"
  | "external_url"
  | "manual_context";

export interface ModelProvider {
  id: string;
  provider_key: string;
  display_name: string;
  provider_type: ModelProviderType;
  status: ModelProviderStatus;
  base_url: string | null;
  docs_url: string | null;
  secret_name: string | null;
  supports_text_generation: boolean;
  supports_structured_output: boolean;
  supports_tool_use: boolean;
  supports_citations: boolean;
  supports_embeddings: boolean;
  supports_reranking: boolean;
  supports_fine_tuning: boolean;
  license_notes: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelRegistryItem {
  id: string;
  provider_id: string;
  model_key: string;
  display_name: string;
  model_family: string | null;
  model_type: ModelType;
  hosting_mode: ModelHostingMode;
  weight_access: ModelWeightAccess;
  status: ModelStatus;
  context_window_tokens: number | null;
  output_token_limit: number | null;
  embedding_dimensions: number | null;
  supports_structured_output: boolean;
  supports_json_mode: boolean;
  supports_tool_use: boolean;
  supports_citations: boolean;
  supports_streaming: boolean;
  supports_fine_tuning: boolean;
  approved_task_types: string[];
  license_notes: string | null;
  operational_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InferenceProfile {
  id: string;
  profile_key: string;
  display_name: string;
  task_type: InferenceTaskType;
  primary_model_id: string | null;
  fallback_model_id: string | null;
  temperature: number | null;
  max_output_tokens: number | null;
  requires_structured_output: boolean;
  requires_source_logging: boolean;
  requires_human_review: boolean;
  status: InferenceProfileStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptRecipe {
  id: string;
  recipe_key: string;
  display_name: string;
  task_type: InstituteTaskType;
  purpose: string;
  owner_id: string | null;
  status: PromptRecipeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  recipe_id: string;
  version_name: string;
  version_label: string | null;
  system_prompt: string;
  developer_prompt: string | null;
  user_prompt_template: string;
  output_schema: Record<string, JsonValue>;
  retrieval_policy: Record<string, JsonValue>;
  safety_notes: string | null;
  evaluation_notes: string | null;
  status: PromptVersionStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiRun {
  id: string;
  run_type: InferenceTaskType;
  inquiry_id: string | null;
  entity_id: string | null;
  inference_profile_id: string | null;
  provider_id: string;
  model_id: string;
  prompt_recipe_id: string | null;
  prompt_version_id: string | null;
  provider_key_snapshot: string;
  model_key_snapshot: string;
  prompt_version_name_snapshot: string | null;
  input_summary: string;
  input_json: Record<string, JsonValue>;
  output_json: Record<string, JsonValue>;
  output_text: string | null;
  status: AiRunStatus;
  error_message: string | null;
  token_input_count: number | null;
  token_output_count: number | null;
  cost_estimate_usd: number | null;
  requires_human_review: boolean;
  review_status: AiRunReviewStatus;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AiRunSource {
  id: string;
  ai_run_id: string;
  source_type: AiRunSourceType;
  source_id: string | null;
  source_table: string | null;
  source_ref: string | null;
  source_title: string | null;
  excerpt: string | null;
  retrieval_rank: number | null;
  similarity_score: number | null;
  used_in_prompt: boolean;
  metadata: Record<string, JsonValue>;
  created_at: string;
}

export type CreateModelProviderInput = Pick<
  ModelProvider,
  "provider_key" | "display_name" | "provider_type"
> &
  Partial<
    Pick<
      ModelProvider,
      | "status"
      | "base_url"
      | "docs_url"
      | "secret_name"
      | "supports_text_generation"
      | "supports_structured_output"
      | "supports_tool_use"
      | "supports_citations"
      | "supports_embeddings"
      | "supports_reranking"
      | "supports_fine_tuning"
      | "license_notes"
      | "notes"
    >
  >;

export type CreateModelRegistryItemInput = Pick<
  ModelRegistryItem,
  "provider_id" | "model_key" | "display_name" | "model_type" | "hosting_mode"
> &
  Partial<
    Pick<
      ModelRegistryItem,
      | "model_family"
      | "weight_access"
      | "status"
      | "context_window_tokens"
      | "output_token_limit"
      | "embedding_dimensions"
      | "supports_structured_output"
      | "supports_json_mode"
      | "supports_tool_use"
      | "supports_citations"
      | "supports_streaming"
      | "supports_fine_tuning"
      | "approved_task_types"
      | "license_notes"
      | "operational_notes"
    >
  >;

export type CreateInferenceProfileInput = Pick<
  InferenceProfile,
  "profile_key" | "display_name" | "task_type"
> &
  Partial<
    Pick<
      InferenceProfile,
      | "primary_model_id"
      | "fallback_model_id"
      | "temperature"
      | "max_output_tokens"
      | "requires_structured_output"
      | "requires_source_logging"
      | "requires_human_review"
      | "status"
      | "notes"
    >
  >;

export type CreatePromptRecipeInput = Pick<
  PromptRecipe,
  "recipe_key" | "display_name" | "task_type" | "purpose"
> &
  Partial<Pick<PromptRecipe, "status" | "notes">>;

export type CreatePromptVersionInput = Pick<
  PromptVersion,
  "recipe_id" | "version_name" | "system_prompt" | "user_prompt_template"
> &
  Partial<
    Pick<
      PromptVersion,
      | "version_label"
      | "developer_prompt"
      | "output_schema"
      | "retrieval_policy"
      | "safety_notes"
      | "evaluation_notes"
      | "status"
      | "approved_by"
      | "approved_at"
    >
  >;

export type CreateAiRunInput = Pick<
  AiRun,
  "run_type" | "provider_id" | "model_id" | "provider_key_snapshot" | "model_key_snapshot" | "input_summary"
> &
  Partial<
    Pick<
      AiRun,
      | "inquiry_id"
      | "entity_id"
      | "inference_profile_id"
      | "prompt_recipe_id"
      | "prompt_version_id"
      | "prompt_version_name_snapshot"
      | "input_json"
      | "output_json"
      | "output_text"
      | "status"
      | "error_message"
      | "token_input_count"
      | "token_output_count"
      | "cost_estimate_usd"
      | "requires_human_review"
      | "review_status"
      | "started_at"
      | "completed_at"
    >
  >;

export type CreateAiRunSourceInput = Pick<AiRunSource, "ai_run_id" | "source_type"> &
  Partial<
    Pick<
      AiRunSource,
      | "source_id"
      | "source_table"
      | "source_ref"
      | "source_title"
      | "excerpt"
      | "retrieval_rank"
      | "similarity_score"
      | "used_in_prompt"
      | "metadata"
    >
  >;
