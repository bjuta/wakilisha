import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const planPath =
  "docs/institute/two-workspace-pilot-audit-and-build-plan.md";
const recordPath =
  "docs/engineering/phase-4a-m5-public-read-lane-acceptance-record.md";

const plan = fs.readFileSync(planPath, "utf8");
const record = fs.readFileSync(recordPath, "utf8");

const directCallPattern =
  /\.from\s*\(\s*["']registry_media_assets["']\s*\)/g;

const roots = [
  "src",
  "supabase/functions",
];

const adminServiceFiles = new Set([
  "src/services/adminReviewCommandCenter.ts",
  "src/services/articles/articleAdminService.ts",
]);

const compatibilityServiceFiles = new Set([
  "src/services/mediaService.ts",
]);

type Category =
  | "admin_ui"
  | "admin_service"
  | "compatibility_service"
  | "legacy_import"
  | "public_or_unclassified";

function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, {
      withFileTypes: true,
    })
    .flatMap((entry) => {
      const child = path.posix.join(root, entry.name);

      if (entry.isDirectory()) return walk(child);
      if (!entry.isFile()) return [];
      if (!child.endsWith(".ts") && !child.endsWith(".tsx")) {
        return [];
      }

      return [child];
    });
}

function classify(file: string): Category {
  if (
    file.startsWith("src/components/admin/")
    || file.startsWith("src/pages/admin/")
  ) {
    return "admin_ui";
  }

  if (adminServiceFiles.has(file)) {
    return "admin_service";
  }

  if (compatibilityServiceFiles.has(file)) {
    return "compatibility_service";
  }

  if (
    file.startsWith("src/services/legacyImport/")
    || file.startsWith(
      "supabase/functions/migrate-media-from-wp/",
    )
  ) {
    return "legacy_import";
  }

  return "public_or_unclassified";
}

function directCalls(): Array<{
  file: string;
  category: Category;
}> {
  return roots.flatMap((root) =>
    walk(root).flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      const matches = source.match(directCallPattern) ?? [];

      return matches.map(() => ({
        file,
        category: classify(file),
      }));
    }),
  );
}

describe(
  "Phase 4A Migration 5 public Media read lane acceptance",
  () => {
    it("keeps public direct compatibility calls at zero", () => {
      const calls = directCalls();
      const publicCalls = calls.filter(
        ({ category }) =>
          category === "public_or_unclassified",
      );

      expect(publicCalls).toEqual([]);
      expect(calls).toHaveLength(17);
      expect(new Set(calls.map(({ file }) => file)).size).toBe(4);
    });

    it("preserves the accepted remaining consumer classification", () => {
      const calls = directCalls();

      const count = (category: Category) =>
        calls.filter(
          (call) => call.category === category,
        ).length;

      expect(count("admin_ui")).toBe(3);
      expect(count("admin_service")).toBe(0);
      expect(count("compatibility_service")).toBe(5);
      expect(count("legacy_import")).toBe(9);
    });

    it("keeps governed public Media routes connected", () => {
      const shared = fs.readFileSync(
        "src/utils/mediaAssetProps.ts",
        "utf8",
      );
      const entities = fs.readFileSync(
        "src/services/entityMediaEnrichment.ts",
        "utf8",
      );
      const guides = fs.readFileSync(
        "src/services/guidePages.ts",
        "utf8",
      );
      const articles = fs.readFileSync(
        "src/services/magazineArticles.ts",
        "utf8",
      );
      const publicContent = fs.readFileSync(
        "src/services/publicContent/client.ts",
        "utf8",
      );

      expect(shared).toContain(
        "resolve_legacy_media_asset_lite_batch",
      );
      expect(entities).toContain(
        "batchGetMediaAssetsByUrl",
      );
      expect(guides).toContain(
        "batchGetMediaAssetsByUrl",
      );
      expect(articles).toContain(
        "batchGetMediaAssetsById",
      );
      expect(publicContent).not.toContain(
        "registry_media_assets",
      );
    });

    it("records the accepted live catalog perimeter", () => {
      expect(record).toContain(
        "direct grant count: 25",
      );
      expect(record).toContain(
        "policy count: 5",
      );
      expect(record).toContain(
        "total compatibility foreign keys: 15",
      );
      expect(record).toContain(
        "external compatibility foreign keys: 14",
      );
      expect(record).toContain(
        "internal bridge relation: `media.legacy_asset_links`",
      );
      expect(record).toContain(
        "usage links: 987",
      );
    });

    it("does not claim that Phase 4A is closed", () => {
      expect(record).toContain(
        "Phase 4A is not closed.",
      );
      expect(plan).toContain(
        "Phase 4A remains open",
      );
      expect(plan).not.toContain(
        "Phase 4A is closed",
      );
    });

    it("preserves the remaining exit work in the plan", () => {
      expect(plan).toContain(
        "Media Library command cutover",
      );
      expect(plan).toContain(
        "immutable original and derivative proof",
      );
      expect(plan).toContain(
        "in-place overwrite removal",
      );
      expect(plan).toContain(
        "compatibility policy and grant hardening",
      );
      expect(plan).toContain(
        "`cdbb4389 Retire dead track artwork Media lookup (#575)`",
      );
    });
  },
);
