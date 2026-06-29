import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const componentFiles = [
  "src/components/admin/institute/instituteExperienceTypes.ts",
  "src/components/admin/institute/instituteExperienceStyles.ts",
  "src/components/admin/institute/InstituteActionRail.tsx",
  "src/components/admin/institute/InstituteContributionStatePanel.tsx",
  "src/components/admin/institute/InstituteDecisionLog.tsx",
  "src/components/admin/institute/InstituteEvidenceStatePanel.tsx",
  "src/components/admin/institute/InstituteNextMovePanel.tsx",
  "src/components/admin/institute/InstitutePageHeader.tsx",
  "src/components/admin/institute/InstituteQuestionPanel.tsx",
  "src/components/admin/institute/InstituteRelationshipStatePanel.tsx",
  "src/components/admin/institute/InstituteSectionCard.tsx",
  "src/components/admin/institute/InstituteStatusExplainer.tsx",
  "src/components/admin/institute/InstituteUnderstandingPanel.tsx",
  "src/components/admin/institute/InstituteUncertaintyPanel.tsx",
  "src/components/admin/institute/index.ts",
];

const combined = componentFiles
  .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
  .join("\n");

describe("Institute shared experience components", () => {
  it("creates the shared Institute component layer", () => {
    for (const file of componentFiles) {
      expect(existsSync(resolve(process.cwd(), file))).toBe(true);
    }
  });

  it("exports every shared component for PR3R and later redesign passes", async () => {
    const module = await import("@/components/admin/institute");

    for (const name of [
      "InstituteActionRail",
      "InstituteContributionStatePanel",
      "InstituteDecisionLog",
      "InstituteEvidenceStatePanel",
      "InstituteNextMovePanel",
      "InstitutePageHeader",
      "InstituteQuestionPanel",
      "InstituteRelationshipStatePanel",
      "InstituteSectionCard",
      "InstituteStatusExplainer",
      "InstituteUnderstandingPanel",
      "InstituteUncertaintyPanel",
    ]) {
      expect(module).toHaveProperty(name);
    }
  });

  it("forces the Institute method before data entry", () => {
    expect(combined).toContain("What are we trying to understand?");
    expect(combined).toContain("What do we currently believe?");
    expect(combined).toContain("What is still uncertain?");
    expect(combined).toContain("What evidence state are we carrying?");
    expect(combined).toContain("What memory has someone offered?");
    expect(combined).toContain("What does this connect?");
    expect(combined).toContain("What did we decide, and why?");
    expect(combined).toContain("What is the next honest move?");
  });

  it("uses WAKILISHA tokens and mobile-first grid patterns", () => {
    expect(combined).toContain("bg-wk-surface");
    expect(combined).toContain("border-wk-border");
    expect(combined).toContain("text-wk-text");
    expect(combined).toContain("text-wk-brand");
    expect(combined).toContain("md:grid-cols");
    expect(combined).toContain("xl:grid-cols");
  });

  it("keeps labels human instead of database-first", () => {
    for (const badLabel of [
      "No records found",
      "Create Contributor",
      "Entity linked",
      "retrieval_status",
      "review_status",
      "source_entity_id",
      "target_entity_id",
    ]) {
      expect(combined).not.toContain(badLabel);
    }
  });

  it("does not introduce PR6 AI, embeddings, public publishing, or unsafe punctuation", () => {
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("publish");
    expect(combined).not.toContain("public_safe_enabled");
    expect(combined).not.toMatch(/[—–]/);
  });
});
