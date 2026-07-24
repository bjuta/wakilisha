import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
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

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [nextItems, nextKinds, nextChannels] =
        await Promise.all([
          listPublishingWorkspaceItems({ limit: 300 }),
          listPublishingContentKinds(),
          listPublishingChannels(),
        ]);

      setItems(nextItems);
      setContentKinds(nextKinds);
      setChannels(nextChannels);

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

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

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

      return (
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
    channelFilter,
    contentKindFilter,
    items,
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

  function clearFilters() {
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
          Plan production, ownership, deadlines, and channels. Canonical editors still control review, scheduling, and publication.
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

      <WkSurface className="overflow-hidden">
        <div className="border-b border-wk-border px-4 py-3">
          <div className="flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStageFilter("all")}
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
                onClick={() => setStageFilter(stage)}
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
                  setSearchQuery(event.target.value)
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
              setPlanningFilter(
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
              setContentKindFilter(event.target.value)
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
              setChannelFilter(event.target.value)
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
              setOwnerFilter(event.target.value)
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
              render: (row) => (
                <div className="space-y-1 text-[10px] text-wk-text-muted">
                  <div>
                    Editorial: {formatChoice(row.editorialState)}
                  </div>
                  <div>
                    Publication: {formatChoice(row.publicationState)}
                  </div>
                </div>
              ),
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

            if (nextPlanningState === "archived") {
              setPlanningFilter("active");
            } else {
              setPlanningFilter(nextPlanningState);
            }

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
