import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  fetchArticlesForAdminList,
  type AdminArticleListItem,
} from "@/services/articles/articleAdminService";
import { CreatePublishingItemDrawer } from "@/pages/admin/content/publishing/components/CreatePublishingItemDrawer";
import { EditPublishingItemDrawer } from "@/pages/admin/content/publishing/components/EditPublishingItemDrawer";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  PUBLISHING_PLANNING_STATES,
  PUBLISHING_PRIORITIES,
  PUBLISHING_PRODUCTION_STAGES,
  listPublishingChannels,
  listPublishingContentKinds,
  listPublishingWorkspaceItems,
  type PublishingChannel,
  type PublishingContentKind,
  type PublishingPlanningState,
  type PublishingPriority,
  type PublishingProductionStage,
  type PublishingWorkspaceItem,
} from "@/services/publishing/publishingWorkspaceService";

type PublishingTableRow = PublishingWorkspaceItem &
  Record<string, unknown>;

type PublishingViewMode = "board" | "table";

type PublishingOperationView =
  | "custom"
  | "all_active"
  | "my_work"
  | "unassigned"
  | "due_soon"
  | "ready_handoff"
  | "needs_article_link"
  | "archived";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

function isArticlePublishingWork(
  item: PublishingWorkspaceItem,
): boolean {
  return (
    item.contentKind.toLowerCase() === "article" ||
    item.contentKindLabel.toLowerCase() === "article"
  );
}

function isDueSoonOperationItem(
  item: PublishingWorkspaceItem,
  now: number,
): boolean {
  if (
    item.planningState !== "active" ||
    item.productionStage === "ready" ||
    !item.productionDeadline
  ) {
    return false;
  }

  const deadline = new Date(item.productionDeadline).getTime();

  return (
    Number.isFinite(deadline) &&
    deadline >= now &&
    deadline <= now + SEVEN_DAYS_IN_MS
  );
}

function matchesOperationView(
  item: PublishingWorkspaceItem,
  operationView: PublishingOperationView,
  currentUserId: string | null | undefined,
  now: number,
): boolean {
  if (operationView === "custom") {
    return true;
  }

  if (operationView === "all_active") {
    return item.planningState === "active";
  }

  if (operationView === "my_work") {
    return (
      item.planningState === "active" &&
      Boolean(currentUserId) &&
      item.ownerId === currentUserId
    );
  }

  if (operationView === "unassigned") {
    return (
      item.planningState === "active" &&
      item.ownerId === null
    );
  }

  if (operationView === "due_soon") {
    return isDueSoonOperationItem(item, now);
  }

  if (operationView === "ready_handoff") {
    return (
      item.planningState === "active" &&
      item.productionStage === "ready"
    );
  }

  if (operationView === "needs_article_link") {
    return (
      item.planningState === "active" &&
      isArticlePublishingWork(item) &&
      item.resourceId === null
    );
  }

  return item.planningState === "archived";
}

function summarizePeople(item: PublishingWorkspaceItem): string {
  if (item.assignees.length === 0) {
    return "No team assigned";
  }

  return `${item.assignees.length} team member${
    item.assignees.length === 1 ? "" : "s"
  }`;
}

