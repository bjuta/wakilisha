import {
  describe,
  expect,
  it,
} from "vitest";
import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

function read(
  relativePath: string,
): string {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

describe(
  "Registry-led onboarding",
  () => {
    const page = read(
      "src/pages/start/page.tsx",
    );
    const artistPage = read(
      "src/pages/artists/detail/page.tsx",
    );
    const gate = read(
      "src/components/auth/RegistryOnboardingGate.tsx",
    );
    const service = read(
      "src/services/community/registryOnboarding.ts",
    );
    const router = read(
      "src/router/config.tsx",
    );
    const responsiveLayout = read(
      "src/components/mobile/ResponsiveAppLayout.tsx",
    );
    const admin = read(
      "src/pages/admin/settings/onboarding/page.tsx",
    );
    const settings = read(
      "src/pages/settings/page.tsx",
    );
    const mobileSettings = read(
      "src/pages/mobile/settings/page.tsx",
    );
    const search = read(
      "src/hooks/useArtistSearchData.ts",
    );

    it(
      "makes onboarding its own full-screen route outside normal app chrome",
      () => {
        expect(router).toContain(
          '{ path: "/start", element: <RegistryOnboardingPage /> }',
        );
        expect(responsiveLayout).toContain(
          "<RegistryOnboardingGate>",
        );
        expect(gate).toContain(
          'to="/start"',
        );
      },
    );

    it(
      "leads with the WAKILISHA promise instead of generic personalization language",
      () => {
        expect(page).toContain(
          "Your people are here.",
        );
        expect(page).toContain(
          'placeholder="Find your people"',
        );
        expect(page).toContain(
          "Enter WAKILISHA",
        );
        expect(page).not.toContain(
          "Personalize your experience",
        );
        expect(page).not.toContain(
          ">ARTIST<",
        );
      },
    );

    it(
      "uses uncapped structural Registry proximity plus reviewed cultural relationships",
      () => {
        expect(service).toContain(
          "get_public_artist_structural_proximity",
        );
        expect(service).toContain(
          "getRegistryArtistStructuralProximity",
        );
        expect(page).toContain(
          "getRegistryArtistStructuralProximity(",
        );
        expect(page).toContain(
          "getPublicArtistRelationships",
        );
        expect(page).not.toContain(
          "getArtist(",
        );
      },
    );

    it(
      "uses canonical structural Artist ids directly for Followable neighborhood candidates",
      () => {
        expect(page).toContain(
          "relationship.relatedArtistId",
        );
        expect(page).toContain(
          "relationship.relatedArtistSlug",
        );
        expect(page).toContain(
          "relationship.proximityScore",
        );
        expect(page).not.toContain(
          '"registry_artists"',
        );
      },
    );

    it(
      "does not truncate the merged Artist neighborhood",
      () => {
        expect(page).not.toContain(
          ".slice(0, 7)",
        );
        expect(page).not.toContain(
          "activeRelated.slice",
        );
        expect(page).not.toContain(
          "relationshipFieldArtists.slice",
        );
        const structuralClient =
          service.slice(
            service.indexOf(
              "export async function getRegistryArtistStructuralProximity",
            ),
            service.indexOf(
              "function decodeAdminArtist",
            ),
          );
        expect(structuralClient).not.toContain(
          "p_limit",
        );
        expect(page).not.toContain(
          "artistDetail?.relatedArtists",
        );
      },
    );

    it(
      "keeps followed Artists visible in a persistent Your People strip outside the active field",
      () => {
        expect(page).toContain(
          "const yourPeople =",
        );
        expect(page).toContain(
          "Your People",
        );
        expect(page).toContain(
          "yourPeople.map",
        );
        expect(page).toContain(
          "void activateAnchor",
        );
        expect(page).toContain(
          "void unfollowArtist",
        );
        expect(page).toContain(
          "overflow-x-auto",
        );
        expect(page).toContain(
          'className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1"',
        );
        expect(page).toContain(
          "const visibleArtists =",
        );
        expect(page).toContain(
          ": opening;",
        );
      },
    );

    it(
      "uses one active anchor and replaces its neighborhood on every exploration choice",
      () => {
        expect(page).toContain(
          "const [activeAnchor, setActiveAnchor]",
        );
        expect(page).toContain(
          "const [activeRelated, setActiveRelated]",
        );
        expect(page).toContain(
          "setActiveRelated(\n          []",
        );
        expect(page).toContain(
          "relationshipRequestId",
        );
        expect(page).not.toContain(
          "relatedByAnchor",
        );
      },
    );

    it(
      "never traps someone inside an Artist neighborhood",
      () => {
        expect(page).toContain(
          "Back to your starting people",
        );
        expect(page).toContain(
          "clearActiveAnchor",
        );
        expect(page).toContain(
          "No other Artists are connected here yet.",
        );
      },
    );

    it(
      "lets the active portrait be unselected while preserving separate exploration and Follow controls",
      () => {
        expect(page).toContain(
          "activeAnchor.id\n                          === artist.id",
        );
        expect(page).toContain(
          "void unfollowArtist",
        );
        expect(page).toContain(
          "onUnfollow",
        );
      },
    );

    it(
      "writes Follow state through the canonical writer",
      () => {
        expect(page).toContain(
          "setFollowState({",
        );
        expect(page).toContain(
          'targetType:\n                "artist"',
        );
        expect(page).toContain(
          "getUserFollowing",
        );
      },
    );

    it(
      "uses dedicated onboarding RPCs only for opening configuration and completion state",
      () => {
        expect(service).toContain(
          "community_get_registry_onboarding_artists",
        );
        expect(service).toContain(
          "community_get_registry_onboarding_state",
        );
        expect(service).toContain(
          "community_set_registry_onboarding_state",
        );
        expect(service).not.toContain(
          "community_follows",
        );
      },
    );

    it(
      "keeps Back for Settings but sends Done into Following",
      () => {
        expect(page).toContain(
          "Skip for now",
        );
        expect(page).toContain(
          "Back to Settings",
        );
        expect(page).toContain(
          '"skipped"',
        );
        expect(page).toContain(
          '"completed"',
        );
        expect(page).toContain(
          'navigate(\n          "/following",',
        );
        expect(page).toContain(
          'if (isEditing) {\n        navigate(\n          "/settings",',
        );
        expect(page).not.toContain(
          'isEditing\n            ? "/settings"\n            : "/following"',
        );
      },
    );

    it(
      "lets administrators own the opening field and fallback behavior",
      () => {
        expect(admin).toContain(
          "getAdminRegistryOnboardingConfig",
        );
        expect(admin).toContain(
          "setAdminRegistryOnboardingConfig",
        );
        expect(admin).toContain(
          "Fill open spaces",
        );
        expect(admin).toContain(
          "OPENING_LIMIT = 16",
        );
      },
    );

    it(
      "keeps search compact while allowing searched Artists to become the active anchor",
      () => {
        expect(page).toContain(
          "max-h-[300px]",
        );
        expect(page).toContain(
          "md:w-[460px]",
        );
        expect(page).toContain(
          "void chooseArtist",
        );
      },
    );

    it(
      "keeps Your People editable from desktop and mobile settings",
      () => {
        expect(settings).toContain(
          'to="/start?edit=1"',
        );
        expect(mobileSettings).toContain(
          'to="/start?edit=1"',
        );
      },
    );

    it(
      "adds Registry Artist ids to search without replacing existing search context",
      () => {
        expect(search).toContain(
          "id: string;",
        );
        expect(search).toContain(
          '.select("id, slug, display_name, public_image_url, metadata")',
        );
        expect(search).toContain(
          "contextText",
        );
      },
    );
  },
);
