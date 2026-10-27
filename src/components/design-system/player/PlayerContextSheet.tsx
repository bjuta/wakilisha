import type { ReactNode } from "react";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";
import { PlayerPanelSheet } from "./PlayerPanelSheet";

export interface PlayerContextAction {
  key: string;
  label: string;
  description?: string | null;
  icon: WkIconName;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export function PlayerContextSheet({
  open,
  onClose,
  mode,
  mediaLabel,
  title,
  creator,
  artworkUrl,
  actions,
  playlistAction,
  playbackControls,
}: {
  open: boolean;
  onClose: () => void;
  mode: "desktop" | "mobile";
  mediaLabel: string;
  title: string;
  creator: string;
  artworkUrl?: string | null;
  actions: PlayerContextAction[];
  playlistAction?: ReactNode;
  playbackControls?: ReactNode;
}) {
  return (
    <PlayerPanelSheet
      open={open}
      onClose={onClose}
      mode={mode}
      title="More"
      eyebrow={mediaLabel}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--wk-bg)] p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <WkIcon
              name="Music2"
              size={20}
              className="text-[var(--wk-text-faint)]"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-black text-[var(--wk-text)]">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[12px] font-semibold text-[var(--wk-text-muted)]">
            {creator}
          </div>
        </div>
      </div>

      {playbackControls}
      <div className="mt-4 space-y-1">
        {playlistAction}
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={[
              "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
              action.active
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]",
              action.disabled
                ? "cursor-not-allowed opacity-40"
                : "",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                action.active
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]",
              ].join(" ")}
            >
              <WkIcon name={action.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black">
                {action.label}
              </span>
            </span>
            <WkIcon
              name="ChevronRight"
              size={15}
              className="shrink-0 text-[var(--wk-text-faint)]"
            />
          </button>
        ))}
      </div>
    </PlayerPanelSheet>
  );
}
