import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { WkIcon } from "@/components/design-system/Icon";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { ImageEditDialog } from "./ImageEditDialog";
import { MediaEditModal, type MediaAsset } from "@/components/admin/media/MediaEditModal";
import { supabase } from "@/lib/supabase";

interface ImageMeta {
  src: string;
  alt: string;
  caption: string;
  title: string;
  alignment?: string;
  assetId?: string;
}

interface Props {
  editor: Editor | null;
}

export function FloatingImageToolbar({ editor }: Props) {
  const [selectedImage, setSelectedImage] = useState<{
    pos: number;
    meta: ImageMeta;
    rect: DOMRect;
  } | null>(null);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [editAssetLoading, setEditAssetLoading] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  // Keeps track of what triggered a dialog open so we don't accidentally
  // clear selectedImage while a modal is open.
  const modalOpenRef = useRef(false);

  /* ─── Detect image selection ─── */
  const detectImage = useCallback(() => {
    if (!editor) {
      setSelectedImage(null);
      return;
    }

    const { selection } = editor.state;
    const { from, to } = selection;

    let imagePos = -1;
    let imageNode: { attrs: Record<string, unknown> } | null = null;

    // Walk the document to find an image node at or near the selection
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "image") {
        imageNode = node as unknown as { attrs: Record<string, unknown> };
        imagePos = pos;
        return false; // stop
      }
    });

    // Also check if the cursor is right before/after an image
    if (imagePos === -1) {
      editor.state.doc.nodesBetween(
        Math.max(0, from - 1),
        Math.min(editor.state.doc.content.size, to + 1),
        (node, pos) => {
          if (node.type.name === "image") {
            imageNode = node as unknown as { attrs: Record<string, unknown> };
            imagePos = pos;
            return false;
          }
        }
      );
    }

    if (imagePos === -1 || !imageNode) {
      setSelectedImage(null);
      return;
    }

    const node = imageNode;
    const meta: ImageMeta = {
      src: String(node.attrs.src || ""),
      alt: String(node.attrs.alt || ""),
      caption: String(node.attrs.caption || ""),
      title: String(node.attrs.title || ""),
      alignment: node.attrs.alignment ? String(node.attrs.alignment) : undefined,
      assetId: node.attrs["data-asset-id"]
        ? String(node.attrs["data-asset-id"])
        : undefined,
    };

    // Get DOM rect
    try {
      const domResult = editor.view.domAtPos(imagePos);
      const domNode = domResult.node as HTMLElement;
      const el =
        domNode.nodeType === Node.TEXT_NODE
          ? domNode.parentElement
          : domNode;

      if (el && el.tagName === "IMG") {
        setSelectedImage({ pos: imagePos, meta, rect: el.getBoundingClientRect() });
      } else {
        // Try to find the img inside the element
        const img = el?.querySelector("img");
        if (img) {
          setSelectedImage({ pos: imagePos, meta, rect: img.getBoundingClientRect() });
        } else {
          setSelectedImage(null);
        }
      }
    } catch {
      setSelectedImage(null);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Don't clobber the toolbar while a modal is open
      if (modalOpenRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(detectImage);
    };

    editor.on("selectionUpdate", handleUpdate);
    editor.on("focus", handleUpdate);
    editor.on("transaction", handleUpdate);

    return () => {
      editor.off("selectionUpdate", handleUpdate);
      editor.off("focus", handleUpdate);
      editor.off("transaction", handleUpdate);
      cancelAnimationFrame(rafRef.current);
    };
  }, [editor, detectImage]);

  // Keep modalOpenRef in sync
  useEffect(() => {
    modalOpenRef.current = replaceOpen || editOpen;
  }, [replaceOpen, editOpen]);

  /* ─── Hide toolbar only on clicks outside BOTH the toolbar AND the image ─── */
  useEffect(() => {
    if (!selectedImage || replaceOpen || editOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;

      // Keep toolbar if clicking inside it
      if (toolbarRef.current?.contains(target)) return;

      // Keep toolbar if clicking on an IMG element (may be same image or another)
      if (target instanceof HTMLElement) {
        if (target.tagName === "IMG") return;
        // Also keep if clicking a figure wrapping an image (our wk-figure structure)
        if (target.closest("figure")?.querySelector("img")) return;
      }

      // Anything else: dismiss
      setSelectedImage(null);
    };

    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    return () =>
      document.removeEventListener("mousedown", handleMouseDown, {
        capture: true,
      });
  }, [selectedImage, replaceOpen, editOpen]);

  /* ─── Actions ─── */
  const handleReplace = useCallback(
    (assetId: string | null, url: string) => {
      if (!editor || !selectedImage) return;
      editor
        .chain()
        .focus()
        .setNodeSelection(selectedImage.pos)
        .updateAttributes("image", {
          src: url,
          "data-asset-id": assetId || null,
        })
        .run();
      setReplaceOpen(false);
      // Re-detect after a tick so the updated node rect is available
      requestAnimationFrame(detectImage);
    },
    [editor, selectedImage, detectImage]
  );

  const handleEditSave = useCallback(
    (meta: ImageMeta) => {
      if (!editor || !selectedImage) return;
      editor
        .chain()
        .focus()
        .setNodeSelection(selectedImage.pos)
        .updateAttributes("image", {
          alt: meta.alt || null,
          caption: meta.caption || null,
          title: meta.title || null,
          alignment: meta.alignment || null,
          "data-asset-id": meta.assetId || null,
        })
        .run();
      setEditOpen(false);
      requestAnimationFrame(detectImage);
    },
    [editor, selectedImage, detectImage]
  );

  const handleEditClick = useCallback(async () => {
    if (!selectedImage) return;
    setEditAssetLoading(true);

    const assetId = selectedImage.meta.assetId;
    const src = selectedImage.meta.src;
    let resolvedAsset: MediaAsset | null = null;

    // Try by asset-id first
    if (assetId) {
      const { data, error } = await supabase
        .from("registry_media_assets")
        .select(
          "id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, metadata, created_at, updated_at"
        )
        .eq("id", assetId)
        .maybeSingle();
      if (!error && data) {
        resolvedAsset = data as unknown as MediaAsset;
      }
    }

    // Fallback: look up by URL if asset-id missing or stale
    if (!resolvedAsset && src) {
      const { data, error } = await supabase
        .from("registry_media_assets")
        .select(
          "id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, metadata, created_at, updated_at"
        )
        .eq("url", src)
        .maybeSingle();
      if (!error && data) {
        resolvedAsset = data as unknown as MediaAsset;
        // Backfill data-asset-id on the TipTap node so next lookup is instant
        if (editor) {
          editor
            .chain()
            .focus()
            .setNodeSelection(selectedImage.pos)
            .updateAttributes("image", {
              "data-asset-id": data.id,
            })
            .run();
        }
      }
    }

    setEditAssetLoading(false);

    if (resolvedAsset) {
      setEditAsset(resolvedAsset);
    }
    setEditOpen(true);
  }, [selectedImage, editor]);

  const handleMediaSave = useCallback(
    (asset: MediaAsset) => {
      if (!editor || !selectedImage) return;
      editor
        .chain()
        .focus()
        .setNodeSelection(selectedImage.pos)
        .updateAttributes("image", {
          alt: (asset.metadata?.alt_text as string) || null,
          caption: (asset.metadata?.caption as string) || null,
          title: asset.title || null,
          alignment: selectedImage.meta.alignment || null,
          "data-asset-id": asset.id || null,
          width: (asset.metadata?.width as number) || null,
          height: (asset.metadata?.height as number) || null,
        })
        .run();
      setEditOpen(false);
      setEditAsset(null);
      requestAnimationFrame(detectImage);
    },
    [editor, selectedImage, detectImage]
  );

  const handleAlign = useCallback(
    (align: string | null) => {
      if (!editor || !selectedImage) return;
      editor
        .chain()
        .focus()
        .setNodeSelection(selectedImage.pos)
        .updateAttributes("image", {
          alignment: align,
        })
        .run();
      requestAnimationFrame(detectImage);
    },
    [editor, selectedImage, detectImage]
  );

  const handleDelete = useCallback(() => {
    if (!editor || !selectedImage) return;
    editor
      .chain()
      .focus()
      .setNodeSelection(selectedImage.pos)
      .deleteSelection()
      .run();
    setSelectedImage(null);
  }, [editor, selectedImage]);

  const handleMediaDelete = useCallback(
    (id: string) => {
      handleDelete();
    },
    [handleDelete]
  );

  /* ─── Positioning ─── */
  const getToolbarStyle = (): React.CSSProperties => {
    if (!selectedImage) return { display: "none" };
    const rect = selectedImage.rect;
    const toolbarWidth = 340;
    const toolbarHeight = 40;
    const padding = 8;

    let left = rect.left + rect.width / 2 - toolbarWidth / 2;
    let top = rect.top - toolbarHeight - padding;

    // Clamp to viewport
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - toolbarWidth - padding)
    );
    top = Math.max(padding, top);

    return {
      position: "fixed",
      left,
      top,
      zIndex: 50,
      width: toolbarWidth,
    };
  };

  if (!selectedImage) return null;

  const curAlign = selectedImage.meta.alignment;

  return (
    <>
      {/* Floating Toolbar */}
      <div
        ref={toolbarRef}
        style={getToolbarStyle()}
        className="flex items-center gap-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg px-2 py-1.5"
        // Prevent clicks inside the toolbar from bubbling to the document mousedown
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Replace */}
        <button
          onClick={() => setReplaceOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-brand-soft)] hover:text-[var(--wk-brand)] transition-all cursor-pointer whitespace-nowrap"
          title="Replace image"
        >
          <WkIcon name="RefreshCw" size={12} />
          Replace
        </button>

        <div className="w-px h-4 bg-[var(--wk-border)]" />

        {/* Alignment */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleAlign(curAlign === "left" ? null : "left")}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all cursor-pointer ${
              curAlign === "left"
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg-subtle)] hover:text-[var(--wk-text)]"
            }`}
            title="Align left"
          >
            <i className="ri-align-left text-[13px]" />
          </button>
          <button
            onClick={() => handleAlign(curAlign === "center" ? null : "center")}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all cursor-pointer ${
              curAlign === "center"
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg-subtle)] hover:text-[var(--wk-text)]"
            }`}
            title="Align center"
          >
            <i className="ri-align-center text-[13px]" />
          </button>
          <button
            onClick={() => handleAlign(curAlign === "right" ? null : "right")}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all cursor-pointer ${
              curAlign === "right"
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg-subtle)] hover:text-[var(--wk-text)]"
            }`}
            title="Align right"
          >
            <i className="ri-align-right text-[13px]" />
          </button>
        </div>

        <div className="w-px h-4 bg-[var(--wk-border)]" />

        {/* Edit */}
        <button
          onClick={handleEditClick}
          disabled={editAssetLoading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-brand-soft)] hover:text-[var(--wk-brand)] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
          title="Edit image details"
        >
          {editAssetLoading ? (
            <i className="ri-loader-2-line animate-spin text-[12px]" />
          ) : (
            <WkIcon name="Pencil" size={12} />
          )}
          Edit
        </button>

        <div className="w-px h-4 bg-[var(--wk-border)]" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-danger-soft)] hover:text-[var(--wk-danger)] transition-all cursor-pointer whitespace-nowrap"
          title="Remove image from article"
        >
          <WkIcon name="Trash2" size={12} />
          Delete
        </button>
      </div>

      {/* Replace Modal — full media picker with browse + upload tabs */}
      <MediaPickerModal
        open={replaceOpen}
        onClose={() => {
          setReplaceOpen(false);
          // Restore toolbar after modal closes
          requestAnimationFrame(detectImage);
        }}
        onSelect={(assetId, url) => {
          handleReplace(assetId, url);
        }}
        title="Replace Image"
        currentUrl={selectedImage.meta.src}
      />

      {/* Edit Modal — full MediaEditModal when we resolved an asset, fallback otherwise */}
      {editOpen && editAsset && (
        <MediaEditModal
          asset={editAsset}
          onClose={() => {
            setEditOpen(false);
            setEditAsset(null);
            requestAnimationFrame(detectImage);
          }}
          onSave={handleMediaSave}
          onDelete={handleMediaDelete}
        />
      )}

      {editOpen && !editAsset && (
        <ImageEditDialog
          open={editOpen}
          meta={selectedImage.meta}
          onClose={() => {
            setEditOpen(false);
            requestAnimationFrame(detectImage);
          }}
          onSave={handleEditSave}
        />
      )}
    </>
  );
}