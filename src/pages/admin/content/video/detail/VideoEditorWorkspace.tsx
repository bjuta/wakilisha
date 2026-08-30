import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import {
  AdminRecordActions,
  type AdminRecordActionDescriptor,
} from "@/components/design-system/admin/AdminRecordActions";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import { EditorialWorkflowRail } from "@/components/design-system/editorial/EditorialWorkflowRail";
import {
  EditorialDecisionWorkspace,
  type EditorialDecisionDescriptor,
  type EditorialDecisionEvent,
} from "@/components/design-system/editorial/EditorialDecisionWorkspace";
import { EditorialMetadataWorkspace } from "@/components/design-system/editorial/EditorialMetadataWorkspace";
import { MediaTimeline } from "@/components/design-system/editorial/MediaTimeline";
import {
  MediaTransport,
  formatMediaTime,
} from "@/components/design-system/editorial/MediaTransport";
import {
  createEditorialTaxonomyTerm,
  fetchEditorialDiscovery,
  saveEditorialDiscovery,
  searchEditorialTaxonomyTerms,
} from "@/services/editorial/editorialDiscoveryService";
import type {
  EditorialDiscoveryDraft,
  EditorialDiscoveryValue,
} from "@/types/editorialDiscovery";
import {
  fetchVideoPublicationWorkspace,
  publishVideoPublicationVersion,
  registerExternalVideoSource,
  registerNativeVideoSource,
  replaceVideoPublicationCaptions,
  replaceVideoPublicationChapters,
  reviewVideoPublication,
  setVideoPublicationPoster,
  setVideoPublicationSource,
  setVideoPublicationTranscript,
  snapshotVideoPublicationWorkingVersion,
  submitVideoPublicationForReview,
  updateVideoPublicationMetadata,
  type VideoCaptionTrack,
  type VideoChapter,
  type VideoPublicationWorkspace,
} from "@/services/video/videoAdminService";

type WorkspaceView =
  | "details"
  | "source"
  | "captions"
  | "chapters"
  | "discovery"
  | "review"
  | "history";

type PickerKind = "native" | "poster" | "transcript" | "caption" | null;

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Video could not be updated.";
}

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function providerEmbedUrl(
  providerKey: string | null,
  providerObjectId: string | null,
  canonicalUrl: string | null,
): string | null {
  if (providerKey === "youtube" && providerObjectId) {
    return `https://www.youtube.com/embed/${providerObjectId}`;
  }
  if (providerKey === "vimeo" && providerObjectId) {
    return `https://player.vimeo.com/video/${providerObjectId}`;
  }
  return canonicalUrl;
}

function eventValue(event: JsonObject, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = nullableText(event[key]);
    if (value) return value;
  }
  return null;
}

