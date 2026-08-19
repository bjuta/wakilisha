import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe(
  "Account identity retirement authority",
  () => {
    const migration = read(
      "supabase/migrations/20260819150000_account_identity_retirement_authority.sql",
    );

    const verifier = read(
      "scripts/control-plane/verify-account-identity-retirement.sql",
    );

    const audit = read(
      "docs/engineering/account-identity-retirement-implementation-audit.md",
    );

    it(
      "keeps beautahj approval in the audit rather than hard-coding it into generic authority",
      () => {
        expect(audit).toContain("beautahj");
        expect(audit).toContain(
          "7ea8fb65-287b-409e-9bb9-a81bc74e4e75",
        );
        expect(audit).toContain(
          "12604a1a-3b9a-44ca-8c11-9f5805d7137e",
        );
        expect(migration).not.toContain("beautahj");
        expect(migration).not.toContain(
          "7ea8fb65-287b-409e-9bb9-a81bc74e4e75",
        );
      },
    );

    it(
      "preserves retired account UUID history without weakening the live user profile FK",
      () => {
        expect(migration).toContain(
          "create table editorial.retired_account_identities",
        );
        expect(migration).toContain(
          "retired_user_id_snapshot uuid",
        );
        expect(migration).toContain(
          "references editorial.retired_account_identities(user_id)",
        );
        expect(migration).not.toContain(
          "drop constraint person_identity_links_user_fkey",
        );
      },
    );

    it(
      "reuses governed Person unlink authority and requires both management capabilities",
      () => {
        expect(migration).toContain(
          "public.unlink_person_identity(",
        );
        expect(migration).toContain(
          "'manage_people_identity'",
        );
        expect(migration).toContain(
          "'manage_users'",
        );
        expect(migration).toContain(
          "'account.identity_retire'",
        );
      },
    );

    it(
      "refuses self-retirement, privileged targets, and durable FK blockers before Auth deletion",
      () => {
        expect(migration).toContain(
          "The current administrator cannot retire their own account",
        );
        expect(migration).toContain(
          "account_retirement_privileged_target",
        );
        expect(migration).toContain(
          "account_retirement_blocked",
        );
        expect(migration).toContain(
          "constraint_row.confdeltype in",
        );
        expect(migration).toContain(
          "delete from auth.users target_user",
        );
      },
    );

    it(
      "archives only identity-orphaned People and retires their public aliases",
      () => {
        expect(migration).toContain(
          "v_remaining_active_links = 0",
        );
        expect(migration).toContain(
          "person_state = 'archived'",
        );
        expect(migration).toContain(
          "'person_archived'",
        );
        expect(migration).toContain(
          "is_canonical = false",
        );
        expect(migration).toContain(
          "retired_at = now()",
        );
      },
    );

    it(
      "keeps the permanent verifier read-only and checks tombstone, link, receipt, account, event, and archive integrity",
      () => {
        expect(verifier).toContain(
          "retired_account_identities",
        );
        expect(verifier).toContain(
          "retired_user_id_snapshot",
        );
        expect(verifier).toContain(
          "account.identity_retire",
        );
        expect(verifier).toContain(
          "identity_unlinked",
        );
        expect(verifier).toContain(
          "person_archived",
        );
        expect(verifier).not.toContain(
          "delete from",
        );
        expect(verifier).not.toContain(
          "insert into",
        );
        expect(verifier).not.toContain(
          "update editorial.",
        );
      },
    );
  },
);
