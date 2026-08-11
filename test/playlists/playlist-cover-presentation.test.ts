import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

function source(
  relative: string,
): string {
  return fs.readFileSync(
    path.join(
      root,
      relative,
    ),
    "utf8",
  );
}

describe(
  "Phase 5B Playlist cover presentation",
  () => {
    it(
      "keeps the canonical artwork clean and renders title text in code",
      () => {
        const component =
          source(
            "src/components/media/PlaylistCoverPresentation.tsx",
          );

        expect(component)
          .toContain(
            "{title}",
          );

        expect(component)
          .toContain(
            "{subjectLabel}",
          );

        expect(component)
          .toContain(
            'aria-hidden="true"',
          );

        expect(component)
          .toContain(
            'left-[7.5%] top-[7.5%] w-[61%]',
          );

        expect(component)
          .toContain(
            '"clamp(14px, 9.5cqw, 48px)"',
          );

        expect(component)
          .toContain(
            '"clamp(5px, 1.7cqw, 8px)"',
          );

        expect(component)
          .toContain(
            'font-medium italic tracking-[0.01em]',
          );

        expect(component)
          .toContain(
            "opacity:",
          );

        expect(component)
          .toContain(
            "0.62",
          );
      },
    );

    it(
      "uses the governed cover caption as the visible subject label",
      () => {
        const detail =
          source(
            "src/pages/playlists/detail/page.tsx",
          );

        const drawer =
          source(
            "src/pages/admin/content/playlists/detail/components/PlaylistDetailsDrawer.tsx",
          );

        expect(detail)
          .toContain(
            "playlist.cover?.caption",
          );

        expect(drawer)
          .toContain(
            "Subject label",
          );

        expect(drawer)
          .toContain(
            "Lilac-breasted Roller",
          );

        expect(drawer)
          .toContain(
            "This appears below the Playlist title on the cover.",
          );
      },
    );

    it(
      "passes alt text and caption through the existing Playlist cover command",
      () => {
        const service =
          source(
            "src/services/playlists/playlistAdminService.ts",
          );

        expect(service)
          .toContain(
            "PlaylistCoverPresentationInput",
          );

        expect(service)
          .toContain(
            "p_alt_text_snapshot",
          );

        expect(service)
          .toContain(
            "presentation.altText?.trim()",
          );

        expect(service)
          .toContain(
            "p_caption_snapshot",
          );

        expect(service)
          .toContain(
            "presentation.caption?.trim()",
          );
      },
    );

    it(
      "uses one shared presentation component in Admin, Preview, detail, and cards",
      () => {
        const drawer =
          source(
            "src/pages/admin/content/playlists/detail/components/PlaylistDetailsDrawer.tsx",
          );

        const detail =
          source(
            "src/pages/playlists/detail/page.tsx",
          );

        const list =
          source(
            "src/pages/playlists/page.tsx",
          );

        for (
          const page
          of [
            drawer,
            detail,
            list,
          ]
        ) {
          expect(page)
            .toContain(
              "PlaylistCoverPresentation",
            );
        }
      },
    );
    it(
      "requires explicit Media governance before public cover delivery",
      () => {
        const service =
          source(
            "src/services/playlists/playlistAdminService.ts",
          );

        const drawer =
          source(
            "src/pages/admin/content/playlists/detail/components/PlaylistDetailsDrawer.tsx",
          );

        expect(service)
          .toContain(
            "create_media_governance_version",
          );

        expect(service)
          .toContain(
            '"approved_public"',
          );

        expect(service)
          .toContain(
            '"public"',
          );

        expect(service)
          .toContain(
            '"owned"',
          );

        expect(service)
          .toContain(
            '"licensed"',
          );

        expect(service)
          .toContain(
            '"public_domain"',
          );

        expect(service)
          .toContain(
            '"fair_use"',
          );

        expect(drawer)
          .toContain(
            "Approve for public use",
          );

        expect(drawer)
          .toContain(
            "This creates a new immutable Media governance version.",
          );

        expect(drawer)
          .not.toContain(
            "resolve_media_asset_delivery",
          );
      },
    );

  },
);
