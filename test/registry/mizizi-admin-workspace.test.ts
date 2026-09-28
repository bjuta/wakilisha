import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("MIZIZI Admin workspace", () => {
  const page = read("src/pages/admin/review/mizizi/page.tsx");
  const shell = read("src/pages/admin/AdminShell.tsx");
  const routes = read("src/router/config.tsx");
  const lazy = read("src/router/lazyAdmin.tsx");
  const search = read("src/data/adminSearchIndex.ts");

  it("gives MIZIZI a dedicated current-work surface", () => {
    expect(page).toContain("data-wk-mizizi-workspace");
    expect(page).toContain("Needs a decision");
    expect(page).toContain("Approved");
    expect(page).toContain("Credit issues");
    expect(page).toContain("Needs research");
    expect(page).toContain("All current work");
    expect(page).toContain("Record and Next");
  });

  it("uses plain decisions instead of raw implementation language", () => {
    for (const copy of [
      "Use clean slug",
      "Same recording",
      "Different recording",
      "Fix credits",
      "Need more evidence",
      "Which Track should remain?",
    ]) {
      expect(page).toContain(copy);
    }

    expect(page).not.toContain("Candidate payload");
    expect(page).not.toContain("Source payload");
    expect(page).not.toContain("Operational, not decorative");
    expect(page).not.toContain("Phase 3C.3");
    expect(page).not.toContain("—");
  });

  it("reuses the existing reviewed decision authority", () => {
    expect(page).toContain("recordRegistryReviewDecision");
    expect(page).toContain("loadPublicMusicIdentityTrackReviewContext");
    expect(page).toContain("public_music_identity_true_duplicate");
    expect(page).toContain("public_music_identity_safe_slug_repair");
    expect(page).toContain("admin_mizizi_workspace");
  });

  it("wires MIZIZI into Admin without replacing audit history", () => {
    expect(lazy).toContain("AdminMiziziWorkspacePage");
    expect(routes).toContain('{ path: "mizizi", element: <AdminMiziziWorkspacePage /> }');
    expect(shell).toContain('{ path: "/admin/review/mizizi", label: "MIZIZI"');
    expect(shell).toContain('{ path: "/admin/review/queue", label: "All Reviews"');
    expect(search).toContain('id: "mizizi"');
    expect(search).toContain('path: "/admin/review/mizizi"');
  });
});
