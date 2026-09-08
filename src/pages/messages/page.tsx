import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useMessagesAccess } from "@/hooks/useMessagesAccess";
import {
  getFieldSubmissionIntake,
  type FieldIntakeDetail,
} from "@/services/fieldNewsroom";
import {
  reviewPlaylist,
} from "@/services/playlists/playlistAdminService";
import {
  acceptMessageRequest,
  declineMessageRequest,
  getMessageConversation,
  getMessagePlaylistReviewProjection,
  getMessageUnreadCounts,
  listMessageConversations,
  markMessageConversationRead,
  messageAvatar,
  messageDisplayName,
  messageUsername,
  moveMessageConversation,
  revokeMessageSenderApproval,
  searchMessageRecipients,
  sendMessage,
  startMessageConversation,
  type MessageConversationDetail,
  type MessageConversationSummary,
  type MessageFolder,
  type MessagePlaylistReviewProjection,
  type MessageRecipientSuggestion,
  type MessageResourceReference,
} from "@/services/messages";
import { MessageSafetyReportButton } from "./MessageSafetyReportButton";
import { MessageSafetyState } from "./MessageSafetyState";

const FOLDERS: Array<{ key: MessageFolder; label: string; icon: string }> = [
  { key: "inbox", label: "Inbox", icon: "ri-inbox-line" },
  { key: "requests", label: "Requests", icon: "ri-mail-add-line" },
  { key: "spam", label: "Spam", icon: "ri-spam-2-line" },
  { key: "archived", label: "Archive", icon: "ri-archive-line" },
];

