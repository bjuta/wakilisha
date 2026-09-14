import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260914080000_phase_9a3_release_thread_registry_identity.sql",
  "utf8",
);
const runner = readFileSync(
  "scripts/registry/agents/mizizi/run.ts",
  "utf8",
);
const desktop = readFileSync(
  "src/pages/releases/detail/page.tsx",
  "utf8",
);
const mobile = readFileSync(
  "src/pages/mobile/releases/detail/page.tsx",
  "utf8",
);

describe("Release community Registry identity", () => {
  it("uses Registry Release UUIDs in desktop and mobile community payloads", () => {
    expect(desktop).toContain('type: "release" as const');
    expect(desktop).toContain("id: release.id,");
    expect(desktop).not.toContain("id: releaseSlug || undefined,");

    expect(mobile).toContain('type: "release" as const');
    expect(mobile).toContain("id: release.id,");
    expect(mobile).not.toContain("id: releaseSlug || undefined,");
  });

  it("makes Release thread ownership UUID-authoritative without global slug uniqueness", () => {
    expect(migration).toContain(
      "community_threads_non_track_release_entity_slug_key",
    );
    expect(migration).toContain(
      "entity_type not in ('track', 'release')",
    );
    expect(migration).toContain(
      "entity_id = plan.release_id::text",
    );
    expect(migration).toContain(
      "v_canonical_release_id",
    );
    expect(migration).toContain(
      "Could not resolve canonical Registry Release identity",
    );
    expect(migration).toContain(
      "thread.entity_id = v_release_id::text",
    );
  });

  it("keeps MIZIZI Release thread repairs on Registry UUID identity", () => {
    expect(runner).toContain("entity_id = $3,");
    expect(runner).toContain("entity_slug = $1,");
    expect(runner).not.toContain(
      "when entity_id = $4\\n              then $1",
    );
  });
});
