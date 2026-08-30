import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOne(suffix: string): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs.readdirSync(dir).filter((name) => name.endsWith(suffix));
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

const migration = readOne(
  "_phase_7a_k5c_video_version_trust_convergence.sql",
);
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k5c-video-version-trust-convergence.sql",
  ),
  "utf8",
);
const service = fs.readFileSync(
  path.resolve("src/services/video/videoAdminService.ts"),
  "utf8",
);
const candidateService = fs.readFileSync(
  path.resolve("src/services/video/videoTrustCandidateService.ts"),
  "utf8",
);
const workspace = fs.readFileSync(
  path.resolve(
    "src/pages/admin/content/video/detail/VideoEditorWorkspace.tsx",
  ),
  "utf8",
);
const trustWorkspace = fs.readFileSync(
  path.resolve(
    "src/pages/admin/content/video/detail/VideoTrustWorkspace.tsx",
  ),
  "utf8",
);
const registry = JSON.parse(
  fs.readFileSync(
    path.resolve("scripts/control-plane/primitive-registry.json"),
    "utf8",
  ),
) as {
  primitives: Array<{
    id: string;
    maturity: string;
    consumers: string[];
  }>;
};

function primitive(id: string) {
  const value = registry.primitives.find((item) => item.id === id);
  expect(value, `missing primitive ${id}`).toBeTruthy();
  return value!;
}

describe("Phase 7A K5C Video version Trust convergence", () => {
  it("extends the shared Trust attachment authority instead of creating Video-owned Credits or Citations", () => {
    expect(migration).toContain("editorial.resource_credits");
    expect(migration).toContain("editorial.resource_citations");
    expect(migration).toContain("'standalone_video'");
    expect(migration).toContain("'video_episode'");
    expect(migration).toContain("'video_publication_version'");
    expect(migration).not.toMatch(/create\s+table\s+video\.(credits|citations)\b/i);
  });

  it("adds optimistic Video-version Trust concurrency and governed commands", () => {
    expect(migration).toContain(
      "create table editorial.video_publication_version_trust_revisions",
    );
    expect(migration).toContain(
      "public.replace_video_publication_version_credits",
    );
    expect(migration).toContain(
      "public.replace_video_publication_version_citations",
    );
    expect(migration).toContain(
      "'video.publication.trust.credits.replace'",
    );
    expect(migration).toContain(
      "'video.publication.trust.citations.replace'",
    );
    expect(service).toContain(
      '"replace_video_publication_version_credits"',
    );
    expect(service).toContain(
      '"replace_video_publication_version_citations"',
    );
  });

  it("preserves exact Trust through working, submitted, approved, and published Video snapshots", () => {
    expect(migration).toContain(
      "editorial.copy_video_version_trust_to_version",
    );
    expect(migration).toContain(
      "platform_private.video_trust_copy_authorizations",
    );
    expect(migration).toContain(
      "editorial.prevent_immutable_video_trust_mutation",
    );
    expect(migration).toContain(
      "video.insert_current_publication_snapshot",
    );
    expect(migration).toContain(
      "video.copy_publication_version_snapshot",
    );
    expect(migration.match(/copy_video_version_trust_to_version/g)?.length)
      .toBeGreaterThanOrEqual(4);
  });

  it("keeps Video Trust service-bound and reads only governed candidates/workspace data", () => {
    expect(migration).toContain(
      "public.list_video_trust_attachment_candidates",
    );
    expect(candidateService).toContain(
      '"list_video_trust_attachment_candidates"',
    );
    expect(service).toContain("trust:");
    expect(workspace).toContain("VideoTrustWorkspace");
    expect(workspace).not.toMatch(/\.from\s*\(/);
    expect(trustWorkspace).not.toContain("@/lib/supabase");
  });

  it("promotes EditorialCreditPicker only after real Video second-consumer use", () => {
    expect(trustWorkspace).toContain("EditorialCreditPicker");
    expect(trustWorkspace).toContain("TrustAttachmentPicker");
    expect(primitive("trust.editorial-credit-picker").maturity).toBe("canonical");
    expect(primitive("trust.editorial-credit-picker").consumers).toEqual(
      expect.arrayContaining(["admin:audio", "admin:video"]),
    );
  });

  it("does not falsely promote rich review comments", () => {
    expect(trustWorkspace).not.toContain("EditorialCommentEditor");
    expect(primitive("editorial.comment-editor").maturity).toBe("candidate");
    expect(primitive("editorial.comment-editor").consumers).toEqual([
      "admin:audio",
    ]);
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K5C_VIDEO_VERSION_TRUST_CONVERGENCE_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("keeps new Video Trust UI copy free of em dashes", () => {
    expect(trustWorkspace).not.toContain("—");
  });
});
