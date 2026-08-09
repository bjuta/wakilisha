import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  createPortal,
} from "react-dom";

import type {
  ReactionType,
} from "@/services/community";

const FullEmojiPicker =
  lazy(
    () =>
      import(
        "emoji-picker-react"
      ),
  );

const QUICK_REACTIONS = [
  "❤️",
  "😂",
  "🔥",
  "👏",
  "👍",
  "😮",
  "😢",
  "👀",
] as const;

const LEGACY_REACTION_GLYPHS:
  Record<string, string> = {
    signal: "⚡",
    memory: "🧠",
    context: "💡",
    fire: "🔥",
    agree: "👍",
  };

export function getReactionGlyph(
  reaction: ReactionType,
): string {
  return (
    LEGACY_REACTION_GLYPHS[
      reaction
    ] ?? reaction
  );
}

export function resolveReactionSelection(
  emoji: string,
  activeReactions: ReactionType[],
): ReactionType {
  const matchingLegacy =
    Object.entries(
      LEGACY_REACTION_GLYPHS,
    )
      .find(
        ([
          legacyType,
          glyph,
        ]) =>
          glyph === emoji
          && activeReactions.includes(
            legacyType,
          ),
      );

  return (
    matchingLegacy?.[0]
    ?? emoji
  );
}

interface PickerPosition {
  top: number;
  left: number;
  ready: boolean;
}

interface CommunityReactionPickerProps {
  activeReactions: ReactionType[];
  anchorRef:
    RefObject<HTMLElement | null>;
  onSelect: (
    reaction: ReactionType,
  ) => void;
  onClose: () => void;
}

