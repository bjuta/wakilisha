import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260820180000_phase_6a_m4_audio_editor_closure.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6a-m4-audio-editor-closure.sql",
  "utf8",
);
const service = readFileSync("src/services/audio/audioAdminService.ts", "utf8");
const workspace = readFileSync(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  "utf8",
);
const routes = readFileSync("src/router/config.tsx", "utf8");
const lazyAdmin = readFileSync("src/router/lazyAdmin.tsx", "utf8");
const shell = readFileSync("src/pages/admin/AdminShell.tsx", "utf8");
const sectionLayouts = readFileSync(
  "src/components/admin/AdminSectionLayouts.tsx",
  "utf8",
);
const searchIndex = readFileSync("src/data/adminSearchIndex.ts", "utf8");

function lower(value: string) {
  return value.toLowerCase();
}

describe("Phase 6A M4 final Audio Editor closure", () => {
  it("adds chapters and exact Transcript Media without opening generic Media authority", () => {
    expect(migration).toContain("create table audio.publication_chapters");
    expect(migration).toContain("create table audio.publication_version_chapters");
    expect(migration).toContain("'audio_transcript'");
    expect(migration).toContain("transcript_media_asset_id");
    expect(migration).toContain("transcript_media_revision_id");
    expect(migration).toContain("guard_audio_transcript_usage_mutation");
    expect(lower(migration)).not.toContain(
      "create or replace function media.validate_usage_target",
    );
    expect(lower(migration)).not.toContain(
      "create or replace function public.attach_media_usage",
    );
  });

  it("freezes transcript, chapters, and shared Trust into immutable Audio versions", () => {
    expect(migration).toContain("'chapters'");
    expect(migration).toContain("audio.current_publication_transcript");
    expect(migration).toContain("copy_audio_version_trust_to_version");
    expect(migration).toContain("audio_publication_version_chapters_immutable");
    expect(migration).toContain("prevent_immutable_audio_trust_mutation");
    expect(migration).toContain(
      "on conflict (publication_version_id) do update",
    );
  });

  it("reuses shared Citations and Credits rather than creating a second Trust schema", () => {
    expect(migration).toContain("editorial.resource_citations");
    expect(migration).toContain("editorial.resource_credits");
    expect(migration).toContain("audio_publication_version");
    expect(migration).not.toContain("create table audio.citations");
    expect(migration).not.toContain("create table audio.credits");
  });

  it("keeps public SECURITY DEFINER Audio editor RPCs closed to PUBLIC and anon", () => {
    for (const signature of [
      "public.list_admin_audio_publications()",
      "public.get_admin_audio_publication_workspace(uuid)",
      "public.set_audio_publication_transcript(uuid,bigint,uuid,uuid,text,uuid)",
      "public.replace_audio_publication_chapters(uuid,bigint,jsonb,text,uuid)",
      "public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)",
      "public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)",
    ]) {
      expect(lower(migration)).toContain(
        `revoke all on function ${signature.toLowerCase()}\nfrom public, anon;`,
      );
      expect(lower(migration)).toContain(
        `grant execute on function ${signature.toLowerCase()} to authenticated, service_role`,
      );
    }
  });

  it("provides one canonical admin Audio surface using the unified Media library", () => {
    expect(service).toContain("list_admin_audio_publications");
    expect(service).toContain("get_admin_audio_publication_workspace");
    expect(service).toContain("set_audio_publication_transcript");
    expect(service).toContain("replace_audio_publication_chapters");
    expect(workspace).toContain('allowedKinds={["audio"]}');
    expect(workspace).toContain('allowedKinds={["transcript"]}');
    expect(workspace).toContain("Credits and Citations");
    expect(workspace).toContain("Review always targets one exact immutable version.");
  });

  it("wires Audio only into Admin Content and not into Phase 6B public routes", () => {
    expect(lazyAdmin).toContain("AdminAudioPage");
    expect(lazyAdmin).toContain("AdminAudioDetailPage");
    expect(routes).toContain('path: "audio"');
    expect(routes).toContain('path: "audio/:publicationId"');
    expect(routes).not.toMatch(/path:\s*["']\/audio/);
    expect(shell).toContain("/admin/content/audio");
    expect(sectionLayouts).toContain('"view_audio"');
    expect(searchIndex).toContain("/admin/content/audio");
  });

  it("keeps final 6A out of public playback, RSS XML, scheduling, and search delivery", () => {
    expect(lower(migration)).not.toContain("create table audio.rss");
    expect(lower(migration)).not.toContain("rss xml");
    expect(lower(migration)).not.toContain("audio schedule");
    expect(workspace).not.toMatch(
      /(?:to|href)=["']\/audio(?:\/|["'])/,
    );
  });

  it("keeps the permanent verifier read-only", () => {
    const body = lower(verifier)
      .replace(/raise exception/g, "")
      .replace(/raise notice/g, "");
    expect(body).not.toMatch(/\binsert\s+into\b/);
    expect(body).not.toMatch(/\bupdate\s+[a-z_]/);
    expect(body).not.toMatch(/\bdelete\s+from\b/);
    expect(body).not.toMatch(/\bcreate\s+(table|function|trigger|index)\b/);
    expect(verifier).toContain(
      "PASS: final Phase 6A Audio Editor, Chapters, Transcript, and Trust authority is intact.",
    );
  });
});
