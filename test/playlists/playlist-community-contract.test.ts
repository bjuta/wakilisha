import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const types =
  readFileSync(
    "src/services/community/types.ts",
    "utf8",
  );

const service =
  readFileSync(
    "src/services/community/service.ts",
    "utf8",
  );

const drawer =
  readFileSync(
    "src/components/feature/community/ContextAnchorCommentDrawer.tsx",
    "utf8",
  );

const detail =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

const migrationPath =
  readFileSync(
    "docs/engineering/live-schema-baseline.json",
    "utf8",
  );

const migration =
  readFileSync(
    process.env.WK_PLAYLIST_COMMUNITY_MIGRATION ??
      "",
    "utf8",
  );

describe(
  "Phase 5B Playlist community and editorial UX",
  () => {
    it(
      "recognizes Playlist as a shared community entity",
      () => {
        expect(types)
          .toContain(
            "| 'playlist'",
          );

        expect(detail)
          .toContain(
            'type:\n      "playlist" as const',
          );

        expect(detail)
          .toContain(
            "playlist.resourceId",
          );

        expect(detail)
          .toContain(
            "<CommunitySection",
          );
      },
    );

    it(
      "anchors track discussion to Playlist item resource identity",
      () => {
        expect(types)
          .toContain(
            "'playlist_track'",
          );

        expect(service)
          .toContain(
            "'playlist_track'",
          );

        expect(drawer)
          .toContain(
            '"playlist_track"',
          );

        expect(detail)
          .toContain(
            'anchorType:\n          "playlist_track"',
          );

        expect(detail)
          .toContain(
            "track.playlistItemResourceId",
          );

        expect(detail)
          .toContain(
            'contextEntityType:\n          "playlist_item"',
          );
      },
    );

    it(
      "treats each Playlist row as a collapsible editorial unit",
      () => {
        expect(detail)
          .toContain(
            "expandedTrackId",
          );

        expect(detail)
          .toContain(
            "gridTemplateRows",
          );

        expect(detail)
          .toContain(
            "track.notes",
          );

        expect(detail)
          .toContain(
            "Discuss this track",
          );

        expect(detail)
          .not.toContain(
            "Editor's note",
          );

        expect(detail)
          .not.toContain(
            "More about this track",
          );
      },
    );

    it(
      "supports direct navigation through long Playlists",
      () => {
        expect(detail)
          .toContain(
            "trackAnchorId",
          );

        expect(detail)
          .toContain(
            "scrollIntoView",
          );

        expect(detail)
          .toContain(
            "Jump to",
          );

        expect(detail)
          .toContain(
            "AnchorNavigator",
          );

        expect(detail)
          .toContain(
            'label="Jump to track"',
          );

        expect(detail)
          .not.toContain(
            "<select",
          );

        expect(detail)
          .toContain(
            "window.location.hash",
          );
      },
    );

    it(
      "keeps the full Playlist description out of the primary hero",
      () => {
        expect(detail)
          .toContain(
            "playlistSummary(",
          );

        expect(detail)
          .toContain(
            "About this Playlist",
          );

        expect(detail)
          .toContain(
            "<details",
          );
      },
    );

    it(
      "adds Playlist track anchors without creating a second community system",
      () => {
        expect(migration)
          .toContain(
            "'playlist_track'",
          );

        expect(migration)
          .toContain(
            "community_comments_anchor_type_check",
          );

        expect(migration)
          .toContain(
            "community_create_context_anchor_comment",
          );

        expect(migration)
          .toContain(
            "community_get_context_anchor_summary",
          );

        expect(migration)
          .not.toContain(
            "create table",
          );

        expect(migration)
          .toContain(
            "alter function public.community_get_thread_by_entity",
          );

        expect(migration)
          .toContain(
            "set search_path = public",
          );

        expect(migration)
          .toContain(
            "revoke all on function public.community_get_thread_by_entity",
          );

        expect(migration)
          .toContain(
            "revoke all on function public.community_get_context_anchor_comments",
          );

        expect(migration)
          .toContain(
            "revoke all on function public.community_get_thread_comments",
          );

        expect(migration)
          .toContain(
            "to anon, authenticated",
          );
      },
    );

    it(
      "keeps the production schema baseline at or beyond M220",
      () => {
        const baseline = JSON.parse(
          readFileSync(
            "docs/engineering/live-schema-baseline.json",
            "utf8",
          ),
        ) as {
          migrationCount?: number;
        };

        expect(
          baseline.migrationCount,
        ).toBeTypeOf(
          "number",
        );

        expect(
          baseline.migrationCount ?? 0,
        ).toBeGreaterThanOrEqual(
          220,
        );
      },
    );
  },
);
