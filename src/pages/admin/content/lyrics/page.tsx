import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminCollectionHeader } from "@/components/design-system/admin/AdminCollectionHeader";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import {
  AdminRecordActions,
  type AdminRecordActionDescriptor,
} from "@/components/design-system/admin/AdminRecordActions";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import { EditorialWorkflowRail } from "@/components/design-system/editorial/EditorialWorkflowRail";
import {
  fetchAdminTrackLyricsWorkspace,
  lyricsDocumentToEditorText,
  parseLyricsEditorText,
  publishTrackLyrics,
  saveTrackLyricsDraft,
  type AdminTrackLyricsWorkspace,
} from "@/services/player/trackLyricsService";
import {
  fetchTrackLyricsContributionInbox,
  searchTrackLyricsAdminTracks,
  type TrackLyricsAdminTrackResult,
  type TrackLyricsInboxItem,
} from "@/services/player/trackLyricsAdminService";
import { LyricsContributionReviewWorkspace } from "./components/LyricsContributionReviewWorkspace";
import { LyricsHistoryWorkspace } from "./components/LyricsHistoryWorkspace";

type LyricsWorkspaceView =
  | "inbox"
  | "library"
  | "review"
  | "history";

function errorText(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "Lyrics workspace could not be updated.";
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function acceptanceLabel(item: TrackLyricsInboxItem): string {
  if (item.status === "submitted") return "Awaiting review";
  if (item.status === "rejected") return "Rejected";
  return item.acceptanceMode === "with_revisions"
    ? "Accepted with WAKILISHA revisions"
    : "Accepted as submitted";
}

export default function AdminLyricsPage() {
  const [view, setView] = useState<LyricsWorkspaceView>("inbox");
  const [inbox, setInbox] = useState<TrackLyricsInboxItem[]>([]);
  const [history, setHistory] = useState<TrackLyricsInboxItem[]>([]);
  const [inboxQuery, setInboxQuery] = useState("");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [selectedContribution, setSelectedContribution] =
    useState<TrackLyricsInboxItem | null>(null);

  const [trackQuery, setTrackQuery] = useState("");
  const [trackResults, setTrackResults] =
    useState<TrackLyricsAdminTrackResult[]>([]);
  const [trackSearching, setTrackSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] =
    useState<TrackLyricsAdminTrackResult | null>(null);
  const [workspace, setWorkspace] =
    useState<AdminTrackLyricsWorkspace | null>(null);
  const [languageCode, setLanguageCode] = useState("und");
  const [timingMode, setTimingMode] =
    useState<"plain" | "line">("plain");
  const [editorText, setEditorText] = useState("");
  const [rightsNote, setRightsNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const loadInbox = async (search = inboxQuery) => {
    const rows = await fetchTrackLyricsContributionInbox({
      search,
      status: "submitted",
      limit: 100,
    });
    setInbox(rows);
  };

  const loadHistory = async () => {
    const rows = await fetchTrackLyricsContributionInbox({
      status: "all",
      limit: 200,
    });
    setHistory(rows);
    return rows;
  };

  useEffect(() => {
    let alive = true;
    setInboxLoading(true);

    Promise.all([
      fetchTrackLyricsContributionInbox({
        status: "submitted",
        limit: 100,
      }),
      fetchTrackLyricsContributionInbox({
        status: "all",
        limit: 200,
      }),
    ])
      .then(([pendingRows, historyRows]) => {
        if (!alive) return;
        setInbox(pendingRows);
        setHistory(historyRows);
      })
      .catch((reason) => {
        if (alive) setMessage(errorText(reason));
      })
      .finally(() => {
        if (alive) setInboxLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setInboxLoading(true);
      loadInbox(inboxQuery)
        .catch((reason) => setMessage(errorText(reason)))
        .finally(() => setInboxLoading(false));
    }, 250);

    return () => window.clearTimeout(timeout);
    // loadInbox intentionally follows the current query value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxQuery]);

  useEffect(() => {
    if (view !== "library") return;

    let alive = true;
    const timeout = window.setTimeout(() => {
      setTrackSearching(true);
      searchTrackLyricsAdminTracks(trackQuery, 60)
        .then((rows) => {
          if (alive) setTrackResults(rows);
        })
        .catch((reason) => {
          if (alive) setMessage(errorText(reason));
        })
        .finally(() => {
          if (alive) setTrackSearching(false);
        });
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [trackQuery, view]);

  const reviewedHistory = useMemo(
    () => history.filter((item) => item.status !== "submitted"),
    [history],
  );

  const sourceDocument = workspace?.working ?? workspace?.published ?? null;
  const savedEditorText = lyricsDocumentToEditorText(sourceDocument);
  const libraryDirty = Boolean(
    workspace &&
      (
        editorText !== savedEditorText ||
        languageCode !== (sourceDocument?.languageCode ?? "und") ||
        timingMode !== (sourceDocument?.timingMode ?? "plain") ||
        rightsNote !== (sourceDocument?.rightsNote ?? "")
      ),
  );

  function hydrateWorkspace(next: AdminTrackLyricsWorkspace) {
    setWorkspace(next);
    const source = next.working ?? next.published;
    setLanguageCode(source?.languageCode ?? "und");
    setTimingMode(source?.timingMode ?? "plain");
    setEditorText(lyricsDocumentToEditorText(source));
    setRightsNote(source?.rightsNote ?? "");
  }

  async function openTrack(track: TrackLyricsAdminTrackResult) {
    setSelectedTrack(track);
    setBusy("load-track");
    setMessage(null);
    try {
      hydrateWorkspace(await fetchAdminTrackLyricsWorkspace(track.id));
    } catch (reason) {
      setWorkspace(null);
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function reloadTrack() {
    if (!selectedTrack) return;
    hydrateWorkspace(
      await fetchAdminTrackLyricsWorkspace(selectedTrack.id),
    );
  }

  async function saveDraft() {
    if (!workspace) return;
    setBusy("save");
    setMessage(null);
    try {
      await saveTrackLyricsDraft(workspace, {
        languageCode,
        timingMode,
        lines: parseLyricsEditorText(editorText, timingMode),
        rightsNote,
      });
      await reloadTrack();
      setMessage("Lyrics working version saved immutably.");
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!workspace) return;
    setBusy("publish");
    setMessage(null);
    try {
      await publishTrackLyrics(workspace);
      await reloadTrack();
      setMessage("Published Lyrics are now available to the listener player.");
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  function openContribution(item: TrackLyricsInboxItem) {
    setSelectedContribution(item);
    setView("review");
    setMessage(null);
  }

  function openHistoricalContribution(contributionId: string) {
    const item = history.find(
      (candidate) => candidate.id === contributionId,
    );
    if (!item) {
      setMessage("This Lyrics contribution could not be reopened from History.");
      return;
    }
    openContribution(item);
  }

  async function openPendingForTrack(track: TrackLyricsAdminTrackResult) {
    setBusy(`pending:${track.id}`);
    setMessage(null);
    try {
      const rows = await fetchTrackLyricsContributionInbox({
        status: "submitted",
        search: track.title,
        limit: 100,
      });
      const exact = rows.find((item) => item.trackId === track.id);
      if (!exact) {
        setMessage("No pending Lyrics contribution remains for this Track.");
        return;
      }
      openContribution(exact);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function handleReviewed(contributionId: string) {
    try {
      const [, historyRows] = await Promise.all([
        loadInbox(""),
        loadHistory(),
      ]);
      const reviewed = historyRows.find(
        (item) => item.id === contributionId,
      );
      if (reviewed) setSelectedContribution(reviewed);
      setInboxQuery("");
    } catch (reason) {
      setMessage(errorText(reason));
    }
  }

  async function refreshCurrentView() {
    setBusy("refresh");
    setMessage(null);
    try {
      if (view === "inbox") await loadInbox();
      else if (view === "history") {
        await loadHistory();
        setHistoryRefreshKey((value) => value + 1);
      }
      else if (view === "library") {
        setTrackResults(await searchTrackLyricsAdminTracks(trackQuery, 60));
        if (selectedTrack) await reloadTrack();
      }
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  const libraryActions: AdminRecordActionDescriptor[] = [];
  if (workspace?.canEdit) {
    libraryActions.push({
      key: "save",
      label: "Save working version",
      icon: "Save",
      tone: "secondary",
      disabled: busy !== null || !libraryDirty || !editorText.trim(),
      onClick: () => void saveDraft(),
    });
  }
  if (workspace?.canPublish && workspace.currentWorkingVersionId) {
    libraryActions.push({
      key: "publish",
      label: "Publish",
      icon: "Globe",
      tone: "primary",
      disabled: busy !== null || libraryDirty,
      title: libraryDirty
        ? "Save the working Lyrics version before publishing."
        : "Publish the exact current working Lyrics version.",
      onClick: () => void publish(),
    });
  }
  if ((selectedTrack?.pendingContributionCount ?? 0) > 0 && selectedTrack) {
    libraryActions.push({
      key: "pending-contribution",
      label: "Review pending contribution",
      icon: "Inbox",
      placement: "overflow",
      disabled: busy !== null,
      onClick: () => void openPendingForTrack(selectedTrack),
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-5 p-4 sm:p-6 lg:p-8">
      <AdminCollectionHeader
        eyebrow="Content & Editorial"
        title="Lyrics"
        description="Review community Lyrics work, create governed versions, and publish against canonical Music Registry Tracks from one workspace."
        meta={
          <>
            <span>{inbox.length} pending contribution{inbox.length === 1 ? "" : "s"}</span>
            <span aria-hidden="true">·</span>
            <span>{reviewedHistory.length} recorded decision{reviewedHistory.length === 1 ? "" : "s"}</span>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void refreshCurrentView()}
              className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
            >
              <WkIcon name="RefreshCw" size={14} />
              Refresh
            </button>
            <Link to="/admin" className="wk-button wk-button-ghost wk-button-sm">
              Dashboard
            </Link>
          </div>
        }
      />

      <EditorialWorkflowRail
        activeId={view}
        onChange={(id) => setView(id as LyricsWorkspaceView)}
        groups={[
          {
            label: "Operate",
            items: [
              { id: "inbox", label: "Inbox" },
              { id: "library", label: "Library / Add Lyrics" },
            ],
          },
          {
            label: "Workflow",
            items: [{ id: "review", label: "Review" }],
          },
          {
            label: "Record",
            items: [{ id: "history", label: "History" }],
          },
        ]}
      />

      {message ? (
        <div
          role="status"
          className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text"
        >
          {message}
        </div>
      ) : null}

      {view === "inbox" ? (
        <AdminWorkspaceSection
          icon="Inbox"
          title="Lyrics contribution inbox"
          note="Every pending Track Lyrics submission and correction appears here without requiring editors to know the Track first."
          actions={
            <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
              <WkIcon name="Search" size={13} className="text-wk-text-faint" />
              <input
                value={inboxQuery}
                onChange={(event) => setInboxQuery(event.target.value)}
                placeholder="Track, artist, contributor"
                className="min-w-0 flex-1 bg-transparent text-xs text-wk-text outline-none placeholder:text-wk-text-faint"
              />
            </label>
          }
        >
          {inboxLoading ? (
            <div className="min-h-[260px]" aria-busy="true" />
          ) : inbox.length ? (
            <div className="divide-y divide-wk-border overflow-hidden rounded-xl border border-wk-border">
              {inbox.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-3 bg-wk-surface px-4 py-4 md:grid-cols-[minmax(0,1.7fr)_minmax(160px,.7fr)_auto] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-wk-bg-subtle">
                      {item.artworkUrl ? (
                        <img
                          src={item.artworkUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                          <WkIcon name="Music" size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-wk-text">
                          {item.trackTitle}
                        </h3>
                        <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-wk-brand">
                          {item.contributionKind === "correction" ? "Correction" : "Submission"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-wk-text-muted">
                        {item.artists.join(", ") || "Artist unresolved"}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-wk-text-faint">
                        {item.plainText}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-wk-text-muted">
                    <div className="font-bold text-wk-text">{item.contributorLabel}</div>
                    <div className="mt-1">{formatDate(item.createdAt)}</div>
                    <div className="mt-1">{item.languageCode.toUpperCase()} · {item.timingMode === "line" ? "Timed" : "Plain"}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openContribution(item)}
                    className="wk-button wk-button-primary wk-button-sm"
                  >
                    <WkIcon name="ScanText" size={14} />
                    Review
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-wk-border px-5 py-12 text-center">
              <WkIcon name="CheckCircle2" size={24} className="mx-auto text-wk-success" />
              <p className="mt-3 text-sm font-black text-wk-text">Lyrics inbox is clear.</p>
              <p className="mt-1 text-xs text-wk-text-muted">
                New Track Lyrics submissions and corrections will appear here automatically.
              </p>
            </div>
          )}
        </AdminWorkspaceSection>
      ) : null}

      {view === "library" ? (
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <AdminWorkspaceSection
            icon="Library"
            title="Music Registry Tracks"
            note="Search by Track title, slug, or artist. Tracks with pending Lyrics review are prioritized."
          >
            <label className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
              <WkIcon name="Search" size={13} className="text-wk-text-faint" />
              <input
                value={trackQuery}
                onChange={(event) => setTrackQuery(event.target.value)}
                placeholder="Track or artist"
                className="min-w-0 flex-1 bg-transparent text-xs text-wk-text outline-none placeholder:text-wk-text-faint"
              />
              {trackSearching ? (
                <WkIcon name="LoaderCircle" size={13} className="animate-spin text-wk-text-faint" />
              ) : null}
            </label>

            <div className="mt-3 max-h-[680px] space-y-1 overflow-y-auto pr-1">
              {trackResults.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => void openTrack(track)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl p-2.5 text-left",
                    selectedTrack?.id === track.id
                      ? "bg-wk-brand-soft"
                      : "hover:bg-wk-surface-raised",
                  ].join(" ")}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-wk-bg-subtle">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-wk-text">
                      {track.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-wk-text-muted">
                      {track.artists.join(", ") || "Artist unresolved"}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-wk-text-faint">
                      {track.slug}
                    </span>
                  </span>
                  {track.pendingContributionCount > 0 ? (
                    <span className="rounded-full bg-wk-warning-soft px-2 py-0.5 text-[9px] font-black text-wk-warning">
                      {track.pendingContributionCount}
                    </span>
                  ) : track.hasPublishedLyrics ? (
                    <WkIcon name="CheckCircle2" size={14} className="text-wk-success" />
                  ) : null}
                </button>
              ))}

              {!trackSearching && !trackResults.length ? (
                <p className="px-3 py-8 text-center text-xs text-wk-text-muted">
                  No Registry Tracks match this search.
                </p>
              ) : null}
            </div>
          </AdminWorkspaceSection>

          <div className="space-y-4">
            {!selectedTrack || !workspace ? (
              <AdminWorkspaceSection
                icon="FileText"
                title="Choose a Registry Track"
                note="Select a Track to create or edit its governed Lyrics document."
              >
                <div className="py-16 text-center text-xs text-wk-text-muted">
                  The contribution Inbox is separate so review work never depends on this picker.
                </div>
              </AdminWorkspaceSection>
            ) : (
              <>
                <AdminRecordHeader
                  collectionLabel="Lyrics Library"
                  title={selectedTrack.title}
                  status={workspace.published ? "published" : "draft"}
                  statusLabel={workspace.published ? "Published Lyrics" : "Working Lyrics"}
                  meta={
                    <>
                      <span>{selectedTrack.artists.join(", ") || "Artist unresolved"}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{selectedTrack.slug}</span>
                      <span aria-hidden="true">·</span>
                      <span>Authority revision {workspace.authorityRevision}</span>
                    </>
                  }
                  actions={
                    <AdminRecordActions
                      actions={libraryActions}
                      overflowLabel="More Lyrics actions"
                    >
                      <AdminSaveState
                        isDirty={libraryDirty}
                        isSaving={busy === "save"}
                        locked={!workspace.canEdit}
                        lockedLabel="Read-only Lyrics"
                      />
                    </AdminRecordActions>
                  }
                  footer={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Working {workspace.working ? `v${workspace.working.versionNumber}` : "none"} · Published {workspace.published ? `v${workspace.published.versionNumber}` : "none"}
                      </span>
                      {libraryDirty ? (
                        <span className="font-semibold text-wk-warning">Save this working version before publication.</span>
                      ) : null}
                    </div>
                  }
                />

                <AdminWorkspaceSection
                  icon="PencilLine"
                  title="Lyrics document"
                  note="Manual editorial Lyrics remain versioned independently from listener submissions."
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-bold text-wk-text-muted">
                      Language
                      <input
                        value={languageCode}
                        disabled={!workspace.canEdit}
                        onChange={(event) => setLanguageCode(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                      />
                    </label>

                    <label className="text-xs font-bold text-wk-text-muted">
                      Timing
                      <select
                        value={timingMode}
                        disabled={!workspace.canEdit}
                        onChange={(event) => setTimingMode(event.target.value === "line" ? "line" : "plain")}
                        className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                      >
                        <option value="plain">Plain Lyrics</option>
                        <option value="line">Line-timed Lyrics</option>
                      </select>
                    </label>

                    <label className="text-xs font-bold text-wk-text-muted">
                      Rights / source note
                      <input
                        value={rightsNote}
                        disabled={!workspace.canEdit}
                        onChange={(event) => setRightsNote(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                        placeholder="Optional"
                      />
                    </label>
                  </div>

                  <textarea
                    value={editorText}
                    disabled={!workspace.canEdit}
                    onChange={(event) => setEditorText(event.target.value)}
                    rows={24}
                    placeholder={timingMode === "line" ? "[00:12.50] First line" : "First line\nSecond line"}
                    className="mt-4 min-h-[480px] w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 font-mono text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                  />
                </AdminWorkspaceSection>
              </>
            )}
          </div>
        </div>
      ) : null}

      {view === "review" ? (
        selectedContribution ? (
          <LyricsContributionReviewWorkspace
            contribution={selectedContribution}
            onReviewed={handleReviewed}
          />
        ) : (
          <AdminWorkspaceSection
            icon="ScanText"
            title="Choose work from the Inbox"
            note="Review always starts from an exact immutable contribution."
          >
            <div className="py-12 text-center">
              <p className="text-sm font-black text-wk-text">No Lyrics contribution selected.</p>
              <button
                type="button"
                onClick={() => setView("inbox")}
                className="wk-button wk-button-primary wk-button-sm mt-4"
              >
                Open Inbox
              </button>
            </div>
          </AdminWorkspaceSection>
        )
      ) : null}

      {view === "history" ? (
        <LyricsHistoryWorkspace
          refreshKey={historyRefreshKey}
          onOpenContribution={openHistoricalContribution}
        />
      ) : null}
    </div>
  );
}
