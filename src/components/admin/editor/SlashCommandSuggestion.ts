import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SlashCommandList, type SlashCommandListRef } from "./SlashCommandList";

interface SuggestionItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  command: "release" | "artist" | "track";
}

const COMMANDS: SuggestionItem[] = [
  {
    id: "release",
    label: "Release",
    icon: "ri-album-line",
    description: "Embed a release from the registry",
    command: "release",
  },
  {
    id: "artist",
    label: "Artist",
    icon: "ri-user-star-line",
    description: "Embed an artist mini-profile",
    command: "artist",
  },
  {
    id: "track",
    label: "Track",
    icon: "ri-music-line",
    description: "Embed a track with play button",
    command: "track",
  },
];

/**
 * TipTap suggestion config for slash commands (/release, /artist, /track).
 */
const SlashCommandConfig = {
  char: "/",
  items: ({ query }: { query: string }): SuggestionItem[] => {
    if (!query) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.id.includes(q) || cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)
    );
  },

  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let wrapper: HTMLDivElement | null = null;

    return {
      onStart: (props: { editor: import("@tiptap/core").Editor; clientRect: () => DOMRect }) => {
        wrapper = document.createElement("div");
        wrapper.className = "fixed z-[70]";
        document.body.appendChild(wrapper);

        component = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        });

        wrapper.appendChild(component.element);

        const rect = props.clientRect();
        if (rect) {
          wrapper.style.left = `${rect.left}px`;
          wrapper.style.top = `${rect.bottom + 6}px`;
        }
      },

      onUpdate(props: { editor: import("@tiptap/core").Editor; clientRect: () => DOMRect }) {
        component?.updateProps(props);

        if (wrapper) {
          const rect = props.clientRect();
          if (rect) {
            wrapper.style.left = `${rect.left}px`;
            wrapper.style.top = `${rect.bottom + 6}px`;
          }
        }
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          if (wrapper) {
            wrapper.remove();
            wrapper = null;
          }
          component?.destroy();
          component = null;
          return true;
        }
        return (component?.ref as SlashCommandListRef | null)?.onKeyDown(props) ?? false;
      },

      onExit() {
        if (wrapper) {
          wrapper.remove();
          wrapper = null;
        }
        component?.destroy();
        component = null;
      },
    };
  },

  command: ({ editor, range, props }: {
    editor: import("@tiptap/core").Editor;
    range: { from: number; to: number };
    props: SuggestionItem;
  }) => {
    // Delete the "/command" text
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .run();

    // Dispatch custom event so the editor toolbar can open the appropriate picker
    const event = new CustomEvent("wk-slash-command", {
      detail: { command: props.command, editor },
    });
    window.dispatchEvent(event);
  },
};

/**
 * TipTap Extension wrapping the Suggestion plugin for slash commands.
 * Use this as a regular extension in the editor's extensions array.
 */
export const SlashCommandExtension = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    if (!this.editor) return [];
    return [
      Suggestion({
        editor: this.editor,
        ...SlashCommandConfig,
      }),
    ];
  },
});

/**
 * Re-export the config for reference (used by the old import path).
 * Kept for backwards compatibility with any code that still imports SlashCommandSuggestion.
 */
export { SlashCommandConfig as SlashCommandSuggestion };