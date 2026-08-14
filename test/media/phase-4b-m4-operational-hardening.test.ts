import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260807185000_phase_4b_m4_operational_hardening.sql",
  "utf8",
);

const textAssetKindMigration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260807194500_phase_4b_m4_text_asset_kind_registry.sql",
  "utf8",
);

const receiver = fs.readFileSync(
  "ops/media-receiver/server.py",
  "utf8",
);

const edge = fs.readFileSync(
  "supabase/functions/media-upload-api/index.ts",
  "utf8",
);

const nginx = fs.readFileSync(
  "ops/nginx/wakilisha-media.conf",
  "utf8",
);

const maintenance = fs.readFileSync(
  "ops/media-maintenance/maintenance.py",
  "utf8",
);

const maintenanceService = fs.readFileSync(
  "ops/systemd/wakilisha-media-maintenance.service",
  "utf8",
);

const maintenanceTimer = fs.readFileSync(
  "ops/systemd/wakilisha-media-maintenance.timer",
  "utf8",
);

const mediaService = fs.readFileSync(
  "src/services/mediaService.ts",
  "utf8",
);

const library = fs.readFileSync(
  "src/components/admin/media/MediaLibraryCore.tsx",
  "utf8",
);

const preview = fs.readFileSync(
  "src/components/admin/media/MediaLibraryPreviewPanel.tsx",
  "utf8",
);

const cdn = fs.readFileSync(
  "ops/cloudflare/phase4b-m4-media-cdn.md",
  "utf8",
);

describe("Phase 4B M4 operational hardening contract", () => {
  it("adds transcript and caption to compatibility file-kind authority", () => {
    expect(migration).toContain("'transcript'");
    expect(migration).toContain("'caption'");
    expect(migration).toContain(
      "registry_media_assets_file_kind_check",
    );
  });

  it("registers transcript and caption in canonical Media asset-kind authority", () => {
    expect(textAssetKindMigration).toContain(
      "insert into media.asset_kinds",
    );
    expect(textAssetKindMigration).toContain(
      "'transcript'",
    );
    expect(textAssetKindMigration).toContain(
      "'caption'",
    );
    expect(textAssetKindMigration).toContain(
      "and enabled",
    );
  });

  it("keeps transcript and caption files protected at the Media origin", () => {
    expect(receiver).toContain(
      'normalized.startswith("private-files/transcripts/")',
    );
    expect(receiver).toContain(
      'normalized.startswith("private-files/captions/")',
    );
    expect(nginx).toContain(
      "location ^~ /private-files/",
    );
    expect(nginx).toContain("return 404;");
  });

  it("adds signed private delivery without routing file bytes through Edge", () => {
    expect(migration).toContain(
      "get_media_private_delivery_target_v1",
    );
    expect(edge).toContain(
      'action === "create_private_delivery"',
    );
    expect(edge).toContain(
      'env("MEDIA_PRIVATE_DELIVERY_SECRET")',
    );
    expect(edge).toContain("hmacSha256Hex");
    expect(edge).not.toContain(
      "privateFileBytes",
    );
    expect(nginx).toContain(
      "auth_request /__auth/private-media",
    );
    expect(nginx).toContain(
      "alias /opt/wakilisha-media/",
    );
    expect(receiver).toContain(
      "private_delivery_authorized",
    );
  });

  it("bounds signed URLs and direct protected roots", () => {
    expect(edge).toContain(
      "Math.min(900, Math.max(30, ttlCandidate))",
    );
    expect(receiver).toContain(
      "expires > now + 900",
    );
    expect(nginx).toContain(
      "location ^~ /masters/",
    );
    expect(nginx).toContain(
      "location ^~ /derived-objects/",
    );
    expect(nginx).toContain(
      'Cache-Control "private, no-store"',
    );
  });

  it("does not install or claim automatic speech recognition", () => {
    expect(maintenance).not.toMatch(
      /\bwhisper\b/i,
    );
    expect(edge).not.toMatch(
      /\bwhisper\b/i,
    );
    expect(receiver).not.toMatch(
      /\bwhisper\b/i,
    );
  });

  it("extends the shared Media Library without opening picker defaults", () => {
    expect(mediaService).toContain(
      '| "transcript"',
    );
    expect(mediaService).toContain(
      '| "caption"',
    );
    expect(library).toContain(
      '"text/plain", ".txt", "text/vtt", ".vtt", ".srt"',
    );
    expect(library).toContain(
      'allowedKinds ?? ["image", "document"]',
    );
    expect(library).toContain(
      '<option value="transcript">Transcripts</option>',
    );
    expect(library).toContain(
      '<option value="caption">Captions</option>',
    );
  });

  it("gives administrators short-lived access to protected originals", () => {
    expect(mediaService).toContain(
      "async createPrivateDeliveryUrl(",
    );
    expect(preview).toContain(
      "Open Protected Original",
    );
    expect(preview).toContain(
      '["audio", "video", "transcript", "caption"]',
    );
  });

  it("adds service-role-only maintenance manifest authority", () => {
    expect(migration).toContain(
      "read_media_maintenance_manifest_v1",
    );
    expect(migration).toContain(
      "Service-role access is required.",
    );
    expect(migration).toContain(
      "to service_role",
    );
  });

  it("never scans inherited uploads as Phase 4B orphan authority", () => {
    expect(maintenance).toContain(
      'PROTECTED_PERSISTENT_ROOTS = (',
    );
    expect(maintenance).toContain(
      '"masters"',
    );
    expect(maintenance).toContain(
      '"derived-objects"',
    );
    expect(maintenance).toContain(
      '"private-files"',
    );
    expect(maintenance).not.toContain(
      '"uploads",\n)',
    );
  });

  it("preserves database dead-letter history while cleaning terminal staging", () => {
    expect(maintenance).toContain(
      '"dead_letter"',
    );
    expect(maintenance).toContain(
      "terminal_processing_retention",
    );
    expect(maintenance).not.toContain(
      "delete from platform_private.jobs",
    );
    expect(maintenance).not.toContain(
      "update platform_private.jobs",
    );
  });

  it("schedules repository-owned maintenance without creating another queue", () => {
    expect(maintenanceService).toContain(
      "Type=oneshot",
    );
    expect(maintenanceService).toContain(
      "/opt/wakilisha-media-maintenance/maintenance.py --apply",
    );
    expect(maintenanceTimer).toContain(
      "OnCalendar=*-*-* 03:25:00 UTC",
    );
    expect(maintenanceTimer).toContain(
      "Persistent=true",
    );
  });

  it("keeps failed-processing recovery on the existing governed command path", () => {
    expect(mediaService).toContain(
      "async retryProcessing(assetId: string)",
    );
    expect(mediaService).toContain(
      "submit_media_processing_command_v1",
    );
    expect(mediaService).toContain(
      "m3.retry.${assetId}.${crypto.randomUUID()}",
    );
  });

  it("records accepted Cloudflare CDN delivery and preserves rollback", () => {
    expect(cdn).toContain(
      "Phase 4B M4 live acceptance: PASS",
    );
    expect(cdn).toContain(
      "cf-cache-status: MISS",
    );
    expect(cdn).toContain(
      "cf-cache-status: HIT",
    );
    expect(cdn).toContain(
      "Protected cache behavior: PASS",
    );
    expect(cdn).toContain(
      "switch the Media DNS record back to DNS only",
    );
  });
});
