import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import { EditorialWorkflowRail } from "@/components/design-system/editorial/EditorialWorkflowRail";
import { MediaTimeline } from "@/components/design-system/editorial/MediaTimeline";
import { TrustAttachmentPicker } from "@/components/design-system/trust/TrustAttachmentPicker";
import {
  EditorialCreditPicker,
  type EditorialCreditSelection,
} from "@/components/design-system/trust/EditorialCreditPicker";
import { AudioReviewWorkspace } from "./components/AudioReviewWorkspace";
import {
  fetchAudioEditorialMediaContext,
  type AudioEditorialMediaContext,
} from "@/services/audio/audioReviewService";
import { fetchAudioTrustCandidates } from "@/services/audio/audioTrustCandidateService";
import {
  fetchEditorialCreditPickerOptions,
  resolveEditorialCredit,
  type EditorialCreditPickerOptions,
} from "@/services/trust/editorialCreditService";
import {
  fetchAudioPublicationWorkspace,
  publishAudio,
  replaceAudioChapters,
  replaceAudioCitations,
  replaceAudioCredits,
  reviewAudio,
  saveAudioMetadata,
  setAudioMaster,
  setAudioTranscript,
  snapshotAudioWorkingVersion,
  submitAudioForReview,
  type AudioChapter,
  type AudioPublicationWorkspace,
} from "@/services/audio/audioAdminService";
import type { TrustAttachmentOption } from "@/components/design-system/trust/TrustAttachmentPicker";

type PickerKind = "master" | "transcript" | null;
type WorkspaceView = "details" | "sound" | "trust" | "review" | "history";
type AudioTrustCandidateBundle = Awaited<
  ReturnType<typeof fetchAudioTrustCandidates>
>;
type AuxiliaryResults = [
  PromiseSettledResult<AudioEditorialMediaContext>,
  PromiseSettledResult<AudioTrustCandidateBundle>,
  PromiseSettledResult<EditorialCreditPickerOptions>,
];

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Audio could not be updated.";
}

