import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202606290003_institute_retrieval_evidence_workflows.sql",
);

const sql = readFileSync(migrationPath, "utf8");

const expectedTables = [
  "evidence_review_events",
  "retrieval_policies",
  "retrieval_policy_versions",
  "retrieval_runs",
  "retrieval_run_items",
];

describe("Institute retrieval and evidence workflow migration", () => {
  it("creates the full PR3 table set", () => {
    for (const table of expectedTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("prevents default retrieval unless evidence is reviewed or approved", () => {
    expect(sql).toContain("constraint evidence_review_event_default_retrieval_requires_review");
    expect(sql).toContain("next_retrieval_status <> 'default_retrieval'");
    expect(sql).toContain("next_review_status in ('reviewed', 'approved')");
  });

  it("requires approved retrieval policy versions before activation", () => {
    expect(sql).toContain("constraint retrieval_policy_version_active_requires_approval");
    expect(sql).toContain("status <> 'active'");
    expect(sql).toContain("approved_by is not null");
  });

  it("creates security-invoker retrieval views", () => {
    expect(sql).toContain("create or replace view public.institute_retrieval_ready_evidence");
    expect(sql).toContain("create or replace view public.institute_review_queue_evidence");
    expect(sql).toContain("with (security_invoker = true)");
  });

  it("keeps retrieval scoped and bounded", () => {
    expect(sql).toContain("constraint retrieval_run_scope_present");
    expect(sql).toContain("constraint retrieval_run_top_k_positive");
    expect(sql).toContain("top_k > 0 and top_k <= 50");
  });

  it("blocks unsafe evidence from being included in context", () => {
    expect(sql).toContain("constraint retrieval_run_item_included_requires_safe_evidence");
    expect(sql).toContain("review_status_snapshot in ('reviewed', 'approved')");
    expect(sql).toContain("retrieval_status_snapshot = 'default_retrieval'");
  });

  it("does not add live model calls or embedding execution", () => {
    expect(sql).not.toContain("openai");
    expect(sql).not.toContain("anthropic");
    expect(sql).not.toContain("create_embeddings");
    expect(sql).not.toContain("call_model");
    expect(sql).not.toContain("graphrag");
    expect(sql).not.toContain("neo4j");
  });
});
