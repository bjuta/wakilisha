import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMSerializer } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { WkIcon } from "@/components/design-system/Icon";
import {
  EditorialMenuBar,
  type ResolvedEditorialCommand,
} from "@/components/design-system/editorial/EditorialMenuBar";
import type {
  EditorialCommandId,
} from "@/components/design-system/editorial/editorCommandRegistry";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { ExtendedImage } from "@/components/admin/editor/ExtendedImage";
import { FloatingImageToolbar } from "@/components/admin/editor/FloatingImageToolbar";
import { ImageEditDialog } from "@/components/admin/editor/ImageEditDialog";
import { SlashCommandExtension } from "@/components/admin/editor/SlashCommandSuggestion";
import { useReleaseSearchData } from "@/hooks/useReleaseSearchData";
import { useArtistSearchData } from "@/hooks/useArtistSearchData";
import { useTrackSearchData } from "@/hooks/useTrackSearchData";
import { releaseUrl } from "@/utils/releaseUrl";
import { trackUrl } from "@/utils/trackUrl";
import {
  searchRegistryArtists,
  searchRegistryReleases,
  searchRegistryTracks,
  type RegistryArtistSearchResult,
  type RegistryReleaseSearchResult,
  type RegistryTrackSearchResult,
} from "@/services/playlists/playlistAdminService";

/* ─── Types ─── */

type ViewMode = "visual" | "html" | "preview" | "split";

