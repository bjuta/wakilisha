import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminCollectionHeader } from "@/components/design-system/admin/AdminCollectionHeader";
import { AdminModeComposer } from "@/components/design-system/admin/AdminModeComposer";
import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  createAudioPublication,
  createAudioSeason,
  createAudioShow,
  fetchAudioAdminIndex,
  slugifyAudioTitle,
  type AudioAdminIndex,
  type AudioPublicationSummary,
} from "@/services/audio/audioAdminService";

type ComposerMode = "show" | "season" | "recording";
type StatusFilter = "all" | "draft" | "in_review" | "changes_requested" | "approved" | "published";

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Audio could not be updated.";
}

function matchesStatus(publication: AudioPublicationSummary, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "in_review") return ["ready_for_review", "in_review"].includes(publication.status);
  return publication.status === filter;
}

export default function AdminAudioPage() {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const [index, setIndex] = useState<AudioAdminIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("recording");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showTitle, setShowTitle] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [seasonShowId, setSeasonShowId] = useState("");
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [seasonTitle, setSeasonTitle] = useState("");
  const [publicationKind, setPublicationKind] = useState<"standalone" | "episode">("standalone");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationSlug, setPublicationSlug] = useState("");
  const [publicationSummary, setPublicationSummary] = useState("");
  const [publicationShowId, setPublicationShowId] = useState("");
  const [publicationSeasonId, setPublicationSeasonId] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("1");

  const canCreate = adminUser.can("edit_own_audio") || adminUser.can("edit_others_audio");
  const reload = async () => setIndex(await fetchAudioAdminIndex());

  useEffect(() => {
    let alive = true;
    fetchAudioAdminIndex()
      .then((next) => { if (alive) setIndex(next); })
      .catch((reason) => { if (alive) setMessage(errorText(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectedShowSeasons = useMemo(
    () => index?.seasons.filter((season) => season.showId === publicationShowId) ?? [],
    [index?.seasons, publicationShowId],
  );

  const visiblePublications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (index?.publications ?? []).filter((publication) => {
      if (!matchesStatus(publication, statusFilter)) return false;
      const show = index?.shows.find((item) => item.id === publication.showId);
      const season = index?.seasons.find((item) => item.id === publication.seasonId);
      if (!query) return true;
      return [publication.title, publication.slug, show?.title, season?.title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [index, search, statusFilter]);

  const handleShow = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("show");
    setMessage(null);
    try {
      const showId = await createAudioShow({ title: showTitle, slug: slugifyAudioTitle(showTitle), description: showDescription });
      setShowTitle("");
      setShowDescription("");
      setSeasonShowId(showId);
      setPublicationShowId(showId);
      await reload();
      setComposerMode("season");
      setMessage("Show created.");
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const handleSeason = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("season");
    setMessage(null);
    try {
      const seasonId = await createAudioSeason({ showId: seasonShowId, seasonNumber: Number(seasonNumber), title: seasonTitle });
      setSeasonTitle("");
      setPublicationShowId(seasonShowId);
      setPublicationSeasonId(seasonId);
      await reload();
      setComposerMode("recording");
      setPublicationKind("episode");
      setMessage("Season created.");
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  const handlePublication = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("publication");
    setMessage(null);
    try {
      const publicationId = await createAudioPublication({
        publicationKind,
        title: publicationTitle,
        slug: publicationSlug || publicationTitle,
        summary: publicationSummary,
        showId: publicationShowId || null,
        seasonId: publicationSeasonId || null,
        episodeNumber: publicationKind === "episode" ? Number(episodeNumber) : null,
      });
      navigate(`/admin/content/audio/${publicationId}`);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="min-h-[36vh]" aria-busy="true" aria-label="Loading Audio" />;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6 lg:p-8">
      <AdminCollectionHeader
        eyebrow="Content & Editorial"
        title="Audio"
        description="Build shows, seasons, episodes, and standalone recordings inside one governed Audio system."
        meta={<span>{index?.publications.length ?? 0} Audio publication{(index?.publications.length ?? 0) === 1 ? "" : "s"}</span>}
      />

      {message ? <div role="status" className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text">{message}</div> : null}

      {canCreate ? (
        <AdminModeComposer
          modes={[
            { id: "show", label: "New Show", description: "Create the durable identity that Episodes can belong to." },
            { id: "season", label: "New Season", description: "Organize Episodes beneath a Show without changing publication identity." },
            { id: "recording", label: "New Recording", description: "Open a standalone recording or Episode in the governed Audio workbench." },
          ]}
          activeMode={composerMode}
          onModeChange={(mode) => setComposerMode(mode as ComposerMode)}
        >
          {composerMode === "show" ? (
            <form className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]" onSubmit={handleShow}>
              <label className="text-xs font-bold text-wk-text-muted">Show Title<input value={showTitle} onChange={(event) => setShowTitle(event.target.value)} required placeholder="e.g. Signal & Noise" className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
              <label className="text-xs font-bold text-wk-text-muted">Description<input value={showDescription} onChange={(event) => setShowDescription(event.target.value)} placeholder="What is this Show about?" className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
              <button type="submit" disabled={busy !== null} className="wk-button wk-button-primary self-end disabled:opacity-50">Create Show</button>
            </form>
          ) : null}

          {composerMode === "season" ? (
            <form className="grid gap-4 lg:grid-cols-[1.2fr_120px_1fr_auto]" onSubmit={handleSeason}>
              <label className="text-xs font-bold text-wk-text-muted">Show<select value={seasonShowId} onChange={(event) => setSeasonShowId(event.target.value)} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"><option value="">Choose a Show</option>{index?.shows.map((show) => <option key={show.id} value={show.id}>{show.title}</option>)}</select></label>
              <label className="text-xs font-bold text-wk-text-muted">Number<input type="number" min={1} value={seasonNumber} onChange={(event) => setSeasonNumber(event.target.value)} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
              <label className="text-xs font-bold text-wk-text-muted">Season Title<input value={seasonTitle} onChange={(event) => setSeasonTitle(event.target.value)} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
              <button type="submit" disabled={busy !== null} className="wk-button wk-button-primary self-end disabled:opacity-50">Create Season</button>
            </form>
          ) : null}

          {composerMode === "recording" ? (
            <form className="space-y-4" onSubmit={handlePublication}>
              <div className="flex gap-2">{(["standalone", "episode"] as const).map((kind) => <button key={kind} type="button" onClick={() => setPublicationKind(kind)} className={`rounded-lg border px-4 py-2 text-xs font-black ${publicationKind === kind ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border text-wk-text-muted"}`}>{kind === "standalone" ? "Standalone" : "Episode"}</button>)}</div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="text-xs font-bold text-wk-text-muted">Title<input value={publicationTitle} onChange={(event) => { setPublicationTitle(event.target.value); if (!publicationSlug) setPublicationSlug(slugifyAudioTitle(event.target.value)); }} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
                <label className="text-xs font-bold text-wk-text-muted">Slug<input value={publicationSlug} onChange={(event) => setPublicationSlug(event.target.value)} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
              </div>
              {publicationKind === "episode" ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_120px]">
                  <label className="text-xs font-bold text-wk-text-muted">Show<select value={publicationShowId} onChange={(event) => { setPublicationShowId(event.target.value); setPublicationSeasonId(""); }} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"><option value="">Choose a Show</option>{index?.shows.map((show) => <option key={show.id} value={show.id}>{show.title}</option>)}</select></label>
                  <label className="text-xs font-bold text-wk-text-muted">Season<select value={publicationSeasonId} onChange={(event) => setPublicationSeasonId(event.target.value)} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text"><option value="">No season</option>{selectedShowSeasons.map((season) => <option key={season.id} value={season.id}>{season.seasonNumber}. {season.title}</option>)}</select></label>
                  <label className="text-xs font-bold text-wk-text-muted">Episode<input type="number" min={1} value={episodeNumber} onChange={(event) => setEpisodeNumber(event.target.value)} required className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
                </div>
              ) : null}
              <label className="block text-xs font-bold text-wk-text-muted">Summary<textarea value={publicationSummary} onChange={(event) => setPublicationSummary(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-sm text-wk-text" /></label>
              <button type="submit" disabled={busy !== null} className="wk-button wk-button-primary disabled:opacity-50">Open Audio Workbench</button>
            </form>
          ) : null}
        </AdminModeComposer>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full gap-2 overflow-x-auto">
          {[["all", "All"], ["draft", "Draft"], ["in_review", "In Review"], ["changes_requested", "Changes Requested"], ["approved", "Approved"], ["published", "Published"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setStatusFilter(id as StatusFilter)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black ${statusFilter === id ? "border-wk-brand bg-wk-brand text-white" : "border-wk-border bg-wk-surface text-wk-text-muted"}`}>{label}</button>
          ))}
        </div>
        <label className="relative block min-w-0 lg:w-80"><WkIcon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Audio" className="w-full rounded-xl border border-wk-border bg-wk-surface py-2.5 pl-9 pr-3 text-sm text-wk-text" /></label>
      </div>

      <WkSurface className="overflow-hidden">
        <div className="divide-y divide-wk-border">
          {visiblePublications.map((publication) => {
            const show = index?.shows.find((item) => item.id === publication.showId);
            const season = index?.seasons.find((item) => item.id === publication.seasonId);
            const context = publication.publicationKind === "episode" ? [show?.title, season?.title, publication.episodeNumber ? `Episode ${publication.episodeNumber}` : null].filter(Boolean).join(" · ") : "Standalone Audio";
            return (
              <button key={publication.id} type="button" onClick={() => navigate(`/admin/content/audio/${publication.id}`)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-wk-surface-raised">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand"><WkIcon name={publication.publicationKind === "episode" ? "ListMusic" : "Disc3"} size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-wk-text">{publication.title}</span><span className="mt-1 block truncate text-xs text-wk-text-muted">{context}</span></span>
                <span className="hidden font-mono text-[10px] text-wk-text-faint md:block">rev {publication.authorityRevision}</span>
                <AdminStatusBadge status={publication.status} />
                <WkIcon name="ChevronRight" size={16} className="text-wk-text-faint" />
              </button>
            );
          })}
          {!visiblePublications.length ? <div className="px-5 py-12 text-center"><p className="text-sm font-black text-wk-text">No Audio records match this view.</p><p className="mt-1 text-xs text-wk-text-muted">Change the lifecycle filter or search query.</p></div> : null}
        </div>
      </WkSurface>
    </div>
  );
}
