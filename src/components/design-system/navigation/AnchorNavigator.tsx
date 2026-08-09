import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Portal,
} from "@/components/base/Portal";
import {
  WkIcon,
} from "@/components/design-system/Icon";

export interface AnchorNavigatorItem {
  id: string;
  label: string;
  meta?: string | null;
  prefix?: string | null;
  searchText?: string | null;
}

interface AnchorNavigatorProps {
  label: string;
  items: AnchorNavigatorItem[];
  onNavigate: (
    id: string,
  ) => void;
}

interface FloatingPosition {
  top: number;
  left: number;
  width: number;
}

function normalized(
  value: string,
): string {
  return value
    .toLocaleLowerCase()
    .trim();
}

export function AnchorNavigator({
  label,
  items,
  onNavigate,
}: AnchorNavigatorProps) {
  const triggerRef =
    useRef<HTMLButtonElement>(
      null,
    );

  const searchRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    open,
    setOpen,
  ] = useState(
    false,
  );

  const [
    query,
    setQuery,
  ] = useState(
    "",
  );

  const [
    activeIndex,
    setActiveIndex,
  ] = useState(
    0,
  );

  const [
    position,
    setPosition,
  ] = useState<FloatingPosition | null>(
    null,
  );

  const filteredItems =
    useMemo(
      () => {
        const needle =
          normalized(
            query,
          );

        if (
          !needle
        ) {
          return items;
        }

        return items.filter(
          (
            item,
          ) => {
            const haystack =
              normalized(
                [
                  item.prefix,
                  item.label,
                  item.meta,
                  item.searchText,
                ]
                  .filter(
                    Boolean,
                  )
                  .join(
                    " ",
                  ),
              );

            return haystack.includes(
              needle,
            );
          },
        );
      },
      [
        items,
        query,
      ],
    );

  const updatePosition =
    useCallback(
      () => {
        const trigger =
          triggerRef.current;

        if (
          !trigger
        ) {
          return;
        }

        const rect =
          trigger.getBoundingClientRect();

        const viewportWidth =
          window.innerWidth;

        const width =
          Math.min(
            460,
            Math.max(
              280,
              viewportWidth -
                24,
            ),
          );

        const left =
          Math.min(
            Math.max(
              12,
              rect.right -
                width,
            ),
            Math.max(
              12,
              viewportWidth -
                width -
                12,
            ),
          );

        setPosition({
          top:
            rect.bottom +
            8,
          left,
          width,
        });
      },
      [],
    );

  useEffect(
    () => {
      if (
        !open
      ) {
        return;
      }

      updatePosition();

      const frame =
        window.requestAnimationFrame(
          () => {
            searchRef.current?.focus();
          },
        );

      const closeOnEscape =
        (
          event: KeyboardEvent,
        ) => {
          if (
            event.key ===
            "Escape"
          ) {
            setOpen(
              false,
            );

            triggerRef.current?.focus();
          }
        };

      window.addEventListener(
        "keydown",
        closeOnEscape,
      );

      window.addEventListener(
        "resize",
        updatePosition,
      );

      window.addEventListener(
        "scroll",
        updatePosition,
        true,
      );

      return () => {
        window.cancelAnimationFrame(
          frame,
        );

        window.removeEventListener(
          "keydown",
          closeOnEscape,
        );

        window.removeEventListener(
          "resize",
          updatePosition,
        );

        window.removeEventListener(
          "scroll",
          updatePosition,
          true,
        );
      };
    },
    [
      open,
      updatePosition,
    ],
  );

  useEffect(
    () => {
      setActiveIndex(
        0,
      );
    },
    [
      query,
    ],
  );

  const choose =
    (
      item:
        AnchorNavigatorItem,
    ) => {
      onNavigate(
        item.id,
      );

      setOpen(
        false,
      );

      setQuery(
        "",
      );

      triggerRef.current?.focus();
    };

  const onSearchKeyDown =
    (
      event:
        React.KeyboardEvent<HTMLInputElement>,
    ) => {
      if (
        filteredItems.length ===
        0
      ) {
        return;
      }

      if (
        event.key ===
        "ArrowDown"
      ) {
        event.preventDefault();

        setActiveIndex(
          (
            current,
          ) =>
            Math.min(
              current +
                1,
              filteredItems.length -
                1,
            ),
        );

        return;
      }

      if (
        event.key ===
        "ArrowUp"
      ) {
        event.preventDefault();

        setActiveIndex(
          (
            current,
          ) =>
            Math.max(
              current -
                1,
              0,
            ),
        );

        return;
      }

      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        const active =
          filteredItems[
            activeIndex
          ];

        if (
          active
        ) {
          choose(
            active,
          );
        }
      }
    };

  return (
    <>
      <button
        ref={
          triggerRef
        }
        type="button"
        aria-haspopup="dialog"
        aria-expanded={
          open
        }
        onClick={
          () => {
            setOpen(
              (
                current,
              ) =>
                !current,
            );
          }
        }
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 text-[12px] font-extrabold text-[var(--wk-text)] shadow-sm transition hover:border-[var(--wk-brand)]/35 hover:text-[var(--wk-brand)]"
      >
        <WkIcon
          name="ListFilter"
          size={
            14
          }
        />

        <span>
          {
            label
          }
        </span>

        <WkIcon
          name="ChevronDown"
          size={
            13
          }
          className={
            open
              ? "rotate-180 transition-transform"
              : "transition-transform"
          }
        />
      </button>

      {
        open &&
        position
          ? (
              <Portal>
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="fixed inset-0 z-[119] cursor-default bg-transparent"
                  onClick={
                    () =>
                      setOpen(
                        false,
                      )
                  }
                />

                <div
                  role="dialog"
                  aria-label={
                    label
                  }
                  className="fixed z-[120] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
                  style={{
                    top:
                      position.top,
                    left:
                      position.left,
                    width:
                      position.width,
                    maxHeight:
                      "min(68vh, 560px)",
                  }}
                >
                  <div className="border-b border-[var(--wk-border)] p-3">
                    <div className="flex items-center gap-2 rounded-xl bg-[var(--wk-bg)] px-3">
                      <WkIcon
                        name="Search"
                        size={
                          15
                        }
                        className="shrink-0 text-[var(--wk-text-faint)]"
                      />

                      <input
                        ref={
                          searchRef
                        }
                        value={
                          query
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setQuery(
                              event.currentTarget.value,
                            )
                        }
                        onKeyDown={
                          onSearchKeyDown
                        }
                        placeholder="Find by title, artist, or number"
                        className="h-11 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                      />
                    </div>
                  </div>

                  <div className="max-h-[min(55vh,460px)] overflow-y-auto p-2">
                    {
                      filteredItems.length >
                      0
                        ? filteredItems.map(
                            (
                              item,
                              index,
                            ) => (
                              <button
                                key={
                                  item.id
                                }
                                type="button"
                                onMouseEnter={
                                  () =>
                                    setActiveIndex(
                                      index,
                                    )
                                }
                                onClick={
                                  () =>
                                    choose(
                                      item,
                                    )
                                }
                                className={[
                                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                  index ===
                                  activeIndex
                                    ? "bg-[var(--wk-brand-soft)]"
                                    : "hover:bg-[var(--wk-bg)]",
                                ].join(
                                  " ",
                                )}
                              >
                                {
                                  item.prefix
                                    ? (
                                        <span className="w-7 shrink-0 text-right text-[11px] font-extrabold tabular-nums text-[var(--wk-text-faint)]">
                                          {
                                            item.prefix
                                          }
                                        </span>
                                      )
                                    : null
                                }

                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-extrabold text-[var(--wk-text)]">
                                    {
                                      item.label
                                    }
                                  </span>

                                  {
                                    item.meta
                                      ? (
                                          <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
                                            {
                                              item.meta
                                            }
                                          </span>
                                        )
                                      : null
                                  }
                                </span>

                                <WkIcon
                                  name="ArrowDownRight"
                                  size={
                                    13
                                  }
                                  className="shrink-0 text-[var(--wk-text-faint)]"
                                />
                              </button>
                            ),
                          )
                        : (
                            <div className="px-4 py-8 text-center">
                              <div className="text-[13px] font-extrabold text-[var(--wk-text)]">
                                No match
                              </div>

                              <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                                Try a title, artist, or track number.
                              </div>
                            </div>
                          )
                    }
                  </div>
                </div>
              </Portal>
            )
          : null
      }
    </>
  );
}
