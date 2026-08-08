import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  createPlaylist,
  slugifyPlaylistTitle,
} from "@/services/playlists/playlistAdminService";

export default function AdminNewPlaylistPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [curatorLabel, setCuratorLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedSlug = useMemo(
    () => slugifyPlaylistTitle(title),
    [title],
  );

  async function handleCreate() {
    const finalSlug = (slugTouched ? slug : suggestedSlug).trim();
    if (!title.trim() || !finalSlug) {
      setError("Add a title and a valid slug.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createPlaylist({
        title,
        slug: finalSlug,
        description,
        curatorLabel,
      });
      navigate(`/admin/content/playlists/${created.playlistId}`, {
        replace: true,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create the Playlist.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        onClick={() => navigate("/admin/content/playlists")}
        className="inline-flex items-center gap-2 text-[12px] font-semibold text-wk-text-muted hover:text-wk-text"
      >
        <WkIcon name="ArrowLeft" size={14} />
        Playlists
      </button>

      <div>
        <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
          New Playlist
        </div>
        <h1 className="text-[24px] font-black tracking-tight text-wk-text">
          Start with the idea
        </h1>
        <p className="mt-1 text-[13px] text-wk-text-muted">
          Create the Playlist first. Add music, artwork, notes, and review depth
          in the editor.
        </p>
      </div>

      <WkSurface className="space-y-5 p-6">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
            Title
          </span>
          <input
            autoFocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) {
                setSlug(slugifyPlaylistTitle(event.target.value));
              }
            }}
            className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[15px] font-bold text-wk-text outline-none focus:border-wk-brand"
            placeholder="What is this Playlist?"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
            Slug
          </span>
          <input
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugifyPlaylistTitle(event.target.value));
            }}
            className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            placeholder={suggestedSlug || "playlist-slug"}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
            Curator
          </span>
          <input
            value={curatorLabel}
            onChange={(event) => setCuratorLabel(event.target.value)}
            className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            placeholder="Displayed curator name"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
            placeholder="What should someone understand before they press play?"
          />
        </label>

        {error ? (
          <div className="rounded-lg bg-wk-danger-soft px-3 py-2 text-[12px] text-wk-danger">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="wk-button wk-button-primary disabled:opacity-50"
          >
            {saving ? (
              <WkIcon name="LoaderCircle" size={15} className="animate-spin" />
            ) : (
              <WkIcon name="Plus" size={15} />
            )}
            Create Playlist
          </button>
        </div>
      </WkSurface>
    </div>
  );
}
