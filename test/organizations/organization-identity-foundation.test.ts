import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260819203000_organization_identity_foundation.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-organization-identity-foundation.sql",
  "utf8",
);

const audit = readFileSync(
  "docs/engineering/organization-identity-foundation-implementation-audit.md",
  "utf8",
);

describe(
  "Organization identity foundation",
  () => {
    it(
      "uses Organization as identity and separate many-to-many type authority",
      () => {
        expect(migration)
          .toContain("'organization'");
        expect(migration)
          .toContain("editorial.organizations");
        expect(migration)
          .toContain("editorial.organization_types");
        expect(migration)
          .toContain("editorial.organization_type_assignments");
        expect(migration)
          .toContain("organization_type_assignments_one_primary_idx");
        expect(audit)
          .toContain(
            "Organization is durable identity authority, not the organization-type taxonomy",
          );
      },
    );

    it(
      "keeps Registry Label as a typed pairing instead of collapsing it into Organization",
      () => {
        expect(migration)
          .toContain(
            "editorial.organization_registry_label_links",
          );
        expect(migration)
          .toContain(
            "references public.registry_labels(id)",
          );
        expect(verifier)
          .toContain(
            "foundation migration must not silently pair existing Registry Labels",
          );
      },
    );

    it(
      "creates canonical WAKILISHA institutional identity without inventing profile copy",
      () => {
        expect(migration)
          .toContain(
            "'/organizations/wakilisha'",
          );
        expect(migration)
          .toContain(
            "'WAKILISHA'",
          );
        expect(migration)
          .toContain(
            "'cultural_platform', true, 0",
          );
        expect(migration)
          .toContain(
            "'publication', false, 1",
          );
        expect(audit)
          .toContain(
            "No description, logo, cover, or location copy is invented",
          );
      },
    );

    it(
      "expands Shared Credit to one typed Organization party",
      () => {
        expect(migration)
          .toContain(
            "organization_resource_id uuid",
          );
        expect(migration)
          .toContain(
            "credits_organization_resource_id_fkey",
          );
        expect(migration)
          .toContain(
            "num_nonnulls(",
          );
        expect(migration)
          .toContain(
            "organization_resource_id",
          );
      },
    );

    it(
      "locks the exact 73 Staff Article current-version boundary",
      () => {
        expect(migration)
          .toContain(
            "eda3b2b8708a10416004bc12bdef28c42a0944e9a5f848305aa8c7b7c78f7067",
          );
        expect(migration)
          .toContain(
            "v_staff_count <> 73",
          );
        expect(migration)
          .toContain(
            "version_author_display",
          );
        expect(verifier)
          .toContain(
            "all 73 Staff Articles must carry one WAKILISHA institutional Author Credit",
          );
      },
    );

    it(
      "preserves Person authority and human Article cardinality",
      () => {
        expect(verifier)
          .toContain(
            "public.list_public_article_author_paths(null)",
          );
        expect(verifier)
          .toContain(
            "v_human_path_count <> 134",
          );
        expect(verifier)
          .toContain(
            "Wakilisha Staff must remain outside Person authority",
          );
      },
    );

    it(
      "exposes narrow Organization public reads without frontend coupling",
      () => {
        expect(migration)
          .toContain(
            "public.get_public_organization",
          );
        expect(migration)
          .toContain(
            "public.list_public_article_author_organization_paths",
          );
        expect(migration)
          .toContain(
            "public.list_public_organization_work",
          );
        expect(migration)
          .toContain(
            "article.article_id = binding.article_id",
          );
        expect(migration)
          .toContain(
            "article.resource_id = resource.id",
          );
        expect(migration)
          .toContain(
            "article.version_id = attachment.target_version_id",
          );
        expect(audit)
          .toContain(
            "public Article Edge/frontend wiring is intentionally deferred until preview authority is proven",
          );
      },
    );
  },
);

