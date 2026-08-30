import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOne(suffix: string): string {
  const dir = path.resolve("supabase/migrations");
  const matches = fs.readdirSync(dir).filter((name) => name.endsWith(suffix));
  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(dir, matches[0]), "utf8");
}

const migration = readOne(
  "_media_owned_implies_consent_granted.sql",
);

const mediaEdit = fs.readFileSync(
  path.resolve("src/components/admin/media/MediaEditModal.tsx"),
  "utf8",
);

const mediaService = fs.readFileSync(
  path.resolve("src/services/mediaService.ts"),
  "utf8",
);

describe("Media owned rights imply granted consent", () => {
  it("enforces the conditional at canonical Media governance storage", () => {
    expect(migration).toContain("media.apply_owned_consent_rule");
    expect(migration).toContain("new.rights_status = 'owned'");
    expect(migration).toContain("new.consent_status := 'granted'");
    expect(migration).toContain("trg_media_owned_consent_rule");
  });

  it("derives consent in the Media editor instead of asking twice", () => {
    expect(mediaEdit).toContain(
      'rightsStatus: nextRights, consentStatus: nextRights === "owned" ? "granted" : current.consentStatus',
    );
    expect(mediaEdit).toContain(
      'disabled={governanceDraft.rightsStatus === "owned"}',
    );
    expect(mediaEdit).toContain(
      "Granted automatically because Rights is Owned.",
    );
  });

  it("normalizes owned consent in the browser command boundary too", () => {
    expect(mediaService).toContain(
      'governance.rightsStatus === "owned" ? "granted" : governance.consentStatus',
    );
  });

  it("does not rewrite historical governance rows", () => {
    expect(migration).not.toMatch(/update\s+media\.asset_governance_versions/i);
  });
});
