import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
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

type PickerKind = "master" | "transcript" | null;

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

function WorkflowPill({ value }: { value: string }) {
  const classes =
    value === "published" || value === "approved"
      ? "bg-wk-success-soft text-wk-success"
      : value === "ready_for_review" || value === "in_review"
        ? "bg-wk-info-soft text-wk-info"
        : value === "changes_requested"
          ? "bg-wk-warning-soft text-wk-warning"
          : "bg-wk-surface-raised text-wk-text-muted";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${classes}`}>
      {humanize(value)}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  note,
}: {
  icon: "FileText" | "Music" | "ListMusic" | "Quote" | "GitPullRequest";
  title: string;
  note: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
        <WkIcon name={icon} size={15} />
      </span>
      <div>
        <h2 className="text-sm font-black text-wk-text">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-wk-text-muted">{note}</p>
      </div>
    </div>
  );
}

export function AudioEditorWorkspace({
  publicationId,
}: {
  publicationId?: string;
}) {
  const [workspace, setWorkspace] =
    useState<AudioPublicationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerKind>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [chapters, setChapters] = useState<AudioChapter[]>([]);
  const [citationInput, setCitationInput] = useState("");
  const [creditInput, setCreditInput] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const reload = async () => {
    if (!publicationId) return;
    const next = await fetchAudioPublicationWorkspace(publicationId);
    setWorkspace(next);
    setTitle(next.publication.title);
    setSlug(next.publication.slug);
    setSummary(next.publication.summary ?? "");
    setChapters(next.chapters);
  };

  useEffect(() => {
    let alive = true;
    if (!publicationId) {
      setLoading(false);
      return;
    }
    fetchAudioPublicationWorkspace(publicationId)
      .then((next) => {
        if (!alive) return;
        setWorkspace(next);
        setTitle(next.publication.title);
        setSlug(next.publication.slug);
        setSummary(next.publication.summary ?? "");
        setChapters(next.chapters);
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
  }, [publicationId]);

  const editable =
    workspace?.canEdit === true
    && ["draft", "changes_requested"].includes(workspace.publication.status);

  const canSubmit =
    workspace?.canEdit === true
    && ["draft", "changes_requested"].includes(workspace.publication.status)
    && Boolean(workspace.master?.audioDeliveryVariantId);

  const citationIds = useMemo(
    () => workspace?.trust.citations.map((item) => item.citationId) ?? [],
    [workspace?.trust.citations],
  );
  const creditIds = useMemo(
    () => workspace?.trust.credits.map((item) => item.creditId) ?? [],
    [workspace?.trust.credits],
  );

  const run = async (key: string, action: () => Promise<void>, success: string) => {
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

  const handleMetadata = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    await run(
      "metadata",
      () => saveAudioMetadata(workspace, { title, slug, summary }),
      "Audio details saved.",
    );
  };

  const handleWorkingSnapshot = async () => {
    if (!workspace) return;
    await run(
      "snapshot",
      () => snapshotAudioWorkingVersion(workspace),
      "Working version saved.",
    );
  };

  const addChapter = () => {
    const last = chapters.at(-1);
    setChapters((current) => [
      ...current,
      {
        chapterNumber: current.length + 1,
        startSeconds: last ? last.startSeconds + 60 : 0,
        title: "",
        chapterUrl: null,
        imageUrl: null,
      },
    ]);
  };

  const updateChapter = (
    index: number,
    patch: Partial<AudioChapter>,
  ) => {
    setChapters((current) =>
      current.map((chapter, chapterIndex) =>
        chapterIndex === index
          ? { ...chapter, ...patch, chapterNumber: chapterIndex + 1 }
          : { ...chapter, chapterNumber: chapterIndex + 1 },
      ),
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

  const addCitation = async () => {
    if (!workspace || !citationInput.trim()) return;
    await run(
      "citations",
      () =>
        replaceAudioCitations(
          workspace,
          [...new Set([...citationIds, citationInput.trim()])],
        ),
      "Citation attached.",
    );
    setCitationInput("");
  };

  const removeCitation = async (citationId: string) => {
    if (!workspace) return;
    await run(
      "citations",
      () =>
        replaceAudioCitations(
          workspace,
          citationIds.filter((id) => id !== citationId),
        ),
      "Citation removed.",
    );
  };

  const addCredit = async () => {
    if (!workspace || !creditInput.trim()) return;
    await run(
      "credits",
      () =>
        replaceAudioCredits(
          workspace,
          [...new Set([...creditIds, creditInput.trim()])],
        ),
      "Credit attached.",
    );
    setCreditInput("");
  };

  const removeCredit = async (creditId: string) => {
    if (!workspace) return;
    await run(
      "credits",
      () =>
        replaceAudioCredits(
          workspace,
          creditIds.filter((id) => id !== creditId),
        ),
      "Credit removed.",
    );
  };

  if (loading) {
    return (
      <div
        className="min-h-[45vh]"
        aria-busy="true"
        aria-label="Loading Audio Editor"
      />
    );
  }

  if (!publicationId || !workspace) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <WkSurface className="p-6">
          <p className="text-sm font-bold text-wk-text">
            This Audio publication could not be opened.
          </p>
          <Link
            to="/admin/content/audio"
            className="mt-3 inline-flex text-sm font-bold text-wk-brand"
          >
            Back to Audio
          </Link>
        </WkSurface>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-wk-border pb-5">
        <div>
          <Link
            to="/admin/content/audio"
            className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-wk-text-muted hover:text-wk-brand"
          >
            <WkIcon name="ChevronLeft" size={14} />
            Audio
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-wk-text">
              {workspace.publication.title}
            </h1>
            <WorkflowPill value={workspace.publication.status} />
          </div>
          <p className="mt-2 text-sm text-wk-text-muted">
            {workspace.publication.publicationKind === "episode"
              ? "Episode"
              : "Standalone Audio"}
            {" · "}
            Revision {workspace.publication.authorityRevision}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {editable ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleWorkingSnapshot}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-xs font-black text-wk-text disabled:opacity-50"
            >
              Save Working Version
            </button>
          ) : null}
          {canSubmit ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "submit",
                  () => submitAudioForReview(workspace, reviewNote),
                  "Sent to Review.",
                )
              }
              className="rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on disabled:opacity-50"
            >
              Send to Review
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text"
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <WkSurface className="p-5">
            <SectionHeader
              icon="FileText"
              title="Publication"
              note="These are the words and permanent path attached to this recording."
            />
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleMetadata}>
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
                Slug
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  disabled={!editable}
                  required
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                />
              </label>
              <label className="block text-xs font-bold text-wk-text-muted sm:col-span-2">
                Summary
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  disabled={!editable}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text disabled:opacity-60"
                />
              </label>
              {editable ? (
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on disabled:opacity-50"
                  >
                    Save Details
                  </button>
                </div>
              ) : null}
            </form>
          </WkSurface>

          <WkSurface className="p-5">
            <SectionHeader
              icon="Music"
              title="Sound and Transcript"
              note="Choose exact Media revisions. Review locks these selections into the version history."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
                <p className="text-xs font-black text-wk-text">Master Audio</p>
                <p className="mt-2 text-xs text-wk-text-muted">
                  {workspace.master
                    ? `Media ${compactId(workspace.master.assetId)}`
                    : "No master selected."}
                </p>
                <p className="mt-1 text-[11px] text-wk-text-muted">
                  {workspace.master?.audioDeliveryVariantId
                    ? "Full-length delivery is ready."
                    : "A full-length delivery is required before Review."}
                </p>
                {editable ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPicker("master")}
                      className="rounded-lg border border-wk-border px-3 py-2 text-xs font-bold text-wk-text"
                    >
                      {workspace.master ? "Replace Master" : "Choose Master"}
                    </button>
                    {workspace.master ? (
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            "master",
                            () => setAudioMaster(workspace, null),
                            "Master cleared.",
                          )
                        }
                        className="rounded-lg px-3 py-2 text-xs font-bold text-wk-danger"
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
                  {workspace.transcript
                    ? `Media ${compactId(workspace.transcript.assetId)}`
                    : "No transcript selected."}
                </p>
                <p className="mt-1 text-[11px] text-wk-text-muted">
                  If present, the transcript must pass Media public-safety checks before publishing.
                </p>
                {editable ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPicker("transcript")}
                      className="rounded-lg border border-wk-border px-3 py-2 text-xs font-bold text-wk-text"
                    >
                      {workspace.transcript
                        ? "Replace Transcript"
                        : "Choose Transcript"}
                    </button>
                    {workspace.transcript ? (
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            "transcript",
                            () => setAudioTranscript(workspace, null),
                            "Transcript cleared.",
                          )
                        }
                        className="rounded-lg px-3 py-2 text-xs font-bold text-wk-danger"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeader
                icon="ListMusic"
                title="Chapters"
                note="Chapter times must rise in order. Saved versions keep their own immutable copy."
              />
              {editable ? (
                <button
                  type="button"
                  onClick={addChapter}
                  className="rounded-lg border border-wk-border px-3 py-2 text-xs font-black text-wk-text"
                >
                  Add Chapter
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              {chapters.map((chapter, index) => (
                <div
                  key={`${chapter.id ?? "new"}-${index}`}
                  className="grid gap-2 rounded-xl border border-wk-border bg-wk-bg p-3 sm:grid-cols-[80px_minmax(0,1fr)_auto]"
                >
                  <label className="text-[11px] font-bold text-wk-text-muted">
                    Start
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={chapter.startSeconds}
                      disabled={!editable}
                      onChange={(event) =>
                        updateChapter(index, {
                          startSeconds: Number(event.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2 py-2 text-sm text-wk-text"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-wk-text-muted">
                    Chapter {index + 1}
                    <input
                      value={chapter.title}
                      disabled={!editable}
                      onChange={(event) =>
                        updateChapter(index, { title: event.target.value })
                      }
                      placeholder="What starts here?"
                      className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-sm text-wk-text"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <span className="pb-2 text-[11px] font-bold text-wk-text-muted">
                      {secondsLabel(chapter.startSeconds)}
                    </span>
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => removeChapter(index)}
                        className="mb-0.5 rounded-lg p-2 text-wk-danger hover:bg-wk-danger-soft"
                        aria-label={`Remove Chapter ${index + 1}`}
                      >
                        <WkIcon name="Trash2" size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {chapters.length === 0 ? (
                <p className="rounded-xl border border-dashed border-wk-border px-4 py-7 text-center text-xs text-wk-text-muted">
                  No chapters yet.
                </p>
              ) : null}
            </div>
            {editable ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={saveChapters}
                className="mt-4 rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on disabled:opacity-50"
              >
                Save Chapters
              </button>
            ) : null}
          </WkSurface>

          <WkSurface className="p-5">
            <SectionHeader
              icon="Quote"
              title="Credits and Citations"
              note="Audio uses the same governed Trust records as the rest of WAKILISHA."
            />

            {!workspace.versions.working ? (
              <div className="mb-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs text-wk-text-muted">
                Save a working version before attaching Credits or Citations.
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-black text-wk-text">Credits</h3>
                <div className="mt-2 space-y-2">
                  {workspace.trust.credits.map((credit) => (
                    <div
                      key={credit.attachmentId}
                      className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-wk-text">
                          {credit.displayName || compactId(credit.creditId)}
                        </span>
                        <span className="block text-[11px] text-wk-text-muted">
                          {humanize(credit.creditRole)}
                          {credit.roleLabel ? ` · ${credit.roleLabel}` : ""}
                        </span>
                      </span>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => removeCredit(credit.creditId)}
                          className="text-wk-danger"
                          aria-label={`Remove Credit for ${credit.displayName}`}
                        >
                          <WkIcon name="X" size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {editable && workspace.versions.working ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={creditInput}
                      onChange={(event) => setCreditInput(event.target.value)}
                      placeholder="Existing Credit ID"
                      className="min-w-0 flex-1 rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-xs text-wk-text"
                    />
                    <button
                      type="button"
                      disabled={!creditInput.trim() || busy !== null}
                      onClick={addCredit}
                      className="rounded-lg border border-wk-border px-3 py-2 text-xs font-black text-wk-text disabled:opacity-50"
                    >
                      Attach
                    </button>
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="text-xs font-black text-wk-text">Citations</h3>
                <div className="mt-2 space-y-2">
                  {workspace.trust.citations.map((citation) => (
                    <div
                      key={citation.attachmentId}
                      className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-wk-text">
                          {citation.publicLabel || compactId(citation.citationId)}
                        </span>
                        <span className="block text-[11px] text-wk-text-muted">
                          {humanize(citation.citationPurpose)}
                        </span>
                      </span>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => removeCitation(citation.citationId)}
                          className="text-wk-danger"
                          aria-label="Remove Citation"
                        >
                          <WkIcon name="X" size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {editable && workspace.versions.working ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={citationInput}
                      onChange={(event) => setCitationInput(event.target.value)}
                      placeholder="Existing Citation ID"
                      className="min-w-0 flex-1 rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-xs text-wk-text"
                    />
                    <button
                      type="button"
                      disabled={!citationInput.trim() || busy !== null}
                      onClick={addCitation}
                      className="rounded-lg border border-wk-border px-3 py-2 text-xs font-black text-wk-text disabled:opacity-50"
                    >
                      Attach
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </WkSurface>
        </main>

        <aside className="space-y-5">
          <WkSurface className="p-5">
            <SectionHeader
              icon="GitPullRequest"
              title="Review"
              note="Review always targets one exact immutable version."
            />
            <label className="block text-xs font-bold text-wk-text-muted">
              Review Note
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
              />
            </label>

            <div className="mt-4 grid gap-2">
              {workspace.canManageReview
              && workspace.publication.status === "ready_for_review" ? (
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
                  className="rounded-lg border border-wk-border px-3 py-2 text-xs font-black text-wk-text"
                >
                  Start Review
                </button>
              ) : null}

              {workspace.canManageReview
              && workspace.publication.status === "in_review" ? (
                <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        "review-changes",
                        () =>
                          reviewAudio(
                            workspace,
                            "request_changes",
                            reviewNote,
                          ),
                        "Changes requested.",
                      )
                    }
                    className="rounded-lg border border-wk-warning px-3 py-2 text-xs font-black text-wk-warning"
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
                    className="rounded-lg bg-wk-success px-3 py-2 text-xs font-black text-white"
                  >
                    Approve
                  </button>
                </>
              ) : null}

              {workspace.canPublish
              && workspace.publication.status === "approved" ? (
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
                  className="rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on"
                >
                  Publish
                </button>
              ) : null}
            </div>

            <div className="mt-5 space-y-2 border-t border-wk-border pt-4">
              {[
                ["Working", workspace.versions.working],
                ["Submitted", workspace.versions.submitted],
                ["Approved", workspace.versions.approved],
                ["Published", workspace.versions.published],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-bold text-wk-text-muted">{label}</span>
                  <span className="font-mono text-[10px] text-wk-text">
                    {compactId(value)}
                  </span>
                </div>
              ))}
            </div>
          </WkSurface>

          {workspace.feedIdentity ? (
            <WkSurface className="p-5">
              <h2 className="text-sm font-black text-wk-text">
                Podcast Identity
              </h2>
              <p className="mt-1 text-xs leading-5 text-wk-text-muted">
                These stay stable when a later correction publishes a new version.
              </p>
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-[0.1em] text-wk-text-muted">
                    GUID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-[11px] text-wk-text">
                    {workspace.feedIdentity.guid}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-[0.1em] text-wk-text-muted">
                    Enclosure
                  </dt>
                  <dd className="mt-1 break-all font-mono text-[11px] text-wk-text">
                    {workspace.feedIdentity.enclosureUrl}
                  </dd>
                </div>
              </dl>
            </WkSurface>
          ) : null}

          <WkSurface className="p-5">
            <h2 className="text-sm font-black text-wk-text">History</h2>
            <div className="mt-4 space-y-3">
              {workspace.reviewEvents
                .slice()
                .reverse()
                .map((event) => (
                  <div
                    key={event.id}
                    className="border-l-2 border-wk-border pl-3"
                  >
                    <p className="text-xs font-black text-wk-text">
                      {humanize(event.action)}
                    </p>
                    <p className="mt-1 text-[11px] text-wk-text-muted">
                      {humanize(event.priorStatus ?? "draft")}
                      {" → "}
                      {humanize(event.resultingStatus)}
                    </p>
                  </div>
                ))}
              {workspace.reviewEvents.length === 0 ? (
                <p className="text-xs text-wk-text-muted">
                  Review has not started.
                </p>
              ) : null}
            </div>
          </WkSurface>
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
          void run(
            "master",
            () => setAudioMaster(workspace, assetId),
            "Master audio selected.",
          );
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
          void run(
            "transcript",
            () => setAudioTranscript(workspace, assetId),
            "Transcript selected.",
          );
        }}
      />
    </div>
  );
}
