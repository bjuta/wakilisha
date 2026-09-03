import {
  useLayoutEffect,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";
import type {
  CSSProperties,
} from "react";
import { MediaPresentationSurface } from "@/components/design-system/media/MediaPresentationSurface";
import "./ProviderPlaybackCanvas.css";

interface ProviderPlaybackCanvasProps {
  backend: string;
  trackTitle:
    string | null;
  isFullPlayerOpen: boolean;
}

interface FrameRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PORTAL_ROOT_ID =
  "wk-provider-playback-root";

function getPortalRoot():
  HTMLDivElement | null {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const existing =
    document.getElementById(
      PORTAL_ROOT_ID,
    );

  if (
    existing instanceof
    HTMLDivElement
  ) {
    return existing;
  }

  const root =
    document.createElement(
      "div",
    );

  root.id =
    PORTAL_ROOT_ID;

  document.body
    .appendChild(
      root,
    );

  return root;
}

export function ProviderPlaybackCanvas({
  backend,
  trackTitle,
  isFullPlayerOpen,
}: ProviderPlaybackCanvasProps) {
  const [portalRoot] =
    useState<
      HTMLDivElement | null
    >(
      getPortalRoot,
    );

  const [fullRect, setFullRect] =
    useState<
      FrameRect | null
    >(
      null,
    );

  const active =
    backend === "youtube" ||
    backend === "soundcloud";

  useLayoutEffect(() => {
    if (
      !active ||
      !isFullPlayerOpen
    ) {
      setFullRect(
        null,
      );
      return;
    }

    let observedHost:
      HTMLElement | null =
      null;

    let settleFrame:
      number | null =
      null;

    let settleCount = 0;

    let resizeObserver:
      ResizeObserver | null =
      null;

    const findHost =
      (): {
        host: HTMLElement;
        rect: DOMRect;
      } | null => {
        const hosts =
          Array.from(
            document
              .querySelectorAll<
                HTMLElement
              >(
                "[data-wk-provider-media-host]",
              ),
          );

        const measured =
          hosts
            .map((host) => ({
              host,
              rect:
                host
                  .getBoundingClientRect(),
            }))
            .filter((entry) => (
              entry.rect.width > 0 &&
              entry.rect.height > 0
            ))
            .sort(
              (
                left,
                right,
              ) => (
                (
                  right.rect.width *
                  right.rect.height
                ) -
                (
                  left.rect.width *
                  left.rect.height
                )
              ),
            );

        return (
          measured[0] ??
          null
        );
      };

    const update =
      () => {
        const match =
          findHost();

        if (!match) {
          if (
            observedHost
          ) {
            resizeObserver
              ?.disconnect();

            observedHost =
              null;
          }

          setFullRect(
            null,
          );

          return;
        }

        if (
          observedHost !==
          match.host
        ) {
          resizeObserver
            ?.disconnect();

          observedHost =
            match.host;

          resizeObserver
            ?.observe(
              match.host,
            );
        }

        const nextRect:
          FrameRect = {
            top:
              match.rect.top,
            left:
              match.rect.left,
            width:
              match.rect.width,
            height:
              match.rect.height,
          };

        setFullRect(
          (current) => {
            if (
              current &&
              Math.abs(
                current.top -
                nextRect.top,
              ) < 0.5 &&
              Math.abs(
                current.left -
                nextRect.left,
              ) < 0.5 &&
              Math.abs(
                current.width -
                nextRect.width,
              ) < 0.5 &&
              Math.abs(
                current.height -
                nextRect.height,
              ) < 0.5
            ) {
              return current;
            }

            return nextRect;
          },
        );
      };

    resizeObserver =
      new ResizeObserver(
        () => {
          update();
        },
      );

    const mutationObserver =
      new MutationObserver(
        () => {
          update();
        },
      );

    mutationObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      },
    );

    const settle =
      () => {
        update();

        settleCount += 1;

        if (
          settleCount < 24
        ) {
          settleFrame =
            window
              .requestAnimationFrame(
                settle,
              );
        } else {
          settleFrame =
            null;
        }
      };

    update();

    settleFrame =
      window
        .requestAnimationFrame(
          settle,
        );

    window.addEventListener(
      "resize",
      update,
    );

    window.addEventListener(
      "scroll",
      update,
      true,
    );

    return () => {
      if (
        settleFrame !==
        null
      ) {
        window
          .cancelAnimationFrame(
            settleFrame,
          );
      }

      resizeObserver
        ?.disconnect();

      mutationObserver
        .disconnect();

      window.removeEventListener(
        "resize",
        update,
      );

      window.removeEventListener(
        "scroll",
        update,
        true,
      );
    };
  }, [
    active,
    backend,
    isFullPlayerOpen,
    trackTitle,
  ]);

  if (!portalRoot) {
    return null;
  }

  const fullStyle:
    CSSProperties | undefined =
    fullRect
      ? {
          top:
            fullRect.top,
          left:
            fullRect.left,
          width:
            fullRect.width,
          height:
            fullRect.height,
        }
      : undefined;

  return createPortal(
    <MediaPresentationSurface
      mode={isFullPlayerOpen ? "inline" : "floating"}
      draggable={active && !isFullPlayerOpen}
      className={[
        "wk-provider-playback-canvas",
        active
          ? "is-active"
          : "",
        isFullPlayerOpen
          ? (
              fullRect
                ? "is-full-player"
                : "is-awaiting-host"
            )
          : "is-collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        fullStyle
      }
      aria-hidden={
        !active
      }
      aria-label={
        active
          ? `${
              backend ===
              "youtube"
                ? "YouTube"
                : "SoundCloud"
            } playback for ${
              trackTitle ??
              "the current track"
            }`
          : undefined
      }
    >
      {({ dragHandleProps, dragging }) => (
        <>
          <div
            className="wk-provider-playback-frame"
          >
            <div
              className="wk-provider-playback-badge"
              hidden={
                backend ===
                "youtube"
              }
            >
              SoundCloud
            </div>

            <div
              className="wk-provider-engine"
              hidden={
                backend !==
                "youtube"
              }
            >
              <div
                id="wk-youtube-player-target"
                className="wk-provider-engine-target"
              />
            </div>

            <div
              className="wk-provider-engine"
              hidden={
                backend !==
                "soundcloud"
              }
            >
              <iframe
                id="wk-soundcloud-player"
                title="SoundCloud playback"
                allow="autoplay"
                className="wk-provider-engine-target"
              />
            </div>
          </div>

          {active && !isFullPlayerOpen ? (
            <button
              type="button"
              {...dragHandleProps}
              className="wk-provider-playback-drag-handle"
              style={dragHandleProps.style}
              aria-label="Move floating media"
              title={dragging ? "Moving media" : "Move floating media"}
            >
              <span aria-hidden="true">⋮⋮</span>
            </button>
          ) : null}
        </>
      )}
    </MediaPresentationSurface>,
    portalRoot,
  );
}
