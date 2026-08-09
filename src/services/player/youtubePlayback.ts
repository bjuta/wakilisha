export interface YouTubePlaybackSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export interface YouTubePlaybackCallbacks {
  onSnapshot?: (
    snapshot: YouTubePlaybackSnapshot,
  ) => void;
  onEnded?: () => void;
  onError?: (
    errorCode: number,
  ) => void;
  onAutoplayBlocked?: () => void;
}

interface YouTubePlayer {
  loadVideoById: (
    videoId:
      | string
      | {
          videoId: string;
          startSeconds?: number;
        },
  ) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (
    seconds: number,
    allowSeekAhead: boolean,
  ) => void;
  setVolume: (
    volume: number,
  ) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

interface YouTubeStateEvent
  extends YouTubePlayerEvent {
  data: number;
}

interface YouTubeErrorEvent
  extends YouTubePlayerEvent {
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    elementId: string,
    options: {
      width: string | number;
      height: string | number;
      videoId: string;
      playerVars: Record<
        string,
        string | number
      >;
      events: {
        onReady: (
          event: YouTubePlayerEvent,
        ) => void;
        onStateChange: (
          event: YouTubeStateEvent,
        ) => void;
        onError: (
          event: YouTubeErrorEvent,
        ) => void;
        onAutoplayBlocked?: () => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const TARGET_ID =
  "wk-youtube-player-target";

let apiPromise:
  Promise<YouTubeNamespace> | null =
  null;

let player:
  YouTubePlayer | null =
  null;

let playerReadyPromise:
  Promise<YouTubePlayer> | null =
  null;

let callbacks:
  YouTubePlaybackCallbacks = {};

let requestSerial = 0;

function clampVolume(
  volume: number,
): number {
  return Math.round(
    Math.max(
      0,
      Math.min(
        1,
        volume,
      ),
    ) * 100,
  );
}

function snapshot():
  YouTubePlaybackSnapshot {
  const currentTime =
    player?.getCurrentTime() ?? 0;

  const duration =
    player?.getDuration() ?? 0;

  return {
    currentTime:
      Number.isFinite(
        currentTime,
      )
        ? currentTime
        : 0,
    duration:
      Number.isFinite(
        duration,
      )
        ? duration
        : 0,
    isPlaying:
      player?.getPlayerState() === 1,
  };
}

function emitSnapshot() {
  callbacks.onSnapshot?.(
    snapshot(),
  );
}

function loadApi():
  Promise<YouTubeNamespace> {
  if (
    window.YT?.Player
  ) {
    return Promise.resolve(
      window.YT,
    );
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise =
    new Promise<YouTubeNamespace>(
      (
        resolve,
        reject,
      ) => {
        const previous =
          window
            .onYouTubeIframeAPIReady;

        window
          .onYouTubeIframeAPIReady =
          () => {
            previous?.();

            if (
              !window.YT?.Player
            ) {
              reject(
                new Error(
                  "YouTube Player API loaded without a Player constructor.",
                ),
              );
              return;
            }

            resolve(
              window.YT,
            );
          };

        const existing =
          document
            .querySelector<
              HTMLScriptElement
            >(
              'script[data-wk-youtube-api="1"]',
            );

        if (existing) {
          return;
        }

        const script =
          document
            .createElement(
              "script",
            );

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        script.dataset
          .wkYoutubeApi =
          "1";

        script.onerror =
          () => {
            apiPromise = null;

            reject(
              new Error(
                "Could not load the YouTube Player API.",
              ),
            );
          };

        document.head
          .appendChild(
            script,
          );
      },
    );

  return apiPromise;
}

async function ensurePlayer(
  videoId: string,
  volume: number,
): Promise<YouTubePlayer> {
  const yt =
    await loadApi();

  if (player) {
    player.setVolume(
      clampVolume(
        volume,
      ),
    );

    return player;
  }

  if (playerReadyPromise) {
    const ready =
      await playerReadyPromise;

    ready.setVolume(
      clampVolume(
        volume,
      ),
    );

    return ready;
  }

  if (
    !document
      .getElementById(
        TARGET_ID,
      )
  ) {
    throw new Error(
      "YouTube provider canvas is not mounted.",
    );
  }

  playerReadyPromise =
    new Promise<YouTubePlayer>(
      (
        resolve,
        reject,
      ) => {
        player =
          new yt.Player(
            TARGET_ID,
            {
              width:
                "356",
              height:
                "200",
              videoId,
              playerVars: {
                autoplay: 0,
                controls: 0,
                playsinline: 1,
                rel: 0,
                enablejsapi: 1,
                origin:
                  window.location
                    .origin,
              },
              events: {
                onReady: (
                  event,
                ) => {
                  event.target
                    .setVolume(
                      clampVolume(
                        volume,
                      ),
                    );

                  resolve(
                    event.target,
                  );
                },
                onStateChange: (
                  event,
                ) => {
                  emitSnapshot();

                  if (
                    event.data ===
                    0
                  ) {
                    callbacks
                      .onEnded?.();
                  }
                },
                onError: (
                  event,
                ) => {
                  callbacks
                    .onError?.(
                      event.data,
                    );

                  reject(
                    new Error(
                      `YouTube playback error ${event.data}.`,
                    ),
                  );
                },
                onAutoplayBlocked: () => {
                  callbacks
                    .onAutoplayBlocked?.();

                  emitSnapshot();
                },
              },
            },
          );
      },
    );

  return playerReadyPromise;
}

export async function playYouTubeTrack(
  videoId: string,
  volume: number,
  nextCallbacks:
    YouTubePlaybackCallbacks = {},
): Promise<void> {
  const requestId =
    ++requestSerial;

  callbacks =
    nextCallbacks;

  const activePlayer =
    await ensurePlayer(
      videoId,
      volume,
    );

  if (
    requestId !==
    requestSerial
  ) {
    return;
  }

  activePlayer.loadVideoById(
    videoId,
  );

  emitSnapshot();
}

export function pauseYouTube():
  void {
  player?.pauseVideo();

  emitSnapshot();
}

export function resumeYouTube():
  void {
  player?.playVideo();

  emitSnapshot();
}

export function stopYouTube():
  void {
  requestSerial += 1;
  callbacks = {};

  player?.stopVideo();
}

export function seekYouTube(
  seconds: number,
): void {
  player?.seekTo(
    Math.max(
      0,
      seconds,
    ),
    true,
  );
}

export function setYouTubeVolume(
  volume: number,
): void {
  player?.setVolume(
    clampVolume(
      volume,
    ),
  );
}

export function getYouTubePlaybackSnapshot():
  YouTubePlaybackSnapshot | null {
  if (!player) {
    return null;
  }

  return snapshot();
}

export function destroyYouTubePlayer():
  void {
  requestSerial += 1;
  callbacks = {};

  player?.destroy();

  player = null;
  playerReadyPromise =
    null;
}
