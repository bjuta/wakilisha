import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("Provider Identity reviewed candidate promotion", () => {
  it("keeps reviewed promotion behind existing manage_registry authority", () => {
    const page = read("src/pages/admin/charts/edition-detail/page.tsx");

    expect(page).toContain('useAdminUser');
    expect(page).toContain('adminUser.can("manage_registry")');
    expect(page).toContain('upsertTrackProviderLink');
    expect(page).toContain('matchMethod: "manual"');
    expect(page).toContain('matchStatus: "matched"');
    expect(page).toContain('status: "matched"');
    expect(page).toContain('provider_identity_review');
    expect(page).toContain(
      'authority: "admin_admit_registry_track_provider_link_v1"',
    );

    expect(page).not.toContain('"chart_admit_track_provider_link_v1"');
    expect(page).not.toContain('.from("registry_track_provider_links")');
  });

  it("reuses the accepted generic Registry provider-link broker", () => {
    const client = read("src/services/registry/providerLinks.ts");

    expect(client).toContain(
      '"admin_admit_registry_track_provider_link_v1"',
    );
    expect(client).not.toContain(
      '.from("registry_track_provider_links").insert',
    );
    expect(client).not.toContain(
      '.from("registry_track_provider_links").upsert',
    );
  });

  it("keeps chart-only operators out of reviewed canonical promotion", () => {
    const roles = read("src/services/userRoles.ts");

    expect(roles).toContain(
      'chart_editor_global: ["view_dashboard", "view_charts_admin", "manage_charts"',
    );
    expect(roles).toContain(
      'registry_editor: ["view_dashboard", "view_registry", "manage_registry"',
    );
  });
});
