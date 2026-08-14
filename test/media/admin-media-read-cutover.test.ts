import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/"
    + "20260806055000_phase_4a_media_admin_read_adapter.sql",
  "utf8",
);
const helper = fs.readFileSync(
  "src/services/adminMediaReadService.ts",
  "utf8",
);
const article = fs.readFileSync(
  "src/services/articles/articleAdminService.ts",
  "utf8",
);
const floating = fs.readFileSync(
  "src/components/admin/editor/FloatingImageToolbar.tsx",
  "utf8",
);
const inquiry = fs.readFileSync(
  "src/pages/admin/institute/inquiry-interface/"
    + "useWakilishaRecordSearch.ts",
  "utf8",
);
const broken = fs.readFileSync(
  "src/pages/admin/media/broken/page.tsx",
  "utf8",
);
const mediaService = fs.readFileSync(
  "src/services/mediaService.ts",
  "utf8",
);
const acceptance = fs.readFileSync(
  "test/media/phase-4a-m5-public-read-lane-acceptance.test.ts",
  "utf8",
);

const directCompatibility =
  /\.from\s*\(\s*["']registry_media_assets["']\s*\)/g;

describe("Phase 4A administrative Media read cutover", () => {
  it("creates one authenticated administrative read adapter", () => {
    expect(migration).toContain(
      "public.read_media_assets_admin_v2",
    );
    expect(migration).toContain(
      "perform media.require_media_read_actor()",
    );
    expect(migration).toContain(
      "to authenticated",
    );
    expect(migration).toContain(
      "to service_role",
    );
    expect(migration).toContain(
      "from anon",
    );
  });

  it("centralizes administrative Media reads", () => {
    expect(helper).toContain(
      '"read_media_assets_admin_v2"',
    );
    expect(helper).toContain(
      "getAdminMediaAssetById",
    );
    expect(helper).toContain(
      "getAdminMediaAssetByUrl",
    );
    expect(helper).toContain(
      "getAdminMediaAssetsBySourceKeys",
    );
    expect(helper).toContain(
      "listAdminMediaAssets",
    );
    expect(helper).not.toMatch(directCompatibility);
    expect(helper).toContain("return client.rpc(");
    expect(helper).not.toContain(
      "const rpc = supabase.rpc",
    );
  });

  it("cuts over Article admin captions", () => {
    expect(article).toContain(
      "getAdminMediaAssetsByIds",
    );
    expect(article).toContain(
      "await getAdminMediaAssetsByIds(assetIds)",
    );
    expect(article).not.toMatch(directCompatibility);
  });

  it("cuts over Floating Image Toolbar detail reads", () => {
    expect(floating).toContain(
      "getAdminMediaAssetById",
    );
    expect(floating).toContain(
      "getAdminMediaAssetByUrl",
    );
    expect(floating).not.toMatch(directCompatibility);
  });

  it("preserves the frozen Institute inquiry boundary", () => {
    expect(inquiry).not.toContain(
      "getAdminMediaAssetsBySourceKeys",
    );
    expect(inquiry.match(directCompatibility) ?? [])
      .toHaveLength(2);
  });

  it("keeps broken-link reads and governs its metadata write", () => {
    expect(broken).toContain(
      "readAdminMediaAssets",
    );
    expect(broken).toContain(
      "mediaService.updateMetadata",
    );
    expect(broken.match(directCompatibility) ?? [])
      .toHaveLength(0);
  });

  it("cuts over Media Service reads and operational writes", () => {
    expect(mediaService).toContain(
      "listAdminMediaAssets",
    );
    expect(mediaService).toContain(
      "getAdminMediaAssetById",
    );
    expect(mediaService).toContain(
      "getAdminMediaAssetByUrl",
    );
    expect(mediaService.match(directCompatibility) ?? [])
      .toHaveLength(0);
    expect(mediaService).toContain(
      '"create_media_asset_write_v2"',
    );
    expect(mediaService).toContain(
      '"replace_media_asset_file_v2"',
    );
    expect(mediaService).toContain(
      '"update_media_asset_record_v2"',
    );
    expect(mediaService).toContain(
      '"update_media_asset_status_batch_v2"',
    );
  });

  it("records the remaining eleven-call boundary", () => {
    expect(acceptance).toContain(
      "expect(calls).toHaveLength(11)",
    );
    expect(acceptance).toContain(
      'expect(count("admin_ui")).toBe(2)',
    );
    expect(acceptance).toContain(
      'expect(count("admin_service")).toBe(0)',
    );
    expect(acceptance).toContain(
      'expect(count("compatibility_service")).toBe(0)',
    );
    expect(acceptance).toContain(
      'expect(count("legacy_import")).toBe(9)',
    );
  });
});
