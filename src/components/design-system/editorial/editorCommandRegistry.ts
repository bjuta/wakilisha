export type EditorialMenuId =
  | "file"
  | "edit"
  | "insert"
  | "format"
  | "tools"
  | "view";

export type EditorialCommandId =
  | "saveDraft"
  | "exactPreview"
  | "articleDetails"
  | "closeArticle"
  | "undo"
  | "redo"
  | "findReplace"
  | "selectAll"
  | "clearFormatting"
  | "insertImage"
  | "insertDivider"
  | "insertBlockquote"
  | "insertCodeBlock"
  | "insertRelease"
  | "insertArtist"
  | "insertTrack"
  | "paragraph"
  | "heading2"
  | "heading3"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "link"
  | "unlink"
  | "bulletList"
  | "orderedList"
  | "outdent"
  | "indent"
  | "writingStats"
  | "focusMode"
  | "viewVisual"
  | "viewHtml"
  | "viewRendered"
  | "viewSplit";

export interface EditorialCommandMeta {
  label: string;
  shortcut?: string;
}

export interface EditorialMenuPlacement {
  key: string;
  command: EditorialCommandId;
  dividerBefore?: boolean;
}

export interface EditorialMenuDefinition {
  id: EditorialMenuId;
  label: string;
  items: readonly EditorialMenuPlacement[];
}

export const EDITOR_COMMAND_META: Record<
  EditorialCommandId,
  EditorialCommandMeta
> = {
  saveDraft: {
    label: "Save Draft",
    shortcut: "⌘S",
  },
  exactPreview: {
    label: "Exact Public Preview",
  },
  articleDetails: {
    label: "Article Details",
  },
  closeArticle: {
    label: "Close Article",
  },
  undo: {
    label: "Undo",
    shortcut: "⌘Z",
  },
  redo: {
    label: "Redo",
    shortcut: "⇧⌘Z",
  },
  findReplace: {
    label: "Find and Replace",
  },
  selectAll: {
    label: "Select All",
    shortcut: "⌘A",
  },
  clearFormatting: {
    label: "Clear Formatting",
  },
  insertImage: {
    label: "Image from Media Library",
  },
  insertDivider: {
    label: "Horizontal Divider",
  },
  insertBlockquote: {
    label: "Blockquote",
  },
  insertCodeBlock: {
    label: "Code Block",
  },
  insertRelease: {
    label: "Release",
  },
  insertArtist: {
    label: "Artist",
  },
  insertTrack: {
    label: "Track",
  },
  paragraph: {
    label: "Paragraph",
  },
  heading2: {
    label: "Heading 2",
  },
  heading3: {
    label: "Heading 3",
  },
  bold: {
    label: "Bold",
    shortcut: "⌘B",
  },
  italic: {
    label: "Italic",
    shortcut: "⌘I",
  },
  underline: {
    label: "Underline",
    shortcut: "⌘U",
  },
  strike: {
    label: "Strikethrough",
  },
  link: {
    label: "Add Link",
    shortcut: "⌘K",
  },
  unlink: {
    label: "Remove Link",
  },
  bulletList: {
    label: "Bulleted List",
  },
  orderedList: {
    label: "Numbered List",
  },
  outdent: {
    label: "Decrease Indent",
  },
  indent: {
    label: "Increase Indent",
  },
  writingStats: {
    label: "Writing Stats",
  },
  focusMode: {
    label: "Focus Mode",
  },
  viewVisual: {
    label: "Visual",
  },
  viewHtml: {
    label: "HTML",
  },
  viewRendered: {
    label: "Rendered",
  },
  viewSplit: {
    label: "Split",
  },
};

export const EDITOR_MENU_REGISTRY: readonly EditorialMenuDefinition[] = [
  {
    id: "file",
    label: "File",
    items: [
      {
        key: "file-save",
        command: "saveDraft",
      },
      {
        key: "file-preview",
        command: "exactPreview",
      },
      {
        key: "file-details",
        command: "articleDetails",
        dividerBefore: true,
      },
      {
        key: "file-close",
        command: "closeArticle",
      },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      {
        key: "edit-undo",
        command: "undo",
      },
      {
        key: "edit-redo",
        command: "redo",
      },
      {
        key: "edit-find",
        command: "findReplace",
        dividerBefore: true,
      },
      {
        key: "edit-select-all",
        command: "selectAll",
      },
      {
        key: "edit-clear",
        command: "clearFormatting",
        dividerBefore: true,
      },
    ],
  },
  {
    id: "insert",
    label: "Insert",
    items: [
      {
        key: "insert-image",
        command: "insertImage",
      },
      {
        key: "insert-release",
        command: "insertRelease",
        dividerBefore: true,
      },
      {
        key: "insert-artist",
        command: "insertArtist",
      },
      {
        key: "insert-track",
        command: "insertTrack",
      },
      {
        key: "insert-divider",
        command: "insertDivider",
        dividerBefore: true,
      },
      {
        key: "insert-quote",
        command: "insertBlockquote",
      },
      {
        key: "insert-code",
        command: "insertCodeBlock",
      },
    ],
  },
  {
    id: "format",
    label: "Format",
    items: [
      {
        key: "format-paragraph",
        command: "paragraph",
      },
      {
        key: "format-heading-2",
        command: "heading2",
      },
      {
        key: "format-heading-3",
        command: "heading3",
      },
      {
        key: "format-bold",
        command: "bold",
        dividerBefore: true,
      },
      {
        key: "format-italic",
        command: "italic",
      },
      {
        key: "format-underline",
        command: "underline",
      },
      {
        key: "format-strike",
        command: "strike",
      },
      {
        key: "format-link",
        command: "link",
        dividerBefore: true,
      },
      {
        key: "format-unlink",
        command: "unlink",
      },
      {
        key: "format-bullet-list",
        command: "bulletList",
        dividerBefore: true,
      },
      {
        key: "format-number-list",
        command: "orderedList",
      },
      {
        key: "format-outdent",
        command: "outdent",
      },
      {
        key: "format-indent",
        command: "indent",
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      {
        key: "tools-find",
        command: "findReplace",
      },
      {
        key: "tools-stats",
        command: "writingStats",
      },
      {
        key: "tools-focus",
        command: "focusMode",
        dividerBefore: true,
      },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      {
        key: "view-visual",
        command: "viewVisual",
      },
      {
        key: "view-html",
        command: "viewHtml",
      },
      {
        key: "view-rendered",
        command: "viewRendered",
      },
      {
        key: "view-split",
        command: "viewSplit",
      },
      {
        key: "view-details",
        command: "articleDetails",
        dividerBefore: true,
      },
      {
        key: "view-focus",
        command: "focusMode",
      },
    ],
  },
];
