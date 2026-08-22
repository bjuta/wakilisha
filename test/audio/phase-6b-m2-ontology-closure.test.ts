import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260822173446_phase_6b_m2_audio_ontology_closure.sql",
  "utf8",
);
const m2Verifier = readFileSync(
  "scripts/control-plane/verify-phase-6b-m2-shared-show-hierarchy-rss.sql",
  "utf8",
);
const ontologyVerifier = readFileSync(
  "scripts/control-plane/verify-phase-6b-m2-audio-ontology-closure.sql",
  "utf8",
);
const audioPage = readFileSync(
  "src/pages/admin/content/audio/page.tsx",
  "utf8",
);
const workspace = readFileSync(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
  "utf8",
);
const showPage = readFileSync(
  "src/pages/shows/detail/page.tsx",
  "utf8",
);
const trustPicker = readFileSync(
  "src/components/design-system/trust/TrustAttachmentPicker.tsx",
  "utf8",
);
const trustService = readFileSync(
  "src/services/audio/audioTrustCandidateService.ts",
  "utf8",
);

describe("Phase 6B M2 ontology closure", () => {
  it("keeps Episode public identity Show-scoped while Audio lookup identity stays internal", () => {
    expect(migration).toContain("audio.enforce_publication_slug_identity");
    expect(migration).toContain("'ep-' || new.show_id::text || '-'");
    expect(migration).toContain("v_internal_prefix");
    expect(migration).toContain("v_episode_slug");
    expect(migration).toContain("editorial.show_episodes");
    expect(migration).toContain("public.get_public_audio_publication_m1");
    expect(migration).toContain("to_jsonb(v_episode.slug)");
    expect(migration).toContain("'/shows/'");
  });

  it("makes canonical Audio identity system-managed after creation", () => {
    expect(migration).toContain("new.slug is distinct from old.slug");
    expect(migration).toContain("Audio URL identity is system-managed");
    expect(migration).toContain("audio_publication_slug_identity_guard");
    expect(audioPage).not.toContain("publicationSlug");
    expect(audioPage).not.toContain(">Slug<");
    expect(workspace).not.toContain("setSlug");
    expect(workspace).not.toContain(">Slug<");
  });

  it("keeps the plain Audio route Standalone-only and enclosure delivery rendition-safe", () => {
    expect(migration).toContain("v_payload ->> 'publication_kind'");
    expect(migration).toContain("<> 'standalone'");
    expect(migration).toContain("public.get_public_audio_enclosure");
    expect(migration).toContain("v_audio_publication.slug");
    expect(ontologyVerifier).toContain("Plain Audio resolver is no longer Standalone-only");
    expect(m2Verifier).toContain("Public Show resolver exposes moving Audio, Review, or raw metadata authority.");
  });

  it("uses semantic Trust attachment controls instead of raw relationship IDs", () => {
    expect(migration).toContain("public.list_audio_trust_attachment_candidates");
    expect(migration).toContain("edit_own_audio");
    expect(migration).toContain("edit_others_audio");
    expect(trustPicker).toContain("Choose {noun}");
    expect(trustPicker).toContain("Attach {noun}");
    expect(trustService).toContain("list_audio_trust_attachment_candidates");
    expect(workspace).toContain("TrustAttachmentPicker");
    expect(workspace).not.toContain("Existing Credit ID");
    expect(workspace).not.toContain("Existing Citation ID");
  });

  it("uses the media anchor primitive for Chapter placement instead of raw seconds input", () => {
    expect(workspace).toContain("MediaTimeline");
    expect(workspace).toContain("onAnchorChange");
    expect(workspace).toContain("Set at Playhead");
    expect(workspace).not.toContain("start seconds");
    expect(workspace).not.toContain('step="0.001"');
  });

  it("uses WAKILISHA semantic theme primitives across the public Show surface", () => {
    expect(showPage).toContain("text-wk-text");
    expect(showPage).toContain("text-wk-text-muted");
    expect(showPage).toContain("border-wk-border");
    expect(showPage).not.toContain("dark:");
    expect(showPage).not.toContain("text-neutral-");
    expect(showPage).not.toContain("border-neutral-");
  });

  it("uses Audio ontology language rather than calling a publication a Recording", () => {
    expect(audioPage).toContain("New Audio");
    expect(audioPage).toContain("Standalone Audio");
    expect(audioPage).toContain("Show Episode");
    expect(audioPage).not.toContain("New Recording");
    expect(audioPage).toContain("shared Shows and Episodes");
  });

  it("keeps both permanent verifiers read-only", () => {
    for (const verifier of [m2Verifier, ontologyVerifier]) {
      const body = verifier
        .toLowerCase()
        .replace(/raise exception/g, "")
        .replace(/raise notice/g, "");

      for (const forbidden of [
        /\binsert\s+into\b/,
        /\bupdate\s+[a-z_]/,
        /\bdelete\s+from\b/,
        /\bcreate\s+(table|function|trigger|index|policy)\b/,
      ]) {
        expect(body).not.toMatch(forbidden);
      }
    }
  });
});
