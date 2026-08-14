import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260814164000_claimed_artist_experience.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-claimed-artist-experience.sql",
  "utf8",
);
const service = readFileSync(
  "src/services/artists/claimedArtist.ts",
  "utf8",
);
const artistPage = readFileSync(
  "src/pages/artists/detail/page.tsx",
  "utf8",
);
const authorityPanel = readFileSync(
  "src/pages/artists/detail/components/ArtistAuthorityPanel.tsx",
  "utf8",
);
const managePage = readFileSync(
  "src/pages/artists/manage/page.tsx",
  "utf8",
);
const adminClaimsPage = readFileSync(
  "src/pages/admin/community/artist-claims/page.tsx",
  "utf8",
);
const adminCommunityPage = readFileSync(
  "src/pages/admin/community/page.tsx",
  "utf8",
);
const router = readFileSync(
  "src/router/config.tsx",
  "utf8",
);
const lazyPublic = readFileSync(
  "src/router/lazyPublic.tsx",
  "utf8",
);
const lazyAdmin = readFileSync(
  "src/router/lazyAdmin.tsx",
  "utf8",
);
const packageJson = readFileSync("package.json", "utf8");

describe("claimed Artist experience", () => {
  it("keeps claimed presentation separate from canonical Registry Artist writes", () => {
    expect(migration).toContain("create table public.artist_profile_presentations");
    expect(migration).toContain("community_save_artist_profile_presentation");
    expect(migration).toContain("community_submit_artist_registry_correction");
    expect(migration).toContain("community_create_contribution");
    expect(migration).toContain("can_manage_profile");
    expect(migration).not.toMatch(/update\s+public\.registry_artists/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.registry_artists/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.registry_artists/i);
    expect(verifier).toContain("claimed Artist command can write canonical Registry Artist rows");
  });

  it("uses M2 claims, representation, team, and review authority instead of duplicating it", () => {
    expect(service).toContain('"community_get_artist_representation_state"');
    expect(service).toContain('"community_submit_artist_claim"');
    expect(service).toContain('"community_artist_invite_representative"');
    expect(service).toContain('"community_artist_accept_representation"');
    expect(service).toContain('"community_artist_update_representative"');
    expect(service).toContain('"community_artist_revoke_representation"');
    expect(service).toContain('"community_admin_get_artist_claims"');
    expect(service).toContain('"community_admin_decide_artist_claim"');
    expect(migration).toContain("profile_presentation_updated");
    expect(migration).toContain("or not v_actor_rep.can_manage_team");
    expect(migration).toContain("insufficient_artist_team_privilege");
    expect(verifier).toContain("team reader is not bound to team-management permission");
  });

  it("keeps one canonical Artist page and adds a bounded management route", () => {
    expect(router).toContain('path: "/artists/:slug"');
    expect(router).toContain('path: "/artists/:slug/manage"');
    expect(router).toContain("ArtistManagePage");
    expect(lazyPublic).toContain("ArtistManagePage");
    expect(lazyPublic).toContain("../pages/artists/manage/page");
    expect(artistPage).toContain("ArtistAuthorityPanel");
    expect(artistPage).toContain("getArtistPublicPresentation");
    expect(artistPage).toContain("displayProfileImage");
    expect(artistPage).toContain("displayHeroImage");
  });

  it("shows clear public ownership language and claim actions", () => {
    expect(authorityPanel).toContain("Official Artist");
    expect(authorityPanel).toContain("Managed by the Artist or their team.");
    expect(authorityPanel).toContain("WAKILISHA Registry");
    expect(authorityPanel).toContain("Built from WAKILISHA's reviewed music records.");
    expect(authorityPanel).toContain("Claim This Artist");
    expect(authorityPanel).toContain("Claim Under Review");
    expect(authorityPanel).toContain("Manage Artist");
    expect(authorityPanel).toContain("Accept Invitation");
  });

  it("keeps profile presentation, Registry corrections, and team controls visibly separated", () => {
    expect(managePage).toContain("Edit Profile");
    expect(managePage).toContain("Suggest a Registry Correction");
    expect(managePage).toContain("Manage Team");
    expect(managePage).toContain("Add Music");
    expect(managePage).toContain("Post Update");
    expect(managePage).toContain("Registry facts stay under WAKILISHA review.");
    expect(managePage).not.toContain('.from("registry_artists")');
  });

  it("makes claim review reachable in admin without SQL", () => {
    expect(lazyAdmin).toContain("AdminArtistClaimsPage");
    expect(router).toContain('path: "community/artist-claims"');
    expect(adminCommunityPage).toContain("Artist Claims");
    expect(adminClaimsPage).toContain("Verify Claim");
    expect(adminClaimsPage).toContain("Reject Claim");
    expect(adminClaimsPage).toContain("listArtistClaims");
    expect(adminClaimsPage).toContain("decideArtistClaim");
  });

  it("keeps the M3 contract in the critical suite and public copy free of em dashes", () => {
    expect(packageJson).toContain("test/artists/claimed-artist-experience.test.ts");
    for (const surface of [authorityPanel, managePage]) {
      expect(surface).not.toContain("—");
    }
  });
});
