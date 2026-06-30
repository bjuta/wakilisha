import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/contributors/page.tsx"), "utf8");

describe("Institute PR4R.2 Contributor Desk redesign", () => {
  it("uses shared Institute experience components", () => {
    for (const component of [
      "InstitutePageHeader",
      "InstituteContributionStatePanel",
      "InstituteUncertaintyPanel",
      "InstituteNextMovePanel",
      "InstituteDecisionLog",
      "InstituteSectionCard",
    ]) {
      expect(page).toContain(component);
    }
  });

  it("starts with human memory, consent, source strength, review pressure, and next safe move", () => {
    expect(page).toContain("Contributor memory");
    expect(page).toContain("Receive memory from people");
    expect(page).toContain("Consent boundary");
    expect(page).toContain("Source strength");
    expect(page).toContain("Waiting for first read");
    expect(page).toContain("What should happen to this contribution?");
    expect(page).toContain("Triage new memory");
  });

  it("keeps contributor creation, submission creation, review, memory, and evidence conversion actions", () => {
    expect(page).toContain("createContributor");
    expect(page).toContain("createContributorSubmission");
    expect(page).toContain("reviewContributorSubmission");
    expect(page).toContain("acceptContributorSubmissionAsMemory");
    expect(page).toContain("acceptContributorSubmissionAsEvidence");
    expect(page).toContain("handleAcceptAsMemory");
    expect(page).toContain("handleAcceptAsEvidence");
  });

  it("protects contributor memory from unsafe evidence conversion", () => {
    expect(page).toContain("Consent is private. Keep this internal until permission changes.");
    expect(page).toContain("!hasSource || isPrivate");
    expect(page).toContain("needs source context");
    expect(page).toContain("Accept as evidence");
  });

  it("keeps visible labels human instead of database-first", () => {
    for (const badVisibleLabel of [
      "Create contributor",
      "Contributor list",
      "Create submission",
      "Submission inbox",
      "No contributors found",
      "No submissions found",
      "Review status",
      "Consent status",
      "Contributor id",
      "Review status",
      "Consent status",
    ]) {
      expect(page).not.toContain(badVisibleLabel);
    }
  });

  it("does not introduce SQL, PR6 AI, embeddings, public publishing, or unsafe punctuation", () => {
    expect(page).not.toContain("createAiRun");
    expect(page).not.toContain("embeddings.create");
    expect(page).not.toContain("publish");
    expect(page).not.toContain("public_safe_enabled");
    expect(page).not.toMatch(/[—–]/);
  });
});
