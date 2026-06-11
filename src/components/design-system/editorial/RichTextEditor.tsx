import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { WkIcon } from "@/components/design-system/Icon";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";

/* ─── Types ─── */

type ViewMode = "visual" | "html" | "preview" | "split";

interface ToolbarButton {
  command: string;
  icon: string;
  label: string;
  level?: number;
  isBlock?: boolean;
}

interface LinkPopupState {
  visible: boolean;
  url: string;
  text: string;
  x: number;
  y: number;
}

/* ─── Toolbar Groups ─── */

const TEXT_FORMAT: ToolbarButton[] = [
  { command: "bold", icon: "Bold", label: "Bold" },
  { command: "italic", icon: "Italic", label: "Italic" },
  { command: "underline", icon: "Underline", label: "Underline" },
  { command: "strike", icon: "Strikethrough", label: "Strikethrough" },
];

const HEADINGS: ToolbarButton[] = [
  { command: "heading", icon: "Heading1", label: "Heading 1", level: 1 },
  { command: "heading", icon: "Heading2", label: "Heading 2", level: 2 },
  { command: "heading", icon: "Heading3", label: "Heading 3", level: 3 },
  { command: "paragraph", icon: "Type", label: "Paragraph" },
];

const LISTS: ToolbarButton[] = [
  { command: "bulletList", icon: "List", label: "Bullet List" },
  { command: "orderedList", icon: "ListOrdered", label: "Numbered List" },
  { command: "liftListItem", icon: "Outdent", label: "Outdent" },
  { command: "sinkListItem", icon: "Indent", label: "Indent" },
];

const INSERT: ToolbarButton[] = [
  { command: "horizontalRule", icon: "Minus", label: "Horizontal Rule" },
  { command: "codeBlock", icon: "Code", label: "Code Block", isBlock: true },
  { command: "blockquote", icon: "Quote", label: "Blockquote", isBlock: true },
];

