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

const articleAdminService = fs.readFileSync(
  "src/services/articles/articleAdminService.ts",
  "utf8",
);

const archiveDialog = fs.readFileSync(
  "src/pages/admin/content/publishing/components/ArchivePublishingItemDialog.tsx",
  "utf8",
);

const relationshipsSection = fs.readFileSync(
  "src/pages/admin/content/publishing/components/PublishingRelationshipsSection.tsx",
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

  it("keeps Publishing focused on editorial operations", () => {
    expect(page).toContain(
      "Coordinate work, do not publish from here",
    );

    expect(page).toContain(
      "Use this board to move work across owners, teams,",
    );

    expect(page).toContain(
      "Canonical",
    );

    expect(page).toContain(
      "editors still control review, scheduling, and",
    );

    expect(page).not.toContain(
      "schedule_article_publication",
    );

    expect(page).not.toContain(
      "publish_article_version",
    );
  });

  it("adds operations lenses and board view without taking publication authority", () => {
    expect(page).toContain("type PublishingOperationView");

    expect(page).toContain("type PublishingViewMode");

    expect(page).toContain(
      "const operationViewOptions = useMemo",
    );

    expect(page).toContain("Active Ops");

    expect(page).toContain("My Work");

    expect(page).toContain("Unassigned");

    expect(page).toContain("Due Soon");

    expect(page).toContain("Ready Handoff");

    expect(page).toContain("Needs Article Link");

    expect(page).toContain("Board View");

    expect(page).toContain("Table View");

    expect(page).toContain(
      "matchesOperationView(",
    );

    expect(page).toContain(
      'viewMode === "board"',
    );

    expect(page).toContain(
      "PUBLISHING_PRODUCTION_STAGES.map",
    );

    expect(page).toContain(
      "summarizePeople(item)",
    );

    expect(page).toContain(
      "summarizeChannels(item)",
    );
  });

  it("renders Publishing drawers at the document body portal root", () => {
    expect(createDrawer).toContain(
      'import { Portal } from "@/components/base/Portal";',
    );

    expect(createDrawer).toContain("<Portal>");
    expect(createDrawer).toContain("</Portal>");

    expect(editDrawer).toContain(
      'import { Portal } from "@/components/base/Portal";',
    );

    expect(editDrawer).toContain("<Portal>");
    expect(editDrawer).toContain("</Portal>");
  });

  it("does not move the page when Publishing drawers mount", () => {
    expect(createDrawer).not.toContain("autoFocus");
    expect(editDrawer).not.toContain("autoFocus");

    expect(createDrawer).not.toContain(
      "document.body.style",
    );

    expect(createDrawer).not.toContain(
      "document.documentElement.style",
    );

    expect(editDrawer).not.toContain(
      "document.body.style",
    );

    expect(editDrawer).not.toContain(
      "document.documentElement.style",
    );
  });

  it("opens Publishing drawers without mutating document scroll styles", () => {
    expect(createDrawer).toContain(
      'window.addEventListener("keydown", handleKeyDown);',
    );

    expect(createDrawer).toContain(
      "fixed inset-y-0 right-0",
    );

    expect(createDrawer).toContain("overscroll-contain");

    expect(createDrawer).not.toContain(
      "document.body.style",
    );

    expect(createDrawer).not.toContain(
      "document.documentElement.style",
    );

    expect(createDrawer).not.toContain("scrollbar-gutter");

    expect(editDrawer).toContain(
      'window.addEventListener("keydown", handleKeyDown);',
    );

    expect(editDrawer).toContain(
      "fixed inset-y-0 right-0",
    );

    expect(editDrawer).toContain("overscroll-contain");

    expect(editDrawer).not.toContain(
      "document.body.style",
    );

    expect(editDrawer).not.toContain(
      "document.documentElement.style",
    );

    expect(editDrawer).not.toContain("scrollbar-gutter");
  });

  it("keeps Publishing drawers fixed over the operations board", () => {
    expect(createDrawer).toContain(
      'fixed inset-0 z-[100] flex h-[100dvh] min-h-[100dvh] w-screen max-h-[100dvh] overflow-hidden',
    );

    expect(createDrawer).toContain(
      'fixed inset-y-0 right-0 z-[110] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl',
    );

    expect(createDrawer).toContain(
      'min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5',
    );

    expect(editDrawer).toContain(
      'fixed inset-0 z-[100] flex h-[100dvh] min-h-[100dvh] w-screen max-h-[100dvh] overflow-hidden',
    );

    expect(editDrawer).toContain(
      'fixed inset-y-0 right-0 z-[110] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl',
    );

    expect(editDrawer).toContain(
      'min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5',
    );
  });

  it("supports mobile drawer containment", () => {
    expect(createDrawer).toContain(
      'fixed inset-0 z-[100] flex h-[100dvh] min-h-[100dvh] w-screen max-h-[100dvh] overflow-hidden',
    );

    expect(createDrawer).toContain(
      'fixed inset-y-0 right-0 z-[110] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl',
    );

    expect(createDrawer).toContain(
      'min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5',
    );

    expect(editDrawer).toContain(
      'fixed inset-0 z-[100] flex h-[100dvh] min-h-[100dvh] w-screen max-h-[100dvh] overflow-hidden',
    );

    expect(editDrawer).toContain(
      'fixed inset-y-0 right-0 z-[110] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl',
    );

    expect(editDrawer).toContain(
      'min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5',
    );
  });

  it("keeps operation lenses separate from manual custom filters", () => {
    expect(page).toContain("function setCustomSearchQuery");

    expect(page).toContain("function setCustomStageFilter");

    expect(page).toContain("function setCustomPlanningFilter");

    expect(page).toContain("function setCustomContentKindFilter");

    expect(page).toContain("function setCustomPriorityFilter");

    expect(page).toContain("function setCustomChannelFilter");

    expect(page).toContain("function setCustomOwnerFilter");

    expect(page).toContain(
      "setCustomSearchQuery(event.target.value)",
    );

    expect(page).toContain(
      "setCustomPlanningFilter(",
    );

    expect(page).toContain(
      "setCustomStageFilter(stage)",
    );

    expect(page).toContain(
      "setCustomContentKindFilter(event.target.value)",
    );

    expect(page).toContain(
      "setCustomPriorityFilter(",
    );

    expect(page).toContain(
      "setCustomChannelFilter(event.target.value)",
    );

    expect(page).toContain(
      "setCustomOwnerFilter(event.target.value)",
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

  it("can link a canonical Article while creating Publishing work", () => {
    expect(createDrawer).toContain(
      'from "@/services/articles/articleAdminService";',
    );

    expect(createDrawer).toContain(
      "fetchArticlesForAdminList(500)",
    );

    expect(createDrawer).toContain(
      "Optional Canonical Article",
    );

    expect(createDrawer).toContain(
      "resourceId: selectedArticle?.resourceId ?? null",
    );

    expect(createDrawer).toContain(
      "setSelectedArticleResourceId",
    );

    expect(createDrawer).toContain("No Resource");

    expect(createDrawer).not.toContain(
      "connect it to a canonical editor later",
    );

    expect(createDrawer).not.toContain(
      "schedule_article_publication",
    );

    expect(createDrawer).not.toContain(
      "publish_article_version",
    );
  });

  it("prevents create-time Article links from reusing a linked canonical resource", () => {
    expect(page).toContain("const linkedResourceIds = useMemo");

    expect(page).toContain(
      "linkedResourceIds={linkedResourceIds}",
    );

    expect(createDrawer).toContain(
      "linkedResourceIds: Set<string>;",
    );

    expect(createDrawer).toContain(
      "linkedResourceIds.has(selectedArticleResourceId)",
    );

    expect(createDrawer).toContain("Already Linked");

    expect(createDrawer).toContain(
      "Choose an Article that is not already linked to Publishing.",
    );
  });

  it("surfaces linked Article authority in the workspace table", () => {
    expect(page).toContain(
      'from "@/services/articles/articleAdminService";',
    );

    expect(page).toContain(
      "fetchArticlesForAdminList(500)",
    );

    expect(page).toContain(
      "const linkedArticleByResourceId = useMemo",
    );

    expect(page).toContain(
      "articleMap.set(article.resourceId, article)",
    );

    expect(page).toContain(
      "const linkedArticle = row.resourceId",
    );

    expect(page).toContain("Article:{\" \"}");

    expect(page).toContain(
      'linkedArticle?.title ?? "Linked"',
    );

    expect(page).toContain(
      ': "Not Linked"',
    );

    expect(page).toContain(
      "title={linkedArticle?.title ?? undefined}",
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

  it("links Publishing work to an existing canonical Article through the governed RPC", () => {
    expect(articleAdminService).toContain(
      "export interface AdminArticleListItem",
    );

    expect(articleAdminService).toContain("id: string;");

    expect(articleAdminService).toContain(
      "resourceId: string | null;",
    );

    expect(articleAdminService).toContain(
      '.select("id, slug, title, excerpt, author, published_at, wp_status, created_at, categories, tags, hero_image_url")',
    );

    expect(editDrawer).toContain(
      'from "@/services/articles/articleAdminService";',
    );

    expect(editDrawer).toContain(
      "fetchArticlesForAdminList(500)",
    );

    expect(editDrawer).toContain(
      "linkPublishingItemResource({",
    );

    expect(editDrawer).toContain(
      "expectedRecordVersion: item.recordVersion",
    );

    expect(articleAdminService).toContain(
      '.from("wk_resource_index")',
    );

    expect(articleAdminService).toContain(
      '.eq("resource_kind", "article")',
    );

    expect(editDrawer).toContain(
      "resourceId: article.resourceId",
    );

    expect(editDrawer).toContain(
      "articleOption.resourceId !== null",
    );

    expect(editDrawer).not.toContain(
      "resourceId: article.id",
    );

    expect(editDrawer).toContain("Linked Article");

    expect(editDrawer).toContain("Link Article");

    expect(editDrawer).not.toContain(
      "schedule_article_publication",
    );

    expect(editDrawer).not.toContain(
      "publish_article_version",
    );
  });

  it("locks edit-time Article retargeting after a canonical Article is linked", () => {
    expect(editDrawer).toContain(
      "This Publishing item already has a canonical Article.",
    );

    expect(editDrawer).toContain("const retargetLocked =");

    expect(editDrawer).toContain(
      "item.resourceId !== null &&",
    );

    expect(editDrawer).toContain(
      "article.resourceId !== item.resourceId",
    );

    expect(editDrawer).toContain("Locked");
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

  it("restores archived work through a first-class restore action", () => {
    expect(editDrawer).toContain(
      "async function handleRestore()",
    );

    expect(editDrawer).toContain(
      'planningState: "active"',
    );

    expect(editDrawer).toContain(
      "Publishing item restored.",
    );

    expect(editDrawer).toContain("Restore Item");

    expect(editDrawer).toContain("Restoring Item");

    expect(editDrawer).toContain(
      "Use Restore Item to return archived work to Active.",
    );

    expect(editDrawer).toContain(
      'item.planningState ===\n                        "archived"\n                          ? state === "archived"',
    );

    expect(editDrawer).toContain(
      "restoring ||",
    );
  });

  it("keeps archived Publishing work read-only until restored", () => {
    expect(editDrawer).toContain(
      'const archivedReadOnly =\n    item.planningState === "archived";',
    );

    expect(editDrawer).toContain(
      "const formDisabled = busy || archivedReadOnly;",
    );

    expect(editDrawer).toContain(
      "Restore this Publishing item before editing it.",
    );

    expect(editDrawer).toContain(
      "Restore this Publishing item before changing its Article link.",
    );

    expect(editDrawer).toContain(
      "Archived work is locked. Restore it before editing planning, team, channels, or Article links.",
    );

    expect(editDrawer).toContain(
      "disabled={formDisabled}",
    );

    expect(editDrawer).toContain(
      "disabled={\n                                  formDisabled ||",
    );

    expect(editDrawer).toContain(
      "disabled={\n                  busy ||\n                  archivedReadOnly ||",
    );

    expect(editDrawer).toContain("Restore Item");
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

  it("makes archived Publishing work visible as a first-class planning view", () => {
    expect(page).toContain("Planning View");

    expect(page).toContain("All Work {items.length}");

    expect(page).toContain("planningCounts[state]");

    expect(page).toContain('changePlanningFilter("all")');

    expect(page).toContain("setPlanningFilter(nextPlanningState)");

    expect(page).not.toContain(
      'nextPlanningState === "archived"',
    );

    expect(page).not.toContain(
      'setPlanningFilter("active");\n            } else',
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

  it("manages Publishing team assignments through governed RPCs", () => {
    expect(editDrawer).toContain(
      "PublishingRelationshipsSection",
    );

    expect(relationshipsSection).toContain(
      "listPublishingAssignableUsers",
    );

    expect(relationshipsSection).toContain(
      "addPublishingItemAssignee",
    );

    expect(relationshipsSection).toContain(
      "removePublishingItemAssignee",
    );

    expect(relationshipsSection).toContain(
      'role !== "owner"',
    );

    expect(relationshipsSection).toContain(
      "onReloadLatest(item.id)",
    );
  });

  it("manages Publishing channels through governed RPCs", () => {
    expect(relationshipsSection).toContain(
      "addPublishingItemChannel",
    );

    expect(relationshipsSection).toContain(
      "removePublishingItemChannel",
    );

    expect(relationshipsSection).toContain(
      "setPublishingItemPrimaryChannel",
    );

    expect(relationshipsSection).toContain(
      "Make Primary",
    );

    expect(page).toContain(
      "channels={channels}",
    );
  });

  it("keeps relationship changes separate from the main save", () => {
    expect(relationshipsSection).toContain(
      'type="button"',
    );

    expect(relationshipsSection).not.toContain(
      "updatePublishingItem",
    );

    expect(relationshipsSection).not.toContain(
      "schedule_article_publication",
    );

    expect(relationshipsSection).not.toContain(
      "publish_article_version",
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
