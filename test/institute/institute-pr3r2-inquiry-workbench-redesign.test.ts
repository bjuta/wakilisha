import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/inquiries/detail/page.tsx"), "utf8");
const service = readFileSync(resolve(process.cwd(), "src/services/institute/instituteService.ts"), "utf8");
const types = readFileSync(resolve(process.cwd(), "src/services/institute/instituteTypes.ts"), "utf8");

describe("Institute PR3R.2 Inquiry Workbench redesign", () => {
  it("uses the shared Institute experience components", () => {
    for (const component of [
      "InstitutePageHeader",
      "InstituteQuestionPanel",
      "InstituteUnderstandingPanel",
      "InstituteUncertaintyPanel",
      "InstituteEvidenceStatePanel",
      "InstituteContributionStatePanel",
      "InstituteRelationshipStatePanel",
      "InstituteDecisionLog",
      "InstituteNextMovePanel",
      "InstituteSectionCard",
    ]) {
      expect(page).toContain(component);
    }
  });

  it("leads with method components before admin editing", () => {
    for (const component of [
      "InstituteQuestionPanel",
      "InstituteUnderstandingPanel",
      "InstituteUncertaintyPanel",
      "InstituteEvidenceStatePanel",
      "InstituteContributionStatePanel",
      "InstituteRelationshipStatePanel",
      "InstituteDecisionLog",
      "InstituteNextMovePanel",
    ]) {
      expect(page).toContain(component);
      expect(page.indexOf(component)).toBeLessThan(page.indexOf("Shape the Inquiry"));
    }
  });

  it("keeps existing Inquiry actions but changes the experience language", () => {
    expect(page).toContain("updateInquiry");
    expect(page).toContain("createInquiryNote");
    expect(page).toContain("linkEntityToInquiry");
    expect(page).toContain("createCulturalEntityReference");
    expect(page).toContain("Shape the Inquiry");
    expect(page).toContain("Add what changed");
    expect(page).toContain("Who and what belongs in this Inquiry?");
    expect(page).not.toContain("Inquiry basics");
    expect(page).not.toContain("Entity linked to Inquiry.");
    expect(page).not.toContain("Entity reference created and linked.");
  });

  it("pulls evidence, contribution, and relationship state into the Workbench", () => {
    expect(types).toContain("InquiryEvidenceLink");
    expect(service).toContain("listInquiryEvidenceLinks");
    expect(page).toContain("listInquiryEvidenceLinks");
    expect(page).toContain("listContributorSubmissions");
    expect(page).toContain("listEntityRelationships");
    expect(page).toContain("evidenceLinks");
    expect(page).toContain("submissions");
    expect(page).toContain("relationships");
  });

  it("keeps visible labels plain instead of database-first", () => {
    for (const badVisibleLabel of [
      "No records found",
      "Create Contributor",
      "Retrieval status",
      "Review status",
      "Source entity id",
      "Target entity id",
      "Entity linked to Inquiry.",
      "Entity reference created and linked.",
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
