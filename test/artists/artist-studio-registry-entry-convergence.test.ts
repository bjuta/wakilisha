import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

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

function readMigration() {
  const suffix =
    "_artist_studio_registry_entry_convergence.sql";
  const matches =
    fs.readdirSync(
      path.join(
        root,
        "supabase/migrations",
      ),
    )
      .filter((name) =>
        name.endsWith(
          suffix,
        ),
      );

  expect(matches).toHaveLength(
    1,
  );

  return read(
    `supabase/migrations/${matches[0]}`,
  );
}

const shell = read(
  "src/components/music/MusicDesktopShell.tsx",
);
const mobileShell = read(
  "src/components/mobile/MobileAppLayout.tsx",
);
const router = read(
  "src/router/config.tsx",
);
const lazyPublic = read(
  "src/router/lazyPublic.tsx",
);
const page = read(
  "src/pages/artist-studio/page.tsx",
);
const claimSheet = read(
  "src/components/artists/ArtistClaimSheet.tsx",
);
const newArtistSheet = read(
  "src/components/artists/NewArtistClaimSheet.tsx",
);
const claimDraft = read(
  "src/services/artists/artistClaimDraft.ts",
);
const newArtistDraft = read(
  "src/services/artists/newArtistClaimDraft.ts",
);
const service = read(
  "src/services/artists/claimedArtist.ts",
);
const registryService = read(
  "src/services/artists/artistStudioRegistry.ts",
);
const authorityPanel = read(
  "src/pages/artists/detail/components/ArtistAuthorityPanel.tsx",
);
const managePage = read(
  "src/pages/artists/manage/page.tsx",
);
const adminClaimsPage = read(
  "src/pages/admin/community/artist-claims/page.tsx",
);
const routeAudit = read(
  "scripts/performance/audit-public-route-splitting.mjs",
);
const seoEdge = read(
  "supabase/functions/seo-sitemap-admin/index.ts",
);
const prerender = read(
  "scripts/seo/prerender-metadata.mjs",
);
const sitemapBuilder = read(
  "scripts/seo/build-public-sitemap-html.mjs",
);
const verifier = read(
  "scripts/control-plane/verify-artist-studio-registry-entry-convergence.sql",
);
const behavior = read(
  "scripts/control-plane/verify-artist-studio-registry-entry-convergence-behavior.sql",
);