function when(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ summary, size = "h-10 w-10" }: { summary: MessageConversationSummary; size?: string }) {
  const presentation = summary.other_participant?.presentation;
  const avatar = messageAvatar(presentation);
  const name = messageDisplayName(presentation);
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]`}>
      {avatar ? (
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[13px] font-black text-[var(--wk-brand)]">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

type ResolvedFieldReference = Pick<
  FieldIntakeDetail,
  "submission_reference" | "submission_state" | "current_revision"
>;

function GovernedResourceReferenceCard({
  reference,
  mine,
  onChanged,
}: {
  reference: MessageResourceReference;
  mine: boolean;
  onChanged?: () => Promise<void> | void;
}) {
  const [field, setField] = useState<ResolvedFieldReference | null>(null);
  const [playlist, setPlaylist] =
    useState<MessagePlaylistReviewProjection | null>(null);
  const [resolved, setResolved] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [changeNoteOpen, setChangeNoteOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const resolveReference = useCallback(async () => {
    setResolved(false);
    setField(null);
    setPlaylist(null);

    if (
      reference.presentation_kind === "resource"
      && !reference.resource_version_id
    ) {
      try {
        setField(
          await getFieldSubmissionIntake(reference.resource_id),
        );
      } catch {
        setField(null);
      } finally {
        setResolved(true);
      }
      return;
    }

    if (
      reference.presentation_kind === "version"
      && reference.resource_version_id
    ) {
      try {
        setPlaylist(
          await getMessagePlaylistReviewProjection(
            reference.resource_id,
            reference.resource_version_id,
          ),
        );
      } catch {
        setPlaylist(null);
      } finally {
        setResolved(true);
      }
      return;
    }

    setResolved(true);
  }, [
    reference.presentation_kind,
    reference.resource_id,
    reference.resource_version_id,
  ]);

  useEffect(() => {
    void resolveReference();
  }, [resolveReference]);

  const shellClass = mine
    ? "border-white/20 bg-white/10 text-white"
    : "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)]";
  const mutedClass = mine
    ? "text-white/75"
    : "text-[var(--wk-text-muted)]";

  async function performPlaylistDecision(
    decision: "start_review" | "request_changes" | "approve",
    note?: string,
  ) {
    if (
      !playlist
      || !reference.resource_version_id
      || decisionBusy
    ) {
      return;
    }

    setDecisionBusy(true);
    setDecisionError(null);

    try {
      await reviewPlaylist(
        playlist.playlist_id,
        reference.resource_version_id,
        playlist.authority_revision,
        decision,
        note,
      );
      setChangeNote("");
      setChangeNoteOpen(false);
      await resolveReference();
      await onChanged?.();
    } catch (reason) {
      setDecisionError(
        reason instanceof Error
          ? reason.message
          : "The Playlist Review action could not be completed.",
      );
      await resolveReference();
    } finally {
      setDecisionBusy(false);
    }
  }

  if (field) {
    return (
      <Link
        to={`/admin/field?submission=${encodeURIComponent(reference.resource_id)}`}
        className={`block rounded-xl border p-3 transition-colors hover:bg-black/5 ${shellClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.12em]">
              Field Submission
            </div>
            <div className="mt-1 truncate text-[11px] font-black">
              {field.submission_reference}
            </div>
            <div className={`mt-1 text-[9px] font-bold capitalize ${mutedClass}`}>
              {field.submission_state.replaceAll("_", " ")} · Revision {field.current_revision}
            </div>
          </div>
          <span className="shrink-0 text-[9px] font-black">
            Open in Field <i className="ri-arrow-right-up-line" />
          </span>
        </div>
      </Link>
    );
  }

  if (playlist) {
    const canStart =
      playlist.allowed_review_actions.includes("start_review");
    const canRequestChanges =
      playlist.allowed_review_actions.includes("request_changes");
    const canApprove =
      playlist.allowed_review_actions.includes("approve");

    return (
      <div className={`rounded-xl border p-3 ${shellClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.12em]">
              Playlist Review
            </div>
            <div className="mt-1 truncate text-[11px] font-black">
              {playlist.title}
            </div>
            <div className={`mt-1 text-[9px] font-bold capitalize ${mutedClass}`}>
              Version {playlist.version_number} · {playlist.playlist_status.replaceAll("_", " ")}
            </div>
          </div>
          <Link
            to={`/admin/content/playlists/${encodeURIComponent(playlist.playlist_id)}`}
            className="shrink-0 text-[9px] font-black"
          >
            Open Playlist <i className="ri-arrow-right-up-line" />
          </Link>
        </div>

        {!playlist.is_current_submitted && (
          <div className={`mt-2 text-[9px] font-bold ${mutedClass}`}>
            This version is no longer the current submitted version.
          </div>
        )}

        {(canStart || canRequestChanges || canApprove) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {canStart && (
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => void performPlaylistDecision("start_review")}
                className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
              >
                Start Review
              </button>
            )}
            {canRequestChanges && (
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => setChangeNoteOpen(true)}
                className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
              >
                Request Changes
              </button>
            )}
            {canApprove && (
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => void performPlaylistDecision("approve")}
                className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
              >
                Approve
              </button>
            )}
          </div>
        )}

        {changeNoteOpen && canRequestChanges && (
          <div className="mt-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2">
            <textarea
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What needs to change?"
              className="w-full resize-none bg-transparent px-2 py-2 text-[11px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={decisionBusy}
                onClick={() => {
                  setChangeNoteOpen(false);
                  setChangeNote("");
                }}
                className="wk-button wk-button-sm wk-button-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!changeNote.trim() || decisionBusy}
                onClick={() =>
                  void performPlaylistDecision(
                    "request_changes",
                    changeNote.trim(),
                  )
                }
                className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
              >
                Send Request
              </button>
            </div>
          </div>
        )}

        {decisionError && (
          <div className="mt-2 text-[9px] font-bold text-[var(--wk-danger)]">
            {decisionError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${shellClass}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.12em]">
        Governed Resource
      </div>
      <div className={`mt-1 text-[9px] font-bold ${mutedClass}`}>
        {resolved
          ? "Reference available through its owning workflow."
          : "Resolving owning workflow..."}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const authUser = useAuthUser();
  const messagesAccess = useMessagesAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversation");
  const requestedResourceId = searchParams.get("resource");
  const requestedResourceVersionId = searchParams.get("version");
  const requestedPresentation = searchParams.get("presentation");
  const requestedWorkflow = searchParams.get("workflow");
  const [folder, setFolder] = useState<MessageFolder>("inbox");
  const [conversations, setConversations] = useState<MessageConversationSummary[]>([]);
  const [unread, setUnread] = useState<Record<MessageFolder, number>>({ inbox: 0, requests: 0, spam: 0, archived: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageConversationDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MessageRecipientSuggestion[]>([]);
  const [recipient, setRecipient] = useState<MessageRecipientSuggestion | null>(null);
  const [newBody, setNewBody] = useState("");
  const [starting, setStarting] = useState(false);
  const [workflowReference, setWorkflowReference] =
    useState<MessageResourceReference | null>(null);
  const [workflowProjection, setWorkflowProjection] =
    useState<MessagePlaylistReviewProjection | null>(null);

  const selectedSummary = useMemo(
    () => conversations.find((item) => item.conversation_id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshCounts = useCallback(async () => {
    setUnread(await getMessageUnreadCounts());
  }, []);

  const refreshFolder = useCallback(async (nextFolder: MessageFolder, keepSelection = true) => {
    setLoadingList(true);
    setError(null);
    try {
      const rows = await listMessageConversations(nextFolder);
      setConversations(rows);
      if (!keepSelection) {
        setSelectedId(null);
        setDetail(null);
      } else {
        setSelectedId((current) => {
          if (current && !rows.some((row) => row.conversation_id === current)) {
            setDetail(null);
            return null;
          }
          return current;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Messages.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!authUser.loading && authUser.id) {
      void Promise.all([refreshFolder(folder), refreshCounts()]);
    }
  }, [authUser.id, authUser.loading, folder, refreshCounts, refreshFolder]);

  const openConversation = useCallback(async (conversationId: string) => {
    setSelectedId(conversationId);
    setLoadingDetail(true);
    setError(null);
    try {
      const next = await getMessageConversation(conversationId);
      setDetail(next);
      setFolder(next.conversation.mailbox_folder);
      await markMessageConversationRead(conversationId);
      await refreshCounts();
      setConversations((current) => current.map((row) => row.conversation_id === conversationId ? { ...row, unread_count: 0 } : row));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this Conversation.");
    } finally {
      setLoadingDetail(false);
    }
  }, [refreshCounts]);

  useEffect(() => {
    if (!messagesAccess.visible || loadingList || !requestedConversationId || selectedId === requestedConversationId) return;
    void openConversation(requestedConversationId);
  }, [loadingList, messagesAccess.visible, openConversation, requestedConversationId, selectedId]);

  const clearWorkflowIntent = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("resource");
    next.delete("version");
    next.delete("presentation");
    next.delete("workflow");
    setSearchParams(next, { replace: true });
    setWorkflowReference(null);
    setWorkflowProjection(null);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (
      !messagesAccess.visible
      || !messagesAccess.can_start
      || requestedWorkflow !== "playlist-review"
      || requestedPresentation !== "version"
      || !requestedResourceId
      || !requestedResourceVersionId
    ) {
      return;
    }

    let cancelled = false;

    getMessagePlaylistReviewProjection(
      requestedResourceId,
      requestedResourceVersionId,
    )
      .then((projection) => {
        if (cancelled) return;
        setWorkflowReference({
          resource_id: requestedResourceId,
          resource_version_id: requestedResourceVersionId,
          presentation_kind: "version",
        });
        setWorkflowProjection(projection);
        setNewOpen(true);
      })
      .catch((reason) => {
        if (cancelled) return;
        setWorkflowReference(null);
        setWorkflowProjection(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "This Playlist version cannot be attached to Messages.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    messagesAccess.can_start,
    messagesAccess.visible,
    requestedPresentation,
    requestedResourceId,
    requestedResourceVersionId,
    requestedWorkflow,
  ]);

  useEffect(() => {
    if (!newOpen || recipient || query.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchMessageRecipients(query);
        if (!cancelled) setSuggestions(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Recipient search failed.");
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [newOpen, query, recipient]);

  const performConversationAction = async (action: "accept" | "decline" | "spam" | "archive" | "inbox") => {
    if (!selectedId) return;
    setError(null);
    try {
      if (action === "accept") await acceptMessageRequest(selectedId);
      else if (action === "decline") await declineMessageRequest(selectedId);
      else await moveMessageConversation(selectedId, action === "archive" ? "archived" : action);
      const nextFolder: MessageFolder = action === "accept" || action === "inbox" ? "inbox" : action === "decline" || action === "archive" ? "archived" : "spam";
      setFolder(nextFolder);
      setSelectedId(null);
      setDetail(null);
      await Promise.all([refreshFolder(nextFolder, false), refreshCounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Messages action failed.");
    }
  };

  const handleSend = async () => {
    if (!messagesAccess.can_send || !selectedId || !composer.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(selectedId, composer.trim());
      setComposer("");
      await openConversation(selectedId);
      await refreshFolder(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const handleStart = async () => {
    if (!messagesAccess.can_start || !recipient || !newBody.trim() || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await startMessageConversation(
        recipient.person_resource_id,
        newBody.trim(),
        workflowReference ? [workflowReference] : [],
      );
      setNewOpen(false);
      setRecipient(null);
      setQuery("");
      setNewBody("");
      if (workflowReference) {
        clearWorkflowIntent();
      }
      const senderFolder: MessageFolder = "inbox";
      setFolder(senderFolder);
      await Promise.all([refreshFolder(senderFolder, false), refreshCounts()]);
      await openConversation(result.conversation_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversation could not be started.");
    } finally {
      setStarting(false);
    }
  };

  if (authUser.loading || messagesAccess.loading) {
    return <main className="min-h-[60vh]" aria-busy="true" aria-label="Loading Messages" />;
  }

  if (!messagesAccess.visible) {
    return (
      <main className="min-h-[60vh] bg-[var(--wk-bg)] px-5 py-16">
        <div className="mx-auto max-w-[520px] rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-center">
          <h1 className="text-[22px] font-black tracking-[-0.025em] text-[var(--wk-text)]">Messages</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
            Messages are not available for your account yet.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-80px)] bg-[var(--wk-bg)]">
      <div className="mx-auto w-full max-w-[1280px] px-3 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <div>
            <div className="text-[10px] font-black tracking-[0.18em] text-[var(--wk-brand)]">Private communication</div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)]">Messages</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/settings?section=Messages" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]" aria-label="Messages settings">
              <i className="ri-settings-3-line text-base" />
            </Link>
            <button type="button" onClick={() => setNewOpen(true)} disabled={!messagesAccess.can_start} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">
              <i className="ri-edit-2-line" /> New message
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-4 py-3 text-[12px] font-bold text-[var(--wk-danger)]">{error}</div>
        )}

        <MessageSafetyState />

        <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1.5 lg:max-w-[520px]">
          {FOLDERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setFolder(item.key); setSelectedId(null); setDetail(null); }}
              className={`relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-black transition-colors ${folder === item.key ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"}`}
            >
              <i className={`${item.icon} text-sm`} />
              <span>{item.label}</span>
              {unread[item.key] > 0 && (
                <span className="min-w-5 rounded-full bg-[var(--wk-brand)] px-1.5 py-0.5 text-[9px] font-black text-[var(--wk-brand-on)]">{unread[item.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-sm lg:grid lg:min-h-[650px] lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className={`${selectedId ? "hidden lg:block" : "block"} border-r-0 border-[var(--wk-divider)] lg:border-r`} aria-label={`${folder} conversations`}>
            {loadingList ? (
              <div className="space-y-2 p-3" aria-busy="true">
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"><i className="ri-mail-line text-xl" /></div>
                <h2 className="mt-4 text-[14px] font-black text-[var(--wk-text)]">Nothing here</h2>
                <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">This folder is quiet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--wk-divider)]">
                {conversations.map((summary) => {
                  const name = messageDisplayName(summary.other_participant?.presentation);
                  const username = messageUsername(summary.other_participant?.presentation);
                  return (
                    <button
                      key={summary.conversation_id}
                      type="button"
                      onClick={() => void openConversation(summary.conversation_id)}
                      className={`flex w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--wk-surface-raised)] ${selectedId === summary.conversation_id ? "bg-[var(--wk-brand-soft)]" : ""}`}
                    >
                      <Avatar summary={summary} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-[13px] font-black text-[var(--wk-text)]">{name}</div>
                          <span className="shrink-0 text-[10px] font-bold text-[var(--wk-text-faint)]">{when(summary.last_activity_at)}</span>
                        </div>
                        {username && <div className="truncate text-[10px] font-bold text-[var(--wk-text-faint)]">@{username}</div>}
                        <div className="mt-1 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[11px] text-[var(--wk-text-muted)]">{summary.latest_message?.body || "Message"}</p>
                          {summary.unread_count > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--wk-brand)]" aria-label={`${summary.unread_count} unread`} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`${selectedId ? "block" : "hidden lg:flex"} min-w-0 flex-col`} aria-label="Conversation">
            {!selectedId ? (
              <div className="flex min-h-[650px] flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"><i className="ri-chat-3-line text-2xl" /></div>
                <h2 className="mt-4 text-[16px] font-black text-[var(--wk-text)]">Choose a conversation</h2>
                <p className="mt-1 max-w-[300px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">Your conversations stay inside WAKILISHA Messages.</p>
              </div>
            ) : loadingDetail || !detail || !selectedSummary ? (
              <div className="min-h-[650px] flex-1 animate-pulse bg-[var(--wk-surface-raised)]/30" aria-busy="true" />
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-[var(--wk-divider)] px-3 py-3 sm:px-5">
                  <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] lg:hidden" aria-label="Back to conversations"><i className="ri-arrow-left-line" /></button>
                  <Avatar summary={selectedSummary} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-black text-[var(--wk-text)]">{messageDisplayName(selectedSummary.other_participant?.presentation)}</div>
                    <div className="text-[10px] font-bold tracking-[0.12em] text-[var(--wk-text-faint)]">{detail.conversation.security_classification}</div>
                  </div>
                  {detail.conversation.first_contact_state !== "pending" && selectedSummary.other_participant?.person_resource_id && (
                    <button
                      type="button"
                      onClick={() => void revokeMessageSenderApproval(selectedSummary.other_participant!.person_resource_id).catch((err) => setError(err instanceof Error ? err.message : "Could not revoke approval."))}
                      className="hidden rounded-full border border-[var(--wk-border)] px-3 py-2 text-[10px] font-black text-[var(--wk-text-muted)] sm:block"
                      title="This revokes future Inbox approval. It does not silently delete this Conversation."
                    >
                      Revoke future approval
                    </button>
                  )}
                </header>

                {detail.conversation.first_contact_state === "pending" && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--wk-divider)] bg-[var(--wk-bg-subtle)] px-4 py-3">
                    <span className="mr-auto text-[11px] font-bold text-[var(--wk-text-muted)]">Message request</span>
                    <button type="button" onClick={() => void performConversationAction("spam")} className="wk-button wk-button-sm wk-button-ghost">Spam</button>
                    <button type="button" onClick={() => void performConversationAction("decline")} className="wk-button wk-button-sm wk-button-ghost">Decline</button>
                    <button type="button" onClick={() => void performConversationAction("accept")} className="wk-button wk-button-sm wk-button-primary">Accept</button>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
                  <div className="mx-auto flex max-w-[760px] flex-col gap-3">
                    {[...detail.messages].reverse().map((message) => {
                      const otherId = selectedSummary.other_participant?.person_resource_id;
                      const mine = Boolean(otherId && message.sender_person_resource_id !== otherId);
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[82%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${mine ? "rounded-br-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "rounded-bl-md bg-[var(--wk-surface-raised)] text-[var(--wk-text)]"}`}>
                            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{message.body}</p>
                            {message.resource_references?.length > 0 && (
                              <div className={`mt-2 space-y-2 border-t pt-2 ${mine ? "border-white/20" : "border-[var(--wk-divider)]"}`}>
                                {message.resource_references.map((reference) => (
                                  <GovernedResourceReferenceCard
                                    key={`${reference.presentation_kind}:${reference.resource_id}:${reference.resource_version_id ?? "resource"}`}
                                    reference={reference}
                                    mine={mine}
                                    onChanged={() =>
                                      selectedId
                                        ? openConversation(selectedId)
                                        : Promise.resolve()
                                    }
                                  />
                                ))}
                              </div>
                            )}
                            <div className={`mt-1.5 flex items-center justify-end gap-2 text-[9px] font-bold ${mine ? "text-white/70" : "text-[var(--wk-text-faint)]"}`}>
                              <span>{when(message.accepted_at)}</span>
                              {mine && message.recipient_read_at && <span>· Read</span>}
                              {!mine && <MessageSafetyReportButton messageId={message.id} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {detail.conversation.first_contact_state !== "pending" && messagesAccess.can_send && (
                  <div className="border-t border-[var(--wk-divider)] p-3 sm:p-4">
                    <div className="mx-auto flex max-w-[760px] items-end gap-2 rounded-[20px] border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2 focus-within:border-[var(--wk-brand)]">
                      <textarea
                        value={composer}
                        onChange={(event) => setComposer(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSend();
                          }
                        }}
                        rows={1}
                        maxLength={10000}
                        placeholder="Write a message"
                        className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                      />
                      <button type="button" onClick={() => void handleSend()} disabled={!composer.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] disabled:opacity-40" aria-label="Send message"><i className="ri-send-plane-fill" /></button>
                    </div>
                    <div className="mx-auto mt-2 flex max-w-[760px] justify-end gap-2">
                      {folder === "archived" ? (
                        <button type="button" onClick={() => void performConversationAction("inbox")} className="text-[10px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">Return to Inbox</button>
                      ) : folder === "spam" ? (
                        <button type="button" onClick={() => void performConversationAction("inbox")} className="text-[10px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">Restore to Inbox</button>
                      ) : (
                        <>
                          <button type="button" onClick={() => void performConversationAction("spam")} className="text-[10px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">Move to Spam</button>
                          <button type="button" onClick={() => void performConversationAction("archive")} className="text-[10px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">Archive</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {newOpen && messagesAccess.can_send && (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => {
              if (!starting) {
                setNewOpen(false);
                if (workflowReference) clearWorkflowIntent();
              }
            }}
            aria-label="Close new Message"
          />
          <section role="dialog" aria-modal="true" aria-label="New Message" className="relative z-10 w-full max-w-[560px] rounded-t-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black tracking-[0.16em] text-[var(--wk-brand)]">Messages</div>
                <h2 className="mt-1 text-[20px] font-black tracking-[-0.025em] text-[var(--wk-text)]">New message</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewOpen(false);
                  if (workflowReference) clearWorkflowIntent();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                aria-label="Close"
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="mt-5">
              {recipient ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                    {recipient.avatar_url ? <img src={recipient.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="font-black text-[var(--wk-brand)]">{recipient.display_name.slice(0, 1)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-black text-[var(--wk-text)]">{recipient.display_name}</div>
                    {recipient.handle && <div className="truncate text-[10px] font-bold text-[var(--wk-text-faint)]">@{recipient.handle}</div>}
                  </div>
                  <button type="button" onClick={() => { setRecipient(null); setQuery(""); }} className="text-[11px] font-black text-[var(--wk-text-muted)]">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus
                    placeholder="Search people"
                    className="h-12 w-full rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-10 pr-4 text-[13px] font-bold text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
                  />
                </div>
              )}

              {!recipient && suggestions.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)]">
                  {suggestions.map((item) => (
                    <button key={item.person_resource_id} type="button" onClick={() => { setRecipient(item); setSuggestions([]); }} className="flex w-full items-center gap-3 border-b border-[var(--wk-divider)] px-3.5 py-3 text-left last:border-b-0 hover:bg-[var(--wk-surface-raised)]">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">{item.avatar_url ? <img src={item.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[12px] font-black text-[var(--wk-brand)]">{item.display_name.slice(0, 1)}</span>}</div>
                      <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-black text-[var(--wk-text)]">{item.display_name}</div>{item.handle && <div className="truncate text-[10px] text-[var(--wk-text-faint)]">@{item.handle}</div>}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {workflowProjection && workflowReference && (
              <div className="mt-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                  Playlist Review
                </div>
                <div className="mt-1 text-[13px] font-black text-[var(--wk-text)]">
                  {workflowProjection.title}
                </div>
                <div className="mt-1 text-[10px] font-bold capitalize text-[var(--wk-text-muted)]">
                  Version {workflowProjection.version_number} · {workflowProjection.playlist_status.replaceAll("_", " ")}
                </div>
              </div>
            )}

            <textarea
              value={newBody}
              onChange={(event) => setNewBody(event.target.value)}
              rows={5}
              maxLength={10000}
              placeholder="Write your first message"
              className="mt-4 w-full resize-none rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[13px] leading-relaxed text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
            />

            <div className="mt-4 flex justify-end">
              <button type="button" disabled={!recipient || !newBody.trim() || starting} onClick={() => void handleStart()} className="wk-button wk-button-primary disabled:opacity-45">{starting ? "Sending..." : "Send message"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
