import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { WkIcon, type WkIconName } from "@/components/design-system/Icon";

export function EditorialCommentEditor({
  value,
  onChange,
  onPlainTextChange,
  placeholder = "Add editorial feedback…",
  readOnly = false,
  minHeight = 96,
}: {
  value: string;
  onChange?: (html: string) => void;
  onPlainTextChange?: (text: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
}) {
  const onChangeRef = useRef(onChange);
  const onPlainTextChangeRef = useRef(onPlainTextChange);
  onChangeRef.current = onChange;
  onPlainTextChangeRef.current = onPlainTextChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "wk-rich-link",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none outline-none focus:outline-none px-3 py-3 text-wk-text",
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (readOnly) return;
      onChangeRef.current?.(instance.getHTML());
      onPlainTextChangeRef.current?.(instance.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", false);
    }
  }, [editor, readOnly, value]);

  const addLink = () => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", existing ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: href.trim() })
      .run();
  };

  const tools: Array<[WkIconName, string, () => void]> = [
    ["Bold", "Bold", () => editor?.chain().focus().toggleBold().run()],
    ["Italic", "Italic", () => editor?.chain().focus().toggleItalic().run()],
    ["Underline", "Underline", () => editor?.chain().focus().toggleUnderline().run()],
    ["List", "Bullet list", () => editor?.chain().focus().toggleBulletList().run()],
    ["ListOrdered", "Numbered list", () => editor?.chain().focus().toggleOrderedList().run()],
    ["Quote", "Quote", () => editor?.chain().focus().toggleBlockquote().run()],
  ];

  return (
    <div
      className={`overflow-hidden rounded-xl border border-wk-border bg-wk-bg ${
        readOnly ? "border-transparent bg-transparent" : ""
      }`}
    >
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-wk-border px-2 py-1.5">
          {tools.map(([icon, label, action]) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={action}
              className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
            >
              <WkIcon name={icon} size={14} />
            </button>
          ))}
          <button
            type="button"
            title="Link"
            aria-label="Link"
            onClick={addLink}
            className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
          >
            <WkIcon name="Link" size={14} />
          </button>
        </div>
      ) : null}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
