import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  fetchArticlesForAdminList,
  type AdminArticleListItem,
} from "@/services/articles/articleAdminService";
import { ArchivePublishingItemDialog } from "@/pages/admin/content/publishing/components/ArchivePublishingItemDialog";
import { PublishingOperationalHistorySection } from "@/pages/admin/content/publishing/components/PublishingOperationalHistorySection";
import { PublishingRelationshipsSection } from "@/pages/admin/content/publishing/components/PublishingRelationshipsSection";
import {
  PUBLISHING_PLANNING_STATES,
  PUBLISHING_PRIORITIES,
  PUBLISHING_PRODUCTION_STAGES,
  linkPublishingItemResource,
  updatePublishingItem,
  type PublishingChannel,
  type PublishingContentKind,
  type PublishingPlanningState,
  type PublishingPriority,
  type PublishingProductionStage,
  type PublishingWorkspaceItem,
} from "@/services/publishing/publishingWorkspaceService";

interface EditPublishingItemDrawerProps {
  item: PublishingWorkspaceItem;
  contentKinds: PublishingContentKind[];
  channels: PublishingChannel[];
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onSaved: (
    notice: string,
    planningState: PublishingPlanningState,
  ) => Promise<void>;
  onReloadLatest: (itemId: string) => Promise<void>;
}

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

