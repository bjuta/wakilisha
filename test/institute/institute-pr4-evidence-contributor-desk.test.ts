import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300007_institute_pr4_evidence_locker_contributor_desk.sql"),
  "utf8",
);

const service = readFileSync(resolve(process.cwd(), "src/services/institute/instituteService.ts"), "utf8");
const types = readFileSync(resolve(process.cwd(), "src/services/institute/instituteTypes.ts"), "utf8");

describe("Institute PR4 Evidence Room and Contributor Desk foundation", () => {
  it("adds conversion RPCs for contributor submissions", () => {
    expect(migration).toContain("create or replace function public.institute_accept_submission_as_evidence");
    expect(migration).toContain("create or replace function public.institute_accept_submission_as_memory");
    expect(migration).toContain("public.institute_can_review()");
    expect(migration).toContain("accepted_as_evidence");
    expect(migration).toContain("accepted_as_memory");
  });

  it("converts submissions to reviewed evidence but keeps retrieval review-only", () => {
    expect(migration).toContain("'contributor_memory'");
    expect(migration).toContain("'reviewed'");
    expect(migration).toContain("'review_only'");
    expect(migration).toContain("insert into public.inquiry_evidence");
    expect(migration).not.toContain("'default_retrieval'");
  });

  it("converts submissions to Inquiry memory notes", () => {
    expect(migration).toContain("insert into public.inquiry_notes");
    expect(migration).toContain("'memory'");
  });

  it("adds Evidence Room and Contributor Desk service helpers", () => {
    expect(types).toContain("UpdateEvidenceItemInput");
    expect(service).toContain("listEvidenceItems");
    expect(service).toContain("getEvidenceItem");
    expect(service).toContain("updateEvidenceItem");
    expect(service).toContain("listContributors");
    expect(service).toContain("listContributorSubmissions");
    expect(service).toContain("acceptContributorSubmissionAsEvidence");
    expect(service).toContain("acceptContributorSubmissionAsMemory");
  });

  it("does not add live AI, embeddings, public publishing, or Relationship Curator scope", () => {
    const combined = [migration, service].join("\n");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(migration).not.toContain("create table if not exists public.entity_relationships");
    expect(migration).not.toContain("insert into public.entity_relationships");
    expect(combined).not.toContain('path: "/institute"');
  });
});
