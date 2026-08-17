import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260816083329_community_social_graph_m8b_authority.sql",
  "utf8",
);

const verifier = readFileSync(
  "scripts/control-plane/verify-community-social-graph-m8b-authority.sql",
  "utf8",
);

describe(
  "WAKILISHA M8B-M1 social graph authority",
  () => {
    it(
      "keeps Quote Post inside the canonical Post ledger",
      () => {
        expect(
          migration,
        ).toContain(
          "add column quoted_post_id uuid",
        );

        expect(
          migration,
        ).toContain(
          "community_posts_quoted_post_id_fkey",
        );

        expect(
          migration,
        ).toContain(
          "community_quote_post",
        );

        expect(
          migration,
        ).not.toContain(
          "create table public.community_quote_posts",
        );
      },
    );

    it(
      "gives Repost one durable identity with reversible state",
      () => {
        expect(
          migration,
        ).toContain(
          "create table public.community_post_reposts",
        );

        expect(
          migration,
        ).toContain(
          "community_post_reposts_person_identity_key",
        );

        expect(
          migration,
        ).toContain(
          "community_post_reposts_artist_identity_key",
        );

        expect(
          migration,
        ).toContain(
          "status='withdrawn'",
        );

        expect(
          migration,
        ).toContain(
          "status='active'",
        );

        expect(
          migration,
        ).not.toContain(
          "delete from public.community_post_reposts",
        );
      },
    );

    it(
      "makes Block durable, canonical, and immediately unfollowing",
      () => {
        expect(
          migration,
        ).toContain(
          "create table public.community_blocks",
        );

        expect(
          migration,
        ).toContain(
          "private.community_resolve_follow_target",
        );

        expect(
          migration,
        ).toContain(
          "delete from public.community_follows",
        );

        expect(
          migration,
        ).toContain(
          "trg_community_follows_block_guard",
        );

        expect(
          migration,
        ).toContain(
          "A user cannot block their own Person",
        );

        expect(
          migration,
        ).toContain(
          "A user cannot block an Artist they represent",
        );
      },
    );

    it(
      "extends the existing Report ledger to Posts",
      () => {
        expect(
          migration,
        ).toContain(
          "add column post_id uuid",
        );

        expect(
          migration,
        ).toContain(
          "community_reports_exactly_one_target_check",
        );

        expect(
          migration,
        ).toContain(
          "community_report_post",
        );

        for (
          const reason of [
            "spam",
            "harassment",
            "hate_or_abuse",
            "misinformation",
            "privacy",
            "copyright",
            "off_topic",
            "other",
          ]
        ) {
          expect(
            migration,
          ).toContain(
            `'${reason}'`,
          );
        }

        expect(
          migration,
        ).not.toContain(
          "create table public.community_post_reports",
        );
      },
    );

    it(
      "uses existing Person and Artist posting authority",
      () => {
        expect(
          migration,
        ).toContain(
          "editorial.current_person_post_actor()",
        );

        expect(
          migration,
        ).toContain(
          "editorial.current_artist_representation",
        );

        expect(
          migration,
        ).toContain(
          "v_rep.can_post_updates",
        );
      },
    );

    it(
      "records Repost and Quote Post notification events",
      () => {
        expect(
          migration,
        ).toContain(
          "'post_repost'",
        );

        expect(
          migration,
        ).toContain(
          "'post_quote'",
        );

        expect(
          migration,
        ).toContain(
          "public.community_notifications",
        );

        expect(
          migration,
        ).toContain(
          "private.community_is_blocked_target",
        );
      },
    );

    it(
      "classifies every new public RPC",
      () => {
        for (
          const signature of [
            "community_set_block_state(text,text,text,boolean)",
            "community_get_block_state(text,text,text)",
            "community_set_post_repost_state(text,uuid,uuid,boolean)",
            "community_get_actor_repost_state(text,uuid,uuid[])",
            "community_quote_post(text,uuid,uuid,text,text,text,text)",
            "community_report_post(uuid,text,text)",
          ]
        ) {
          expect(
            migration,
          ).toContain(
            signature,
          );

          expect(
            verifier,
          ).toContain(
            signature,
          );
        }
      },
    );

    it(
      "ships a read-only live verifier",
      () => {
        expect(
          verifier,
        ).toContain(
          "wakilisha_m8b_m1_social_graph_verification",
        );

        expect(
          verifier,
        ).toContain(
          "community_post_reposts is not a table",
        );

        expect(
          verifier,
        ).toContain(
          "Block Follow guard trigger is missing",
        );
      },
    );

    it(
      "contains SQL only and no generated shell fragments",
      () => {
        expect(
          migration.trimStart(),
        ).toMatch(
          /^-- WAKILISHA M8B-M1:/,
        );

        expect(
          migration.trimEnd(),
        ).toMatch(
          /commit;$/,
        );

        expect(
          migration,
        ).not.toContain(
          "<<'SQL'",
        );

        expect(
          migration,
        ).not.toContain(
          "$MIGRATION",
        );
      },
    );

    it(
      "keeps M8B runtime authority free of em and en dashes",
      () => {
        for (
          const source of [
            migration,
            verifier,
          ]
        ) {
          expect(
            source,
          ).not.toContain(
            "—",
          );

          expect(
            source,
          ).not.toContain(
            "–",
          );
        }
      },
    );
  },
);
