import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260724090000_publishing_team_channel_controls.sql",
  "utf8",
);

const verifier = fs.readFileSync(
  "scripts/control-plane/verify-publishing-team-channel-controls.sql",
  "utf8",
);

const channelQualificationMigration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260724144500_publishing_channel_item_id_qualification.sql",
  "utf8",
);

const channelQualificationVerifier = fs.readFileSync(
  "scripts/control-plane/verify-publishing-channel-item-id-qualification.sql",
  "utf8",
);

const assigneeQualificationMigration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260724150500_publishing_assignee_item_id_qualification.sql",
  "utf8",
);

const assigneeQualificationVerifier = fs.readFileSync(
  "scripts/control-plane/verify-publishing-assignee-item-id-qualification.sql",
  "utf8",
);

describe("Publishing team and channel controls", () => {
  it("guards the assignable-user list with Publishing authority", () => {
    expect(migration).toContain("list_publishing_assignable_users");

    expect(migration).toContain("current_user_can_manage_publishing");

    expect(migration).toContain("profile.status = 'active'");

    expect(migration).toContain("assignment.status = 'active'");

    expect(migration).toContain("'edit_own_articles'");
  });

  it("does not expose the assignable-user list anonymously", () => {
    expect(migration).toContain("public.list_publishing_assignable_users()");

    expect(migration).toContain("from public, anon");

    expect(migration).toContain("to authenticated, service_role");
  });

  it("sets the primary channel through optimistic concurrency", () => {
    expect(migration).toContain("set_publishing_item_primary_channel");

    expect(migration).toContain("STALE_PUBLISHING_ITEM_VERSION");

    expect(migration).toContain("Publishing channel attachment not found");

    expect(migration).toContain("channel_primary_changed");

    expect(migration).toContain("record_version + 1");
  });

  it("extends the append-only event contract", () => {
    expect(migration).toContain("publishing_item_events_action_check");

    expect(migration).toContain("'channel_primary_changed'");

    expect(verifier).toContain("channel_primary_changed");

    expect(verifier).toContain("has_function_privilege");
  });

  it("qualifies channel mutation predicates that overlap output names", () => {
    expect(channelQualificationMigration).toContain(
      "add_publishing_item_channel",
    );

    expect(channelQualificationMigration).toContain(
      "remove_publishing_item_channel",
    );

    expect(channelQualificationMigration).toContain(
      "set_publishing_item_primary_channel",
    );

    expect(channelQualificationMigration).toMatch(
      /update editorial\.publishing_item_channels\s+as item_channel/,
    );

    expect(channelQualificationMigration).toMatch(
      /delete from editorial\.publishing_item_channels\s+as item_channel/,
    );

    expect(channelQualificationMigration).toMatch(
      /where item_channel\.item_id = p_item_id/,
    );

    expect(channelQualificationMigration).not.toMatch(
      /(?:where|and)\s+item_id\s*=\s*p_item_id/,
    );

    expect(channelQualificationVerifier).toContain(
      "still contains an unqualified item_id predicate",
    );

    expect(channelQualificationVerifier).toContain(
      "has_function_privilege",
    );
  });

  it("qualifies assignee removal predicates that overlap output names", () => {
    expect(assigneeQualificationMigration).toContain(
      "remove_publishing_item_assignee",
    );

    expect(assigneeQualificationMigration).toMatch(
      /delete from editorial\.publishing_item_assignees\s+as assignee/,
    );

    expect(assigneeQualificationMigration).toMatch(
      /where assignee\.item_id = p_item_id/,
    );

    expect(assigneeQualificationMigration).toMatch(
      /and assignee\.user_id = p_user_id/,
    );

    expect(assigneeQualificationMigration).toMatch(
      /and assignee\.assignment_role\s*=\s*p_assignment_role/,
    );

    expect(assigneeQualificationMigration).not.toMatch(
      /(?:where|and)\s+(?:item_id|user_id|assignment_role)\s*=/,
    );

    expect(assigneeQualificationVerifier).toContain(
      "still contains an unqualified predicate",
    );

    expect(assigneeQualificationVerifier).toContain(
      "has_function_privilege",
    );
  });
});