export function CommunityReactionPicker({
  activeReactions,
  anchorRef,
  onSelect,
  onClose,
}: CommunityReactionPickerProps) {
  const [
    showFullPicker,
    setShowFullPicker,
  ] = useState(false);

  const [
    position,
    setPosition,
  ] = useState<PickerPosition>({
    top: 0,
    left: 0,
    ready: false,
  });

  const panelRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const activeGlyphs =
    useMemo(
      () =>
        new Set(
          activeReactions.map(
            getReactionGlyph,
          ),
        ),
      [
        activeReactions,
      ],
    );

  const selectEmoji = (
    emoji: string,
  ) => {
    onSelect(
      resolveReactionSelection(
        emoji,
        activeReactions,
      ),
    );
  };

  useEffect(
    () => {
      if (
        typeof document
        === "undefined"
      ) {
        return;
      }

      const handlePointerDown = (
        event: PointerEvent,
      ) => {
        const target =
          event.target;

        if (
          !(target instanceof Node)
        ) {
          return;
        }

        const panel =
          panelRef.current;

        const anchor =
          anchorRef.current;

        if (
          panel?.contains(target)
          || anchor?.contains(target)
        ) {
          return;
        }

        setShowFullPicker(false);
        onClose();
      };

      const handleKeyDown = (
        event: KeyboardEvent,
      ) => {
        if (
          event.key !== "Escape"
        ) {
          return;
        }

        setShowFullPicker(false);
        onClose();
      };

      document.addEventListener(
        "pointerdown",
        handlePointerDown,
      );

      document.addEventListener(
        "keydown",
        handleKeyDown,
      );

      return () => {
        document.removeEventListener(
          "pointerdown",
          handlePointerDown,
        );

        document.removeEventListener(
          "keydown",
          handleKeyDown,
        );
      };
    },
    [
      anchorRef,
      onClose,
    ],
  );

  useLayoutEffect(
    () => {
      const anchor =
        anchorRef.current;

      const panel =
        panelRef.current;

      if (
        !anchor
        || !panel
      ) {
        return;
      }

      const positionPanel = () => {
        const currentAnchor =
          anchorRef.current;

        const currentPanel =
          panelRef.current;

        if (
          !currentAnchor
          || !currentPanel
        ) {
          return;
        }

        const anchorRect =
          currentAnchor
            .getBoundingClientRect();

        const panelRect =
          currentPanel
            .getBoundingClientRect();

        const viewportPadding = 12;
        const gap = 8;

        const belowTop =
          anchorRect.bottom
          + gap;

        const aboveTop =
          anchorRect.top
          - panelRect.height
          - gap;

        const hasRoomBelow =
          belowTop
          + panelRect.height
          <= window.innerHeight
          - viewportPadding;

        let top =
          hasRoomBelow
            ? belowTop
            : aboveTop;

        top = Math.max(
          viewportPadding,
          Math.min(
            top,
            window.innerHeight
            - panelRect.height
            - viewportPadding,
          ),
        );

        let left =
          anchorRect.left;

        left = Math.max(
          viewportPadding,
          Math.min(
            left,
            window.innerWidth
            - panelRect.width
            - viewportPadding,
          ),
        );

        setPosition({
          top,
          left,
          ready: true,
        });
      };

      positionPanel();

      const animationFrame =
        window.requestAnimationFrame(
          positionPanel,
        );

      const resizeObserver =
        new ResizeObserver(
          positionPanel,
        );

      resizeObserver.observe(
        panel,
      );

      window.addEventListener(
        "resize",
        positionPanel,
      );

      window.addEventListener(
        "scroll",
        positionPanel,
        true,
      );

      return () => {
        window.cancelAnimationFrame(
          animationFrame,
        );

        resizeObserver.disconnect();

        window.removeEventListener(
          "resize",
          positionPanel,
        );

        window.removeEventListener(
          "scroll",
          positionPanel,
          true,
        );
      };
    },
    [
      anchorRef,
      showFullPicker,
    ],
  );

  if (
    typeof document
    === "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[200] max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-[var(--wk-border-2)] bg-[var(--wk-surface)] shadow-xl ${
        showFullPicker
          ? "w-[360px] max-w-[calc(100vw-1.5rem)]"
          : "w-max max-w-[calc(100vw-1.5rem)]"
      }`}
      style={{
        top: position.top,
        left: position.left,
        visibility:
          position.ready
            ? "visible"
            : "hidden",
      }}
      role="dialog"
      aria-label="Choose a reaction"
    >
      <div className="flex items-center gap-0.5 p-1.5">
        {QUICK_REACTIONS.map(
          (emoji) => {
            const isActive =
              activeGlyphs.has(
                emoji,
              );

            return (
              <button
                key={emoji}
                type="button"
                onClick={() =>
                  selectEmoji(
                    emoji,
                  )
                }
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[22px] leading-none transition-colors ${
                  isActive
                    ? "bg-[var(--wk-brand-soft)] ring-1 ring-inset ring-[var(--wk-brand)]"
                    : "hover:bg-[var(--wk-surface-raised)]"
                }`}
                aria-label={`React with ${emoji}`}
                aria-pressed={
                  isActive
                }
                title={emoji}
              >
                {emoji}
              </button>
            );
          },
        )}

        <button
          type="button"
          onClick={() =>
            setShowFullPicker(
              (current) =>
                !current,
            )
          }
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] ${
            showFullPicker
              ? "bg-[var(--wk-surface-raised)] text-[var(--wk-text)]"
              : ""
          }`}
          aria-label="More reactions"
          aria-expanded={
            showFullPicker
          }
          title="More reactions"
        >
          <i className="ri-add-line text-[18px]" />
        </button>
      </div>

      {showFullPicker && (
        <div className="border-t border-[var(--wk-border)] p-1">
          <Suspense
            fallback={
              <div className="flex h-[340px] items-center justify-center text-[12px] text-[var(--wk-text-muted)]">
                Loading emoji
              </div>
            }
          >
            <FullEmojiPicker
              onEmojiClick={(
                emojiData,
              ) =>
                selectEmoji(
                  emojiData.emoji,
                )
              }
              width="100%"
              height={340}
            />
          </Suspense>
        </div>
      )}
    </div>,
    document.body,
  );
}
