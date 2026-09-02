import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("MIZIZI Release production control plane", () => {
  it("keeps historical Release taxonomy apply behind reviewed GitHub authority", () => {
    const workflow = readFileSync(
      ".github/workflows/mizizi-release-production-control-plane.yml",
      "utf8",
    );
    const trackWorkflow = readFileSync(
      ".github/workflows/mizizi-track-production-control-plane.yml",
      "utf8",
    );
    const controlPlane = readFileSync(
      "scripts/control-plane/mizizi-release-production-control-plane.mjs",
      "utf8",
    );

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain(".github/mizizi-release-production-apply.json");
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN");
    expect(workflow).toContain(
      "group: mizizi-production-jit-control-plane",
    );
    expect(trackWorkflow).toContain(
      "group: mizizi-production-jit-control-plane",
    );
    expect(workflow).toContain("queue: max");
    expect(trackWorkflow).toContain("queue: max");
    expect(workflow).not.toContain(
      "group: mizizi-release-production-control-plane",
    );
    expect(trackWorkflow).not.toContain(
      "group: mizizi-track-production-control-plane",
    );
    expect(workflow).not.toContain("cancel-in-progress:");
    expect(trackWorkflow).not.toContain("cancel-in-progress:");
    expect(workflow).toContain(
      "node scripts/control-plane/mizizi-release-production-control-plane.mjs",
    );
    expect(workflow).toContain("scripts/registry/agents/mizizi/run.ts");
    expect(workflow).toContain("scripts/registry/agents/mizizi/core.ts");
    expect(workflow).toContain(
      "supabase/functions/_shared/release-taxonomy.ts",
    );

    expect(controlPlane).toContain("MIZIZI_RELEASE_TAXONOMY_PRODUCTION_APPLY");
    expect(controlPlane).toContain("EXPECTED_AUTHORITY_FINGERPRINT");
    expect(controlPlane).toContain("EXPECTED_CANDIDATE_FINGERPRINT");
    expect(controlPlane).toContain(
      "cf71fc24d54bb71d64a469e159daaf06b137680f294efe4542b1b691aee68b16",
    );
    expect(controlPlane).toContain(
      "238a817a5e342f8311ac04fc9a6bc978f67276cb664046cddc9e375bc323e9c4",
    );
    expect(controlPlane).toContain("--entity=release");
    expect(controlPlane).toContain("--confirm=MIZIZI_APPLY");
    expect(controlPlane).toContain(
      "production temporary access must be disabled at rest",
    );
    expect(controlPlane).toContain(
      "production temporary access disabled at rest",
    );
    expect(controlPlane).toContain("-c jit=true");
    expect(controlPlane).toMatch(/role:\s*['"]postgres['"]/);
    expect(controlPlane).toContain("createJitPoolWithRetry");
    expect(controlPlane).toContain("streamReadOnlyAuditWithRetry");
    expect(controlPlane).toContain("EJITREQUESTFAILED");
    expect(controlPlane).toContain(
      "await streamCommand('npm',['run','registry:mizizi:apply'",
    );
    expect(controlPlane).not.toContain("streamApplyWithRetry");
    expect(controlPlane).toContain("PRE_APPLY_BASELINE");
    expect(controlPlane).toContain("POST_APPLY_BASELINE");
    expect(controlPlane).toContain("refusing repeat production mutation");
    expect(controlPlane).toContain("18 bad memberships preserved");
    expect(controlPlane).toContain("mizizi_release_events");
    expect(controlPlane).not.toContain("--entity=track");
    expect(controlPlane).not.toContain("MIZIZI_TRACK_PRODUCTION_APPLY");
    expect(controlPlane).not.toContain("database password");
  });
});
