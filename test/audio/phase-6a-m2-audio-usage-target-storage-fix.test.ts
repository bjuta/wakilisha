import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260820145500_phase_6a_m2_audio_usage_target_storage_fix.sql",
  ),
  "utf8",
);

const verifier = fs.readFileSync(
  path.join(
    root,
    "scripts/control-plane/verify-phase-6a-m2-audio-usage-target-storage-fix.sql",
  ),
  "utf8",
);

describe("Phase 6A M2 Audio usage-target storage fix", () => {
  it("adds audio_publication only to the Media storage target vocabulary", () => {
    expect(migration).toContain(
      "drop constraint usage_links_target_kind_check",
    );
    expect(migration).toContain(
      "add constraint usage_links_target_kind_check",
    );
    expect(migration).toContain("'audio_publication'::text");
  });

  it("does not replace or broaden generic Media attachment authority", () => {
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+public\.attach_media_usage/i,
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+media\.validate_usage_target/i,
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+media\.usage_role_matches_target/i,
    );
  });

  it("requires the Audio-owned command to remain bound to audio_publication", () => {
    expect(migration).toContain(
      "public.set_audio_publication_master(uuid,bigint,uuid,uuid,text,uuid)",
    );
    expect(migration).toContain(
      "Audio master command no longer targets audio_publication",
    );
  });

  it("requires the generic target validator to remain closed to Audio publication", () => {
    expect(migration).toContain(
      "generic Media target validator already accepts Audio publication",
    );
    expect(verifier).toContain(
      "generic Media target validation was broadened to Audio publication",
    );
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).not.toMatch(/\binsert\s+into\b/i);
    expect(verifier).not.toMatch(/\bupdate\s+[a-z_]/i);
    expect(verifier).not.toMatch(/\bdelete\s+from\b/i);
    expect(verifier).not.toMatch(/\balter\s+table\b/i);
    expect(verifier).not.toMatch(/\bcreate\s+/i);
    expect(verifier).not.toMatch(/\bdrop\s+/i);
  });
});
