import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migrationPath =
  process.env.WK_COMMUNITY_INTERACTION_MIGRATION;

if (!migrationPath) {
  throw new Error(
    "WK_COMMUNITY_INTERACTION_MIGRATION is required",
  );
}

const migration =
  readFileSync(
    migrationPath,
    "utf8",
  );

describe(
  "shared Community interaction authority",
  () => {
    it(
      "makes private interaction reads self-only",
      () => {
        expect(migration)
          .toContain(
            "community_get_user_votes_for_comments",
          );

        expect(migration)
          .toContain(
            "community_get_user_reactions_for_comments",
          );

        expect(migration)
          .toContain(
            "community_get_user_follows",
          );

        expect(migration)
          .toContain(
            "community_get_user_saves",
          );

        expect(migration)
          .toContain(
            "p_user_id is distinct from v_user_id",
          );
      },
    );

    it(
      "hardens Report and Contribution as authenticated interactions",
      () => {
        expect(migration)
          .toContain(
            "community_report_comment",
          );

        expect(migration)
          .toContain(
            "community_create_contribution",
          );

        expect(migration)
          .toContain(
            "Unsupported report reason",
          );

        expect(migration)
          .toContain(
            "Source comment not found",
          );
      },
    );

    it(
      "deduplicates pending Report and Contribution retries",
      () => {
        expect(migration)
          .toContain(
            "|report|",
          );

        expect(migration)
          .toContain(
            "|contribution|",
          );

        expect(migration)
          .toContain(
            "report.status =",
          );

        expect(migration)
          .toContain(
            "contribution.status =",
          );

        expect(migration)
          .toContain(
            "'created',",
          );

        expect(migration)
          .toContain(
            "pg_advisory_xact_lock",
          );
      },
    );

    it(
      "restores authenticated comment interaction authority",
      () => {
        expect(migration)
          .toContain(
            "community_vote_comment",
          );

        expect(migration)
          .toContain(
            "community_react_to_target",
          );

        expect(migration)
          .toContain(
            "to authenticated, service_role",
          );

        expect(migration)
          .not.toContain(
            "to anon, authenticated",
          );
      },
    );

    it(
      "uses fixed privileged search paths",
      () => {
        expect(migration)
          .toContain(
            "set search_path = pg_catalog, public",
          );

        expect(migration)
          .toContain(
            "revoke all on function",
          );
      },
    );

    it(
      "provides idempotent Follow and Save state commands",
      () => {
        expect(migration)
          .toContain(
            "community_set_follow_state",
          );

        expect(migration)
          .toContain(
            "p_followed boolean",
          );

        expect(migration)
          .toContain(
            "community_set_saved_state",
          );

        expect(migration)
          .toContain(
            "p_saved boolean",
          );

        expect(migration)
          .toContain(
            "on conflict",
          );
      },
    );

    it(
      "serializes interaction mutations",
      () => {
        expect(migration)
          .toContain(
            "pg_advisory_xact_lock",
          );

        expect(migration)
          .toContain(
            "for update",
          );
      },
    );

    it(
      "recomputes vote and reaction counters from authoritative rows",
      () => {
        expect(migration)
          .toContain(
            "count(*) filter",
          );

        expect(migration)
          .toContain(
            "sum(vote.vote_value)",
          );

        expect(migration)
          .toContain(
            "reaction_count = v_reaction_count",
          );

        expect(migration)
          .toContain(
            "Repair derived vote counters",
          );
      },
    );

    it(
      "keeps comment reaction hydration scoped to comments",
      () => {
        expect(migration)
          .toContain(
            "reaction.target_type = 'comment'",
          );
      },
    );
  },
);
