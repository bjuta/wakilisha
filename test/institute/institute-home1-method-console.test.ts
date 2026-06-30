import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/page.tsx"), "utf8");

describe("HOME.1 Institute Method Console", () => {
  it("rebuilds the admin Institute home as the Method Console", () => {
    expect(page).toContain("Method Console");
    expect(page).toContain("The Institute starts with method.");
    expect(page).toContain("No claim travels farther than its question, evidence, review, and restraint can carry.");
    expect(page).toContain("Operating discipline");
  });

  it("shows the five-screen rule", () => {
    for (const question of [
      "What are we trying to understand?",
      "What do we currently believe?",
      "What evidence supports or weakens that belief?",
      "What is still uncertain?",
      "What is the next honest move?",
    ]) {
      expect(page).toContain(question);
    }

    expect(page).toContain("Five-screen rule");
    expect(page).toContain("Move through the method before you move the story.");
  });

  it("connects to the required Institute surfaces", () => {
    for (const route of [
      "/admin/institute/inquiries",
      "/admin/institute/evidence",
      "/admin/institute/contributors",
      "/admin/institute/relationships",
      "/admin/institute/review",
      "/library",
    ]) {
      expect(page).toContain(route);
    }

    expect(page).toContain("Inquiry Workbench");
    expect(page).toContain("Evidence Room");
    expect(page).toContain("Contributor Desk");
    expect(page).toContain("Relationship Curator");
    expect(page).toContain("Review Queue");
    expect(page).toContain("Library");
  });

  it("keeps the next move grounded in human review and restraint", () => {
    expect(page).toContain("Human review queue");
    expect(page).toContain("weak evidence, vague claims, and unsafe public meaning");
    expect(page).toContain("Choose the surface based on what needs to become more honest.");
  });

  it("does not keep the old retrieval dashboard or add forbidden scope", () => {
    expect(page).not.toContain("listRetrievalPolicies");
    expect(page).not.toContain("listRetrievalRuns");
    expect(page).not.toContain("Retrieval policies");
    expect(page).not.toContain("Recent retrieval runs");
    expect(page).not.toContain("createAiRun");
    expect(page).not.toContain("embeddings.create");
    expect(page).not.toContain("PublicGraph");
    expect(page).not.toContain("graph view");
    expect(page).not.toMatch(/[—–]/);
  });
});
