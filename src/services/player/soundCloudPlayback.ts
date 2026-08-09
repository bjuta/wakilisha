export interface SoundCloudPlaybackSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export interface SoundCloudPlaybackCallbacks {
  onSnapshot?: (
    snapshot:
      SoundCloudPlaybackSnapshot,
  ) => void;
  onEnded?: () => void;
  onError?: (
    error: unknown,
  ) => void;
}

interface SoundCloudProgress {
  currentPosition?: number;
}

interface SoundCloudWidget {
  bind: (
    eventName: string,
    callback: (
      value?: unknown,
    ) => void,
  ) => void;
  unbind: (
    eventName?: string,
  ) => void;
  play: () => void;
  pause: () => void;
  seekTo: (
    milliseconds: number,
  ) => void;
  setVolume: (
    volume: number,
  ) => void;
  getDuration: (
    callback: (
      duration: number,
    ) => void,
  ) => void;
  getPosition: (
    callback: (
      position: number,
    ) => void,
  ) => void;
  isPaused: (
    callback: (
      paused: boolean,
    ) => void,
  ) => void;
}

interface SoundCloudWidgetFactory {
  (
    iframe:
      HTMLIFrameElement,
  ): SoundCloudWidget;

  Events: {
    READY: string;
    PLAY: string;
    PAUSE: string;
    FINISH: string;
    PLAY_PROGRESS: string;
    ERROR: string;
  };
}

interface SoundCloudNamespace {
  Widget:
    SoundCloudWidgetFactory;
}

declare global {
  interface Window {
    SC?: SoundCloudNamespace;
  }
}

const IFRAME_ID =
  "wk-soundcloud-player";

let apiPromise:
  Promise<SoundCloudNamespace>
  | null =
  null;

let widget:
  SoundCloudWidget | null =
  null;

let widgetReady = false;
let requestSerial = 0;

let snapshot:
  SoundCloudPlaybackSnapshot = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  };

let callbacks:
  SoundCloudPlaybackCallbacks = {};

function emitSnapshot() {
  callbacks.onSnapshot?.({
    ...snapshot,
  });
}

function activeRequest(
  requestId: number,
  candidate:
    SoundCloudWidget,
): boolean {
  return (
    requestId ===
      requestSerial &&
    widget ===
      candidate
  );
}

