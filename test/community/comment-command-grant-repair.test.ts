import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration =
  readFileSync(
    "supabase/migrations/20260815184700_repair_community_comment_authenticated_commands.sql",
    "utf8",
  );

describe(
  "M8A Community comment command grant repair",
  () => {
    it(
      "repairs only the two drifted authenticated command grants",
      () => {
        expect(migration).toContain(
          "community_create_comment",
        );

        expect(migration).toContain(
          "community_soft_delete_comment",
        );

        expect(migration).toContain(
          "to authenticated, service_role",
        );

        expect(migration).toContain(
          "from public, anon",
        );
      },
    );

    it(
      "locks the repair to the existing RPC classification ledger",
      () => {
        expect(migration).toContain(
          "private.phase_0a_rpc_classification",
        );

        expect(migration).toContain(
          "authenticated_command",
        );
      },
    );

    it(
      "does not rewrite Community function bodies or storage",
      () => {
        expect(migration).not.toContain(
          "create or replace function",
        );

        expect(migration).not.toContain(
          "alter table",
        );

        expect(migration).not.toContain(
          "insert into public.community_comments",
        );
      },
    );

    it(
      "keeps anonymous comment writes forbidden",
      () => {
        expect(migration).toContain(
          "has_function_privilege",
        );

        expect(migration).toContain(
          "'anon'",
        );
      },
    );
  },
);
