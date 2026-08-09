import {
  describe,
  expect,
  it,
} from "vitest";
import {
  decodePublicPlaylist,
  decodePublicPlaylistCollection,
  toPlayerQueue,
} from "../../src/services/playlists/playlistPublicModel";
import {
  parseProviderTrackUrl,
} from "../../src/services/playlists/playlistAdminUtils";

describe("Phase 5B public Playlist model", () => {
  it("decodes a mixed-provider published Playlist", () => {
    const playlist = decodePublicPlaylist({
      playlist_id: "playlist-1",
      resource_id: "resource-1",
      version_id: "version-1",
      version_number: 4,
      slug: "kenyan-songs",
      title: "Kenyan Songs",
      description: null,
      curator_label: "WAKILISHA",
      cover: {
        asset_id: "asset-1",
        asset_revision_id: "revision-1",
        url: "https://example.com/cover.jpg",
        mime_type: "image/jpeg",
        width: 1200,
        height: 1200,
        alt_text: "Playlist cover",
        caption: null,
        credit: null,
      },
      item_count: 4,
      tracks: [
        {
          playlist_item_resource_id:
            "item-resource-youtube",
          playlist_item_id:
            "item-youtube",
          position: 1,
          title: "YouTube Song",
          artist_names: ["Artist One"],
          release_title: null,
          artwork_url:
            "https://example.com/youtube.jpg",
          duration_ms: 210000,
          notes: null,
          match_status: "matched",
          registry: {
            track_id: "track-youtube",
            track_slug: "youtube-song",
            track_path:
              "/tracks/artist-one/youtube-song",
            release_id: null,
            release_slug: null,
            release_path: null,
            primary_artist_id: "artist-one",
            primary_artist_slug: "artist-one",
            primary_artist_name: "Artist One",
          },
          playback: {
            playable: true,
            engine: "youtube",
            provider_key: "youtube",
            provider_object_id: "abcdefghijk",
            provider_url:
              "https://www.youtube.com/watch?v=abcdefghijk",
            embed_url:
              "https://www.youtube.com/embed/abcdefghijk",
            preview_url: null,
            fallback_preview_url: null,
          },
        },
        {
          playlist_item_resource_id:
            "item-resource-soundcloud",
          playlist_item_id:
            "item-soundcloud",
          position: 2,
          title: "SoundCloud Song",
          artist_names: ["Artist Two"],
          release_title: null,
          artwork_url: null,
          duration_ms: null,
          notes: null,
          match_status: "unmatched",
          registry: null,
          playback: {
            playable: true,
            engine: "soundcloud",
            provider_key: "soundcloud",
            provider_object_id:
              "https://soundcloud.com/artist-two/song",
            provider_url:
              "https://soundcloud.com/artist-two/song",
            embed_url:
              "https://w.soundcloud.com/player/?url=test",
            preview_url: null,
            fallback_preview_url: null,
          },
        },
        {
          playlist_item_resource_id:
            "item-resource-apple",
          playlist_item_id:
            "item-apple",
          position: 3,
          title: "Apple Song",
          artist_names: ["Artist Three"],
          release_title: "Album",
          artwork_url: null,
          duration_ms: 180000,
          notes: null,
          match_status: "matched",
          registry: null,
          playback: {
            playable: true,
            engine: "apple_music",
            provider_key: "apple_music",
            provider_object_id: "123456789",
            provider_url:
              "https://music.apple.com/ke/song/test/123456789",
            embed_url: null,
            preview_url:
              "https://example.com/apple-preview.m4a",
            fallback_preview_url: null,
          },
        },
        {
          playlist_item_resource_id:
            "item-resource-preview",
          playlist_item_id:
            "item-preview",
          position: 4,
          title: "Registry Preview",
          artist_names: ["Artist Four"],
          release_title: null,
          artwork_url: null,
          duration_ms: 30000,
          notes: null,
          match_status: "matched",
          registry: null,
          playback: {
            playable: true,
            engine: "audio",
            provider_key: "spotify",
            provider_object_id: "spotify-id",
            provider_url:
              "https://open.spotify.com/track/spotify-id",
            embed_url: null,
            preview_url:
              "https://example.com/preview.mp3",
            fallback_preview_url: null,
          },
        },
      ],
      provenance: {
        content_fingerprint: "fingerprint",
      },
      credits: [],
      citations: [],
      corrections: [],
    });

    expect(playlist).not.toBeNull();
    expect(
      playlist?.tracks.map(
        (track) => track.playback.engine,
      ),
    ).toEqual([
      "youtube",
      "soundcloud",
      "apple_music",
      "audio",
    ]);

    const queue = toPlayerQueue(playlist!);

    expect(queue[0]?.playbackEngine)
      .toBe("youtube");
    expect(queue[0]?.providerObjectId)
      .toBe("abcdefghijk");
    expect(queue[0]?.artistSlug)
      .toBe("artist-one");
    expect(queue[0]?.trackSlug)
      .toBe("youtube-song");

    expect(queue[1]?.playbackEngine)
      .toBe("soundcloud");
    expect(queue[1]?.source)
      .toBe("SoundCloud");

    expect(queue[2]?.appleMusicCatalogId)
      .toBe("123456789");

    expect(queue[3]?.playbackEngine)
      .toBe("audio");
    expect(queue[3]?.previewUrl)
      .toBe(
        "https://example.com/preview.mp3",
      );
    expect(queue[3]?.source)
      .toBe("WAKILISHA preview");
  });

  it("defensively decodes nullable collection fields", () => {
    const collection =
      decodePublicPlaylistCollection([
        {
          snapshot_id: "snapshot-1",
          playlist_id: "playlist-1",
          resource_id: "resource-1",
          version_id: "version-1",
          slug: "playlist",
          title: "Playlist",
          description: null,
          curator_label: null,
          cover_url: null,
          cover_alt_text: null,
          item_count: 10,
          published_at:
            "2026-08-09T00:00:00Z",
          first_published_at:
            "2026-08-09T00:00:00Z",
        },
      ]);

    expect(collection).toHaveLength(1);
    expect(collection[0]?.description)
      .toBeNull();
    expect(collection[0]?.coverUrl)
      .toBeNull();
  });

  it("recognizes SoundCloud in the browser provider parser", () => {
    expect(
      parseProviderTrackUrl(
        "https://soundcloud.com/example/song",
      ),
    ).toEqual({
      providerKey: "soundcloud",
      providerTrackId: null,
      providerUrl:
        "https://soundcloud.com/example/song",
    });
  });
});
