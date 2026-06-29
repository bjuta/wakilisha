import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202606290001_institute_v1_data_foundation.sql",
);

const sql = readFileSync(migrationPath, "utf8");

const expectedTables = [
  "inquiries",
  "inquiry_notes",
  "evidence_items",
  "inquiry_evidence",
  "cultural_entities",
  "entity_relationships",
  "relationship_evidence",
  "contributors",
  "contributor_submissions",
  "review_decisions",
  "surface_drafts",
  "corrections",
  "memory_embeddings",
];

describe("Institute v1 data foundation migration", () => {
  it("creates the full PR1 table set", () => {
    for (const table of expectedTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("references existing registry records instead of duplicating registry tables", () => {
    expect(sql).toContain("source_table text");
    expect(sql).toContain("source_id text");
    expect(sql).toContain("constraint cultural_entities_source_pair");

    expect(sql).not.toContain("create table if not exists public.registry_artists");
    expect(sql).not.toContain("create table if not exists public.registry_tracks");
    expect(sql).not.toContain("create table if not exists public.registry_releases");
  });

  it("prevents unreviewed evidence from entering default retrieval", () => {
    expect(sql).toContain("constraint evidence_default_retrieval_requires_review");
    expect(sql).toContain("retrieval_status <> 'default_retrieval'");
    expect(sql).toContain("review_status in ('reviewed', 'approved')");
  });

  it("keeps contributor submissions behind review", () => {
    expect(sql).toContain("review_status text not null default 'submitted'");
    expect(sql).toContain("contributor_submissions_admin_update");
    expect(sql).toContain("public.institute_can_review()");
  });

  it("enables row level security on every PR1 table", () => {
    for (const table of expectedTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("does not add PR2 model or prompt registry tables yet", () => {
    expect(sql).not.toContain("create table if not exists public.model_providers");
    expect(sql).not.toContain("create table if not exists public.model_registry");
    expect(sql).not.toContain("create table if not exists public.prompt_recipes");
    expect(sql).not.toContain("create table if not exists public.prompt_versions");
    expect(sql).not.toContain("create table if not exists public.ai_runs");
    expect(sql).not.toContain("create table if not exists public.ai_run_sources");
  });
});