export function VideoEditorWorkspace({
  publicationId,
}: {
  publicationId?: string;
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [workspace, setWorkspace] = useState<VideoPublicationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<WorkspaceView>("details");
  const [picker, setPicker] = useState<PickerKind>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [classification, setClassification] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [providerKey, setProviderKey] = useState("");
  const [providerObjectId, setProviderObjectId] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [captionDrafts, setCaptionDrafts] = useState<VideoCaptionTrack[]>([]);
  const [chapterDrafts, setChapterDrafts] = useState<VideoChapter[]>([]);
  const [decisionNote, setDecisionNote] = useState("");
  const [discovery, setDiscovery] = useState<EditorialDiscoveryValue | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  async function reload() {
    if (!publicationId) return;
    const next = await fetchVideoPublicationWorkspace(publicationId);
    setWorkspace(next);
    setTitle(next.publication.title);
    setSlug(next.publication.slug);
    setSummary(next.publication.summary || "");
    setClassification(next.publication.classification);
    setVisibility(next.resource.visibility);
    setCaptionDrafts(next.captions);
    setChapterDrafts(next.chapters);
    if (next.selectedSource?.providerKey) {
      setProviderKey(next.selectedSource.providerKey);
      setProviderObjectId(next.selectedSource.providerObjectId || "");
      setProviderUrl(next.selectedSource.canonicalUrl || "");
    }
  }

  useEffect(() => {
    let alive = true;
    if (!publicationId) {
      setLoading(false);
      return;
    }
    fetchVideoPublicationWorkspace(publicationId)
      .then((next) => {
        if (!alive) return;
        setWorkspace(next);
        setTitle(next.publication.title);
        setSlug(next.publication.slug);
        setSummary(next.publication.summary || "");
        setClassification(next.publication.classification);
        setVisibility(next.resource.visibility);
        setCaptionDrafts(next.captions);
        setChapterDrafts(next.chapters);
        if (next.selectedSource?.providerKey) {
          setProviderKey(next.selectedSource.providerKey);
          setProviderObjectId(next.selectedSource.providerObjectId || "");
          setProviderUrl(next.selectedSource.canonicalUrl || "");
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
  }, [publicationId]);

  const workingVersionId = workspace?.resource.versions.working || null;

  useEffect(() => {
    let alive = true;
    if (!workingVersionId) {
      setDiscovery(null);
      setDiscoveryError(null);
      setDiscoveryLoading(false);
      return;
    }
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    fetchEditorialDiscovery("video_publication_version", workingVersionId)
      .then((value) => {
        if (alive) setDiscovery(value);
      })
      .catch((reason) => {
        if (!alive) return;
        setDiscovery(null);
        setDiscoveryError(errorText(reason));
      })
      .finally(() => {
        if (alive) setDiscoveryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workingVersionId]);

  useEffect(() => {
    const mediaDuration = workspace?.selectedMedia?.durationSeconds;
    if (mediaDuration && mediaDuration > 0) setDuration(mediaDuration);
  }, [workspace?.selectedMedia?.durationSeconds]);

  const editable = Boolean(
    workspace?.capabilities.canEdit &&
      ["draft", "changes_requested"].includes(
        workspace?.resource.lifecycleState || "",
      ),
  );

  const detailsDirty = Boolean(
    workspace &&
      (title !== workspace.publication.title ||
        slug !== workspace.publication.slug ||
        summary !== (workspace.publication.summary || "") ||
        classification !== workspace.publication.classification ||
        visibility !== workspace.resource.visibility),
  );

  const decisionEvents = useMemo<EditorialDecisionEvent[]>(() => {
    if (!workspace) return [];
    const mapEvent = (
      value: JsonObject,
      prefix: string,
      index: number,
    ): EditorialDecisionEvent => ({
      id:
        eventValue(value, "id", "event_id") ||
        `${prefix}-${index}`,
      action: eventValue(value, "action", "event_type") || prefix,
      priorStatus: eventValue(value, "prior_status", "prior_state"),
      resultingStatus: eventValue(value, "resulting_status", "resulting_state"),
      note: eventValue(value, "note", "reason"),
      actorLabel: eventValue(value, "actor_label"),
      createdAt: eventValue(value, "created_at"),
    });
    return [
      ...workspace.reviewEvents.map((event, index) =>
        mapEvent(event, "review", index)
      ),
      ...workspace.lifecycleEvents.map((event, index) =>
        mapEvent(event, "lifecycle", index)
      ),
    ];
  }, [workspace]);

  const timelineChapters = useMemo(
    () =>
      chapterDrafts.map((chapter, index) => ({
        id: chapter.id || `chapter-${index + 1}`,
        timeSeconds: chapter.startSeconds,
        label: chapter.title || `Chapter ${index + 1}`,
      })),
    [chapterDrafts],
  );

  async function run(
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      await reload();
      setMessage(success);
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function saveDetails() {
    if (!workspace || !editable || !detailsDirty) return;
    const payload: JsonObject = {
      classification,
      visibility,
    };
    if (workspace.publication.publicationKind === "standalone") {
      payload.title = title.trim();
      payload.slug = slug.trim();
      payload.summary = summary.trim() || null;
    }
    await run(
      "details",
      () =>
        updateVideoPublicationMetadata(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          payload,
        ),
      "Video details saved.",
    );
  }

  async function snapshotWorking() {
    if (!workspace) return;
    await run(
      "snapshot",
      () =>
        snapshotVideoPublicationWorkingVersion(
          workspace.publication.id,
          workspace.publication.authorityRevision,
        ),
      "Working Video version saved.",
    );
  }

  async function submitReview() {
    if (!workspace) return;
    await run(
      "submit",
      () =>
        submitVideoPublicationForReview(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          decisionNote,
        ),
      "Video sent to Review.",
    );
  }

  async function review(decision: "request_changes" | "approve") {
    if (!workspace?.resource.versions.submitted) return;
    await run(
      decision,
      () =>
        reviewVideoPublication(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          workspace.resource.versions.submitted!,
          decision,
          decisionNote,
        ),
      decision === "approve"
        ? "Video approved."
        : "Changes requested.",
    );
  }

  async function publish() {
    if (!workspace?.resource.versions.approved) return;
    await run(
      "publish",
      () =>
        publishVideoPublicationVersion(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          workspace.resource.versions.approved!,
          decisionNote,
        ),
      "Video published.",
    );
  }

  async function registerProvider(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !providerKey || !providerObjectId.trim() || !providerUrl.trim()) {
      return;
    }
    await run(
      "provider",
      async () => {
        const registered = await registerExternalVideoSource(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          {
            providerKey,
            providerObjectId: providerObjectId.trim(),
            canonicalUrl: providerUrl.trim(),
          },
        );
        const sourceId = text(registered.source_id);
        const revision = Number(
          registered.authority_revision ?? workspace.publication.authorityRevision,
        );
        if (!sourceId) throw new Error("Provider source registration returned no source.");
        await setVideoPublicationSource(
          workspace.publication.id,
          revision,
          sourceId,
        );
      },
      "Provider Video source selected.",
    );
  }

  async function selectNative(assetId: string | null) {
    setPicker(null);
    if (!workspace || !assetId) return;
    await run(
      "native",
      async () => {
        const registered = await registerNativeVideoSource(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          assetId,
        );
        const sourceId = text(registered.source_id);
        const revision = Number(
          registered.authority_revision ?? workspace.publication.authorityRevision,
        );
        if (!sourceId) throw new Error("Native source registration returned no source.");
        await setVideoPublicationSource(
          workspace.publication.id,
          revision,
          sourceId,
        );
      },
      "Native Video source selected.",
    );
  }

  async function selectPoster(assetId: string | null) {
    setPicker(null);
    if (!workspace || !assetId) return;
    await run(
      "poster",
      () =>
        setVideoPublicationPoster(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          assetId,
        ),
      "Poster selected.",
    );
  }

  async function selectTranscript(assetId: string | null) {
    setPicker(null);
    if (!workspace || !assetId) return;
    await run(
      "transcript",
      () =>
        setVideoPublicationTranscript(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          assetId,
        ),
      "Transcript selected.",
    );
  }

  function addCaption(assetId: string | null) {
    setPicker(null);
    if (!assetId || !workspace) return;
    const defaultKind = workspace.captionTrackKinds[0]?.key || "captions";
    setCaptionDrafts((current) => [
      ...current,
      {
        assetId,
        languageTag: "en",
        trackKind: defaultKind,
        label: "English",
        isDefault: current.length === 0,
      },
    ]);
  }

  async function saveCaptions() {
    if (!workspace) return;
    await run(
      "captions",
      () =>
        replaceVideoPublicationCaptions(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          captionDrafts,
        ),
      "Caption tracks saved.",
    );
  }

  async function saveChapters() {
    if (!workspace) return;
    await run(
      "chapters",
      () =>
        replaceVideoPublicationChapters(
          workspace.publication.id,
          workspace.publication.authorityRevision,
          chapterDrafts,
        ),
      "Video chapters saved.",
    );
  }

  async function saveDiscovery(draft: EditorialDiscoveryDraft) {
    if (!discovery) return;
    setBusy("discovery");
    setMessage(null);
    try {
      const saved = await saveEditorialDiscovery(discovery, draft);
      setDiscovery(saved);
      setMessage("Discovery saved.");
    } catch (reason) {
      setMessage(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  function seek(seconds: number) {
    const video = videoRef.current;
    const maximum = Math.max(duration, video?.duration || 0);
    const next = Math.min(Math.max(0, seconds), maximum || seconds);
    if (video) video.currentTime = next;
    setCurrentTime(next);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }

  function changeRate(rate: number) {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  if (loading) {
    return (
      <div
        className="min-h-[50vh]"
        aria-busy="true"
        aria-label="Loading Video Editor"
      />
    );
  }

  if (!workspace || !publicationId) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <WkSurface className="p-6">
          <p className="text-sm font-black text-wk-text">Video could not load.</p>
          {message ? (
            <p className="mt-2 text-xs text-wk-text-muted">{message}</p>
          ) : null}
        </WkSurface>
      </div>
    );
  }

  const source = workspace.selectedSource;
  const nativeUrl = workspace.selectedMedia?.primaryDeliveryUrl || null;
  const providerUrl = providerEmbedUrl(
    source?.providerKey || null,
    source?.providerObjectId || null,
    source?.canonicalUrl || null,
  );

  const headerActions: AdminRecordActionDescriptor[] = [
    {
      key: "save-details",
      label: "Save Details",
      icon: "Save",
      tone: "secondary",
      disabled: !editable || !detailsDirty || busy !== null,
      onClick: () => void saveDetails(),
    },
    {
      key: "snapshot",
      label: "Save Version",
      icon: "Layers",
      tone: "secondary",
      disabled: !editable || busy !== null,
      onClick: () => void snapshotWorking(),
    },
  ];

  if (
    editable &&
    workspace.resource.versions.working
  ) {
    headerActions.push({
      key: "submit",
      label: "Send to Review",
      icon: "Send",
      tone: "primary",
      disabled: busy !== null,
      onClick: () => void submitReview(),
    });
  }

  const reviewActions: EditorialDecisionDescriptor[] = [];
  if (workspace.capabilities.canManageReview && workspace.resource.versions.submitted) {
    reviewActions.push(
      {
        key: "request_changes",
        label: "Request Changes",
        icon: "Undo2" as const,
        tone: "warning" as const,
        requiresNote: true,
        onClick: () => void review("request_changes"),
      },
      {
        key: "approve",
        label: "Approve",
        icon: "CheckCircle2" as const,
        tone: "primary" as const,
        onClick: () => void review("approve"),
      },
    );
  }
  if (workspace.capabilities.canPublish && workspace.resource.versions.approved) {
    reviewActions.push({
      key: "publish",
      label: "Publish",
      icon: "CloudUpload" as const,
      tone: "primary" as const,
      onClick: () => void publish(),
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-4 sm:p-6 lg:p-8">
      <AdminRecordHeader
        collectionLabel="Video"
        title={workspace.publication.title}
        status={workspace.resource.lifecycleState}
        onBack={() => navigate("/admin/content/video")}
        meta={
          <>
            <span>{humanize(workspace.publication.classification)}</span>
            <span>·</span>
            <span>
              {workspace.publication.publicationKind === "episode"
                ? workspace.show?.title || "Shared Show Episode"
                : "Standalone Video"}
            </span>
            <span>·</span>
            <span>Revision {workspace.publication.authorityRevision}</span>
          </>
        }
        actions={
          <AdminRecordActions actions={headerActions}>
            <AdminSaveState
              isDirty={detailsDirty}
              isSaving={busy === "details"}
              locked={!editable}
            />
          </AdminRecordActions>
        }
        footer={
          workspace.publication.publicationKind === "episode" &&
          workspace.showEpisode ? (
            <span>
              Shared Episode: {workspace.showEpisode.title}
              {workspace.showEpisode.episodeNumber
                ? ` · Episode ${workspace.showEpisode.episodeNumber}`
                : ""}
            </span>
          ) : undefined
        }
      />

      {message ? (
        <div
          role="status"
          className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-xs text-wk-text"
        >
          {message}
        </div>
      ) : null}

      <EditorialWorkflowRail
        groups={[
          {
            label: "Compose",
            items: [
              { id: "details", label: "Details" },
              { id: "source", label: "Source & Poster" },
              { id: "captions", label: "Captions" },
              { id: "chapters", label: "Chapters" },
            ],
          },
          {
            label: "Prepare",
            items: [{ id: "discovery", label: "Discovery" }],
          },
          {
            label: "Govern",
            items: [
              { id: "review", label: "Review" },
              { id: "history", label: "History" },
            ],
          },
        ]}
        activeId={view}
        onChange={(id) => setView(id as WorkspaceView)}
      />

      {view === "details" ? (
        <AdminWorkspaceSection
          icon="FilePenLine"
          title="Video details"
          note={
            workspace.publication.publicationKind === "episode"
              ? "Episode identity comes from the shared Show Episode. Video keeps only its own classification and visibility here."
              : "Title, slug, summary, classification, and visibility define the working Video record."
          }
          actions={
            editable ? (
              <button
                type="button"
                onClick={() => void saveDetails()}
                disabled={!detailsDirty || busy !== null}
                className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
              >
                Save Details
              </button>
            ) : null
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-xs font-bold text-wk-text-muted">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!editable || workspace.publication.publicationKind === "episode"}
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-bold text-wk-text-muted">
              Slug
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                disabled={!editable || workspace.publication.publicationKind === "episode"}
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 font-mono text-sm text-wk-text disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-bold text-wk-text-muted">
              Classification
              <select
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
              >
                {workspace.classifications.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-wk-text-muted">
              Visibility
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
              >
                <option value="private">Private</option>
                <option value="internal">Internal</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="text-xs font-bold text-wk-text-muted lg:col-span-2">
              Summary
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                disabled={!editable || workspace.publication.publicationKind === "episode"}
                rows={5}
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
              />
            </label>
          </div>
        </AdminWorkspaceSection>
      ) : null}

      {view === "source" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.8fr)]">
          <AdminWorkspaceSection
            icon="Clapperboard"
            title="Video source"
            note="Native Media and external providers are delivery sources for the same Video publication."
          >
            {source?.sourceKind === "native_media" && nativeUrl ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-wk-border bg-black">
                  <video
                    ref={videoRef}
                    src={nativeUrl}
                    preload="metadata"
                    poster={workspace.selectedMedia?.posterFrameUrl || undefined}
                    className="aspect-video w-full bg-black object-contain"
                    onLoadedMetadata={(event) => {
                      if (Number.isFinite(event.currentTarget.duration)) {
                        setDuration(event.currentTarget.duration);
                      }
                    }}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onTimeUpdate={(event) =>
                      setCurrentTime(event.currentTarget.currentTime)
                    }
                    onEnded={() => setPlaying(false)}
                  />
                </div>
                <MediaTransport
                  playing={playing}
                  currentTime={currentTime}
                  duration={duration}
                  playbackRate={playbackRate}
                  onToggle={() => void togglePlayback()}
                  onSeekBy={(delta) => seek(currentTime + delta)}
                  onPlaybackRateChange={changeRate}
                />
                <MediaTimeline
                  durationSeconds={duration}
                  currentTime={currentTime}
                  chapters={timelineChapters}
                  onSeek={seek}
                  interactive={true}
                />
                <div className="flex flex-wrap gap-2 text-[11px] text-wk-text-muted">
                  <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1">
                    Canonical Media
                  </span>
                  <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1">
                    {workspace.selectedMedia?.mimeType || "Video"}
                  </span>
                  <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1">
                    {formatMediaTime(duration)}
                  </span>
                  <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1">
                    {workspace.selectedMedia?.deliveryReady ? "Delivery ready" : "Processing"}
                  </span>
                </div>
              </div>
            ) : source?.sourceKind === "external_provider" && providerUrl ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-wk-border bg-black">
                  <iframe
                    src={providerUrl}
                    title={workspace.publication.title}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-wk-text-muted">
                  <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1">
                    {source.providerKey
                      ? humanize(source.providerKey)
                      : "External provider"}
                  </span>
                  {source.canonicalUrl ? (
                    <a
                      href={source.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-wk-brand"
                    >
                      Open source
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-wk-border px-5 py-10 text-center">
                <WkIcon
                  name="Clapperboard"
                  size={28}
                  className="mx-auto text-wk-text-faint"
                />
                <p className="mt-3 text-sm font-black text-wk-text">
                  No Video source selected.
                </p>
                <p className="mt-1 text-xs text-wk-text-muted">
                  Choose a canonical native Video or register a provider source.
                </p>
              </div>
            )}

            {editable ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-wk-border pt-4">
                <button
                  type="button"
                  onClick={() => setPicker("native")}
                  className="wk-button wk-button-secondary wk-button-sm"
                >
                  <WkIcon name="Film" size={14} />
                  Select Native Video
                </button>
              </div>
            ) : null}
          </AdminWorkspaceSection>

          <div className="space-y-5">
            <AdminWorkspaceSection
              icon="Link2"
              title="External provider"
              note="Register YouTube, Vimeo, or another enabled provider without changing Video identity."
            >
              <form className="space-y-3" onSubmit={registerProvider}>
                <label className="block text-xs font-bold text-wk-text-muted">
                  Provider
                  <select
                    value={providerKey}
                    onChange={(event) => setProviderKey(event.target.value)}
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
                  >
                    <option value="">Choose a provider</option>
                    {workspace.sourceProviders.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-wk-text-muted">
                  Provider Video ID
                  <input
                    value={providerObjectId}
                    onChange={(event) => setProviderObjectId(event.target.value)}
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
                  />
                </label>
                <label className="block text-xs font-bold text-wk-text-muted">
                  Canonical URL
                  <input
                    type="url"
                    value={providerUrl}
                    onChange={(event) => setProviderUrl(event.target.value)}
                    disabled={!editable}
                    placeholder="https://"
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-sm text-wk-text disabled:opacity-60"
                  />
                </label>
                {editable ? (
                  <button
                    type="submit"
                    disabled={
                      busy !== null ||
                      !providerKey ||
                      !providerObjectId.trim() ||
                      !providerUrl.trim()
                    }
                    className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                  >
                    Register & Select
                  </button>
                ) : null}
              </form>
            </AdminWorkspaceSection>

            <AdminWorkspaceSection
              icon="Image"
              title="Poster"
              note="Poster bytes stay in canonical Media. Video owns the exact placement."
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-wk-text-muted">
                    {workspace.poster?.assetId || "No poster selected"}
                  </p>
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => setPicker("poster")}
                    className="wk-button wk-button-secondary wk-button-sm"
                  >
                    Select Poster
                  </button>
                ) : null}
              </div>
            </AdminWorkspaceSection>

            <AdminWorkspaceSection
              icon="FileText"
              title="Transcript"
              note="Transcript file authority stays in Media and remains separate from caption tracks."
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-mono text-[10px] text-wk-text-muted">
                  {workspace.transcript?.assetId || "No transcript selected"}
                </p>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => setPicker("transcript")}
                    className="wk-button wk-button-secondary wk-button-sm"
                  >
                    Select Transcript
                  </button>
                ) : null}
              </div>
            </AdminWorkspaceSection>
          </div>
        </div>
      ) : null}

      {view === "captions" ? (
        <AdminWorkspaceSection
          icon="Captions"
          title="Captions & subtitles"
          note="Each timed-text track keeps an exact Media asset revision, language, kind, label, and default state."
          actions={
            editable ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPicker("caption")}
                  className="wk-button wk-button-secondary wk-button-sm"
                >
                  Add Track
                </button>
                <button
                  type="button"
                  onClick={() => void saveCaptions()}
                  disabled={busy !== null}
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                >
                  Save Tracks
                </button>
              </div>
            ) : null
          }
        >
          <div className="space-y-3">
            {captionDrafts.map((track, index) => (
              <div
                key={track.id || `${track.assetId}-${index}`}
                className="grid gap-3 rounded-xl border border-wk-border bg-wk-bg p-4 lg:grid-cols-[1fr_130px_180px_1fr_auto_auto]"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                    Media Asset
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-wk-text-muted">
                    {track.assetId}
                  </div>
                </div>
                <label className="text-xs font-bold text-wk-text-muted">
                  Language
                  <input
                    value={track.languageTag}
                    onChange={(event) =>
                      setCaptionDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, languageTag: event.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-xs text-wk-text"
                  />
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Kind
                  <select
                    value={track.trackKind}
                    onChange={(event) =>
                      setCaptionDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, trackKind: event.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-xs text-wk-text"
                  >
                    {workspace.captionTrackKinds.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Label
                  <input
                    value={track.label}
                    onChange={(event) =>
                      setCaptionDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-xs text-wk-text"
                  />
                </label>
                <label className="flex items-center gap-2 self-center text-xs font-bold text-wk-text-muted">
                  <input
                    type="radio"
                    checked={track.isDefault}
                    disabled={!editable}
                    onChange={() =>
                      setCaptionDrafts((current) =>
                        current.map((item, itemIndex) => ({
                          ...item,
                          isDefault: itemIndex === index,
                        })),
                      )
                    }
                  />
                  Default
                </label>
                {editable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCaptionDrafts((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="self-center text-wk-danger"
                    aria-label={`Remove ${track.label} caption track`}
                  >
                    <WkIcon name="Trash2" size={15} />
                  </button>
                ) : null}
              </div>
            ))}
            {!captionDrafts.length ? (
              <p className="py-8 text-center text-xs text-wk-text-muted">
                No caption or subtitle tracks yet.
              </p>
            ) : null}
          </div>
        </AdminWorkspaceSection>
      ) : null}

      {view === "chapters" ? (
        <AdminWorkspaceSection
          icon="ListVideo"
          title="Chapters"
          note="Chapter starts are ordered time coordinates on the Video publication."
          actions={
            editable ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setChapterDrafts((current) => [
                      ...current,
                      {
                        startSeconds: currentTime,
                        title: "",
                        description: null,
                      },
                    ])
                  }
                  className="wk-button wk-button-secondary wk-button-sm"
                >
                  Add at {formatMediaTime(currentTime)}
                </button>
                <button
                  type="button"
                  onClick={() => void saveChapters()}
                  disabled={busy !== null}
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                >
                  Save Chapters
                </button>
              </div>
            ) : null
          }
        >
          {duration > 0 ? (
            <div className="mb-5">
              <MediaTimeline
                durationSeconds={duration}
                currentTime={currentTime}
                chapters={timelineChapters}
                onSeek={seek}
                interactive={Boolean(nativeUrl)}
              />
            </div>
          ) : null}
          <div className="space-y-3">
            {chapterDrafts.map((chapter, index) => (
              <div
                key={chapter.id || index}
                className="grid gap-3 rounded-xl border border-wk-border bg-wk-bg p-4 lg:grid-cols-[130px_1fr_1.5fr_auto]"
              >
                <label className="text-xs font-bold text-wk-text-muted">
                  Start Seconds
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={chapter.startSeconds}
                    onChange={(event) =>
                      setChapterDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                startSeconds: Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-xs text-wk-text"
                  />
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Title
                  <input
                    value={chapter.title}
                    onChange={(event) =>
                      setChapterDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      )
                    }
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-xs text-wk-text"
                  />
                </label>
                <label className="text-xs font-bold text-wk-text-muted">
                  Description
                  <input
                    value={chapter.description || ""}
                    onChange={(event) =>
                      setChapterDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                description: event.target.value || null,
                              }
                            : item,
                        ),
                      )
                    }
                    disabled={!editable}
                    className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-xs text-wk-text"
                  />
                </label>
                {editable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setChapterDrafts((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="self-center text-wk-danger"
                    aria-label={`Remove chapter ${index + 1}`}
                  >
                    <WkIcon name="Trash2" size={15} />
                  </button>
                ) : null}
              </div>
            ))}
            {!chapterDrafts.length ? (
              <p className="py-8 text-center text-xs text-wk-text-muted">
                No chapters yet.
              </p>
            ) : null}
          </div>
        </AdminWorkspaceSection>
      ) : null}

      {view === "discovery" ? (
        <AdminWorkspaceSection
          icon="Search"
          title="Discovery"
          note="Categories, Tags, and search metadata bind to the exact working Video version."
        >
          {!workingVersionId ? (
            <p className="text-xs text-wk-text-muted">
              Save a working Video version before changing Discovery.
            </p>
          ) : discoveryLoading ? (
            <p className="text-xs text-wk-text-muted">Loading Discovery...</p>
          ) : discovery ? (
            <EditorialMetadataWorkspace
              value={discovery}
              disabled={!editable}
              saving={busy === "discovery"}
              onSearchTerms={searchEditorialTaxonomyTerms}
              onCreateTerm={createEditorialTaxonomyTerm}
              onSave={saveDiscovery}
            />
          ) : (
            <p className="text-xs text-wk-text-muted">
              {discoveryError || "Discovery tools are unavailable."}
            </p>
          )}
        </AdminWorkspaceSection>
      ) : null}

      {view === "review" ? (
        <EditorialDecisionWorkspace
          title="Video editorial decision"
          note={decisionNote}
          onNoteChange={setDecisionNote}
          noteLabel="Review note"
          notePlaceholder="Record the reason for this exact-version decision."
          statusLabel={workspace.resource.lifecycleState}
          targetLabel={
            workspace.resource.versions.submitted
              ? `Submitted ${workspace.resource.versions.submitted}`
              : workspace.resource.versions.working
                ? `Working ${workspace.resource.versions.working}`
                : "No saved version"
          }
          actions={reviewActions}
          busy={busy !== null}
          events={decisionEvents}
        >
          <AdminWorkspaceSection
            icon="BadgeCheck"
            title="Review readiness"
            note="Review uses immutable Video versions. Delivery source and accessibility relationships remain visible here."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Source", source ? "Ready" : "Missing"],
                ["Poster", workspace.poster ? "Attached" : "Not attached"],
                ["Captions", workspace.captions.length ? `${workspace.captions.length} track(s)` : "None"],
                ["Chapters", workspace.chapters.length ? `${workspace.chapters.length}` : "None"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-wk-border bg-wk-bg p-3"
                >
                  <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                    {label}
                  </div>
                  <div className="mt-1 text-xs font-bold text-wk-text">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {editable && workspace.resource.versions.working ? (
              <div className="mt-4 border-t border-wk-border pt-4">
                <button
                  type="button"
                  onClick={() => void submitReview()}
                  disabled={busy !== null}
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                >
                  Send Working Version to Review
                </button>
              </div>
            ) : null}
          </AdminWorkspaceSection>
        </EditorialDecisionWorkspace>
      ) : null}

      {view === "history" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <AdminWorkspaceSection
            icon="Layers"
            title="Version history"
            note="Immutable Video content snapshots remain separate from mutable working state."
          >
            <div className="space-y-3">
              {workspace.versionHistory.map((event, index) => (
                <div
                  key={eventValue(event, "id", "version_id") || index}
                  className="rounded-xl border border-wk-border bg-wk-bg p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-wk-text">
                      {eventValue(event, "version_kind", "status") || "Video version"}
                    </span>
                    <span className="font-mono text-[10px] text-wk-text-faint">
                      {eventValue(event, "id", "version_id") || ""}
                    </span>
                  </div>
                  {eventValue(event, "created_at") ? (
                    <p className="mt-1 text-[10px] text-wk-text-muted">
                      {new Date(eventValue(event, "created_at")!).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ))}
              {!workspace.versionHistory.length ? (
                <p className="text-xs text-wk-text-muted">
                  No immutable Video versions yet.
                </p>
              ) : null}
            </div>
          </AdminWorkspaceSection>

          <AdminWorkspaceSection
            icon="History"
            title="Lifecycle history"
            note="Shared Resource lifecycle and review events reconstruct how the Video reached its current state."
          >
            <div className="space-y-3">
              {decisionEvents
                .slice()
                .reverse()
                .map((event) => (
                  <div
                    key={event.id}
                    className="border-l-2 border-wk-border pl-4"
                  >
                    <p className="text-xs font-black text-wk-text">
                      {humanize(event.action)}
                    </p>
                    {event.createdAt ? (
                      <p className="mt-1 text-[10px] text-wk-text-faint">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    ) : null}
                    {event.note ? (
                      <p className="mt-1 text-xs text-wk-text-muted">
                        {event.note}
                      </p>
                    ) : null}
                  </div>
                ))}
              {!decisionEvents.length ? (
                <p className="text-xs text-wk-text-muted">
                  No lifecycle events yet.
                </p>
              ) : null}
            </div>
          </AdminWorkspaceSection>
        </div>
      ) : null}

      <MediaPickerModal
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={
          picker === "native"
            ? "Select Native Video"
            : picker === "poster"
              ? "Select Video Poster"
              : picker === "transcript"
                ? "Select Video Transcript"
                : "Select Caption Track"
        }
        allowedKinds={
          picker === "native"
            ? ["video"]
            : picker === "poster"
              ? ["image"]
              : picker === "transcript"
                ? ["transcript"]
                : ["caption"]
        }
        selectionPurpose={
          picker === "transcript" ? "transcript" : "media"
        }
        onSelect={(assetId) => {
          if (picker === "native") void selectNative(assetId);
          else if (picker === "poster") void selectPoster(assetId);
          else if (picker === "transcript") void selectTranscript(assetId);
          else if (picker === "caption") addCaption(assetId);
        }}
      />
    </div>
  );
}
