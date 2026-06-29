import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300005_close_pr2_prompt_blocked_status.sql"),
  "utf8",
);

const types = readFileSync(
  resolve(process.cwd(), "src/services/institute/modelPromptTypes.ts"),
  "utf8",
);

describe("Institute PR2 prompt blocked status closure", () => {
  it("allows prompt recipes to be blocked", () => {
    expect(migration).toContain("prompt_recipes_status_check");
    expect(migration).toContain("'blocked'");
    expect(types).toContain('export type PromptRecipeStatus = "draft" | "active" | "paused" | "deprecated" | "blocked";');
  });

  it("allows prompt versions to be blocked", () => {
    expect(migration).toContain("prompt_versions_status_check");
    expect(migration).toContain("'blocked'");
    expect(types).toContain('export type PromptVersionStatus = "draft" | "active" | "paused" | "deprecated" | "blocked";');
  });

  it("does not add live AI execution or public UI", () => {
    expect(migration).not.toContain("openai");
    expect(migration).not.toContain("anthropic");
    expect(migration).not.toContain("create table if not exists public.public");
    expect(migration).not.toContain("create table if not exists public_pages");
  });
});
