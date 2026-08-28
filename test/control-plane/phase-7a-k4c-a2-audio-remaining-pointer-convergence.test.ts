import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = path.resolve("supabase/migrations");
const matches = fs.readdirSync(migrationDir).filter((name) =>
  name.endsWith("_phase_7a_k4c_a2_audio_remaining_pointer_convergence.sql"),
);

expect(matches).toHaveLength(1);

const migration = fs.readFileSync(path.join(migrationDir, matches[0]), "utf8");
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4c-a2-audio-remaining-pointer-convergence.sql",
  ),
  "utf8",
);

const targets = [
  "public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)",
  "public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)",
  "public.archive_audio_publication(uuid,bigint,text,text,uuid)",
  "public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)",
  "audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)",
  "audio.publication_content_fingerprint(uuid)",
  "public.get_public_audio_publication_m1(text)",
  "public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)",
  "public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)",
  "public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)",
];

describe("Phase 7A K4C-A2 Audio remaining pointer convergence", () => {
  it("pins the exact post-A1 ten-function business dependency set", () => {
    for (const signature of targets) {
      expect(migration).toContain(signature);
    }
    expect(migration).toContain(
      "K4C-A2 expected 10 accepted Audio function definitions",
    );
  });

  it("uses fail-closed exact-fragment substitutions instead of reauthoring business functions", () => {
    expect(migration).toContain("pg_get_functiondef(");
    expect(migration).toContain("phase_7a_k4c_a2_rewrites");
    expect(migration).toContain("rewrite_row.expected_occurrences");
    expect(migration).toContain("exact old-fragment count drifted");
    expect(migration).toContain("execute v_definition;");
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+(public|audio)\.(create_audio_publication|snapshot_audio_publication_working_version|archive_audio_publication|save_resource_version_editorial_metadata|insert_current_publication_snapshot|publication_content_fingerprint|get_public_audio_publication_m1|replace_audio_publication_version_citations|replace_audio_publication_version_credits|restore_audio_publication_from_archive)/i,
    );
  });

  it("moves remaining business pointer reads and writes onto canonical Resource authority", () => {
    expect(migration).toContain("update editorial.resources resource_update");
    expect(migration).toContain("v_resource.current_working_version_id");
    expect(
      migration.match(
        /'v_binding\.current_',\s*\n\s*'v_resource\.current_',\s*\n\s*4/g,
      ),
    ).toHaveLength(2);
    expect(migration).toContain(
      "current_(working|submitted|approved|published)_version_id",
    );
    expect(migration).toContain("v_resource.current_published_version_id");
    expect(migration).toContain("resource.current_published_version_id");
    expect(migration).toContain(
      "expected only K1 Resource-to-typed compatibility writer after convergence",
    );
    expect(migration).toContain("live business function(s) still read typed Audio pointers");
  });

  it("retains A2 compatibility columns and both K1 synchronization directions for A3", () => {
    expect(migration).toContain("audio_publication_resources_sync_shared_lifecycle");
    expect(migration).toContain("resources_sync_typed_lifecycle_compatibility");
    expect(migration).toContain("1a9a366b7a26d023aa589767a2024651");
    expect(migration).toContain("619a2bd22f9066594f84dada7a119902");
    expect(migration).not.toMatch(/drop\s+column\s+current_(working|submitted|approved|published)_version_id/i);
    expect(migration).not.toMatch(/drop\s+trigger/i);
  });

  it("does not touch grants while preserving the accepted security and ACL perimeter", () => {
    expect(migration).not.toMatch(/^\s*(grant|revoke)\b/im);
    expect(migration).toContain("function_acl");
    expect(migration).toContain("search_path, or ACL");
    expect(verifier).toContain(
      "target function owner/security/volatility/search_path perimeter drifted",
    );
    expect(verifier).toContain("has_function_privilege(");
    expect(verifier).toContain("Audio mutation RPC execution perimeter drifted");
    expect(verifier).toContain("internal Audio helper execution leaked");
    expect(verifier).not.toContain("acl_text");
    expect(verifier).toContain("public.get_public_audio_publication_m1(text)");
  });

  it("preserves A1, Playlist P3, Video and pointer-parity ratchets", () => {
    expect(migration).toContain("A1 typed Audio event-writer retirement regressed");
    expect(migration).toContain("regressed Playlist P3 pointer retirement");
    expect(migration).toContain("renewed typed Video event authority");
    expect(migration).toContain("Audio pointer mirror divergence");
    expect(verifier).toContain("Playlist P3 pointer retirement regressed");
    expect(verifier).toContain("typed Video event authority exists");
  });

  it("keeps the permanent verifier read-only and authoritative", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K4C_A2_AUDIO_REMAINING_POINTER_CONVERGENCE_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
