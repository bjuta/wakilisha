import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Portal } from "@/components/base/Portal";
import {
  EDITOR_COMMAND_META,
  EDITOR_MENU_REGISTRY,
  type EditorialCommandId,
  type EditorialMenuId,
} from "./editorCommandRegistry";

export interface ResolvedEditorialCommand {
  onSelect: () => void;
  label?: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

interface Props {
  resolveCommand: (
    command: EditorialCommandId,
  ) => ResolvedEditorialCommand;
}

interface MenuPosition {
  left: number;
  top: number;
  maxHeight: number;
}

const MENU_WIDTH = 256;
const VIEWPORT_MARGIN = 8;

export function EditorialMenuBar({
  resolveCommand,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<
    Partial<Record<EditorialMenuId, HTMLButtonElement>>
  >({});

  const [openMenu, setOpenMenu] =
    useState<EditorialMenuId | null>(null);
  const [menuPosition, setMenuPosition] =
    useState<MenuPosition | null>(null);

  const openMenuDefinition = openMenu
    ? EDITOR_MENU_REGISTRY.find(
        (menu) => menu.id === openMenu,
      ) ?? null
    : null;

  const visibleOpenItems = openMenuDefinition
    ? openMenuDefinition.items
        .map((placement) => ({
          placement,
          resolved: resolveCommand(
            placement.command,
          ),
          meta:
            EDITOR_COMMAND_META[
              placement.command
            ],
        }))
        .filter(
          ({ resolved }) => !resolved.hidden,
        )
    : [];

  useLayoutEffect(() => {
    if (!openMenu) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      const button = buttonRefs.current[openMenu];

      if (!button) return;

      const rect = button.getBoundingClientRect();
      const maximumLeft =
        window.innerWidth -
        MENU_WIDTH -
        VIEWPORT_MARGIN;

      const left = Math.min(
        Math.max(
          rect.left,
          VIEWPORT_MARGIN,
        ),
        Math.max(
          VIEWPORT_MARGIN,
          maximumLeft,
        ),
      );

      const top = rect.bottom + 4;
      const maxHeight = Math.max(
        180,
        window.innerHeight -
          top -
          VIEWPORT_MARGIN,
      );

      setMenuPosition({
        left,
        top,
        maxHeight,
      });
    }

    updateMenuPosition();

    window.addEventListener(
      "resize",
      updateMenuPosition,
    );
    window.addEventListener(
      "scroll",
      updateMenuPosition,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateMenuPosition,
      );
      window.removeEventListener(
        "scroll",
        updateMenuPosition,
        true,
      );
    };
  }, [openMenu]);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ) {
      const target = event.target as Node;

      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpenMenu(null);
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );
    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        role="menubar"
        aria-label="Article editor commands"
        className="flex min-w-max items-center gap-0.5 px-3 py-1.5"
      >
        {EDITOR_MENU_REGISTRY.map((menu) => {
          const hasVisibleCommands =
            menu.items.some(
              (placement) =>
                !resolveCommand(
                  placement.command,
                ).hidden,
            );

          if (!hasVisibleCommands) {
            return null;
          }

          const open = openMenu === menu.id;

          return (
            <div
              key={menu.id}
              className="relative"
              onMouseEnter={() => {
                if (openMenu) {
                  setOpenMenu(menu.id);
                }
              }}
            >
              <button
                ref={(node) => {
                  if (node) {
                    buttonRefs.current[
                      menu.id
                    ] = node;
                  } else {
                    delete buttonRefs.current[
                      menu.id
                    ];
                  }
                }}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() =>
                  setOpenMenu((current) =>
                    current === menu.id
                      ? null
                      : menu.id,
                  )
                }
                className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  open
                    ? "bg-wk-surface-raised text-wk-text"
                    : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                }`}
              >
                {menu.label}
              </button>
            </div>
          );
        })}
      </div>

      {openMenuDefinition &&
      menuPosition ? (
        <Portal>
          <div
            ref={panelRef}
            role="menu"
            aria-label={`${openMenuDefinition.label} commands`}
            className="fixed z-[140] w-64 overflow-y-auto rounded-xl border border-wk-border bg-wk-surface p-1.5 shadow-2xl"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              maxHeight:
                menuPosition.maxHeight,
            }}
          >
            {visibleOpenItems.map(
              ({
                placement,
                resolved,
                meta,
              }) => (
                <div key={placement.key}>
                  {placement.dividerBefore ? (
                    <div className="my-1 border-t border-wk-border" />
                  ) : null}

                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      resolved.disabled
                    }
                    onClick={() => {
                      if (resolved.disabled) {
                        return;
                      }

                      setOpenMenu(null);
                      resolved.onSelect();
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12px] transition-colors ${
                      resolved.disabled
                        ? "cursor-not-allowed text-wk-text-faint opacity-50"
                        : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex w-3 shrink-0 justify-center text-[11px] font-black text-wk-brand"
                    >
                      {resolved.active
                        ? "✓"
                        : ""}
                    </span>

                    <span className="min-w-0 flex-1">
                      {resolved.label ??
                        meta.label}
                    </span>

                    {resolved.shortcut ??
                    meta.shortcut ? (
                      <span className="shrink-0 font-mono text-[10px] text-wk-text-faint">
                        {resolved.shortcut ??
                          meta.shortcut}
                      </span>
                    ) : null}
                  </button>
                </div>
              ),
            )}
          </div>
        </Portal>
      ) : null}
    </>
  );
}