describe(
  "Artist Studio Registry entry convergence",
  () => {
    it(
      "uses the generated WAKILISHA community hero asset rather than an external stock image",
      () => {
        const assetPath =
          path.join(
            root,
            "public/assets/artist-studio/kenyan-creative-community.webp",
          );

        expect(
          fs.existsSync(assetPath),
        ).toBe(true);

        const bytes =
          fs.readFileSync(
            assetPath,
          );
        const digest =
          crypto
            .createHash("sha256")
            .update(bytes)
            .digest("hex");

        expect(digest).toBe(
          "4fbff7acf6d19e264439bac4f805e92d7b417649d5c2f34adc0ded08c714010f",
        );
        expect(page).toContain(
          '"/assets/artist-studio/kenyan-creative-community.webp"',
        );
        expect(page).not.toContain(
          "unsplash",
        );
      },
    );

    it(
      "reuses viewport chrome and makes Artist Studio a first-class public route",
      () => {
        expect(router).toContain(
          'path: "/artist-studio"',
        );
        expect(lazyPublic).toContain(
          "../pages/artist-studio/page",
        );
        expect(shell).toContain(
          'to="/artist-studio"',
        );
        expect(shell).toContain(
          'label="Magazine"',
        );
        expect(shell).not.toContain(
          'label="Posts"',
        );
        expect(shell).not.toContain(
          "studioLauncherOpen",
        );
        expect(
          mobileShell,
        ).toContain(
          '{ label: "Artist Studio", to: "/artist-studio"',
        );

        for (const duplicate of [
          "MobileTopBar",
          "MobileBottomNav",
          "MusicDesktopShell",
        ]) {
          expect(page).not.toContain(
            duplicate,
          );
        }

        expect(
          routeAudit,
        ).toContain(
          'const publicArtistStudioPath = "/artist-studio"',
        );
        expect(
          routeAudit,
        ).toContain(
          "expectedDirectLazyImportCount = 70",
        );
        expect(
          routeAudit,
        ).toContain(
          "expectedRoutePathCount = 176",
        );
      },
    );

    it(
      "keeps discovery public and management bound to current representation authority",
      () => {
        expect(page).toContain(
          "Search the Registry",
        );
        expect(page).toContain(
          "Claim this Artist",
        );
        expect(page).toContain(
          "Manage this Artist",
        );
        expect(page).toContain(
          "Claim under review",
        );
        expect(page).toContain(
          "Accept Invitation",
        );
        expect(page).toContain(
          "No Studio access",
        );
        expect(page).toContain(
          "representedWithoutScope",
        );
        expect(page).toContain(
          "getArtistRepresentationState",
        );
        expect(page).not.toContain(
          "authority.official",
        );

        expect(
          authorityPanel,
        ).toContain(
          "canStartClaim",
        );
        expect(
          authorityPanel,
        ).toContain(
          "!userId ||",
        );
        expect(
          authorityPanel,
        ).toContain(
          "state?.canClaim === true",
        );
        expect(
          authorityPanel,
        ).not.toContain(
          "!authority?.official",
        );

        expect(
          managePage,
        ).toContain(
          "getArtistManagementWorkspace",
        );
        expect(
          managePage,
        ).toContain(
          'artist.status === "active"',
        );
        expect(
          managePage,
        ).not.toContain(
          "getArtistPublicPresentation",
        );
        expect(
          managePage,
        ).not.toContain(
          "getArtist(slug)",
        );
      },
    );

    it(
      "preserves form work through refresh and authentication",
      () => {
        for (const draft of [
          claimDraft,
          newArtistDraft,
        ]) {
          expect(draft).toContain(
            "window.localStorage",
          );
          expect(draft).toContain(
            "updatedAt",
          );
          expect(draft).toContain(
            "saved: boolean",
          );
        }

        expect(
          claimSheet,
        ).toContain(
          "Saved on this device.",
        );
        expect(
          claimSheet,
        ).toContain(
          "Draft saving is unavailable in this browser.",
        );
        expect(
          newArtistSheet,
        ).toContain(
          "Saved on this device.",
        );
        expect(
          newArtistSheet,
        ).toContain(
          "Draft saving is unavailable in this browser.",
        );
        expect(
          claimSheet,
        ).toContain(
          "/auth?returnTo=",
        );
        expect(
          newArtistSheet,
        ).toContain(
          "/auth?returnTo=",
        );
        expect(
          claimSheet,
        ).toContain(
          "clearArtistClaimDraft",
        );
        expect(
          newArtistSheet,
        ).toContain(
          "clearNewArtistClaimDraft",
        );

        expect(page).toContain(
          'searchParams.get("claim")',
        );
        expect(page).toContain(
          'searchParams.get("flow")',
        );
        expect(page).toContain(
          'searchParams.get("new")',
        );
      },
    );

    it(
      "anchors Artist Studio sheets to the viewport instead of the scrolled page",
      () => {
        for (const sheet of [
          claimSheet,
          newArtistSheet,
        ]) {
          expect(sheet).toContain(
            'from "@/components/base/Portal"',
          );
          expect(sheet).toContain(
            "useScrollLock(open)",
          );
          expect(sheet).toContain(
            'className="fixed inset-0',
          );
          expect(sheet).toContain(
            'aria-modal="true"',
          );
          expect(sheet).toContain(
            "overscroll-contain",
          );
        }

        expect(
          claimSheet,
        ).toContain(
          "max-h-[92dvh]",
        );
      },
    );

    it(
      "uses a bounded Registry identity projection instead of exposing draft Artist records",
      () => {
        expect(
          registryService,
        ).toContain(
          '"get_artist_studio_registry_candidates"',
        );
        expect(
          registryService,
        ).toContain(
          "cleanQuery.length < 2",
        );
        expect(
          registryService,
        ).toContain(
          "Math.min(",
        );
        expect(
          registryService,
        ).toContain(
          "needs_review",
        );

        const migration =
          readMigration();

        expect(
          migration,
        ).toContain(
          "get_artist_studio_registry_candidates",
        );
        expect(
          migration,
        ).toContain(
          "mizizi_resolve_artist_identity_candidates",
        );
        expect(
          migration,
        ).toMatch(
          /'active'\s*,\s*'draft'\s*,\s*'needs_review'/,
        );
        expect(
          migration,
        ).not.toMatch(
          /get_artist_studio_registry_candidates[\s\S]*public_image_url[\s\S]*when\s+artist\.status\s*<>\s*'active'/i,
        );
      },
    );

    it(
      "extends Artist Claims rather than creating another review queue",
      () => {
        const migration =
          readMigration();

        expect(
          migration,
        ).toContain(
          "artist_claim_proposed_identities",
        );
        expect(
          migration,
        ).toContain(
          "artist_claim_proposed_identities_accepted_artist_id_idx",
        );
        expect(
          migration,
        ).toContain(
          "else 1.0 end",
        );
        expect(
          migration,
        ).not.toContain(
          "else 100 end",
        );
        expect(
          migration,
        ).toContain(
          "community_submit_new_artist_claim",
        );
        expect(
          migration,
        ).toContain(
          "community_admin_resolve_artist_claim_existing",
        );
        expect(
          migration,
        ).toContain(
          "community_admin_get_artist_claims",
        );
        expect(
          migration,
        ).toContain(
          "community_admin_decide_artist_claim",
        );
        expect(
          migration,
        ).not.toContain(
          "create table public.artist_registration",
        );
        expect(
          migration,
        ).not.toContain(
          "create table public.artist_intake",
        );
        expect(
          migration,
        ).not.toMatch(
          /insert\s+into\s+public\.registry_review_items/i,
        );

        expect(service).toContain(
          '"community_submit_new_artist_claim_v3"',
        );
        expect(service).toContain(
          '"community_admin_resolve_artist_claim_existing"',
        );
        expect(
          adminClaimsPage,
        ).toContain(
          "Approve New Artist",
        );
        expect(
          adminClaimsPage,
        ).toContain(
          "Use This Artist",
        );
      },
    );

    it(
      "keeps Registry creation behind review and fails closed on identity collisions",
      () => {
        const migration =
          readMigration();

        expect(
          migration,
        ).toContain(
          "artist_registry_match_found",
        );
        expect(
          migration,
        ).toContain(
          "artist_identity_resolution_required",
        );
        expect(
          migration,
        ).toContain(
          "wk_slugify_text",
        );
        expect(
          migration,
        ).toContain(
          "artist_slug_invalid",
        );

        const submitStart =
          migration.indexOf(
            "create or replace function public.community_submit_new_artist_claim",
          );
        const submitEnd =
          migration.indexOf(
            "create or replace function public.community_get_artist_representation_state",
            submitStart,
          );
        const submitFunction =
          migration.slice(
            submitStart,
            submitEnd,
          );

        const decideStart =
          migration.indexOf(
            "create or replace function public.community_admin_decide_artist_claim",
          );
        const decideEnd =
          migration.indexOf(
            "create or replace function public.community_admin_resolve_artist_claim_existing",
            decideStart,
          );
        const decideFunction =
          migration.slice(
            decideStart,
            decideEnd,
          );

        expect(
          submitFunction,
        ).not.toMatch(
          /insert\s+into\s+public\.registry_artists/i,
        );
        expect(
          decideFunction,
        ).toMatch(
          /insert\s+into\s+public\.registry_artists/i,
        );
        expect(
          migration,
        ).not.toContain(
          "editorial.resources",
        );
      },
    );

    it(
      "keeps the permanent and rollback behavior verifiers bound to the same authority",
      () => {
        expect(verifier).toContain(
          "ARTIST_STUDIO_REGISTRY_ENTRY_CONVERGENCE_PASS",
        );
        expect(behavior).toContain(
          "ARTIST_STUDIO_REGISTRY_ENTRY_CONVERGENCE_BEHAVIOR_PASS",
        );
        expect(behavior).toContain(
          "rollback",
        );
        expect(behavior).toContain(
          "registry_review_items",
        );
        expect(behavior).toContain(
          "artist_claim_proposed_identities",
        );
      },
    );

    it(
      "treats Artist Studio as a real public acquisition landing page in SEO authority",
      () => {
        expect(seoEdge).toContain(
          '{ loc: makeUrl("/artist-studio"), url_type: "static" }',
        );
        expect(prerender).toContain(
          '"/artist-studio": {',
        );
        expect(prerender).toContain(
          'title: "Artist Studio"',
        );
        expect(sitemapBuilder).toContain(
          '<a href="/artist-studio">Artist Studio</a>',
        );
        expect(sitemapBuilder).toContain(
          '"/artist-studio"',
        );
      },
    );

    it(
      "keeps public-facing Artist Studio copy free of banned punctuation",
      () => {
        for (const surface of [
          page,
          claimSheet,
          newArtistSheet,
          authorityPanel,
        ]) {
          expect(surface).not.toContain(
            "—",
          );
          expect(surface).not.toContain(
            "–",
          );
        }
      },
    );
  },
);
