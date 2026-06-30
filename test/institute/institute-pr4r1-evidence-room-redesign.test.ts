import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const listPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/evidence/page.tsx"), "utf8");
const detailPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/evidence/detail/page.tsx"), "utf8");
const service = readFileSync(resolve(process.cwd(), "src/services/institute/instituteService.ts"), "utf8");
const types = readFileSync(resolve(process.cwd(), "src/services/institute/instituteTypes.ts"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminShell.tsx"), "utf8");

describe("Institute PR4R.1 Evidence Room redesign", () => {
  it("renames the admin experience from locker to room", () => {
    expect(shell).toContain('label: "Evidence Room"');
    expect(listPage).toContain("Evidence Room");
    expect(detailPage).toContain("Evidence Room");
    expect(listPage).not.toContain("Evidence Locker");
    expect(detailPage).not.toContain("Evidence Locker");
  });

  it("uses shared Institute experience components", () => {
    for (const component of [
      "InstitutePageHeader",
      "InstituteSectionCard",
      "InstituteEvidenceStatePanel",
      "InstituteUncertaintyPanel",
      "InstituteNextMovePanel",
    ]) {
      expect(listPage).toContain(component);
      expect(detailPage).toContain(component);
    }

    expect(detailPage).toContain("InstituteUnderstandingPanel");
    expect(detailPage).toContain("InstituteDecisionLog");
  });

  it("makes evidence start with claim discipline instead of storage", () => {
    expect(listPage).toContain("What claim can this evidence safely support?");
    expect(detailPage).toContain("What claim can this evidence safely support?");
    expect(detailPage).toContain("What this does not prove");
    expect(listPage).toContain("Evidence should make overclaiming harder");
    expect(detailPage).toContain("Evidence is not storage");
  });

  it("keeps existing create, edit, review, default-use, and Inquiry link actions", () => {
    expect(listPage).toContain("createEvidenceItem");
    expect(listPage).toContain("linkEvidenceToInquiry");
    expect(detailPage).toContain("updateEvidenceItem");
    expect(detailPage).toContain("reviewEvidenceItem");
    expect(detailPage).toContain("retrieval_enabled");
    expect(detailPage).toContain("retrieval_disabled");
    expect(detailPage).toContain("Allow default use");
    expect(detailPage).toContain("Remove default use");
  });

  it("adds an evidence use map without SQL", () => {
    expect(types).toContain("inquiry?: Inquiry | null");
    expect(service).toContain("listEvidenceInquiryLinks");
    expect(service).toContain("inquiry:inquiries(*)");
    expect(detailPage).toContain("listEvidenceInquiryLinks");
    expect(detailPage).toContain("Where is this evidence already used?");
  });

  it("keeps visible labels plain instead of database-first", () => {
    for (const badVisibleLabel of [
      "No records found",
      "Create evidence",
      "Evidence detail",
      "Retrieval status",
      "Review status",
      "Source entity id",
      "Target entity id",
    ]) {
      expect(listPage).not.toContain(badVisibleLabel);
      expect(detailPage).not.toContain(badVisibleLabel);
    }
  });

  it("does not introduce SQL, PR6 AI, embeddings, public publishing, or unsafe punctuation", () => {
    const combined = [listPage, detailPage, service].join("\\n");

    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("publish");
    expect(combined).not.toContain("public_safe_enabled");
    expect(combined).not.toMatch(/[—–]/);
  });
});