function toIsoOrNull(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function normalizeIso(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) =>
    String(part).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function EditPublishingItemDrawer({
  item,
  contentKinds,
  channels,
  currentUserId,
  currentUserName,
  onClose,
  onSaved,
  onReloadLatest,
}: EditPublishingItemDrawerProps) {
  const [title, setTitle] = useState(item.title);
  const [contentKind, setContentKind] =
    useState(item.contentKind);
  const [brief, setBrief] =
    useState(item.brief ?? "");
  const [productionStage, setProductionStage] =
    useState<PublishingProductionStage>(
      item.productionStage,
    );
  const [planningState, setPlanningState] =
    useState<PublishingPlanningState>(
      item.planningState,
    );
  const [priority, setPriority] =
    useState<PublishingPriority>(item.priority);
  const [ownerId, setOwnerId] =
    useState(item.ownerId ?? "");
  const [productionDeadline, setProductionDeadline] =
    useState(
      toDateTimeLocal(item.productionDeadline),
    );
  const [plannedPublishAt, setPlannedPublishAt] =
    useState(
      toDateTimeLocal(item.plannedPublishAt),
    );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [relationshipBusy, setRelationshipBusy] =
    useState(false);
  const [archiveOpen, setArchiveOpen] =
    useState(false);
  const [articleOptions, setArticleOptions] =
    useState<AdminArticleListItem[]>([]);
  const [articleSearchQuery, setArticleSearchQuery] =
    useState("");
  const [articlesLoading, setArticlesLoading] =
    useState(false);
  const [articleLoadError, setArticleLoadError] =
    useState<string | null>(null);
  const [articleLinking, setArticleLinking] =
    useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  const selectedContentKind =
    contentKinds.find(
      (kind) => kind.key === contentKind,
    ) ?? null;

  const currentKindAvailable = contentKinds.some(
    (kind) => kind.key === item.contentKind,
  );

  const canLinkCanonicalArticle =
    selectedContentKind?.canonicalResourceKind === "article";

  const linkedArticle = useMemo(
    () =>
      item.resourceId
        ? articleOptions.find(
            (articleOption) =>
              articleOption.resourceId === item.resourceId,
          ) ?? null
        : null,
    [articleOptions, item.resourceId],
  );

  const articleSearchResults = useMemo(() => {
    const query = articleSearchQuery.trim().toLowerCase();

    if (!canLinkCanonicalArticle || query.length === 0) {
      return articleOptions.slice(0, 6);
    }

    return articleOptions
      .filter((articleOption) => {
        return (
          articleOption.title.toLowerCase().includes(query) ||
          articleOption.slug.toLowerCase().includes(query) ||
          articleOption.author.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [
    articleOptions,
    articleSearchQuery,
    canLinkCanonicalArticle,
  ]);

  useEffect(() => {
    setTitle(item.title);
    setContentKind(item.contentKind);
    setBrief(item.brief ?? "");
    setProductionStage(item.productionStage);
    setPlanningState(item.planningState);
    setPriority(item.priority);
    setOwnerId(item.ownerId ?? "");
    setProductionDeadline(
      toDateTimeLocal(item.productionDeadline),
    );
    setPlannedPublishAt(
      toDateTimeLocal(item.plannedPublishAt),
    );
    setNote("");
    setArticleSearchQuery("");
    setArticleLoadError(null);
  }, [item]);

  useEffect(() => {
    let cancelled = false;

    if (!canLinkCanonicalArticle) {
      setArticleOptions([]);
      setArticleLoadError(null);
      setArticlesLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setArticlesLoading(true);
    setArticleLoadError(null);

    fetchArticlesForAdminList(500)
      .then((articles) => {
        if (!cancelled) {
          setArticleOptions(articles);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setArticleLoadError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load Articles.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setArticlesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canLinkCanonicalArticle]);

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !saving &&
        !archiving &&
        !relationshipBusy &&
        !articleLinking &&
        !archiveOpen
      ) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    archiveOpen,
    archiving,
    articleLinking,
    onClose,
    relationshipBusy,
    saving,
  ]);

  const hasChanges = useMemo(() => {
    return (
      title.trim() !== item.title ||
      contentKind !== item.contentKind ||
      (ownerId || null) !== item.ownerId ||
      (brief.trim() || null) !== item.brief ||
      productionStage !== item.productionStage ||
      planningState !== item.planningState ||
      priority !== item.priority ||
      toIsoOrNull(productionDeadline) !==
        normalizeIso(item.productionDeadline) ||
      toIsoOrNull(plannedPublishAt) !==
        normalizeIso(item.plannedPublishAt)
    );
  }, [
    brief,
    contentKind,
    item,
    ownerId,
    plannedPublishAt,
    planningState,
    priority,
    productionDeadline,
    productionStage,
    title,
  ]);

  async function handleStale(
    message: string,
  ) {
    await onReloadLatest(item.id);
    setError(
      `${message} The latest values are now loaded.`,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanTitle = title.trim();

    if (cleanTitle.length < 2) {
      setError(
        "Enter a title with at least two characters.",
      );
      return;
    }

    if (!contentKind) {
      setError("Choose a content type.");
      return;
    }

    if (
      planningState === "archived" &&
      item.planningState !== "archived"
    ) {
      setError(
        "Use Archive Item and record an archive note.",
      );
      return;
    }

    if (!hasChanges) {
      setError(
        "Change at least one field before saving.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await updatePublishingItem({
        itemId: item.id,
        expectedRecordVersion:
          item.recordVersion,
        title: cleanTitle,
        contentKind,
        ownerId: ownerId || null,
        brief: brief.trim() || null,
        productionStage,
        planningState,
        priority,
        productionDeadline:
          toIsoOrNull(productionDeadline),
        plannedPublishAt:
          toIsoOrNull(plannedPublishAt),
        note: note.trim() || null,
      });

      if (!result.ok) {
        if (
          result.errorCode === "stale_update"
        ) {
          await handleStale(
            result.error ??
              "Someone changed this Publishing item.",
          );
        } else {
          setError(
            result.error ??
              "We could not update this Publishing item.",
          );
        }

        setSaving(false);
        return;
      }

      await onSaved(
        "Publishing item updated.",
        planningState,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not update this Publishing item.",
      );
      setSaving(false);
    }
  }

  async function handleLinkArticle(
    article: AdminArticleListItem,
  ) {
    if (!article.resourceId) {
      setError("This Article is missing its canonical resource.");
      return;
    }

    if (article.resourceId === item.resourceId) {
      return;
    }

    setArticleLinking(true);
    setError(null);

    try {
      const result = await linkPublishingItemResource({
        itemId: item.id,
        expectedRecordVersion: item.recordVersion,
        resourceId: article.resourceId,
        note: `Linked to Article: ${article.title}`,
      });

      if (!result.ok) {
        if (result.errorCode === "stale_update") {
          await handleStale(
            result.error ??
              "Someone changed this Publishing item.",
          );
        } else {
          setError(
            result.error ??
              "We could not link this Article.",
          );
        }

        setArticleLinking(false);
        return;
      }

      await onReloadLatest(item.id);
      setArticleSearchQuery("");
      setArticleLinking(false);
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "We could not link this Article.",
      );
      setArticleLinking(false);
    }
  }

  async function handleArchive(
    archiveNote: string,
  ) {
    setArchiving(true);
    setError(null);

    try {
      const result = await updatePublishingItem({
        itemId: item.id,
        expectedRecordVersion:
          item.recordVersion,
        title: item.title,
        contentKind: item.contentKind,
        ownerId: item.ownerId,
        brief: item.brief,
        productionStage:
          item.productionStage,
        planningState: "archived",
        priority: item.priority,
        productionDeadline:
          item.productionDeadline,
        plannedPublishAt:
          item.plannedPublishAt,
        note: archiveNote,
      });

      if (!result.ok) {
        if (
          result.errorCode === "stale_update"
        ) {
          setArchiveOpen(false);

          await handleStale(
            result.error ??
              "Someone changed this Publishing item.",
          );
        } else {
          setError(
            result.error ??
              "We could not archive this Publishing item.",
          );
        }

        setArchiving(false);
        return;
      }

      await onSaved(
        "Publishing item archived.",
        "archived",
      );
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "We could not archive this Publishing item.",
      );
      setArchiving(false);
    }
  }

  const busy =
    saving || archiving || relationshipBusy || articleLinking;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-publishing-title"
      >
        <button
          type="button"
          aria-label="Close Edit Publishing Item"
          onClick={onClose}
          disabled={busy}
          className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm disabled:cursor-wait"
        />

        <aside className="relative ml-auto flex h-full max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
                Editorial Operations
              </div>
              <h2
                id="edit-publishing-title"
                className="mt-1 text-[18px] font-black text-wk-text"
              >
                Edit Publishing Item
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                Update production planning without changing canonical editorial or publication authority.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-wk-border text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-50"
            >
              <WkIcon name="X" size={15} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
              {error ? (
                <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft p-3">
                  <div className="flex items-start gap-2">
                    <WkIcon
                      name="AlertTriangle"
                      size={16}
                      className="mt-0.5 shrink-0 text-wk-danger"
                    />
                    <p className="text-[12px] leading-5 text-wk-danger">
                      {error}
                    </p>
                  </div>
                </div>
              ) : null}

              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Title
                </span>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setError(null);
                  }}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Content Type
                </span>
                <select
                  value={contentKind}
                  onChange={(event) => {
                    setContentKind(event.target.value);
                    setError(null);
                  }}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                >
                  {!currentKindAvailable ? (
                    <option value={item.contentKind}>
                      {item.contentKindLabel}
                    </option>
                  ) : null}

                  {contentKinds.map((kind) => (
                    <option
                      key={kind.key}
                      value={kind.key}
                    >
                      {kind.label}
                    </option>
                  ))}
                </select>

                {selectedContentKind?.description ? (
                  <p className="mt-1.5 text-[11px] leading-4 text-wk-text-muted">
                    {selectedContentKind.description}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Brief
                </span>
                <textarea
                  value={brief}
                  onChange={(event) =>
                    setBrief(event.target.value)
                  }
                  disabled={busy}
                  rows={4}
                  placeholder="Describe what needs to be made"
                  className="mt-2 w-full resize-y rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] leading-5 text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-bold text-wk-text">
                    Production Stage
                  </span>
                  <select
                    value={productionStage}
                    onChange={(event) =>
                      setProductionStage(
                        event.target
                          .value as PublishingProductionStage,
                      )
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  >
                    {PUBLISHING_PRODUCTION_STAGES.map(
                      (stage) => (
                        <option
                          key={stage}
                          value={stage}
                        >
                          {formatChoice(stage)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[12px] font-bold text-wk-text">
                    Planning State
                  </span>
                  <select
                    value={planningState}
                    onChange={(event) =>
                      setPlanningState(
                        event.target
                          .value as PublishingPlanningState,
                      )
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  >
                    {PUBLISHING_PLANNING_STATES
                      .filter(
                        (state) =>
                          item.planningState ===
                            "archived" ||
                          state !== "archived",
                      )
                      .map((state) => (
                        <option
                          key={state}
                          value={state}
                        >
                          {formatChoice(state)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-bold text-wk-text">
                    Priority
                  </span>
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(
                        event.target
                          .value as PublishingPriority,
                      )
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  >
                    {PUBLISHING_PRIORITIES.map(
                      (priorityOption) => (
                        <option
                          key={priorityOption}
                          value={priorityOption}
                        >
                          {formatChoice(priorityOption)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[12px] font-bold text-wk-text">
                    Owner
                  </span>
                  <select
                    value={ownerId}
                    onChange={(event) =>
                      setOwnerId(event.target.value)
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  >
                    {item.ownerId &&
                    item.ownerId !== currentUserId ? (
                      <option value={item.ownerId}>
                        {item.ownerLabel ||
                          "Current Owner"}
                      </option>
                    ) : null}

                    <option value={currentUserId}>
                      Assign To Me ({currentUserName})
                    </option>
                    <option value="">
                      Leave Unassigned
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-bold text-wk-text">
                    Production Deadline
                  </span>
                  <input
                    type="datetime-local"
                    value={productionDeadline}
                    onChange={(event) =>
                      setProductionDeadline(
                        event.target.value,
                      )
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  />
                </label>

                <label className="block">
                  <span className="text-[12px] font-bold text-wk-text">
                    Planned Publish Time
                  </span>
                  <input
                    type="datetime-local"
                    value={plannedPublishAt}
                    onChange={(event) =>
                      setPlannedPublishAt(
                        event.target.value,
                      )
                    }
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  />
                </label>
              </div>

              <p className="text-[11px] leading-4 text-wk-text-muted">
                Planned timing does not schedule or publish canonical content.
              </p>

              <PublishingRelationshipsSection
                item={item}
                channels={channels}
                disabled={busy}
                onBusyChange={setRelationshipBusy}
                onReloadLatest={onReloadLatest}
              />

              <PublishingOperationalHistorySection
                item={item}
              />

              <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                  Canonical Authority
                </div>
                <div className="mt-2 grid gap-2 text-[11px] text-wk-text-muted sm:grid-cols-2">
                  <div>
                    Editorial:{" "}
                    {formatChoice(item.editorialState)}
                  </div>
                  <div>
                    Publication:{" "}
                    {formatChoice(
                      item.publicationState,
                    )}
                  </div>
                </div>

                {canLinkCanonicalArticle ? (
                  <div className="mt-3 rounded-lg border border-wk-border bg-wk-surface p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-[11px] font-black text-wk-text">
                          Linked Article
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                          {item.resourceId
                            ? linkedArticle
                              ? `Linked to ${linkedArticle.title}.`
                              : "An Article is linked to this work."
                            : "No Article is linked yet."}
                        </p>
                      </div>
                    </div>

                    <label className="mt-3 block">
                      <span className="sr-only">
                        Search Articles
                      </span>
                      <input
                        value={articleSearchQuery}
                        onChange={(event) =>
                          setArticleSearchQuery(
                            event.target.value,
                          )
                        }
                        disabled={busy}
                        placeholder="Search Articles by title, slug, or author"
                        className="w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
                      />
                    </label>

                    <div className="mt-3 space-y-2">
                      {articlesLoading ? (
                        <div className="text-[11px] text-wk-text-muted">
                          Loading Articles...
                        </div>
                      ) : articleLoadError ? (
                        <div className="text-[11px] text-wk-danger">
                          {articleLoadError}
                        </div>
                      ) : articleSearchResults.length === 0 ? (
                        <div className="text-[11px] text-wk-text-muted">
                          No Articles match this search.
                        </div>
                      ) : (
                        articleSearchResults.map(
                          (articleOption) => {
                            const alreadyLinked =
                              articleOption.resourceId !== null &&
                              articleOption.resourceId === item.resourceId;

                            return (
                              <button
                                key={articleOption.id}
                                type="button"
                                onClick={() =>
                                  handleLinkArticle(
                                    articleOption,
                                  )
                                }
                                disabled={
                                  busy ||
                                  alreadyLinked ||
                                  !articleOption.resourceId
                                }
                                className="flex w-full items-start justify-between gap-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-left hover:border-wk-brand/40 hover:bg-wk-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-[12px] font-bold text-wk-text">
                                    {articleOption.title}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-wk-text-muted">
                                    {articleOption.slug} · {articleOption.author}
                                  </span>
                                </span>
                                <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.1em] text-wk-brand">
                                  {alreadyLinked
                                    ? "Linked"
                                    : !articleOption.resourceId
                                      ? "No Resource"
                                      : articleLinking
                                        ? "Linking"
                                        : "Link Article"}
                                </span>
                              </button>
                            );
                          },
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                <p className="mt-2 text-[10px] leading-4 text-wk-text-faint">
                  These states are read-only here and remain controlled by the canonical editor.
                </p>
              </div>

              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Update Note
                </span>
                <textarea
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  disabled={busy}
                  rows={3}
                  placeholder="Record useful context for this change"
                  className="mt-2 w-full resize-y rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] leading-5 text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
                />
              </label>
            </div>

            <div className="mb-0 flex shrink-0 flex-col-reverse gap-2 border-t border-wk-border bg-wk-surface px-5 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
              {item.planningState !== "archived" ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setArchiveOpen(true);
                  }}
                  disabled={busy}
                  className="wk-button wk-button-ghost wk-button-sm justify-center border-wk-danger/30 text-wk-danger hover:bg-wk-danger-soft disabled:opacity-50 sm:mr-auto"
                >
                  <WkIcon name="Archive" size={14} />
                  Archive Item
                </button>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="wk-button wk-button-secondary wk-button-sm justify-center"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  busy ||
                  title.trim().length < 2 ||
                  !contentKind ||
                  !hasChanges
                }
                className="wk-button wk-button-primary wk-button-sm justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <WkIcon
                    name="Loader2"
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <WkIcon
                    name="CheckCircle"
                    size={14}
                  />
                )}
                {saving
                  ? "Saving Changes"
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </aside>
      </div>

      <ArchivePublishingItemDialog
        open={archiveOpen}
        itemTitle={item.title}
        loading={archiving}
        error={error}
        onCancel={() => {
          if (!archiving) {
            setArchiveOpen(false);
            setError(null);
          }
        }}
        onConfirm={handleArchive}
      />
    </>
  );
}
