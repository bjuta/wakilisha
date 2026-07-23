import fs from "node:fs";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  "src/pages/admin/content/publishing/page.tsx",
  "utf8",
);

const createDrawer = fs.readFileSync(
  "src/pages/admin/content/publishing/components/CreatePublishingItemDrawer.tsx",
  "utf8",
);

const editDrawer = fs.readFileSync(
  "src/pages/admin/content/publishing/components/EditPublishingItemDrawer.tsx",
  "utf8",
);

const archiveDialog = fs.readFileSync(
  "src/pages/admin/content/publishing/components/ArchivePublishingItemDialog.tsx",
  "utf8",
);

const ownerSemanticsMigration = fs.readFileSync(
  "supabase/migrations/20260723205000_publishing_create_owner_null_semantics.sql",
  "utf8",
);

describe("Publishing workspace core", () => {
  it("gates creation and editing with manage_publishing", () => {
    expect(page).toContain(
      'adminUser.can("manage_publishing")',
    );

    expect(page).toContain(
      "CreatePublishingItemDrawer",
    );

    expect(page).toContain(
      "EditPublishingItemDrawer",
    );
  });

  it("offers creation in the header and empty state", () => {
    const createLabels =
      page.match(/Create Publishing Item/g) ?? [];

    expect(createLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("routes creation through the governed RPC service", () => {
    expect(createDrawer).toContain(
      "createPublishingItem({",
    );

    expect(createDrawer).not.toContain(
      ".insert(",
    );

    expect(createDrawer).not.toContain(
      "schedule_article_publication",
    );

    expect(createDrawer).not.toContain(
      "publish_article_version",
    );
  });

  it("opens existing items from the workspace table", () => {
    expect(page).toContain(
      "onRowClick={",
    );

    expect(page).toContain(
      "openEditDrawer(row)",
    );

    expect(page).toContain(
      "selectedItem",
    );
  });

  it("routes edits through the governed update service", () => {
    expect(editDrawer).toContain(
      "updatePublishingItem({",
    );

    expect(editDrawer).toContain(
      "expectedRecordVersion:",
    );

    expect(editDrawer).not.toContain(
      ".update(",
    );

    expect(editDrawer).not.toContain(
      ".delete(",
    );
  });

  it("preserves canonical publication authority", () => {
    expect(createDrawer).toContain(
      "Planned timing does not schedule or publish canonical content.",
    );

    expect(editDrawer).toContain(
      "These states are read-only here and remain controlled by the canonical editor.",
    );

    expect(editDrawer).not.toContain(
      "schedule_article_publication",
    );

    expect(editDrawer).not.toContain(
      "publish_article_version",
    );
  });

  it("archives only through the confirmed archive action", () => {
    expect(editDrawer).toContain(
      'planningState: "archived"',
    );

    expect(editDrawer).toContain(
      "ArchivePublishingItemDialog",
    );

    expect(editDrawer).toContain(
      'state !== "archived"',
    );

    expect(editDrawer).toContain(
      'item.planningState !== "archived"',
    );

    expect(editDrawer).toContain(
      "Use Archive Item and record an archive note.",
    );

    expect(archiveDialog).toContain(
      "Archive Note",
    );

    expect(archiveDialog).toContain(
      "note.trim().length === 0",
    );

    expect(editDrawer).not.toContain(
      "deletePublishing",
    );
  });

  it("reloads stale records before another save", () => {
    expect(editDrawer).toContain(
      'result.errorCode === "stale_update"',
    );

    expect(editDrawer).toContain(
      "onReloadLatest(item.id)",
    );

    expect(page).toContain(
      "nextItems.find(",
    );
  });

  it("allows archived work to return to active planning", () => {
    expect(editDrawer).toContain(
      "PUBLISHING_PLANNING_STATES",
    );

    expect(editDrawer).toContain(
      'item.planningState ===',
    );

    expect(editDrawer).toContain(
      'state !== "archived"',
    );

    expect(editDrawer).toContain(
      ".map((state) =>",
    );

    expect(page).toContain(
      "setPlanningFilter(nextPlanningState)",
    );
  });

  it("keeps workspace counts aligned with planning state", () => {
    expect(page).toContain(
      "stageCountItems",
    );

    expect(page).toContain(
      "All Stages {stageCountItems.length}",
    );

    expect(page).toContain(
      "const activeItems = items.filter",
    );
  });

  it("allows an item to remain unassigned on creation", () => {
    expect(ownerSemanticsMigration).toContain(
      "p_owner_id,",
    );

    expect(ownerSemanticsMigration).not.toContain(
      "coalesce(p_owner_id, auth.uid())",
    );
  });

  it("preserves null dates through the create path", () => {
    expect(createDrawer).toContain(
      "if (!value) return null;",
    );

    expect(createDrawer).toContain(
      "toIsoOrNull(productionDeadline)",
    );

    expect(createDrawer).toContain(
      "toIsoOrNull(plannedPublishAt)",
    );
  });

  it("makes disabled create and save actions visually clear", () => {
    expect(createDrawer).toContain(
      "disabled:cursor-not-allowed",
    );

    expect(editDrawer).toContain(
      "disabled:cursor-not-allowed",
    );

    expect(archiveDialog).toContain(
      "disabled:cursor-not-allowed",
    );
  });

  it("supports mobile drawer containment", () => {
    expect(createDrawer).toContain(
      "h-[100dvh] max-h-[100dvh] overflow-hidden",
    );

    expect(editDrawer).toContain(
      "h-[100dvh] max-h-[100dvh] overflow-hidden",
    );

    expect(editDrawer).toContain(
      "overflow-y-auto overscroll-contain",
    );

    expect(editDrawer).toContain(
      "calc(2.5rem+env(safe-area-inset-bottom))",
    );

    expect(archiveDialog).toContain(
      "h-[100dvh] max-h-[100dvh]",
    );
  });

  it("keeps the production-stage strip horizontally scrollable", () => {
    expect(page).toContain(
      'className="flex gap-1 overflow-x-auto"',
    );

    expect(page).toContain(
      "shrink-0 rounded-lg",
    );
  });
});
