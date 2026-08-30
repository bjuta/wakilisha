import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOne(suffix: string): string {
  const dir=path.resolve("supabase/migrations");
  const matches=fs.readdirSync(dir).filter((name)=>name.endsWith(suffix));
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir,matches[0]),"utf8");
}

const migration=readOne(
  "_phase_7a_k5d_video_correction_provenance_convergence.sql",
);
const verifier=fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k5d-video-correction-provenance-convergence.sql",
  ),
  "utf8",
);
const service=fs.readFileSync(
  path.resolve("src/services/video/videoAdminService.ts"),
  "utf8",
);
const workspace=fs.readFileSync(
  path.resolve("src/pages/admin/content/video/detail/VideoEditorWorkspace.tsx"),
  "utf8",
);
const provenanceWorkspace=fs.readFileSync(
  path.resolve(
    "src/pages/admin/content/video/detail/VideoCorrectionProvenanceWorkspace.tsx",
  ),
  "utf8",
);
const registry=JSON.parse(
  fs.readFileSync(
    path.resolve("scripts/control-plane/primitive-registry.json"),
    "utf8",
  ),
) as {
  primitives: Array<{ id: string; maturity: string; consumers: string[] }>;
};

function primitive(id: string) {
  const value=registry.primitives.find((item)=>item.id===id);
  expect(value, `missing primitive ${id}`).toBeTruthy();
  return value!;
}

describe("Phase 7A K5D Video Correction target + provenance convergence",()=>{
  it("moves shared Correction targets onto canonical Resource Version identity",()=>{
    expect(migration).toContain("correction_targets_resource_version_fkey");
    expect(migration).toContain("references editorial.resource_versions");
    expect(migration).toContain("'standalone_video'");
    expect(migration).toContain("'video_episode'");
    expect(migration).toContain("'video_publication_version'");
  });

  it("preserves Article and admits Video without creating Video-owned correction tables",()=>{
    expect(migration).toContain("'article_version'");
    expect(migration).toContain("editorial.article_resources");
    expect(migration).toContain("editorial.video_publication_resources");
    expect(migration).not.toMatch(/create\s+table\s+video\.(correction|corrections)/i);
    expect(migration).not.toContain("apply_video_correction");
  });

  it("makes existing triage validate current published Resource Version provenance",()=>{
    expect(migration).toContain("public.triage_correction_case");
    expect(migration).toContain("v_target_version.content_fingerprint");
    expect(migration).toContain("current_published_version_id");
    expect(migration).toContain("'target_content_fingerprint'");
  });

  it("exposes narrow governed correction provenance through the Video workspace",()=>{
    expect(migration).toContain("public.get_admin_video_correction_provenance");
    expect(migration).toContain("'view_corrections'");
    expect(migration).toContain("'correction_provenance'");
    expect(service).toContain("correctionProvenance");
    expect(workspace).toContain("VideoCorrectionProvenanceWorkspace");
    expect(provenanceWorkspace).not.toContain("@/lib/supabase");
  });

  it("keeps correction provenance read-only in the Video UI",()=>{
    expect(provenanceWorkspace).not.toMatch(/onClick=.*correction/i);
    expect(provenanceWorkspace).toContain("No correction cases target this Video.");
    expect(provenanceWorkspace).toContain(
      "Correction provenance is available to correction reviewers.",
    );
  });

  it("does not falsely promote rich Video review comments",()=>{
    expect(provenanceWorkspace).not.toContain("EditorialCommentEditor");
    expect(primitive("editorial.comment-editor").maturity).toBe("candidate");
    expect(primitive("editorial.comment-editor").consumers).toEqual(["admin:audio"]);
  });

  it("keeps permanent verification read-only",()=>{
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K5D_VIDEO_CORRECTION_PROVENANCE_CONVERGENCE_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("keeps new public UI copy free of em dashes",()=>{
    expect(provenanceWorkspace).not.toContain("—");
  });
});
