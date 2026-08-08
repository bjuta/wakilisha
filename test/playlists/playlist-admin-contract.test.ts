import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseProviderTrackUrl,
  slugifyPlaylistTitle,
} from "../../src/services/playlists/playlistAdminUtils";

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Phase 5A Playlist admin product", () => {
  it("normalizes Playlist slugs without punctuation noise", () => {
    expect(slugifyPlaylistTitle("  Nairobi After Dark: Vol. 1  ")).toBe(
      "nairobi-after-dark-vol-1",
    );
  });

  it("recognizes supported provider track URLs without inventing Registry identity", () => {
    expect(
      parseProviderTrackUrl(
        "https://open.spotify.com/track/4abc123?si=test",
      ),
    ).toMatchObject({
      providerKey: "spotify",
      providerTrackId: "4abc123",
    });

    expect(
      parseProviderTrackUrl(
        "https://music.apple.com/ke/album/example/123?i=456",
      ),
    ).toMatchObject({
      providerKey: "apple_music",
      providerTrackId: "456",
    });
  });

  it("wires the canonical Playlist command surface, not the Institute bridge", () => {
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );

    for (const rpc of [
      "create_playlist",
      "update_playlist_metadata",
      "set_playlist_cover",
      "add_playlist_registry_track_with_intake_slots",
      "add_playlist_validated_provider_track_with_intake_slots",
      "get_playlist_pending_registry_intake",
      "submit_playlist_registry_intake",
      "remove_playlist_item_with_intake_slots",
      "reorder_playlist_items_with_intake_slots",
      "save_playlist_item_note",
      "resolve_playlist_item_match",
      "snapshot_playlist_working_version",
      "submit_playlist_for_review",
      "review_playlist",
      "get_playlist_review_workspace",
    ]) {
      expect(service).toContain(rpc);
    }

    expect(service).not.toContain(
      "create_institute_playlist_draft",
    );

    for (const retiredRpc of [
      'rpc("add_playlist_item"',
      'rpc("add_playlist_validated_provider_track"',
      'rpc("create_registry_track_intake_suggestion"',
      'rpc("remove_playlist_item"',
      'rpc("reorder_playlist_items"',
    ]) {
      expect(service).not.toContain(retiredRpc);
    }
  });

  it("ships list, create, and editor routes in Admin Content", () => {
    const config = source("src/router/config.tsx");
    const lazyAdmin = source("src/router/lazyAdmin.tsx");
    const shell = source("src/pages/admin/AdminShell.tsx");

    expect(config).toContain('path: "playlists"');
    expect(config).toContain('path: "playlists/new"');
    expect(config).toContain('path: "playlists/:playlistId"');
    expect(lazyAdmin).toContain("AdminPlaylistsPage");
    expect(lazyAdmin).toContain("AdminNewPlaylistPage");
    expect(lazyAdmin).toContain("AdminPlaylistDetailPage");
    expect(shell).toContain('label: "Playlists"');
  });

  it("governs Playlist cover mutation without broadening writer or author Media authority", () => {
    const migration = source(
      "supabase/migrations/20260808095000_phase_5a_playlist_cover_command_authority.sql",
    );

    expect(migration).toContain("playlist.cover.set");
    expect(migration).toContain(
      "playlist_cover_usage_governed_mutation",
    );
    expect(migration).toContain(
      "Playlist cover usage must be changed through the governed Playlist cover command.",
    );
    expect(migration).not.toMatch(
      /\('(?:writer|author)',\s*'manage_media_usage'\)/,
    );
  });

  it("makes Registry identity mandatory for new Playlist intake", () => {
    const migration = source(
      "supabase/migrations/20260808113000_phase_5a_playlist_registry_playback_cover_repair.sql",
    );
    const workspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );

    expect(migration).toContain("playlist_item_registry_identity_guard");
    expect(migration).toContain(
      "Resolve every Playlist item to the Music Registry before review.",
    );
    expect(workspace).toContain("Add from link");
    expect(workspace).toContain("Send to Registry");
    expect(workspace).not.toContain('placeholder="Artists, comma separated"');
    expect(workspace).not.toContain('placeholder="Track title"');
    expect(service).not.toContain("addExternalTrack");
  });

  it("validates YouTube embeds with a real browser player probe when no Data API key is present", () => {
    const edge = source(
      "supabase/functions/playlist-product-api/index.ts",
    );
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );
    const migration = source(
      "supabase/migrations/20260808113000_phase_5a_playlist_registry_playback_cover_repair.sql",
    );

    expect(edge).toContain("youtube_iframe_browser_probe");
    expect(edge).toContain("admin_settings_secrets");
    expect(edge).toContain('readProviderCredential("YOUTUBE_API_KEY")');
    expect(edge).toContain('validation_status: "probe_required"');
    expect(edge).toContain("confirm_playback");
    expect(edge).not.toContain(
      "YouTube playback validation is unavailable because the server-side YouTube integration is not configured.",
    );
    expect(service).toContain("probeYouTubePlayback");
    expect(service).toContain("cueVideoById");
    expect(service).toContain("code === 101 || code === 150");
    expect(service).toContain("event.data === 5");
    expect(migration).toContain("'probe_required'");
    expect(migration).toContain("iframe_cued");
  });

  it("validates provider playback server-side before provider-backed Playlist intake", () => {
    const edge = source(
      "supabase/functions/playlist-product-api/index.ts",
    );
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );

    expect(edge).toContain("status.embeddable !== true");
    expect(edge).toContain("validate_playback");
    expect(edge).toContain("record_playlist_playback_validation");
    expect(service).toContain("validatePlaylistPlaybackUrl");
    expect(service).toContain("addValidatedPlaybackTrack");
  });

  it("keeps audio and video playback kinds open for mixed Playlists", () => {
    const migration = source(
      "supabase/migrations/20260808113000_phase_5a_playlist_registry_playback_cover_repair.sql",
    );
    const edge = source(
      "supabase/functions/playlist-product-api/index.ts",
    );

    expect(migration).toContain("playback_kind in ('audio', 'video')");
    expect(edge).toContain('playbackKind: "video"');
    expect(edge).toContain('playbackKind: "audio"');
  });

  it("prepares a square derived cover instead of requiring the source image to already be a cover", () => {
    const migration = source(
      "supabase/migrations/20260808113000_phase_5a_playlist_registry_playback_cover_repair.sql",
    );
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );

    expect(migration).toContain("playlist_cover_variant");
    expect(service).toContain("preparePlaylistCoverVariant");
    expect(service).toContain("canvas.width = size");
    expect(service).toContain('assetPurpose: "playlist_cover"');
  });

  it("mounts the Media picker in the viewport portal", () => {
    const modal = source("src/components/admin/MediaPickerModal.tsx");
    expect(modal).toContain("createPortal");
    expect(modal).toContain("document.body");
    expect(modal).toContain('document.body.style.overflow = "hidden"');
  });

  it("returns useful Apple Music track metadata and rejects bare album identity", () => {
    const edge = source(
      "supabase/functions/playlist-product-api/index.ts",
    );

    expect(edge).toContain("itunes.apple.com/lookup");
    expect(edge).toContain("trackName");
    expect(edge).toContain("artistName");
    expect(edge).toContain(
      "Apple Music album links do not identify one Playlist track.",
    );
  });

  it("surfaces the provider API reason instead of a generic Edge Function error", () => {
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );

    expect(service).toContain("playlistProductErrorText");
    expect(service).toContain("response.clone().json()");

    const providerValidation = service.slice(
      service.indexOf("export async function validatePlaylistPlaybackUrl"),
      service.indexOf("export async function addValidatedPlaybackTrack"),
    );

    expect(providerValidation).toContain(
      "throw new Error(await playlistProductErrorText(error));",
    );
    expect(providerValidation).toContain(
      "throw new Error(await playlistProductErrorText(confirmError));",
    );
    expect(providerValidation).not.toContain(
      "if (error) throw new Error(error.message);",
    );
  });

  it("gives drag reorder an explicit drop target and optimistic snap", () => {
    const workspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );

    expect(workspace).toContain("The green line shows exactly where the track will land.");
    expect(workspace).toContain("Drop here");
    expect(workspace).toContain("applyLocalOrder(nextIds)");
    expect(workspace).toContain('title="Drag to reorder"');
    expect(workspace).toContain("handleTrackDragOver");
    expect(workspace).toContain("handleTrackDrop");
  });

  it("keeps Registry-review intake visible as an ordinary Playlist item", () => {
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );
    const workspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );

    expect(migration).toContain(
      "ensure_playlist_registry_intake_item",
    );
    expect(migration).toContain(
      "'registry_intake_status', 'needs_review'",
    );
    expect(migration).toContain(
      "'playlist_position_authority', 'playlist_item'",
    );

    expect(workspace).toContain("Review in Registry");
    expect(workspace).not.toContain(
      "fills this slot instead of moving to the end",
    );
    expect(workspace).not.toContain(
      "detail.pendingIntakes.map",
    );
  });
  it("captures multiple primary and featured artist credits during Registry intake", () => {
    const migration = source(
      "supabase/migrations/20260808143000_phase_5a_playlist_registry_intake_slots_and_artist_credits.sql",
    );
    const workspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );

    expect(migration).toContain(
      "registry_provider_track_suggestion_artists",
    );
    expect(migration).toContain(
      "credit_role in ('primary', 'featured')",
    );
    expect(migration).toContain("alias_candidate");
    expect(migration).toContain("new_artist");
    expect(workspace).toContain("Primary artist");
    expect(workspace).toContain("Featured artist");
    expect(workspace).toContain("Add artist credit");
  });

  it("fills a reserved Playlist slot when Registry canonicalizes the suggestion", () => {
    const migration = source(
      "supabase/migrations/20260808143000_phase_5a_playlist_registry_intake_slots_and_artist_credits.sql",
    );

    expect(migration).toContain(
      "materialize_canonicalized_playlist_registry_intake",
    );
    expect(migration).toContain(
      "registry_provider_track_suggestion_materialize_playlist_slot",
    );
    expect(migration).toContain(
      "new.reserved_position",
    );
  });

  it("uses the actual public Supabase browser environment for Playlist cover preparation", () => {
    const service = source(
      "src/services/playlists/playlistAdminService.ts",
    );

    expect(service).toContain(
      "VITE_PUBLIC_SUPABASE_URL",
    );
    expect(service).toContain(
      "VITE_PUBLIC_SUPABASE_ANON_KEY",
    );
    expect(service).not.toContain(
      "import.meta.env.VITE_SUPABASE_URL",
    );
    expect(service).not.toContain(
      "import.meta.env.VITE_SUPABASE_ANON_KEY",
    );
  });

  it("keeps Registry-review tracks under the ordinary Playlist item UX", () => {
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );
    const workspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );

    expect(migration).toContain(
      "ensure_playlist_registry_intake_item",
    );
    expect(migration).toContain(
      "'playlist_position_authority', 'playlist_item'",
    );
    expect(migration).toContain(
      "revoke execute",
    );
    expect(migration).toContain(
      "move_playlist_pending_registry_intake",
    );
    expect(migration).toContain(
      "save_playlist_pending_registry_note",
    );

    expect(workspace).not.toContain("Move up");
    expect(workspace).not.toContain("Move down");
    expect(workspace).not.toContain(
      "handlePendingRegistryNoteSave",
    );
    expect(workspace).toContain("Review in Registry");
    expect(workspace).toContain(
      "/admin/registry/tracks/intake?playlistItem=",
    );
  });

  it("materializes Registry-review tracks into the same ordered Playlist item collection", () => {
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );
    const workspace = source(
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    );

    expect(migration).toContain(
      "source_playlist_item_id = v_item_id",
    );
    expect(migration).toContain(
      "reserved_position = null",
    );
    expect(migration).toContain(
      "match_status = 'matched'",
    );

    expect(workspace).not.toContain(
      "detail.pendingIntakes.map",
    );
    expect(workspace).toContain(
      "items.map((item, index)",
    );
  });

  it("accepts active legacy-compatible Media images as Playlist cover source material", () => {
    const edge = source(
      "supabase/functions/playlist-product-api/index.ts",
    );

    expect(edge).toContain(
      '.from("registry_media_assets")',
    );
    expect(edge).toContain(
      'sourceMode = "legacy_compatibility"',
    );
    expect(edge).toContain(
      '"X-Wakilisha-Source-Mode": sourceMode',
    );
    expect(edge).toContain(
      '"get_playlist_cover_source"',
    );
  });

  it("provides a navigable Music Registry Track Intake review queue", () => {
    const page = source(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );
    const shell = source(
      "src/pages/admin/AdminShell.tsx",
    );
    const router = source(
      "src/router/config.tsx",
    );
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );

    expect(page).toContain("Track Intake");
    expect(page).toContain(
      "admin_get_registry_track_intake_queue",
    );
    expect(page).toContain(
      "admin_resolve_registry_track_intake",
    );
    expect(page).toContain(
      "admin_reject_registry_track_intake",
    );
    expect(page).toContain("Back to Playlist");

    expect(shell).toContain(
      'path: "/admin/registry/tracks/intake"',
    );
    expect(router).toContain(
      'path: "tracks/intake"',
    );

    expect(migration).toContain(
      "admin_get_registry_track_intake_queue",
    );
    expect(migration).toContain(
      "admin_resolve_registry_track_intake",
    );
  });

  it("keeps playlist_cover valid in the legacy Media compatibility projection", () => {
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );

    expect(migration).toContain(
      "registry_media_assets_asset_purpose_check",
    );
    expect(migration).toContain(
      "'playlist_cover'::text",
    );
  });

  it("makes Track Intake an enrichment workspace backed by shared provider evidence", () => {
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );
    const page = source(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );
    const providerApi = source(
      "supabase/functions/provider-intake-api/index.ts",
    );

    expect(migration).toContain(
      "provider_field_observations",
    );
    expect(migration).toContain(
      "registry_enrichment_suggestions",
    );
    expect(migration).toContain(
      "admin_record_registry_track_intake_provider_evidence",
    );
    expect(migration).toContain(
      "admin_save_registry_track_intake_enrichment",
    );
    expect(migration).toContain(
      "admin_resolve_registry_track_intake_enriched",
    );

    expect(page).toContain("Provider enrichment");
    expect(page).toContain("ISRC");
    expect(page).toContain("Save accepted enrichment");
    expect(page).toContain("Resolve + apply enrichment");
    expect(page).toContain("Apple Music");
    expect(page).toContain("Spotify");

    expect(providerApi).toContain(
      "getSpotifyAccessToken",
    );
    expect(providerApi).toContain(
      "external_ids?.isrc",
    );
    expect(providerApi).toContain(
      "duration_ms",
    );
    expect(providerApi).toContain(
      "label_name",
    );
    expect(providerApi).toContain(
      "release_date",
    );
  });

  it("makes saved Track Intake enrichment visible and persistent", () => {
    const page = source(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );

    expect(page).toContain("acceptedFieldsEqual");
    expect(page).toContain("Accepted enrichment saved");
    expect(page).toContain("Saved just now.");
    expect(page).toContain("You have unsaved enrichment changes.");
    expect(page).toContain(
      "Saved enrichment decisions could not be loaded.",
    );
    expect(page).toContain("Saved {persistedCount} fields");
    expect(page).toContain(
      "Resolving Registry identity is a separate step.",
    );

    const acceptedMerge = page.slice(
      page.indexOf("if (envelope?.accepted)"),
      page.indexOf("async function searchTracks"),
    );

    expect(
      acceptedMerge.indexOf("...envelope.accepted"),
    ).toBeLessThan(
      acceptedMerge.indexOf(
        "...(current[suggestionId] ?? {})",
      ),
    );
  });

  it("makes canonical Registry identity search usable by track, artist, or ISRC", () => {
    const page = source(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );

    expect(page).toContain('from("registry_track_artists")');
    expect(page).toContain('.ilike("artist_name_text", pattern)');
    expect(page).toContain('.ilike("isrc", pattern)');
    expect(page).toContain("trackSearchAttempted");
    expect(page).toContain("trackSearchSequence");
    expect(page).toContain("Search by track, artist, or ISRC");
    expect(page).toContain(
      "No active Registry track matches this search.",
    );
    expect(page).toContain("track.artist_names.join");
  });

  it("creates a missing canonical Registry track only through reviewed Track Intake authority", () => {
    const page = source(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );
    const migration = source(
      "supabase/migrations/20260808204500_phase_5a_track_intake_canonical_creation.sql",
    );
    const verifier = source(
      "scripts/control-plane/verify-phase-5a-track-intake-canonical-creation.sql",
    );

    expect(page).toContain(
      "admin_create_registry_track_from_intake_enriched",
    );
    expect(page).toContain(
      "Create canonical track + resolve",
    );
    expect(page).toContain(
      "Save enrichment changes before creating the canonical track.",
    );
    expect(page).toContain("preferredObservedTrackTitle");

    expect(migration).toContain(
      "admin_create_registry_track_from_intake_enriched",
    );
    expect(migration).toContain(
      "insert into public.registry_tracks",
    );
    expect(migration).toContain(
      "insert into public.registry_track_artists",
    );
    expect(migration).toContain(
      "admin_resolve_registry_track_intake_enriched",
    );
    expect(migration).not.toContain(
      "insert into public.registry_artists",
    );
    expect(migration).not.toContain(
      "insert into public.registry_releases",
    );
    expect(migration).not.toContain(
      "insert into public.registry_labels",
    );

    expect(verifier).toContain(
      "FAIL: M217 missing canonical Track Intake creation authority",
    );
    expect(verifier).toContain(
      "FAIL: M217 can silently create adjacent Registry identities",
    );
  });

  it("separates unresolved Registry identity from enrichment-only review", () => {
    const migration = source(
      "supabase/migrations/20260808163500_phase_5a_playlist_registry_review_unification.sql",
    );
    const verifier = source(
      "scripts/control-plane/verify-phase-5a-playlist-registry-review-unification.sql",
    );
    const page = source(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );

    expect(verifier).toContain(
      "suggestion.canonical_track_id is null",
    );
    expect(verifier).toContain(
      "suggestion.canonicalized_track_id is null",
    );

    expect(migration).toContain(
      "v_suggestion.canonical_track_id <> p_registry_track_id",
    );
    expect(migration).toContain(
      "'canonical_track_id', suggestion.canonical_track_id",
    );

    expect(page).toContain("Identity already matched");
    expect(page).toContain(
      "Apply enrichment to matched track",
    );
    expect(page).toContain(
      "Resolve + apply enrichment",
    );
  });

  it("keeps public-facing Playlist admin copy free of em dashes", () => {
    for (const file of [
      "src/pages/admin/content/playlists/page.tsx",
      "src/pages/admin/content/playlists/new/page.tsx",
      "src/pages/admin/content/playlists/detail/PlaylistEditorWorkspace.tsx",
    ]) {
      expect(source(file)).not.toContain("—");
    }
  });
});
