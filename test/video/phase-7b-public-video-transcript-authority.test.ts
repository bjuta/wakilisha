import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

const migration = read(
  "supabase/migrations/20260903085155_phase_7b_public_video_transcript_authority.sql",
);
const verifier = read(
  "scripts/control-plane/verify-phase-7b-public-video-transcript-authority.sql",
);
const edge = read(
  "supabase/functions/video-public-delivery/index.ts",
);
const model = read("src/services/video/videoPublicModel.ts");
const service = read("src/services/video/videoPublicService.ts");
const surface = read(
  "src/components/video/PublicVideoWatchingSurface.tsx",
);
const timedText = read("src/services/player/timedText.ts");
const databaseTypes = read("src/types/database.types.ts");

describe("Phase 7B public Video transcript authority", () => {
  it("extends the accepted public Video reader with an exact transcript relationship", () => {
    expect(migration).toContain("'transcript', v_transcript");
    expect(migration).toContain(
      "usage_row.usage_role = 'video_transcript'",
    );
    expect(migration).toContain(
      "usage_row.resolution_mode = 'exact_revision'",
    );
    expect(migration).toContain(
      "asset_row.asset_kind = 'transcript'",
    );
    expect(migration).toContain(
      "^private-files/transcripts/.+[.]txt$",
    );
    expect(migration).toContain(
      "'/video/transcripts/'",
    );
  });

  it("keeps the protected transcript target service-only", () => {
    expect(migration).toContain(
      "create or replace function public.get_public_video_transcript_delivery_target",
    );
    expect(migration).toContain(
      "resource_row.current_published_version_id = version_row.id",
    );
    expect(migration).toContain(
      "video.assert_publishable_publication_version",
    );
    expect(migration).toContain(
      "revoke all\n  on function public.get_public_video_transcript_delivery_target(uuid)\n  from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute\n  on function public.get_public_video_transcript_delivery_target(uuid)\n  to service_role;",
    );
  });

  it("does not expose a protected transcript path in the public payload", () => {
    expect(migration).not.toContain(
      "'storage_path', file_row.storage_path",
    );
  });

  it("compounds the existing Video delivery adapter for transcripts", () => {
    expect(edge).toContain(
      '"get_public_video_transcript_delivery_target"',
    );
    expect(edge).toContain(
      'kind !== "caption" && kind !== "transcript"',
    );
    expect(edge).toContain(
      "/^private-files\\/transcripts\\/[^/]+[.]txt$/i",
    );
    expect(edge).toContain(
      'mimeType !== "text/plain"',
    );
    expect(edge).toContain(
      '"Content-Type": "text/plain; charset=utf-8"',
    );
    expect(edge).toContain(
      '"get_public_video_caption_delivery_target"',
    );
    expect(edge).toContain(
      '"Content-Type": "text/vtt; charset=utf-8"',
    );
  });

  it("composes governed transcript delivery into the public Video surface", () => {
    expect(model).toContain(
      "export interface PublicVideoTranscript",
    );
    expect(model).toContain(
      "transcript: PublicVideoTranscript | null;",
    );
    expect(model).toContain(
      "deliveryPath !== `/video/transcripts/${versionId}.txt`",
    );
    expect(service).toContain(
      "export function publicVideoTranscriptUrl",
    );
    expect(service).toContain(
      'url.searchParams.set("kind", "transcript")',
    );
    expect(surface).toContain("PlayerTimedTextPanel");
    expect(surface).toContain("fetchTimedTextDocument");
    expect(surface).toContain("publicVideoTranscriptUrl");
    expect(surface).toContain("View Transcript");
    expect(timedText).toContain("parseTimedText");
  });

  it("seals the generated transcript RPC surface", () => {
    expect(databaseTypes).toContain(
      "get_public_video_transcript_delivery_target",
    );
    expect(databaseTypes).toContain(
      "Args: { p_publication_version_id: string }",
    );
  });

  it("keeps the permanent verifier read-only", () => {
    expect(verifier).toContain(
      "set local transaction read only;",
    );
    expect(verifier).toContain(
      "PHASE_7B_PUBLIC_VIDEO_TRANSCRIPT_AUTHORITY_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
