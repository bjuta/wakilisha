import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import { TrackMomentDrawer } from "@/components/feature/community/TrackMomentDrawer";
import { useEntityActions } from "@/hooks/useCommunityActions";
import { usePlayer } from "@/context/PlayerContext";
import {
  connectAppleMusicForPlayback,
  getApplePlaybackPrefsSnapshot,
} from "@/services/appleMusicConnection";
import {
  fetchTimedTextDocument,
  type TimedTextDocument,
} from "@/services/player/timedText";
import {
  fetchPublicTrackLyrics,
  type TrackLyricsDocument,
} from "@/services/player/trackLyricsService";
import {
  formatPlayerClock,
  resolvePlayerExperience,
} from "@/services/player/playerExperience";
import { PlayerTopBar } from "./PlayerTopBar";
import {
  PlayerContextSheet,
  type PlayerContextAction,
} from "./PlayerContextSheet";
import { PlayerPanelSheet } from "./PlayerPanelSheet";
import { PlayerQueuePanel } from "./PlayerQueuePanel";
import { PlayerTimedTextPanel } from "./PlayerTimedTextPanel";

export type PlayerFullMode =
  | "desktop"
  | "mobile";

type PlayerPanel =
  | "none"
  | "chapters"
  | "queue"
  | "lyrics"
  | "transcript"
  | "more";

function availabilityDismissKey(id: string) {
  return `wk-player-unlock-dismissed:${id}`;
}

function canonicalShareUrl(path: string | null): string {
  if (typeof window === "undefined") {
    return path
      ? `https://wakilisha.africa${path}`
      : "https://wakilisha.africa";
  }

  return path
    ? `${window.location.origin}${path}`
    : window.location.href;
}

function PlayerUtilityButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: WkIconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-all",
        active
          ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "border-[var(--wk-border)] bg-[var(--wk-surface)]/70 text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
        disabled
          ? "cursor-not-allowed opacity-35"
          : "",
      ].join(" ")}
    >
      <WkIcon name={icon} size={18} />
      <span className="max-w-full truncate text-[10px] font-black">
        {label}
      </span>
    </button>
  );
}

