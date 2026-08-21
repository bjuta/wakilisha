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

function readRegistry(root: string) {
  return JSON.parse(
    readFileSync(
      path.join(root, "scripts/control-plane/primitive-registry.json"),
      "utf8",
    ),
  );
}

function writeRegistry(root: string, registry: Record<string, unknown>) {
  write(
    root,
    "scripts/control-plane/primitive-registry.json",
    JSON.stringify(registry, null, 2),
  );
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "wakilisha-primitives-"));
  temporaryRoots.push(root);

  writeRegistry(root, {
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
        concept: "governed publication lifecycle status presentation",
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
  });

  write(root, "src/components/design-system/admin/AdminStatusBadge.tsx", "export const AdminStatusBadge = () => null;\n");
  write(root, "src/components/design-system/editorial/MediaTimeline.tsx", "export const MediaTimeline = () => null;\n");
  write(root, "src/pages/admin/content/articles/page.tsx", 'import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";\nexport default AdminStatusBadge;\n');
  write(root, "src/pages/admin/content/audio/page.tsx", 'import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";\nimport { MediaTimeline } from "@/components/design-system/editorial/MediaTimeline";\nexport default function Audio(){ return null; }\n');

  return root;
}

function addStatusException(
  root: string,
  exception: { path: string; classification: "legacy" | "semantic"; reason: string },
) {
  const registry = readRegistry(root);
  const status = registry.primitives.find(
    (primitive: { id: string }) => primitive.id === "admin.status-badge",
  );
  status.competingImplementationExceptions = [exception];
  writeRegistry(root, registry);
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
    writeFileSync(
      file,
      `${readFileSync(file, "utf8")}\nfunction LocalStatusBadge(){ return null; }\n`,
      "utf8",
    );
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain("competing local implementation");
  });

  it("rejects a VideoTimeline fork instead of silently relearning the time-coordinate concept", () => {
    const root = fixture();
    write(
      root,
      "src/pages/admin/content/video/page.tsx",
      "function VideoTimeline(){ return null; }\nexport default VideoTimeline;\n",
    );
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain(
      "editorial.media-timeline: competing local implementation",
    );
  });

  it("requires candidate promotion when a second domain starts consuming it", () => {
    const root = fixture();
    write(
      root,
      "src/pages/admin/content/articles/Timeline.tsx",
      'import { MediaTimeline } from "@/components/design-system/editorial/MediaTimeline";\nexport default MediaTimeline;\n',
    );
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain("Promote it to canonical");
  });

  it("rejects domain-service authority inside a consumer-owned primitive", () => {
    const root = fixture();
    write(
      root,
      "src/components/design-system/editorial/MediaTimeline.tsx",
      'import { reviewAudio } from "@/services/audio/audioReviewService";\nexport const MediaTimeline = () => reviewAudio;\n',
    );
    const result = verifyPrimitiveCompounding({ root, baseRef: null });
    expect(result.errors.join("\n")).toContain(
      "imports forbidden authority path @/services/",
    );
  });

  it("allows an exact semantic exception for a genuinely different domain state", () => {
    const root = fixture();
    const relative = "src/pages/admin/content/lyrics/page.tsx";
    write(
      root,
      relative,
      "function StatusBadge(){ return null; }\nexport default StatusBadge;\n",
    );
    addStatusException(root, {
      path: relative,
      classification: "semantic",
      reason: "Lyrics submission moderation is not publication lifecycle.",
    });

    const result = verifyPrimitiveCompounding({
      root,
      baseRef: null,
      changedPaths: [relative],
    });
    expect(result.errors).toEqual([]);
  });

  it("allows named legacy debt only while that exact file remains untouched", () => {
    const root = fixture();
    const relative = "src/pages/admin/content/guides/page.tsx";
    write(
      root,
      relative,
      "function StatusBadge(){ return null; }\nexport default StatusBadge;\n",
    );
    addStatusException(root, {
      path: relative,
      classification: "legacy",
      reason: "Pre-contract publication lifecycle badge.",
    });

    const baseline = verifyPrimitiveCompounding({
      root,
      baseRef: null,
      changedPaths: [],
    });
    expect(baseline.errors).toEqual([]);

    const touched = verifyPrimitiveCompounding({
      root,
      baseRef: null,
      changedPaths: [relative],
    });
    expect(touched.errors.join("\n")).toContain(
      "was touched. Migrate it to the canonical primitive",
    );
  });

  it("rejects stale exceptions once the competing implementation is gone", () => {
    const root = fixture();
    const relative = "src/pages/admin/content/guides/page.tsx";
    write(root, relative, "export default function Guides(){ return null; }\n");
    addStatusException(root, {
      path: relative,
      classification: "legacy",
      reason: "Pre-contract publication lifecycle badge.",
    });

    const result = verifyPrimitiveCompounding({
      root,
      baseRef: null,
      changedPaths: [],
    });
    expect(result.errors.join("\n")).toContain(
      "stale competing implementation exception",
    );
  });

  it("keeps the live WAKILISHA primitive registry internally consistent", () => {
    const result = verifyPrimitiveCompounding({
      root: process.cwd(),
      baseRef: null,
      changedPaths: [],
    });
    expect(result.errors).toEqual([]);
  });
});
