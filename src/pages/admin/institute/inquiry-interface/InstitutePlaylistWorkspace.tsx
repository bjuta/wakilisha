import { useEffect, useMemo, useState } from "react";
import {
  createInstitutePlaylistDraft,
  fetchInstitutePlaylistDraft,
  fetchInstitutePlaylistDraftLink,
  type InstitutePlaylistDraft,
  type InstitutePlaylistDraftItem,
  type InstitutePlaylistDraftLink,
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
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState<InstitutePlaylistDraftLink | null>(null);
  const [existingDraft, setExistingDraft] = useState<InstitutePlaylistDraft | null>(null);

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

        setExistingDraft(playlist);
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
            <div><strong className="text-wk-text">Title:</strong> {existingDraft.title}</div>
            <div><strong className="text-wk-text">Slug:</strong> {existingDraft.slug}</div>
            <div><strong className="text-wk-text">Status:</strong> {statusLabel(existingDraft.status)}</div>
            <div><strong className="text-wk-text">Items:</strong> {existingDraft.items.length}</div>
            <div><strong className="text-wk-text">Updated:</strong> {new Date(existingDraft.updatedAt).toLocaleString()}</div>
          </div>
        ) : null}

        {existingDraft?.items.length ? (
          <div className="mt-5 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Playlist items</div>
            {existingDraft.items.map((item) => (
              <article key={item.id ?? `${item.position}-${itemTitle(item)}`} className="rounded-xl border border-wk-border bg-wk-bg p-4">
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
              </article>
            ))}
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
