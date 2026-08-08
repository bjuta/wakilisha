import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  addRegistryTrack,
  addValidatedPlaybackTrack,
  submitPlaylistRegistryIntake,
  fetchPlaylistDetail,
  preparePlaylistCoverVariant,
  removePlaylistItem,
  reorderPlaylistItems,
  resolvePlaylistItemMatch,
  reviewPlaylist,
  savePlaylistItemNote,
  searchRegistryArtists,
  searchRegistryTracks,
  setPlaylistCover,
  slugifyPlaylistTitle,
  validatePlaylistPlaybackUrl,
  snapshotPlaylistWorkingVersion,
  submitPlaylistForReview,
  updatePlaylistMetadata,
  type PlaylistDetail,
  type PlaylistItem,
  type PlaylistPlaybackValidation,
  type PlaylistPendingRegistryIntake,
  type RegistryArtistSearchResult,
  type RegistryIntakeArtistCreditInput,
  type RegistryTrackSearchResult,
} from "@/services/playlists/playlistAdminService";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(status: string): string {
  if (status === "approved" || status === "published") {
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
  if (reason instanceof Error) return reason.message;
  if (
    reason &&
    typeof reason === "object" &&
    "message" in reason
  ) {
    return String((reason as { message: unknown }).message);
  }
  return "The Playlist action could not be completed.";
}

function trackLabel(item: PlaylistItem): string {
  const artists =
    item.artistNames.length > 0
      ? item.artistNames.join(", ")
      : "Artist unresolved";
  return `${item.title || "Untitled track"} · ${artists}`;
}

export function PlaylistEditorWorkspace({
  playlistId,
}: {
  playlistId?: string;
}) {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [curatorLabel, setCuratorLabel] = useState("");

  const [trackQuery, setTrackQuery] = useState("");
  const [trackResults, setTrackResults] = useState<
    RegistryTrackSearchResult[]
  >([]);
  const [searching, setSearching] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [providerUrl, setProviderUrl] = useState("");
  const [playbackValidation, setPlaybackValidation] =
    useState<PlaylistPlaybackValidation | null>(null);
  const [linkTrackQuery, setLinkTrackQuery] = useState("");
  const [linkTrackResults, setLinkTrackResults] = useState<
    RegistryTrackSearchResult[]
  >([]);
  const [registryIntakeOpen, setRegistryIntakeOpen] = useState(false);
  const [artistQuery, setArtistQuery] = useState("");
  const [artistResults, setArtistResults] = useState<
    RegistryArtistSearchResult[]
  >([]);
  const [selectedRegistryArtist, setSelectedRegistryArtist] =
    useState<RegistryArtistSearchResult | null>(null);
  const [artistResolutionMode, setArtistResolutionMode] = useState<
    "existing_artist" | "alias_candidate" | "new_artist"
  >("existing_artist");
  const [intakeArtistRole, setIntakeArtistRole] = useState<
    "primary" | "featured"
  >("primary");
  const [intakeArtistCredits, setIntakeArtistCredits] = useState<
    RegistryIntakeArtistCreditInput[]
  >([]);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [matchingItemId, setMatchingItemId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    itemId: string;
    edge: "before" | "after";
  } | null>(null);

  const reload = useCallback(async () => {
    if (!playlistId) return;
    const next = await fetchPlaylistDetail(playlistId);
    setDetail(next);
    setTitle(next.playlist.title);
    setSlug(next.playlist.slug);
    setDescription(next.playlist.description ?? "");
    setCuratorLabel(next.playlist.curatorLabel ?? "");
    setNoteDrafts(
      Object.fromEntries(
        next.items.map((item) => [item.id, item.notes ?? ""]),
      ),
    );
  }, [playlistId]);

  useEffect(() => {
    let alive = true;
    if (!playlistId) {
      setLoading(false);
      return;
    }

    fetchPlaylistDetail(playlistId)
      .then((next) => {
        if (!alive) return;
        setDetail(next);
        setTitle(next.playlist.title);
        setSlug(next.playlist.slug);
        setDescription(next.playlist.description ?? "");
        setCuratorLabel(next.playlist.curatorLabel ?? "");
        setNoteDrafts(
          Object.fromEntries(
            next.items.map((item) => [item.id, item.notes ?? ""]),
          ),
        );
      })
      .catch((reason) => {
        if (alive) {
          setMessage({ type: "error", text: errorText(reason) });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [playlistId]);

  useEffect(() => {
    const query = trackQuery.trim();
    if (query.length < 2) {
      setTrackResults([]);
      return;
    }

    let alive = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      searchRegistryTracks(query)
        .then((rows) => {
          if (alive) setTrackResults(rows);
        })
        .catch((reason) => {
          if (alive) {
            setMessage({ type: "error", text: errorText(reason) });
          }
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [trackQuery]);

  const fallbackCanEdit =
    adminUser.can("edit_own_playlists") ||
    adminUser.can("edit_others_playlists");
  const canEdit = detail?.review?.canEdit ?? fallbackCanEdit;
  const canManageReview =
    detail?.review?.canManageReview ??
    adminUser.can("manage_review_queue");

  const submittedVersionId =
    detail?.review?.currentSubmittedVersionId ?? null;

  const orderedIds = useMemo(
    () => detail?.items.map((item) => item.id) ?? [],
    [detail?.items],
  );

  const legacyUnresolvedRegistryCount =
    detail?.items.filter(
      (item) =>
        !item.registryTrackId && item.matchStatus !== "needs_review",
    ).length ?? 0;

  async function runAction(
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      await reload();
      setMessage({ type: "success", text: success });
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-wk-surface-raised" />
        <div className="h-44 animate-pulse rounded-2xl bg-wk-surface" />
        <div className="h-80 animate-pulse rounded-2xl bg-wk-surface" />
      </div>
    );
  }

  if (!playlistId || !detail) {
    return (
      <WkSurface className="p-6">
        <h1 className="text-[18px] font-black text-wk-text">
          Playlist unavailable
        </h1>
        <p className="mt-2 text-[13px] text-wk-text-muted">
          The Playlist could not be loaded or you do not have access.
        </p>
        <button
          onClick={() => navigate("/admin/content/playlists")}
          className="wk-button wk-button-ghost mt-4"
        >
          Back to Playlists
        </button>
      </WkSurface>
    );
  }

  const { playlist, items, cover, review } = detail;

  async function handleMetadataSave() {
    const cleanTitle = title.trim();
    const cleanSlug = slugifyPlaylistTitle(slug);
    if (!cleanTitle || !cleanSlug) {
      setMessage({
        type: "error",
        text: "Title and slug are required.",
      });
      return;
    }

    await runAction(
      "metadata",
      () =>
        updatePlaylistMetadata(
          playlist.id,
          playlist.authorityRevision,
          {
            title: cleanTitle,
            slug: cleanSlug,
            description: description.trim() || null,
            curator_label: curatorLabel.trim() || null,
          },
        ),
      "Playlist details saved.",
    );
  }

  async function handleAddTrack(track: RegistryTrackSearchResult) {
    setBusy(`add:${track.id}`);
    setMessage(null);
    try {
      const result = await addRegistryTrack(
        playlist.id,
        playlist.authorityRevision,
        track,
      );
      await reload();
      setTrackQuery("");
      setTrackResults([]);
      setMessage({
        type: result.duplicateWarning ? "warning" : "success",
        text: result.duplicateWarning
          ? "Track added. This may duplicate another item in the Playlist."
          : "Track added.",
      });
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  function resetProviderFlow() {
    setProviderUrl("");
    setPlaybackValidation(null);
    setLinkTrackQuery("");
    setLinkTrackResults([]);
    setRegistryIntakeOpen(false);
    setArtistQuery("");
    setArtistResults([]);
    setSelectedRegistryArtist(null);
    setArtistResolutionMode("existing_artist");
    setIntakeArtistRole("primary");
    setIntakeArtistCredits([]);
    setLinkOpen(false);
  }

  async function handleValidateProviderLink() {
    if (!providerUrl.trim()) {
      setMessage({
        type: "error",
        text: "Paste a provider link before checking playback.",
      });
      return;
    }

    setBusy("provider-validate");
    setMessage(null);
    try {
      const validation = await validatePlaylistPlaybackUrl(
        playlist.id,
        providerUrl,
      );
      setPlaybackValidation(validation);

      const seed = [
        validation.titleHint,
        ...validation.artistNamesHint,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      setLinkTrackQuery(seed);
      if (seed.length >= 2) {
        setLinkTrackResults(await searchRegistryTracks(seed));
      } else {
        setLinkTrackResults([]);
      }

      setArtistQuery(validation.artistNamesHint[0] ?? "");
      setIntakeArtistCredits([]);
      setIntakeArtistRole("primary");
      setArtistResolutionMode("existing_artist");
      setMessage({
        type: "success",
        text:
          validation.playbackKind === "video"
            ? "Video playback confirmed. Match it to the Music Registry track."
            : "Audio playback confirmed. Match it to the Music Registry track.",
      });
    } catch (reason) {
      setPlaybackValidation(null);
      setLinkTrackResults([]);
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  async function handleLinkTrackSearch(value: string) {
    setLinkTrackQuery(value);
    if (value.trim().length < 2) {
      setLinkTrackResults([]);
      return;
    }

    setSearching(true);
    try {
      setLinkTrackResults(await searchRegistryTracks(value));
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setSearching(false);
    }
  }

  async function handleArtistSearch(value: string) {
    setArtistQuery(value);
    setSelectedRegistryArtist(null);
    if (value.trim().length < 2) {
      setArtistResults([]);
      return;
    }

    try {
      setArtistResults(await searchRegistryArtists(value));
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    }
  }

  async function handleAddValidatedTrack(
    track: RegistryTrackSearchResult,
  ) {
    if (!playbackValidation) return;

    setBusy(`provider-add:${track.id}`);
    setMessage(null);
    try {
      const result = await addValidatedPlaybackTrack(
        playlist.id,
        playlist.authorityRevision,
        playbackValidation.validationId,
        track,
      );
      await reload();
      setMessage({
        type: result.duplicateWarning ? "warning" : "success",
        text: result.duplicateWarning
          ? "Track added with validated playback. This may duplicate another Playlist item."
          : "Registry track added with validated playback.",
      });
      resetProviderFlow();
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  function addRegistryIntakeArtistCredit() {
    const observedName = artistQuery.trim();

    if (
      (artistResolutionMode === "existing_artist" ||
        artistResolutionMode === "alias_candidate") &&
      !selectedRegistryArtist
    ) {
      setMessage({
        type: "error",
        text: "Select the Music Registry artist for this credit.",
      });
      return;
    }

    if (
      artistResolutionMode === "new_artist" &&
      !observedName
    ) {
      setMessage({
        type: "error",
        text: "Enter the observed artist name for the new-artist suggestion.",
      });
      return;
    }

    if (
      artistResolutionMode === "alias_candidate" &&
      !observedName
    ) {
      setMessage({
        type: "error",
        text: "Enter the provider-observed alias before adding this credit.",
      });
      return;
    }

    const credit: RegistryIntakeArtistCreditInput = {
      creditRole: intakeArtistRole,
      resolutionMode: artistResolutionMode,
      registryArtistId:
        selectedRegistryArtist?.id ?? null,
      observedName:
        observedName ||
        selectedRegistryArtist?.displayName ||
        "",
      displayName:
        selectedRegistryArtist?.displayName ||
        observedName,
    };

    const identity =
      credit.registryArtistId ??
      credit.observedName.trim().toLowerCase();

    if (
      intakeArtistCredits.some(
        (existing) =>
          (
            existing.registryArtistId ??
            existing.observedName.trim().toLowerCase()
          ) === identity,
      )
    ) {
      setMessage({
        type: "warning",
        text: "That artist is already included in this Registry intake.",
      });
      return;
    }

    const nextCredits = [
      ...intakeArtistCredits,
      credit,
    ];

    setIntakeArtistCredits(nextCredits);
    setArtistQuery("");
    setArtistResults([]);
    setSelectedRegistryArtist(null);
    setArtistResolutionMode("existing_artist");
    setIntakeArtistRole("featured");
    setMessage(null);
  }

  function removeRegistryIntakeArtistCredit(index: number) {
    const next = intakeArtistCredits.filter(
      (_, creditIndex) => creditIndex !== index,
    );

    if (
      next.length > 0 &&
      !next.some((credit) => credit.creditRole === "primary")
    ) {
      setIntakeArtistCredits([
        { ...next[0], creditRole: "primary" },
        ...next.slice(1),
      ]);
      return;
    }

    setIntakeArtistCredits(next);
  }

  async function handleRegistryIntake() {
    if (!playbackValidation) return;

    if (intakeArtistCredits.length < 1) {
      setMessage({
        type: "error",
        text: "Add every primary and featured artist credit before sending this track to Registry.",
      });
      return;
    }

    if (
      !intakeArtistCredits.some(
        (credit) => credit.creditRole === "primary",
      )
    ) {
      setMessage({
        type: "error",
        text: "Registry intake needs at least one Primary artist.",
      });
      return;
    }

    setBusy("registry-intake");
    setMessage(null);
    try {
      await submitPlaylistRegistryIntake(
        playlist.id,
        playlist.authorityRevision,
        playbackValidation.validationId,
        intakeArtistCredits,
      );
      await reload();
      setMessage({
        type: "success",
        text:
          "Added to this Playlist and sent to Music Registry intake for identity and enrichment review.",
      });
      resetProviderFlow();
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }



  async function handleCoverSelection(assetId: string) {
    setBusy("cover");
    setMessage(null);
    try {
      const prepared = await preparePlaylistCoverVariant(
        playlist.id,
        assetId,
      );
      await setPlaylistCover(
        playlist.id,
        playlist.authorityRevision,
        prepared.assetId,
      );
      await reload();
      setMessage({
        type: "success",
        text:
          "Playlist cover prepared and saved. The original Media image was left untouched.",
      });
    } catch (reason) {
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  function applyLocalOrder(nextIds: string[]) {
    setDetail((current) => {
      if (!current) return current;

      const byId = new Map(
        current.items.map((item) => [item.id, item] as const),
      );
      const nextItems = nextIds
        .map((id) => byId.get(id))
        .filter((item): item is PlaylistItem => Boolean(item));

      if (nextItems.length !== current.items.length) return current;

      return {
        ...current,
        items: nextItems,
      };
    });
  }

  async function handleReorder(nextIds: string[]) {
    if (
      nextIds.length !== orderedIds.length ||
      nextIds.every((id, index) => id === orderedIds[index])
    ) {
      return;
    }

    const previousIds = [...orderedIds];

    // Snap immediately so the drop feels deterministic. The canonical command
    // still owns persistence; a rejected/stale write is reloaded from authority.
    applyLocalOrder(nextIds);
    setBusy("reorder");
    setMessage(null);

    try {
      await reorderPlaylistItems(
        playlist.id,
        playlist.authorityRevision,
        nextIds,
      );
      await reload();
      setMessage({ type: "success", text: "Track order saved." });
    } catch (reason) {
      applyLocalOrder(previousIds);
      try {
        await reload();
      } catch {
        // Preserve the useful reorder error if the recovery reload also fails.
      }
      setMessage({ type: "error", text: errorText(reason) });
    } finally {
      setBusy(null);
    }
  }

  function moveItem(itemId: string, delta: number) {
    const index = orderedIds.indexOf(itemId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= orderedIds.length) return;

    const next = [...orderedIds];
    [next[index], next[target]] = [next[target], next[index]];
    void handleReorder(next);
  }

  function handleTrackDragOver(
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (!draggedItemId || draggedItemId === targetId) {
      setDragTarget(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const edge =
      event.clientY < bounds.top + bounds.height / 2
        ? "before"
        : "after";

    setDragTarget((current) =>
      current?.itemId === targetId && current.edge === edge
        ? current
        : { itemId: targetId, edge },
    );
  }

  function handleTrackDrop(
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) {
    event.preventDefault();

    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      setDragTarget(null);
      return;
    }

    const edge =
      dragTarget?.itemId === targetId
        ? dragTarget.edge
        : "before";

    const next = orderedIds.filter((id) => id !== draggedItemId);
    const targetIndex = next.indexOf(targetId);

    if (targetIndex < 0) {
      setDraggedItemId(null);
      setDragTarget(null);
      return;
    }

    next.splice(
      edge === "after" ? targetIndex + 1 : targetIndex,
      0,
      draggedItemId,
    );

    setDraggedItemId(null);
    setDragTarget(null);
    void handleReorder(next);
  }

  function finishTrackDrag() {
    setDraggedItemId(null);
    setDragTarget(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            onClick={() => navigate("/admin/content/playlists")}
            className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-wk-text-muted hover:text-wk-text"
          >
            <WkIcon name="ArrowLeft" size={13} />
            Playlists
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[24px] font-black tracking-tight text-wk-text">
              {playlist.title || "Untitled Playlist"}
            </h1>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(playlist.status)}`}
            >
              {humanize(playlist.status)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            Revision {playlist.authorityRevision} · {items.length}{" "}
            {items.length === 1 ? "track" : "tracks"}
          </p>
        </div>
      </div>

      {message ? (
        <div
          className={
            message.type === "error"
              ? "rounded-xl border border-wk-danger/20 bg-wk-danger-soft px-4 py-3 text-[12px] font-semibold text-wk-danger"
              : message.type === "warning"
                ? "rounded-xl border border-wk-warning/20 bg-wk-warning-soft px-4 py-3 text-[12px] font-semibold text-wk-warning"
                : "rounded-xl border border-wk-success/20 bg-wk-success-soft px-4 py-3 text-[12px] font-semibold text-wk-success"
          }
        >
          {message.text}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-xl border border-wk-info/20 bg-wk-info-soft px-4 py-3 text-[12px] text-wk-info">
          You can review this Playlist, but its working content is read-only for
          your account.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <div className="space-y-5">
          <WkSurface className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[16px] font-black text-wk-text">
                  Tracklist
                </h2>
                <p className="mt-1 text-[12px] text-wk-text-muted">
                  Every Playlist track belongs to the Music Registry. Provider
                  links add playback, never track or artist identity.
                </p>
              </div>
              {canEdit ? (
                <button
                  onClick={() => setLinkOpen((value) => !value)}
                  className="wk-button wk-button-ghost wk-button-sm"
                >
                  <WkIcon name="Link2" size={14} />
                  Add from link
                </button>
              ) : null}
            </div>

            {canEdit ? (
              <div className="relative mb-5">
                <div className="flex items-center gap-2 rounded-xl border border-wk-border bg-wk-bg px-3 py-2.5">
                  <WkIcon name="Search" size={15} className="text-wk-text-faint" />
                  <input
                    value={trackQuery}
                    onChange={(event) => setTrackQuery(event.target.value)}
                    placeholder={
                      matchingItemId
                        ? "Find the Registry track to match"
                        : "Search Registry by track or artist"
                    }
                    className="w-full bg-transparent text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint"
                  />
                  {searching ? (
                    <WkIcon
                      name="LoaderCircle"
                      size={14}
                      className="animate-spin text-wk-text-faint"
                    />
                  ) : null}
                </div>

                {trackResults.length > 0 ? (
                  <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-wk-border bg-wk-surface p-2 shadow-xl">
                    {trackResults.map((track) => (
                      <button
                        key={track.id}
                        disabled={busy !== null}
                        onClick={() => {
                          if (matchingItemId) {
                            void runAction(
                              `match:${matchingItemId}`,
                              () =>
                                resolvePlaylistItemMatch(
                                  playlist.id,
                                  matchingItemId,
                                  playlist.authorityRevision,
                                  track,
                                ),
                              "Registry match saved.",
                            ).then(() => {
                              setMatchingItemId(null);
                              setTrackQuery("");
                              setTrackResults([]);
                            });
                          } else {
                            void handleAddTrack(track);
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-wk-surface-raised disabled:opacity-50"
                      >
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt=""
                            className="h-11 w-11 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-wk-bg-subtle text-wk-text-faint">
                            <WkIcon name="Music" size={17} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-bold text-wk-text">
                            {track.title}
                          </div>
                          <div className="truncate text-[11px] text-wk-text-muted">
                            {track.artistNames.join(", ") || "Artist unresolved"}
                            {track.releaseTitle
                              ? ` · ${track.releaseTitle}`
                              : ""}
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-wk-brand">
                          {matchingItemId ? "Match" : "Add"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {linkOpen && canEdit ? (
              <div className="mb-5 space-y-4 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div>
                  <div className="text-[12px] font-black text-wk-text">
                    Add playback from a provider
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
                    Paste a playable source. WAKILISHA validates playback first,
                    then you match it to the canonical Music Registry track.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    value={providerUrl}
                    onChange={(event) => {
                      setProviderUrl(event.target.value);
                      setPlaybackValidation(null);
                      setLinkTrackResults([]);
                    }}
                    placeholder="YouTube, Spotify, Apple Music, or SoundCloud URL"
                    className="min-w-0 flex-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand"
                  />
                  <button
                    onClick={() => void handleValidateProviderLink()}
                    disabled={busy !== null || !providerUrl.trim()}
                    className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
                  >
                    {busy === "provider-validate" ? (
                      <WkIcon name="LoaderCircle" size={14} className="animate-spin" />
                    ) : (
                      <WkIcon name="Play" size={14} />
                    )}
                    Check playback
                  </button>
                </div>

                {playbackValidation ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-xl border border-wk-success/20 bg-wk-success-soft p-3">
                      {playbackValidation.artworkUrl ? (
                        <img
                          src={playbackValidation.artworkUrl}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-wk-surface text-wk-success">
                          <WkIcon
                            name={
                              playbackValidation.playbackKind === "video"
                                ? "Video"
                                : "Music"
                            }
                            size={19}
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-wk-success px-2 py-0.5 text-[9px] font-black uppercase text-white">
                            Playable
                          </span>
                          <span className="rounded-full bg-wk-surface px-2 py-0.5 text-[9px] font-black uppercase text-wk-text-muted">
                            {humanize(playbackValidation.providerKey)}
                          </span>
                          <span className="rounded-full bg-wk-surface px-2 py-0.5 text-[9px] font-black uppercase text-wk-text-muted">
                            {playbackValidation.playbackKind}
                          </span>
                        </div>
                        <div className="mt-2 truncate text-[13px] font-bold text-wk-text">
                          {playbackValidation.titleHint || "Provider track"}
                        </div>
                        <div className="truncate text-[11px] text-wk-text-muted">
                          {playbackValidation.artistNamesHint.join(", ") ||
                            "Provider artist not supplied"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
                        Match to Music Registry
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                        <WkIcon name="Search" size={14} className="text-wk-text-faint" />
                        <input
                          value={linkTrackQuery}
                          onChange={(event) =>
                            void handleLinkTrackSearch(event.target.value)
                          }
                          placeholder="Search the Registry track or artist"
                          className="w-full bg-transparent text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint"
                        />
                      </div>

                      {linkTrackResults.length > 0 ? (
                        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-wk-border bg-wk-surface p-2">
                          {linkTrackResults.map((track) => (
                            <button
                              key={track.id}
                              onClick={() => void handleAddValidatedTrack(track)}
                              disabled={busy !== null}
                              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-wk-surface-raised disabled:opacity-50"
                            >
                              {track.artworkUrl ? (
                                <img
                                  src={track.artworkUrl}
                                  alt=""
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-bg-subtle text-wk-text-faint">
                                  <WkIcon name="Music" size={15} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-bold text-wk-text">
                                  {track.title}
                                </div>
                                <div className="truncate text-[10px] text-wk-text-muted">
                                  {track.artistNames.join(", ") ||
                                    "Artist unresolved"}
                                </div>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-wider text-wk-brand">
                                Use track
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-dashed border-wk-border p-3">
                      <button
                        onClick={() =>
                          setRegistryIntakeOpen((value) => !value)
                        }
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="text-[12px] font-bold text-wk-text">
                            Track not in the Registry?
                          </div>
                          <div className="mt-0.5 text-[10px] text-wk-text-muted">
                            Send provider evidence to Registry intake. The track
                            stays in this Playlist while Registry reviews its identity
                            and metadata.
                          </div>
                        </div>
                        <WkIcon
                          name={registryIntakeOpen ? "ChevronUp" : "ChevronDown"}
                          size={14}
                          className="text-wk-text-faint"
                        />
                      </button>

                      {registryIntakeOpen ? (
                        <div className="mt-4 space-y-3 border-t border-wk-border pt-4">
                          <div className="rounded-lg bg-wk-bg p-3 text-[11px] text-wk-text-muted">
                            Provider artist observation:
                            <span className="ml-1 font-bold text-wk-text">
                              {playbackValidation.artistNamesHint.join(", ") ||
                                "Not supplied"}
                            </span>
                          </div>

                          <div>
                            <div className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
                              Artist credits
                            </div>
                            <p className="mt-1 text-[10px] leading-5 text-wk-text-muted">
                              Add every primary and featured artist. Existing
                              Registry artists stay canonical. Alias and new-artist
                              choices remain suggestions until Registry review.
                            </p>
                          </div>

                          {intakeArtistCredits.length > 0 ? (
                            <div className="space-y-2">
                              {intakeArtistCredits.map((credit, index) => (
                                <div
                                  key={`${credit.registryArtistId ?? credit.observedName}:${index}`}
                                  className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-surface p-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[11px] font-bold text-wk-text">
                                      {credit.displayName}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[8px] font-black uppercase text-wk-brand">
                                        {credit.creditRole}
                                      </span>
                                      <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[8px] font-bold uppercase text-wk-text-muted">
                                        {humanize(credit.resolutionMode)}
                                      </span>
                                      {credit.resolutionMode === "alias_candidate" &&
                                      credit.observedName !== credit.displayName ? (
                                        <span className="text-[9px] text-wk-text-muted">
                                          observed as {credit.observedName}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      removeRegistryIntakeArtistCredit(index)
                                    }
                                    className="rounded-md p-1.5 text-wk-text-faint hover:bg-wk-danger-soft hover:text-wk-danger"
                                    aria-label={`Remove ${credit.displayName} artist credit`}
                                  >
                                    <WkIcon name="X" size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
                            <input
                              value={artistQuery}
                              onChange={(event) =>
                                void handleArtistSearch(event.target.value)
                              }
                              placeholder="Search Registry artist or enter a new-artist observation"
                              className="w-full bg-transparent text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint"
                            />
                          </div>

                          {artistResults.length > 0 ? (
                            <div className="max-h-44 overflow-y-auto rounded-lg border border-wk-border bg-wk-surface p-1.5">
                              {artistResults.map((artist) => (
                                <button
                                  key={artist.id}
                                  onClick={() => {
                                    setSelectedRegistryArtist(artist);
                                    setArtistResolutionMode("existing_artist");
                                  }}
                                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] ${
                                    selectedRegistryArtist?.id === artist.id
                                      ? "bg-wk-brand-soft text-wk-brand"
                                      : "text-wk-text hover:bg-wk-surface-raised"
                                  }`}
                                >
                                  <span className="font-bold">
                                    {artist.displayName}
                                  </span>
                                  <span className="text-[9px] uppercase text-wk-text-faint">
                                    {artist.status}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              onClick={() => setIntakeArtistRole("primary")}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                                intakeArtistRole === "primary"
                                  ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                                  : "border-wk-border text-wk-text-muted"
                              }`}
                            >
                              Primary artist
                            </button>
                            <button
                              onClick={() => setIntakeArtistRole("featured")}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                                intakeArtistRole === "featured"
                                  ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                                  : "border-wk-border text-wk-text-muted"
                              }`}
                            >
                              Featured artist
                            </button>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <button
                              onClick={() =>
                                setArtistResolutionMode("existing_artist")
                              }
                              disabled={!selectedRegistryArtist}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                                artistResolutionMode === "existing_artist"
                                  ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                                  : "border-wk-border text-wk-text-muted"
                              } disabled:opacity-40`}
                            >
                              Existing artist
                            </button>
                            <button
                              onClick={() =>
                                setArtistResolutionMode("alias_candidate")
                              }
                              disabled={!selectedRegistryArtist}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                                artistResolutionMode === "alias_candidate"
                                  ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                                  : "border-wk-border text-wk-text-muted"
                              } disabled:opacity-40`}
                            >
                              Alias of selected
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRegistryArtist(null);
                                setArtistResolutionMode("new_artist");
                              }}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                                artistResolutionMode === "new_artist"
                                  ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                                  : "border-wk-border text-wk-text-muted"
                              }`}
                            >
                              Suggest new artist
                            </button>
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={addRegistryIntakeArtistCredit}
                              className="wk-button wk-button-ghost wk-button-sm"
                            >
                              <WkIcon name="UserPlus" size={14} />
                              Add artist credit
                            </button>
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={() => void handleRegistryIntake()}
                              disabled={
                                busy !== null ||
                                intakeArtistCredits.length < 1 ||
                                !intakeArtistCredits.some(
                                  (credit) =>
                                    credit.creditRole === "primary",
                                )
                              }
                              className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
                            >
                              <WkIcon name="Database" size={14} />
                              Send to Registry
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <button
                    onClick={resetProviderFlow}
                    className="wk-button wk-button-ghost wk-button-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {legacyUnresolvedRegistryCount > 0 ? (
              <div className="mb-4 rounded-xl border border-wk-warning/20 bg-wk-warning-soft px-4 py-3 text-[11px] leading-5 text-wk-warning">
                {legacyUnresolvedRegistryCount} draft{" "}
                {legacyUnresolvedRegistryCount === 1 ? "item still needs" : "items still need"}{" "}
                Music Registry identity. These pre-M213 rows are preserved. Match
                or remove each legacy row before review.
              </div>
            ) : null}

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-wk-border px-5 py-12 text-center">
                <WkIcon
                  name="ListMusic"
                  size={28}
                  className="mx-auto text-wk-text-faint"
                />
                <div className="mt-3 text-[14px] font-bold text-wk-text">
                  Start with the first track
                </div>
                <p className="mx-auto mt-1 max-w-md text-[12px] text-wk-text-muted">
                  Search the Music Registry above. If a provider link points
                  to missing music, send it to Registry intake first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {canEdit && items.length > 1 ? (
                  <div className="flex items-center gap-2 px-1 pb-1 text-[10px] font-medium text-wk-text-faint">
                    <WkIcon name="GripVertical" size={12} />
                    Drag by the handle. The green line shows exactly where the track will land.
                  </div>
                ) : null}
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    onDragOver={(event) =>
                      handleTrackDragOver(event, item.id)
                    }
                    onDragLeave={(event) => {
                      const nextTarget = event.relatedTarget as Node | null;
                      if (
                        nextTarget &&
                        event.currentTarget.contains(nextTarget)
                      ) {
                        return;
                      }
                      if (dragTarget?.itemId === item.id) {
                        setDragTarget(null);
                      }
                    }}
                    onDrop={(event) =>
                      handleTrackDrop(event, item.id)
                    }
                    className={`relative rounded-xl border bg-wk-bg-subtle p-3 transition-[transform,box-shadow,opacity,border-color] duration-150 ${
                      draggedItemId === item.id
                        ? "scale-[0.99] border-wk-brand/40 opacity-45 shadow-sm"
                        : dragTarget?.itemId === item.id
                          ? "border-wk-brand/60 shadow-md"
                          : "border-wk-border"
                    }`}
                  >
                    {dragTarget?.itemId === item.id &&
                    draggedItemId !== item.id ? (
                      <div
                        className={`pointer-events-none absolute left-3 right-3 z-20 h-0.5 rounded-full bg-wk-brand shadow-[0_0_0_2px_rgba(255,255,255,0.9)] ${
                          dragTarget.edge === "before"
                            ? "-top-[5px]"
                            : "-bottom-[5px]"
                        }`}
                      >
                        <span
                          className={`absolute right-0 rounded-full bg-wk-brand px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white ${
                            dragTarget.edge === "before"
                              ? "bottom-1"
                              : "top-1"
                          }`}
                        >
                          Drop here
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-start gap-3">
                      <div
                        draggable={canEdit && busy === null}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            item.id,
                          );
                          setDraggedItemId(item.id);
                          setDragTarget(null);
                        }}
                        onDragEnd={finishTrackDrag}
                        title="Drag to reorder"
                        aria-label={`Drag track ${index + 1} to reorder`}
                        className={`flex h-10 w-8 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md text-wk-text-faint transition-colors ${
                          canEdit && busy === null
                            ? "cursor-grab hover:bg-wk-surface hover:text-wk-brand active:cursor-grabbing"
                            : ""
                        }`}
                      >
                        <WkIcon name="GripVertical" size={14} />
                        <span className="text-[10px] font-black">
                          {item.position}
                        </span>
                      </div>

                      {item.artworkUrl ? (
                        <img
                          src={item.artworkUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-text-faint">
                          <WkIcon name="Music" size={17} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-wk-text">
                          {item.title || "Untitled track"}
                        </div>
                        <div className="truncate text-[11px] text-wk-text-muted">
                          {item.artistNames.join(", ") || "Artist unresolved"}
                          {item.releaseTitle ? ` · ${item.releaseTitle}` : ""}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={
                              item.matchStatus === "matched"
                                ? "rounded-full bg-wk-success-soft px-2 py-0.5 text-[9px] font-black uppercase text-wk-success"
                                : "rounded-full bg-wk-warning-soft px-2 py-0.5 text-[9px] font-black uppercase text-wk-warning"
                            }
                          >
                            {humanize(item.matchStatus)}
                          </span>
                        {item.matchStatus === "needs_review" ? (
                          <a
                            href={`/admin/registry/tracks/intake?playlistItem=${item.id}`}
                            className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2 py-0.5 text-[8px] font-black uppercase text-wk-warning hover:underline"
                          >
                            <WkIcon name="ExternalLink" size={9} />
                            Review in Registry
                          </a>
                        ) : null}

                          {item.providerKey ? (
                            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[9px] font-bold text-wk-text-muted">
                              {humanize(item.providerKey)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {canEdit ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => moveItem(item.id, -1)}
                            disabled={index === 0 || busy !== null}
                            className="rounded-md p-1.5 text-wk-text-faint hover:bg-wk-surface hover:text-wk-text disabled:opacity-30"
                            aria-label={`Move ${trackLabel(item)} up`}
                          >
                            <WkIcon name="ChevronUp" size={14} />
                          </button>
                          <button
                            onClick={() => moveItem(item.id, 1)}
                            disabled={
                              index === items.length - 1 || busy !== null
                            }
                            className="rounded-md p-1.5 text-wk-text-faint hover:bg-wk-surface hover:text-wk-text disabled:opacity-30"
                            aria-label={`Move ${trackLabel(item)} down`}
                          >
                            <WkIcon name="ChevronDown" size={14} />
                          </button>
                          {item.matchStatus !== "matched" ? (
                            <button
                              onClick={() => {
                                setMatchingItemId(item.id);
                                setTrackQuery(item.title ?? "");
                              }}
                              className="rounded-md p-1.5 text-wk-text-faint hover:bg-wk-surface hover:text-wk-brand"
                              aria-label={`Match ${trackLabel(item)} to Registry`}
                            >
                              <WkIcon name="Link2" size={14} />
                            </button>
                          ) : null}
                          <button
                            onClick={() =>
                              void runAction(
                                `remove:${item.id}`,
                                () =>
                                  removePlaylistItem(
                                    playlist.id,
                                    item.id,
                                    playlist.authorityRevision,
                                  ),
                                "Track removed.",
                              )
                            }
                            disabled={busy !== null}
                            className="rounded-md p-1.5 text-wk-text-faint hover:bg-wk-danger-soft hover:text-wk-danger disabled:opacity-40"
                            aria-label={`Remove ${trackLabel(item)}`}
                          >
                            <WkIcon name="Trash2" size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex gap-2 pl-11 sm:pl-[92px]">
                      <textarea
                        value={noteDrafts[item.id] ?? ""}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        rows={2}
                        placeholder="Optional curator note"
                        className="min-w-0 flex-1 resize-y rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[11px] leading-5 text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                      />
                      {canEdit ? (
                        <button
                          onClick={() =>
                            void runAction(
                              `note:${item.id}`,
                              () =>
                                savePlaylistItemNote(
                                  playlist.id,
                                  item.id,
                                  playlist.authorityRevision,
                                  noteDrafts[item.id] ?? "",
                                ),
                              "Track note saved.",
                            )
                          }
                          disabled={
                            busy !== null ||
                            (noteDrafts[item.id] ?? "") === (item.notes ?? "")
                          }
                          className="wk-button wk-button-ghost wk-button-sm self-end disabled:opacity-40"
                        >
                          Save note
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WkSurface>
        </div>

        <div className="space-y-5">
          <WkSurface className="space-y-4 p-5">
            <div>
              <h2 className="text-[15px] font-black text-wk-text">
                Playlist details
              </h2>
              <p className="mt-1 text-[11px] text-wk-text-muted">
                The idea, public identity, and curator presentation.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] font-semibold text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Slug
              </span>
              <input
                value={slug}
                onChange={(event) =>
                  setSlug(slugifyPlaylistTitle(event.target.value))
                }
                disabled={!canEdit}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Curator
              </span>
              <input
                value={curatorLabel}
                onChange={(event) => setCuratorLabel(event.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                placeholder="Displayed curator name"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEdit}
                rows={6}
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] leading-5 text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            {canEdit ? (
              <button
                onClick={() => void handleMetadataSave()}
                disabled={busy !== null}
                className="wk-button wk-button-primary wk-button-sm w-full disabled:opacity-50"
              >
                <WkIcon name="Save" size={14} />
                Save details
              </button>
            ) : null}
          </WkSurface>

          <WkSurface className="space-y-4 p-5">
            <div>
              <h2 className="text-[15px] font-black text-wk-text">
                Cover
              </h2>
              <p className="mt-1 text-[11px] text-wk-text-muted">
                Choose any canonical Media image. WAKILISHA prepares a square
                Playlist-cover variant and keeps the source image untouched.
              </p>
            </div>

            <div className="aspect-square overflow-hidden rounded-xl border border-wk-border bg-wk-bg-subtle">
              {cover?.url || playlist.coverImageUrl ? (
                <img
                  src={cover?.url || playlist.coverImageUrl || ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-wk-text-faint">
                  <WkIcon name="Image" size={28} />
                  <span className="text-[11px] font-semibold">
                    No cover selected
                  </span>
                </div>
              )}
            </div>

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <MediaPickerButton
                  currentUrl={cover?.url || playlist.coverImageUrl || undefined}
                  label={cover ? "Replace cover" : "Choose cover"}
                  title="Select Playlist Cover"
                  onSelect={(assetId) => {
                    if (!assetId) {
                      setMessage({
                        type: "warning",
                        text: "Register this image in Media Library before using it as a Playlist cover.",
                      });
                      return;
                    }
                    void handleCoverSelection(assetId);
                  }}
                />
                {cover ? (
                  <button
                    onClick={() =>
                      void runAction(
                        "cover-clear",
                        () =>
                          setPlaylistCover(
                            playlist.id,
                            playlist.authorityRevision,
                            null,
                          ),
                        "Playlist cover cleared.",
                      )
                    }
                    className="wk-button wk-button-ghost wk-button-sm text-wk-danger"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}
          </WkSurface>

          <WkSurface className="space-y-4 p-5">
            <div>
              <h2 className="text-[15px] font-black text-wk-text">
                Review
              </h2>
              <p className="mt-1 text-[11px] text-wk-text-muted">
                Review is anchored to an immutable Playlist version, not the
                moving draft.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-wk-bg-subtle p-3">
                <div className="font-black uppercase tracking-wider text-wk-text-faint">
                  Submitted
                </div>
                <div className="mt-1 font-bold text-wk-text">
                  {review?.currentSubmittedVersionId ? "Ready" : "None"}
                </div>
              </div>
              <div className="rounded-lg bg-wk-bg-subtle p-3">
                <div className="font-black uppercase tracking-wider text-wk-text-faint">
                  Approved
                </div>
                <div className="mt-1 font-bold text-wk-text">
                  {review?.currentApprovedVersionId ? "Yes" : "No"}
                </div>
              </div>
            </div>

            {(canEdit || canManageReview) ? (
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                rows={3}
                placeholder="Review note, optional unless requesting changes"
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[11px] leading-5 text-wk-text outline-none focus:border-wk-brand"
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <button
                  onClick={() =>
                    void runAction(
                      "snapshot",
                      () =>
                        snapshotPlaylistWorkingVersion(
                          playlist.id,
                          playlist.authorityRevision,
                        ),
                      "Working snapshot refreshed.",
                    )
                  }
                  disabled={busy !== null}
                  className="wk-button wk-button-ghost wk-button-sm disabled:opacity-50"
                >
                  Snapshot
                </button>
              ) : null}

              {canEdit &&
              ["draft", "changes_requested"].includes(playlist.status) ? (
                <button
                  onClick={() =>
                    void runAction(
                      "submit",
                      () =>
                        submitPlaylistForReview(
                          playlist.id,
                          playlist.authorityRevision,
                          reviewNote,
                        ),
                      "Playlist submitted for review.",
                    )
                  }
                  disabled={busy !== null || items.length === 0}
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
                >
                  <WkIcon name="Send" size={13} />
                  Submit
                </button>
              ) : null}

              {canManageReview &&
              playlist.status === "ready_for_review" &&
              submittedVersionId ? (
                <button
                  onClick={() =>
                    void runAction(
                      "review-start",
                      () =>
                        reviewPlaylist(
                          playlist.id,
                          submittedVersionId,
                          playlist.authorityRevision,
                          "start_review",
                          reviewNote,
                        ),
                      "Review started.",
                    )
                  }
                  disabled={busy !== null}
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
                >
                  Start review
                </button>
              ) : null}

              {canManageReview &&
              playlist.status === "in_review" &&
              submittedVersionId ? (
                <>
                  <button
                    onClick={() => {
                      if (!reviewNote.trim()) {
                        setMessage({
                          type: "error",
                          text: "Explain what needs to change.",
                        });
                        return;
                      }
                      void runAction(
                        "review-changes",
                        () =>
                          reviewPlaylist(
                            playlist.id,
                            submittedVersionId,
                            playlist.authorityRevision,
                            "request_changes",
                            reviewNote,
                          ),
                        "Changes requested.",
                      );
                    }}
                    disabled={busy !== null}
                    className="wk-button wk-button-ghost wk-button-sm disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    onClick={() =>
                      void runAction(
                        "review-approve",
                        () =>
                          reviewPlaylist(
                            playlist.id,
                            submittedVersionId,
                            playlist.authorityRevision,
                            "approve",
                            reviewNote,
                          ),
                        "Playlist approved.",
                      )
                    }
                    disabled={busy !== null}
                    className="wk-button wk-button-primary wk-button-sm disabled:opacity-50"
                  >
                    <WkIcon name="CheckCircle2" size={13} />
                    Approve
                  </button>
                </>
              ) : null}
            </div>

            {review?.reviewEvents.length ? (
              <div className="border-t border-wk-border pt-4">
                <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                  Review history
                </div>
                <div className="space-y-2">
                  {[...review.reviewEvents]
                    .sort(
                      (a, b) =>
                        Number(b.event_number ?? 0) -
                        Number(a.event_number ?? 0),
                    )
                    .slice(0, 8)
                    .map((event, index) => (
                      <div
                        key={event.id ?? `${event.action}-${index}`}
                        className="rounded-lg bg-wk-bg-subtle px-3 py-2"
                      >
                        <div className="text-[11px] font-bold text-wk-text">
                          {humanize(event.action ?? "Review event")}
                        </div>
                        <div className="mt-0.5 text-[10px] text-wk-text-muted">
                          {humanize(event.prior_status ?? "")}
                          {" → "}
                          {humanize(event.resulting_status ?? "")}
                          {event.created_at
                            ? ` · ${new Date(event.created_at).toLocaleString()}`
                            : ""}
                        </div>
                        {event.reason ? (
                          <div className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                            {event.reason}
                          </div>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </WkSurface>
        </div>
      </div>
    </div>
  );
}
