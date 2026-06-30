import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(process.cwd(), "supabase/migrations/202606300002_institute_question_lineage_foundation.sql");
const typesPath = resolve(process.cwd(), "src/services/institute/instituteTypes.ts");
const servicePath = resolve(process.cwd(), "src/services/institute/instituteService.ts");
const detailPagePath = resolve(process.cwd(), "src/pages/admin/institute/inquiries/detail/page.tsx");

const migration = readFileSync(migrationPath, "utf8");
const types = readFileSync(typesPath, "utf8");
const service = readFileSync(servicePath, "utf8");
const detailPage = readFileSync(detailPagePath, "utf8");

describe("BOOK4.1 question lineage foundation", () => {
  it("adds the question_versions migration with lineage constraints and RLS", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain("create table if not exists public.question_versions");
    expect(migration).toContain("question_versions_question_text_not_blank");
    expect(migration).toContain("question_versions_change_reason_not_blank");
    expect(migration).toContain("question_versions_unique_inquiry_version");
    expect(migration).toContain("question_versions_one_current_per_inquiry_idx");
    expect(migration).toContain("alter table public.question_versions enable row level security");
    expect(migration).toContain("grant select, insert, update on public.question_versions to authenticated");
    expect(migration).toContain("migration_backfill");
  });

  it("adds typed question version contracts", () => {
    expect(types).toContain("export interface QuestionVersion");
    expect(types).toContain("version_number: number");
    expect(types).toContain("question_text: string");
    expect(types).toContain("change_reason: string");
    expect(types).toContain("is_current: boolean");
    expect(types).toContain("export type CreateQuestionVersionInput");
  });

  it("adds lineage service helpers without a delete helper", () => {
    expect(service).toContain("listQuestionVersions");
    expect(service).toContain("getCurrentQuestionVersion");
    expect(service).toContain("createQuestionVersion");
    expect(service).toContain("setCurrentQuestionVersion");
    expect(service).toContain("Reason for change");
    expect(service).not.toContain("deleteQuestionVersion");
    expect(service).not.toContain("removeQuestionVersion");
    expect(service).not.toContain("destroyQuestionVersion");
  });

  it("makes the Inquiry detail page show lineage and locked future tools", () => {
    expect(detailPage).toContain("Question Lineage");
    expect(detailPage).toContain("Original Raw Question");
    expect(detailPage).toContain("Current Working Question");
    expect(detailPage).toContain("Next Honest Move");
    expect(detailPage).toContain("Locked future tools");
    expect(detailPage).toContain("Question Clinic");
    expect(detailPage).toContain("Path Selector");
    expect(detailPage).toContain("AI comes later, after the human workflow is strong.");
  });

  it("requires a reason when the primary question changes", () => {
    expect(detailPage).toContain("questionHasChanged");
    expect(detailPage).toContain("Reason for change");
    expect(detailPage).toContain("What became clearer?");
    expect(detailPage).toContain("Add a reason for this refinement");
    expect(detailPage).toContain("createQuestionVersion");
  });

  it("keeps BOOK4.1 narrow", () => {
    expect(detailPage).not.toContain("/studio/");
    expect(detailPage).not.toContain("Submit for Safety Pass");
    expect(detailPage).not.toContain("AI suggestion");
    expect(migration).not.toContain("embedding");
  });
});
