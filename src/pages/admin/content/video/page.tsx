import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminCollectionHeader } from "@/components/design-system/admin/AdminCollectionHeader";
import { AdminModeComposer } from "@/components/design-system/admin/AdminModeComposer";
import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  createVideoPublication,
  fetchVideoAdminIndex,
  type VideoAdminIndex,
  type VideoPublicationSummary,
} from "@/services/video/videoAdminService";

type ComposerMode = "standalone" | "episode";
type StatusFilter =
  | "all"
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "published";

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Video could not be updated.";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function matchesStatus(publication: VideoPublicationSummary, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "in_review") {
    return ["ready_for_review", "in_review"].includes(publication.lifecycleState);
  }
  return publication.lifecycleState === filter;
}

export default function AdminVideoPage() {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const [index, setIndex] = useState<VideoAdminIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<ComposerMode>("standalone");
  const [classification, setClassification] = useState("documentary");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [showId, setShowId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let alive = true;
    fetchVideoAdminIndex()
      .then((value) => {
        if (!alive) return;
        setIndex(value);
        if (value.classifications[0]) {
          setClassification(value.classifications[0].key);
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
  }, []);

  const canCreate =
    adminUser.can("edit_own_video") || adminUser.can("edit_others_video");

  const episodesForShow = useMemo(
    () =>
      (index?.showEpisodes ?? []).filter(
        (episode) =>
          episode.showResourceId === showId && !episode.videoPublicationId,
      ),
    [index?.showEpisodes, showId],
  );

  const visiblePublications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (index?.publications ?? []).filter((publication) => {
      if (!matchesStatus(publication, statusFilter)) return false;
      if (!query) return true;
      return [
        publication.title,
        publication.slug,
        publication.classification,
        publication.show?.title,
        publication.showEpisode?.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [index?.publications, search, statusFilter]);

  async function createStandalone(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await createVideoPublication({
        publicationKind: "standalone",
        classification,
        title: title.trim(),
        slug: slugify(title),
        summary: summary.trim(),
      });
      const publicationId = String(result.publication_id || "");
      if (!publicationId) throw new Error("Video creation returned no publication.");
      navigate(`/admin/content/video/${publicationId}`);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function createEpisode(event: FormEvent) {
    event.preventDefault();
    if (!episodeId) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await createVideoPublication({
        publicationKind: "episode",
        classification,
        showEpisodeResourceId: episodeId,
      });
      const publicationId = String(result.publication_id || "");
      if (!publicationId) throw new Error("Video creation returned no publication.");
      navigate(`/admin/content/video/${publicationId}`);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-[36vh]"
        aria-busy="true"
        aria-label="Loading Video"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6 lg:p-8">
      <AdminCollectionHeader
        eyebrow="Content & Editorial"
        title="Video"
        description="Create standalone Video or bind a Video rendition to an existing shared Show Episode. Source, captions, chapters, review, and publication stay governed here."
        meta={
          <span>
            {index?.publications.length ?? 0} Video publication
            {(index?.publications.length ?? 0) === 1 ? "" : "s"}
          </span>
        }
      />

      {message ? (
        <div
          role="status"
          className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text"
        >
          {message}
        </div>
      ) : null}

      {canCreate ? (
        <AdminModeComposer
          modes={[
            {
              id: "standalone",
              label: "New Standalone Video",
              description: "Create a Video with its own title, slug, and summary.",
            },
            {
              id: "episode",
              label: "New Video Episode",
              description: "Use an existing shared Show Episode. Video does not create a second Show identity.",
            },
          ]}
          activeMode={mode}
          onModeChange={(value) => {
            setMode(value as ComposerMode);
            setMessage(null);
          }}
        >
          {mode === "standalone" ? (
            <form className="space-y-4" onSubmit={createStandalone}>
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <label className="text-xs font-bold text-wk-text-muted">
                  Title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    maxLength={300}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"
                  />
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Classification
                  <select
                    value={classification}
                    onChange={(event) => setClassification(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"
                  >
                    {index?.classifications.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-bold text-wk-text-muted">
                Summary
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={3}
                  maxLength={30000}
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="wk-button wk-button-primary disabled:opacity-40"
              >
                Open Video Editor
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={createEpisode}>
              <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr_1fr]">
                <label className="text-xs font-bold text-wk-text-muted">
                  Shared Show
                  <select
                    value={showId}
                    onChange={(event) => {
                      setShowId(event.target.value);
                      setEpisodeId("");
                    }}
                    required
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"
                  >
                    <option value="">Choose a Show</option>
                    {index?.shows.map((show) => (
                      <option key={show.resourceId} value={show.resourceId}>
                        {show.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Shared Show Episode
                  <select
                    value={episodeId}
                    onChange={(event) => setEpisodeId(event.target.value)}
                    required
                    disabled={!showId}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text disabled:opacity-50"
                  >
                    <option value="">Choose an Episode</option>
                    {episodesForShow.map((episode) => (
                      <option key={episode.resourceId} value={episode.resourceId}>
                        {episode.episodeNumber
                          ? `${episode.episodeNumber}. `
                          : ""}
                        {episode.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Classification
                  <select
                    value={classification}
                    onChange={(event) => setClassification(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"
                  >
                    {index?.classifications.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {showId && !episodesForShow.length ? (
                <p className="text-xs text-wk-text-muted">
                  This Show has no unbound Episodes available for Video.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || !episodeId}
                className="wk-button wk-button-primary disabled:opacity-40"
              >
                Open Video Editor
              </button>
            </form>
          )}
        </AdminModeComposer>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full gap-2 overflow-x-auto">
          {[
            ["all", "All"],
            ["draft", "Draft"],
            ["in_review", "In Review"],
            ["changes_requested", "Changes Requested"],
            ["approved", "Approved"],
            ["published", "Published"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id as StatusFilter)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black ${
                statusFilter === id
                  ? "border-wk-brand bg-wk-brand text-white"
                  : "border-wk-border bg-wk-surface text-wk-text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block min-w-0 lg:w-80">
          <WkIcon
            name="Search"
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Video"
            className="w-full rounded-xl border border-wk-border bg-wk-surface py-2.5 pl-9 pr-3 text-sm text-wk-text"
          />
        </label>
      </div>

      <WkSurface className="overflow-hidden">
        <div className="divide-y divide-wk-border">
          {visiblePublications.map((publication) => {
            const context =
              publication.publicationKind === "episode"
                ? [publication.show?.title, publication.showEpisode?.title]
                    .filter(Boolean)
                    .join(" · ")
                : "Standalone Video";
            return (
              <button
                key={publication.id}
                type="button"
                onClick={() =>
                  navigate(`/admin/content/video/${publication.id}`)
                }
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-wk-surface-raised"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand">
                  <WkIcon
                    name={
                      publication.publicationKind === "episode"
                        ? "PanelsTopLeft"
                        : "Clapperboard"
                    }
                    size={18}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-wk-text">
                    {publication.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-wk-text-muted">
                    {context} ·{" "}
                    {index?.classifications.find(
                      (item) => item.key === publication.classification,
                    )?.label || publication.classification}
                  </span>
                </span>
                <AdminStatusBadge status={publication.lifecycleState} />
                <WkIcon
                  name="ChevronRight"
                  size={16}
                  className="text-wk-text-faint"
                />
              </button>
            );
          })}
          {!visiblePublications.length ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-black text-wk-text">
                No Video records match this view.
              </p>
              <p className="mt-1 text-xs text-wk-text-muted">
                Change the lifecycle filter or search query.
              </p>
            </div>
          ) : null}
        </div>
      </WkSurface>
    </div>
  );
}
