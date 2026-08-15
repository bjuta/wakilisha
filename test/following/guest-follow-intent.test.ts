import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260815060000_guest_follow_intent_authority.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-guest-follow-intent-authority.sql",
  "utf8",
);
const picker = readFileSync(
  "src/components/feature/community/GuestFollowingPicker.tsx",
  "utf8",
);
const guestService = readFileSync(
  "src/services/community/guestFollowIntent.ts",
  "utf8",
);
const following = readFileSync(
  "src/pages/following/page.tsx",
  "utf8",
);
const gate = readFileSync(
  "src/components/auth/RegistryOnboardingGate.tsx",
  "utf8",
);
const start = readFileSync(
  "src/pages/start/page.tsx",
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(
    "package.json",
    "utf8",
  ),
) as {
  scripts?: Record<string, string>;
};

describe(
  "guest Following signup handoff",
  () => {
    it(
      "keeps the durable intent private and bounded",
      () => {
        expect(migration).toContain(
          "create table private.guest_follow_intents",
        );
        expect(migration).toContain(
          "cardinality(artist_ids) between 1 and 24",
        );
        expect(migration).toContain(
          "interval '7 days'",
        );
        expect(migration).toContain(
          "'public_bounded_write'",
        );
        expect(verifier).toContain(
          "Guest Follow intent private rows leaked",
        );
      },
    );

    it(
      "allows anonymous creation but authenticated claim only",
      () => {
        expect(migration).toMatch(
          /community_create_guest_follow_intent\([\s\S]*?to\s+anon,\s*authenticated;/,
        );
        expect(migration).toMatch(
          /community_claim_guest_follow_intent\([\s\S]*?to\s+authenticated;/,
        );
        expect(verifier).toContain(
          "'anon',\n          'public.community_claim_guest_follow_intent(text)'",
        );
      },
    );

    it(
      "claims through canonical Follow and onboarding commands",
      () => {
        expect(migration).toContain(
          "perform public.community_set_follow_state(",
        );
        expect(migration).toContain(
          "perform public.community_set_registry_onboarding_state(",
        );
        expect(migration).not.toMatch(
          /insert\s+into\s+public\.community_follows/i,
        );
      },
    );

    it(
      "uses the real Registry opening field, search, and Artist proximity",
      () => {
        expect(picker).toContain(
          "getRegistryOnboardingArtists(16)",
        );
        expect(picker).toContain(
          "useArtistSearchData()",
        );
        expect(picker).toContain(
          "getRegistryArtistStructuralProximity",
        );
        expect(picker).toContain(
          "getPublicArtistRelationships",
        );
        expect(picker).not.toContain(
          "setFollowState(",
        );
      },
    );

    it(
      "keeps unfinished choices locally but Done creates server authority",
      () => {
        expect(guestService).toContain(
          "wk_guest_following_draft_v1",
        );
        expect(picker).toContain(
          "createGuestFollowIntent(",
        );
        expect(picker).toContain(
          "buildGuestFollowSignupUrl",
        );
        expect(guestService).toContain(
          'authUrl.searchParams.set(\n    "mode",\n    "signup"',
        );
        expect(guestService).toContain(
          '"followIntent"',
        );
      },
    );

    it(
      "replaces only the signed-out Following dead end",
      () => {
        expect(following).toContain(
          "<GuestFollowingPicker />",
        );
        expect(following).not.toContain(
          "Following Starts When You Do",
        );
        expect(following).toContain(
          "getFollowingFeed({",
        );
        expect(following).toContain(
          "FollowingReactionAction",
        );
      },
    );

    it(
      "claims the token before loading the new account feed",
      () => {
        expect(following).toContain(
          "claimGuestFollowIntent(",
        );
        expect(following).toContain(
          "clearGuestFollowingDraft();",
        );
        expect(following).toContain(
          "window.history.replaceState(",
        );
      },
    );

    it(
      "bypasses Start only for the transient guest Following handoff",
      () => {
        expect(gate).toContain(
          'location.pathname === "/following"',
        );
        expect(gate).toContain(
          '.has("followIntent")',
        );
        expect(gate).toContain(
          'state.status === "not_started"',
        );
        expect(gate).toContain(
          "&& !hasGuestFollowIntent",
        );
      },
    );

    it(
      "leaves the authenticated Registry onboarding page unchanged in role",
      () => {
        expect(start).toContain(
          "setFollowState({",
        );
        expect(start).toContain(
          'navigate(\n          "/following"',
        );
      },
    );

    it(
      "registers the contract in the critical suite",
      () => {
        expect(
          packageJson.scripts?.[
            "test:critical"
          ],
        ).toContain(
          "test/following/guest-follow-intent.test.ts",
        );
      },
    );
  },
);
