import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260823160231_public_audio_index_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-public-audio-index-authority.sql",
  "utf8",
);
const service = readFileSync(
  "src/services/audio/audioPublicService.ts",
  "utf8",
);

describe("Public Audio index authority", () => {
  it("adds one public directory reader through existing governed public readers", () => {
    expect(migration).toContain("public.get_public_audio_index");
    expect(migration).toContain("security definer");
    expect(migration).toContain("public.get_public_audio_publication");
    expect(migration).toContain("public.get_public_show");
    expect(migration).toContain("grant execute on function public.get_public_audio_index(integer) to anon, authenticated");
    expect(migration).not.toContain("grant select on audio.publications");
    expect(migration).not.toContain("grant select on audio.shows");
  });

  it("ships a permanent readonly verifier", () => {
    expect(verifier).toContain("PUBLIC_AUDIO_INDEX_AUTHORITY_PASS");
    expect(verifier).toContain("has_function_privilege('anon'");
    expect(verifier).toContain("has_table_privilege('anon', 'audio.publications', 'SELECT')");
  });

  it("keeps browser access on the public RPC boundary", () => {
    expect(service).toContain('supabase.rpc(\n    "get_public_audio_index"');
    expect(service).toContain("decodePublicAudioPublication");
    expect(service).toContain("decodePublicShow");
    expect(service).not.toContain('.from("publications")');
    expect(service).not.toContain('.from("shows")');
  });
});
