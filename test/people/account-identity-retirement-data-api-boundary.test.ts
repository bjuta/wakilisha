import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260915233000_account_retirement_data_api_private_executor.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-account-retirement-data-api-boundary.sql",
  "utf8",
);

const acceptance = readFileSync(
  "scripts/acceptance/account-retirement-data-api-v1.mjs",
  "utf8",
);

describe(
  "Account retirement Data API deferred-integrity boundary",
  () => {
    it(
      "keeps a narrow public invoker facade and private definer orchestration",
      () => {
        expect(migration).toContain(
          "create schema account_identity_private authorization postgres",
        );
        expect(migration).toContain(
          "rename to retire_account_identity_core",
        );
        expect(migration).toContain(
          "security invoker",
        );
        expect(migration).toContain(
          "security definer",
        );
        expect(migration).toContain(
          "from account_identity_private.retire_account_identity(",
        );
      },
    );

    it(
      "flushes reviewed deferred Person integrity while privileged",
      () => {
        for (const constraint of [
          "editorial.resources_resource_version_pointer_integrity",
          "editorial.resources_binding_integrity",
          "editorial.people_binding_integrity",
          "editorial.people_identity_integrity",
          "editorial.people_merge_cycle_integrity",
          "editorial.person_identity_links_preferred_integrity",
        ]) {
          expect(migration).toContain(constraint);
        }

        expect(migration).toContain(
          "retire_account_identity_core(",
        );
        expect(migration).toContain(
          "immediate;",
        );
        expect(migration).toContain(
          "deferred;",
        );
      },
    );

    it(
      "does not broaden table or integrity-trigger privileges",
      () => {
        expect(migration).not.toMatch(
          /grant\s+select\s+on\s+(?:table\s+)?editorial\.people\s+to\s+authenticated/i,
        );
        expect(migration).not.toMatch(
          /grant\s+select\s+on\s+(?:table\s+)?auth\.users\s+to\s+authenticated/i,
        );
        expect(migration).not.toMatch(
          /alter\s+function\s+editorial\.assert_person_identity_integrity\(\)\s+security\s+definer/i,
        );
        expect(verifier).toContain(
          "Person integrity trigger functions were globally privilege-escalated",
        );
      },
    );

    it(
      "keeps real Data API retirement as the permanent acceptance contract",
      () => {
        expect(acceptance).toContain(
          '.rpc(\n  "retire_account_identity"',
        );
        expect(acceptance).toContain(
          "ACCOUNT_RETIREMENT_DATA_API_NO_CAPABILITY_DENIAL=PASS",
        );
        expect(acceptance).toContain(
          "ACCOUNT_RETIREMENT_PRIVATE_SCHEMA_NOT_EXPOSED=PASS",
        );
        expect(acceptance).toContain(
          "ACCOUNT_RETIREMENT_DATA_API_HTTP_PASS",
        );
      },
    );
  },
);
