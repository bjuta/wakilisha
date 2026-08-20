import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const author = readFileSync(
  "supabase/migrations/20260820102000_article_author_person_replay_authority.sql",
  "utf8",
);

const organization = readFileSync(
  "supabase/migrations/20260820102100_organization_identity_replay_authority.sql",
  "utf8",
);

const retiredAuthor = readFileSync(
  "docs/engineering/replay-baseline/retired-active-migrations/20260819124500_article_author_person_convergence.sql",
  "utf8",
);

const retiredOrganization = readFileSync(
  "docs/engineering/replay-baseline/retired-active-migrations/20260819203000_organization_identity_foundation.sql",
  "utf8",
);

const activeAuthorPath =
  "supabase/migrations/20260819124500_article_author_person_convergence.sql";
const activeOrganizationPath =
  "supabase/migrations/20260819203000_organization_identity_foundation.sql";

const replayBaselineReadme = readFileSync(
  "docs/engineering/replay-baseline/README.md",
  "utf8",
);

describe(
  "August 19 data-bound replay authority repair",
  () => {
    it(
      "preserves production receipts but removes their data locks from active replay",
      () => {
        expect(retiredAuthor)
          .toContain(
            "STOP: canonical Beautah Person moved from reviewed revision 1",
          );
        expect(retiredAuthor)
          .toContain(
            "full reviewed human Article manifest digest moved",
          );
        expect(retiredOrganization)
          .toContain(
            "reviewed Staff Article boundary moved",
          );

        expect(author)
          .not.toContain(
            "canonical Beautah Person moved",
          );
        expect(author)
          .not.toContain(
            "human Article manifest digest",
          );
        expect(organization)
          .not.toContain(
            "reviewed Staff Article boundary moved",
          );
        expect(organization)
          .not.toContain(
            "lock_and_backfill_staff_articles",
          );
      },
    );

    it(
      "retires the two production-data-bound migrations from active replay after Stage A",
      () => {
        expect(existsSync(activeAuthorPath))
          .toBe(false);
        expect(existsSync(activeOrganizationPath))
          .toBe(false);
        expect(replayBaselineReadme)
          .toContain(
            "The cutover is intentionally two-stage",
          );
      },
    );

    it(
      "replays the canonical WAKILISHA Organization with a stable Resource UUID",
      () => {
        expect(organization)
          .toContain(
            "97d2dd8c-ff4d-48a0-95a7-5167f5e378d9",
          );
        expect(organization)
          .not.toContain(
            "v_org_id := gen_random_uuid()",
          );
      },
    );

    it(
      "retains enduring Article Author Person resolution",
      () => {
        expect(author)
          .toContain(
            "resolve_public_registry_author_person",
          );
        expect(author)
          .toContain(
            "editorial.person_identity_links",
          );
        expect(author)
          .toContain(
            "editorial.resource_aliases",
          );
      },
    );

    it(
      "retains enduring Organization authority",
      () => {
        for (const contract of [
          "editorial.organizations",
          "editorial.organization_types",
          "editorial.organization_type_assignments",
          "editorial.organization_registry_label_links",
          "editorial.resolve_credit_organization",
          "seed_wakilisha_organization",
          "public.get_public_organization",
          "public.list_public_article_author_organization_paths",
          "public.list_public_organization_work",
        ]) {
          expect(organization)
            .toContain(contract);
        }
      },
    );
  },
);
