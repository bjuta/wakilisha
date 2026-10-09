import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("#1094 exact Admin decision shortcut", () => {
  const route = read("src/pages/admin/review/mizizi/page.tsx");
  const page = read("src/pages/admin/review/mizizi/issue1094.tsx");

  it("opens a dedicated task from the existing lazy Admin route", () => {
    expect(route).toContain('get("task") === "1094-d1-d3"');
    expect(route).toContain("<Issue1094ExactDecisions />");
    expect(route).toContain("<AdminMiziziWorkspaceContent />");
    expect(page).toContain("data-wk-mizizi-1094-decisions");
    expect(page).toContain("data-wk-1094-record-decisions");
  });

  it("pins all three exact review, source, and surviving Track identities", () => {
    for (const value of [
      "2b8b2d52-6c5e-4397-914d-60c8bf0e34d2",
      "f30846f0-8cf1-4df6-8875-38fa7a763e7b",
      "afbe3f47-62af-4b68-8d54-527f04987ebe",
      "6c521cd1-0438-44e7-b6b0-6b737096774b",
      "a708a142-dc2b-4fd2-9dbb-d780b666667c",
      "80642d87-769c-4949-8ecd-b3b9f6835486",
      "49ec3921-3f3e-46d3-8c3a-62f826957dfd",
      "aa2793e6-ed18-40a7-9654-dfd56769fcbe",
      "bec6a6de-3001-44a7-8241-df1cd8b932ac",
    ]) expect(page).toContain(value);
  });

  it("rechecks latest open review evidence and fingerprint before writing", () => {
    expect(page).toContain('context.trackStateFingerprint');
    expect(page).toContain('context.openRecordingIdentityReviewId !== target.review');
    expect(page).toContain('context.currentSlug !== target.slug');
    expect(page).toContain('source.ruleVersion !== "1.3.0"');
    expect(page).toContain('object(candidate).id === target.survivor');
    expect(page).toContain('const checked = await load()');
    expect(page).toContain('if (row.recorded) continue');
    expect(page).toContain('decision.decision_type !== "public_music_identity_true_duplicate"');
  });

  it("uses only the existing authenticated decision authority", () => {
    expect(page).toContain('recordRegistryReviewDecision({');
    expect(page).toContain('decisionType: "public_music_identity_true_duplicate"');
    expect(page).toContain('expectedTrackStateFingerprint: row.context.trackStateFingerprint');
    expect(page).toContain('canonicalTrackId: row.target.survivor');
    expect(page).toContain('canonicalEntitiesChanged: false');
    expect(page).toContain('reviewResolved: false');
    expect(page).toContain('redirectMutation: false');
    expect(page).not.toContain("admin_apply_registry_track_duplicate_repair");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain("—");
  });
});
