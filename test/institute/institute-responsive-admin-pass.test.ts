import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const methodConsole = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/page.tsx"), "utf8");
const pageHeader = readFileSync(resolve(process.cwd(), "src/components/admin/institute/InstitutePageHeader.tsx"), "utf8");
const sectionCard = readFileSync(resolve(process.cwd(), "src/components/admin/institute/InstituteSectionCard.tsx"), "utf8");
const actionRail = readFileSync(resolve(process.cwd(), "src/components/admin/institute/InstituteActionRail.tsx"), "utf8");
const evidencePanel = readFileSync(resolve(process.cwd(), "src/components/admin/institute/InstituteEvidenceStatePanel.tsx"), "utf8");

describe("RESP.1 Institute responsive admin pass", () => {
  it("removes the five skinny desktop columns from the Method Console", () => {
    expect(methodConsole).not.toContain("xl:grid-cols-5");
    expect(methodConsole).toContain("md:grid-cols-2 2xl:grid-cols-3");
    expect(methodConsole).toContain("text-[16px] font-black leading-5");
  });

  it("uses mobile-first spacing on Institute shells and cards", () => {
    expect(methodConsole).toContain("space-y-5 p-4 sm:p-6");
    expect(methodConsole).toContain("p-4 shadow-sm sm:p-6");
    expect(methodConsole).toContain("p-4 shadow-sm sm:p-5");
    expect(pageHeader).toContain("p-4 shadow-sm sm:p-6");
    expect(sectionCard).toContain("p-4 shadow-sm sm:p-5");
  });

  it("keeps shared panels readable before jumping into three columns", () => {
    expect(actionRail).toContain("sm:grid-cols-2 2xl:grid-cols-3");
    expect(evidencePanel).toContain("sm:grid-cols-2 2xl:grid-cols-3");
    expect(evidencePanel).not.toContain("md:grid-cols-3");
  });

  it("makes admin actions usable on mobile and desktop", () => {
    expect(pageHeader).toContain("flex flex-col gap-2 sm:flex-row sm:flex-wrap");
    expect(sectionCard).toContain("flex flex-col gap-2 sm:flex-row sm:flex-wrap");
    expect(methodConsole).toContain("xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]");
  });

  it("does not introduce PR6 AI, embeddings, public graph, public publishing, or unsafe punctuation", () => {
    const combined = [methodConsole, pageHeader, sectionCard, actionRail, evidencePanel].join("\\n");

    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("PublicGraph");
    expect(combined).not.toContain("graph view");
    expect(combined).not.toContain("publishSurface");
    expect(combined).not.toContain("publishDraft");
    expect(combined).not.toMatch(/\bpublish\s*\(/);
    expect(combined).not.toMatch(/[—–]/);
  });
});
