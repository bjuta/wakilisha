import { useEffect, useRef, useState, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";

/* ─── Types ─── */

type ViewMode = "visual" | "html" | "preview" | "split";

interface ToolbarButton {
  command: string;
  icon: string;
  label: string;
  value?: string;
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
  { command: "strikeThrough", icon: "Strikethrough", label: "Strikethrough" },
];

const HEADINGS: ToolbarButton[] = [
  { command: "formatBlock", icon: "Heading1", label: "Heading 1", value: "H1" },
  { command: "formatBlock", icon: "Heading2", label: "Heading 2", value: "H2" },
  { command: "formatBlock", icon: "Heading3", label: "Heading 3", value: "H3" },
  { command: "formatBlock", icon: "Type", label: "Paragraph", value: "P" },
];

const LISTS: ToolbarButton[] = [
  { command: "insertUnorderedList", icon: "List", label: "Bullet List" },
  { command: "insertOrderedList", icon: "ListOrdered", label: "Numbered List" },
  { command: "outdent", icon: "Outdent", label: "Outdent" },
  { command: "indent", icon: "Indent", label: "Indent" },
];

const INSERT: ToolbarButton[] = [
  { command: "insertHorizontalRule", icon: "Minus", label: "Horizontal Rule" },
  { command: "insertHTML", icon: "Code", label: "Code Block", isBlock: true },
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
  const [activeCommands, setActiveCommands] = useState<Set<string>>(new Set());
  const [linkPopup, setLinkPopup] = useState<LinkPopupState>({
    visible: false,
    url: "",
    text: "",
    x: 0,
    y: 0,
  });
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const linkPopupRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  /* ─── Sync HTML → Editor ─── */
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const editor = editorRef.current;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  /* ─── Content change handler ─── */
  const handleEditorChange = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    isInternalUpdate.current = true;
    onChange(html);
  }, [onChange]);

  /* ─── Track active commands on selection change ─── */
  const updateActiveCommands = useCallback(() => {
    const active = new Set<string>();
    if (typeof document !== "undefined") {
      try {
        [
          "bold",
          "italic",
          "underline",
          "strikeThrough",
          "insertUnorderedList",
          "insertOrderedList",
        ].forEach((cmd) => {
          if (document.queryCommandState(cmd)) {
            active.add(cmd);
          }
        });
        const blockValue = document.queryCommandValue("formatBlock");
        if (blockValue) {
          active.add(`formatBlock:${blockValue.toUpperCase()}`);
        }
      } catch {
        // ignore
      }
    }
    setActiveCommands(active);
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === editorRef.current) {
        updateActiveCommands();
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [updateActiveCommands]);

  /* ─── Toolbar action ─── */
  const execCommand = useCallback(
    (command: string, value?: string, isBlock?: boolean) => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      if (command === "insertHTML" && isBlock) {
        // Insert code block
        const code = "<pre><code>// your code here</code></pre>";
        document.execCommand("insertHTML", false, code);
      } else if (command === "blockquote") {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const blockquote = document.createElement("blockquote");
        try {
          blockquote.appendChild(range.extractContents());
          range.insertNode(blockquote);
          // Move cursor after blockquote
          const newRange = document.createRange();
          newRange.setStartAfter(blockquote);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } catch {
          document.execCommand("formatBlock", false, "blockquote");
        }
      } else if (command === "insertHTML") {
        document.execCommand("insertHTML", false, value || "");
      } else {
        document.execCommand(command, false, value);
      }

      handleEditorChange();
      setTimeout(updateActiveCommands, 0);
    },
    [handleEditorChange, updateActiveCommands]
  );

  /* ─── Image insertion ─── */
  const handleInsertImage = useCallback((url: string) => {
    if (!editorRef.current || !url) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      img.style.margin = "16px 0";
      img.style.display = "block";
      range.deleteContents();
      range.insertNode(img);

      // Move cursor after image
      const newRange = document.createRange();
      newRange.setStartAfter(img);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      document.execCommand("insertHTML", false, `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:16px 0;display:block;" />`);
    }

    setImagePickerOpen(false);
    handleEditorChange();
  }, [handleEditorChange]);

  /* ─── Link handling ─── */
  const handleLinkButton = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Check if we're inside an existing link
    let currentLink: HTMLAnchorElement | null = null;
    let node = selection.anchorNode as Node | null;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLAnchorElement) {
        currentLink = node;
        break;
      }
      node = node.parentNode;
    }

    setLinkPopup({
      visible: true,
      url: currentLink ? currentLink.href : "",
      text: selectedText || (currentLink ? currentLink.textContent || "" : ""),
      x: rect.left + rect.width / 2,
      y: rect.top - 60,
    });
  }, []);

  const insertLink = useCallback(() => {
    if (!editorRef.current || !linkPopup.url) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Remove existing link if inside one
      let node = selection.anchorNode as Node | null;
      while (node && node !== editorRef.current) {
        if (node instanceof HTMLAnchorElement) {
          const parent = node.parentNode;
          if (parent) {
            while (node.firstChild) {
              parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
          }
          break;
        }
        node = node.parentNode;
      }

      // Restore selection
      selection.removeAllRanges();
      selection.addRange(range);

      // Create and insert new link
      const link = document.createElement("a");
      link.href = linkPopup.url;
      link.textContent = linkPopup.text || linkPopup.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.color = "var(--wk-brand)";
      link.style.textDecoration = "underline";
      range.deleteContents();
      range.insertNode(link);

      // Move cursor after link
      const newRange = document.createRange();
      newRange.setStartAfter(link);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    setLinkPopup((prev) => ({ ...prev, visible: false }));
    handleEditorChange();
  }, [linkPopup, handleEditorChange]);

  const unlink = useCallback(() => {
    document.execCommand("unlink", false);
    handleEditorChange();
  }, [handleEditorChange]);

  /* ─── Keyboard shortcuts ─── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        execCommand("bold");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        execCommand("italic");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "u") {
        e.preventDefault();
        execCommand("underline");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleLinkButton();
      } else if (e.key === "Tab") {
        e.preventDefault();
        document.execCommand(e.shiftKey ? "outdent" : "indent", false);
        handleEditorChange();
      }
    },
    [execCommand, handleLinkButton, handleEditorChange]
  );

  /* ─── Paste handler (strip styles, keep basic formatting) ─── */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const html = e.clipboardData.getData("text/html");

      if (html) {
        // Clean pasted HTML
        const cleanHtml = sanitizePasteHtml(html);
        document.execCommand("insertHTML", false, cleanHtml);
      } else {
        document.execCommand("insertText", false, text);
      }
      handleEditorChange();
    },
    [handleEditorChange]
  );

  /* ─── HTML textarea change ─── */
  const handleHtmlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  /* ─── Toolbar active state helpers ─── */
  const isActive = (btn: ToolbarButton): boolean => {
    if (btn.command === "formatBlock" && btn.value) {
      return activeCommands.has(`formatBlock:${btn.value}`);
    }
    return activeCommands.has(btn.command);
  };

  /* ─── View buttons ─── */
  const VIEW_BUTTONS: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: "visual", icon: "PenTool", label: "Visual" },
    { mode: "html", icon: "Code2", label: "HTML" },
    { mode: "preview", icon: "Eye", label: "Preview" },
    { mode: "split", icon: "Columns2", label: "Split" },
  ];

  const showEditor = viewMode === "visual" || viewMode === "split";
  const showHtml = viewMode === "html" || viewMode === "split";
  const showPreview = viewMode === "preview" || viewMode === "split";

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--wk-border)] px-4 py-3 bg-[var(--wk-surface)]">
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
            onClick={() => execCommand(btn.command)}
          />
        ))}

        {/* Link */}
        <ToolbarBtn
          icon="Link"
          label="Link"
          active={false}
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
            key={`${btn.command}-${btn.value}`}
            icon={btn.icon}
            label={btn.label}
            active={isActive(btn)}
            onClick={() => execCommand(btn.command, btn.value)}
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
            onClick={() => execCommand(btn.command)}
          />
        ))}

        <div className="w-px h-6 bg-[var(--wk-border)] mx-1 hidden sm:block" />

        {/* Insert */}
        {INSERT.map((btn) => (
          <ToolbarBtn
            key={btn.command}
            icon={btn.icon}
            label={btn.label}
            active={false}
            onClick={() => execCommand(btn.command, btn.value, btn.isBlock)}
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
          onClick={() => execCommand("undo")}
        />
        <ToolbarBtn
          icon="Redo2"
          label="Redo"
          active={false}
          onClick={() => execCommand("redo")}
        />

        <ToolbarBtn
          icon="RemoveFormatting"
          label="Clear"
          active={false}
          onClick={() => execCommand("removeFormat")}
        />
      </div>

      {/* Link Popup */}
      {linkPopup.visible && (
        <div
          ref={linkPopupRef}
          className="fixed z-[60] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg p-4 w-80"
          style={{
            left: Math.min(linkPopup.x, window.innerWidth - 340),
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
                className="wk-button wk-button-soft wk-button-sm flex-1"
              >
                Cancel
              </button>
              <button
                onClick={insertLink}
                disabled={!linkPopup.url}
                className="wk-button wk-button-primary wk-button-sm flex-1"
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
          <div className={viewMode === "split" ? "min-h-[600px]" : ""}>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onClick={() => updateActiveCommands()}
              className="w-full bg-[var(--wk-bg-subtle)] px-5 py-4 text-[15px] leading-relaxed text-[var(--wk-text)] outline-none"
              style={{
                minHeight: viewMode === "split" ? "600px" : `${minHeight}px`,
                fontFamily: "var(--wk-font-body)",
              }}
              data-placeholder={placeholder}
              dangerouslySetInnerHTML={
                value ? undefined : { __html: `<p><br></p>` }
              }
              suppressContentEditableWarning
            />
            {!value && (
              <div className="absolute pointer-events-none text-[var(--wk-text-faint)] text-[14px] px-5 mt-[-500px]" style={{ marginTop: "-520px" }}>
                {placeholder || "Start writing your article..."}
              </div>
            )}
          </div>
        )}

        {/* HTML Editor */}
        {showHtml && (
          <div className={viewMode === "split" ? "min-h-[600px]" : ""}>
            <textarea
              ref={htmlRef}
              value={value}
              onChange={handleHtmlChange}
              placeholder="Paste or type HTML content here..."
              className={`w-full bg-[var(--wk-bg-subtle)] px-5 py-4 font-mono text-[12px] leading-relaxed text-[var(--wk-text)] outline-none resize-none border-0`}
              style={{
                minHeight: viewMode === "split" ? "600px" : `${minHeight}px`,
              }}
            />
          </div>
        )}

        {/* Preview */}
        {showPreview && (
          <div
            className={`prose prose-sm max-w-none px-6 py-5 ${
              viewMode === "split" ? "h-[600px] overflow-y-auto" : ""
            }`}
            style={{
              fontFamily: "var(--wk-font-body)",
              minHeight: viewMode === "split" ? undefined : `${minHeight}px`,
            }}
          >
            {value ? (
              <ArticlePreview html={value} />
            ) : (
              <div className="flex h-full items-center justify-center">
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
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center w-8 h-8 rounded-md text-[13px] transition-all ${
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

/* ─── Paste HTML Sanitizer ─── */

function sanitizePasteHtml(html: string): string {
  const allowedTags = [
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "STRIKE",
    "S",
    "A",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "PRE",
    "CODE",
    "HR",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "IMG",
    "SPAN",
    "DIV",
  ];

  const allowedAttrs = ["href", "src", "alt", "title", "target"];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toUpperCase();
      if (!allowedTags.includes(tag)) {
        // Replace with text content
        const text = document.createTextNode(el.textContent || "");
        return text;
      }
      const newEl = document.createElement(tag.toLowerCase());
      allowedAttrs.forEach((attr) => {
        if (el.hasAttribute(attr)) {
          newEl.setAttribute(attr, el.getAttribute(attr) || "");
        }
      });
      Array.from(el.childNodes).forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) newEl.appendChild(cleaned);
      });
      return newEl;
    }
    return null;
  }

  const container = document.createElement("div");
  Array.from(body.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) container.appendChild(cleaned);
  });

  return container.innerHTML;
}