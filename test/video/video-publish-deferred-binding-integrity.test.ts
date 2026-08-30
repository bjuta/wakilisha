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
  "_video_publish_deferred_binding_integrity.sql",
);
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-video-publish-deferred-binding-integrity.sql",
  ),
  "utf8",
);

describe("Video publish deferred binding integrity", () => {
  it("runs canonical cross-resource binding integrity as internal authority", () => {
    expect(migration).toContain(
      "alter function editorial.assert_resource_binding_integrity()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "set search_path = pg_catalog, editorial, audio",
    );
  });

  it("does not open the trigger helper to browser or service roles", () => {
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
  });

  it("keeps the permanent verifier read-only and checks the deferred trigger", () => {
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "VIDEO_PUBLISH_DEFERRED_BINDING_INTEGRITY_PASS",
    );
    expect(verifier).toContain("tgdeferrable");
    expect(verifier).toContain("tginitdeferred");
  });
});
