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
  parseLyricsEditorText,
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
  if (contribution.timingMode === "plain") {
    return contribution.lines.map((line) => line.text).join("\n");
  }

  return contribution.lines
    .map((line) => {
      const total = Math.max(0, line.startSeconds ?? 0);
      const minutes = Math.floor(total / 60);
      const seconds = (total % 60).toFixed(2).padStart(5, "0");
      return `[${String(minutes).padStart(2, "0")}:${seconds}] ${line.text}`;
    })
    .join("\n");
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
  onReviewed: (message: string) => void | Promise<void>;
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

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessage(null);
    setRevisionText(originalEditorText);
    setLanguageCode(contribution.languageCode);
    setTimingMode(contribution.timingMode);
    setDecisionNote("");

    fetchAdminTrackLyricsWorkspace(contribution.trackId)
      .then((next) => {
        if (alive) setWorkspace(next);
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
          ? contribution.lines.map((line) => ({
              text: line.text,
              ...(line.startSeconds == null
                ? {}
                : { start_seconds: line.startSeconds }),
            }))
          : parseLyricsEditorText(revisionText, timingMode);

      await acceptTrackLyricsContribution({
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

      await onReviewed(
        mode === "as_submitted"
          ? "Lyrics contribution accepted as submitted and preserved as the working version."
          : "WAKILISHA revision accepted with the original contributor provenance preserved.",
      );
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
      await onReviewed("Lyrics contribution rejected with its review history preserved.");
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

  const actions: EditorialDecisionDescriptor[] = [
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
  ];

  return (
    <EditorialDecisionWorkspace
      title="Lyrics contribution decision"
      note={decisionNote}
      onNoteChange={setDecisionNote}
      noteLabel="Review note"
      notePlaceholder="Record context for the contributor and future editors."
      statusLabel={contribution.status}
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
        title="WAKILISHA revision"
        note="Start from the listener submission, make only the changes editorial review requires, then accept the exact resulting version."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-wk-text-muted">
            Language
            <input
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}
              disabled={busy}
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
              disabled={busy}
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
          disabled={busy}
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
