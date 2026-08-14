import { readFileSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root =
  process.cwd();

function read(
  relativePath: string,
) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

const migration =
  read(
    "supabase/migrations/20260814203000_artist_launch_tools_analytics.sql",
  );

const verifier =
  read(
    "scripts/control-plane/verify-artist-launch-tools-analytics.sql",
  );

const service =
  read(
    "src/services/artists/artistLaunchTools.ts",
  );

const managePage =
  read(
    "src/pages/artists/manage/page.tsx",
  );

const pageTracking =
  read(
    "src/hooks/usePageViewTracking.ts",
  );

const packageJson =
  read("package.json");

describe(
  "Artist launch tools + analytics",
  () => {
    it(
      "reuses the existing analytics ledger instead of creating a second event store",
      () => {
        expect(
          migration,
        ).toContain(
          "public.analytics_events",
        );

        expect(
          migration,
        ).not.toContain(
          "create table public.artist_analytics",
        );

        expect(
          migration,
        ).not.toContain(
          "create table public.artist_launch_campaigns",
        );
      },
    );

    it(
      "keeps Artist analytics private to an active representative",
      () => {
        expect(
          migration,
        ).toContain(
          "editorial.current_artist_representation",
        );

        expect(
          migration,
        ).toContain(
          "insufficient_artist_analytics_privilege",
        );

        expect(
          migration,
        ).toContain(
          "revoke all",
        );

        expect(
          migration,
        ).toContain(
          "to authenticated",
        );
      },
    );

    it(
      "returns aggregate performance without exposing raw visitor identity",
      () => {
        for (
          const metric
          of [
            "views",
            "plays",
            "shares",
            "visitors",
            "followers",
          ]
        ) {
          expect(
            migration,
          ).toContain(
            `'${metric}'`,
          );
        }

        expect(
          verifier,
        ).toContain(
          "'raw_visitor_identity_exposed'",
        );

        expect(
          verifier,
        ).toContain(
          "false",
        );
      },
    );

    it(
      "derives launch targets from canonical Artist, Registry music, and published Update authority",
      () => {
        expect(
          migration,
        ).toContain(
          "registry_release_artists",
        );

        expect(
          migration,
        ).toContain(
          "registry_track_artists",
        );

        expect(
          migration,
        ).toContain(
          "artist_updates",
        );

        expect(
          migration,
        ).toContain(
          "'/artists/'",
        );

        expect(
          migration,
        ).toContain(
          "'/releases/'",
        );

        expect(
          migration,
        ).toContain(
          "'/tracks/'",
        );
      },
    );

    it(
      "uses canonical page URLs for plays instead of ambiguous Track slugs",
      () => {
        expect(
          migration,
        ).toContain(
          "target.page_url = event.page_url",
        );

        expect(
          migration,
        ).not.toContain(
          "event.entity_slug = target.target_slug",
        );
      },
    );

    it(
      "builds launch links with the existing WAKILISHA UTM contract",
      () => {
        expect(
          service,
        ).toContain(
          "buildUtmUrl",
        );

        expect(
          service,
        ).toContain(
          '"artist_launch"',
        );

        expect(
          migration,
        ).toContain(
          "{attribution,current,utm_campaign}",
        );
      },
    );

    it(
      "classifies Artist Update page views as Artist Update events",
      () => {
        expect(
          pageTracking,
        ).toContain(
          'segments[2] === "updates"',
        );

        expect(
          pageTracking,
        ).toContain(
          'pageType: "artist_update"',
        );

        expect(
          pageTracking,
        ).toContain(
          'entityType: "artist_update"',
        );
      },
    );

    it(
      "puts Launch Tools and Performance inside the existing Artist Management surface",
      () => {
        expect(
          managePage,
        ).toContain(
          'id="artist-launch-tools"',
        );

        expect(
          managePage,
        ).toContain(
          "Launch Links",
        );

        expect(
          managePage,
        ).toContain(
          "Performance",
        );

        expect(
          managePage,
        ).toContain(
          "Copy Launch Link",
        );

        expect(
          managePage,
        ).toContain(
          "Launch Campaigns",
        );

        expect(
          managePage,
        ).not.toContain(
          ">Dashboard<",
        );
      },
    );

    it(
      "keeps M6 in the critical suite and public M6 copy free of em dashes",
      () => {
        expect(
          packageJson,
        ).toContain(
          "test/artists/artist-launch-tools-analytics.test.ts",
        );

        for (
          const source
          of [
            managePage,
            service,
          ]
        ) {
          expect(
            source,
          ).not.toContain(
            "—",
          );
        }
      },
    );
  },
);

describe("M6 public launch route integrity", () => {
  it("uses public Track routes and keeps launch lists complete", () => {
    const migration = readFileSync(
      "supabase/migrations/20260814203000_artist_launch_tools_analytics.sql",
      "utf8",
    );

    expect(migration).toContain(
      "public.registry_release_tracks",
    );
    expect(migration).toContain(
      "public_track_slug",
    );
    expect(migration).toContain(
      "'/releases/'",
    );
    expect(migration).toContain(
      "regexp_replace",
    );
    expect(migration).not.toContain(
      "limit 201",
    );
    expect(migration).not.toContain(
      "limit 20",
    );
    expect(migration).toContain(
      "limit 12",
    );
  });
});