export interface RichTextSelectionSnapshot {
  from: number;
  to: number;
  quote: string;
  prefix: string;
  suffix: string;
  viewportRect: {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  getViewportRect: () => {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  buildProposedContentHtml: (
    operationKind: "replace" | "delete",
    replacementText: string,
  ) => string;
}

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
  readOnly?: boolean;
  readOnlyLabel?: string;
  captureTextSelection?: boolean;
  onTextSelectionChange?: (
    selection: RichTextSelectionSnapshot | null,
  ) => void;
  onSaveDraft?: () => void | Promise<void>;
  onPreviewArticle?: () => void | Promise<void>;
  onOpenArticleDetails?: () => void;
  onCloseArticle?: () => void;
  onOpenFindReplace?: () => void;
  onShowWritingStats?: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  wordCount?: number;
  readingMinutes?: number;
  profile?: "article" | "playlist-description";
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 500,
  readOnly = false,
  readOnlyLabel = "Viewing only",
  captureTextSelection = false,
  onTextSelectionChange,
  onSaveDraft,
  onPreviewArticle,
  onOpenArticleDetails,
  onCloseArticle,
  onOpenFindReplace,
  onShowWritingStats,
  focusMode = false,
  onToggleFocusMode,
  wordCount = 0,
  readingMinutes = 1,
  profile = "article",
}: Props) {
  const playlistDescriptionMode =
    profile === "playlist-description";

  const [viewMode, setViewMode] = useState<ViewMode>("visual");
  const [linkPopup, setLinkPopup] = useState<LinkPopupState>({
    visible: false,
    url: "",
    text: "",
    x: 0,
    y: 0,
  });
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerMeta, setImagePickerMeta] = useState<{
    src: string;
    alt: string;
    caption: string;
    title: string;
    assetId?: string;
  } | null>(null);
  const [releasePickerOpen, setReleasePickerOpen] = useState(false);
  const [releaseSearch, setReleaseSearch] = useState("");
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  const [artistSearch, setArtistSearch] = useState("");
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);
  const [trackSearch, setTrackSearch] = useState("");

  const [playlistReleaseResults, setPlaylistReleaseResults] =
    useState<RegistryReleaseSearchResult[]>([]);
  const [playlistArtistResults, setPlaylistArtistResults] =
    useState<RegistryArtistSearchResult[]>([]);
  const [playlistTrackResults, setPlaylistTrackResults] =
    useState<RegistryTrackSearchResult[]>([]);
  const [playlistReleaseLoading, setPlaylistReleaseLoading] =
    useState(false);
  const [playlistArtistLoading, setPlaylistArtistLoading] =
    useState(false);
  const [playlistTrackLoading, setPlaylistTrackLoading] =
    useState(false);
  const [playlistReleaseError, setPlaylistReleaseError] =
    useState<string | null>(null);
  const [playlistArtistError, setPlaylistArtistError] =
    useState<string | null>(null);
  const [playlistTrackError, setPlaylistTrackError] =
    useState<string | null>(null);

  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  const hydratedHtmlRef = useRef<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [, setSelectionRevision] = useState(0);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  onChangeRef.current = onChange;

  const { data: releases, loading: releasesLoading } =
    useReleaseSearchData(!playlistDescriptionMode);
  const { data: artists, loading: artistsLoading } =
    useArtistSearchData(!playlistDescriptionMode);
  const { data: tracks, loading: tracksLoading } =
    useTrackSearchData(!playlistDescriptionMode);

  const filteredReleases = useMemo(() => {
    if (playlistDescriptionMode) {
      return playlistReleaseResults;
    }

    if (!releaseSearch.trim()) {
      return releases;
    }

    const q =
      releaseSearch.toLowerCase();

    return releases.filter(
      (release) =>
        release.title
          .toLowerCase()
          .includes(q) ||
        release.artistName
          .toLowerCase()
          .includes(q),
    );
  }, [
    playlistDescriptionMode,
    playlistReleaseResults,
    releases,
    releaseSearch,
  ]);

  const filteredArtists = useMemo(() => {
    if (playlistDescriptionMode) {
      return playlistArtistResults
        .filter(
          (artist) =>
            artist.status ===
            "active",
        )
        .map((artist) => ({
          id: artist.id,
          slug: artist.slug,
          name: artist.displayName,
          imageUrl: undefined,
          genres: [],
          country: undefined,
          contextText: "",
        }));
    }

    if (!artistSearch.trim()) {
      return artists;
    }

    const q =
      artistSearch.toLowerCase();

    return artists.filter(
      (artist) =>
        artist.name
          .toLowerCase()
          .includes(q) ||
        (
          artist.country &&
          artist.country
            .toLowerCase()
            .includes(q)
        ),
    );
  }, [
    artistSearch,
    artists,
    playlistArtistResults,
    playlistDescriptionMode,
  ]);

  const filteredTracks = useMemo(() => {
    if (playlistDescriptionMode) {
      return playlistTrackResults.map(
        (track) => ({
          id: track.id,
          slug: track.slug,
          artistSlug:
            track.artistSlug || "",
          title: track.title,
          artist:
            track.artistNames.join(", ") ||
            "Artist unresolved",
          genre: "",
          artworkUrl:
            track.artworkUrl || "",
          isPlayable:
            Boolean(track.previewUrl),
          source: "registry",
          label:
            track.releaseTitle || "",
          contextText: "",
          previewUrl:
            track.previewUrl,
        }),
      );
    }

    if (!trackSearch.trim()) {
      return tracks;
    }

    const q =
      trackSearch.toLowerCase();

    return tracks.filter(
      (track) =>
        track.title
          .toLowerCase()
          .includes(q) ||
        track.artist
          .toLowerCase()
          .includes(q),
    );
  }, [
    playlistDescriptionMode,
    playlistTrackResults,
    trackSearch,
    tracks,
  ]);

  const releasePickerLoading =
    playlistDescriptionMode
      ? playlistReleaseLoading
      : releasesLoading;
  const artistPickerLoading =
    playlistDescriptionMode
      ? playlistArtistLoading
      : artistsLoading;
  const trackPickerLoading =
    playlistDescriptionMode
      ? playlistTrackLoading
      : tracksLoading;

  useEffect(() => {
    if (
      !playlistDescriptionMode ||
      !releasePickerOpen
    ) {
      return;
    }

    const query =
      releaseSearch.trim();

    if (query.length < 2) {
      setPlaylistReleaseResults([]);
      setPlaylistReleaseLoading(false);
      setPlaylistReleaseError(null);
      return;
    }

    let alive = true;
    const timeout =
      window.setTimeout(() => {
        setPlaylistReleaseLoading(true);
        setPlaylistReleaseError(null);

        searchRegistryReleases(query)
          .then((results) => {
            if (alive) {
              setPlaylistReleaseResults(
                results,
              );
            }
          })
          .catch((reason) => {
            if (!alive) return;

            setPlaylistReleaseResults([]);
            setPlaylistReleaseError(
              reason instanceof Error
                ? reason.message
                : "Release search failed.",
            );
          })
          .finally(() => {
            if (alive) {
              setPlaylistReleaseLoading(
                false,
              );
            }
          });
      }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [
    playlistDescriptionMode,
    releasePickerOpen,
    releaseSearch,
  ]);

  useEffect(() => {
    if (
      !playlistDescriptionMode ||
      !artistPickerOpen
    ) {
      return;
    }

    const query =
      artistSearch.trim();

    if (query.length < 2) {
      setPlaylistArtistResults([]);
      setPlaylistArtistLoading(false);
      setPlaylistArtistError(null);
      return;
    }

    let alive = true;
    const timeout =
      window.setTimeout(() => {
        setPlaylistArtistLoading(true);
        setPlaylistArtistError(null);

        searchRegistryArtists(query)
          .then((results) => {
            if (alive) {
              setPlaylistArtistResults(
                results,
              );
            }
          })
          .catch((reason) => {
            if (!alive) return;

            setPlaylistArtistResults([]);
            setPlaylistArtistError(
              reason instanceof Error
                ? reason.message
                : "Artist search failed.",
            );
          })
          .finally(() => {
            if (alive) {
              setPlaylistArtistLoading(
                false,
              );
            }
          });
      }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [
    artistPickerOpen,
    artistSearch,
    playlistDescriptionMode,
  ]);

  useEffect(() => {
    if (
      !playlistDescriptionMode ||
      !trackPickerOpen
    ) {
      return;
    }

    const query =
      trackSearch.trim();

    if (query.length < 2) {
      setPlaylistTrackResults([]);
      setPlaylistTrackLoading(false);
      setPlaylistTrackError(null);
      return;
    }

    let alive = true;
    const timeout =
      window.setTimeout(() => {
        setPlaylistTrackLoading(true);
        setPlaylistTrackError(null);

        searchRegistryTracks(query)
          .then((results) => {
            if (alive) {
              setPlaylistTrackResults(
                results,
              );
            }
          })
          .catch((reason) => {
            if (!alive) return;

            setPlaylistTrackResults([]);
            setPlaylistTrackError(
              reason instanceof Error
                ? reason.message
                : "Track search failed.",
            );
          })
          .finally(() => {
            if (alive) {
              setPlaylistTrackLoading(
                false,
              );
            }
          });
      }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [
    playlistDescriptionMode,
    trackPickerOpen,
    trackSearch,
  ]);


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
      ...(playlistDescriptionMode
        ? []
        : [
            ExtendedImage.configure({
              HTMLAttributes: {
                class: "wk-rich-image",
              },
            }),
          ]),
      Placeholder.configure({
        placeholder:
          placeholder ||
          (playlistDescriptionMode
            ? "Write the story behind this Playlist..."
            : "Start writing your article..."),
      }),
      ...(playlistDescriptionMode
        ? []
        : [SlashCommandExtension]),
    ],
    content: value || "",
    editable: !readOnly,
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
    onCreate: ({ editor: ed }) => {
      hydratedHtmlRef.current = ed.getHTML();
    },
    onUpdate: ({ editor: ed }) => {
      if (readOnlyRef.current) return;

      const nextHTML = ed.getHTML();

      if (nextHTML === hydratedHtmlRef.current) {
        return;
      }

      hydratedHtmlRef.current = nextHTML;
      onChangeRef.current(nextHTML);
    },
  });

  /* ─── Listen for slash command events ─── */

  useEffect(() => {
    const onSlashCommand = (e: Event) => {
      if (readOnly || playlistDescriptionMode) return;
      const detail = (e as CustomEvent).detail as { command: string };
      switch (detail.command) {
        case "release":
          setReleasePickerOpen(true);
          break;
        case "artist":
          setArtistPickerOpen(true);
          break;
        case "track":
          setTrackPickerOpen(true);
          break;
      }
    };
    window.addEventListener("wk-slash-command", onSlashCommand);
    return () => window.removeEventListener("wk-slash-command", onSlashCommand);
  }, [playlistDescriptionMode, readOnly]);

  /* ─── Sync external value changes into editor ─── */

  useEffect(() => {
    if (!editor) return;

    const currentHTML = editor.getHTML();

    /*
     * Normal typing echoes the same HTML back from
     * the parent and requires no action. A different
     * value is authoritative external state and must
     * replace the editor document.
     */
    if (currentHTML !== value) {
      editor.commands.setContent(
        value || "",
        false,
      );
    }

    hydratedHtmlRef.current =
      editor.getHTML();
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
    editor.view.dom.setAttribute("aria-readonly", String(readOnly));
  }, [editor, readOnly]);


  const emitTextSelection = useCallback(() => {
    if (!onTextSelectionChange) return;

    if (!editor || !captureTextSelection) {
      onTextSelectionChange(null);
      return;
    }

    const { from, to, empty } =
      editor.state.selection;

    if (empty) {
      onTextSelectionChange(null);
      return;
    }

    const documentNode = editor.state.doc;
    const maximumPosition =
      documentNode.content.size;

    const quote = documentNode.textBetween(
      from,
      to,
      " ",
      " ",
    );

    if (!quote) {
      onTextSelectionChange(null);
      return;
    }

    const prefixStart = Math.max(
      0,
      from - 120,
    );

    const suffixEnd = Math.min(
      maximumPosition,
      to + 120,
    );

    const buildProposedContentHtml = (
      operationKind: "replace" | "delete",
      replacementText: string,
    ): string => {
      const transaction = editor.state.tr;

      if (operationKind === "delete") {
        transaction.delete(from, to);
      } else {
        transaction.insertText(
          replacementText,
          from,
          to,
        );
      }

      const container =
        document.createElement("div");

      const fragment =
        DOMSerializer.fromSchema(
          transaction.doc.type.schema,
        ).serializeFragment(
          transaction.doc.content,
        );

      container.appendChild(fragment);

      return container.innerHTML;
    };


    const browserSelection =
      window.getSelection();

    const selectionRange =
      browserSelection &&
      browserSelection.rangeCount > 0
        ? browserSelection.getRangeAt(0)
        : null;

    const clientRects =
      selectionRange
        ? Array.from(
            selectionRange.getClientRects(),
          )
        : [];

    const lastClientRect =
      clientRects.length > 0
        ? clientRects[
            clientRects.length - 1
          ]
        : selectionRange
          ? selectionRange.getBoundingClientRect()
          : null;

    const viewportRect =
      lastClientRect &&
      (
        lastClientRect.width > 0 ||
        lastClientRect.height > 0
      )
        ? {
            top: lastClientRect.top,
            left: lastClientRect.left,
            right: lastClientRect.right,
            bottom: lastClientRect.bottom,
            width: lastClientRect.width,
            height: lastClientRect.height,
          }
        : null;

    const getViewportRect = () => {
      try {
        const coordinates =
          editor.view.coordsAtPos(to);

        const width = Math.max(
          coordinates.right -
            coordinates.left,
          1,
        );

        const height = Math.max(
          coordinates.bottom -
            coordinates.top,
          1,
        );

        return {
          top: coordinates.top,
          left: coordinates.left,
          right: coordinates.right,
          bottom: coordinates.bottom,
          width,
          height,
        };
      } catch {
        return null;
      }
    };

    onTextSelectionChange({
      from,
      to,
      quote,
      prefix: documentNode.textBetween(
        prefixStart,
        from,
        " ",
        " ",
      ),
      suffix: documentNode.textBetween(
        to,
        suffixEnd,
        " ",
        " ",
      ),
      viewportRect,
      getViewportRect,
      buildProposedContentHtml,
    });
  }, [
    captureTextSelection,
    editor,
    onTextSelectionChange,
  ]);

  useEffect(() => {
    if (!editor) {
      onTextSelectionChange?.(null);
      return;
    }

    const refreshSelectionRevision = () => {
      setSelectionRevision(
        (revision) => revision + 1,
      );
    };

    const commitTextSelection = () => {
      refreshSelectionRevision();
      emitTextSelection();
    };

    editor.on(
      "selectionUpdate",
      refreshSelectionRevision,
    );

    editor.on(
      "transaction",
      refreshSelectionRevision,
    );

    const editorElement =
      editor.view.dom;

    editorElement.addEventListener(
      "pointerup",
      commitTextSelection,
    );

    editorElement.addEventListener(
      "touchend",
      commitTextSelection,
    );

    editorElement.addEventListener(
      "keyup",
      commitTextSelection,
    );

    emitTextSelection();

    return () => {
      editor.off(
        "selectionUpdate",
        refreshSelectionRevision,
      );

      editor.off(
        "transaction",
        refreshSelectionRevision,
      );

      editorElement.removeEventListener(
        "pointerup",
        commitTextSelection,
      );

      editorElement.removeEventListener(
        "touchend",
        commitTextSelection,
      );

      editorElement.removeEventListener(
        "keyup",
        commitTextSelection,
      );
    };
  }, [
    editor,
    emitTextSelection,
    onTextSelectionChange,
  ]);

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
    (assetId: string | null, url: string) => {
      if (!editor || !url) return;
      // Open the image edit dialog after insertion so the user can set alt/caption
      setImagePickerMeta({
        src: url,
        alt: "",
        caption: "",
        title: "",
        assetId: assetId ?? undefined,
      });
      setImagePickerOpen(false);
    },
    [editor]
  );

  const handleSaveImageMeta = useCallback(
    (meta: { src: string; alt: string; caption: string; title: string; assetId?: string }) => {
      if (!editor || !meta.src) return;
      editor
        .chain()
        .focus()
        .setImage({
          src: meta.src,
          alt: meta.alt,
          caption: meta.caption,
          title: meta.title,
          "data-asset-id": meta.assetId || null,
        })
        .run();
      setImagePickerMeta(null);
    },
    [editor]
  );

  const handleInsertRegistryLink = useCallback(
    (
      label: string,
      href: string,
    ) => {
      if (!editor || !label.trim() || !href.trim()) {
        return;
      }

      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [
            {
              type: "link",
              attrs: {
                href,
              },
            },
          ],
        })
        .insertContent(" ")
        .run();
    },
    [editor],
  );

  const handleInsertReleaseShortcode = useCallback(
    (slug: string) => {
      if (!editor) return;
      const shortcode = `\n\n[wk-release slug="${slug}"]\n\n`;
      editor.chain().focus().insertContent(shortcode).run();
      setReleasePickerOpen(false);
      setReleaseSearch("");
    },
    [editor]
  );

  const handleInsertArtistShortcode = useCallback(
    (slug: string) => {
      if (!editor) return;
      const shortcode = `\n\n[wk-artist slug="${slug}"]\n\n`;
      editor.chain().focus().insertContent(shortcode).run();
      setArtistPickerOpen(false);
      setArtistSearch("");
    },
    [editor]
  );

  const handleInsertTrackShortcode = useCallback(
    (slug: string) => {
      if (!editor) return;
      const shortcode = `\n\n[wk-track slug="${slug}"]\n\n`;
      editor.chain().focus().insertContent(shortcode).run();
      setTrackPickerOpen(false);
      setTrackSearch("");
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
      if (readOnly) return;
      onChange(e.target.value);
    },
    [onChange, readOnly]
  );

  const showEditor = viewMode === "visual" || viewMode === "split";
  const showHtml = viewMode === "html" || viewMode === "split";
  const showPreview = viewMode === "preview";


  const hasTextSelection = Boolean(
    editor && !editor.state.selection.empty,
  );

  const isListContext = Boolean(
    editor &&
      (
        editor.isActive("bulletList") ||
        editor.isActive("orderedList")
      ),
  );

  const resolveMenuCommand = useCallback(
    (
      command: EditorialCommandId,
    ): ResolvedEditorialCommand => {
      const unavailable = {
        onSelect: () => undefined,
        hidden: true,
      };

      const editable = Boolean(editor) && !readOnly;

      function runToolbarCommand(
        toolbarCommand: ToolbarButton,
      ) {
        execCommand(toolbarCommand);
      }

      switch (command) {
        case "saveDraft":
          return {
            onSelect: () => {
              void onSaveDraft?.();
            },
            disabled:
              !onSaveDraft || readOnly,
            hidden: !onSaveDraft,
          };

        case "exactPreview":
          return {
            onSelect: () => {
              void onPreviewArticle?.();
            },
            hidden: !onPreviewArticle,
          };

        case "articleDetails":
          return {
            onSelect: () =>
              onOpenArticleDetails?.(),
            hidden: !onOpenArticleDetails,
          };

        case "closeArticle":
          return {
            onSelect: () =>
              onCloseArticle?.(),
            hidden: !onCloseArticle,
          };

        case "undo":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "undo",
                icon: "Undo2",
                label: "Undo",
              }),
            disabled: !editable,
          };

        case "redo":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "redo",
                icon: "Redo2",
                label: "Redo",
              }),
            disabled: !editable,
          };

        case "findReplace":
          return {
            onSelect: () =>
              onOpenFindReplace?.(),
            hidden: !onOpenFindReplace,
          };

        case "selectAll":
          return {
            onSelect: () => {
              editor
                ?.chain()
                .focus()
                .selectAll()
                .run();
            },
            disabled: !editor,
          };

        case "clearFormatting":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "clearMarks",
                icon: "RemoveFormatting",
                label: "Clear Formatting",
              }),
            disabled: !editable,
          };

        case "insertImage":
          return {
            onSelect: () =>
              setImagePickerOpen(true),
            disabled: !editable,
          };

        case "insertDivider":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "horizontalRule",
                icon: "Minus",
                label: "Horizontal Divider",
              }),
            disabled: !editable,
          };

        case "insertBlockquote":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "blockquote",
                icon: "Quote",
                label: "Blockquote",
              }),
            active:
              editor?.isActive(
                "blockquote",
              ) ?? false,
            disabled: !editable,
          };

        case "insertCodeBlock":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "codeBlock",
                icon: "Code",
                label: "Code Block",
              }),
            active:
              editor?.isActive(
                "codeBlock",
              ) ?? false,
            disabled: !editable,
          };

        case "insertRelease":
          return {
            onSelect: () =>
              setReleasePickerOpen(true),
            disabled: !editable,
          };

        case "insertArtist":
          return {
            onSelect: () =>
              setArtistPickerOpen(true),
            disabled: !editable,
          };

        case "insertTrack":
          return {
            onSelect: () =>
              setTrackPickerOpen(true),
            disabled: !editable,
          };

        case "paragraph":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "paragraph",
                icon: "Type",
                label: "Paragraph",
              }),
            active:
              editor?.isActive(
                "paragraph",
              ) ?? false,
            disabled: !editable,
          };

        case "heading2":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "heading",
                icon: "Heading2",
                label: "Heading 2",
                level: 2,
              }),
            active:
              editor?.isActive(
                "heading",
                { level: 2 },
              ) ?? false,
            disabled: !editable,
          };

        case "heading3":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "heading",
                icon: "Heading3",
                label: "Heading 3",
                level: 3,
              }),
            active:
              editor?.isActive(
                "heading",
                { level: 3 },
              ) ?? false,
            disabled: !editable,
          };

        case "bold":
        case "italic":
        case "underline":
        case "strike": {
          const definitions: Record<
            typeof command,
            ToolbarButton
          > = {
            bold: {
              command: "bold",
              icon: "Bold",
              label: "Bold",
            },
            italic: {
              command: "italic",
              icon: "Italic",
              label: "Italic",
            },
            underline: {
              command: "underline",
              icon: "Underline",
              label: "Underline",
            },
            strike: {
              command: "strike",
              icon: "Strikethrough",
              label: "Strikethrough",
            },
          };

          return {
            onSelect: () =>
              runToolbarCommand(
                definitions[command],
              ),
            active:
              editor?.isActive(
                definitions[command]
                  .command,
              ) ?? false,
            disabled: !editable,
          };
        }

        case "link":
          return {
            onSelect: handleLinkButton,
            active:
              editor?.isActive("link") ??
              false,
            disabled: !editable,
          };

        case "unlink":
          return {
            onSelect: unlink,
            disabled:
              !editable ||
              !editor?.isActive("link"),
          };

        case "bulletList":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "bulletList",
                icon: "List",
                label: "Bulleted List",
              }),
            active:
              editor?.isActive(
                "bulletList",
              ) ?? false,
            disabled: !editable,
          };

        case "orderedList":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "orderedList",
                icon: "ListOrdered",
                label: "Numbered List",
              }),
            active:
              editor?.isActive(
                "orderedList",
              ) ?? false,
            disabled: !editable,
          };

        case "outdent":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "liftListItem",
                icon: "Outdent",
                label: "Decrease Indent",
              }),
            disabled:
              !editable ||
              !isListContext,
          };

        case "indent":
          return {
            onSelect: () =>
              runToolbarCommand({
                command: "sinkListItem",
                icon: "Indent",
                label: "Increase Indent",
              }),
            disabled:
              !editable ||
              !isListContext,
          };

        case "writingStats":
          return {
            onSelect: () =>
              onShowWritingStats?.(),
            label: `${wordCount.toLocaleString()} words, ${readingMinutes} min read`,
            hidden: !onShowWritingStats,
          };

        case "focusMode":
          return {
            onSelect: () =>
              onToggleFocusMode?.(),
            label: focusMode
              ? "Exit Focus Mode"
              : "Focus Mode",
            active: focusMode,
            hidden: !onToggleFocusMode,
          };

        case "viewVisual":
          return {
            onSelect: () =>
              setViewMode("visual"),
            active:
              viewMode === "visual",
          };

        case "viewHtml":
          return {
            onSelect: () =>
              setViewMode("html"),
            active: viewMode === "html",
          };

        case "viewRendered":
          return {
            onSelect: () =>
              setViewMode("preview"),
            active:
              viewMode === "preview",
          };

        case "viewSplit":
          return {
            onSelect: () =>
              setViewMode("split"),
            active: viewMode === "split",
          };

        default:
          return unavailable;
      }
    },
    [
      editor,
      readOnly,
      execCommand,
      handleLinkButton,
      unlink,
      onSaveDraft,
      onPreviewArticle,
      onOpenArticleDetails,
      onCloseArticle,
      onOpenFindReplace,
      onShowWritingStats,
      focusMode,
      onToggleFocusMode,
      wordCount,
      readingMinutes,
      isListContext,
      viewMode,
    ],
  );

  /* ─── Compute editor min height ─── */

  const editorMinHeight = viewMode === "split" ? 600 : minHeight;

  return (
    <div
      className="relative"
      data-review-selection-capture={
        captureTextSelection || undefined
      }
    >
      {/* TipTap ProseMirror base styles */}
      <style>{`
        .ProseMirror {
          outline: none !important;
          min-height: ${editorMinHeight}px;
          max-width: 820px;
          margin: 0 auto;
          padding: 48px 40px 72px;
          font-family: var(--wk-font-body, Georgia, serif);
          font-size: 17px;
          line-height: 1.82;
          color: var(--wk-text);
          background: var(--wk-surface);
        }
        @media (max-width: 640px) {
          .ProseMirror {
            min-height: ${Math.min(editorMinHeight, 520)}px;
            padding: 28px 20px 48px;
            font-size: 16px;
            line-height: 1.75;
          }
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

      <div className="sticky top-0 z-20 border-b border-wk-border bg-wk-surface">
        {!readOnly && !playlistDescriptionMode ? (
          <div className="overflow-x-auto border-b border-wk-border">
            <EditorialMenuBar
              resolveCommand={resolveMenuCommand}
            />
          </div>
        ) : null}

        <div
          ref={toolbarRef}
          aria-label="Contextual formatting"
          className="flex min-h-11 items-center gap-1 overflow-x-auto px-3 py-2"
        >
          {readOnly ? (
            <span className="px-2 text-[11px] font-bold text-wk-text-faint">
              {readOnlyLabel}
            </span>
          ) : (
            <>
              <ToolbarBtn
                icon="Undo2"
                label="Undo"
                active={false}
                onClick={() =>
                  execCommand({
                    command: "undo",
                    icon: "Undo2",
                    label: "Undo",
                  })
                }
              />

              <ToolbarBtn
                icon="Redo2"
                label="Redo"
                active={false}
                onClick={() =>
                  execCommand({
                    command: "redo",
                    icon: "Redo2",
                    label: "Redo",
                  })
                }
              />

              <div className="mx-1 h-6 w-px shrink-0 bg-wk-border" />

              {hasTextSelection ? (
                <>
                  {TEXT_FORMAT.map((button) => (
                    <ToolbarBtn
                      key={button.command}
                      icon={button.icon}
                      label={button.label}
                      active={isActive(button)}
                      onClick={() =>
                        execCommand(button)
                      }
                    />
                  ))}

                  <ToolbarBtn
                    icon="Link"
                    label="Add Link"
                    active={
                      editor?.isActive(
                        "link",
                      ) ?? false
                    }
                    onClick={handleLinkButton}
                  />

                  {editor?.isActive("link") ? (
                    <ToolbarBtn
                      icon="Unlink"
                      label="Remove Link"
                      active={false}
                      onClick={unlink}
                    />
                  ) : null}

                  <ToolbarBtn
                    icon="RemoveFormatting"
                    label="Clear Formatting"
                    active={false}
                    onClick={() =>
                      execCommand({
                        command: "clearMarks",
                        icon: "RemoveFormatting",
                        label: "Clear Formatting",
                      })
                    }
                  />
                </>
              ) : (
                <>
                  {HEADINGS.filter(
                    (button) =>
                      button.command ===
                        "paragraph" ||
                      button.level === 2 ||
                      button.level === 3,
                  ).map((button) => (
                    <ToolbarBtn
                      key={`${button.command}-${button.level ?? "p"}`}
                      icon={button.icon}
                      label={button.label}
                      active={isActive(button)}
                      onClick={() =>
                        execCommand(button)
                      }
                    />
                  ))}

                  {LISTS.filter(
                    (button) =>
                      button.command ===
                        "bulletList" ||
                      button.command ===
                        "orderedList",
                  ).map((button) => (
                    <ToolbarBtn
                      key={button.command}
                      icon={button.icon}
                      label={button.label}
                      active={isActive(button)}
                      onClick={() =>
                        execCommand(button)
                      }
                    />
                  ))}

                  {isListContext ? (
                    <>
                      <ToolbarBtn
                        icon="Outdent"
                        label="Decrease Indent"
                        active={false}
                        onClick={() =>
                          execCommand({
                            command:
                              "liftListItem",
                            icon: "Outdent",
                            label:
                              "Decrease Indent",
                          })
                        }
                      />

                      <ToolbarBtn
                        icon="Indent"
                        label="Increase Indent"
                        active={false}
                        onClick={() =>
                          execCommand({
                            command:
                              "sinkListItem",
                            icon: "Indent",
                            label:
                              "Increase Indent",
                          })
                        }
                      />
                    </>
                  ) : null}

                  <div className="mx-1 h-6 w-px shrink-0 bg-wk-border" />

                  {playlistDescriptionMode ? (
                    <>
                      <ToolbarBtn
                        icon="User"
                        label="Link Artist"
                        active={false}
                        onClick={() =>
                          setArtistPickerOpen(true)
                        }
                      />
                      <ToolbarBtn
                        icon="Disc3"
                        label="Link EP or Album"
                        active={false}
                        onClick={() =>
                          setReleasePickerOpen(true)
                        }
                      />
                      <ToolbarBtn
                        icon="Music"
                        label="Link Track"
                        active={false}
                        onClick={() =>
                          setTrackPickerOpen(true)
                        }
                      />
                    </>
                  ) : (
                    <ToolbarBtn
                      icon="ImagePlus"
                      label="Insert Image"
                      active={false}
                      onClick={() =>
                        setImagePickerOpen(true)
                      }
                    />
                  )}
                </>
              )}
            </>
          )}

          {!playlistDescriptionMode ? (
            <span className="ml-auto shrink-0 rounded-full bg-wk-bg-subtle px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              {viewMode === "preview"
                ? "Rendered"
                : viewMode}
            </span>
          ) : null}
        </div>
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

      {!playlistDescriptionMode ? (
        <>
          <FloatingImageToolbar editor={editor} />

          <ImageEditDialog
            open={!!imagePickerMeta}
            meta={
              imagePickerMeta ?? {
                src: "",
                alt: "",
                caption: "",
                title: "",
              }
            }
            onClose={() => setImagePickerMeta(null)}
            onSave={handleSaveImageMeta}
          />

          <MediaPickerModal
            open={imagePickerOpen}
            onClose={() => setImagePickerOpen(false)}
            onSelect={handleInsertImage}
            title="Insert Image"
          />
        </>
      ) : null}

      {/* Release Picker Modal */}
      <Modal
        open={releasePickerOpen}
        onClose={() => {
          setReleasePickerOpen(false);
          setReleaseSearch("");
        }}
        title={playlistDescriptionMode ? "Link EP or Album" : "Insert Release Shortcode"}
      >
              <input
                type="text"
                value={releaseSearch}
                onChange={(e) => setReleaseSearch(e.target.value)}
                placeholder="Search EPs and Albums by title or artist..."
                className="mb-3 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-3 text-[16px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] sm:py-2 sm:text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setReleasePickerOpen(false); setReleaseSearch(""); }
                }}
              />
              <div className="min-h-0 max-h-[50dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[320px]">
                {playlistDescriptionMode && playlistReleaseError ? (
                  <div className="py-6 text-center text-[12px] text-wk-danger">
                    {playlistReleaseError}
                  </div>
                ) : releasePickerLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-[var(--wk-text-faint)]">
                    <i className="ri-loader-4-line animate-spin text-[16px]" />
                    <span className="text-[12px]">Loading releases...</span>
                  </div>
                ) : filteredReleases.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-[var(--wk-text-faint)]">
                    {playlistDescriptionMode && releaseSearch.trim().length < 2
                      ? "Enter at least two characters to search EPs and Albums."
                      : releaseSearch.trim()
                        ? "No EPs or Albums match your search."
                        : "No EPs or Albums found yet."}
                  </div>
                ) : (
                  filteredReleases.map((release) => (
                    <button
                      key={release.id}
                      onClick={() => {
                        if (playlistDescriptionMode) {
                          const href = releaseUrl({
                            slug: release.slug,
                            artist: release.artistName,
                            artistSlug: release.artistSlug,
                            trackCount: release.trackCount,
                            releaseType: release.releaseType,
                          });

                          if (href === "/releases") {
                            return;
                          }

                          handleInsertRegistryLink(
                            release.title,
                            href,
                          );
                          setReleasePickerOpen(false);
                          setReleaseSearch("");
                          return;
                        }

                        handleInsertReleaseShortcode(
                          release.slug,
                        );
                      }}
                      disabled={
                        playlistDescriptionMode &&
                        releaseUrl({
                          slug: release.slug,
                          artist: release.artistName,
                          artistSlug: release.artistSlug,
                          trackCount: release.trackCount,
                          releaseType: release.releaseType,
                        }) === "/releases"
                      }
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-2.5 text-left transition-all cursor-pointer hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)] sm:gap-3 sm:p-3"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] sm:h-12 sm:w-12">
                        {release.artworkUrl ? (
                          <img src={release.artworkUrl} alt={release.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <i className="ri-album-line text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[13px] font-bold text-[var(--wk-text)]">{release.title}</div>
                        <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{release.artistName}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                          <span className="rounded-full bg-[var(--wk-brand-soft)]/40 px-1.5 py-0.5 text-[var(--wk-brand)] font-bold">{release.releaseType}</span>
                          <span>{release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}</span>
                        </div>
                      </div>
                      <i className="ri-add-circle-line text-[var(--wk-brand)] text-[18px] shrink-0" />
                    </button>
                  ))
                )}
              </div>
      </Modal>

      {/* Artist Picker Modal */}
      <Modal
        open={artistPickerOpen}
        onClose={() => {
          setArtistPickerOpen(false);
          setArtistSearch("");
        }}
        title={playlistDescriptionMode ? "Link Artist" : "Insert Artist Shortcode"}
      >
              <input
                type="text"
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                placeholder="Search artists by name or country..."
                className="mb-3 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-3 text-[16px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] sm:py-2 sm:text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setArtistPickerOpen(false); setArtistSearch(""); }
                }}
              />
              <div className="min-h-0 max-h-[50dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[320px]">
                {playlistDescriptionMode && playlistArtistError ? (
                  <div className="py-6 text-center text-[12px] text-wk-danger">
                    {playlistArtistError}
                  </div>
                ) : artistPickerLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-[var(--wk-text-faint)]">
                    <i className="ri-loader-4-line animate-spin text-[16px]" />
                    <span className="text-[12px]">Loading artists...</span>
                  </div>
                ) : filteredArtists.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-[var(--wk-text-faint)]">
                    {playlistDescriptionMode && artistSearch.trim().length < 2
                      ? "Enter at least two characters to search Artists."
                      : artistSearch.trim()
                        ? "No artists match your search."
                        : "No artists found yet."}
                  </div>
                ) : (
                  filteredArtists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => {
                        if (playlistDescriptionMode) {
                          handleInsertRegistryLink(
                            artist.name,
                            `/artists/${artist.slug}`,
                          );
                          setArtistPickerOpen(false);
                          setArtistSearch("");
                          return;
                        }

                        handleInsertArtistShortcode(
                          artist.slug,
                        );
                      }}
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-2.5 text-left transition-all cursor-pointer hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)] sm:gap-3 sm:p-3"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] sm:h-12 sm:w-12">
                        {artist.imageUrl ? (
                          <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <i className="ri-user-line text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[13px] font-bold text-[var(--wk-text)]">{artist.name}</div>
                        <div className="text-[11px] text-[var(--wk-text-muted)] truncate">
                          {[artist.country, ...artist.genres.slice(0, 2)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <i className="ri-add-circle-line text-[var(--wk-brand)] text-[18px] shrink-0" />
                    </button>
                  ))
                )}
              </div>
      </Modal>

      {/* Track Picker Modal */}
      <Modal
        open={trackPickerOpen}
        onClose={() => {
          setTrackPickerOpen(false);
          setTrackSearch("");
        }}
        title={playlistDescriptionMode ? "Link Track" : "Insert Track Shortcode"}
      >
              <input
                type="text"
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                placeholder="Search tracks by title or artist..."
                className="mb-3 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-3 text-[16px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] sm:py-2 sm:text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setTrackPickerOpen(false); setTrackSearch(""); }
                }}
              />
              <div className="min-h-0 max-h-[50dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[320px]">
                {playlistDescriptionMode && playlistTrackError ? (
                  <div className="py-6 text-center text-[12px] text-wk-danger">
                    {playlistTrackError}
                  </div>
                ) : trackPickerLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-[var(--wk-text-faint)]">
                    <i className="ri-loader-4-line animate-spin text-[16px]" />
                    <span className="text-[12px]">Loading tracks...</span>
                  </div>
                ) : filteredTracks.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-[var(--wk-text-faint)]">
                    {playlistDescriptionMode && trackSearch.trim().length < 2
                      ? "Enter at least two characters to search Tracks."
                      : trackSearch.trim()
                        ? "No tracks match your search."
                        : "No tracks found yet."}
                  </div>
                ) : (
                  filteredTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        if (playlistDescriptionMode) {
                          handleInsertRegistryLink(
                            track.title,
                            trackUrl(
                              track.slug,
                              track.artistSlug
                                ? [track.artistSlug]
                                : [],
                            ),
                          );
                          setTrackPickerOpen(false);
                          setTrackSearch("");
                          return;
                        }

                        handleInsertTrackShortcode(
                          track.slug,
                        );
                      }}
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-2.5 text-left transition-all cursor-pointer hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)] sm:gap-3 sm:p-3"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] sm:h-12 sm:w-12">
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <i className="ri-music-line text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[13px] font-bold text-[var(--wk-text)]">{track.title}</div>
                        <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{track.artist}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                          {track.genre && <span>{track.genre}</span>}
                          {track.isPlayable && (
                            <span className="rounded-full bg-[var(--wk-brand-soft)]/40 px-1.5 py-0.5 text-[var(--wk-brand)] font-bold">
                              Playable
                            </span>
                          )}
                        </div>
                      </div>
                      <i className="ri-add-circle-line text-[var(--wk-brand)] text-[18px] shrink-0" />
                    </button>
                  ))
                )}
              </div>
      </Modal>

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
              readOnly={readOnly}
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
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px] transition-all whitespace-nowrap ${
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