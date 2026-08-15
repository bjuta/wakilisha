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
    "supabase/migrations/20260815053500_fix_m7_post_reaction_uuid_aggregate.sql",
    "utf8",
  );

describe(
  "WAKILISHA M7 Post reaction-state corrective migration",
  () => {
    it(
      "removes the invalid UUID aggregate from executable SQL",
      () => {
        expect(
          migration,
        ).not.toContain(
          "min(row.id)",
        );

        expect(
          migration,
        ).toContain(
          "count(*)::integer as count_for_type",
        );

        expect(
          migration,
        ).toContain(
          "bool_or(",
        );
      },
    );

    it(
      "preserves authenticated RPC authority",
      () => {
        expect(
          migration,
        ).toContain(
          "to authenticated,service_role;",
        );
      },
    );
  },
);
