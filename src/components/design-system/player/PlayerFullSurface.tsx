import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
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

export type PlayerFullMode =
  | "desktop"
  | "mobile";

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

export function PlayerFullSurface({
  mode,
}: {
  mode: PlayerFullMode;
}) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    progress,
    queue,
    queueIndex,
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
    playTrack,
  } = usePlayer();

  const [panel, setPanel] = useState<
    | "none"
    | "chapters"
    | "queue"
    | "lyrics"
    | "transcript"
    | "details"
  >("none");
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
            Nothing playing
          </h1>
          <button
            type="button"
            onClick={closeFullPlayer}
            className="mt-6 rounded-full bg-[var(--wk-text)] px-5 py-2.5 text-sm font-black text-[var(--wk-bg)]"
          >
            Go back
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
  const showContextualUnlock =
    !experience.spokenAudio &&
    experience.availability === "excerpt" &&
    hasAppleCatalog &&
    playbackBackend === "audio" &&
    !appleConnected &&
    !unlockDismissed &&
    pct >= 0.72;

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
    const next =
      rates[
        currentIndex >= 0
          ? (currentIndex + 1) % rates.length
          : 0
      ];

    setPlaybackRate(next);
  };

  const shareUrl =
    canonicalShareUrl(experience.canonicalPath);

  return (
    <main
      data-wk-player-full={mode}
      className="relative min-h-[100dvh] overflow-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-20 blur-[90px] saturate-150"
        style={{
          backgroundImage:
            currentTrack.artworkUrl
              ? `url(${currentTrack.artworkUrl})`
              : undefined,
          backgroundPosition: "center",
          backgroundSize: "cover",
          transform: "scale(1.2)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/45 via-[var(--wk-bg)]/90 to-[var(--wk-bg)]" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pb-8 pt-4 md:px-8 md:pb-10 md:pt-6">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={closeFullPlayer}
            aria-label="Close player"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-surface)]/65 text-[var(--wk-text-muted)] backdrop-blur hover:text-[var(--wk-text)]"
          >
            <WkIcon
              name={isMobile ? "ChevronDown" : "ChevronLeft"}
              size={20}
            />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              {experience.contextLabel ||
                (experience.spokenAudio
                  ? "WAKILISHA Audio"
                  : "Now playing")}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setPanel(
                panel === "details"
                  ? "none"
                  : "details",
              )
            }
            aria-label="Playback details"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-surface)]/65 text-[var(--wk-text-muted)] backdrop-blur hover:text-[var(--wk-text)]"
          >
            <WkIcon name="MoreHorizontal" size={20} />
          </button>
        </header>

        <div
          className={[
            "flex flex-1 items-center justify-center gap-8 py-5",
            isMobile
              ? "flex-col"
              : "flex-col lg:flex-row lg:gap-14",
          ].join(" ")}
        >
          <section className="flex w-full max-w-[520px] flex-col items-center">
            <div className="aspect-square w-full max-w-[420px] overflow-hidden rounded-[26px] bg-[var(--wk-surface-raised)] shadow-2xl md:max-w-[480px]">
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

            <div className="mt-6 w-full max-w-[480px]">
              <h1 className="text-balance text-center text-[24px] font-black leading-tight tracking-[-0.03em] md:text-[30px]">
                {currentTrack.title}
              </h1>
              <p className="mt-2 truncate text-center text-sm font-semibold text-[var(--wk-text-muted)]">
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
                  className="absolute inset-x-0 top-2 h-1 w-full accent-[var(--wk-brand)]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-[var(--wk-text-faint)]">
                <span>{formatPlayerClock(currentTime)}</span>
                <span>{formatPlayerClock(duration)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-5">
              {experience.spokenAudio ? (
                <>
                  <button
                    type="button"
                    onClick={skipBack}
                    aria-label={`Back ${jump} seconds`}
                    className="flex h-12 min-w-12 items-center justify-center rounded-full text-sm font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  >
                    ↺{jump}
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    <WkIcon
                      name={isPlaying ? "Pause" : "Play"}
                      size={28}
                      fill="currentColor"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={skipForward}
                    aria-label={`Forward ${jump} seconds`}
                    className="flex h-12 min-w-12 items-center justify-center rounded-full text-sm font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
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
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wk-text-muted)] disabled:opacity-25"
                  >
                    <WkIcon name="SkipBack" size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] transition-transform hover:scale-[1.03] active:scale-95"
                  >
                    <WkIcon
                      name={isPlaying ? "Pause" : "Play"}
                      size={28}
                      fill="currentColor"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={!canGoNext}
                    aria-label="Next"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wk-text-muted)] disabled:opacity-25"
                  >
                    <WkIcon name="SkipForward" size={22} />
                  </button>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {experience.spokenAudio &&
              experience.capabilities.chapters &&
              experience.chapters.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setPanel(
                      panel === "chapters" ? "none" : "chapters",
                    )
                  }
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-4 py-2 text-xs font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  Chapters
                </button>
              ) : null}

              {experience.spokenAudio &&
              experience.capabilities.transcript &&
              experience.transcript ? (
                <button
                  type="button"
                  onClick={() =>
                    setPanel(
                      panel === "transcript" ? "none" : "transcript",
                    )
                  }
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-4 py-2 text-xs font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  Transcript
                </button>
              ) : null}

              {experience.spokenAudio &&
              experience.capabilities.playbackSpeed ? (
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  aria-label="Playback speed"
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-4 py-2 text-xs font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  {playbackRate}×
                </button>
              ) : null}

              {experience.capabilities.queue &&
              queue.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setPanel(panel === "queue" ? "none" : "queue")
                  }
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-4 py-2 text-xs font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  Queue
                </button>
              ) : null}

              {!experience.spokenAudio &&
              experience.capabilities.lyrics &&
              currentTrack.registryTrackId ? (
                <button
                  type="button"
                  onClick={() =>
                    setPanel(panel === "lyrics" ? "none" : "lyrics")
                  }
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-4 py-2 text-xs font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  Lyrics
                </button>
              ) : null}

              {!experience.spokenAudio &&
              experience.capabilities.save ? (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={savePending}
                  aria-label={saved ? "Saved" : "Save"}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70",
                    saved
                      ? "text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-muted)]",
                  ].join(" ")}
                >
                  <WkIcon
                    name="Heart"
                    size={16}
                    fill={saved ? "currentColor" : "none"}
                  />
                </button>
              ) : null}

              {!experience.spokenAudio &&
              experience.capabilities.addToPlaylist ? (
                <AddToPlaylistButton
                  trackId={currentTrack.registryTrackId}
                  trackTitle={currentTrack.title}
                  compact
                  iconOnly
                />
              ) : null}

              {!experience.spokenAudio &&
              experience.capabilities.moments ? (
                <button
                  type="button"
                  onClick={() => setMomentOpen(true)}
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 px-4 py-2 text-xs font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                >
                  Moments
                </button>
              ) : null}

              {experience.capabilities.share ? (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  aria-label="Share"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 text-[var(--wk-text-muted)]"
                >
                  <WkIcon name="Share2" size={16} />
                </button>
              ) : null}

              {!experience.spokenAudio &&
              experience.capabilities.shuffle ? (
                <button
                  type="button"
                  onClick={toggleShuffle}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70",
                    isShuffle
                      ? "text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-muted)]",
                  ].join(" ")}
                  aria-label="Shuffle"
                >
                  <WkIcon name="Shuffle" size={16} />
                </button>
              ) : null}

              {!experience.spokenAudio &&
              experience.capabilities.repeat ? (
                <button
                  type="button"
                  onClick={toggleRepeat}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70",
                    repeatMode !== "off"
                      ? "text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-muted)]",
                  ].join(" ")}
                  aria-label="Repeat"
                >
                  <WkIcon
                    name={repeatMode === "one" ? "Repeat1" : "Repeat2"}
                    size={16}
                  />
                </button>
              ) : null}
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
              <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 p-4 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)]">
                      Keep listening
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--wk-text-muted)]">
                      Connect Apple Music to continue with the full track here.
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
                    aria-label="Dismiss full playback option"
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

            {panel !== "none" ? (
              <div className="mt-6 max-h-[38vh] overflow-y-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 p-4 backdrop-blur">
                {panel === "chapters" ? (
                  <div>
                    <h2 className="text-sm font-black">Chapters</h2>
                    <div className="mt-2 divide-y divide-[var(--wk-border)]">
                      {experience.chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          type="button"
                          onClick={() => seek(chapter.startSeconds)}
                          className="flex w-full items-center gap-4 py-3 text-left"
                        >
                          <span className="w-12 font-mono text-[10px] font-bold text-[var(--wk-brand)]">
                            {formatPlayerClock(chapter.startSeconds)}
                          </span>
                          <span className="text-sm font-bold">
                            {chapter.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {panel === "queue" ? (
                  <div>
                    <h2 className="text-sm font-black">Queue</h2>
                    <div className="mt-2 space-y-1">
                      {queue.map((item, index) => (
                        <button
                          key={`${item.id}-${index}`}
                          type="button"
                          onClick={() => playFromQueue(index)}
                          className={[
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                            index === queueIndex
                              ? "bg-[var(--wk-brand-soft)]"
                              : "hover:bg-[var(--wk-surface-raised)]",
                          ].join(" ")}
                        >
                          <span className="w-5 text-center text-[10px] font-black text-[var(--wk-text-faint)]">
                            {index === queueIndex ? "●" : index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">
                            {item.title}
                          </span>
                          <span className="max-w-[42%] truncate text-xs text-[var(--wk-text-muted)]">
                            {item.artist}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {panel === "lyrics" ? (
                  <div>
                    <h2 className="text-sm font-black">Lyrics</h2>
                    {lyricsLoading ? (
                      <p className="mt-3 text-sm text-[var(--wk-text-muted)]">
                        Loading published Lyrics…
                      </p>
                    ) : lyricsError ? (
                      <p className="mt-3 text-sm text-red-500">
                        {lyricsError}
                      </p>
                    ) : lyrics ? (
                      <div className="mt-3 space-y-1">
                        {lyrics.lines.map((line) => (
                          <button
                            key={line.id}
                            type="button"
                            disabled={line.startSeconds === null}
                            onClick={() => {
                              if (line.startSeconds !== null) {
                                seek(line.startSeconds);
                              }
                            }}
                            className="flex w-full gap-4 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--wk-surface-raised)] disabled:hover:bg-transparent"
                          >
                            {line.startSeconds !== null ? (
                              <span className="w-12 shrink-0 font-mono text-[10px] font-bold text-[var(--wk-brand)]">
                                {formatPlayerClock(line.startSeconds)}
                              </span>
                            ) : null}
                            <span className="text-sm leading-6">
                              {line.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--wk-text-muted)]">
                        No published Lyrics are available for this Track yet.
                      </p>
                    )}
                  </div>
                ) : null}

                {panel === "transcript" ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black">Transcript</h2>
                      {experience.transcript?.url ? (
                        <a
                          href={experience.transcript.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-[var(--wk-brand)]"
                        >
                          Open source
                        </a>
                      ) : null}
                    </div>

                    {transcriptLoading ? (
                      <p className="mt-3 text-sm text-[var(--wk-text-muted)]">
                        Loading Transcript…
                      </p>
                    ) : transcriptError ? (
                      <p className="mt-3 text-sm text-[var(--wk-text-muted)]">
                        {transcriptError}
                      </p>
                    ) : transcript ? (
                      <div className="mt-3 space-y-1">
                        {transcript.lines.map((line) => (
                          <button
                            key={line.id}
                            type="button"
                            disabled={line.startSeconds === null}
                            onClick={() => {
                              if (line.startSeconds !== null) {
                                seek(line.startSeconds);
                              }
                            }}
                            className="flex w-full gap-4 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--wk-surface-raised)] disabled:hover:bg-transparent"
                          >
                            {line.startSeconds !== null ? (
                              <span className="w-12 shrink-0 font-mono text-[10px] font-bold text-[var(--wk-brand)]">
                                {formatPlayerClock(line.startSeconds)}
                              </span>
                            ) : null}
                            <span className="text-sm leading-6">
                              {line.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {panel === "details" ? (
                  <div>
                    <h2 className="text-sm font-black">Playback</h2>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
                      <dt className="text-[var(--wk-text-faint)]">Media</dt>
                      <dd className="font-bold">
                        {experience.spokenAudio ? "Audio" : "Music"}
                      </dd>
                      <dt className="text-[var(--wk-text-faint)]">Available</dt>
                      <dd className="font-bold capitalize">
                        {experience.availability}
                      </dd>
                      <dt className="text-[var(--wk-text-faint)]">Time</dt>
                      <dd className="font-bold tabular-nums">
                        {formatPlayerClock(currentTime)} / {formatPlayerClock(duration)}
                      </dd>
                      {experience.spokenAudio ? (
                        <>
                          <dt className="text-[var(--wk-text-faint)]">Speed</dt>
                          <dd className="font-bold">{playbackRate}×</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>

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