function loadApi():
  Promise<SoundCloudNamespace> {
  if (
    window.SC?.Widget
  ) {
    return Promise.resolve(
      window.SC,
    );
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise =
    new Promise<SoundCloudNamespace>(
      (
        resolve,
        reject,
      ) => {
        const finish =
          () => {
            if (
              !window.SC
                ?.Widget
            ) {
              reject(
                new Error(
                  "SoundCloud Widget API loaded without a Widget constructor.",
                ),
              );
              return;
            }

            resolve(
              window.SC,
            );
          };

        const existing =
          document
            .querySelector<
              HTMLScriptElement
            >(
              'script[data-wk-soundcloud-api="1"]',
            );

        if (existing) {
          if (
            window.SC?.Widget
          ) {
            finish();
          } else {
            existing
              .addEventListener(
                "load",
                finish,
                {
                  once: true,
                },
              );
          }

          return;
        }

        const script =
          document
            .createElement(
              "script",
            );

        script.src =
          "https://w.soundcloud.com/player/api.js";

        script.async = true;

        script.dataset
          .wkSoundcloudApi =
          "1";

        script.onload =
          finish;

        script.onerror =
          () => {
            apiPromise = null;

            reject(
              new Error(
                "Could not load the SoundCloud Widget API.",
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

export function buildSoundCloudWidgetUrl(
  providerUrl: string,
): string {
  const url =
    new URL(
      "https://w.soundcloud.com/player/",
    );

  url.searchParams.set(
    "url",
    providerUrl,
  );

  url.searchParams.set(
    "auto_play",
    "true",
  );

  url.searchParams.set(
    "hide_related",
    "true",
  );

  url.searchParams.set(
    "show_comments",
    "false",
  );

  url.searchParams.set(
    "show_reposts",
    "false",
  );

  url.searchParams.set(
    "sharing",
    "false",
  );

  url.searchParams.set(
    "download",
    "false",
  );

  url.searchParams.set(
    "visual",
    "true",
  );

  return url.toString();
}

export async function playSoundCloudTrack(
  providerUrl: string,
  volume: number,
  nextCallbacks:
    SoundCloudPlaybackCallbacks = {},
): Promise<void> {
  const sc =
    await loadApi();

  const iframe =
    document.getElementById(
      IFRAME_ID,
    );

  if (
    !(
      iframe instanceof
      HTMLIFrameElement
    )
  ) {
    throw new Error(
      "SoundCloud provider canvas is not mounted.",
    );
  }

  requestSerial += 1;

  const requestId =
    requestSerial;

  widget?.pause();
  widget?.unbind();

  widgetReady = false;

  snapshot = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  };

  callbacks =
    nextCallbacks;

  iframe.src =
    buildSoundCloudWidgetUrl(
      providerUrl,
    );

  const candidate =
    sc.Widget(
      iframe,
    );

  widget =
    candidate;

  const events =
    sc.Widget.Events;

  candidate.bind(
    events.READY,
    () => {
      if (
        !activeRequest(
          requestId,
          candidate,
        )
      ) {
        return;
      }

      widgetReady = true;

      candidate.setVolume(
        Math.round(
          Math.max(
            0,
            Math.min(
              1,
              volume,
            ),
          ) * 100,
        ),
      );

      candidate.getDuration(
        (
          durationMs,
        ) => {
          if (
            !activeRequest(
              requestId,
              candidate,
            )
          ) {
            return;
          }

          snapshot.duration =
            Number.isFinite(
              durationMs,
            )
              ? durationMs /
                1000
              : 0;

          emitSnapshot();

          candidate.play();
        },
      );
    },
  );

  candidate.bind(
    events.PLAY,
    () => {
      if (
        !activeRequest(
          requestId,
          candidate,
        )
      ) {
        return;
      }

      snapshot.isPlaying =
        true;

      emitSnapshot();
    },
  );

  candidate.bind(
    events.PAUSE,
    () => {
      if (
        !activeRequest(
          requestId,
          candidate,
        )
      ) {
        return;
      }

      snapshot.isPlaying =
        false;

      emitSnapshot();
    },
  );

  candidate.bind(
    events.PLAY_PROGRESS,
    (
      value,
    ) => {
      if (
        !activeRequest(
          requestId,
          candidate,
        )
      ) {
        return;
      }

      const progress =
        value as
          SoundCloudProgress
          | undefined;

      const position =
        progress
          ?.currentPosition;

      if (
        typeof position ===
          "number" &&
        Number.isFinite(
          position,
        )
      ) {
        snapshot.currentTime =
          position /
          1000;
      }

      emitSnapshot();
    },
  );

  candidate.bind(
    events.FINISH,
    () => {
      if (
        !activeRequest(
          requestId,
          candidate,
        )
      ) {
        return;
      }

      snapshot.isPlaying =
        false;

      snapshot.currentTime =
        snapshot.duration;

      emitSnapshot();

      callbacks.onEnded?.();
    },
  );

  candidate.bind(
    events.ERROR,
    (
      error,
    ) => {
      if (
        !activeRequest(
          requestId,
          candidate,
        )
      ) {
        return;
      }

      snapshot.isPlaying =
        false;

      emitSnapshot();

      callbacks.onError?.(
        error,
      );
    },
  );
}

export function pauseSoundCloud():
  void {
  widget?.pause();

  snapshot.isPlaying =
    false;

  emitSnapshot();
}

export function resumeSoundCloud():
  void {
  widget?.play();
}

export function stopSoundCloud():
  void {
  requestSerial += 1;
  callbacks = {};

  widget?.pause();
  widget?.unbind();

  widget = null;

  snapshot = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  };

  const iframe =
    document.getElementById(
      IFRAME_ID,
    );

  if (
    iframe instanceof
    HTMLIFrameElement
  ) {
    iframe.src =
      "about:blank";
  }
}

export function seekSoundCloud(
  seconds: number,
): void {
  widget?.seekTo(
    Math.max(
      0,
      seconds,
    ) * 1000,
  );

  snapshot.currentTime =
    Math.max(
      0,
      seconds,
    );

  emitSnapshot();
}

export function setSoundCloudVolume(
  volume: number,
): void {
  widget?.setVolume(
    Math.round(
      Math.max(
        0,
        Math.min(
          1,
          volume,
        ),
      ) * 100,
    ),
  );
}

export async function readSoundCloudPlaybackSnapshot():
  Promise<SoundCloudPlaybackSnapshot | null> {
  const activeWidget =
    widget;

  if (
    !activeWidget ||
    !widgetReady
  ) {
    return null;
  }

  const duration =
    await new Promise<number>(
      (resolve) => {
        activeWidget
          .getDuration(
            (value) => {
              resolve(
                Number.isFinite(
                  value,
                )
                  ? value
                  : 0,
              );
            },
          );
      },
    );

  const position =
    await new Promise<number>(
      (resolve) => {
        activeWidget
          .getPosition(
            (value) => {
              resolve(
                Number.isFinite(
                  value,
                )
                  ? value
                  : 0,
              );
            },
          );
      },
    );

  const paused =
    await new Promise<boolean>(
      (resolve) => {
        activeWidget
          .isPaused(
            (value) => {
              resolve(
                value === true,
              );
            },
          );
      },
    );

  if (
    widget !==
    activeWidget
  ) {
    return null;
  }

  snapshot = {
    currentTime:
      position / 1000,
    duration:
      duration / 1000,
    isPlaying:
      !paused,
  };

  return {
    ...snapshot,
  };
}

export function getSoundCloudPlaybackSnapshot():
  SoundCloudPlaybackSnapshot | null {
  if (!widget) {
    return null;
  }

  return {
    ...snapshot,
  };
}
