import {
  describe,
  expect,
  it,
} from "vitest";
import {
  readFileSync,
  readdirSync,
} from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const migrationName = readdirSync(
  "supabase/migrations",
).find((name) =>
  name.endsWith(
    "_editorial_credit_identity_primitive.sql",
  ),
);

if (!migrationName) {
  throw new Error(
    "Editorial Credit identity primitive migration is missing",
  );
}

const migration = read(
  `supabase/migrations/${migrationName}`,
);
const verifier = read(
  "scripts/control-plane/verify-editorial-credit-identity-primitive.sql",
);
const primitive = read(
  "src/components/design-system/trust/EditorialCreditPicker.tsx",
);
const creditService = read(
  "src/services/trust/editorialCreditService.ts",
);
const audioWorkspace = read(
  "src/pages/admin/content/audio/detail/AudioEditorWorkspace.tsx",
);
const audioService = read(
  "src/services/audio/audioAdminService.ts",
);
const registry = read(
  "scripts/control-plane/primitive-registry.json",
);

describe(
  "Editorial Credit identity primitive",
  () => {
    it(
      "resolves canonical Person and Organization identity before Credit transport",
      () => {
        expect(migration).toContain(
          "list_editorial_credit_picker_options",
        );
        expect(migration).toContain(
          "resolve_editorial_credit",
        );
        expect(migration).toContain(
          "editorial.resolve_person_presentation",
        );
        expect(migration).toContain(
          "editorial.resolve_credit_person",
        );
        expect(migration).toContain(
          "editorial.resolve_credit_organization",
        );
        expect(migration).toContain(
          "organization_resource_id",
        );
        expect(migration).toContain(
          "preferred_identity_link_id",
        );
      },
    );

    it(
      "reuses governed Credits before privileged creation and preserves legacy compatibility",
      () => {
        expect(migration).toContain(
          "editorial.assert_credit_command_actor",
        );
        expect(migration).toContain(
          "pg_advisory_xact_lock",
        );
        expect(migration).toContain(
          "editorial-credit:",
        );
        expect(migration).toContain("'created', false");
        expect(migration).toContain("'created', true");
        expect(migration).not.toContain(
          "create or replace function public.create_credit",
        );
      },
    );

    it(
      "keeps authority out of the reusable interaction primitive",
      () => {
        expect(primitive).toContain(
          "EditorialCreditPicker",
        );
        expect(primitive).toContain(
          "Person or Organization",
        );
        expect(primitive).not.toContain("@/services/");
        expect(primitive).not.toContain("@/pages/");
        expect(primitive).not.toContain("@/lib/supabase");
        expect(primitive).not.toContain("user_id");
        expect(primitive).not.toContain(
          "registry_author_id",
        );
        expect(primitive).not.toContain(
          "external_contributor_id",
        );
      },
    );

    it(
      "registers Audio as the first proven candidate consumer",
      () => {
        expect(registry).toContain(
          '"id": "trust.editorial-credit-picker"',
        );
        expect(registry).toContain(
          '"path": "src/components/design-system/trust/EditorialCreditPicker.tsx"',
        );
        expect(registry).toContain(
          '"maturity": "candidate"',
        );
        expect(audioWorkspace).toContain(
          "EditorialCreditPicker",
        );
        expect(audioWorkspace).toContain(
          "resolveEditorialCredit",
        );
      },
    );

    it(
      "does not infer Audio primary Credit semantics from attachment order",
      () => {
        expect(audioService).toContain(
          "is_primary: false",
        );
        expect(audioService).not.toContain(
          "is_primary: index === 0",
        );
      },
    );

    it(
      "keeps canonical Audio load alive when supporting tools fail",
      () => {
        expect(audioWorkspace).toContain(
          "Promise.allSettled",
        );
        expect(audioWorkspace).toContain(
          "Some supporting tools are unavailable",
        );
        expect(audioWorkspace).toContain(
          "fetchAudioPublicationWorkspace(publicationId)",
        );
      },
    );

    it(
      "keeps the permanent verifier read-only",
      () => {
        const body = verifier
          .toLowerCase()
          .replace(/raise exception/g, "")
          .replace(/raise notice/g, "");

        expect(body).not.toMatch(/\binsert\s+into\b/);
        expect(body).not.toMatch(/\bupdate\s+[a-z_]/);
        expect(body).not.toMatch(/\bdelete\s+from\b/);
        expect(body).not.toMatch(
          /\bcreate\s+(table|function|trigger|index|policy)\b/,
        );
        expect(creditService).toContain(
          "resolve_editorial_credit",
        );
      },
    );
  },
);
