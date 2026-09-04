import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  findClaimantPhoneCountryOptions,
  getClaimantPhoneCountryOptions,
  getCountryFlagEmoji,
  normalizeClaimantPhone,
} from "../../src/utils/claimantPhone";
import {
  getSortedCountryCodes,
} from "../../src/utils/countries";

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

const migration = read(
  "supabase/migrations/20260904055015_artist_studio_claimant_international_phone.sql",
);
const verifier = read(
  "scripts/control-plane/verify-artist-studio-claimant-international-phone.sql",
);
const claimSheet = read(
  "src/components/artists/ArtistClaimSheet.tsx",
);
const newArtistSheet = read(
  "src/components/artists/NewArtistClaimSheet.tsx",
);
const phoneFields = read(
  "src/components/artists/ClaimantPhoneFields.tsx",
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
const admin = read(
  "src/pages/admin/community/artist-claims/page.tsx",
);

describe(
  "Artist Studio claimant international phone",
  () => {
    it(
      "uses country-aware calling code metadata",
      () => {
        const countries =
          getClaimantPhoneCountryOptions();
        const kenya =
          countries.find(
            (country) =>
              country.iso2 === "KE",
          );
        const nigeria =
          countries.find(
            (country) =>
              country.iso2 === "NG",
          );

        expect(countries).toHaveLength(
          getSortedCountryCodes().length,
        );

        expect(kenya).toMatchObject({
          countryName: "Kenya",
          callingCode: "+254",
          label: "Kenya (+254)",
        });
        expect(nigeria).toMatchObject({
          countryName: "Nigeria",
          callingCode: "+234",
          label: "Nigeria (+234)",
        });

        const labels =
          countries.map(
            (country) =>
              country.countryName,
          );
        expect(labels).toEqual(
          [...labels].sort(
            (a, b) =>
              a.localeCompare(b),
          ),
        );
      },
    );

    it(
      "normalizes a local Kenyan number into canonical international storage",
      () => {
        expect(
          normalizeClaimantPhone(
            "KE",
            "0712 345 678",
          ),
        ).toEqual({
          countryIso2: "KE",
          callingCode: "+254",
          nationalNumber:
            "712345678",
          e164:
            "+254712345678",
        });
      },
    );

    it(
      "rejects invalid phone data",
      () => {
        expect(() =>
          normalizeClaimantPhone(
            "",
            "0712345678",
          ),
        ).toThrow(
          "Choose your phone country.",
        );

        expect(() =>
          normalizeClaimantPhone(
            "KE",
            "123",
          ),
        ).toThrow(
          "Enter a valid phone number for the selected country.",
        );
      },
    );

    it(
      "uses a compact searchable country-code picker on both claimant forms",
      () => {
        expect(
          getCountryFlagEmoji("KE"),
        ).toBe("🇰🇪");
        expect(
          findClaimantPhoneCountryOptions(
            "Ken",
          ).map(
            (country) =>
              country.iso2,
          ),
        ).toEqual(["KE"]);

        expect(phoneFields).toContain(
          'aria-haspopup="listbox"',
        );
        expect(phoneFields).toContain(
          'placeholder="Country"',
        );
        expect(phoneFields).toContain(
          "country.flag",
        );
        expect(phoneFields).not.toContain(
          "Search Country",
        );
        expect(phoneFields).not.toContain(
          "Phone Country",
        );
        expect(phoneFields).not.toContain(
          "<select",
        );

        for (const sheet of [
          claimSheet,
          newArtistSheet,
        ]) {
          expect(sheet).toContain(
            "ClaimantPhoneFields",
          );
          expect(sheet).toContain(
            "normalizeClaimantPhone",
          );
          expect(sheet).toContain(
            "phoneCountryIso2",
          );
          expect(sheet).toContain(
            "phoneNumber",
          );
        }
      },
    );

    it(
      "preserves old drafts and carries phone state through authentication",
      () => {
        expect(claimDraft).toContain(
          "ARTIST_CLAIM_DRAFT_VERSION = 3",
        );
        expect(claimDraft).toContain(
          "wk-artist-claim-draft:v1:",
        );
        expect(newArtistDraft).toContain(
          "NEW_ARTIST_CLAIM_DRAFT_VERSION = 3",
        );
        expect(newArtistDraft).toContain(
          "wk-new-artist-claim-draft:v1:",
        );

        for (const draft of [
          claimDraft,
          newArtistDraft,
        ]) {
          expect(draft).toContain(
            "phoneCountryIso2",
          );
          expect(draft).toContain(
            "phoneNumber",
          );
        }
      },
    );

    it(
      "keeps accepted v1 and v2 phone authority while corrected clients advance separately",
      () => {
        expect(migration).toContain(
          "community_submit_artist_claim_v2",
        );
        expect(migration).toContain(
          "community_submit_new_artist_claim_v2",
        );
        expect(migration).toContain(
          "community_admin_get_artist_claims_v2",
        );
        expect(migration).toContain(
          "public.community_submit_artist_claim(",
        );
        expect(migration).toContain(
          "public.community_submit_new_artist_claim(",
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
      },
    );

    it(
      "stores the geographic phone parts and exposes canonical contact to reviewers",
      () => {
        for (const field of [
          "claimant_phone_country_iso2",
          "claimant_phone_calling_code",
          "claimant_phone_national_number",
          "claimant_phone_e164",
        ]) {
          expect(migration).toContain(
            field,
          );
          expect(service).toContain(
            field,
          );
        }

        expect(admin).toContain(
          "claim.claimant.phoneE164",
        );
        expect(admin).toContain(
          "Phone:",
        );
        expect(verifier).toContain(
          "ARTIST_STUDIO_CLAIMANT_INTERNATIONAL_PHONE_PASS",
        );
      },
    );

    it(
      "keeps new public copy free of banned dash punctuation",
      () => {
        for (const surface of [
          claimSheet,
          newArtistSheet,
          phoneFields,
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
