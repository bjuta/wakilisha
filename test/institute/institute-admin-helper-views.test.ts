import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202606290004_institute_human_review_admin_helpers.sql",
);

const sql = readFileSync(migrationPath, "utf8");

const expectedViews = [
  "institute_review_queue_items",
  "institute_admin_overview_counts",
  "institute_admin_inquiry_evidence",
  "institute_admin_entity_relationships",
];

describe("Institute human review admin helper views", () => {
  it("creates the PR4 admin helper views", () => {
    for (const view of expectedViews) {
      expect(sql).toContain(`create or replace view public.${view}`);
    }
  });

  it("uses security-invoker views so RLS still applies", () => {
    const matches = sql.match(/with \(security_invoker = true\)/g) ?? [];

    expect(matches.length).toBeGreaterThanOrEqual(expectedViews.length);
  });

  it("normalizes the full human review queue into one view", () => {
    expect(sql).toContain("'evidence'::text as subject_type");
    expect(sql).toContain("'relationship'::text as subject_type");
    expect(sql).toContain("'contributor_submission'::text as subject_type");
    expect(sql).toContain("'surface_draft'::text as subject_type");
    expect(sql).toContain("'correction'::text as subject_type");
  });

  it("keeps review queue items prioritizable", () => {
    expect(sql).toContain("review_reason");
    expect(sql).toContain("priority_weight");
    expect(sql).toContain("metadata");
  });

  it("adds overview counts without adding new tables or mutation functions", () => {
    expect(sql).toContain("'review_queue_items'::text as metric_key");
    expect(sql).toContain("'active_inquiries'::text as metric_key");
    expect(sql).toContain("'retrieval_ready_evidence'::text as metric_key");
    expect(sql).toContain("'approved_relationships'::text as metric_key");
    expect(sql).toContain("'pending_contributor_submissions'::text as metric_key");

    expect(sql).not.toContain("create table");
    expect(sql).not.toContain("create function");
    expect(sql).not.toContain("for insert");
    expect(sql).not.toContain("for update");
  });

  it("grants read access to authenticated users only", () => {
    for (const view of expectedViews) {
      expect(sql).toContain(`grant select on public.${view} to authenticated`);
    }

    expect(sql).not.toContain("to anon");
  });
});
