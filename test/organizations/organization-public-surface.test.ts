import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const read = (
  path: string,
) =>
  readFileSync(
    path,
    "utf8",
  );

describe(
  "Organization public surface",
  () => {
    const service = read(
      "src/services/organizations/organizationPublicService.ts",
    );
    const page = read(
      "src/pages/organizations/detail/page.tsx",
    );
    const personPage = read(
      "src/pages/people/detail/page.tsx",
    );
    const edge = read(
      "supabase/functions/public-content-read/index.ts",
    );
    const client = read(
      "src/services/publicContent/client.ts",
    );
    const magazine = read(
      "src/services/magazineArticles.ts",
    );
    const identity = read(
      "src/components/design-system/editorial/ArticleAuthorIdentity.tsx",
    );
    const desktop = read(
      "src/pages/magazine/article/page.tsx",
    );
    const mobile = read(
      "src/pages/mobile/magazine/article/page.tsx",
    );
    const router = read(
      "src/router/config.tsx",
    );
    const lazyPublic = read(
      "src/router/lazyPublic.tsx",
    );

    it(
      "uses the existing Organization authority without new schema",
      () => {
        expect(service)
          .toContain(
            '"get_public_organization"',
          );
        expect(service)
          .toContain(
            '"list_public_organization_work"',
          );
        expect(service)
          .toContain(
            "resourceKind: string;",
          );
      },
    );

    it(
      "builds navigation from supported capabilities instead of organization type",
      () => {
        expect(page)
          .toContain(
            "ORGANIZATION_CAPABILITIES",
          );
        expect(page)
          .toContain(
            'resourceKind: "article"',
          );
        expect(page)
          .toContain(
            'label: "Articles"',
          );
        expect(page)
          .toContain(
            "buildCapabilities(",
          );
        expect(page)
          .toContain(
            "capabilities.map(",
          );
        expect(page)
          .not.toContain(
            'label: "Releases"',
          );
        expect(page)
          .not.toContain(
            'label: "Events"',
          );
        expect(page)
          .not.toContain(
            'label: "Artists"',
          );
      },
    );

    it(
      "reuses the proven Person profile grammar instead of inventing an Organization-only layout",
      () => {
        const sharedProfileClasses = [
          "profile-dt-shell",
          "profile-dt-hero",
          "profile-dt-cover",
          "profile-dt-content",
          "profile-dt-header",
          "profile-dt-avatar",
          "profile-dt-header-main",
          "profile-dt-name",
          "profile-dt-header-actions",
          "profile-dt-tabbar",
          "profile-dt-tab",
          "author-profile-featured-wrap",
          "author-profile-filter-bar",
        ];

        for (
          const className of
          sharedProfileClasses
        ) {
          expect(personPage)
            .toContain(
              className,
            );
          expect(page)
            .toContain(
              className,
            );
        }

        expect(page)
          .not.toContain(
            "Published on WAKILISHA",
          );
        expect(page)
          .not.toContain(
            ">Overview<",
          );
      },
    );

    it(
      "emits typed Organization author paths from server authority",
      () => {
        expect(edge)
          .toContain(
            '"list_public_article_author_organization_paths"',
          );
        expect(edge)
          .toContain(
            "authorOrganizationPath:",
          );
        expect(edge)
          .toContain(
            "authorOrganizationPaths.get(String(article.slug))",
          );
        expect(client)
          .toContain(
            "authorOrganizationPath?: string | null;",
          );
        expect(magazine)
          .toContain(
            "authorOrganizationPath?: string | null;",
          );
      },
    );

    it(
      "lets Article author identity navigate to Person or Organization without byline inference",
      () => {
        expect(identity)
          .toContain(
            "organizationPath?: string | null;",
          );
        expect(identity)
          .toContain(
            "personPath\n    ?? organizationPath",
          );
        expect(identity)
          .not.toContain(
            "Wakilisha Staff",
          );
      },
    );

    it(
      "keeps Article schema author type aligned with the typed destination",
      () => {
        for (
          const source of [
            desktop,
            mobile,
          ]
        ) {
          expect(source)
            .toContain(
              "author: article.authorPersonPath",
            );
          expect(source)
            .toContain(
              '"@type": "Person"',
            );
          expect(source)
            .toContain(
              "article.authorOrganizationPath",
            );
          expect(source)
            .toContain(
              '"@type": "Organization"',
            );
        }
      },
    );

    it(
      "registers one canonical public Organization route",
      () => {
        expect(router)
          .toContain(
            'path: "/organizations/:slug"',
          );
        expect(router)
          .toContain(
            "<OrganizationDetailPage />",
          );
        expect(lazyPublic)
          .toContain(
            "../pages/organizations/detail/page",
          );
      },
    );
  },
);
