import { useMemo, useState } from "react";
import {
  createInstitutePlaylistDraft,
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

export function InstitutePlaylistWorkspace({ draft }: Props) {
  const [title, setTitle] = useState(draft.workingQuestion || `${draft.code} playlist draft`);
  const [description, setDescription] = useState(`Playlist draft for ${draft.code}.`);
  const [curatorLabel, setCuratorLabel] = useState("WAKILISHA");
  const [itemsJson, setItemsJson] = useState(sampleItems);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState<InstitutePlaylistDraftLink | null>(null);

  const parsedCount = useMemo(() => {
    try {
      return parsePlaylistItems(itemsJson).length;
    } catch {
      return 0;
    }
  }, [itemsJson]);

  const createDraft = async () => {
    setError("");
    setNotice("");

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
      setNotice(`Playlist draft created: ${link.playlistSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create playlist draft.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">Playlist workspace</div>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">Create a playlist draft.</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
          This creates a private playlist work product linked to the Inquiry. Publishing and public routes come later.
        </p>

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

        {createdLink ? (
          <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg-subtle p-4 text-[12px] leading-5 text-wk-text-muted">
            <div><strong className="text-wk-text">Playlist ID:</strong> {createdLink.playlistId}</div>
            <div><strong className="text-wk-text">Slug:</strong> {createdLink.playlistSlug}</div>
            <div><strong className="text-wk-text">Work product link:</strong> {createdLink.workProductLinkId}</div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={createDraft}
          disabled={creating || Boolean(createdLink)}
          className="mt-5 rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Creating..." : createdLink ? "Playlist draft created" : "Create playlist draft"}
        </button>
      </section>
    </div>
  );
}
