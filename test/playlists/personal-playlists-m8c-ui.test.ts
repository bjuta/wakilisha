import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const read = (
  path: string,
) =>
  readFileSync(
    path,
    "utf8",
  );

const service =
  read(
    "src/services/playlists/personalPlaylistService.ts",
  );

const addButton =
  read(
    "src/components/playlists/AddToPlaylistButton.tsx",
  );

const personCollection =
  read(
    "src/pages/playlists/person/page.tsx",
  );

const personDetail =
  read(
    "src/pages/playlists/person/detail/page.tsx",
  );

const router =
  read(
    "src/router/config.tsx",
  );

const lazyPublic =
  read(
    "src/router/lazyPublic.tsx",
  );

const playlistsIndex =
  read(
    "src/pages/playlists/page.tsx",
  );

const trackDetail =
  read(
    "src/pages/tracks/detail/page.tsx",
  );

const editorialPlaylistDetail =
  read(
    "src/pages/playlists/detail/page.tsx",
  );

const profileDesktop =
  read(
    "src/pages/profile/page.tsx",
  );

const profileMobile =
  read(
    "src/pages/mobile/profile/page.tsx",
  );

const publicProfile =
  read(
    "src/pages/profile/public/page.tsx",
  );

const publicSection =
  read(
    "src/components/playlists/PublicPersonalPlaylistsSection.tsx",
  );

