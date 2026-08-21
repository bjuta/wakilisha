import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPrimitiveCompounding } from "../../scripts/control-plane/verify-primitive-compounding.mjs";

const temporaryRoots: string[] = [];

function write(root: string, relative: string, content: string) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "wakilisha-primitives-"));
  temporaryRoots.push(root);

  write(root, "scripts/control-plane/primitive-registry.json", JSON.stringify({
    version: 1,
    primitiveDirectories: [
      "src/components/design-system/admin",
      "src/components/design-system/editorial",
    ],
    surfaceDiscovery: [
      { childrenOf: "src/pages/admin/content", idPrefix: "admin:" },
    ],
    primitives: [
      {
        id: "admin.status-badge",
        path: "src/components/design-system/admin/AdminStatusBadge.tsx",
        kind: "presentation",
        maturity: "canonical",
        concept: "governed lifecycle status presentation",
        authorityOwner: "consumer",
        consumers: ["admin:articles", "admin:audio"],
        competingImplementationPatterns: [
          "(?:function|const)\\s+[A-Za-z0-9_]*StatusBadge\\b",
        ],
      },
      {
        id: "editorial.media-timeline",
        path: "src/components/design-system/editorial/MediaTimeline.tsx",
        kind: "interaction",
        maturity: "candidate",
        concept: "time-coordinate media navigation and annotation",
        authorityOwner: "consumer",
        consumers: ["admin:audio"],
        competingImplementationPatterns: [
          "(?:function|const)\\s+(?:AudioTimeline|VideoTimeline|WaveformTimeline|MediaTimeline)\\b",
        ],
      },
    ],
  }, null, 2));

  write(root, "src/components/design-system/admin/AdminStatusBadge.tsx", "export const AdminStatusBadge = () => null;\n");
  write(root, "src/components/design-system/editorial/MediaTimeline.tsx", "export const MediaTimeline = () => null;\n");
  write(root, "src/pages/admin/content/articles/page.tsx", 'import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";\nexport default AdminStatusBadge;\n');
  write(root, "src/pages/admin/content/audio/page.tsx", 'import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";\nimport { MediaTimeline } from "@/components/design-system/editorial/MediaTimeline";\nexport default function Audio(){ return null; }\n');

  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Primitive Compounding Contract", () => {
  it("accepts a canonical primitive with cross-domain proof and a one-domain candidate", () => {
    const result = verifyPrimitiveCompounding({ root: fixture(), baseRef: null });
    expect(result.errors).toEqual([]);
  });

  it("rejects a competing page-local implementation of a canonical concept", () => {
    const root = fixture();
    const file = path.join(root, "src/pages/admin/content/articles/page.tsx");
    writeFileSync(file, `${readFileSync(file, "utf8")}\nfunction LocalStatusBadge(){ return null; }\n`, "utf8");
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain("competing local implementation");
  });

  it("rejects a VideoTimeline fork instead of silently relearning the time-coordinate concept", () => {
    const root = fixture();
    write(root, "src/pages/admin/content/video/page.tsx", "function VideoTimeline(){ return null; }\nexport default VideoTimeline;\n");
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain("editorial.media-timeline: competing local implementation");
  });

  it("requires candidate promotion when a second domain starts consuming it", () => {
    const root = fixture();
    write(root, "src/pages/admin/content/articles/Timeline.tsx", 'import { MediaTimeline } from "@/components/design-system/editorial/MediaTimeline";\nexport default MediaTimeline;\n');
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain("Promote it to canonical");
  });

  it("rejects domain-service authority inside a consumer-owned primitive", () => {
    const root = fixture();
    write(root, "src/components/design-system/editorial/MediaTimeline.tsx", 'import { reviewAudio } from "@/services/audio/audioReviewService";\nexport const MediaTimeline = () => reviewAudio;\n');
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain("imports forbidden authority path @/services/");
  });

  it("keeps the live WAKILISHA primitive registry internally consistent", () => {
    const result = verifyPrimitiveCompounding({ root: process.cwd(), baseRef: null });
    expect(result.errors).toEqual([]);
  });
});
