import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "docs/engineering/replay-baseline/legacy-migrations/20260723161000_publishing_workspace_foundation.sql",
  "utf8",
);

const contract = fs.readFileSync(
  "docs/engineering/publishing-workspace-foundation.md",
  "utf8",
);

const userRoles = fs.readFileSync(
  "src/services/userRoles.ts",
  "utf8",
);

const createPublishingItemRpcMarker =
  "create or replace function public.create_publishing_item(";

const createPublishingItemRpcIndex =
  migration.indexOf(createPublishingItemRpcMarker);

const migrationBeforeCreatePublishingItemRpc =
  createPublishingItemRpcIndex >= 0
    ? migration.slice(0, createPublishingItemRpcIndex)
    : migration;

describe("Publishing workspace foundation", () => {
  it("creates the governed operational domain", () => {
    for (const relation of [
      "editorial.publishing_content_kinds",
      "editorial.publishing_channels",
      "editorial.publishing_items",
      "editorial.publishing_item_assignees",
      "editorial.publishing_item_channels",
      "editorial.publishing_item_events",
    ]) {
      expect(migration).toContain(`create table ${relation}`);
    }
  });

  it("keeps important writes behind optimistic-concurrency RPCs", () => {
    expect(migration).toContain(
      "STALE_PUBLISHING_ITEM_VERSION",
    );

    expect(migration).toContain(
      "record_version = item.record_version + 1",
    );

    expect(migration).toContain(
      "Publishing item record_version must advance by exactly one",
    );

    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete)[\s\S]*publishing_items[\s\S]*authenticated/i,
    );
  });

  it("does not backfill operational items automatically", () => {
    expect(
      createPublishingItemRpcIndex,
    ).toBeGreaterThan(-1);

    expect(
      migrationBeforeCreatePublishingItemRpc,
    ).not.toMatch(
      /insert\s+into\s+editorial\.publishing_items/i,
    );

    expect(migration).toContain(
      "insert into editorial.publishing_items (",
    );

    expect(contract).toContain(
      "QPR4A does not create Publishing items",
    );
  });

  it("does not create a parallel Article scheduler", () => {
    expect(migration).not.toContain(
      "create table editorial.publishing_schedules",
    );

    expect(migration).not.toContain(
      "create or replace function public.schedule_publishing",
    );

    expect(contract).toContain(
      "governed Article schedule remains authoritative",
    );
  });

  it("adds separate read and management capabilities", () => {
    expect(migration).toContain(
      "'manage_publishing'",
    );

    expect(userRoles).toContain(
      '"view_publishing_dashboard" | "manage_publishing" | "view_archive"',
    );

    expect(userRoles.match(
      /"view_publishing_dashboard", "manage_publishing", "view_archive"/g,
    )).toHaveLength(2);
  });

  it("guards derived states with item-level read authority", () => {
    expect(migration).toMatch(
      /derive_publishing_editorial_state[\s\S]*current_user_can_view_publishing_item/,
    );

    expect(migration).toMatch(
      /derive_publishing_publication_state[\s\S]*current_user_can_view_publishing_item/,
    );

    expect(contract).toContain(
      "Derived editorial and publication states enforce",
    );
  });

  it("keeps canonical resource links stable", () => {
    expect(migration).toContain(
      "A linked Publishing item cannot be unlinked or retargeted",
    );

    expect(migration).toContain(
      "publishing_items_one_open_resource_idx",
    );
  });

  it("keeps Publishing history append-only", () => {
    expect(migration).toContain(
      "Publishing item events are append-only",
    );

    expect(migration).toContain(
      "publishing_item_events_append_only",
    );
  });
});
