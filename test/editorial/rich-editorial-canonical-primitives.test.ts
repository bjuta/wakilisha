import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function migration(): string {
  const files = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((name) =>
      name.endsWith("_rich_editorial_canonical_primitives_m1.sql"),
    );
  expect(files).toHaveLength(1);
  return read(`supabase/migrations/${files[0]}`);
}

describe("rich editorial canonical primitives M1", () => {
  it("binds taxonomy and discoverability to exact editorial versions", () => {
    const sql = migration();
    expect(sql).toContain("editorial.resource_version_taxonomy_terms");
    expect(sql).toContain("editorial.resource_version_editorial_metadata");
    expect(sql).toContain("registry_taxonomy_terms_taxonomy_slug_unique_idx");
    expect(sql).toContain(
      "resource_version_taxonomy_terms_taxonomy_term_idx",
    );
    expect(sql).toContain("target_version_type");
    expect(sql).toContain("metadata_revision");
    expect(sql).toContain("term_slug_snapshot");
    expect(sql).toContain("term_name_snapshot");
    expect(sql).toContain("current_working_version_id");
    expect(sql).toContain("current_user_can_edit_playlist");
    expect(sql).toContain("current_user_can_edit_audio");
  });

  it("keeps Article as a compatibility source instead of cloning its editor", () => {
    const sql = migration();
    expect(sql).toContain("category_snapshot");
    expect(sql).toContain("tag_snapshot");
    expect(sql).toContain("version.seo");
    expect(sql).toContain("article_version_editorial_metadata_materialize");
    expect(sql).not.toContain("audio_seo");
    expect(sql).not.toContain("playlist_seo");
  });

  it("preserves legacy fingerprints for empty Discovery and compounds semantic Discovery only", () => {
    const sql = migration();
    expect(sql).toContain("editorial.discovery_fingerprint_fragment");
    expect(sql).toContain("then '{}'::jsonb");
    expect(sql).toContain("jsonb_build_object('discovery', p_discovery)");
    expect(sql).toContain(
      "editorial.playlist_version_content_fingerprint_with_discovery",
    );
    expect(sql).toContain(
      "audio.publication_version_content_fingerprint_with_discovery",
    );
    expect(sql).toContain("resource_version_discovery_content_json");
  });

  it("creates successor working versions instead of mutating immutable snapshots", () => {
    const sql = migration().toLowerCase();
    const saveStart = sql.indexOf(
      "create or replace function public.save_resource_version_editorial_metadata(",
    );
    const saveEnd = sql.indexOf(
      "revoke all on function public.save_resource_version_editorial_metadata",
      saveStart,
    );
    expect(saveStart).toBeGreaterThanOrEqual(0);
    expect(saveEnd).toBeGreaterThan(saveStart);

    const save = sql.slice(saveStart, saveEnd);
    expect(save).toContain("insert into editorial.playlist_versions");
    expect(save).toContain("insert into audio.publication_versions");
    expect(save).toContain("set current_working_version_id = v_new_version_id");
    expect(save).toContain(
      "copy_playlist_working_trust_to_working_successor",
    );
    expect(save).toContain("copy_audio_version_trust_to_version");
    expect(save).not.toContain("update editorial.playlist_versions");
    expect(save).not.toContain("update audio.publication_versions");
  });

  it("guards the Playlist working successor Trust copy by frozen core equivalence", () => {
    const sql = migration();
    expect(sql).toContain(
      "editorial.copy_playlist_working_trust_to_working_successor",
    );
    expect(sql).toContain("v_source.version_kind <> 'working'");
    expect(sql).toContain("v_target.version_kind <> 'working'");
    expect(sql).toContain(
      "binding.current_working_version_id = p_source_working_version_id",
    );
    expect(sql).toContain(
      "playlist_version_content_fingerprint_with_discovery",
    );
    expect(sql).toContain(
      "Playlist Discovery Trust successor changed frozen Playlist content",
    );
  });

  it("keeps browser roles on bounded RPCs instead of shared tables or internal triggers", () => {
    const sql = migration();
    expect(sql).toContain(
      "revoke all on editorial.resource_version_editorial_metadata from public, anon, authenticated",
    );
    expect(sql).toContain(
      "revoke all on editorial.resource_version_taxonomy_terms from public, anon, authenticated",
    );
    expect(sql).toContain(
      "revoke all on function editorial.assert_resource_version_editorial_identity()",
    );
    expect(sql).toContain(
      "revoke all on function editorial.materialize_resource_version_editorial_metadata()",
    );
    expect(sql).toContain(
      "grant execute on function public.get_resource_version_editorial_metadata(text, uuid) to authenticated, service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.save_resource_version_editorial_metadata",
    );
  });

  it("keeps the shared editor free of service and Supabase authority imports", () => {
    const component = read(
      "src/components/design-system/editorial/EditorialMetadataWorkspace.tsx",
    );
    expect(component).not.toContain("@/services/");
    expect(component).not.toContain("@/lib/supabase");
    expect(component).toContain("onSearchTerms");
    expect(component).toContain("onCreateTerm");
    expect(component).toContain("onSave");
  });

  it("proves Audio and Playlist consume the same Discovery primitive", () => {
    const audio = read(
      "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
    );
    const playlist = read(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );
    const token = "@/components/design-system/editorial/EditorialMetadataWorkspace";
    expect(audio).toContain(token);
    expect(playlist).toContain(token);
  });

  it("returns the successor working version to the browser service", () => {
    const service = read(
      "src/services/editorial/editorialDiscoveryService.ts",
    );
    expect(service).toContain("const targetVersionId = text(row.target_version_id)");
    expect(service).toContain("targetVersionId,");
    expect(service).toContain('text(row.receipt_status) === "rejected"');
    expect(service).toContain("row.error_message");
  });

  it("uses semantic Media picker purposes for Audio and Playlist", () => {
    const audio = read(
      "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
    );
    const playlistDetails = read(
      "src/pages/admin/content/playlists/detail/components/PlaylistDetailsDrawer.tsx",
    );
    const preview = read(
      "src/components/admin/media/MediaLibraryPreviewPanel.tsx",
    );
    expect(audio).toContain('selectionPurpose="master_audio"');
    expect(audio).toContain('selectionPurpose="transcript"');
    expect(playlistDetails).toContain('purpose="cover_art"');
    expect(preview).not.toContain('"Use This Image"');
    expect(preview).toContain('purpose === "master_audio"');
    expect(preview).toContain('purpose === "cover_art"');
  });

  it("keeps the permanent verifier read-only", () => {
    const verifier = read(
      "scripts/control-plane/verify-rich-editorial-canonical-primitives-m1.sql",
    )
      .toLowerCase()
      .replace(/raise exception/g, "")
      .replace(/raise notice/g, "");

    expect(verifier).not.toMatch(/\binsert\s+into\b/);
    expect(verifier).not.toMatch(/\bupdate\s+[a-z_]/);
    expect(verifier).not.toMatch(/\bdelete\s+from\b/);
    expect(verifier).not.toMatch(/\bcreate\s+(table|function|trigger|index|policy)\b/);
  });
});
