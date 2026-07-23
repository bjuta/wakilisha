import fs from "node:fs";
import { describe, expect, it } from "vitest";

const service = fs.readFileSync(
  "src/services/publishing/publishingWorkspaceService.ts",
  "utf8",
);

const contract = fs.readFileSync(
  "docs/engineering/publishing-workspace-foundation.md",
  "utf8",
);

describe("Publishing workspace service", () => {
  it("uses generated database types", () => {
    expect(service).toContain(
      'import type {\n  Database,\n} from "@/types/database.types";',
    );

    expect(service).toContain(
      "SupabaseClient<Database>",
    );

    expect(service).toContain(
      'Database["public"]["Views"]["wk_publishing_workspace_items"]["Row"]',
    );
  });

  it("reads the governed workspace view", () => {
    expect(service).toContain(
      '.from("wk_publishing_workspace_items")',
    );

    expect(service).toContain(
      'fetchPublishingWorkspaceItem',
    );

    expect(service).toContain(
      'listPublishingWorkspaceItems',
    );
  });

  it("reads controlled Publishing reference data", () => {
    expect(service).toContain(
      '.schema("editorial")',
    );

    expect(service).toContain(
      '.from("publishing_content_kinds")',
    );

    expect(service).toContain(
      '.from("publishing_channels")',
    );
  });

  it("routes every write through governed RPCs", () => {
    for (const rpcName of [
      "create_publishing_item",
      "update_publishing_item",
      "link_publishing_item_resource",
      "add_publishing_item_assignee",
      "remove_publishing_item_assignee",
      "add_publishing_item_channel",
      "remove_publishing_item_channel",
    ]) {
      expect(service).toContain(
        `"${rpcName}"`,
      );
    }

    expect(service).not.toMatch(
      /\.insert\s*\(/,
    );

    expect(service).not.toMatch(
      /\.update\s*\(/,
    );

    expect(service).not.toMatch(
      /\.delete\s*\(/,
    );
  });

  it("classifies stale and permission failures", () => {
    expect(service).toContain(
      "STALE_PUBLISHING_ITEM_VERSION".toLowerCase(),
    );

    expect(service).toContain(
      'code === "40001"',
    );

    expect(service).toContain(
      'code === "42501"',
    );

    expect(service).toContain(
      '"stale_update"',
    );

    expect(service).toContain(
      '"permission_denied"',
    );
  });

  it("does not bypass canonical Article authority", () => {
    expect(service).not.toContain(
      '"schedule_article_publication"',
    );

    expect(service).not.toContain(
      '"publish_article_version"',
    );

    expect(service).not.toContain(
      '"approve_article_version"',
    );

    expect(contract).toContain(
      "The Publishing service does not schedule",
    );
  });
});
