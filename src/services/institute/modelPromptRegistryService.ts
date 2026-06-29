import { supabase } from "@/lib/supabase";
import type {
  AiRun,
  AiRunSource,
  CreateAiRunInput,
  CreateAiRunSourceInput,
  CreateInferenceProfileInput,
  CreateModelProviderInput,
  CreateModelRegistryItemInput,
  CreatePromptRecipeInput,
  CreatePromptVersionInput,
  InferenceProfile,
  ModelProvider,
  ModelRegistryItem,
  PromptRecipe,
  PromptVersion,
} from "./modelPromptTypes";

function raiseSupabaseError(error: unknown, action: string): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${action} failed: ${message}`);
}

async function insertOne<TRecord>(table: string, payload: Record<string, unknown>, action: string): Promise<TRecord> {
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();

  if (error) raiseSupabaseError(error, action);
  return data as TRecord;
}

export async function createModelProvider(input: CreateModelProviderInput): Promise<ModelProvider> {
  return insertOne<ModelProvider>("model_providers", input, "Create model provider");
}

export async function listModelProviders(): Promise<ModelProvider[]> {
  const { data, error } = await supabase
    .from("model_providers")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) raiseSupabaseError(error, "List model providers");
  return (data ?? []) as ModelProvider[];
}

export async function createModelRegistryItem(input: CreateModelRegistryItemInput): Promise<ModelRegistryItem> {
  return insertOne<ModelRegistryItem>("model_registry", input, "Create model registry item");
}

export async function listModelRegistryItems(providerId?: string): Promise<ModelRegistryItem[]> {
  let request = supabase
    .from("model_registry")
    .select("*")
    .order("display_name", { ascending: true });

  if (providerId) {
    request = request.eq("provider_id", providerId);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List model registry items");
  return (data ?? []) as ModelRegistryItem[];
}

export async function createInferenceProfile(input: CreateInferenceProfileInput): Promise<InferenceProfile> {
  return insertOne<InferenceProfile>("inference_profiles", input, "Create inference profile");
}

export async function listInferenceProfiles(): Promise<InferenceProfile[]> {
  const { data, error } = await supabase
    .from("inference_profiles")
    .select("*")
    .order("task_type", { ascending: true });

  if (error) raiseSupabaseError(error, "List inference profiles");
  return (data ?? []) as InferenceProfile[];
}

export async function createPromptRecipe(input: CreatePromptRecipeInput): Promise<PromptRecipe> {
  return insertOne<PromptRecipe>("prompt_recipes", input, "Create prompt recipe");
}

export async function listPromptRecipes(): Promise<PromptRecipe[]> {
  const { data, error } = await supabase
    .from("prompt_recipes")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) raiseSupabaseError(error, "List prompt recipes");
  return (data ?? []) as PromptRecipe[];
}

export async function createPromptVersion(input: CreatePromptVersionInput): Promise<PromptVersion> {
  return insertOne<PromptVersion>(
    "prompt_versions",
    {
      output_schema: {},
      retrieval_policy: {},
      ...input,
    },
    "Create prompt version",
  );
}

export async function listPromptVersions(recipeId: string): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from("prompt_versions")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("updated_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List prompt versions");
  return (data ?? []) as PromptVersion[];
}

export async function createAiRun(input: CreateAiRunInput): Promise<AiRun> {
  const providerKey = input.provider_key_snapshot.trim();
  const modelKey = input.model_key_snapshot.trim();

  if (!providerKey || !modelKey) {
    throw new Error("Create AI run failed: provider and model snapshots are required.");
  }

  if (input.run_type !== "embedding" && (!input.prompt_version_id || !input.prompt_version_name_snapshot?.trim())) {
    throw new Error("Create AI run failed: prompt version id and version-name snapshot are required.");
  }

  return insertOne<AiRun>(
    "ai_runs",
    {
      input_json: {},
      output_json: {},
      status: "queued",
      requires_human_review: true,
      review_status: "not_reviewed",
      ...input,
      provider_key_snapshot: providerKey,
      model_key_snapshot: modelKey,
      prompt_version_name_snapshot: input.prompt_version_name_snapshot?.trim() || null,
    },
    "Create AI run",
  );
}

export async function createAiRunSource(input: CreateAiRunSourceInput): Promise<AiRunSource> {
  if (!input.source_id && !input.source_ref && !input.source_table) {
    throw new Error("Create AI run source failed: source_id, source_ref, or source_table is required.");
  }

  return insertOne<AiRunSource>(
    "ai_run_sources",
    {
      used_in_prompt: true,
      metadata: {},
      ...input,
    },
    "Create AI run source",
  );
}

export async function listAiRuns(query?: {
  inquiryId?: string;
  entityId?: string;
  runType?: string;
  limit?: number;
}): Promise<AiRun[]> {
  let request = supabase
    .from("ai_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(query?.limit ?? 50);

  if (query?.inquiryId) {
    request = request.eq("inquiry_id", query.inquiryId);
  }

  if (query?.entityId) {
    request = request.eq("entity_id", query.entityId);
  }

  if (query?.runType) {
    request = request.eq("run_type", query.runType);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List AI runs");
  return (data ?? []) as AiRun[];
}

export async function listAiRunSources(aiRunId: string): Promise<AiRunSource[]> {
  const { data, error } = await supabase
    .from("ai_run_sources")
    .select("*")
    .eq("ai_run_id", aiRunId)
    .order("retrieval_rank", { ascending: true, nullsFirst: false });

  if (error) raiseSupabaseError(error, "List AI run sources");
  return (data ?? []) as AiRunSource[];
}
