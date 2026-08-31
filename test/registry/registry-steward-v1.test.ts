import {
  describe,
  expect,
  it,
} from "vitest";

import {
  canonicalizeIncomingTrackIdentity,
  proposeTrackStewardRepair,
  slugifyRegistryIdentity,
  stripStructuralFeaturedCredits,
} from "../../supabase/functions/_shared/registry-steward";

describe("Registry Steward V1 identity rules", () => {
  it("removes a proven structural featured-credit clause from Track identity", () => {
    const identity = canonicalizeIncomingTrackIdentity(
      "Chai Ya Saa Kumi (feat. Artist SWS)",
    );

    expect(identity).toEqual({
      title: "Chai Ya Saa Kumi",
      normalizedTitle: "chai ya saa kumi",
      slug: "chai-ya-saa-kumi",
      sourceTitle: "Chai Ya Saa Kumi (feat. Artist SWS)",
      structuralFeaturedNames: ["Artist SWS"],
      structuralCreditRemoved: true,
    });
  });

  it("preserves cultural version meaning that is not a featured-credit clause", () => {
    const identity = canonicalizeIncomingTrackIdentity(
      "Pressure (Acoustic Version)",
    );

    expect(identity.title).toBe(
      "Pressure (Acoustic Version)",
    );
    expect(identity.slug).toBe(
      "pressure-acoustic-version",
    );
    expect(identity.structuralFeaturedNames).toEqual([]);
    expect(identity.structuralCreditRemoved).toBe(false);
  });

  it("supports bracket and trailing featured-credit grammar without flattening the Track title", () => {
    expect(
      stripStructuralFeaturedCredits(
        "Mtaa [ft. Amani & Kito]",
      ),
    ).toEqual({
      title: "Mtaa",
      featuredNames: ["Amani", "Kito"],
      changed: true,
    });

    expect(
      stripStructuralFeaturedCredits(
        "Mtaa - featuring Amani",
      ),
    ).toEqual({
      title: "Mtaa",
      featuredNames: ["Amani"],
      changed: true,
    });
  });

  it("auto-applies a structural credit repair only when canonical featured credits prove the relationship", () => {
    const proposal = proposeTrackStewardRepair({
      title: "Chai Ya Saa Kumi (feat. Artist SWS)",
      slug: "chai-ya-saa-kumi-ft-artist-sws",
      featuredCredits: [
        {
          name: "Artist SWS",
          slug: "artist-sws",
        },
      ],
    });

    expect(proposal.decision).toBe("auto_apply");
    expect(proposal.ruleKey).toBe(
      "track.structural_credit_clause.v1",
    );
    expect(proposal.proposedTitle).toBe(
      "Chai Ya Saa Kumi",
    );
    expect(proposal.proposedSlug).toBe(
      "chai-ya-saa-kumi",
    );
    expect(
      proposal.evidence.featuredCreditCoverage,
    ).toBe(true);
  });

  it("defers instead of manufacturing credit meaning when the structured credit is missing", () => {
    const proposal = proposeTrackStewardRepair({
      title: "Chai Ya Saa Kumi (feat. Artist SWS)",
      slug: "chai-ya-saa-kumi-ft-artist-sws",
      featuredCredits: [],
    });

    expect(proposal.decision).toBe("defer");
    expect(proposal.ruleKey).toBe(
      "track.structural_credit_unproven.v1",
    );
    expect(proposal.proposedTitle).toBe(
      "Chai Ya Saa Kumi (feat. Artist SWS)",
    );
    expect(proposal.proposedSlug).toBe(
      "chai-ya-saa-kumi-ft-artist-sws",
    );
  });

  it("repairs Artist-prefixed or otherwise noisy Track slugs from canonical title identity", () => {
    const proposal = proposeTrackStewardRepair({
      title: "Legendary",
      slug: "artist-one--legendary",
      featuredCredits: [],
    });

    expect(proposal.decision).toBe("auto_apply");
    expect(proposal.ruleKey).toBe(
      "track.slug_matches_title.v1",
    );
    expect(proposal.proposedTitle).toBe("Legendary");
    expect(proposal.proposedSlug).toBe("legendary");
  });

  it("normalizes Unicode predictably without introducing Artist scope into the slug", () => {
    expect(
      slugifyRegistryIdentity("Élan / Nairobi"),
    ).toBe("elan-nairobi");
  });

  it("is a no-op when Track presentation already matches canonical identity", () => {
    const proposal = proposeTrackStewardRepair({
      title: "Legendary",
      slug: "legendary",
      featuredCredits: [],
    });

    expect(proposal.decision).toBe("noop");
    expect(proposal.ruleKey).toBe(
      "track.identity_clean.v1",
    );
  });
});
