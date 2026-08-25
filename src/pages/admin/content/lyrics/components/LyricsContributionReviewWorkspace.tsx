import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import {
  EditorialDecisionWorkspace,
  type EditorialDecisionDescriptor,
} from "@/components/design-system/editorial/EditorialDecisionWorkspace";
import { EditorialTextDiff } from "@/components/design-system/editorial/EditorialTextDiff";
import {
  fetchAdminTrackLyricsWorkspace,
  lyricsDocumentToEditorText,
  lyricsLinesToEditorText,
  parseLyricsEditorText,
  publishTrackLyrics,
  type AdminTrackLyricsWorkspace,
} from "@/services/player/trackLyricsService";
import {
  acceptTrackLyricsContribution,
  rejectTrackLyricsContributionWithNote,
  type TrackLyricsInboxItem,
} from "@/services/player/trackLyricsAdminService";

function editorTextForContribution(
  contribution: TrackLyricsInboxItem,
): string {
  return lyricsLinesToEditorText(
    contribution.lines,
    contribution.timingMode,
  );
}

function normalized(value: string): string {
  return value.replace(/\r/g, "").trim();
}

function errorText(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "Lyrics review could not be completed.";
}

export function LyricsContributionReviewWorkspace({
  contribution,
  onReviewed,
}: {
  contribution: TrackLyricsInboxItem;
  onReviewed: (contributionId: string) => void | Promise<void>;
}) {
  const originalEditorText = useMemo(
    () => editorTextForContribution(contribution),
    [contribution],
  );
  const [workspace, setWorkspace] =
    useState<AdminTrackLyricsWorkspace | null>(null);
  const [revisionText, setRevisionText] = useState(originalEditorText);
  const [languageCode, setLanguageCode] = useState(contribution.languageCode);
  const [timingMode, setTimingMode] =
    useState<"plain" | "line">(contribution.timingMode);
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [decisionStatus, setDecisionStatus] =
    useState<TrackLyricsInboxItem["status"]>(contribution.status);
  const [acceptedVersionId, setAcceptedVersionId] =
    useState<string | null>(contribution.acceptedVersionId);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessage(null);
    setRevisionText(originalEditorText);
    setLanguageCode(contribution.languageCode);
    setTimingMode(contribution.timingMode);
    setDecisionNote("");
    setDecisionStatus(contribution.status);
    setAcceptedVersionId(contribution.acceptedVersionId);

    fetchAdminTrackLyricsWorkspace(contribution.trackId)
      .then((next) => {
        if (!alive) return;
        setWorkspace(next);
        if (
          contribution.status === "promoted" &&
          contribution.acceptedVersionId &&
          contribution.acceptedVersionId === next.currentWorkingVersionId &&
          next.working
        ) {
          setLanguageCode(next.working.languageCode);
          setTimingMode(next.working.timingMode);
          setRevisionText(lyricsDocumentToEditorText(next.working));
        }
      })
      .catch((reason) => {
        if (alive) setMessage(errorText(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    contribution.id,
    contribution.languageCode,
    contribution.timingMode,
    contribution.trackId,
    originalEditorText,
  ]);

  const revisionChanged =
    normalized(revisionText) !== normalized(originalEditorText) ||
    languageCode.trim().toLowerCase() !==
      contribution.languageCode.trim().toLowerCase() ||
    timingMode !== contribution.timingMode;

  async function accept(
    mode: "as_submitted" | "with_revisions",
  ) {
    if (!workspace) return;

    setBusy(true);
    setMessage(null);
    try {
      const lines =
        mode === "as_submitted"
          ? contribution.lines.map((line, index) => ({
              text: line.text,
              stanza_index: line.stanzaIndex ?? 0,
              line_index: line.lineIndex ?? index,
              ...(line.startSeconds == null
                ? {}
                : { start_seconds: line.startSeconds }),
            }))
          : parseLyricsEditorText(revisionText, timingMode);

      const accepted = await acceptTrackLyricsContribution({
        contributionId: contribution.id,
        expectedAuthorityRevision: workspace.authorityRevision,
        languageCode:
          mode === "as_submitted"
            ? contribution.languageCode
            : languageCode,
        timingMode:
          mode === "as_submitted"
            ? contribution.timingMode
            : timingMode,
        lines,
        acceptanceMode: mode,
        reviewNote: decisionNote,
      });

      setDecisionStatus("promoted");
      setAcceptedVersionId(accepted.versionId);

      const acceptedMessage =
        mode === "as_submitted"
          ? "Lyrics contribution accepted as submitted and preserved as the working version."
          : "WAKILISHA revision accepted with the original contributor provenance preserved.";

      try {
        const nextWorkspace = await fetchAdminTrackLyricsWorkspace(
          contribution.trackId,
        );
        setWorkspace(nextWorkspace);
        const acceptedIsCurrentWorking =
          accepted.versionId === nextWorkspace.currentWorkingVersionId;
        const acceptedIsPublished =
          accepted.versionId === nextWorkspace.currentPublishedVersionId;

        setMessage(
          acceptedIsPublished
            ? `${acceptedMessage} This exact version is already published.`
            : !acceptedIsCurrentWorking
              ? `${acceptedMessage} The Track working version advanced before publication, so this Review will not publish a different version.`
              : nextWorkspace.canPublish
                ? `${acceptedMessage} It is not public yet. Publish this exact accepted version here when ready.`
                : `${acceptedMessage} It is not public yet. A publisher with Lyrics publication authority must publish this exact accepted version.`,
        );
      } catch (reason) {
        setMessage(
          `${acceptedMessage} The accepted version is safe, but publication authority could not be reloaded: ${errorText(reason)}`,
        );
      }

      await onReviewed(contribution.id);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setMessage(null);
    try {
      await rejectTrackLyricsContributionWithNote(
        contribution.id,
        decisionNote,
      );
      setDecisionStatus("rejected");
      setMessage(
        "Lyrics contribution rejected with its review history preserved.",
      );
      await onReviewed(contribution.id);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function publishAcceptedLyrics() {
    if (
      !workspace?.currentWorkingVersionId ||
      !acceptedVersionId ||
      acceptedVersionId !== workspace.currentWorkingVersionId
    ) {
      setMessage(
        "This accepted Lyrics version is no longer the current working version, so Review will not publish a different version.",
      );
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await publishTrackLyrics(workspace);
      const nextWorkspace = await fetchAdminTrackLyricsWorkspace(
        contribution.trackId,
      );
      setWorkspace(nextWorkspace);
      setMessage(
        "Published Lyrics are now available to listeners from this exact accepted version.",
      );
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-[360px] rounded-2xl border border-wk-border bg-wk-surface"
        aria-busy="true"
        aria-label="Loading Lyrics contribution review"
      />
    );
  }

  if (!workspace) {
    return (
      <AdminWorkspaceSection
        icon="TriangleAlert"
        title="Lyrics review unavailable"
        note={message || "The Track Lyrics authority could not be loaded."}
      >
        <p className="text-xs text-wk-text-muted">
          Return to the Inbox and retry this contribution.
        </p>
      </AdminWorkspaceSection>
    );
  }

  const acceptedVersionIsCurrentWorking =
    Boolean(acceptedVersionId) &&
    acceptedVersionId === workspace.currentWorkingVersionId;

  const acceptedVersionIsPublished =
    Boolean(acceptedVersionId) &&
    acceptedVersionId === workspace.currentPublishedVersionId;

  const actions: EditorialDecisionDescriptor[] = [];

  if (decisionStatus === "submitted") {
    actions.push(
      {
        key: "accept-submitted",
        label: "Accept as submitted",
        icon: "CheckCircle2",
        tone: revisionChanged ? "secondary" : "primary",
        disabled: busy,
        onClick: () => void accept("as_submitted"),
      },
      {
        key: "accept-revision",
        label: "Accept WAKILISHA revision",
        icon: "GitMerge",
        tone: revisionChanged ? "primary" : "secondary",
        disabled: busy || !revisionChanged,
        title: revisionChanged
          ? "Accept the reviewed WAKILISHA revision while preserving the original contributor provenance."
          : "Change the revision before accepting with revisions.",
        onClick: () => void accept("with_revisions"),
      },
      {
        key: "reject",
        label: "Reject",
        icon: "XCircle",
        tone: "danger",
        requiresNote: true,
        noteRequiredMessage:
          "Add a review note explaining why this Lyrics contribution is being rejected.",
        disabled: busy,
        onClick: () => void reject(),
      },
    );
  }

  if (
    decisionStatus === "promoted" &&
    acceptedVersionIsCurrentWorking &&
    !acceptedVersionIsPublished &&
    workspace.currentWorkingVersionId &&
    workspace.canPublish
  ) {
    actions.push({
      key: "publish",
      label: "Publish",
      icon: "Globe",
      tone: "primary",
      disabled: busy,
      title: "Publish this exact accepted working Lyrics version.",
      onClick: () => void publishAcceptedLyrics(),
    });
  }

  const statusLabel =
    decisionStatus === "rejected"
      ? "Rejected"
      : acceptedVersionIsPublished
        ? "Published"
        : decisionStatus === "promoted" && acceptedVersionIsCurrentWorking
          ? "Accepted · Not published"
          : decisionStatus === "promoted"
            ? "Accepted · Historical version"
            : "Awaiting review";

  const revisionLocked = decisionStatus !== "submitted";

  return (
    <EditorialDecisionWorkspace
      title="Lyrics contribution decision"
      note={decisionNote}
      onNoteChange={setDecisionNote}
      noteLabel="Review note"
      notePlaceholder="Record context for the contributor and future editors."
      statusLabel={statusLabel}
      targetLabel={`${contribution.trackTitle} · ${contribution.artists.join(", ") || "Artist unresolved"}`}
      actions={actions}
      busy={busy}
      events={[]}
      emptyHistoryLabel="This submission has not been reviewed yet."
    >
      {message ? (
        <div
          role="status"
          className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-xs text-wk-warning"
        >
          {message}
        </div>
      ) : null}

      <AdminWorkspaceSection
        icon="UserRound"
        title="Original listener submission"
        note="The submitted payload is immutable. Editorial work happens in the separate WAKILISHA revision below."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-wk-text-muted">
          <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 font-bold text-wk-brand">
            {contribution.contributionKind === "correction"
              ? "Lyrics correction"
              : "Lyrics submission"}
          </span>
          <span>{contribution.contributorLabel}</span>
          {contribution.contributorUsername ? (
            <span>@{contribution.contributorUsername}</span>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{contribution.languageCode.toUpperCase()}</span>
          <span aria-hidden="true">·</span>
          <span>{contribution.timingMode === "line" ? "Timed" : "Plain"}</span>
        </div>

        <pre className="max-h-[380px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-wk-border bg-wk-bg p-4 font-sans text-sm leading-6 text-wk-text">
          {contribution.plainText}
        </pre>

        {contribution.sourceDescription ? (
          <p className="mt-3 text-xs text-wk-text-muted">
            Source note: {contribution.sourceDescription}
          </p>
        ) : null}
      </AdminWorkspaceSection>

      <AdminWorkspaceSection
        icon="PencilLine"
        title={
          decisionStatus === "promoted" && acceptedVersionIsCurrentWorking
            ? "Accepted working version"
            : decisionStatus === "promoted"
              ? "Historical accepted contribution"
              : "WAKILISHA revision"
        }
        note={
          decisionStatus === "promoted" && acceptedVersionIsCurrentWorking
            ? "This accepted version is immutable review output. Publication remains a separate governed decision in this same workspace."
            : decisionStatus === "promoted"
              ? "This decision remains preserved, but the Track working version has advanced. Review will never publish a different version on its behalf."
              : "Start from the listener submission, make only the changes editorial review requires, then accept the exact resulting version."
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-wk-text-muted">
            Language
            <input
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}
              disabled={busy || revisionLocked}
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
            />
          </label>

          <label className="text-xs font-bold text-wk-text-muted">
            Timing
            <select
              value={timingMode}
              onChange={(event) =>
                setTimingMode(event.target.value === "line" ? "line" : "plain")
              }
              disabled={busy || revisionLocked}
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
            >
              <option value="plain">Plain Lyrics</option>
              <option value="line">Line-timed Lyrics</option>
            </select>
          </label>
        </div>

        <textarea
          value={revisionText}
          onChange={(event) => setRevisionText(event.target.value)}
          disabled={busy || revisionLocked}
          rows={18}
          spellCheck
          className="mt-4 min-h-[360px] w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 font-mono text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
        />

        <div className="mt-4 flex items-center gap-2 text-xs text-wk-text-muted">
          <WkIcon
            name={revisionChanged ? "GitCompare" : "CheckCircle2"}
            size={14}
            className={revisionChanged ? "text-wk-warning" : "text-wk-success"}
          />
          {revisionChanged
            ? "This revision differs from the original submission."
            : "No editorial revisions have been made."}
        </div>
      </AdminWorkspaceSection>

      {decisionStatus === "promoted" ? (
        <AdminWorkspaceSection
          icon="Globe"
          title="Publication"
          note={
            acceptedVersionIsPublished
              ? "The exact accepted version is the current public Lyrics version."
              : acceptedVersionIsCurrentWorking
                ? "Acceptance is complete. Publication is the next separate governed decision and happens here without leaving Review."
                : "This accepted version is historical because the Track working version has advanced. No Publish action is offered for a different version."
          }
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-wk-text-muted">
            <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 font-bold text-wk-brand">
              {acceptedVersionIsPublished
                ? "Published"
                : acceptedVersionIsCurrentWorking
                  ? "Accepted · Not published"
                  : "Accepted · Historical version"}
            </span>
            <span>
              Working {workspace.working ? `v${workspace.working.versionNumber}` : "none"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Published {workspace.published ? `v${workspace.published.versionNumber}` : "none"}
            </span>
          </div>
        </AdminWorkspaceSection>
      ) : null}

      <AdminWorkspaceSection
        icon="GitCompare"
        title="Submission vs WAKILISHA revision"
        note="The diff is review evidence only. The original submission remains unchanged."
      >
        <EditorialTextDiff
          previousText={contribution.plainText}
          nextText={revisionText}
          previousLabel="Listener submission"
          nextLabel="WAKILISHA revision"
        />
      </AdminWorkspaceSection>
    </EditorialDecisionWorkspace>
  );
}
