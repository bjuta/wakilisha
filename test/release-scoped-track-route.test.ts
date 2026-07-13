import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  releaseTrackUrl,
  trackUrl,
} from "../src/utils/trackUrl";

describe("release-scoped track routes", () => {
  it("builds a clean release-scoped track URL", () => {
    expect(
      releaseTrackUrl(
        "Nyashinski",
        "Lucky You",
        "Legendary",
      ),
    ).toBe(
      "/releases/nyashinski/lucky-you/legendary",
    );
  });

  it("keeps the standalone track route available", () => {
    expect(
      trackUrl("Valle", ["Matata"]),
    ).toBe("/tracks/matata/valle");
  });

  it("wires release pages and the public gateway to release context", () => {
    const router = readFileSync(
      "src/router/config.tsx",
      "utf8",
    );
    const desktopRelease = readFileSync(
      "src/pages/releases/detail/components/ReleaseTracklist.tsx",
      "utf8",
    );
    const mobileRelease = readFileSync(
      "src/pages/mobile/releases/detail/page.tsx",
      "utf8",
    );
    const trackPage = readFileSync(
      "src/pages/tracks/detail/page.tsx",
      "utf8",
    );
    const publicClient = readFileSync(
      "src/services/publicApi/client.ts",
      "utf8",
    );
    const publicGateway = readFileSync(
      "supabase/functions/public-content-read/index.ts",
      "utf8",
    );

    expect(router).toContain(
      "/releases/:artistSlug/:releaseSlug/:trackSlug",
    );
    expect(desktopRelease).toContain(
      "releaseTrackUrl(artistSlug, release.slug, track.slug)",
    );
    expect(mobileRelease).toContain(
      "releaseTrackUrl(artistSlug, releaseSlug, track.slug)",
    );
    expect(trackPage).toContain(
      "getReleaseTrack(artistSlug, releaseSlug, trackSlug)",
    );
    expect(publicClient).toContain(
      "/releases/${encodeURIComponent(artistSlug)}/${encodeURIComponent(releaseSlug)}/${encodeURIComponent(trackSlug)}",
    );
    expect(publicGateway).toContain(
      "ambiguous_release_track_slug",
    );
    expect(publicGateway).toContain(
      "releaseScopedMembership",
    );
    expect(publicGateway).toContain(
      '.select("release_id, track_id, track_number, disc_number")',
    );
  });
});
