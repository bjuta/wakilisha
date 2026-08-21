import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationFile = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith("_phase_6b_m1_public_audio_read_route.sql"))
  .sort()
  .at(-1);

if (!migrationFile) {
  throw new Error("Phase 6B M1 public Audio migration is missing.");
}

const migration = readFileSync(`supabase/migrations/${migrationFile}`, "utf8");
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6b-m1-public-audio-read-route.sql",
  "utf8",
);
const service = readFileSync(
  "src/services/audio/audioPublicService.ts",
  "utf8",
);
const model = readFileSync(
  "src/services/audio/audioPublicModel.ts",
  "utf8",
);
const page = readFileSync(
  "src/pages/audio/detail/page.tsx",
  "utf8",
);
const router = readFileSync("src/router/config.tsx", "utf8");
const lazyPublic = readFileSync("src/router/lazyPublic.tsx", "utf8");
const routeAudit = readFileSync(
  "scripts/performance/audit-public-route-splitting.mjs",
  "utf8",
);
const registry = readFileSync(
  "scripts/control-plane/primitive-registry.json",
  "utf8",
);
const reviewWorkspace = readFileSync(
  "src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx",
  "utf8",
);

describe("Phase 6B M1 public Audio read and route", () => {
  it("exposes only the exact current published Audio version", () => {
    expect(migration).toContain("public.get_public_audio_publication");
    expect(migration).toContain("binding.current_published_version_id");
    expect(migration).toContain("version_row.version_kind = 'published'");
    expect(migration).toContain("version_row.status = 'published'");
    expect(migration).toContain("audio.publication_snapshots");
    expect(migration).toContain("audio.assert_publishable_version_media");
    expect(migration).not.toContain("binding.current_working_version_id");
    expect(migration).not.toContain("binding.current_submitted_version_id");
    expect(migration).not.toContain("binding.current_approved_version_id");
    expect(migration).not.toContain("publication_review_events");
    expect(migration).not.toContain("publication_review_threads");
    expect(migration).not.toContain("publication_review_comments");
  });

  it("keeps Media, Transcript, Chapters, feed identity, and Trust bound to published authority", () => {
    expect(migration).toContain("enclosure_variant_id");
    expect(migration).toContain("enclosure_source_url");
    expect(migration).toContain("transcript_media_revision_id");
    expect(migration).toContain("audio.publication_version_chapters");
    expect(migration).toContain("audio.publication_feed_identities");
    expect(migration).toContain("attachment.target_version_type = 'audio_publication_version'");
    expect(migration).toContain("attachment.public_safe");
    expect(migration).toContain("governance.public_safe");
    expect(migration).toContain("source.current_approved_version_id = citation.source_version_id");
    expect(migration).toContain("source.exposure_class in ('public', 'public_redacted')");
    expect(migration).not.toContain("'metadata', v_version.metadata");
  });

  it("opens only the intended RPC to API roles while preserving private Audio schemas", () => {
    expect(migration).toContain(
      "revoke all on function public.get_public_audio_publication(text) from public;",
    );
    expect(migration).toContain(
      "grant execute on function public.get_public_audio_publication(text) to anon, authenticated;",
    );
    expect(migration).not.toMatch(/grant\s+usage\s+on\s+schema\s+audio/i);
    expect(migration).not.toMatch(/grant\s+select\s+on\s+audio\./i);
  });

  it("keeps the permanent verifier read-only and explicit about the public boundary", () => {
    const lower = verifier.toLowerCase();
    for (const forbidden of [
      "insert into ",
      "update ",
      "delete from ",
      "create table ",
      "alter table ",
      "drop table ",
      "create or replace function ",
    ]) {
      expect(lower).not.toContain(forbidden);
    }
    expect(verifier).toContain("has_schema_privilege('anon', 'audio', 'USAGE')");
    expect(verifier).toContain("has_table_privilege('anon', 'audio.publications', 'SELECT')");
    expect(verifier).toContain("PASS: Phase 6B M1 public Audio");
  });

  it("keeps the browser behind one decoded public RPC contract", () => {
    expect(service).toContain('supabase.rpc(\n    "get_public_audio_publication"');
    expect(service).toContain("decodePublicAudioPublication(data)");
    expect(service).not.toContain('.schema("audio")');
    expect(page).toContain("getPublicAudioPublication(slug)");
    expect(page).not.toContain("@/lib/supabase");
    expect(model).toContain("export interface PublicAudioPublication");
  });

  it("adds exactly one lazy public Audio route while preserving the old route checksum", () => {
    expect(lazyPublic).toContain('import("../pages/audio/detail/page")');
    expect(router).toContain('path: "/audio/:slug"');
    expect(router.match(/path: "\/audio\/:slug"/g)?.length).toBe(1);
    expect(routeAudit).toContain('const expectedDirectLazyImportCount = 62;');
    expect(routeAudit).toContain('const expectedRoutePathCount = 166;');
    expect(routeAudit).toContain('const publicAudioPath = "/audio/:slug";');
    expect(routeAudit).toContain("const preM1RoutePaths = routePaths.filter(");
    expect(routeAudit).toContain(
      '"b88dad0db887b324d9d9db70019651a8dfff0a745106b0838c338f6ffcc455fc"',
    );
  });

  it("hands playback to the existing WAKILISHA Player instead of creating a local Audio engine", () => {
    expect(page).toContain('import { usePlayer } from "@/context/PlayerContext"');
    expect(page).toContain("playerMediaItem(");
    expect(page).toContain('playbackAvailability: "full"');
    expect(page).toContain('mediaKind:');
    expect(page).toContain("playTrack(");
    expect(page).toContain("seek(startSeconds)");
    expect(page).not.toContain("<audio");
    expect(page).not.toContain("MediaTransport");
    expect(page).not.toContain("MediaTimeline");
    expect(page).not.toContain("useMediaPlaybackController");
  });

  it("does not manufacture public reuse from Audio editorial primitives", () => {
    expect(registry).toContain('"editorial.media-transport"');
    expect(registry).toContain('"editorial.media-timeline"');
    expect(registry).toContain('"maturity": "candidate"');
    expect(registry).not.toContain("editorial.media-playback-controller");
    expect(reviewWorkspace).not.toContain("useMediaPlaybackController");
  });

  it("keeps public Audio language reader-facing", () => {
    expect(page).toContain("Audio Unavailable");
    expect(page).toContain("This recording is not published or could not be found.");
    expect(page).toContain("Open Transcript");
    expect(page).toContain("Listen");
    expect(page).not.toContain("canonical");
    expect(page).not.toContain("asset");
    expect(page).not.toContain("identity");
    expect(page).not.toContain("—");
  });
});
