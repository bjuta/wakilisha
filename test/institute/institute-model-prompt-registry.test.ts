import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202606290002_institute_model_prompt_registry.sql",
);

const sql = readFileSync(migrationPath, "utf8");

const expectedTables = [
  "model_providers",
  "model_registry",
  "inference_profiles",
  "prompt_recipes",
  "prompt_versions",
  "ai_runs",
  "ai_run_sources",
];

describe("Institute model and prompt registry migration", () => {
  it("creates the full PR2 table set", () => {
    for (const table of expectedTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("keeps the model provider layer flexible", () => {
    expect(sql).toContain("'hosted_closed'");
    expect(sql).toContain("'hosted_open_weight'");
    expect(sql).toContain("'self_hosted'");
    expect(sql).toContain("'local'");
    expect(sql).toContain("'custom_http'");
    expect(sql).toContain("'open_source'");
  });

  it("stores prompt versions in the database and requires active prompt approval", () => {
    expect(sql).toContain("create table if not exists public.prompt_recipes");
    expect(sql).toContain("create table if not exists public.prompt_versions");
    expect(sql).toContain("constraint prompt_versions_active_requires_approval");
    expect(sql).toContain("status <> 'active'");
    expect(sql).toContain("approved_by is not null");
  });

  it("logs provider, model, prompt version, and snapshots on every non-embedding AI run", () => {
    expect(sql).toContain("provider_id uuid not null");
    expect(sql).toContain("model_id uuid not null");
    expect(sql).toContain("prompt_version_id uuid");
    expect(sql).toContain("provider_key_snapshot text not null");
    expect(sql).toContain("model_key_snapshot text not null");
    expect(sql).toContain("prompt_version_name_snapshot text");
    expect(sql).toContain("constraint ai_runs_prompt_version_logged");
    expect(sql).toContain("constraint ai_runs_model_logged");
  });

  it("logs sources shown to an AI run", () => {
    expect(sql).toContain("create table if not exists public.ai_run_sources");
    expect(sql).toContain("used_in_prompt boolean not null default true");
    expect(sql).toContain("constraint ai_run_sources_reference_present");
  });

  it("enables row level security on every PR2 table", () => {
    for (const table of expectedTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("does not add live model execution, GraphRAG, Neo4j, or fine-tuning tables", () => {
    expect(sql).not.toContain("graphrag");
    expect(sql).not.toContain("neo4j");
    expect(sql).not.toContain("fine_tuning_jobs");
    expect(sql).not.toContain("model_training_runs");
  });
});