describe(
  "WAKILISHA M8C-M2 Person Playlist hierarchy",
  () => {
    it(
      "uses accepted Playlist commands plus owner route resolution",
      () => {
        for (
          const rpc of [
            "create_personal_playlist",
            "update_personal_playlist",
            "add_personal_playlist_track",
            "remove_personal_playlist_item",
            "reorder_personal_playlist_items",
            "archive_personal_playlist",
            "list_my_personal_playlists",
            "get_my_personal_playlist",
            "get_my_personal_playlist_by_route",
            "get_public_personal_playlist",
            "list_public_personal_playlists_for_username",
          ]
        ) {
          expect(
            service,
          ).toContain(
            `"${rpc}"`,
          );
        }
      },
    );

    it(
      "keeps editorial Playlists in /playlists and Personal Playlists under the Person",
      () => {
        expect(
          router,
        ).toContain(
          'path: "/playlists"',
        );

        expect(
          router,
        ).toContain(
          'path: "/playlists/:slug"',
        );

        expect(
          router,
        ).toContain(
          'path: "/u/:username/playlists"',
        );

        expect(
          router,
        ).toContain(
          'path: "/u/:username/playlists/:playlistSlug"',
        );

        expect(
          router,
        ).not.toContain(
          'path: "/playlists/mine"',
        );

        expect(
          router,
        ).not.toContain(
          'path: "/playlists/p/:slug"',
        );

        expect(
          router,
        ).not.toContain(
          'path: "/playlists/:username/:playlistSlug"',
        );

        expect(
          lazyPublic,
        ).toContain(
          "PersonPlaylistsPage",
        );

        expect(
          lazyPublic,
        ).toContain(
          "PersonPlaylistDetailPage",
        );
      },
    );

    it(
      "treats Your Playlists as owner UI rather than a Playlist namespace",
      () => {
        expect(
          personCollection,
        ).toContain(
          "Your Playlists",
        );

        expect(
          personCollection,
        ).toContain(
          "/u/${encodeURIComponent(username)}/playlists/${encodeURIComponent(playlist.slug)}",
        );

        expect(
          personCollection,
        ).not.toContain(
          "/playlists/mine",
        );

        expect(
          personDetail,
        ).not.toContain(
          "/playlists/mine",
        );
      },
    );

    it(
      "uses the same Person Playlist URL for owner controls and public viewing",
      () => {
        expect(
          personDetail,
        ).toContain(
          "getMyPersonalPlaylistByRoute",
        );

        expect(
          personDetail,
        ).toContain(
          "getPublicPersonalPlaylist",
        );

        expect(
          personDetail,
        ).toContain(
          "isOwner",
        );

        expect(
          personDetail,
        ).toContain(
          "updatePersonalPlaylist",
        );

        expect(
          personDetail,
        ).toContain(
          "reorderPersonalPlaylistItems",
        );

        expect(
          personDetail,
        ).toContain(
          "removePersonalPlaylistItem",
        );

        expect(
          personDetail,
        ).toContain(
          "archivePersonalPlaylist",
        );

        expect(
          personDetail,
        ).toContain(
          "https://wakilisha.africa/u/${username}/playlists/${playlist.slug}",
        );
      },
    );

    it(
      "keeps owner settings explicit and reuses the proven Settings module grammar",
      () => {
        expect(
          personDetail,
        ).toContain(
          "isMetadataDirty",
        );

        expect(
          personDetail,
        ).toContain(
          "Playlist settings",
        );

        expect(
          personDetail,
        ).toContain(
          "Discard",
        );

        expect(
          personDetail,
        ).toContain(
          "setIsEditing(false)",
        );

        expect(
          personDetail,
        ).toMatch(
          /isOwner\s*&&\s*!archived\s*&&\s*isEditing\s*\?\s*\(/,
        );

        expect(
          personDetail,
        ).toMatch(
          /isOwner\s*&&\s*!archived\s*&&\s*!isEditing\s*\?\s*\(/,
        );

        for (
          const settingsClass of [
            "settings49-pane",
            "settings49-pane-head",
            "settings49-input-grid",
            "settings49-field",
            "settings49-input",
            "settings49-textarea",
            "settings49-row",
            "settings49-savebar",
            "settings49-danger",
            "wk-button",
          ]
        ) {
          expect(
            personDetail,
          ).toContain(
            settingsClass,
          );
        }

        for (
          const mobileDensityClass of [
            "max-sm:!p-4",
            "max-sm:!text-[20px]",
            "max-sm:!min-h-[76px]",
            "max-sm:!mt-4",
            "max-sm:!p-2.5",
            "max-sm:!p-3",
          ]
        ) {
          expect(
            personDetail,
          ).toContain(
            mobileDensityClass,
          );
        }

        expect(
          personDetail,
        ).toContain(
          "Private is only for you. Public can be opened and shared by anyone with the link.",
        );

        expect(
          personDetail,
        ).toContain(
          "!isMetadataDirty",
        );

        expect(
          personDetail,
        ).toContain(
          "Archive Playlist",
        );
      },
    );

    it(
      "keeps Save and Add to Playlist separate",
      () => {
        expect(
          trackDetail,
        ).toContain(
          "Save track",
        );

        expect(
          trackDetail,
        ).toContain(
          "AddToPlaylistButton",
        );

        expect(
          editorialPlaylistDetail,
        ).toContain(
          "Save track",
        );

        expect(
          editorialPlaylistDetail,
        ).toContain(
          "AddToPlaylistButton",
        );

        expect(
          addButton,
        ).toContain(
          "Add to Playlist",
        );

        expect(
          addButton,
        ).toContain(
          "trackTitle: string",
        );

        expect(
          addButton,
        ).toContain(
          "Choose a Playlist",
        );

        expect(
          addButton,
        ).toContain(
          'Save "${trackLabel}" to "${playlist.title}"',
        );

        expect(
          addButton,
        ).toContain(
          "Create new Playlist",
        );

        expect(
          addButton,
        ).toContain(
          "Create and add",
        );

        expect(
          addButton,
        ).toContain(
          "createPersonalPlaylist",
        );

        expect(
          addButton,
        ).not.toContain(
          "/playlists?create=1",
        );

        expect(
          addButton,
        ).not.toContain(
          "Save this Track inside one of your Playlists.",
        );

        expect(
          addButton,
        ).not.toContain(
          "Added to ${playlist.title}",
        );

        expect(
          trackDetail,
        ).toContain(
          "trackTitle={track.title}",
        );

        expect(
          editorialPlaylistDetail,
        ).toContain(
          "trackTitle={",
        );

        expect(
          personDetail,
        ).toContain(
          "trackTitle={",
        );

        expect(
          addButton,
        ).not.toContain(
          "setSaved",
        );
      },
    );

    it(
      "links desktop, mobile, and public profile Playlist ownership through /u/:username",
      () => {
        expect(
          profileDesktop,
        ).toContain(
          "/playlists",
        );

        expect(
          profileMobile,
        ).toContain(
          "/playlists",
        );

        expect(
          publicProfile,
        ).toContain(
          "PublicPersonalPlaylistsSection",
        );

        expect(
          publicSection,
        ).toContain(
          "/u/${username}/playlists/${playlist.slug}",
        );

        expect(
          publicSection,
        ).toContain(
          "/u/${username}/playlists",
        );
      },
    );

    it(
      "plays through the canonical Player and preserves editorial discovery",
      () => {
        expect(
          personDetail,
        ).toContain(
          "usePlayer",
        );

        expect(
          personDetail,
        ).toContain(
          "player.playTrack",
        );

        expect(
          personDetail,
        ).toContain(
          '"personal_playlist"',
        );

        expect(
          personDetail,
        ).not.toContain(
          "<audio",
        );

        expect(
          playlistsIndex,
        ).toContain(
          "listPublicPlaylists",
        );

        expect(
          playlistsIndex,
        ).toContain(
          "WAKILISHA",
        );

        expect(
          playlistsIndex,
        ).toContain(
          "Playlists",
        );
      },
    );
  },
);
