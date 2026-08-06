import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260806083000_phase_4a_media_write_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-4a-media-write-authority.sql",
  "utf8",
);
const blueprint = readFileSync(
  "docs/engineering/phase-4a-media-write-authority-immutable-replacement-blueprint.md",
  "utf8",
);

describe("Phase 4A Media write authority checkpoint", () => {
  it("adds four authenticated operational write commands", () => {
    for (const command of [
      "create_media_asset_write_v2",
      "replace_media_asset_file_v2",
      "update_media_asset_record_v2",
      "update_media_asset_status_batch_v2",
    ]) {
      expect(migration).toContain(`function public.${command}`);
    }
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).toContain("from public, anon");
  });

  it("creates verified immutable originals and optional derivatives", () => {
    expect(migration).toContain("insert_verified_file_object_v2");
    expect(migration).toContain("register_optional_variant_v2");
    expect(migration).toContain("create_media_asset_revision");
    expect(migration).toContain("activate_media_variant");
    expect(migration).toContain("Media storage locator is already registered");
  });

  it("keeps compatibility identity synchronized", () => {
    expect(migration).toContain("insert into public.registry_media_assets");
    expect(migration).toContain("insert into media.legacy_asset_links");
    expect(migration).toContain("update public.registry_media_assets");
  });

  it("uses optimistic authority revisions and archive lifecycle", () => {
    expect(migration).toContain("Stale Media authority revision");
    expect(migration).toContain("v_new_status = 'archived'");
    expect(migration).toContain("archive_reason");
  });

  it("proves original plus derivative and immutable replacement transactionally", () => {
    expect(verifier).toContain("original-one.png");
    expect(verifier).toContain("thumbnail-one.webp");
    expect(verifier).toContain("original-two.png");
    expect(verifier).toContain("Previous immutable original was changed or removed");
    expect(verifier).toContain("rollback to savepoint phase_4a_write_runtime");
  });

  it("preserves the remaining deployment and legacy boundaries", () => {
    expect(blueprint).toContain("does not tighten its policies or grants");
    expect(blueprint).toContain("two frozen Institute reads remain untouched");
    expect(blueprint).toContain("does not:\n\n- apply SQL");
    expect(blueprint).toContain("claim that Phase 4A is closed");
  });
});