export function PlayerFullSurface({
  mode,
}: {
  mode: PlayerFullMode;
}) {
  const navigate = useNavigate();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    progress,
    queue,
    queueIndex,
    queueOrder,
    repeatMode,
    isShuffle,
    playbackBackend,
    playbackRate,
    togglePlay,
    closeFullPlayer,
    next,
    prev,
    canGoNext,
    canGoPrev,
    seek,
    setVolume,
    volume,
    setPlaybackRate,
    toggleRepeat,
    toggleShuffle,
    playFromQueue,
    moveQueueItem,
    removeQueueItem,
    clearUpcoming,
    playTrack,
  } = usePlayer();

  const [panel, setPanel] =
    useState<PlayerPanel>("none");
  const [appleConnected, setAppleConnected] = useState(
    () => getApplePlaybackPrefsSnapshot().appleMusicConnected,
  );
  const [appleConnecting, setAppleConnecting] = useState(false);
  const [appleConnectError, setAppleConnectError] =
    useState<string | null>(null);
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [lyrics, setLyrics] = useState<TrackLyricsDocument | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [transcript, setTranscript] =
    useState<TimedTextDocument | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] =
    useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    save: saveEntity,
    loading: savePending,
  } = useEntityActions();

  useEffect(() => {
    if (!currentTrack?.id) {
      setUnlockDismissed(false);
      setAppleConnectError(null);
      return;
    }

    setUnlockDismissed(
      sessionStorage.getItem(
        availabilityDismissKey(currentTrack.id),
      ) === "1",
    );
    setAppleConnectError(null);
    setPanel("none");
    setLyrics(null);
    setLyricsError(null);
    setTranscript(null);
    setTranscriptError(null);
    setShareOpen(false);
    setMomentOpen(false);
    setSaved(false);
  }, [currentTrack?.id]);

  useEffect(() => {
    const sync = () =>
      setAppleConnected(
        getApplePlaybackPrefsSnapshot().appleMusicConnected,
      );

    window.addEventListener("wk-playback-changed", sync);
    window.addEventListener("wk-apple-music-connected", sync);

    return () => {
      window.removeEventListener("wk-playback-changed", sync);
      window.removeEventListener("wk-apple-music-connected", sync);
    };
  }, []);

  const experience = useMemo(
    () =>
      currentTrack
        ? resolvePlayerExperience(
            currentTrack,
            playbackBackend,
          )
        : null,
    [currentTrack, playbackBackend],
  );

  useEffect(() => {
    if (
      panel !== "lyrics" ||
      !currentTrack?.registryTrackId ||
      experience?.spokenAudio
    ) {
      return;
    }

    let alive = true;
    setLyricsLoading(true);
    setLyricsError(null);

    fetchPublicTrackLyrics(currentTrack.registryTrackId)
      .then((document) => {
        if (alive) setLyrics(document);
      })
      .catch((error) => {
        if (alive) {
          setLyricsError(
            error instanceof Error
              ? error.message
              : "Lyrics could not load.",
          );
        }
      })
      .finally(() => {
        if (alive) setLyricsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    currentTrack?.registryTrackId,
    experience?.spokenAudio,
    panel,
  ]);

  useEffect(() => {
    if (
      panel !== "transcript" ||
      !experience?.spokenAudio ||
      !experience.transcript?.url
    ) {
      return;
    }

    let alive = true;
    setTranscriptLoading(true);
    setTranscriptError(null);

    fetchTimedTextDocument(experience.transcript.url)
      .then((document) => {
        if (alive) setTranscript(document);
      })
      .catch((error) => {
        if (alive) {
          setTranscriptError(
            error instanceof Error
              ? error.message
              : "Transcript could not load.",
          );
        }
      })
      .finally(() => {
        if (alive) setTranscriptLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    experience?.spokenAudio,
    experience?.transcript?.url,
    panel,
  ]);

  if (!currentTrack || !experience) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--wk-bg)] px-6 text-center text-[var(--wk-text)]">
        <div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
            <WkIcon
              name="Music2"
              size={26}
              className="text-[var(--wk-text-faint)]"
            />
          </div>
          <h1 className="mt-5 text-xl font-black">
            Nothing Playing
          </h1>
          <button
            type="button"
            onClick={closeFullPlayer}
            className="mt-6 rounded-full bg-[var(--wk-text)] px-5 py-2.5 text-sm font-black text-[var(--wk-bg)]"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  const isMobile = mode === "mobile";
  const jump = experience.capabilities.jumpBySeconds ?? 15;
  const pct = Math.max(0, Math.min(1, progress || 0));
  const hasAppleCatalog = Boolean(
    currentTrack.appleMusicCatalogId ||
    currentTrack.appleMusicId,
  );
  const usesProviderMedia =
    playbackBackend === "youtube" ||
    playbackBackend === "soundcloud";
  const queueAvailable =
    experience.capabilities.queue &&
    (!experience.spokenAudio || queue.length > 1);
  const showContextualUnlock =
    !experience.spokenAudio &&
    experience.availability === "excerpt" &&
    hasAppleCatalog &&
    playbackBackend === "audio" &&
    !appleConnected &&
    !unlockDismissed &&
    pct >= 0.72;
  const lyricsTrackSlug =
    currentTrack.trackSlug || currentTrack.id;
  const lyricsContributionQuery =
    currentTrack.registryTrackId
      ? `?track_id=${encodeURIComponent(currentTrack.registryTrackId)}`
      : "";
  const lyricsContributionPath =
    !experience.spokenAudio &&
    currentTrack.artistSlug &&
    lyricsTrackSlug
      ? `/tracks/${encodeURIComponent(currentTrack.artistSlug)}/${encodeURIComponent(lyricsTrackSlug)}/lyrics/contribute${lyricsContributionQuery}`
      : null;

  const skipBack = () =>
    seek(Math.max(0, currentTime - jump));
  const skipForward = () =>
    seek(
      Math.min(
        duration || currentTime + jump,
        currentTime + jump,
      ),
    );

  const dismissUnlock = () => {
    sessionStorage.setItem(
      availabilityDismissKey(currentTrack.id),
      "1",
    );
    setUnlockDismissed(true);
    setAppleConnectError(null);
  };

  const connectForFullPlayback = async () => {
    if (appleConnecting) return;

    setAppleConnecting(true);
    setAppleConnectError(null);
    const resumeAt = currentTime;

    try {
      await connectAppleMusicForPlayback();
      setAppleConnected(true);
      const nextQueue = queue.length
        ? queue
        : [currentTrack];

      playTrack(
        currentTrack,
        nextQueue,
        {
          pageType: "player",
          entityType: experience.mediaKind,
          entitySlug:
            experience.canonicalPath ??
            currentTrack.id,
          sourceSection:
            "contextual_full_playback_unlock",
        },
      );

      window.setTimeout(() => {
        if (resumeAt > 0) seek(resumeAt);
      }, 1200);
    } catch (error) {
      setAppleConnectError(
        error instanceof Error
          ? error.message
          : "Could not connect Apple Music right now.",
      );
    } finally {
      setAppleConnecting(false);
    }
  };

  const handleSave = async () => {
    if (experience.spokenAudio || savePending) return;

    const trackSlug =
      currentTrack.trackSlug ||
      currentTrack.id;
    const url =
      experience.canonicalPath ||
      (currentTrack.artistSlug
        ? `/tracks/${currentTrack.artistSlug}/${trackSlug}`
        : `/tracks/${trackSlug}`);

    const result = await saveEntity({
      entityType: "track",
      entityId:
        currentTrack.registryTrackId ||
        currentTrack.id,
      entitySlug: trackSlug,
      entityUrl: url,
      title: currentTrack.title,
      subtitle: currentTrack.artist,
      imageUrl: currentTrack.artworkUrl,
    });

    if (result) setSaved(result.saved);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const currentIndex = rates.findIndex(
      (rate) =>
        Math.abs(rate - playbackRate) < 0.01,
    );
    const nextRate =
      rates[
        currentIndex >= 0
          ? (currentIndex + 1) % rates.length
          : 0
      ];

    setPlaybackRate(nextRate);
  };

  const shareUrl =
    canonicalShareUrl(experience.canonicalPath);

  const openPanel = (nextPanel: PlayerPanel) => {
    setPanel(nextPanel);
  };

  const goTo = (path: string) => {
    setPanel("none");
    closeFullPlayer();
    navigate(path);
  };

  const contextActions: PlayerContextAction[] = [];

  if (queueAvailable) {
    contextActions.push({
      key: "queue",
      label: "Open Queue",
      description:
        queue.length > 1
          ? "See what is playing now and what comes next."
          : "See what is playing now.",
      icon: "ListMusic",
      onClick: () => openPanel("queue"),
    });
  }

  if (
    !experience.spokenAudio &&
    (currentTrack.registryTrackId || lyricsContributionPath)
  ) {
    contextActions.push({
      key: "lyrics",
      label: "Lyrics",
      description: "Read published Lyrics or contribute them if they are missing.",
      icon: "MicVocal",
      onClick: () => {
        if (currentTrack.registryTrackId) {
          openPanel("lyrics");
        } else if (lyricsContributionPath) {
          goTo(lyricsContributionPath);
        }
      },
    });
  }

  if (
    experience.spokenAudio &&
    experience.capabilities.transcript &&
    experience.transcript
  ) {
    contextActions.push({
      key: "transcript",
      label: "View Transcript",
      description: "Read along and jump to timed lines.",
      icon: "Captions",
      onClick: () => openPanel("transcript"),
    });
  }

  if (
    experience.spokenAudio &&
    experience.capabilities.chapters &&
    experience.chapters.length
  ) {
    contextActions.push({
      key: "chapters",
      label: "View Chapters",
      description: "Jump to a chapter in this Audio.",
      icon: "ListTree",
      onClick: () => openPanel("chapters"),
    });
  }

  if (
    experience.spokenAudio &&
    experience.capabilities.playbackSpeed
  ) {
    contextActions.push({
      key: "speed",
      label: `Playback Speed ${playbackRate}×`,
      description: "Playback speed changes with each tap.",
      icon: "Gauge",
      onClick: cyclePlaybackRate,
    });
  }

  if (
    !experience.spokenAudio &&
    experience.capabilities.save
  ) {
    contextActions.push({
      key: "save",
      label: saved ? "Saved" : "Save Track",
      description: saved
        ? "This Track is in your Saved items."
        : "Keep this Track for later.",
      icon: "Heart",
      active: saved,
      disabled: savePending,
      onClick: () => void handleSave(),
    });
  }

  if (
    !experience.spokenAudio &&
    experience.capabilities.moments
  ) {
    contextActions.push({
      key: "moments",
      label: "Create Moment",
      description: "Start a Moment from the time you are hearing now.",
      icon: "MessageCirclePlus",
      onClick: () => {
        setPanel("none");
        setMomentOpen(true);
      },
    });
  }

  if (experience.capabilities.share) {
    contextActions.push({
      key: "share",
      label: "Share",
      description: "Share this listen from WAKILISHA.",
      icon: "Share2",
      onClick: () => {
        setPanel("none");
        setShareOpen(true);
      },
    });
  }

  if (experience.canonicalPath) {
    contextActions.push({
      key: "open",
      label: experience.spokenAudio
        ? "Open Audio"
        : "Open Track",
      description: experience.spokenAudio
        ? "Open the full Audio page."
        : "Open the canonical Track page.",
      icon: "ExternalLink",
      onClick: () => goTo(experience.canonicalPath as string),
    });
  }

  if (
    !experience.spokenAudio &&
    currentTrack.artistSlug
  ) {
    contextActions.push({
      key: "artist",
      label: "View Artist",
      description: `Open ${currentTrack.artist} on WAKILISHA.`,
      icon: "UserRound",
      onClick: () => goTo(`/artists/${currentTrack.artistSlug}`),
    });
  }

  return (
    <main
      data-wk-player-full={mode}
      className="relative min-h-[100dvh] overflow-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-[-8%] opacity-45 blur-[110px] saturate-150"
        style={{
          backgroundImage:
            currentTrack.artworkUrl
              ? `url(${currentTrack.artworkUrl})`
              : undefined,
          backgroundPosition: "center",
          backgroundSize: "cover",
          transform: "scale(1.18)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[var(--wk-bg)]/84 to-[var(--wk-bg)]" />

      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pb-8 md:px-8 md:pb-10"
        style={{
          paddingTop: isMobile
            ? "max(env(safe-area-inset-top), 16px)"
            : "24px",
        }}
      >
        <PlayerTopBar
          mode={mode}
          label={
            experience.contextLabel ||
            (experience.spokenAudio
              ? "WAKILISHA Audio"
              : "Now Playing")
          }
          onClose={closeFullPlayer}
          onMore={() => setPanel("more")}
        />

        <div
          className={[
            "flex flex-1 items-center justify-center gap-7 py-5 md:py-7",
            isMobile
              ? "flex-col"
              : "flex-col lg:flex-row lg:gap-14",
          ].join(" ")}
        >
          <section className="flex w-full max-w-[520px] flex-col items-center">
            <div
              className={[
                "aspect-square w-full overflow-hidden bg-[var(--wk-surface-raised)] shadow-[0_30px_90px_rgba(0,0,0,0.38)]",
                isMobile
                  ? "max-w-[min(82vw,420px)] rounded-[28px]"
                  : "max-w-[480px] rounded-[30px]",
              ].join(" ")}
            >
              {usesProviderMedia ? (
                <div
                  data-wk-provider-media-host={mode}
                  className="h-full w-full"
                />
              ) : currentTrack.artworkUrl ? (
                <img
                  src={currentTrack.artworkUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Ch19GradientImage
                  slug={currentTrack.id}
                  name={currentTrack.title}
                />
              )}
            </div>

            <div
              className={[
                "mt-5 w-full",
                isMobile
                  ? "max-w-[min(82vw,420px)] text-left"
                  : "max-w-[480px] text-left",
              ].join(" ")}
            >
              <h1 className="text-balance text-[25px] font-black leading-tight tracking-[-0.035em] md:text-[30px]">
                {currentTrack.title}
              </h1>
              <p className="mt-2 truncate text-[14px] font-bold text-[var(--wk-text-muted)]">
                {experience.creatorLabel}
              </p>
            </div>
          </section>

          <section className="w-full max-w-[500px]">
            <div>
              <div className="relative h-7">
                <input
                  aria-label={`Seek ${currentTrack.title}`}
                  type="range"
                  min={0}
                  max={Math.max(1, duration || 1)}
                  step={0.1}
                  value={Math.min(
                    currentTime,
                    Math.max(1, duration || 1),
                  )}
                  onChange={(event) =>
                    seek(Number(event.target.value))
                  }
                  className="absolute inset-x-0 top-2 h-1.5 w-full accent-[var(--wk-brand)]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-[var(--wk-text-faint)]">
                <span>{formatPlayerClock(currentTime)}</span>
                <span>{formatPlayerClock(duration)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-6">
              {experience.spokenAudio ? (
                <>
                  <button
                    type="button"
                    onClick={skipBack}
                    aria-label={`Back ${jump} seconds`}
                    className="flex h-12 min-w-12 items-center justify-center rounded-full text-[13px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  >
                    ↺{jump}
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] shadow-xl transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    <WkIcon
                      name={isPlaying ? "Pause" : "Play"}
                      size={31}
                      fill="currentColor"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={skipForward}
                    aria-label={`Forward ${jump} seconds`}
                    className="flex h-12 min-w-12 items-center justify-center rounded-full text-[13px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  >
                    {jump}↻
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    disabled={!canGoPrev}
                    aria-label="Previous"
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)] disabled:opacity-25"
                  >
                    <WkIcon name="SkipBack" size={25} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] shadow-xl transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    <WkIcon
                      name={isPlaying ? "Pause" : "Play"}
                      size={31}
                      fill="currentColor"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={!canGoNext}
                    aria-label="Next"
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)] disabled:opacity-25"
                  >
                    <WkIcon name="SkipForward" size={25} fill="currentColor" />
                  </button>
                </>
              )}
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {experience.spokenAudio ? (
                <>
                  <PlayerUtilityButton
                    icon="ListMusic"
                    label="Queue"
                    onClick={() => setPanel("queue")}
                    active={panel === "queue"}
                    disabled={!queueAvailable}
                  />
                  <PlayerUtilityButton
                    icon="Captions"
                    label="Transcript"
                    onClick={() => setPanel("transcript")}
                    active={panel === "transcript"}
                    disabled={
                      !experience.capabilities.transcript ||
                      !experience.transcript
                    }
                  />
                  <PlayerUtilityButton
                    icon="ListTree"
                    label="Chapters"
                    onClick={() => setPanel("chapters")}
                    active={panel === "chapters"}
                    disabled={
                      !experience.capabilities.chapters ||
                      !experience.chapters.length
                    }
                  />
                  <PlayerUtilityButton
                    icon="Gauge"
                    label={`${playbackRate}×`}
                    onClick={cyclePlaybackRate}
                    disabled={!experience.capabilities.playbackSpeed}
                  />
                </>
              ) : (
                <>
                  <PlayerUtilityButton
                    icon="ListMusic"
                    label="Queue"
                    onClick={() => setPanel("queue")}
                    active={panel === "queue"}
                    disabled={!experience.capabilities.queue}
                  />
                  <PlayerUtilityButton
                    icon="MicVocal"
                    label="Lyrics"
                    onClick={() => {
                      if (currentTrack.registryTrackId) {
                        setPanel("lyrics");
                      } else if (lyricsContributionPath) {
                        goTo(lyricsContributionPath);
                      }
                    }}
                    active={panel === "lyrics"}
                    disabled={
                      !currentTrack.registryTrackId &&
                      !lyricsContributionPath
                    }
                  />
                  <PlayerUtilityButton
                    icon="Heart"
                    label={saved ? "Saved" : "Save"}
                    onClick={() => void handleSave()}
                    active={saved}
                    disabled={!experience.capabilities.save || savePending}
                  />
                  <PlayerUtilityButton
                    icon="MessageCirclePlus"
                    label="Moments"
                    onClick={() => setMomentOpen(true)}
                    disabled={!experience.capabilities.moments}
                  />
                </>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <WkIcon
                name="Volume2"
                size={16}
                className="text-[var(--wk-text-faint)]"
              />
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) =>
                  setVolume(Number(event.target.value))
                }
                className="h-1 flex-1 accent-[var(--wk-brand)]"
              />
            </div>

            {showContextualUnlock ? (
              <div className="mt-6 rounded-[22px] border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 p-4 backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)]">
                      Keep listening
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--wk-text-muted)]">
                      Connect Apple Music to continue with the full Track here.
                    </p>
                    {appleConnectError ? (
                      <p className="mt-2 text-xs font-semibold text-red-500">
                        {appleConnectError}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={dismissUnlock}
                    aria-label="Dismiss Full Playback Option"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-faint)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  >
                    <WkIcon name="X" size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void connectForFullPlayback()}
                  disabled={appleConnecting}
                  className="mt-4 rounded-full bg-[var(--wk-text)] px-4 py-2 text-xs font-black text-[var(--wk-bg)] disabled:opacity-50"
                >
                  {appleConnecting
                    ? "Connecting…"
                    : "Connect Apple Music"}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <PlayerPanelSheet
        open={panel === "queue"}
        onClose={() => setPanel("none")}
        mode={mode}
        title="Queue"
        eyebrow={experience.spokenAudio ? "Audio" : "Music"}
      >
        <PlayerQueuePanel
          queue={queue}
          queueIndex={queueIndex}
          queueOrder={queueOrder}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          isPlaying={isPlaying}
          onPlay={playFromQueue}
          onMove={moveQueueItem}
          onRemove={removeQueueItem}
          onClearUpcoming={clearUpcoming}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          showMusicControls={!experience.spokenAudio}
        />
      </PlayerPanelSheet>

      <PlayerPanelSheet
        open={panel === "lyrics"}
        onClose={() => setPanel("none")}
        mode={mode}
        title="Lyrics"
        eyebrow={currentTrack.title}
      >
        <PlayerTimedTextPanel
          variant="lyrics"
          lines={lyrics?.lines ?? []}
          currentTime={currentTime}
          loading={lyricsLoading}
          error={lyricsError}
          emptyMessage="No published Lyrics are available for this Track yet."
          emptyAction={
            lyricsContributionPath ? (
              <button
                type="button"
                onClick={() => goTo(lyricsContributionPath)}
                className="wk-button wk-button-primary wk-button-sm"
              >
                <WkIcon name="Edit3" size={14} />
                Contribute Lyrics
              </button>
            ) : undefined
          }
          onSeek={seek}
        />
      </PlayerPanelSheet>

      <PlayerPanelSheet
        open={panel === "transcript"}
        onClose={() => setPanel("none")}
        mode={mode}
        title="Transcript"
        eyebrow={currentTrack.title}
      >
        <PlayerTimedTextPanel
          variant="transcript"
          lines={transcript?.lines ?? []}
          currentTime={currentTime}
          loading={transcriptLoading}
          error={transcriptError}
          emptyMessage="Transcript is not available for this Audio yet."
          onSeek={seek}
          sourceUrl={experience.transcript?.url}
        />
      </PlayerPanelSheet>

      <PlayerPanelSheet
        open={panel === "chapters"}
        onClose={() => setPanel("none")}
        mode={mode}
        title="Chapters"
        eyebrow={currentTrack.title}
      >
        <div className="space-y-1">
          {experience.chapters.map((chapter, index) => {
            const nextChapter = experience.chapters[index + 1];
            const active =
              chapter.startSeconds <= currentTime &&
              (
                !nextChapter ||
                currentTime < nextChapter.startSeconds
              );

            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => seek(chapter.startSeconds)}
                className={[
                  "flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors",
                  active
                    ? "bg-[var(--wk-brand-soft)]"
                    : "hover:bg-[var(--wk-bg)]",
                ].join(" ")}
              >
                <span className="w-12 shrink-0 font-mono text-[10px] font-bold text-[var(--wk-brand)]">
                  {formatPlayerClock(chapter.startSeconds)}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-black text-[var(--wk-text)]">
                  {chapter.title}
                </span>
                {active ? (
                  <WkIcon
                    name="AudioLines"
                    size={15}
                    className="text-[var(--wk-brand)]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </PlayerPanelSheet>

      <PlayerContextSheet
        open={panel === "more"}
        onClose={() => setPanel("none")}
        mode={mode}
        mediaLabel={experience.spokenAudio ? "Audio" : "Music"}
        title={currentTrack.title}
        creator={experience.creatorLabel}
        artworkUrl={currentTrack.artworkUrl}
        actions={contextActions}
        playlistAction={
          !experience.spokenAudio &&
          experience.capabilities.addToPlaylist ? (
            <AddToPlaylistButton
              trackId={currentTrack.registryTrackId}
              trackTitle={currentTrack.title}
              menuRow
            />
          ) : null
        }
      />

      <ShareSheet
        item={{
          title: currentTrack.title,
          subtitle: experience.creatorLabel,
          description: experience.spokenAudio
            ? `${currentTrack.title} on WAKILISHA`
            : `${currentTrack.title} by ${currentTrack.artist}`,
          imageUrl: currentTrack.artworkUrl ?? null,
          url: shareUrl,
          type: experience.spokenAudio ? "page" : "track",
        }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {!experience.spokenAudio &&
      experience.capabilities.moments ? (
        <TrackMomentDrawer
          open={momentOpen}
          onClose={() => setMomentOpen(false)}
          track={currentTrack}
          currentTime={currentTime}
          duration={duration}
          onSeek={seek}
        />
      ) : null}
    </main>
  );
}
