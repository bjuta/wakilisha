import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MLINZI_ACTOR,
  assessTrackSlug,
  classifyOneTrackReleaseArtistParity,
  shouldEscalateMlinziFinding,
  slugifyCulturalRouteValue,
  stripProvenStructuralCreditNoise,
} from "../../src/services/registry/steward/mlinzi";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

const runner = read(
  "scripts/registry/mlinzi-registry-steward.ts",
);
const packageJson = read("package.json");
const criticalControlPlane = read(
  ".github/workflows/critical-control-plane.yml",
);

describe("Mlinzi Registry Steward", () => {
  it("has a stable system actor identity", () => {
    expect(MLINZI_ACTOR).toBe("mlinzi");
  });

  it("transliterates diacritics without adding artist noise", () => {
    expect(
      slugifyCulturalRouteValue("Ambéka Semè"),
    ).toBe("ambeka-seme");

    expect(
      slugifyCulturalRouteValue("Constant Pressure (RÜI)"),
    ).toBe("constant-pressure-rui");
  });

  it("removes featured Artist text only when canonical credits prove it", () => {
    const result = stripProvenStructuralCreditNoise(
      "Baddies Need Love (feat. Ywaya Tajiri & Watendawili)",
      [
        {
          artistSlug: "maandy",
          displayName: "Maandy",
          isPrimary: true,
        },
        {
          artistSlug: "ywaya-tajiri",
          displayName: "Ywaya Tajiri",
          isPrimary: false,
          isFeatured: true,
        },
        {
          artistSlug: "watendawili",
          displayName: "Watendawili",
          isPrimary: false,
          isFeatured: true,
        },
      ],
    );

    expect(result.cleanedTitle).toBe(
      "Baddies Need Love",
    );
    expect(result.removedCreditClauses).toEqual([
      "(feat. Ywaya Tajiri & Watendawili)",
    ]);
  });

  it("keeps a credit-like title phrase when the Registry cannot prove the structure", () => {
    const result = stripProvenStructuralCreditNoise(
      "Featuring You",
      [
        {
          artistSlug: "artist-a",
          displayName: "Artist A",
          isPrimary: true,
        },
      ],
    );

    expect(result.cleanedTitle).toBe("Featuring You");
    expect(result.removedCreditClauses).toEqual([]);
  });

  it("preserves culturally meaningful version information while removing structural credits", () => {
    const assessment = assessTrackSlug({
      trackId: "track-1",
      title:
        "Jipe Shughuli Nani (feat. BenaiA & Fushi The Sage) [Remix]",
      currentSlug:
        "kanzu--jipe-shughuli-nani-feat-benaia-fushi-the-sage-remix",
      credits: [
        {
          artistSlug: "kanzu",
          displayName: "Kanzu",
          isPrimary: true,
        },
        {
          artistSlug: "benaia",
          displayName: "BenaiA",
          isPrimary: false,
          isFeatured: true,
        },
        {
          artistSlug: "fushi-the-sage",
          displayName: "Fushi The Sage",
          isPrimary: false,
          isFeatured: true,
        },
      ],
    });

    expect(assessment.disposition).toBe(
      "auto_repair",
    );
    expect(assessment.candidateSlug).toBe(
      "jipe-shughuli-nani-remix",
    );
    expect(assessment.cleanedTitle).toBe(
      "Jipe Shughuli Nani [Remix]",
    );
  });

  it("removes a legacy Artist prefix because the Artist already belongs in the route scope", () => {
    const assessment = assessTrackSlug({
      trackId: "track-2",
      title: "Beg For It",
      currentSlug: "njerae--beg-for-it",
      credits: [
        {
          artistSlug: "njerae",
          displayName: "Njerae",
          isPrimary: true,
        },
      ],
    });

    expect(assessment.disposition).toBe(
      "auto_repair",
    );
    expect(assessment.rule).toBe(
      "track_slug_legacy_artist_prefix",
    );
    expect(assessment.candidateSlug).toBe(
      "beg-for-it",
    );
  });

  it("does not auto-repair unexplained slug differences", () => {
    const assessment = assessTrackSlug({
      trackId: "track-3",
      title: "Colors",
      currentSlug: "colors-1672b8",
      credits: [
        {
          artistSlug: "artist-a",
          displayName: "Artist A",
          isPrimary: true,
        },
      ],
    });

    expect(assessment.disposition).toBe("defer");
    expect(assessment.rule).toBe(
      "track_slug_ambiguous_difference",
    );
  });

  it("defers collisions instead of flooding manual review", () => {
    const assessment = assessTrackSlug({
      trackId: "track-4",
      title: "Summer (feat. Bensoul)",
      currentSlug: "kethan--summer-feat-bensoul",
      routeCollisionCount: 1,
      retryCount: 0,
      publicBreakage: false,
      credits: [
        {
          artistSlug: "kethan",
          displayName: "Kethan",
          isPrimary: true,
        },
        {
          artistSlug: "bensoul",
          displayName: "Bensoul",
          isPrimary: false,
          isFeatured: true,
        },
      ],
    });

    expect(assessment.disposition).toBe("defer");
    expect(assessment.rule).toBe(
      "track_slug_collision",
    );
  });

  it("escalates only persistent material conflicts", () => {
    expect(
      shouldEscalateMlinziFinding({
        retryCount: 2,
        publicBreakage: true,
        conflictKind: "identity_collision",
      }),
    ).toBe(false);

    expect(
      shouldEscalateMlinziFinding({
        retryCount: 3,
        publicBreakage: true,
        conflictKind: "identity_collision",
      }),
    ).toBe(true);

    expect(
      shouldEscalateMlinziFinding({
        retryCount: 10,
        publicBreakage: false,
        conflictKind: "provider_disagreement",
      }),
    ).toBe(false);
  });

  it("auto-repairs Artist parity only for one-track Releases", () => {
    expect(
      classifyOneTrackReleaseArtistParity({
        activeTrackCount: 1,
        missingArtistLinkCount: 2,
      }),
    ).toBe("auto_repair");

    expect(
      classifyOneTrackReleaseArtistParity({
        activeTrackCount: 8,
        missingArtistLinkCount: 1,
      }),
    ).toBe("defer");
  });

  it("defaults the runtime runner to audit-only and records every applied mutation", () => {
    expect(runner).toContain(
      'let apply = false;',
    );
    expect(runner).toContain(
      "Manual review is not created by this runner.",
    );
    expect(runner).toContain(
      "registry_canonical_write_events",
    );
    expect(runner).toContain(
      "wk_slug_redirects",
    );
    expect(runner).toContain(
      "pg_try_advisory_lock",
    );
    expect(runner).toContain(
      "'mlinzi_structural_parity'",
    );
  });

  it("keeps Mlinzi reachable as an explicit audit and apply command", () => {
    expect(packageJson).toContain(
      '"registry:mlinzi:audit"',
    );
    expect(packageJson).toContain(
      '"registry:mlinzi:apply"',
    );
  });

  it("protects the Mlinzi contract in the Critical Control Plane", () => {
    expect(criticalControlPlane).toContain(
      "Mlinzi Registry Steward",
    );
    expect(criticalControlPlane).toContain(
      "test/registry/mlinzi-registry-steward.test.ts",
    );
  });

  it("keeps Mlinzi runtime and policy copy free of forbidden dash punctuation", () => {
    for (const source of [
      runner,
      read("src/services/registry/steward/mlinzi.ts"),
    ]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain(" -- ");
    }
  });
});
