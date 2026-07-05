import { useEffect, useMemo, useState } from "react";
import {
  addInstitutePlaylistItem,
  createInstitutePlaylistDraft,
  deleteInstitutePlaylistItem,
  fetchInstitutePlaylistDraft,
  fetchInstitutePlaylistDraftLink,
  fetchInstitutePlaylistReviewHistory,
  fetchInstitutePlaylistReviewState,
  moveInstitutePlaylistItem,
  submitInstitutePlaylistDraftForReview,
  updateInstitutePlaylistDraftMetadata,
  updateInstitutePlaylistItem,
  type InstitutePlaylistDraft,
  type InstitutePlaylistDraftItem,
  type InstitutePlaylistDraftLink,
  type InstitutePlaylistReviewState,
} from "@/services/institute/institutePlaylistBridgeService";
import type { InquiryDraft } from "./types";

type Props = {
  draft: InquiryDraft;
};

const sampleItems = JSON.stringify(
  [
    {
      title: "Example track title",
      artist_names: ["Example Artist"],
      provider_key: "spotify",
      provider_track_id: "paste-provider-track-id",
      provider_url: "https://open.spotify.com/track/example",
      match_status: "external_only",
      notes: "Why this track belongs in the playlist.",
    },
  ],
  null,
  2,
);

