import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import {
  fetchAdminTrackLyricsContributions,
  fetchAdminTrackLyricsWorkspace,
  listLyricsTrackChoices,
  lyricsDocumentToEditorText,
  parseLyricsEditorText,
  promoteTrackLyricsContributionToDraft,
  publishTrackLyrics,
  rejectTrackLyricsContribution,
  saveTrackLyricsDraft,
  type AdminTrackLyricsWorkspace,
  type LyricsTrackChoice,
  type TrackLyricsContribution,
} from "@/services/player/trackLyricsService";

export default function AdminLyricsPage() {
  const [tracks, setTracks] = useState<LyricsTrackChoice[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<AdminTrackLyricsWorkspace | null>(null);
  const [contributions, setContributions] = useState<TrackLyricsContribution[]>([]);
  const [languageCode, setLanguageCode] = useState("und");
  const [timingMode, setTimingMode] = useState<"plain" | "line">("plain");
  const [editorText, setEditorText] = useState("");
  const [rightsNote, setRightsNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    listLyricsTrackChoices()
      .then((rows) => {
        if (alive) setTracks(rows);
      })
      .catch((error) => {
        if (alive) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Registry Tracks could not load.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return tracks.slice(0, 80);

    return tracks
      .filter(
        (track) =>
          track.title.toLowerCase().includes(needle) ||
          track.slug.toLowerCase().includes(needle),
      )
      .slice(0, 80);
  }, [query, tracks]);

  const hydrate = (next: AdminTrackLyricsWorkspace) => {
    setWorkspace(next);
    const source = next.working ?? next.published;
    setLanguageCode(source?.languageCode ?? "und");
    setTimingMode(source?.timingMode ?? "plain");
    setEditorText(lyricsDocumentToEditorText(source));
    setRightsNote(source?.rightsNote ?? "");
  };

  const loadWorkspace = async (trackId: string) => {
    setSelectedTrackId(trackId);
    setBusy("load");
    setMessage(null);

    try {
      const [nextWorkspace, nextContributions] = await Promise.all([
        fetchAdminTrackLyricsWorkspace(trackId),
        fetchAdminTrackLyricsContributions(trackId),
      ]);
      hydrate(nextWorkspace);
      setContributions(nextContributions);
    } catch (error) {
      setWorkspace(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Lyrics workspace could not load.",
      );
    } finally {
      setBusy(null);
    }
  };

  const reload = async () => {
    if (!selectedTrackId) return;
    const [nextWorkspace, nextContributions] = await Promise.all([
      fetchAdminTrackLyricsWorkspace(selectedTrackId),
      fetchAdminTrackLyricsContributions(selectedTrackId),
    ]);
    hydrate(nextWorkspace);
    setContributions(nextContributions);
  };

  const saveDraft = async () => {
    if (!workspace) return;
    setBusy("save");
    setMessage(null);

    try {
      await saveTrackLyricsDraft(
        workspace,
        {
          languageCode,
          timingMode,
          lines: parseLyricsEditorText(editorText, timingMode),
          rightsNote,
        },
      );
      await reload();
      setMessage("Lyrics draft saved as an immutable version.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Lyrics draft could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!workspace) return;
    setBusy("publish");
    setMessage(null);

    try {
      await publishTrackLyrics(workspace);
      await reload();
      setMessage(
        "Published Lyrics are now available to the WAKILISHA player.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Lyrics could not be published.",
      );
    } finally {
      setBusy(null);
    }
  };

  const promoteContribution = async (contributionId: string) => {
    if (!workspace) return;
    setBusy(`promote:${contributionId}`);
    setMessage(null);

    try {
      await promoteTrackLyricsContributionToDraft(
        workspace,
        contributionId,
      );
      await reload();
      setMessage("Contribution moved into the working Lyrics draft.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Lyrics contribution could not become a draft.",
      );
    } finally {
      setBusy(null);
    }
  };

  const rejectContribution = async (contributionId: string) => {
    setBusy(`reject:${contributionId}`);
    setMessage(null);

    try {
      await rejectTrackLyricsContribution(contributionId);
      await reload();
      setMessage("Lyrics contribution rejected.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Lyrics contribution could not be rejected.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <header className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-brand)]">
              Governed Track Authority
            </div>
            <h1 className="mt-1 text-[22px] font-black">Lyrics</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--wk-text-muted)]">
              Create immutable Lyrics versions against canonical Registry Tracks. Only an explicitly published version appears in the listener player.
            </p>
          </div>
          <Link to="/admin" className="wk-button wk-button-ghost wk-button-sm">
            <WkIcon name="ArrowLeft" size={14} />
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-5 px-5 py-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-6">
        <aside className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="border-b border-[var(--wk-border)] p-3">
            <label className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2">
              <WkIcon
                name="Search"
                size={14}
                className="text-[var(--wk-text-faint)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a Registry Track"
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
              />
            </label>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {loading ? (
              <div className="p-5 text-xs text-[var(--wk-text-muted)]">
                Loading Registry Tracks…
              </div>
            ) : filteredTracks.map((track) => (
              <button
                key={track.id}
                type="button"
                onClick={() => void loadWorkspace(track.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                  selectedTrackId === track.id
                    ? "bg-[var(--wk-brand-soft)]"
                    : "hover:bg-[var(--wk-surface-raised)]",
                ].join(" ")}
              >
                <div className="h-9 w-9 overflow-hidden rounded-lg bg-[var(--wk-bg-subtle)]">
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">
                    {track.title}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-[var(--wk-text-faint)]">
                    {track.slug}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
          {!workspace ? (
            <div className="flex min-h-[420px] items-center justify-center text-center">
              <div>
                <WkIcon
                  name="FileText"
                  size={32}
                  className="mx-auto text-[var(--wk-text-faint)]"
                />
                <p className="mt-3 text-sm font-bold">
                  Choose a Registry Track
                </p>
                <p className="mt-1 text-xs text-[var(--wk-text-muted)]">
                  Choose a Registry Track to edit Lyrics and review contributions.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--wk-border)] pb-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--wk-text-faint)]">
                    Authority Revision {workspace.authorityRevision}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span>
                      Working:{" "}
                      <strong>
                        {workspace.working
                          ? `v${workspace.working.versionNumber}`
                          : "None"}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Published:{" "}
                      <strong>
                        {workspace.published
                          ? `v${workspace.published.versionNumber}`
                          : "None"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {workspace.canEdit ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void saveDraft()}
                      className="wk-button wk-button-secondary wk-button-sm"
                    >
                      <WkIcon name="Save" size={14} />
                      Save Draft
                    </button>
                  ) : null}

                  {workspace.canPublish &&
                  workspace.currentWorkingVersionId ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void publish()}
                      className="wk-button wk-button-primary wk-button-sm"
                    >
                      <WkIcon name="Globe" size={14} />
                      Publish
                    </button>
                  ) : null}
                </div>
              </div>

              {message ? (
                <div
                  role="status"
                  className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3 text-xs"
                >
                  {message}
                </div>
              ) : null}

              {contributions.length ? (
                <section className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--wk-brand)]">
                        Contributions
                      </div>
                      <h2 className="mt-1 text-sm font-black">
                        Listener Submissions
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--wk-text-faint)]">
                      {contributions.length} Recent
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {contributions.map((contribution) => (
                      <article
                        key={contribution.id}
                        className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">
                            {contribution.status === "submitted"
                              ? "Submitted"
                              : contribution.status === "promoted"
                                ? "In Draft"
                                : "Rejected"}
                          </div>
                          <div className="text-[10px] text-[var(--wk-text-faint)]">
                            {contribution.languageCode.toUpperCase()} · {contribution.timingMode === "line" ? "Timed" : "Plain"}
                          </div>
                        </div>

                        <pre className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-6 text-[var(--wk-text-soft)]">
                          {contribution.plainText}
                        </pre>

                        {contribution.sourceDescription ? (
                          <p className="mt-3 text-[11px] text-[var(--wk-text-muted)]">
                            Source: {contribution.sourceDescription}
                          </p>
                        ) : null}

                        {contribution.status === "submitted" ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {workspace.canEdit ? (
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void promoteContribution(contribution.id)}
                                className="wk-button wk-button-secondary wk-button-sm"
                              >
                                Use As Draft
                              </button>
                            ) : null}
                            {workspace.canPublish ? (
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void rejectContribution(contribution.id)}
                                className="wk-button wk-button-ghost wk-button-sm"
                              >
                                Reject
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-xs font-bold">
                  Language
                  <input
                    value={languageCode}
                    disabled={!workspace.canEdit}
                    onChange={(event) =>
                      setLanguageCode(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2"
                    placeholder="und"
                  />
                </label>

                <label className="text-xs font-bold">
                  Timing
                  <select
                    value={timingMode}
                    disabled={!workspace.canEdit}
                    onChange={(event) =>
                      setTimingMode(
                        event.target.value === "line"
                          ? "line"
                          : "plain",
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2"
                  >
                    <option value="plain">Plain Lyrics</option>
                    <option value="line">Line-synced Lyrics</option>
                  </select>
                </label>

                <label className="text-xs font-bold">
                  Source
                  <div className="mt-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[var(--wk-text-muted)]">
                    Editorial
                  </div>
                </label>
              </div>

              <label className="block text-xs font-bold">
                Lyrics
                <textarea
                  value={editorText}
                  disabled={!workspace.canEdit}
                  onChange={(event) => setEditorText(event.target.value)}
                  rows={18}
                  placeholder={
                    timingMode === "line"
                      ? "[00:12.50] First line"
                      : "One lyric line per row"
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 font-mono text-sm leading-7"
                />
              </label>

              <label className="block text-xs font-bold">
                Rights / provenance note
                <textarea
                  value={rightsNote}
                  disabled={!workspace.canEdit}
                  onChange={(event) => setRightsNote(event.target.value)}
                  rows={3}
                  placeholder="Optional internal note about source or rights."
                  className="mt-1 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-sm"
                />
              </label>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
