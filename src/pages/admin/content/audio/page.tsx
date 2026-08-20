import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  createAudioPublication,
  createAudioSeason,
  createAudioShow,
  fetchAudioAdminIndex,
  slugifyAudioTitle,
  type AudioAdminIndex,
} from "@/services/audio/audioAdminService";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(status: string): string {
  if (status === "published" || status === "approved") {
    return "bg-wk-success-soft text-wk-success";
  }
  if (status === "ready_for_review" || status === "in_review") {
    return "bg-wk-info-soft text-wk-info";
  }
  if (status === "changes_requested") {
    return "bg-wk-warning-soft text-wk-warning";
  }
  return "bg-wk-surface-raised text-wk-text-muted";
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Audio could not be updated.";
}

export default function AdminAudioPage() {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const [index, setIndex] = useState<AudioAdminIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showTitle, setShowTitle] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [seasonShowId, setSeasonShowId] = useState("");
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [seasonTitle, setSeasonTitle] = useState("");
  const [publicationKind, setPublicationKind] =
    useState<"standalone" | "episode">("standalone");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationSlug, setPublicationSlug] = useState("");
  const [publicationSummary, setPublicationSummary] = useState("");
  const [publicationShowId, setPublicationShowId] = useState("");
  const [publicationSeasonId, setPublicationSeasonId] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("1");

  const canCreate =
    adminUser.can("edit_own_audio") || adminUser.can("edit_others_audio");

  const reload = async () => {
    const next = await fetchAudioAdminIndex();
    setIndex(next);
  };

  useEffect(() => {
    let alive = true;
    fetchAudioAdminIndex()
      .then((next) => {
        if (alive) setIndex(next);
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

  const selectedShowSeasons = useMemo(
    () =>
      index?.seasons.filter(
        (season) => season.showId === publicationShowId,
      ) ?? [],
    [index?.seasons, publicationShowId],
  );

  const handleShow = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("show");
    setMessage(null);
    try {
      const showId = await createAudioShow({
        title: showTitle,
        slug: slugifyAudioTitle(showTitle),
        description: showDescription,
      });
      setShowTitle("");
      setShowDescription("");
      setSeasonShowId(showId);
      setPublicationShowId(showId);
      await reload();
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
      const seasonId = await createAudioSeason({
        showId: seasonShowId,
        seasonNumber: Number(seasonNumber),
        title: seasonTitle,
      });
      setSeasonTitle("");
      setPublicationShowId(seasonShowId);
      setPublicationSeasonId(seasonId);
      await reload();
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
        episodeNumber:
          publicationKind === "episode" ? Number(episodeNumber) : null,
      });
      navigate(`/admin/content/audio/${publicationId}`);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-[36vh]"
        aria-busy="true"
        aria-label="Loading Audio"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b border-wk-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-wk-text-muted">
            Content and Editorial
          </p>
          <h1 className="text-2xl font-black tracking-tight text-wk-text">
            Audio
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-wk-text-muted">
            Build shows, episodes, and standalone Audio inside the same editorial record.
          </p>
        </div>
        <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text-muted">
          {index?.publications.length ?? 0} Audio publication
          {(index?.publications.length ?? 0) === 1 ? "" : "s"}
        </div>
      </header>

      {message ? (
        <div
          role="status"
          className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-sm text-wk-text"
        >
          {message}
        </div>
      ) : null}

      {canCreate ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <WkIcon name="Mic2" size={17} />
              <h2 className="text-sm font-black text-wk-text">New Show</h2>
            </div>
            <form className="space-y-3" onSubmit={handleShow}>
              <label className="block text-xs font-bold text-wk-text-muted">
                Show Title
                <input
                  value={showTitle}
                  onChange={(event) => setShowTitle(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                />
              </label>
              <label className="block text-xs font-bold text-wk-text-muted">
                Description
                <textarea
                  value={showDescription}
                  onChange={(event) => setShowDescription(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                />
              </label>
              <button
                type="submit"
                disabled={busy !== null}
                className="rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on disabled:opacity-50"
              >
                Create Show
              </button>
            </form>
          </WkSurface>

          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <WkIcon name="Layers" size={17} />
              <h2 className="text-sm font-black text-wk-text">New Season</h2>
            </div>
            <form className="space-y-3" onSubmit={handleSeason}>
              <label className="block text-xs font-bold text-wk-text-muted">
                Show
                <select
                  value={seasonShowId}
                  onChange={(event) => setSeasonShowId(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                >
                  <option value="">Choose a show</option>
                  {index?.shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <label className="block text-xs font-bold text-wk-text-muted">
                  Number
                  <input
                    type="number"
                    min={1}
                    value={seasonNumber}
                    onChange={(event) => setSeasonNumber(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                  />
                </label>
                <label className="block text-xs font-bold text-wk-text-muted">
                  Season Title
                  <input
                    value={seasonTitle}
                    onChange={(event) => setSeasonTitle(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={busy !== null}
                className="rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on disabled:opacity-50"
              >
                Create Season
              </button>
            </form>
          </WkSurface>

          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <WkIcon name="Music" size={17} />
              <h2 className="text-sm font-black text-wk-text">New Audio</h2>
            </div>
            <form className="space-y-3" onSubmit={handlePublication}>
              <div className="grid grid-cols-2 gap-2">
                {(["standalone", "episode"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setPublicationKind(kind)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                      publicationKind === kind
                        ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                        : "border-wk-border text-wk-text-muted"
                    }`}
                  >
                    {kind === "standalone" ? "Standalone" : "Episode"}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-bold text-wk-text-muted">
                Title
                <input
                  value={publicationTitle}
                  onChange={(event) => {
                    setPublicationTitle(event.target.value);
                    if (!publicationSlug) {
                      setPublicationSlug(slugifyAudioTitle(event.target.value));
                    }
                  }}
                  required
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                />
              </label>
              <label className="block text-xs font-bold text-wk-text-muted">
                Slug
                <input
                  value={publicationSlug}
                  onChange={(event) => setPublicationSlug(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                />
              </label>

              {publicationKind === "episode" ? (
                <>
                  <label className="block text-xs font-bold text-wk-text-muted">
                    Show
                    <select
                      value={publicationShowId}
                      onChange={(event) => {
                        setPublicationShowId(event.target.value);
                        setPublicationSeasonId("");
                      }}
                      required
                      className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                    >
                      <option value="">Choose a show</option>
                      {index?.shows.map((show) => (
                        <option key={show.id} value={show.id}>
                          {show.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-[1fr_88px] gap-2">
                    <label className="block text-xs font-bold text-wk-text-muted">
                      Season
                      <select
                        value={publicationSeasonId}
                        onChange={(event) =>
                          setPublicationSeasonId(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                      >
                        <option value="">No season</option>
                        {selectedShowSeasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.seasonNumber}. {season.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-wk-text-muted">
                      Episode
                      <input
                        type="number"
                        min={1}
                        value={episodeNumber}
                        onChange={(event) =>
                          setEpisodeNumber(event.target.value)
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                      />
                    </label>
                  </div>
                </>
              ) : null}

              <label className="block text-xs font-bold text-wk-text-muted">
                Summary
                <textarea
                  value={publicationSummary}
                  onChange={(event) => setPublicationSummary(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text"
                />
              </label>
              <button
                type="submit"
                disabled={busy !== null}
                className="rounded-lg bg-wk-brand px-3 py-2 text-xs font-black text-wk-brand-on disabled:opacity-50"
              >
                Open Audio Editor
              </button>
            </form>
          </WkSurface>
        </section>
      ) : null}

      <WkSurface className="overflow-hidden">
        <div className="border-b border-wk-border px-5 py-4">
          <h2 className="text-sm font-black text-wk-text">Audio Record</h2>
          <p className="mt-1 text-xs text-wk-text-muted">
            Open a publication to work on its sound, transcript, chapters, Credits, Citations, and Review.
          </p>
        </div>

        <div className="divide-y divide-wk-border">
          {index?.publications.map((publication) => {
            const show = index.shows.find(
              (item) => item.id === publication.showId,
            );
            const season = index.seasons.find(
              (item) => item.id === publication.seasonId,
            );
            return (
              <button
                key={publication.id}
                type="button"
                onClick={() =>
                  navigate(`/admin/content/audio/${publication.id}`)
                }
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-wk-surface-raised"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand">
                  <WkIcon name="Music" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-wk-text">
                    {publication.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-wk-text-muted">
                    {publication.publicationKind === "episode"
                      ? [show?.title, season?.title, publication.episodeNumber
                          ? `Episode ${publication.episodeNumber}`
                          : null]
                          .filter(Boolean)
                          .join(" · ")
                      : "Standalone Audio"}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(publication.status)}`}
                >
                  {humanize(publication.status)}
                </span>
                <WkIcon name="ChevronRight" size={16} />
              </button>
            );
          })}

          {index?.publications.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-bold text-wk-text">
                No Audio yet.
              </p>
              <p className="mt-1 text-xs text-wk-text-muted">
                Start with a show, an episode, or one standalone recording.
              </p>
            </div>
          ) : null}
        </div>
      </WkSurface>
    </div>
  );
}