function compactId(value: string | null | undefined): string {
  if (!value) return "Not set";
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function secondsLabel(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function chapterSignature(chapters: AudioChapter[]): string {
  return JSON.stringify(
    chapters.map((chapter) => ({
      startSeconds: chapter.startSeconds,
      title: chapter.title,
      chapterUrl: chapter.chapterUrl,
      imageUrl: chapter.imageUrl,
    })),
  );
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function fact(value: unknown): string {
  return value == null || value === "" ? "Not available" : String(value);
}

export function AudioEditorWorkspace({
  publicationId,
}: {
  publicationId?: string;
}) {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [workspace, setWorkspace] = useState<AudioPublicationWorkspace | null>(null);
  const [mediaContext, setMediaContext] = useState<AudioEditorialMediaContext | null>(null);
  const [creditPickerOptions, setCreditPickerOptions] = useState<EditorialCreditPickerOptions | null>(null);
  const [citationCandidates, setCitationCandidates] = useState<TrustAttachmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [auxiliaryMessage, setAuxiliaryMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [view, setView] = useState<WorkspaceView>("details");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [chapters, setChapters] = useState<AudioChapter[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [playhead, setPlayhead] = useState(0);
  const [chapterCursor, setChapterCursor] = useState(0);

  const hydrateWorkspace = (next: AudioPublicationWorkspace) => {
    setWorkspace(next);
    setTitle(next.publication.title);
    setSummary(next.publication.summary ?? "");
    setChapters(next.chapters);
  };

  const applyAuxiliaryResults = (results: AuxiliaryResults) => {
    const [mediaResult, trustResult, creditResult] = results;
    const warnings: string[] = [];

    if (mediaResult.status === "fulfilled") {
      setMediaContext(mediaResult.value);
    } else {
      setMediaContext(null);
      warnings.push(`Media context: ${errorText(mediaResult.reason)}`);
    }

    if (trustResult.status === "fulfilled") {
      setCitationCandidates(trustResult.value.citations);
    } else {
      setCitationCandidates([]);
      warnings.push(`Citation library: ${errorText(trustResult.reason)}`);
    }

    if (creditResult.status === "fulfilled") {
      setCreditPickerOptions(creditResult.value);
    } else {
      setCreditPickerOptions(null);
      warnings.push(`Credit identities: ${errorText(creditResult.reason)}`);
    }

    setAuxiliaryMessage(
      warnings.length > 0
        ? `Some supporting tools are unavailable. ${warnings.join(" ")}`
        : null,
    );
  };

  const loadAuxiliary = async (): Promise<void> => {
    if (!publicationId) return;

    const results = await Promise.allSettled([
      fetchAudioEditorialMediaContext(publicationId),
      fetchAudioTrustCandidates(),
      fetchEditorialCreditPickerOptions(),
    ]) as AuxiliaryResults;

    applyAuxiliaryResults(results);
  };

  const reload = async () => {
    if (!publicationId) return;

    const nextWorkspace =
      await fetchAudioPublicationWorkspace(publicationId);
    hydrateWorkspace(nextWorkspace);
    await loadAuxiliary();
  };

  useEffect(() => {
    let alive = true;

    if (!publicationId) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const nextWorkspace =
          await fetchAudioPublicationWorkspace(publicationId);
        if (!alive) return;
        hydrateWorkspace(nextWorkspace);

        const results = await Promise.allSettled([
          fetchAudioEditorialMediaContext(publicationId),
          fetchAudioTrustCandidates(),
          fetchEditorialCreditPickerOptions(),
        ]) as AuxiliaryResults;
        if (!alive) return;
        applyAuxiliaryResults(results);
      } catch (reason) {
        if (alive) setMessage(errorText(reason));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [publicationId]);

  const editable = workspace?.canEdit === true && ["draft", "changes_requested"].includes(workspace.publication.status);
  const metadataDirty = Boolean(
    workspace &&
      (
        title !== workspace.publication.title ||
        summary !== (workspace.publication.summary ?? "")
      ),
  );
  const chaptersDirty = Boolean(
    workspace && chapterSignature(chapters) !== chapterSignature(workspace.chapters),
  );
  const workingDirty = editable && (metadataDirty || chaptersDirty);
  const isSaving = ["save", "metadata", "chapters", "snapshot"].includes(busy ?? "");
  const canSubmit = workspace?.canEdit === true &&
    ["draft", "changes_requested"].includes(workspace.publication.status) &&
    Boolean(workspace.master?.audioDeliveryVariantId);

  const citationIds = useMemo(
    () => workspace?.trust.citations.map((item) => item.citationId) ?? [],
    [workspace?.trust.citations],
  );
  const creditIds = useMemo(
    () => workspace?.trust.credits.map((item) => item.creditId) ?? [],
    [workspace?.trust.credits],
  );

  const sourceProbe = object(mediaContext?.sourceProbe);
  const sourceStreams = Array.isArray(sourceProbe.streams) ? sourceProbe.streams : [];
  const audioStream = object(
    sourceStreams.find((candidate) => object(candidate).codec_type === "audio"),
  );

  const run = async (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => {
    setBusy(key);
    setMessage(null);

    try {
      await action();
      await reload();
      setMessage(success);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const saveMetadata = async (target: AudioPublicationWorkspace) => {
    await saveAudioMetadata(target, {
      title,
      slug: target.publication.slug,
      summary,
    });
  };

  const handleMetadata = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;

    await run(
      "metadata",
      () => saveMetadata(workspace),
      "Audio details saved.",
    );
  };

  const handleSaveWorkingVersion = async () => {
    if (!workspace) return;

    setBusy("save");
    setMessage(null);

    try {
      let current = workspace;

      if (metadataDirty) {
        await saveMetadata(current);
        current = await fetchAudioPublicationWorkspace(current.publication.id);
      }

      if (chaptersDirty) {
        await replaceAudioChapters(current, chapters);
        current = await fetchAudioPublicationWorkspace(current.publication.id);
      }

      await snapshotAudioWorkingVersion(current);
      await reload();
      setMessage("Working version saved.");
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const seekPreview = (seconds: number) => {
    const target = Math.max(0, Math.min(seconds, mediaContext?.durationSeconds ?? seconds));
    setPlayhead(target);
    setChapterCursor(target);
    if (audioRef.current) audioRef.current.currentTime = target;
  };

  const addChapter = () => {
    const startSeconds = chapterCursor || playhead;
    setChapters((current) => [
      ...current,
      {
        chapterNumber: current.length + 1,
        startSeconds,
        title: "",
        chapterUrl: null,
        imageUrl: null,
      },
    ]);
  };

  const updateChapter = (index: number, patch: Partial<AudioChapter>) => {
    setChapters((current) =>
      current.map((chapter, chapterIndex) => ({
        ...chapter,
        ...(chapterIndex === index ? patch : {}),
        chapterNumber: chapterIndex + 1,
      })),
    );
  };

  const removeChapter = (index: number) => {
    setChapters((current) =>
      current
        .filter((_, chapterIndex) => chapterIndex !== index)
        .map((chapter, chapterIndex) => ({
          ...chapter,
          chapterNumber: chapterIndex + 1,
        })),
    );
  };

  const saveChapters = async () => {
    if (!workspace) return;
    await run(
      "chapters",
      () => replaceAudioChapters(workspace, chapters),
      "Chapters saved.",
    );
  };

  const addCitation = async (citationId: string) => {
    if (!workspace) return;
    await run(
      "citations",
      () => replaceAudioCitations(workspace, [...new Set([...citationIds, citationId])]),
      "Citation attached.",
    );
  };

  const removeCitation = async (citationId: string) => {
    if (!workspace) return;
    await run(
      "citations",
      () => replaceAudioCitations(workspace, citationIds.filter((id) => id !== citationId)),
      "Citation removed.",
    );
  };

  const addCredit = async (selection: EditorialCreditSelection) => {
    if (!workspace) return;
    await run(
      "credits",
      async () => {
        const resolved = await resolveEditorialCredit(selection);
        await replaceAudioCredits(
          workspace,
          [...new Set([...creditIds, resolved.creditId])],
        );
      },
      "Credit attached.",
    );
  };

  const removeCredit = async (creditId: string) => {
    if (!workspace) return;
    await run(
      "credits",
      () => replaceAudioCredits(workspace, creditIds.filter((id) => id !== creditId)),
      "Credit removed.",
    );
  };

  if (loading) {
    return <div className="min-h-[45vh]" aria-busy="true" aria-label="Loading Audio Editor" />;
  }

  if (!publicationId || !workspace) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <WkSurface className="p-6">
          <p className="text-sm font-bold text-wk-text">This Audio publication could not be opened.</p>
          <Link to="/admin/content/audio" className="mt-3 inline-flex text-sm font-bold text-wk-brand">
            Back to Audio
          </Link>
        </WkSurface>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-4 p-4 sm:p-6 lg:p-8">
      <AdminRecordHeader
        collectionLabel="Audio"
        title={workspace.publication.title}
        status={workspace.publication.status}
        onBack={() => navigate("/admin/content/audio")}
        meta={
          <span>
            {workspace.publication.publicationKind === "episode"
              ? "Show Episode"
              : "Standalone Audio"}
          </span>
        }
        actions={
          <>
            <AdminSaveState
              isDirty={workingDirty}
              isSaving={isSaving}
              locked={!editable}
              lockedLabel={`${humanize(workspace.publication.status)} Version`}
            />

            {editable ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleSaveWorkingVersion}
                title="Save Audio edits and snapshot the working version."
                className="wk-button wk-button-secondary wk-button-sm disabled:opacity-50"
              >
                <WkIcon name="Save" size={14} />
                Save
              </button>
            ) : null}

            {canSubmit ? (
              <button
                type="button"
                disabled={busy !== null || workingDirty}
                title={workingDirty ? "Save changes before submitting for Review." : undefined}
                onClick={() =>
                  run(
                    "submit",
                    () => submitAudioForReview(workspace, reviewNote),
                    "Sent to Review.",
                  )
                }
                className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
              >
                <WkIcon name="Send" size={14} />
                Submit for Review
              </button>
            ) : null}

            {workspace.canManageReview && workspace.publication.status === "ready_for_review" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    "review-start",
                    () => reviewAudio(workspace, "start_review", reviewNote),
                    "Review started.",
                  )
                }
                className="wk-button wk-button-secondary wk-button-sm disabled:opacity-50"
              >
                Start Review
              </button>
            ) : null}

            {workspace.canManageReview && workspace.publication.status === "in_review" ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    run(
                      "review-changes",
                      () => reviewAudio(workspace, "request_changes", reviewNote),
                      "Changes requested.",
                    )
                  }
                  className="wk-button wk-button-ghost wk-button-sm text-wk-warning disabled:opacity-50"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    run(
                      "review-approve",
                      () => reviewAudio(workspace, "approve", reviewNote),
                      "Audio approved.",
                    )
                  }
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
                >
                  Approve
                </button>
              </>
            ) : null}

            {workspace.canPublish && workspace.publication.status === "approved" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    "publish",
                    () => publishAudio(workspace, reviewNote),
                    "Audio published.",
                  )
                }
                className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
              >
                Publish
              </button>
            ) : null}
          </>
        }
      />

      <EditorialWorkflowRail
        activeId={view}
        onChange={(id) => setView(id as WorkspaceView)}
        groups={[
          { label: "Compose", items: [{ id: "details", label: "Details" }, { id: "sound", label: "Sound & Chapters" }] },
          { label: "Prepare", items: [{ id: "trust", label: "Credits & Citations" }] },
          { label: "Workflow", items: [{ id: "review", label: "Review" }] },
          { label: "Record", items: [{ id: "history", label: "History" }] },
        ]}
      />

      {message ? (
        <div role="status" className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text">
          {message}
        </div>
      ) : null}

      {auxiliaryMessage ? (
        <div role="status" className="rounded-xl border border-wk-warning/25 bg-wk-warning-soft px-4 py-3 text-xs text-wk-warning">
          {auxiliaryMessage}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          {view === "details" ? (
            <AdminWorkspaceSection
              icon="FileText"
              title="Publication"
              note="Edit the title and summary here. WAKILISHA keeps the public URL stable."
            >
              <form className="space-y-4" onSubmit={handleMetadata}>
                <label className="block text-xs font-bold text-wk-text-muted">
                  Title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={!editable}
                    required
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                  />
                </label>

                <label className="block text-xs font-bold text-wk-text-muted">
                  Summary
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    disabled={!editable}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                  />
                </label>

                {editable ? (
                  <button type="submit" disabled={busy !== null} className="wk-button wk-button-primary wk-button-sm disabled:opacity-50">
                    Save Details
                  </button>
                ) : null}
              </form>
            </AdminWorkspaceSection>
          ) : null}

          {view === "sound" ? (
            <div className="space-y-5">
              <AdminWorkspaceSection
                icon="Music"
                title="Sound and Transcript"
                note="Choose exact Media revisions. Review keeps those selections with the version."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
                    <p className="text-xs font-black text-wk-text">Master Audio</p>
                    <p className="mt-2 text-xs text-wk-text-muted">
                      {workspace.master ? `Media ${compactId(workspace.master.assetId)}` : "No master selected."}
                    </p>
                    <p className="mt-1 text-[11px] text-wk-text-muted">
                      {workspace.master?.audioDeliveryVariantId
                        ? "Full-length delivery is ready."
                        : "Choose a master before Review."}
                    </p>
                    {editable ? (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setPicker("master")} className="wk-button wk-button-ghost wk-button-sm">
                          {workspace.master ? "Replace Master" : "Choose Master"}
                        </button>
                        {workspace.master ? (
                          <button
                            type="button"
                            onClick={() => run("master", () => setAudioMaster(workspace, null), "Master cleared.")}
                            className="wk-button wk-button-ghost wk-button-sm text-wk-danger"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
                    <p className="text-xs font-black text-wk-text">Transcript</p>
                    <p className="mt-2 text-xs text-wk-text-muted">
                      {workspace.transcript ? `Media ${compactId(workspace.transcript.assetId)}` : "No transcript selected."}
                    </p>
                    <p className="mt-1 text-[11px] text-wk-text-muted">
                      A public Transcript must pass Media safety checks before publication.
                    </p>
                    {editable ? (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setPicker("transcript")} className="wk-button wk-button-ghost wk-button-sm">
                          {workspace.transcript ? "Replace Transcript" : "Choose Transcript"}
                        </button>
                        {workspace.transcript ? (
                          <button
                            type="button"
                            onClick={() => run("transcript", () => setAudioTranscript(workspace, null), "Transcript cleared.")}
                            className="wk-button wk-button-ghost wk-button-sm text-wk-danger"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {mediaContext?.deliveryUrl ? (
                  <div className="mt-5 space-y-3 border-t border-wk-border pt-5">
                    <audio
                      ref={audioRef}
                      controls
                      preload="metadata"
                      src={mediaContext.deliveryUrl}
                      onTimeUpdate={(event) => {
                        const next = event.currentTarget.currentTime;
                        setPlayhead(next);
                        setChapterCursor(next);
                      }}
                      onSeeked={(event) => {
                        const next = event.currentTarget.currentTime;
                        setPlayhead(next);
                        setChapterCursor(next);
                      }}
                      className="w-full"
                    />

                    <MediaTimeline
                      waveformUrl={mediaContext.waveformUrl}
                      durationSeconds={mediaContext.durationSeconds}
                      currentTime={playhead}
                      interactive={editable}
                      onSeek={seekPreview}
                      onAnchorChange={(anchor) => setChapterCursor(anchor.startSeconds)}
                      chapters={chapters.map((chapter) => ({
                        id: chapter.id ?? `chapter-${chapter.chapterNumber}`,
                        timeSeconds: chapter.startSeconds,
                        label: chapter.title || `Chapter ${chapter.chapterNumber}`,
                      }))}
                    />

                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        ["Duration", mediaContext.durationSeconds ? secondsLabel(mediaContext.durationSeconds) : "Not available"],
                        ["Format", fact(sourceProbe.format_name)],
                        ["Codec", fact(audioStream.codec_name)],
                        ["Sample Rate", fact(audioStream.sample_rate)],
                        ["Channels", fact(audioStream.channels)],
                        ["Bitrate", fact(audioStream.bit_rate)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">{label}</p>
                          <p className="mt-1 text-xs font-bold text-wk-text">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </AdminWorkspaceSection>

              <AdminWorkspaceSection
                icon="ListMusic"
                title="Chapters"
                note="Move the playhead or click the timeline, then place each Chapter marker."
                actions={
                  editable ? (
                    <button type="button" onClick={addChapter} className="wk-button wk-button-ghost wk-button-sm">
                      <WkIcon name="Plus" size={14} />
                      Add at {secondsLabel(chapterCursor || playhead)}
                    </button>
                  ) : null
                }
              >
                <div className="space-y-2">
                  {chapters.map((chapter, index) => (
                    <div
                      key={`${chapter.id ?? "new"}-${index}`}
                      className="grid gap-2 rounded-xl border border-wk-border bg-wk-bg p-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div>
                        <p className="font-mono text-xs font-bold text-wk-brand">{secondsLabel(chapter.startSeconds)}</p>
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => updateChapter(index, { startSeconds: chapterCursor || playhead })}
                            className="mt-1 text-[10px] font-bold text-wk-text-muted hover:text-wk-brand"
                          >
                            Set at Playhead
                          </button>
                        ) : null}
                      </div>

                      <input
                        value={chapter.title}
                        disabled={!editable}
                        onChange={(event) => updateChapter(index, { title: event.target.value })}
                        placeholder={`Chapter ${index + 1}`}
                        className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-sm text-wk-text"
                      />

                      {editable ? (
                        <button
                          type="button"
                          onClick={() => removeChapter(index)}
                          className="rounded-lg p-2 text-wk-danger hover:bg-wk-danger-soft"
                          aria-label={`Remove Chapter ${index + 1}`}
                        >
                          <WkIcon name="Trash2" size={15} />
                        </button>
                      ) : null}
                    </div>
                  ))}

                  {!chapters.length ? (
                    <p className="rounded-xl border border-dashed border-wk-border px-4 py-7 text-center text-xs text-wk-text-muted">
                      No Chapters yet. Move the playhead to the first marker and add one.
                    </p>
                  ) : null}
                </div>

                {editable ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={saveChapters}
                    className="wk-button wk-button-primary wk-button-sm mt-4 disabled:opacity-50"
                  >
                    Save Chapters
                  </button>
                ) : null}
              </AdminWorkspaceSection>
            </div>
          ) : null}

          {view === "trust" ? (
            <AdminWorkspaceSection
              icon="Quote"
              title="Credits and Citations"
              note="Choose governed Trust records by name. Database identities stay behind the attachment controls."
            >
              {!workspace.versions.working ? (
                <div className="mb-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs text-wk-text-muted">
                  Save a working version before changing Credits or Citations.
                </div>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-black text-wk-text">Credits</h3>
                  <div className="mt-2 space-y-2">
                    {workspace.trust.credits.map((credit) => (
                      <div key={credit.attachmentId} className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-wk-text">{credit.displayName}</span>
                          <span className="block text-[11px] text-wk-text-muted">
                            {credit.roleLabel || humanize(credit.creditRole)}
                          </span>
                        </span>
                        {editable ? (
                          <button type="button" onClick={() => removeCredit(credit.creditId)} className="text-wk-danger" aria-label={`Remove Credit for ${credit.displayName}`}>
                            <WkIcon name="X" size={14} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {editable && workspace.versions.working ? (
                    creditPickerOptions ? (
                      <EditorialCreditPicker
                        roles={creditPickerOptions.roles}
                        parties={creditPickerOptions.parties}
                        canCreateCredit={creditPickerOptions.canCreateCredit}
                        disabled={busy !== null}
                        onAttach={(selection) => void addCredit(selection)}
                      />
                    ) : (
                      <p className="mt-3 rounded-lg border border-dashed border-wk-border px-3 py-3 text-xs text-wk-text-muted">
                        Credit identity tools are temporarily unavailable. The Audio record remains editable.
                      </p>
                    )
                  ) : null}
                </div>

                <div>
                  <h3 className="text-xs font-black text-wk-text">Citations</h3>
                  <div className="mt-2 space-y-2">
                    {workspace.trust.citations.map((citation) => (
                      <div key={citation.attachmentId} className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-wk-text">
                            {citation.publicLabel || "Citation"}
                          </span>
                          <span className="block text-[11px] text-wk-text-muted">{humanize(citation.citationPurpose)}</span>
                        </span>
                        {editable ? (
                          <button type="button" onClick={() => removeCitation(citation.citationId)} className="text-wk-danger" aria-label="Remove Citation">
                            <WkIcon name="X" size={14} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {editable && workspace.versions.working ? (
                    <TrustAttachmentPicker
                      noun="Citation"
                      options={citationCandidates}
                      attachedIds={citationIds}
                      disabled={busy !== null}
                      onAttach={(id) => void addCitation(id)}
                    />
                  ) : null}
                </div>
              </div>
            </AdminWorkspaceSection>
          ) : null}

          {view === "review" ? (
            <div aria-label="Review always targets one exact immutable version.">
              <AudioReviewWorkspace
                publicationId={workspace.publication.id}
                decisionNote={reviewNote}
                onDecisionNoteChange={setReviewNote}
              />
            </div>
          ) : null}

          {view === "history" ? (
            <AdminWorkspaceSection
              icon="History"
              title="History"
              note="Lifecycle decisions for this Audio publication."
            >
              <div className="space-y-4">
                {workspace.reviewEvents.slice().reverse().map((event) => (
                  <div key={event.id} className="border-l-2 border-wk-border pl-4">
                    <p className="text-xs font-black text-wk-text">{humanize(event.action)}</p>
                    <p className="mt-1 text-[11px] text-wk-text-muted">
                      {humanize(event.priorStatus ?? "draft")} {" → "} {humanize(event.resultingStatus)}
                    </p>
                    {event.reason ? <p className="mt-1 text-xs text-wk-text">{event.reason}</p> : null}
                  </div>
                ))}

                {!workspace.reviewEvents.length ? (
                  <p className="text-xs text-wk-text-muted">Review has not started.</p>
                ) : null}
              </div>
            </AdminWorkspaceSection>
          ) : null}
        </main>

        <aside className="space-y-4">
          <AdminWorkspaceSection icon="GitCommitHorizontal" title="Versions" note="Saved lifecycle versions for this Audio publication.">
            <div className="space-y-2">
              {[
                ["Working", workspace.versions.working],
                ["Submitted", workspace.versions.submitted],
                ["Approved", workspace.versions.approved],
                ["Published", workspace.versions.published],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 font-bold text-wk-text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${value ? "bg-wk-success" : "bg-wk-border"}`} />
                    {label}
                  </span>
                  <span className="font-mono text-[10px] text-wk-text">{compactId(value)}</span>
                </div>
              ))}
            </div>
          </AdminWorkspaceSection>

          {workspace.feedIdentity ? (
            <AdminWorkspaceSection icon="Podcast" title="Podcast Delivery" note="Stable delivery identity for podcast clients.">
              <dl className="space-y-3">
                <div>
                  <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-muted">GUID</dt>
                  <dd className="mt-1 break-all font-mono text-[10px] text-wk-text">{workspace.feedIdentity.guid}</dd>
                </div>
                <div>
                  <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-muted">Enclosure</dt>
                  <dd className="mt-1 break-all font-mono text-[10px] text-wk-text">{workspace.feedIdentity.enclosureUrl}</dd>
                </div>
              </dl>
            </AdminWorkspaceSection>
          ) : null}
        </aside>
      </div>

      <MediaPickerModal
        open={picker === "master"}
        onClose={() => setPicker(null)}
        title="Choose Master Audio"
        allowedKinds={["audio"]}
        onSelect={(assetId) => {
          setPicker(null);
          if (!assetId) {
            setMessage("Register the Audio in Media before selecting it.");
            return;
          }
          void run("master", () => setAudioMaster(workspace, assetId), "Master audio selected.");
        }}
      />

      <MediaPickerModal
        open={picker === "transcript"}
        onClose={() => setPicker(null)}
        title="Choose Transcript"
        allowedKinds={["transcript"]}
        onSelect={(assetId) => {
          setPicker(null);
          if (!assetId) {
            setMessage("Register the Transcript in Media before selecting it.");
            return;
          }
          void run("transcript", () => setAudioTranscript(workspace, assetId), "Transcript selected.");
        }}
      />
    </div>
  );
}
