import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { Portal } from "@/components/base/Portal";
import { useScrollLock } from "@/hooks/useScrollLock";
import { QuotedPostCard } from "@/components/community/QuotedPostCard";
import { PostLinkAttachment } from "@/components/community/PostLinkAttachment";
import {
  extractPostLinkFromText,
  normalizePostLinkUrl,
} from "@/services/community/postLinkPreview";
import { PostTrackAttachment } from "@/components/community/PostTrackAttachment";
import { PostTrackPicker } from "@/components/community/PostTrackPicker";
import {
  editPost,
  publishPost,
  quotePost,
  type CommunityPost,
  type CommunityQuotedPost,
  type PostActor,
  type PostTrack,
} from "@/services/community/posts";
import { uploadPostImage } from "@/services/community/postMedia";

export function PostComposer({
  actor,
  editingPost = null,
  quotedPost = null,
  defaultOpen = false,
  onSaved,
  onCancelEdit,
  onError,
}: {
  actor: PostActor;
  editingPost?: CommunityPost | null;
  quotedPost?: CommunityPost | null;
  defaultOpen?: boolean;
  onSaved?: (post: CommunityPost) => void | Promise<void>;
  onCancelEdit?: () => void;
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(
    defaultOpen || Boolean(editingPost) || Boolean(quotedPost),
  );
  const [mobileComposerViewport, setMobileComposerViewport] =
    useState(() =>
      typeof window !== "undefined"
      && window.matchMedia("(max-width: 639px)").matches,
    );
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<PostTrack | null>(null);
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(editingPost);
  const isQuoting = Boolean(quotedPost);
  const hasContent = Boolean(
    body.trim() ||
    imageUrl.trim() ||
    linkUrl.trim() ||
    selectedTrack,
  );

  const quotePresentation: CommunityQuotedPost | null =
    quotedPost
      ? {
          id: quotedPost.id,
          available: true,
          unavailableReason: null,
          actorType: quotedPost.actor.type,
          actor: quotedPost.actor,
          body: quotedPost.body,
          imageUrl: quotedPost.imageUrl,
          linkUrl: quotedPost.linkUrl,
          linkLabel: quotedPost.linkLabel,
          track: quotedPost.track,
          publishedAt: quotedPost.publishedAt,
          canonicalPath: quotedPost.canonicalPath,
        }
      : editingPost?.quotedPost ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => {
      setMobileComposerViewport(media.matches);
    };

    sync();
    media.addEventListener("change", sync);

    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  useScrollLock(open && mobileComposerViewport);

  useEffect(() => {
    if (!editingPost) return;
    setOpen(true);
    setBody(editingPost.body);
    setImageUrl(editingPost.imageUrl ?? "");
    setLinkUrl(editingPost.linkUrl ?? "");
    setLinkLabel(editingPost.linkLabel ?? "");
    setSelectedTrack(editingPost.track);
  }, [editingPost]);

  function reset() {
    setBody("");
    setImageUrl("");
    setLinkUrl("");
    setLinkLabel("");
    setSelectedTrack(null);
    setTrackPickerOpen(false);
    setError(null);
  }

  function close() {
    reset();
    setOpen(false);
    if (isEditing || isQuoting) onCancelEdit?.();
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      setImageUrl(await uploadPostImage(actor, file));
    } catch (nextError) {
      const message = nextError instanceof Error
        ? nextError.message
        : "Image upload failed.";
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  }

  function promoteBodyLink(
    nextBody: string,
    requireTerminator: boolean,
  ): boolean {
    if (linkUrl.trim()) return false;

    const extracted = extractPostLinkFromText(
      nextBody,
      requireTerminator,
    );
    if (!extracted) return false;

    setBody(extracted.body);
    setLinkUrl(extracted.linkUrl);
    setLinkLabel("");
    return true;
  }

  function handleBodyChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    const nextBody = event.target.value;
    if (promoteBodyLink(nextBody, true)) return;
    setBody(nextBody);
  }

  function handleBodyBlur() {
    void promoteBodyLink(body, false);
  }

  function handleBodyPaste(
    event: ClipboardEvent<HTMLTextAreaElement>,
  ) {
    if (linkUrl.trim()) return;

    const extracted = extractPostLinkFromText(
      event.clipboardData.getData("text/plain"),
      false,
    );
    if (!extracted) return;

    event.preventDefault();

    const target = event.currentTarget;
    const start =
      target.selectionStart ?? body.length;
    const end =
      target.selectionEnd ?? start;

    const nextBody =
      `${body.slice(0, start)}${extracted.body}${body.slice(end)}`;

    setBody(nextBody);
    setLinkUrl(extracted.linkUrl);
    setLinkLabel("");
  }

  function removeLinkAttachment() {
    setLinkUrl("");
    setLinkLabel("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!hasContent || busy || uploading) return;

    setBusy(true);
    setError(null);
    try {
      const saved = editingPost
        ? await editPost({
            postId: editingPost.id,
            body: cleanBody,
            imageUrl: imageUrl.trim(),
            linkUrl: linkUrl.trim(),
            linkLabel: linkLabel.trim(),
            registryTrackId: selectedTrack?.id ?? null,
          })
        : quotedPost
          ? await quotePost({
              actor,
              quotedPostId: quotedPost.id,
              body: cleanBody,
              imageUrl: imageUrl.trim(),
              linkUrl: linkUrl.trim(),
              linkLabel: linkLabel.trim(),
              registryTrackId: selectedTrack?.id ?? null,
            })
          : await publishPost({
              actor,
              body: cleanBody,
              imageUrl: imageUrl.trim(),
              linkUrl: linkUrl.trim(),
              linkLabel: linkLabel.trim(),
              registryTrackId: selectedTrack?.id ?? null,
            });

      reset();
      setOpen(false);
      await onSaved?.(saved);
    } catch (nextError) {
      const message = nextError instanceof Error
        ? nextError.message
        : "We could not save this Post.";
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-left transition hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-bg)]"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)]">
          {actor.imageUrl ? (
            <img src={actor.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[13px] font-black text-[var(--wk-brand)]">
              {actor.name[0]?.toUpperCase() || "W"}
            </div>
          )}
        </div>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--wk-text-muted)]">
          Share something as {actor.name}...
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <WkIcon name="Image" size={16} />
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-bg)] text-[var(--wk-text-muted)]">
            <WkIcon name="Music" size={16} />
          </span>
        </span>
      </button>
    );
  }

  const composerSurface = (
    <div
      role={mobileComposerViewport ? "dialog" : undefined}
      aria-modal={mobileComposerViewport ? true : undefined}
      aria-label={
        mobileComposerViewport
          ? isEditing
            ? "Edit Post"
            : isQuoting
              ? "Quote Post"
              : "Create Post"
          : undefined
      }
      className="fixed inset-0 z-[160] h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--wk-surface)] sm:static sm:h-auto sm:max-h-none sm:overflow-visible sm:rounded-3xl sm:border sm:border-[var(--wk-border)]"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col overflow-hidden sm:h-auto sm:overflow-visible">
        <div className="grid min-h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--wk-divider)] px-3 pt-[env(safe-area-inset-top)] sm:flex sm:h-auto sm:min-h-0 sm:items-center sm:justify-between sm:border-b-0 sm:px-5 sm:pt-5">
          <button
            type="button"
            onClick={close}
            aria-label="Close Post Composer"
            className="flex h-9 w-9 items-center justify-center justify-self-start rounded-full hover:bg-[var(--wk-bg)]"
          >
            <WkIcon name="X" size={19} />
          </button>

          <h3 className="justify-self-center text-[15px] font-black sm:hidden">
            {isEditing ? "Edit Post" : isQuoting ? "Quote Post" : "Create Post"}
          </h3>

          <button
            type="submit"
            disabled={busy || uploading || !hasContent}
            className="justify-self-end rounded-full bg-[var(--wk-brand)] px-4 py-1.5 text-[11px] font-black text-[var(--wk-brand-on)] disabled:opacity-40 sm:hidden"
          >
            {busy ? "Posting..." : isEditing ? "Save" : isQuoting ? "Quote" : "Post"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:overflow-visible sm:px-5 sm:pb-5 sm:pt-1">
          <div className="flex gap-3 sm:block">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)] sm:hidden">
              {actor.imageUrl ? (
                <img src={actor.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] font-black text-[var(--wk-brand)]">
                  {actor.name[0]?.toUpperCase() || "W"}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-2 sm:hidden">
                <span className="truncate text-[13px] font-black">
                  {actor.name}
                </span>
                <span className="truncate text-[11px] font-semibold text-[var(--wk-text-faint)]">
                  @{actor.slug}
                </span>
              </div>

              <div className="hidden items-center gap-3 sm:flex">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)]">
                  {actor.imageUrl ? (
                    <img src={actor.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[12px] font-black text-[var(--wk-brand)]">
                      {actor.name[0]?.toUpperCase() || "W"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[13px] font-black">{actor.name}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">
                    {actor.type === "artist"
                      ? actor.official ? "Official Artist" : "Artist"
                      : `@${actor.slug}`}
                  </div>
                </div>
              </div>

              <textarea
                autoFocus
                value={body}
                onChange={handleBodyChange}
                onBlur={handleBodyBlur}
                onPaste={handleBodyPaste}
                rows={4}
                maxLength={2000}
                placeholder="What's happening?"
                className="mt-2 min-h-[96px] max-h-[32dvh] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[17px] font-medium leading-[1.5] outline-none placeholder:text-[var(--wk-text-faint)] sm:mt-4 sm:min-h-[160px] sm:max-h-none sm:text-[17px]"
              />

              <div className="mt-1 flex items-center gap-1 border-t border-[var(--wk-divider)] pt-2 sm:hidden">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  aria-label="Add Photo"
                  title="Photo"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] disabled:opacity-50"
                >
                  <WkIcon name="Image" size={19} />
                </button>


                <button
                  type="button"
                  onClick={() => setTrackPickerOpen(true)}
                  aria-label="Add Track"
                  title="Track"
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    selectedTrack
                      ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]"
                  }`}
                >
                  <WkIcon name="Music" size={19} />
                </button>

                {uploading && (
                  <span className="ml-1 text-[10px] font-semibold text-[var(--wk-text-muted)]">
                    Uploading...
                  </span>
                )}
              </div>
            </div>
          </div>

          {imageUrl && (
            <div className="relative ml-[52px] mt-3 max-w-xl overflow-hidden rounded-2xl border border-[var(--wk-border)] sm:ml-0 sm:mt-4">
              <img src={imageUrl} alt="" className="aspect-video w-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                aria-label="Remove Photo"
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white"
              >
                <WkIcon name="X" size={16} />
              </button>
            </div>
          )}

          {selectedTrack && (
            <div className="relative ml-[52px] mt-3 sm:ml-0 sm:mt-4">
              <PostTrackAttachment
                track={selectedTrack}
                compact
                showActions={false}
              />
              <button
                type="button"
                onClick={() => setSelectedTrack(null)}
                aria-label="Remove Track"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-surface)] text-[var(--wk-text-muted)] shadow-sm hover:text-[var(--wk-text)]"
              >
                <WkIcon name="X" size={14} />
              </button>
            </div>
          )}

          {linkUrl.trim() ? (
            <div className="relative ml-[52px] mt-3 sm:ml-0 sm:mt-4">
              <PostLinkAttachment
                linkUrl={linkUrl.trim()}
                linkLabel={linkLabel.trim() || null}
                interactive={false}
                className="block"
              />
              <button
                type="button"
                onClick={removeLinkAttachment}
                aria-label="Remove Link"
                title="Remove Link"
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wk-brand)]"
              >
                <WkIcon name="X" size={19} />
              </button>
            </div>
          ) : null}

                    {quotePresentation && (
            <QuotedPostCard
              quotedPost={quotePresentation}
              className="ml-[52px] mt-3 sm:ml-0 sm:mt-4"
            />
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhoto}
            className="hidden"
          />

          {error && (
            <div className="ml-[52px] mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 sm:ml-0 sm:mt-4">
              {error}
            </div>
          )}
        </div>

        <div className="hidden shrink-0 border-t border-[var(--wk-divider)] px-5 py-3 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)] disabled:opacity-50"
            >
              <WkIcon name="Image" size={17} />
              {uploading ? "Uploading..." : "Photo"}
            </button>


            <button
              type="button"
              onClick={() => setTrackPickerOpen(true)}
              className={`flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-black ${
                selectedTrack
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
              }`}
            >
              <WkIcon name="Music" size={17} />
              Track
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-full px-4 py-2 text-[11px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy || uploading || !hasContent}
              className="rounded-full bg-[var(--wk-brand)] px-5 py-2 text-[11px] font-black text-[var(--wk-brand-on)] disabled:opacity-40"
            >
              {busy ? "Posting..." : isEditing ? "Save Post" : isQuoting ? "Quote Post" : "Post"}
            </button>
          </div>
        </div>
      </form>

      {trackPickerOpen ? (
        <PostTrackPicker
          selectedTrackId={selectedTrack?.id}
          onSelect={(track) => {
            setSelectedTrack(track);
            setTrackPickerOpen(false);
          }}
          onClose={() => setTrackPickerOpen(false)}
        />
      ) : null}
    </div>
  );

  return mobileComposerViewport
    ? <Portal>{composerSurface}</Portal>
    : composerSurface;
}
