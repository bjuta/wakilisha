import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mediaService = readFileSync(
  "src/services/mediaService.ts",
  "utf8",
);
const userSettings = readFileSync(
  "src/hooks/useUserSettings.ts",
  "utf8",
);
const artistMediaService = readFileSync(
  "src/services/artists/artistMedia.ts",
  "utf8",
);
const uploadEdge = readFileSync(
  "supabase/functions/media-upload-api/index.ts",
  "utf8",
);
const editModal = readFileSync(
  "src/components/admin/media/MediaEditModal.tsx",
  "utf8",
);
const mediaLibrary = readFileSync(
  "src/components/admin/media/MediaLibraryCore.tsx",
  "utf8",
);
const brokenLinks = readFileSync(
  "src/pages/admin/media/broken/page.tsx",
  "utf8",
);
const blueprint = readFileSync(
  "docs/engineering/phase-4a-media-write-authority-immutable-replacement-blueprint.md",
  "utf8",
);

describe("Phase 4A Media write runtime cutover", () => {
  it("routes operational writes through the four governed commands", () => {
    expect(mediaService).toContain("create_media_asset_write_v2");
    expect(mediaService).toContain("replace_media_asset_file_v2");
    expect(mediaService).toContain("update_media_asset_record_v2");
    expect(mediaService).toContain("update_media_asset_status_batch_v2");
    expect(mediaService).toContain(
      "const { data, error } = await client.rpc(",
    );
    expect(mediaService).not.toContain(
      "const rpc = supabase.rpc",
    );
  });

  it("removes direct compatibility writes from ordinary frontend runtime", () => {
    const combined = `${mediaService}\n${brokenLinks}`;
    expect(combined).not.toMatch(
      /\.from\(["']registry_media_assets["']\)[\s\S]{0,200}?\.(insert|update|delete|upsert)\(/,
    );
  });

  it("requires immutable upload checksums", () => {
    expect(uploadEdge).toContain("crypto.subtle.digest(\"SHA-256\"");
    expect(uploadEdge).toContain("sha256,");
    expect(mediaService).toContain("payload.sha256");
    expect(mediaService).toContain("sha256: uploaded.sha256");
  });

  it("registers verified Nginx responsive derivatives", () => {
    expect(uploadEdge).toContain("__image/w${RESPONSIVE_DERIVATIVE_WIDTH}");
    expect(uploadEdge).toContain('variant_role: "responsive_width"');
    expect(uploadEdge).toContain('generator_name: "nginx-image-filter"');
    expect(uploadEdge).toContain(
      "responsive_derivative: responsiveDerivative",
    );
    expect(uploadEdge).not.toContain("createImageBitmap");
    expect(uploadEdge).not.toContain("OffscreenCanvas");
    expect(mediaService.match(/p_variant: uploaded\.variant/g) ?? [])
      .toHaveLength(2);
    expect(mediaService).not.toContain("p_variant: null");
  });

  it("rejects caller-supplied existing storage paths", () => {
    expect(uploadEdge).toContain("This file path is already in use");
    expect(uploadEdge).not.toContain("validateExistingPath");
    expect(mediaService).not.toContain('form.append("storage_path"');
    expect(userSettings).not.toContain('form.append("storage_path"');
    expect(artistMediaService).not.toContain('form.append("storage_path"');
  });

  it("keeps self-service Artist images inside the existing user-owned profile media boundary", () => {
    expect(artistMediaService).toContain(
      'uploads/profiles/${safeUserId}/artists/${safeArtistId}',
    );
    expect(artistMediaService).not.toContain("uploads/artists/");
    expect(uploadEdge).toContain(
      "isOwnProfileMediaPath(storagePath, actor.id)",
    );
    expect(uploadEdge).toContain(
      "You can only upload your own profile media.",
    );
    expect(userSettings).toContain(
      'form.append("folder", `uploads/profiles/${userId}`);',
    );
  });

  it("replaces files with new immutable revisions", () => {
    expect(mediaService).toContain(
      "Replace Media image through the immutable editor flow",
    );
    expect(mediaService).not.toContain("Re-uploads to the SAME storage path");
    expect(mediaService).not.toContain("options.storagePath");
  });

  it("retires ordinary hard delete in favor of archive", () => {
    expect(mediaService).toContain("async archiveAsset");
    expect(mediaService).not.toMatch(
      /\.from\(["']registry_media_assets["']\)[\s\S]{0,200}?\.delete\(/,
    );
    expect(editModal).toContain("Archive this file?");
    expect(editModal).toContain("Archive File");
    expect(editModal).not.toContain("Delete Permanently");
    expect(editModal).not.toContain("Delete Forever");
    expect(mediaLibrary).toContain("Archived.");
    expect(mediaLibrary).not.toContain('showToast("success", "Deleted.")');
  });

  it("records the current deployment boundary", () => {
    expect(blueprint).toContain("## Runtime cutover checkpoint");
    expect(blueprint).toContain(
      "The SQL migration, Edge Function version 18, and paired frontend runtime are deployed in production",
    );
    expect(blueprint).toContain(
      "Edge Function version 18, and paired frontend runtime are deployed",
    );
    expect(blueprint).toContain(
      "live upload and immutable replacement proof remains pending",
    );
    expect(blueprint).toContain("does not change the frozen Institute");
  });
});
