import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  command: string;
}

export interface SlashCommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: import("@tiptap/core").Editor;
}

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    };

    const upHandler = () => {
      setSelectedIndex((prev) => (prev + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
      setSelectedIndex((prev) => (prev + 1) % props.items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          upHandler();
          return true;
        }
        if (event.key === "ArrowDown") {
          downHandler();
          return true;
        }
        if (event.key === "Enter") {
          enterHandler();
          return true;
        }
        return false;
      },
    }));

    if (!props.items.length) return null;

    return (
      <div className="flex flex-col w-56 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg overflow-hidden py-1">
        <div className="px-3 py-2 border-b border-[var(--wk-border)]/60">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">
            Insert Shortcode
          </span>
        </div>
        {props.items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
              index === selectedIndex
                ? "bg-[var(--wk-brand-soft)]/30 text-[var(--wk-text)]"
                : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-bg-subtle)]"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              index === selectedIndex
                ? "bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]"
                : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
            }`}>
              <i className={`${item.icon} text-[15px]`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold">{item.label}</div>
              <div className="text-[10px] text-[var(--wk-text-faint)] truncate">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandList.displayName = "SlashCommandList";