function summarizeChannels(item: PublishingWorkspaceItem): string {
  if (item.channels.length === 0) {
    return "No channels";
  }

  return `${item.channels.length} channel${
    item.channels.length === 1 ? "" : "s"
  }`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatChoice(value: string): string {
  return value
    .split("_")
    .map((part) =>
      part.length > 0
        ? `${part[0].toUpperCase()}${part.slice(1)}`
        : part,
    )
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : DATE_FORMATTER.format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : DATE_TIME_FORMATTER.format(date);
}

function stageTone(stage: PublishingProductionStage): string {
  if (stage === "ready") {
    return "bg-wk-success-soft text-wk-success";
  }
  if (
    stage === "production_review" ||
    stage === "revisions"
  ) {
    return "bg-wk-warning-soft text-wk-warning";
  }
  if (stage === "producing") {
    return "bg-wk-info-soft text-wk-info";
  }
  return "bg-wk-surface-raised text-wk-text-muted";
}

function priorityTone(priority: PublishingPriority): string {
  if (priority === "urgent") {
    return "bg-wk-danger-soft text-wk-danger";
  }
  if (priority === "high") {
    return "bg-wk-warning-soft text-wk-warning";
  }
  if (priority === "low") {
    return "bg-wk-surface-raised text-wk-text-muted";
  }
  return "bg-wk-info-soft text-wk-info";
}

function StatusPill({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${className}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: string;
}) {
  return (
    <WkSurface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
            {label}
          </div>
          <div className="mt-2 text-[26px] font-black text-wk-text">
            {value}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
            {helper}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand">
          <WkIcon name={icon as never} size={16} />
        </div>
      </div>
    </WkSurface>
  );
}

export default function AdminPublishingDashboardPage() {
  const adminUser = useAdminUser();
  const canManagePublishing =
    adminUser.can("manage_publishing");
  const [createOpen, setCreateOpen] = useState(false);
  const [createNotice, setCreateNotice] =
    useState<string | null>(null);
  const [selectedItem, setSelectedItem] =
    useState<PublishingWorkspaceItem | null>(null);

  const [items, setItems] = useState<
    PublishingWorkspaceItem[]
  >([]);
  const [contentKinds, setContentKinds] = useState<
    PublishingContentKind[]
  >([]);
  const [channels, setChannels] = useState<
    PublishingChannel[]
  >([]);
  const [articleOptions, setArticleOptions] = useState<
    AdminArticleListItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(
    null,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<
    PublishingProductionStage | "all"
  >("all");
  const [planningFilter, setPlanningFilter] = useState<
    PublishingPlanningState | "all"
  >("active");
  const [contentKindFilter, setContentKindFilter] =
    useState("all");
  const [priorityFilter, setPriorityFilter] = useState<
    PublishingPriority | "all"
  >("all");
  const [channelFilter, setChannelFilter] =
    useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [operationView, setOperationView] =
    useState<PublishingOperationView>("custom");
  const [viewMode, setViewMode] =
    useState<PublishingViewMode>("board");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [
        nextItems,
        nextKinds,
        nextChannels,
        nextArticles,
      ] = await Promise.all([
        listPublishingWorkspaceItems({ limit: 300 }),
        listPublishingContentKinds(),
        listPublishingChannels(),
        fetchArticlesForAdminList(500),
      ]);

      setItems(nextItems);
      setContentKinds(nextKinds);
      setChannels(nextChannels);
      setArticleOptions(nextArticles);

      return nextItems;
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not load Publishing.",
      );

      return [] as PublishingWorkspaceItem[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const ownerOptions = useMemo(() => {
    const ownerMap = new Map<string, string>();

    items.forEach((item) => {
      if (item.ownerId) {
        ownerMap.set(
          item.ownerId,
          item.ownerLabel ?? item.ownerId,
        );
      }
    });

    return Array.from(ownerMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const stageCountItems = useMemo(
    () =>
      items.filter(
        (item) =>
          planningFilter === "all" ||
          item.planningState === planningFilter,
      ),
    [items, planningFilter],
  );

  const stageCounts = useMemo(
    () =>
      PUBLISHING_PRODUCTION_STAGES.reduce(
        (counts, stage) => {
          counts[stage] = stageCountItems.filter(
            (item) => item.productionStage === stage,
          ).length;
          return counts;
        },
        {} as Record<PublishingProductionStage, number>,
      ),
    [stageCountItems],
  );

  const summary = useMemo(() => {
    const now = Date.now();
    const sevenDaysFromNow =
      now + 7 * 24 * 60 * 60 * 1000;

    const activeItems = items.filter(
      (item) => item.planningState === "active",
    );

    return {
      active: activeItems.length,
      producing: activeItems.filter(
        (item) => item.productionStage === "producing",
      ).length,
      ready: activeItems.filter(
        (item) => item.productionStage === "ready",
      ).length,
      dueSoon: activeItems.filter((item) => {
        if (
          !item.productionDeadline ||
          item.productionStage === "ready"
        ) {
          return false;
        }

        const deadline = new Date(
          item.productionDeadline,
        ).getTime();

        return (
          Number.isFinite(deadline) &&
          deadline >= now &&
          deadline <= sevenDaysFromNow
        );
      }).length,
    };
  }, [items]);

  const planningCounts = useMemo(
    () =>
      PUBLISHING_PLANNING_STATES.reduce(
        (counts, state) => {
          counts[state] = items.filter(
            (item) => item.planningState === state,
          ).length;
          return counts;
        },
        {} as Record<PublishingPlanningState, number>,
      ),
    [items],
  );

  const linkedResourceIds = useMemo(
    () =>
      new Set(
        items
          .map((item) => item.resourceId)
          .filter(
            (resourceId): resourceId is string =>
              resourceId !== null,
          ),
      ),
    [items],
  );

  const linkedArticleByResourceId = useMemo(() => {
    const articleMap = new Map<
      string,
      AdminArticleListItem
    >();

    articleOptions.forEach((article) => {
      if (article.resourceId) {
        articleMap.set(article.resourceId, article);
      }
    });

    return articleMap;
  }, [articleOptions]);

  const operationViewOptions = useMemo<
    Array<{
      key: Exclude<PublishingOperationView, "custom">;
      label: string;
      count: number;
      helper: string;
    }>
  >(() => {
    const now = Date.now();

    return [
      {
        key: "all_active",
        label: "Active Ops",
        count: items.filter((item) =>
          matchesOperationView(
            item,
            "all_active",
            adminUser.id,
            now,
          ),
        ).length,
        helper: "Work still moving across production.",
      },
      {
        key: "my_work",
        label: "My Work",
        count: items.filter((item) =>
          matchesOperationView(item, "my_work", adminUser.id, now),
        ).length,
        helper: "Active work owned by you.",
      },
      {
        key: "unassigned",
        label: "Unassigned",
        count: items.filter((item) =>
          matchesOperationView(
            item,
            "unassigned",
            adminUser.id,
            now,
          ),
        ).length,
        helper: "Active work without an owner.",
      },
      {
        key: "due_soon",
        label: "Due Soon",
        count: items.filter((item) =>
          matchesOperationView(
            item,
            "due_soon",
            adminUser.id,
            now,
          ),
        ).length,
        helper: "Active production deadlines within seven days.",
      },
      {
        key: "ready_handoff",
        label: "Ready Handoff",
        count: items.filter((item) =>
          matchesOperationView(
            item,
            "ready_handoff",
            adminUser.id,
            now,
          ),
        ).length,
        helper: "Production-ready work for canonical editors.",
      },
      {
        key: "needs_article_link",
        label: "Needs Article Link",
        count: items.filter((item) =>
          matchesOperationView(
            item,
            "needs_article_link",
            adminUser.id,
            now,
          ),
        ).length,
        helper: "Article work without a canonical link.",
      },
      {
        key: "archived",
        label: "Archived",
        count: items.filter((item) =>
          matchesOperationView(item, "archived", adminUser.id, now),
        ).length,
        helper: "Closed work kept for operational memory.",
      },
    ];
  }, [adminUser.id, items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    return items.filter((item) => {
      const matchesSearch =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        Boolean(item.brief?.toLowerCase().includes(query));
      const matchesStage =
        stageFilter === "all" ||
        item.productionStage === stageFilter;
      const matchesPlanning =
        planningFilter === "all" ||
        item.planningState === planningFilter;
      const matchesKind =
        contentKindFilter === "all" ||
        item.contentKind === contentKindFilter;
      const matchesPriority =
        priorityFilter === "all" ||
        item.priority === priorityFilter;
      const matchesChannel =
        channelFilter === "all" ||
        item.channels.some(
          (channel) => channel.key === channelFilter,
        );
      const matchesOwner =
        ownerFilter === "all" ||
        item.ownerId === ownerFilter;
      const matchesOperation = matchesOperationView(
        item,
        operationView,
        adminUser.id,
        now,
      );

      return (
        matchesOperation &&
        matchesSearch &&
        matchesStage &&
        matchesPlanning &&
        matchesKind &&
        matchesPriority &&
        matchesChannel &&
        matchesOwner
      );
    });
  }, [
    adminUser.id,
    channelFilter,
    contentKindFilter,
    items,
    operationView,
    ownerFilter,
    planningFilter,
    priorityFilter,
    searchQuery,
    stageFilter,
  ]);

  function openCreateDrawer() {
    setCreateNotice(null);
    setSelectedItem(null);
    setCreateOpen(true);
  }

  function openEditDrawer(
    item: PublishingWorkspaceItem,
  ) {
    if (!canManagePublishing) return;

    setCreateNotice(null);
    setCreateOpen(false);
    setSelectedItem(item);
  }

  function changePlanningFilter(
    nextPlanningFilter: PublishingPlanningState | "all",
  ) {
    setOperationView("custom");
    setPlanningFilter(nextPlanningFilter);
    setStageFilter("all");
  }

  function setCustomSearchQuery(value: string) {
    setOperationView("custom");
    setSearchQuery(value);
  }

  function setCustomStageFilter(
    value: PublishingProductionStage | "all",
  ) {
    setOperationView("custom");
    setStageFilter(value);
  }

  function setCustomPlanningFilter(
    value: PublishingPlanningState | "all",
  ) {
    setOperationView("custom");
    setPlanningFilter(value);
  }

  function setCustomContentKindFilter(value: string) {
    setOperationView("custom");
    setContentKindFilter(value);
  }

  function setCustomPriorityFilter(
    value: PublishingPriority | "all",
  ) {
    setOperationView("custom");
    setPriorityFilter(value);
  }

  function setCustomChannelFilter(value: string) {
    setOperationView("custom");
    setChannelFilter(value);
  }

  function setCustomOwnerFilter(value: string) {
    setOperationView("custom");
    setOwnerFilter(value);
  }

  function clearFilters() {
    setOperationView("custom");
    setSearchQuery("");
    setStageFilter("all");
    setPlanningFilter("active");
    setContentKindFilter("all");
    setPriorityFilter("all");
    setChannelFilter("all");
    setOwnerFilter("all");
  }

  const tableRows = filteredItems as PublishingTableRow[];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-brand">
          Editorial Operations
        </div>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-wk-text">
          Publishing
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">
          Use this as the editorial operations board for work moving across teams and channels. Canonical editors still control review, scheduling, and publication.
        </p>
        </div>

        {canManagePublishing ? (
          <button
            type="button"
            onClick={openCreateDrawer}
            disabled={
              loading ||
              contentKinds.length === 0
            }
            className="wk-button wk-button-primary wk-button-sm shrink-0 justify-center disabled:opacity-50"
          >
            <WkIcon name="PlusCircle" size={14} />
            Create Publishing Item
          </button>
        ) : null}
      </div>

      {createNotice ? (
        <WkSurface className="border-wk-success/30 bg-wk-success-soft p-3">
          <div className="flex items-center gap-2">
            <WkIcon
              name="CheckCircle"
              size={15}
              className="text-wk-success"
            />
            <p className="text-[12px] font-semibold text-wk-success">
              {createNotice}
            </p>
          </div>
        </WkSurface>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active"
          value={summary.active}
          helper="Items still moving through production."
          icon="FileEdit"
        />
        <SummaryCard
          label="Producing"
          value={summary.producing}
          helper="Work currently being made."
          icon="Pencil"
        />
        <SummaryCard
          label="Ready"
          value={summary.ready}
          helper="Production work marked ready."
          icon="Globe"
        />
        <SummaryCard
          label="Due Soon"
          value={summary.dueSoon}
          helper="Active deadlines within seven days."
          icon="Clock"
        />
      </div>

      {loadError ? (
        <WkSurface className="border-wk-danger/30 bg-wk-danger-soft p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[12px] font-black text-wk-danger">
                Publishing did not load
              </div>
              <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                {loadError}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              className="wk-button wk-button-secondary wk-button-sm"
            >
              Retry
            </button>
          </div>
        </WkSurface>
      ) : null}

      <WkSurface className="border-wk-border bg-wk-surface">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-brand">
              Operations Board
            </p>
            <h2 className="mt-1 text-[18px] font-black text-wk-text">
              Coordinate work, do not publish from here
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
              Use this board to move work across owners, teams,
              channels, deadlines, and production stages. Canonical
              editors still control review, scheduling, and
              publication.
            </p>
          </div>

          <div className="flex shrink-0 rounded-xl border border-wk-border bg-wk-surface-raised p-1">
            {(["board", "table"] as PublishingViewMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-black ${
                    viewMode === mode
                      ? "bg-wk-brand text-white"
                      : "text-wk-text-muted hover:bg-wk-surface"
                  }`}
                >
                  {mode === "board" ? "Board View" : "Table View"}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="grid gap-2 border-t border-wk-border p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {operationViewOptions.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => applyOperationView(view.key)}
              className={`rounded-2xl border p-3 text-left transition ${
                operationView === view.key
                  ? "border-wk-brand bg-wk-brand-soft"
                  : "border-wk-border bg-wk-surface hover:border-wk-brand/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black text-wk-text">
                  {view.label}
                </span>
                <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-black text-wk-text">
                  {view.count}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-wk-text-muted">
                {view.helper}
              </p>
            </button>
          ))}
        </div>
      </WkSurface>

      <WkSurface className="overflow-hidden">
        <div className="border-b border-wk-border px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                Planning View
              </div>
              <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">
                Switch to Archived when you need closed or restored work.
              </p>
            </div>

            <div className="flex gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => changePlanningFilter("all")}
                className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ${
                  planningFilter === "all"
                    ? "bg-wk-brand text-wk-brand-on"
                    : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                }`}
              >
                All Work {items.length}
              </button>

              {PUBLISHING_PLANNING_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => changePlanningFilter(state)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ${
                    planningFilter === state
                      ? "bg-wk-brand text-wk-brand-on"
                      : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                  }`}
                >
                  {formatChoice(state)} {planningCounts[state]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-wk-border px-4 py-3">
          <div className="flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCustomStageFilter("all")}
              className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ${
                stageFilter === "all"
                  ? "bg-wk-brand text-wk-brand-on"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`}
            >
              All Stages {stageCountItems.length}
            </button>

            {PUBLISHING_PRODUCTION_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setCustomStageFilter(stage)}
                className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ${
                  stageFilter === stage
                    ? "bg-wk-brand text-wk-brand-on"
                    : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                }`}
              >
                {formatChoice(stage)} {stageCounts[stage]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="sr-only">Search Publishing</span>
            <div className="flex items-center gap-2 rounded-xl border border-wk-border bg-wk-surface px-3 py-2">
              <WkIcon
                name="Search"
                size={14}
                className="text-wk-text-faint"
              />
              <input
                value={searchQuery}
                onChange={(event) =>
                  setCustomSearchQuery(event.target.value)
                }
                placeholder="Search title or brief"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint"
              />
            </div>
          </label>

          <select
            aria-label="Planning state"
            value={planningFilter}
            onChange={(event) =>
              changePlanningFilter(
                event.target.value as
                  | PublishingPlanningState
                  | "all",
              )
            }
            className="rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none"
          >
            <option value="all">All Planning States</option>
            {PUBLISHING_PLANNING_STATES.map((state) => (
              <option key={state} value={state}>
                {formatChoice(state)}
              </option>
            ))}
          </select>

          <select
            aria-label="Content type"
            value={contentKindFilter}
            onChange={(event) =>
              setCustomContentKindFilter(event.target.value)
            }
            className="rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none"
          >
            <option value="all">All Content Types</option>
            {contentKinds.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Priority"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value as
                  | PublishingPriority
                  | "all",
              )
            }
            className="rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none"
          >
            <option value="all">All Priorities</option>
            {PUBLISHING_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {formatChoice(priority)}
              </option>
            ))}
          </select>

          <select
            aria-label="Channel"
            value={channelFilter}
            onChange={(event) =>
              setCustomChannelFilter(event.target.value)
            }
            className="rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none"
          >
            <option value="all">All Channels</option>
            {channels.map((channel) => (
              <option key={channel.key} value={channel.key}>
                {channel.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Owner"
            value={ownerFilter}
            onChange={(event) =>
              setCustomOwnerFilter(event.target.value)
            }
            className="rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none xl:col-start-5"
          >
            <option value="all">All Owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="wk-button wk-button-secondary wk-button-sm justify-center"
          >
            Clear Filters
          </button>
        </div>
      </WkSurface>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4"
            >
              <div className="h-4 w-56 rounded bg-wk-surface-raised" />
              <div className="mt-2 h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      ) : items.length === 0 && !loadError ? (
        <WkSurface className="px-5 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wk-brand-soft text-wk-brand">
            <WkIcon name="Globe" size={20} />
          </div>
          <h2 className="mt-4 text-[18px] font-black text-wk-text">
            No Publishing items yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[12px] leading-5 text-wk-text-muted">
            Add work deliberately when it enters production. Existing content will not appear here automatically.
          </p>
          {canManagePublishing ? (
            <button
              type="button"
              onClick={openCreateDrawer}
              disabled={contentKinds.length === 0}
              className="wk-button wk-button-primary wk-button-sm mt-5 justify-center disabled:opacity-50"
            >
              <WkIcon name="PlusCircle" size={14} />
              Create Publishing Item
            </button>
          ) : null}
        </WkSurface>
      ) : filteredItems.length === 0 ? (
        <WkSurface className="px-5 py-10 text-center">
          <h2 className="text-[16px] font-black text-wk-text">
            No items match these filters
          </h2>
          <p className="mt-2 text-[12px] text-wk-text-muted">
            Clear the filters and review the full workspace.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="wk-button wk-button-secondary wk-button-sm mt-4"
          >
            Clear Filters
          </button>
        </WkSurface>
      ) : viewMode === "board" ? (
        <div className="grid gap-3 p-4 xl:grid-cols-5">
          {PUBLISHING_PRODUCTION_STAGES.map((stage) => {
            const stageItems = filteredItems.filter(
              (item) => item.productionStage === stage,
            );

            return (
              <section
                key={stage}
                className="flex min-h-[220px] flex-col rounded-2xl border border-wk-border bg-wk-surface-raised p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-wk-text-muted">
                    {formatChoice(stage)}
                  </h3>
                  <span className="rounded-full bg-wk-surface px-2 py-0.5 text-[10px] font-black text-wk-text-muted">
                    {stageItems.length}
                  </span>
                </div>

                {stageItems.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-wk-border bg-wk-surface px-3 py-6 text-center text-[11px] text-wk-text-muted">
                    No work in this stage.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stageItems.map((item) => {
                      const linkedArticle = item.resourceId
                        ? linkedArticleByResourceId.get(item.resourceId)
                        : null;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openEditDrawer(item)}
                          disabled={!canManagePublishing}
                          className="w-full rounded-xl border border-wk-border bg-wk-surface p-3 text-left shadow-sm transition hover:border-wk-brand/40 hover:bg-wk-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="text-[12px] font-black leading-4 text-wk-text">
                            {item.title}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <StatusPill
                              label={formatChoice(item.priority)}
                              className={priorityTone(item.priority)}
                            />
                            <span className="rounded-full bg-wk-surface-raised px-2 py-1 text-[10px] font-bold text-wk-text-muted">
                              {item.ownerLabel || "Unassigned"}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1 text-[10px] leading-4 text-wk-text-muted">
                            <div>{summarizePeople(item)}</div>
                            <div>{summarizeChannels(item)}</div>
                            <div>
                              Deadline:{" "}
                              {formatDate(item.productionDeadline)}
                            </div>
                            <div className="line-clamp-1 text-wk-text">
                              Article:{" "}
                              {item.resourceId
                                ? linkedArticle?.title ?? "Linked"
                                : "Not Linked"}
                            </div>
                            <div>
                              Authority:{" "}
                              {formatChoice(item.editorialState)} /{" "}
                              {formatChoice(item.publicationState)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "title",
              label: "Work",
              render: (row) => (
                <div className="min-w-[240px]">
                  <div className="text-[13px] font-bold text-wk-text">
                    {row.title}
                  </div>
                  <div className="mt-1 line-clamp-1 text-[11px] text-wk-text-muted">
                    {row.brief || "No brief yet."}
                  </div>
                  <div className="mt-1 text-[10px] text-wk-text-faint">
                    Updated {formatDateTime(row.updatedAt)}
                  </div>
                </div>
              ),
            },
            {
              key: "productionStage",
              label: "Production",
              width: "140px",
              render: (row) => (
                <StatusPill
                  label={formatChoice(row.productionStage)}
                  className={stageTone(row.productionStage)}
                />
              ),
            },
            {
              key: "contentKindLabel",
              label: "Type",
              width: "130px",
              render: (row) => (
                <span className="text-[12px] font-semibold text-wk-text-muted">
                  {row.contentKindLabel}
                </span>
              ),
            },
            {
              key: "ownerLabel",
              label: "Owner",
              width: "150px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.ownerLabel || "Unassigned"}
                </span>
              ),
            },
            {
              key: "priority",
              label: "Priority",
              width: "110px",
              render: (row) => (
                <StatusPill
                  label={formatChoice(row.priority)}
                  className={priorityTone(row.priority)}
                />
              ),
            },
            {
              key: "productionDeadline",
              label: "Deadline",
              width: "130px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {formatDate(row.productionDeadline)}
                </span>
              ),
            },
            {
              key: "editorialState",
              label: "Authority",
              width: "170px",
              render: (row) => {
                const linkedArticle = row.resourceId
                  ? linkedArticleByResourceId.get(row.resourceId)
                  : null;

                return (
                  <div className="space-y-1 text-[10px] text-wk-text-muted">
                    <div>
                      Editorial: {formatChoice(row.editorialState)}
                    </div>
                    <div>
                      Publication: {formatChoice(row.publicationState)}
                    </div>
                    <div
                      className="line-clamp-1 text-wk-text"
                      title={linkedArticle?.title ?? undefined}
                    >
                      Article:{" "}
                      {row.resourceId
                        ? linkedArticle?.title ?? "Linked"
                        : "Not Linked"}
                    </div>
                  </div>
                );
              },
            },
          ]}
          onRowClick={
            canManagePublishing
              ? (row) => openEditDrawer(row)
              : undefined
          }
          rows={tableRows}
          keyField="id"
          emptyMessage="No Publishing items found."
        />
      )}

      {createOpen && canManagePublishing ? (
        <CreatePublishingItemDrawer
          contentKinds={contentKinds}
          currentUserId={adminUser.id}
          currentUserName={adminUser.name}
          linkedResourceIds={linkedResourceIds}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            setCreateNotice(
              "We added this work to Publishing.",
            );
            setStageFilter("all");
            setPlanningFilter("active");
            await loadWorkspace();
          }}
        />
      ) : null}

      {selectedItem && canManagePublishing ? (
        <EditPublishingItemDrawer
          item={selectedItem}
          contentKinds={contentKinds}
          channels={channels}
          currentUserId={adminUser.id}
          currentUserName={adminUser.name}
          onClose={() => setSelectedItem(null)}
          onSaved={async (
            notice,
            nextPlanningState,
          ) => {
            setSelectedItem(null);
            setCreateNotice(notice);

            setStageFilter("all");
            setPlanningFilter(nextPlanningState);

            await loadWorkspace();
          }}
          onReloadLatest={async (itemId) => {
            const nextItems =
              await loadWorkspace();

            const latest =
              nextItems.find(
                (candidate) =>
                  candidate.id === itemId,
              ) ?? null;

            setSelectedItem(latest);
          }}
        />
      ) : null}
    </div>
  );
}
