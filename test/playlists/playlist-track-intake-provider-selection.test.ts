import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260810033000_phase_5b_track_intake_provider_selection_authority.sql",
  ),
  "utf8",
);

const page = fs.readFileSync(
  path.join(
    root,
    "src/pages/admin/registry/tracks/intake/page.tsx",
  ),
  "utf8",
);

describe("Track Intake provider selection authority", () => {
  it("separates provider evidence from editorial identity selection", () => {
    expect(migration).toContain("'candidate'");
    expect(migration).toContain("'superseded'");
    expect(migration).toContain(
      "admin_select_registry_track_intake_provider_evidence",
    );
    expect(migration).toContain(
      "link.match_status = 'confirmed'",
    );
    expect(migration).toContain(
      "not (p_fields ? suggestion.field_name)",
    );
  });

  it("keeps provider selection explicit in Track Intake", () => {
    expect(page).toContain(
      "admin_select_registry_track_intake_provider_evidence",
    );
    expect(page).toContain("Use as provider match");
    expect(page).toContain(
      "Inspecting stages evidence only. It does not select a provider identity or accept fields.",
    );
    expect(page).toContain("Provider match selected");
    expect(page).toContain('"superseded"');
  });

  it("does not auto-accept every field returned by inspection", () => {
    expect(page).not.toContain("...usefulFields");
    expect(page).toContain(
      'String(accepted[field] ?? "") ===',
    );
  });
});
