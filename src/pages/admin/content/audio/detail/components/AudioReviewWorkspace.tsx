import { useEffect, useMemo, useRef, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import { EditorialCommentEditor } from "@/components/design-system/editorial/EditorialCommentEditor";
import { MediaTimeline, type TimelineAnchor } from "@/components/design-system/editorial/MediaTimeline";
import { MediaTransport, formatMediaTime } from "@/components/design-system/editorial/MediaTransport";
import {
  addAudioReviewComment,
  createAudioTimeReviewThread,
  fetchAudioEditorialWorkbench,
  setAudioReviewThreadStatus,
  type AudioEditorialWorkbench,
} from "@/services/audio/audioReviewService";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function probeFact(probe: Record<string, unknown>, key: string): string | null {
  const value = probe[key];
  return value == null || value === "" ? null : String(value);
}

function audioStream(probe: Record<string, unknown>): Record<string, unknown> {
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  return object(streams.find((value) => object(value).codec_type === "audio"));
}

function anchorLabel(kind: "time_point" | "time_range", start: number, end: number | null) {
  return kind === "time_range" && end != null
    ? `${formatMediaTime(start)}–${formatMediaTime(end)}`
    : formatMediaTime(start);
}

export function AudioReviewWorkspace({
  publicationId,
  decisionNote,
  onDecisionNoteChange,
}: {
  publicationId: string;
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [workbench, setWorkbench] = useState<AudioEditorialWorkbench | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [anchor, setAnchor] = useState<TimelineAnchor | null>(null);
  const [commentHtml, setCommentHtml] = useState("");
  const [commentText, setCommentText] = useState("");
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyHtml, setReplyHtml] = useState("");
  const [replyText, setReplyText] = useState("");

  const reload = async () => {
    setWorkbench(await fetchAudioEditorialWorkbench(publicationId));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAudioEditorialWorkbench(publicationId)
      .then((next) => {
        if (alive) setWorkbench(next);
      })
      .catch((reason) => {
        if (alive) setMessage(reason instanceof Error ? reason.message : "Audio Review could not load.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [publicationId]);

  const target = workbench?.targetVersion ?? null;
  const duration = target?.durationSeconds ?? 0;
  const markers = useMemo(
    () => (workbench?.threads ?? []).map((thread) => ({
      id: thread.id,
      timeSeconds: thread.anchorStartSeconds,
      label: thread.comments[0]?.bodyText || "Review comment",
      status: thread.status,
    })),
    [workbench?.threads],
  );
  const chapters = useMemo(
    () => (target?.chapters ?? []).map((chapter) => ({
      id: `chapter-${chapter.chapterNumber}`,
      timeSeconds: chapter.startSeconds,
      label: chapter.title || `Chapter ${chapter.chapterNumber}`,
    })),
    [target?.chapters],
  );
  const stream = audioStream(target?.sourceProbe ?? {});

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    const next = Math.min(Math.max(0, seconds), Math.max(duration, audio?.duration || 0));
    if (audio) audio.currentTime = next;
    setCurrentTime(next);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const createThread = async () => {
    if (!target || !anchor || !commentText.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await createAudioTimeReviewThread({
        publicationId,
        targetVersionId: target.id,
        anchorKind: anchor.kind,
        anchorStartSeconds: anchor.startSeconds,
        anchorEndSeconds: anchor.kind === "time_range" ? anchor.endSeconds : null,
        bodyHtml: commentHtml,
        bodyText: commentText,
      });
      setCommentHtml("");
      setCommentText("");
      setAnchor(null);
      await reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Review comment failed.");
    } finally {
      setBusy(false);
    }
  };

  const addReply = async (threadId: string) => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await addAudioReviewComment({ threadId, bodyHtml: replyHtml, bodyText: replyText });
      setReplyThreadId(null);
      setReplyHtml("");
      setReplyText("");
      await reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Review reply failed.");
    } finally {
      setBusy(false);
    }
  };

  const changeThreadStatus = async (threadId: string, status: "open" | "resolved") => {
    setBusy(true);
    try {
      await setAudioReviewThreadStatus(threadId, status);
      await reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Thread status failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-[320px]" aria-busy="true" aria-label="Loading Audio Review" />;
  }

  if (!target) {
    return (
      <AdminWorkspaceSection icon="MessageSquareMore" title="Review" note="Review always targets one exact immutable submitted version.">
        <div className="rounded-xl border border-dashed border-wk-border px-5 py-10 text-center">
          <p className="text-sm font-black text-wk-text">No submitted Audio version is available.</p>
          <p className="mt-2 text-xs text-wk-text-muted">Save the working record and submit it for Review before adding time-anchored editorial feedback.</p>
        </div>
      </AdminWorkspaceSection>
    );
  }

  return (
    <div className="space-y-5">
      {message ? <div role="status" className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-xs text-wk-text">{message}</div> : null}

      <AdminWorkspaceSection icon="AudioLines" title={`Review submitted version v${target.versionNumber}`} note="Listen and comment against the exact immutable master that was submitted.">
        <audio
          ref={audioRef}
          src={target.deliveryUrl ?? undefined}
          preload="metadata"
          className="hidden"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
        />
        <MediaTransport
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          onToggle={() => void togglePlayback()}
          onSeekBy={(delta) => seek(currentTime + delta)}
          onPlaybackRateChange={changeRate}
        />
        <div className="mt-4">
          <MediaTimeline
            waveformUrl={target.waveformUrl}
            durationSeconds={duration}
            currentTime={currentTime}
            anchor={anchor}
            markers={markers}
            chapters={chapters}
            onSeek={seek}
            onAnchorChange={setAnchor}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Format", probeFact(target.sourceProbe, "format_name")],
            ["Codec", probeFact(stream, "codec_name")],
            ["Sample rate", probeFact(stream, "sample_rate")],
            ["Channels", probeFact(stream, "channels")],
            ["Bitrate", probeFact(stream, "bit_rate")],
            ["Duration", formatMediaTime(duration)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{label}</p>
              <p className="mt-1 text-xs font-bold text-wk-text">{value || "Not reported"}</p>
            </div>
          ))}
        </div>
      </AdminWorkspaceSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AdminWorkspaceSection icon="MessageSquarePlus" title="Anchored feedback" note="Click the waveform for a point or drag a range, then add rich editorial feedback.">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAnchor({ kind: "time_point", startSeconds: currentTime, endSeconds: null })} className="wk-button wk-button-ghost wk-button-sm">
              <WkIcon name="MapPin" size={14} />Comment at playhead
            </button>
            {anchor ? (
              <span className="rounded-full bg-wk-brand-soft px-3 py-1 text-[10px] font-black text-wk-brand">
                {anchorLabel(anchor.kind, anchor.startSeconds, anchor.kind === "time_range" ? anchor.endSeconds : null)}
              </span>
            ) : null}
          </div>
          <EditorialCommentEditor
            value={commentHtml}
            onChange={setCommentHtml}
            onPlainTextChange={setCommentText}
            placeholder="What should the editor or engineer hear here?"
          />
          <button type="button" disabled={busy || !anchor || !commentText.trim()} onClick={() => void createThread()} className="wk-button wk-button-primary wk-button-sm mt-3 disabled:opacity-50">
            <WkIcon name="MessageSquarePlus" size={14} />Add anchored comment
          </button>
          <label className="mt-6 block text-xs font-bold text-wk-text-muted">
            Lifecycle decision note
            <textarea
              value={decisionNote}
              onChange={(event) => onDecisionNoteChange(event.target.value)}
              rows={2}
              placeholder="Used only when requesting changes or making a lifecycle decision."
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
            />
          </label>
        </AdminWorkspaceSection>

        <AdminWorkspaceSection icon="MessagesSquare" title="Review threads" note={`${workbench?.threads.length ?? 0} thread${(workbench?.threads.length ?? 0) === 1 ? "" : "s"} on this submitted version.`}>
          <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {workbench?.threads.map((thread) => (
              <article key={thread.id} className={`rounded-xl border p-3 ${thread.status === "open" ? "border-wk-brand/30 bg-wk-brand-soft/20" : "border-wk-border bg-wk-bg"}`}>
                <button type="button" onClick={() => seek(thread.anchorStartSeconds)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="font-mono text-xs font-black text-wk-brand">{anchorLabel(thread.anchorKind, thread.anchorStartSeconds, thread.anchorEndSeconds)}</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{thread.status}</span>
                </button>
                <div className="mt-3 space-y-3">
                  {thread.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-wk-text">{comment.createdByLabel}</span>
                        <span className="text-[9px] text-wk-text-faint">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}</span>
                      </div>
                      <EditorialCommentEditor value={comment.bodyHtml} readOnly minHeight={28} />
                    </div>
                  ))}
                </div>
                {replyThreadId === thread.id ? (
                  <div className="mt-3 space-y-2">
                    <EditorialCommentEditor value={replyHtml} onChange={setReplyHtml} onPlainTextChange={setReplyText} placeholder="Reply…" minHeight={72} />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy || !replyText.trim()} onClick={() => void addReply(thread.id)} className="wk-button wk-button-primary wk-button-sm disabled:opacity-50">Reply</button>
                      <button type="button" onClick={() => setReplyThreadId(null)} className="wk-button wk-button-ghost wk-button-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setReplyThreadId(thread.id); setReplyHtml(""); setReplyText(""); }} className="wk-button wk-button-ghost wk-button-sm">
                      <WkIcon name="Reply" size={13} />Reply
                    </button>
                    <button type="button" disabled={busy} onClick={() => void changeThreadStatus(thread.id, thread.status === "open" ? "resolved" : "open")} className="wk-button wk-button-ghost wk-button-sm">
                      <WkIcon name={thread.status === "open" ? "CheckCircle2" : "RotateCcw"} size={13} />{thread.status === "open" ? "Resolve" : "Reopen"}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!workbench?.threads.length ? <div className="rounded-xl border border-dashed border-wk-border px-4 py-8 text-center text-xs text-wk-text-muted">No anchored feedback yet.</div> : null}
          </div>
        </AdminWorkspaceSection>
      </div>
    </div>
  );
}