/* ─── Component ─── */

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 500 }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("visual");
  const [linkPopup, setLinkPopup] = useState<LinkPopupState>({
    visible: false,
    url: "",
    text: "",
    x: 0,
    y: 0,
  });
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const isInternalUpdate = useRef(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  /* ─── TipTap Editor ─── */

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "wk-rich-link",
        },
      }),
      ImageExtension.configure({
        HTMLAttributes: {
          class: "wk-rich-image",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing your article...",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none outline-none focus:outline-none min-h-[var(--editor-min-h)]",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "k") {
          event.preventDefault();
          handleLinkButton();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true;
      onChange(ed.getHTML());
    },
  });

  /* ─── Sync external value changes into editor ─── */

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const currentHTML = editor.getHTML();
    // Only update if the value actually differs (avoid unnecessary re-renders)
    if (currentHTML !== value) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  /* ─── Toolbar command dispatcher ─── */

  const execCommand = useCallback(
    (btn: ToolbarButton) => {
      if (!editor) return;
      editor.commands.focus();

      switch (btn.command) {
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "underline":
          editor.chain().focus().toggleUnderline().run();
          break;
        case "strike":
          editor.chain().focus().toggleStrike().run();
          break;
        case "heading":
          editor.chain().focus().toggleHeading({ level: btn.level as 1 | 2 | 3 }).run();
          break;
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "liftListItem":
          editor.chain().focus().liftListItem("listItem").run();
          break;
        case "sinkListItem":
          editor.chain().focus().sinkListItem("listItem").run();
          break;
        case "horizontalRule":
          editor.chain().focus().setHorizontalRule().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
        case "clearMarks":
          editor.chain().focus().unsetAllMarks().clearNodes().run();
          break;
        default:
          break;
      }
    },
    [editor]
  );

  /* ─── Active state check ─── */

  const isActive = useCallback(
    (btn: ToolbarButton): boolean => {
      if (!editor) return false;
      switch (btn.command) {
        case "bold":
          return editor.isActive("bold");
        case "italic":
          return editor.isActive("italic");
        case "underline":
          return editor.isActive("underline");
        case "strike":
          return editor.isActive("strike");
        case "heading":
          return editor.isActive("heading", { level: btn.level });
        case "paragraph":
          return editor.isActive("paragraph");
        case "bulletList":
          return editor.isActive("bulletList");
        case "orderedList":
          return editor.isActive("orderedList");
        case "codeBlock":
          return editor.isActive("codeBlock");
        case "blockquote":
          return editor.isActive("blockquote");
        default:
          return false;
      }
    },
    [editor]
  );

  /* ─── Image insertion ─── */

  const handleInsertImage = useCallback(
    (url: string) => {
      if (!editor || !url) return;
      editor.chain().focus().setImage({ src: url, alt: "" }).run();
      setImagePickerOpen(false);
    },
    [editor]
  );

  /* ─── Link handling ─── */

  const handleLinkButton = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    // Get position for popup placement
    const editorDom = editor.view.dom;
    const editorRect = editorDom.getBoundingClientRect();
    const toolbarRect = toolbarRef.current?.getBoundingClientRect();

    // Use selection coordinates if available, otherwise fall back to editor center
    const coords = editor.view.coordsAtPos(from);
    const popupX = coords ? coords.left : editorRect.left + editorRect.width / 2;
    const popupY = coords ? coords.top - 60 : (toolbarRect?.bottom ?? editorRect.top) + 8;

    setLinkPopup({
      visible: true,
      url: previousUrl || "",
      text: selectedText || "",
      x: popupX,
      y: popupY,
    });
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!editor || !linkPopup.url) return;

    const displayText = linkPopup.text || linkPopup.url;

    // If there's selected text, we extend the mark range and set the link
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkPopup.url })
        .run();
    } else {
      // No selection — insert link text then set link on it
      editor
        .chain()
        .focus()
        .insertContent(displayText)
        .command(({ tr, state }) => {
          const pos = state.selection.from;
          tr.insertText(displayText, pos - displayText.length);
          return true;
        })
        .run();

      // Now set link on the inserted text
      editor
        .chain()
        .focus()
        .setTextSelection({
          from: editor.state.selection.from - displayText.length,
          to: editor.state.selection.from,
        })
        .setLink({ href: linkPopup.url })
        .setTextSelection(editor.state.selection.from)
        .run();
    }

    setLinkPopup((prev) => ({ ...prev, visible: false }));
  }, [editor, linkPopup]);

  const unlink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  /* ─── HTML textarea change ─── */

  const handleHtmlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  /* ─── View buttons ─── */

  const VIEW_BUTTONS: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: "visual", icon: "PenTool", label: "Visual" },
    { mode: "html", icon: "Code2", label: "HTML" },
    { mode: "preview", icon: "Eye", label: "Preview" },
    { mode: "split", icon: "Columns2", label: "Split" },
  ];

  const showEditor = viewMode === "visual" || viewMode === "split";
  const showHtml = viewMode === "html" || viewMode === "split";
  const showPreview = viewMode === "preview";

  /* ─── Compute editor min height ─── */

  const editorMinHeight = viewMode === "split" ? 600 : minHeight;

  return (
    <div className="relative">
      {/* TipTap ProseMirror base styles */}
      <style>{`
        .ProseMirror {
          outline: none !important;
          min-height: ${editorMinHeight}px;
          padding: 20px;
          font-family: var(--wk-font-body, Georgia, serif);
          font-size: 15px;
          line-height: 1.75;
          color: var(--wk-text);
          background: var(--wk-bg-subtle);
        }
        .ProseMirror p {
          margin-bottom: 1em;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--wk-text-faint);
          pointer-events: none;
          height: 0;
          font-size: 14px;
        }
        .ProseMirror h1 { font-size: 22px; font-weight: 900; margin-top: 1.5em; margin-bottom: 0.75em; }
        .ProseMirror h2 { font-size: 18px; font-weight: 700; margin-top: 1.25em; margin-bottom: 0.5em; }
        .ProseMirror h3 { font-size: 15px; font-weight: 700; margin-top: 1em; margin-bottom: 0.5em; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin-bottom: 1em; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 1em; }
        .ProseMirror li { margin-bottom: 0.25em; }
        .ProseMirror blockquote {
          border-left: 4px solid var(--wk-brand);
          padding-left: 1em;
          font-style: italic;
          color: var(--wk-text-muted);
          margin: 1em 0;
        }
        .ProseMirror code {
          border-radius: 4px;
          background: var(--wk-bg-subtle);
          padding: 0.15em 0.4em;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }
        .ProseMirror pre {
          overflow-x: auto;
          border-radius: 8px;
          background: var(--wk-bg-subtle);
          padding: 1em;
          margin: 1em 0;
        }
        .ProseMirror pre code {
          background: transparent;
          padding: 0;
        }
        .ProseMirror img {
          max-width: 100%;
          border-radius: 8px;
          margin: 16px 0;
          display: block;
        }
        .ProseMirror hr {
          margin: 1.5em 0;
          border: none;
          border-top: 1px solid var(--wk-border);
        }
        .ProseMirror a {
          color: var(--wk-brand);
          text-decoration: underline;
        }
        .ProseMirror strong { color: var(--wk-text); font-weight: 700; }
        .ProseMirror table { width: 100%; margin: 1em 0; border-collapse: collapse; }
        .ProseMirror th {
          border: 1px solid var(--wk-border);
          padding: 0.5em 0.75em;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          background: var(--wk-surface-raised);
        }
        .ProseMirror td {
          border: 1px solid var(--wk-border);
          padding: 0.5em 0.75em;
          font-size: 13px;
        }
      `}</style>

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className="flex flex-wrap items-center gap-2 border-b border-[var(--wk-border)] px-4 py-3 bg-[var(--wk-surface)] sticky top-0 z-10"
      >
        {/* View Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-1 mr-2">
          {VIEW_BUTTONS.map((btn) => (
            <button
              key={btn.mode}
              onClick={() => setViewMode(btn.mode)}
              title={btn.label}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap ${
                viewMode === btn.mode
                  ? "bg-[var(--wk-surface)] text-[var(--wk-text)]"
                  : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
              }`}
            >
              <WkIcon name={btn.icon as never} size={13} />
              <span className="hidden sm:inline">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[var(--wk-border)] mx-1 hidden sm:block" />

        {/* Text Format */}
        {TEXT_FORMAT.map((btn) => (
          <ToolbarBtn
            key={btn.command}
            icon={btn.icon}
            label={btn.label}
            active={isActive(btn)}
            onClick={() => execCommand(btn)}
          />
        ))}

        {/* Link */}
        <ToolbarBtn
          icon="Link"
          label="Link"
          active={editor?.isActive("link") ?? false}
          onClick={handleLinkButton}
        />
        <ToolbarBtn
          icon="Unlink"
          label="Unlink"
          active={false}
          onClick={unlink}
        />

        <div className="w-px h-6 bg-[var(--wk-border)] mx-1 hidden sm:block" />

        {/* Headings */}
        {HEADINGS.map((btn) => (
          <ToolbarBtn
            key={`${btn.command}-${btn.level ?? "p"}`}
            icon={btn.icon}
            label={btn.label}
            active={isActive(btn)}
            onClick={() => execCommand(btn)}
          />
        ))}

        <div className="w-px h-6 bg-[var(--wk-border)] mx-1 hidden sm:block" />

        {/* Lists */}
        {LISTS.map((btn) => (
          <ToolbarBtn
            key={btn.command}
            icon={btn.icon}
            label={btn.label}
            active={isActive(btn)}
            onClick={() => execCommand(btn)}
          />
        ))}

        <div className="w-px h-6 bg-[var(--wk-border)] mx-1 hidden sm:block" />

        {/* Insert */}
        {INSERT.map((btn) => (
          <ToolbarBtn
            key={btn.command}
            icon={btn.icon}
            label={btn.label}
            active={isActive(btn)}
            onClick={() => execCommand(btn)}
          />
        ))}

        {/* Image Insert */}
        <ToolbarBtn
          icon="ImagePlus"
          label="Insert Image"
          active={false}
          onClick={() => setImagePickerOpen(true)}
        />

        <div className="w-px h-6 bg-[var(--wk-border)] mx-1 hidden sm:block" />

        {/* Undo/Redo */}
        <ToolbarBtn
          icon="Undo2"
          label="Undo"
          active={false}
          onClick={() => execCommand({ command: "undo", icon: "", label: "" })}
        />
        <ToolbarBtn
          icon="Redo2"
          label="Redo"
          active={false}
          onClick={() => execCommand({ command: "redo", icon: "", label: "" })}
        />

        <ToolbarBtn
          icon="RemoveFormatting"
          label="Clear"
          active={false}
          onClick={() => execCommand({ command: "clearMarks", icon: "", label: "" })}
        />
      </div>

      {/* Link Popup */}
      {linkPopup.visible && (
        <div
          className="fixed z-[60] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg p-4 w-80"
          style={{
            left: Math.min(Math.max(linkPopup.x - 160, 8), window.innerWidth - 340),
            top: Math.max(linkPopup.y, 10),
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold text-[var(--wk-text)]">Insert Link</span>
            <button
              onClick={() => setLinkPopup((prev) => ({ ...prev, visible: false }))}
              className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-bg-subtle)]"
            >
              <WkIcon name="X" size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1">
                URL
              </label>
              <input
                type="text"
                value={linkPopup.url}
                onChange={(e) =>
                  setLinkPopup((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://..."
                className="w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1">
                Text
              </label>
              <input
                type="text"
                value={linkPopup.text}
                onChange={(e) =>
                  setLinkPopup((prev) => ({ ...prev, text: e.target.value }))
                }
                placeholder="Link text..."
                className="w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLinkPopup((prev) => ({ ...prev, visible: false }))}
                className="wk-button wk-button-soft wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={insertLink}
                disabled={!linkPopup.url}
                className="wk-button wk-button-primary wk-button-sm flex-1 whitespace-nowrap"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleInsertImage}
        title="Insert Image"
      />

      {/* Editor Area */}
      <div
        className={
          viewMode === "split" ? "grid grid-cols-2 divide-x divide-[var(--wk-border)]" : ""
        }
      >
        {/* Visual Editor */}
        {showEditor && (
          <div className={viewMode === "split" ? "" : ""}>
            <EditorContent editor={editor} />
          </div>
        )}

        {/* HTML Editor */}
        {showHtml && (
          <div className={viewMode === "split" ? "" : ""}>
            <textarea
              ref={htmlRef}
              value={value}
              onChange={handleHtmlChange}
              placeholder="Paste or type HTML content here..."
              className="w-full bg-[var(--wk-bg-subtle)] px-5 py-4 font-mono text-[12px] leading-relaxed text-[var(--wk-text)] outline-none resize-none border-0"
              style={{
                minHeight: viewMode === "split" ? "600px" : `${minHeight}px`,
              }}
            />
          </div>
        )}

        {/* Preview */}
        {showPreview && (
          <div
            className="px-6 py-5"
            style={{
              minHeight: `${minHeight}px`,
            }}
          >
            {value ? (
              <ArticlePreview html={value} />
            ) : (
              <div className="flex h-full items-center justify-center min-h-[300px]">
                <p className="text-[13px] text-[var(--wk-text-faint)]">No content to preview</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Toolbar Button ─── */

function ToolbarBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center w-8 h-8 rounded-md text-[13px] transition-all whitespace-nowrap ${
        active
          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg-subtle)] hover:text-[var(--wk-text)]"
      }`}
    >
      <WkIcon name={icon as never} size={14} />
    </button>
  );
}

/* ─── Preview Renderer ─── */

function ArticlePreview({ html }: { html: string }) {
  return (
    <div
      className="text-[14px] leading-relaxed text-[var(--wk-text)]
        [&_h1]:text-[22px] [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-3
        [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[var(--wk-text)]
        [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
        [&_p]:mb-4 [&_p]:text-[var(--wk-text-soft)]
        [&_a]:text-[var(--wk-brand)] [&_a]:underline
        [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc
        [&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal
        [&_li]:mb-1
        [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--wk-brand)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--wk-text-muted)] [&_blockquote]:my-4
        [&_code]:rounded [&_code]:bg-[var(--wk-bg-subtle)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--wk-text)]
        [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--wk-bg-subtle)] [&_pre]:p-4 [&_pre]:my-4
        [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0
        [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4
        [&_hr]:my-6 [&_hr]:border-[var(--wk-border)]
        [&_strong]:text-[var(--wk-text)] [&_strong]:font-bold
        [&_table]:w-full [&_table]:my-4
        [&_th]:border [&_th]:border-[var(--wk-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-bold [&_th]:bg-[var(--wk-surface-raised)]
        [&_td]:border [&_td]:border-[var(--wk-border)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[13px]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}