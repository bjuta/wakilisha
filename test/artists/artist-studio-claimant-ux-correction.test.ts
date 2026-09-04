import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  findClaimantPhoneCountryOptions,
  getCountryFlagEmoji,
} from "../../src/utils/claimantPhone";

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

const studio = read(
  "src/pages/artist-studio/page.tsx",
);
const phone = read(
  "src/components/artists/ClaimantPhoneFields.tsx",
);
const claim = read(
  "src/components/artists/ArtistClaimSheet.tsx",
);
const proposed = read(
  "src/components/artists/NewArtistClaimSheet.tsx",
);
const claimDraft = read(
  "src/services/artists/artistClaimDraft.ts",
);
const proposedDraft = read(
  "src/services/artists/newArtistClaimDraft.ts",
);
const service = read(
  "src/services/artists/claimedArtist.ts",
);
const admin = read(
  "src/pages/admin/community/artist-claims/page.tsx",
);
const migration = read(
  "supabase/migrations/20260904081500_artist_studio_claimant_ux_correction.sql",
);
const verifier = read(
  "scripts/control-plane/verify-artist-studio-claimant-ux-correction.sql",
);

describe(
  "Artist Studio claimant UX correction",
  () => {
    it(
      "starts Registry lookup after two typed characters and renders typeahead results",
      () => {
        expect(studio).toContain(
          "handleArtistSearchInput",
        );
        expect(studio).toContain(
          "clean.length < 2",
        );
        expect(studio).toContain(
          "setSubmittedQuery(clean)",
        );
        expect(studio).toContain(
          ".slice(0, 6)",
        );
        expect(studio).toContain(
          "CandidateCard",
        );
        expect(studio).toContain(
          "No close Registry match",
        );
        expect(studio).toContain(
          "searchCommitted",
        );
        expect(studio).toContain(
          "setSearchCommitted(false)",
        );
        expect(studio).toContain(
          "setSearchCommitted(true)",
        );
        expect(studio).toContain(
          "None of These Are Me",
        );
      },
    );

    it(
      "uses a joined flag and calling-code picker instead of two full-width country fields",
      () => {
        expect(
          getCountryFlagEmoji("KE"),
        ).toBe("🇰🇪");
        expect(
          getCountryFlagEmoji("NG"),
        ).toBe("🇳🇬");

        expect(
          findClaimantPhoneCountryOptions(
            "ke",
          ).map(
            (item) => item.iso2,
          ),
        ).toEqual(["KE"]);

        expect(phone).toContain(
          'aria-haspopup="listbox"',
        );
        expect(phone).toContain(
          'placeholder="Country"',
        );
        expect(phone).toContain(
          "Type a country name or calling code.",
        );
        expect(phone).not.toContain(
          "Search Country",
        );
        expect(phone).not.toContain(
          "Phone Country",
        );
        expect(phone).not.toContain(
          "<select",
        );
      },
    );

    it(
      "collects an unformatted 140-character Other Role on both claim forms",
      () => {
        for (const sheet of [
          claim,
          proposed,
        ]) {
          expect(sheet).toContain(
            "Other Role",
          );
          expect(sheet).toContain(
            "claimantRoleOther",
          );
          expect(sheet).toContain(
            "maxLength={140}",
          );
          expect(sheet).toContain(
            'placeholder="Describe your role"',
          );
        }
      },
    );

    it(
      "removes the misleading proof-link UI from both submission flows",
      () => {
        for (const sheet of [
          claim,
          proposed,
        ]) {
          expect(sheet).not.toContain(
            "Proof Link",
          );
          expect(sheet).not.toContain(
            "proofLink",
          );
          expect(sheet).toContain(
            "evidence: []",
          );
        }
      },
    );

    it(
      "preserves old drafts while advancing claimant role detail to v3",
      () => {
        expect(claimDraft).toContain(
          "ARTIST_CLAIM_DRAFT_VERSION = 3",
        );
        expect(claimDraft).toContain(
          "wk-artist-claim-draft:v2:",
        );
        expect(claimDraft).toContain(
          "wk-artist-claim-draft:v1:",
        );

        expect(proposedDraft).toContain(
          "NEW_ARTIST_CLAIM_DRAFT_VERSION = 3",
        );
        expect(proposedDraft).toContain(
          "wk-new-artist-claim-draft:v2:",
        );
        expect(proposedDraft).toContain(
          "wk-new-artist-claim-draft:v1:",
        );

        for (const draft of [
          claimDraft,
          proposedDraft,
        ]) {
          expect(draft).toContain(
            "claimantRoleOther",
          );
        }
      },
    );

    it(
      "adds role detail without replacing accepted v2 claim authority",
      () => {
        expect(migration).toContain(
          "claimant_role_other",
        );
        expect(migration).toContain(
          "community_submit_artist_claim_v3",
        );
        expect(migration).toContain(
          "community_submit_new_artist_claim_v3",
        );
        expect(migration).toContain(
          "community_admin_get_artist_claims_v3",
        );
        expect(migration).toContain(
          "public.community_submit_artist_claim_v2(",
        );
        expect(migration).toContain(
          "public.community_submit_new_artist_claim_v2(",
        );
        expect(migration).toContain(
          "public.community_admin_get_artist_claims_v2(",
        );

        expect(service).toContain(
          '"community_submit_artist_claim_v3"',
        );
        expect(service).toContain(
          '"community_submit_new_artist_claim_v3"',
        );
        expect(service).toContain(
          '"community_admin_get_artist_claims_v3"',
        );
        expect(service).toContain(
          "claimantRoleOther",
        );
        expect(admin).toContain(
          "claim.claimantRoleOther",
        );
        expect(verifier).toContain(
          "ARTIST_STUDIO_CLAIMANT_UX_CORRECTION_PASS",
        );
      },
    );

    it(
      "keeps new public copy free of banned dash punctuation",
      () => {
        for (const surface of [
          studio,
          phone,
          claim,
          proposed,
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