function parsePlaylistItems(value: string): InstitutePlaylistDraftItem[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Playlist items must be a JSON array.");
  }

  if (parsed.length < 1) {
    throw new Error("Add at least one playlist item.");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Playlist item ${index + 1} must be an object.`);
    }

    return item as InstitutePlaylistDraftItem;
  });
}

function itemArtists(item: InstitutePlaylistDraftItem) {
  return item.artist_names?.filter(Boolean).join(", ") || "Unknown artist";
}

function itemTitle(item: InstitutePlaylistDraftItem) {
  return item.title || item.provider_track_id || item.provider_url || "Untitled playlist item";
}

function statusLabel(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "draft";
}

export function InstitutePlaylistWorkspace({ draft }: Props) {
  const [title, setTitle] = useState(draft.workingQuestion || `${draft.code} playlist draft`);
  const [description, setDescription] = useState(`Playlist draft for ${draft.code}.`);
  const [curatorLabel, setCuratorLabel] = useState("WAKILISHA");
  const [itemsJson, setItemsJson] = useState(sampleItems);
  const [creating, setCreating] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [savingNewItem, setSavingNewItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [itemForm, setItemForm] = useState({
    title: "",
    artistNames: "",
    providerUrl: "",
    notes: "",
  });
  const [newItemForm, setNewItemForm] = useState({
    title: "",
    artistNames: "",
    providerKey: "spotify",
    providerTrackId: "",
    providerUrl: "",
    notes: "",
  });
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState<InstitutePlaylistDraftLink | null>(null);
  const [existingDraft, setExistingDraft] = useState<InstitutePlaylistDraft | null>(null);
  const [reviewState, setReviewState] = useState<InstitutePlaylistReviewState | null>(null);
  const [reviewHistory, setReviewHistory] = useState<InstitutePlaylistReviewState[]>([]);

  const activeLink = createdLink;

  const parsedCount = useMemo(() => {
    try {
      return parsePlaylistItems(itemsJson).length;
    } catch {
      return 0;
    }
  }, [itemsJson]);

  useEffect(() => {
    let alive = true;

    async function loadExistingDraft() {
      setLoadingExisting(true);
      setError("");

      try {
        const link = await fetchInstitutePlaylistDraftLink(draft.id);
        if (!alive) return;

        if (!link) {
          setCreatedLink(null);
          setExistingDraft(null);
          return;
        }

        setCreatedLink(link);

        const playlist = await fetchInstitutePlaylistDraft(link.playlistId);
        if (!alive) return;

        const [latestReviewState, reviewRows] = await Promise.all([
          fetchInstitutePlaylistReviewState(draft, link),
          fetchInstitutePlaylistReviewHistory(draft, link),
        ]);
        if (!alive) return;

        setExistingDraft(playlist);
        setReviewState(latestReviewState);
        setReviewHistory(reviewRows);
        if (playlist) {
          setTitle(playlist.title);
          setDescription(playlist.description ?? "");
          setCuratorLabel(playlist.curatorLabel ?? "WAKILISHA");
          setNotice(`Existing playlist draft loaded: ${playlist.slug}`);
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load existing playlist draft.");
      } finally {
        if (alive) setLoadingExisting(false);
      }
    }

    void loadExistingDraft();

    return () => {
      alive = false;
    };
  }, [draft.id]);

  const startEditingMetadata = () => {
    if (!existingDraft) return;

    setTitle(existingDraft.title);
    setDescription(existingDraft.description ?? "");
    setCuratorLabel(existingDraft.curatorLabel ?? "WAKILISHA");
    setError("");
    setNotice("");
    setEditingMetadata(true);
  };

  const cancelEditingMetadata = () => {
    if (existingDraft) {
      setTitle(existingDraft.title);
      setDescription(existingDraft.description ?? "");
      setCuratorLabel(existingDraft.curatorLabel ?? "WAKILISHA");
    }

    setError("");
    setEditingMetadata(false);
  };

  const saveMetadata = async () => {
    if (!existingDraft) return;

    setError("");
    setNotice("");

    if (title.trim().length < 3) {
      setError("Add a playlist title first.");
      return;
    }

    setSavingMetadata(true);
    try {
      const playlist = await updateInstitutePlaylistDraftMetadata(existingDraft.id, {
        title: title.trim(),
        description: description.trim(),
        curatorLabel: curatorLabel.trim() || "WAKILISHA",
      });
      setExistingDraft(playlist);
      setNotice(`Playlist details saved: ${playlist.slug}`);
      setEditingMetadata(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save playlist details.");
    } finally {
      setSavingMetadata(false);
    }
  };

  const startEditingItem = (item: InstitutePlaylistDraftItem) => {
    if (!item.id) return;

    setEditingItemId(item.id);
    setItemForm({
      title: item.title ?? "",
      artistNames: item.artist_names?.join(", ") ?? "",
      providerUrl: item.provider_url ?? "",
      notes: item.notes ?? "",
    });
    setError("");
    setNotice("");
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
    setSavingItemId(null);
    setItemForm({
      title: "",
      artistNames: "",
      providerUrl: "",
      notes: "",
    });
    setError("");
  };

  const saveItem = async (item: InstitutePlaylistDraftItem) => {
    if (!item.id || !existingDraft) return;

    setError("");
    setNotice("");

    const artistNames = itemForm.artistNames
      .split(",")
      .map((artist) => artist.trim())
      .filter(Boolean);

    setSavingItemId(item.id);
    try {
      const updatedItem = await updateInstitutePlaylistItem(item.id, {
        title: itemForm.title,
        artistNames,
        providerUrl: itemForm.providerUrl,
        notes: itemForm.notes,
      });

      setExistingDraft({
        ...existingDraft,
        items: existingDraft.items.map((existingItem) =>
          existingItem.id === updatedItem.id ? updatedItem : existingItem,
        ),
      });
      setNotice(`Playlist item saved: ${itemTitle(updatedItem)}`);
      cancelEditingItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save playlist item.");
    } finally {
      setSavingItemId(null);
    }
  };

  const resetNewItemForm = () => {
    setNewItemForm({
      title: "",
      artistNames: "",
      providerKey: "spotify",
      providerTrackId: "",
      providerUrl: "",
      notes: "",
    });
  };

  const addItem = async () => {
    if (!existingDraft) return;

    setError("");
    setNotice("");

    const artistNames = newItemForm.artistNames
      .split(",")
      .map((artist) => artist.trim())
      .filter(Boolean);

    setSavingNewItem(true);
    try {
      const item = await addInstitutePlaylistItem(existingDraft.id, {
        title: newItemForm.title,
        artistNames,
        providerKey: newItemForm.providerKey,
        providerTrackId: newItemForm.providerTrackId,
        providerUrl: newItemForm.providerUrl,
        notes: newItemForm.notes,
      });

      setExistingDraft({
        ...existingDraft,
        items: [...existingDraft.items, item].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      });
      setNotice(`Playlist item added: ${itemTitle(item)}`);
      setAddingItem(false);
      resetNewItemForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add playlist item.");
    } finally {
      setSavingNewItem(false);
    }
  };

  const deleteItem = async (item: InstitutePlaylistDraftItem) => {
    if (!item.id || !existingDraft) return;

    const confirmed = window.confirm(`Delete "${itemTitle(item)}" from this playlist draft?`);
    if (!confirmed) return;

    setError("");
    setNotice("");
    setDeletingItemId(item.id);

    try {
      await deleteInstitutePlaylistItem(item.id);
      const playlist = await fetchInstitutePlaylistDraft(existingDraft.id);
      setExistingDraft(playlist);
      setNotice(`Playlist item deleted: ${itemTitle(item)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete playlist item.");
    } finally {
      setDeletingItemId(null);
    }
  };

  const moveItem = async (item: InstitutePlaylistDraftItem, direction: "up" | "down") => {
    if (!item.id || !existingDraft) return;

    setError("");
    setNotice("");
    setMovingItemId(item.id);

    try {
      const playlist = await moveInstitutePlaylistItem(existingDraft.id, item.id, direction);
      setExistingDraft(playlist);
      setNotice(`Playlist item moved: ${itemTitle(item)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move playlist item.");
    } finally {
      setMovingItemId(null);
    }
  };

  const submitForReview = async () => {
    if (!existingDraft || !activeLink) return;

    setError("");
    setNotice("");
    setSubmittingReview(true);

    try {
      const submission = await submitInstitutePlaylistDraftForReview(draft, activeLink, existingDraft);
      const playlist = await fetchInstitutePlaylistDraft(existingDraft.id);
      setExistingDraft(playlist);
      setReviewState(submission);
      setReviewHistory((current) => {
        if (current.some((item) => item.packetId === submission.packetId)) return current;
        return [...current, submission].sort((first, second) => first.packetVersion - second.packetVersion);
      });
      setNotice(
        submission.alreadySubmitted
          ? `Playlist already submitted for review: v${submission.packetVersion}`
          : `Playlist submitted for review: v${submission.packetVersion}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit playlist for review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const createDraft = async () => {
    setError("");
    setNotice("");

    if (activeLink || existingDraft) {
      setError("This Inquiry already has a linked playlist draft.");
      return;
    }

    if (title.trim().length < 3) {
      setError("Add a playlist title first.");
      return;
    }

    let items: InstitutePlaylistDraftItem[];
    try {
      items = parsePlaylistItems(itemsJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playlist items JSON is invalid.");
      return;
    }

    setCreating(true);
    try {
      const link = await createInstitutePlaylistDraft(draft, {
        title: title.trim(),
        description: description.trim(),
        curatorLabel: curatorLabel.trim() || "WAKILISHA",
        items,
      });
      setCreatedLink(link);
      const playlist = await fetchInstitutePlaylistDraft(link.playlistId);
      setExistingDraft(playlist);
      setNotice(`Playlist draft created: ${link.playlistSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create playlist draft.");
    } finally {
      setCreating(false);
    }
  };

  const hasLinkedDraft = Boolean(activeLink || existingDraft);
  const canSubmitForReview =
    Boolean(existingDraft && activeLink) &&
    reviewState?.status !== "submitted" &&
    reviewState?.status !== "under_review" &&
    existingDraft?.status !== "submitted_for_review";

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">Playlist workspace</div>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">
          {existingDraft ? "Playlist draft linked." : "Create a playlist draft."}
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
          {existingDraft
            ? "This Inquiry already has a private playlist draft. Editing comes next."
            : "This creates a private playlist work product linked to the Inquiry. Publishing and public routes come later."}
        </p>

        {loadingExisting ? (
          <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[12px] font-bold text-wk-text-muted">
            Loading linked playlist draft...
          </div>
        ) : null}

        {existingDraft ? (
          <div className="mt-5 rounded-xl border border-wk-success/30 bg-wk-success-soft p-4 text-[12px] leading-5 text-wk-text-muted">
            {editingMetadata ? (
              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Curator label</span>
                  <input
                    value={curatorLabel}
                    onChange={(event) => setCuratorLabel(event.target.value)}
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveMetadata}
                    disabled={savingMetadata}
                    className="rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingMetadata ? "Saving..." : "Save details"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingMetadata}
                    disabled={savingMetadata}
                    className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div><strong className="text-wk-text">Title:</strong> {existingDraft.title}</div>
                <div><strong className="text-wk-text">Description:</strong> {existingDraft.description || "No description yet"}</div>
                <div><strong className="text-wk-text">Curator:</strong> {existingDraft.curatorLabel || "WAKILISHA"}</div>
                <div><strong className="text-wk-text">Slug:</strong> {existingDraft.slug}</div>
                <div><strong className="text-wk-text">Status:</strong> {statusLabel(existingDraft.status)}</div>
                <div><strong className="text-wk-text">Items:</strong> {existingDraft.items.length}</div>
                <div><strong className="text-wk-text">Updated:</strong> {new Date(existingDraft.updatedAt).toLocaleString()}</div>
                {reviewState ? (
                  <div><strong className="text-wk-text">Review:</strong> v{reviewState.packetVersion} · {statusLabel(reviewState.status)}</div>
                ) : null}

                <button
                  type="button"
                  onClick={startEditingMetadata}
                  className="mt-4 rounded-lg bg-wk-text px-4 py-2 text-[12px] font-black text-wk-bg"
                >
                  Edit details
                </button>
              </>
            )}
          </div>
        ) : null}

        {existingDraft ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAddingItem((current) => !current);
                setError("");
                setNotice("");
              }}
              className="rounded-lg bg-wk-text px-4 py-2 text-[12px] font-black text-wk-bg"
            >
              {addingItem ? "Close add item" : "Add item"}
            </button>
            <button
              type="button"
              onClick={submitForReview}
              disabled={submittingReview || !canSubmitForReview}
              className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submittingReview ? "Submitting..." : !canSubmitForReview ? "Submitted for review" : "Submit for review"}
            </button>
          </div>
        ) : null}

        {reviewState ? (
          <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[12px] leading-5 text-wk-text-muted">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Review state</div>
            <div className="mt-2"><strong className="text-wk-text">Latest:</strong> v{reviewState.packetVersion} · {statusLabel(reviewState.status)}</div>
            <div><strong className="text-wk-text">Submitted:</strong> {new Date(reviewState.submittedAt).toLocaleString()}</div>
            {reviewState.editorNotes ? (
              <div className="mt-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                <strong className="text-wk-text">Editor notes:</strong> {reviewState.editorNotes}
              </div>
            ) : null}

            {reviewHistory.length > 1 ? (
              <div className="mt-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Review history</div>
                <div className="mt-2 space-y-2">
                  {reviewHistory.map((item) => (
                    <div key={item.packetId} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                      <strong className="text-wk-text">v{item.packetVersion}</strong>
                      {" "}· {statusLabel(item.status)} · {new Date(item.submittedAt).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {existingDraft && addingItem ? (
          <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Add playlist item</div>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Track title</span>
                <input
                  value={newItemForm.title}
                  onChange={(event) => setNewItemForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Artists, comma separated</span>
                <input
                  value={newItemForm.artistNames}
                  onChange={(event) => setNewItemForm((current) => ({ ...current, artistNames: event.target.value }))}
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Provider</span>
                  <input
                    value={newItemForm.providerKey}
                    onChange={(event) => setNewItemForm((current) => ({ ...current, providerKey: event.target.value }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Provider ID</span>
                  <input
                    value={newItemForm.providerTrackId}
                    onChange={(event) => setNewItemForm((current) => ({ ...current, providerTrackId: event.target.value }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Provider URL</span>
                  <input
                    value={newItemForm.providerUrl}
                    onChange={(event) => setNewItemForm((current) => ({ ...current, providerUrl: event.target.value }))}
                    className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Notes</span>
                <textarea
                  value={newItemForm.notes}
                  onChange={(event) => setNewItemForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addItem}
                  disabled={savingNewItem}
                  className="rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingNewItem ? "Adding..." : "Save new item"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingItem(false);
                    resetNewItemForm();
                  }}
                  disabled={savingNewItem}
                  className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {existingDraft?.items.length ? (
          <div className="mt-5 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Playlist items</div>
            {existingDraft.items.map((item) => {
              const isEditingItem = Boolean(item.id && editingItemId === item.id);
              const isSavingItem = Boolean(item.id && savingItemId === item.id);

              return (
                <article key={item.id ?? `${item.position}-${itemTitle(item)}`} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  {isEditingItem ? (
                    <div className="grid gap-4">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Track title</span>
                        <input
                          value={itemForm.title}
                          onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))}
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Artists, comma separated</span>
                        <input
                          value={itemForm.artistNames}
                          onChange={(event) => setItemForm((current) => ({ ...current, artistNames: event.target.value }))}
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Provider URL</span>
                        <input
                          value={itemForm.providerUrl}
                          onChange={(event) => setItemForm((current) => ({ ...current, providerUrl: event.target.value }))}
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Notes</span>
                        <textarea
                          value={itemForm.notes}
                          onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))}
                          rows={3}
                          className="w-full resize-y rounded-lg border border-wk-border bg-wk-surface px-3 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveItem(item)}
                          disabled={isSavingItem}
                          className="rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingItem ? "Saving..." : "Save item"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingItem}
                          disabled={isSavingItem}
                          className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-black text-wk-text">
                            {item.position ? `${item.position}. ` : null}{itemTitle(item)}
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{itemArtists(item)}</p>
                        </div>
                        <span className="rounded-full border border-wk-border bg-wk-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-muted">
                          {statusLabel(item.match_status)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-[11px] leading-5 text-wk-text-muted md:grid-cols-2">
                        {item.provider_key ? <div><strong className="text-wk-text">Provider:</strong> {item.provider_key}</div> : null}
                        {item.provider_track_id ? <div><strong className="text-wk-text">Provider ID:</strong> {item.provider_track_id}</div> : null}
                        {item.provider_url ? <div className="md:col-span-2"><strong className="text-wk-text">URL:</strong> {item.provider_url}</div> : null}
                        {item.notes ? <div className="md:col-span-2"><strong className="text-wk-text">Notes:</strong> {item.notes}</div> : null}
                      </div>

                      {item.id ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingItem(item)}
                            className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted"
                          >
                            Edit item
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(item, "up")}
                            disabled={movingItemId === item.id || item.position === 1}
                            className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(item, "down")}
                            disabled={movingItemId === item.id || item.position === existingDraft.items.length}
                            className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item)}
                            disabled={deletingItemId === item.id || existingDraft.items.length <= 1}
                            className="rounded-lg border border-wk-danger/30 bg-wk-danger-soft px-4 py-2 text-[12px] font-black text-wk-danger disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingItemId === item.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}

        {!existingDraft ? (
          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Curator label</span>
              <input
                value={curatorLabel}
                onChange={(event) => setCuratorLabel(event.target.value)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                <span>Items JSON</span>
                <span>{parsedCount} item{parsedCount === 1 ? "" : "s"} detected</span>
              </span>
              <textarea
                value={itemsJson}
                onChange={(event) => setItemsJson(event.target.value)}
                rows={14}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-3 font-mono text-[12px] leading-5 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-4 py-3 text-[12px] font-bold text-wk-danger">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] font-bold text-wk-text">
            {notice}
          </div>
        ) : null}

        {activeLink ? (
          <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[12px] leading-5 text-wk-text-muted">
            <div><strong className="text-wk-text">Playlist ID:</strong> {activeLink.playlistId}</div>
            <div><strong className="text-wk-text">Slug:</strong> {activeLink.playlistSlug}</div>
            <div><strong className="text-wk-text">Work product link:</strong> {activeLink.workProductLinkId}</div>
          </div>
        ) : null}

        {!existingDraft ? (
          <button
            type="button"
            onClick={createDraft}
            disabled={creating || loadingExisting || hasLinkedDraft}
            className="mt-5 rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : hasLinkedDraft ? "Playlist draft linked" : "Create playlist draft"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
