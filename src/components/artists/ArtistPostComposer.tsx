import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import { ArtistImageField } from "@/components/artists/ArtistImageField";
import {
  editArtistUpdate,
  publishArtistUpdate,
  type ArtistUpdate,
} from "@/services/artists/artistUpdates";

export function ArtistPostComposer({
  artistId,
  artistName,
  artistImageUrl,
  mediaUrls = [],
  editingUpdate = null,
  defaultOpen = false,
  onSaved,
  onCancelEdit,
  onError,
}: {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
  mediaUrls?: string[];
  editingUpdate?: ArtistUpdate | null;
  defaultOpen?: boolean;
  onSaved?: (update: ArtistUpdate) => void | Promise<void>;
  onCancelEdit?: () => void;
  onError?: (message: string) => void;
}) {
  const [open, setOpen] =
    useState(
      defaultOpen ||
      Boolean(editingUpdate),
    );
  const [body, setBody] =
    useState("");
  const [imageUrl, setImageUrl] =
    useState("");
  const [linkUrl, setLinkUrl] =
    useState("");
  const [linkLabel, setLinkLabel] =
    useState("");
  const [showImage, setShowImage] =
    useState(false);
  const [showLink, setShowLink] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const isEditing =
    Boolean(editingUpdate);

  useEffect(() => {
    if (!editingUpdate) {
      return;
    }

    setOpen(true);
    setBody(editingUpdate.body);
    setImageUrl(
      editingUpdate.imageUrl ?? "",
    );
    setLinkUrl(
      editingUpdate.linkUrl ?? "",
    );
    setLinkLabel(
      editingUpdate.linkLabel ?? "",
    );
    setShowImage(
      Boolean(
        editingUpdate.imageUrl,
      ),
    );
    setShowLink(
      Boolean(
        editingUpdate.linkUrl ||
        editingUpdate.linkLabel,
      ),
    );
  }, [
    editingUpdate,
  ]);

  const availableMedia =
    useMemo(
      () =>
        Array.from(
          new Set(
            [
              artistImageUrl ?? "",
              ...mediaUrls,
            ]
              .map((url) => url.trim())
              .filter(Boolean),
          ),
        ),
      [
        artistImageUrl,
        mediaUrls,
      ],
    );

  function reset() {
    setBody("");
    setImageUrl("");
    setLinkUrl("");
    setLinkLabel("");
    setShowImage(false);
    setShowLink(false);
    setError(null);
  }

  function closeComposer() {
    reset();
    setOpen(false);

    if (isEditing) {
      onCancelEdit?.();
    }
  }

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault();

    const cleanBody =
      body.trim();

    if (!cleanBody || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const saved =
        editingUpdate
          ? await editArtistUpdate({
              updateId:
                editingUpdate.id,
              body: cleanBody,
              imageUrl:
                imageUrl.trim(),
              linkUrl:
                linkUrl.trim(),
              linkLabel:
                linkLabel.trim(),
            })
          : await publishArtistUpdate({
              artistId,
              body: cleanBody,
              imageUrl:
                imageUrl.trim(),
              linkUrl:
                linkUrl.trim(),
              linkLabel:
                linkLabel.trim(),
            });

      reset();
      setOpen(false);
      await onSaved?.(saved);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : isEditing
            ? "We could not save this post."
            : "We could not publish this post.";

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
        onClick={() =>
          setOpen(true)
        }
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-left transition hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-bg)]"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)]">
          {artistImageUrl ? (
            <img
              src={artistImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[13px] font-black text-[var(--wk-brand)]">
              {artistName[0]?.toUpperCase() || "A"}
            </div>
          )}
        </div>

        <span className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--wk-text-muted)]">
          Share an update from {artistName}...
        </span>

        <span className="hidden items-center gap-2 sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <WkIcon
              name="Image"
              size={16}
            />
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-bg)] text-[var(--wk-text-muted)]">
            <WkIcon
              name="Link2"
              size={16}
            />
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] bg-[var(--wk-surface)] sm:static sm:z-auto sm:rounded-3xl sm:border sm:border-[var(--wk-border)]">
      <form
        onSubmit={submit}
        className="flex h-full min-h-0 flex-col sm:h-auto"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--wk-divider)] px-4 sm:h-auto sm:border-b-0 sm:px-5 sm:pt-5">
          <button
            type="button"
            onClick={closeComposer}
            aria-label="Close Post Composer"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text)] hover:bg-[var(--wk-bg)]"
          >
            <WkIcon
              name="X"
              size={20}
            />
          </button>

          <h3 className="text-[16px] font-black text-[var(--wk-text)] sm:hidden">
            {isEditing
              ? "Edit Post"
              : "Create Post"}
          </h3>

          <button
            type="submit"
            disabled={
              busy ||
              !body.trim()
            }
            className="rounded-full bg-[var(--wk-brand)] px-5 py-2 text-[12px] font-black text-[var(--wk-brand-on)] disabled:opacity-40 sm:hidden"
          >
            {busy
              ? "Posting..."
              : isEditing
                ? "Save"
                : "Post"}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:block sm:px-5 sm:pb-5 sm:pt-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-brand-soft)]">
              {artistImageUrl ? (
                <img
                  src={artistImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] font-black text-[var(--wk-brand)]">
                  {artistName[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>

            <div>
              <div className="text-[13px] font-black text-[var(--wk-text)]">
                {artistName}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">
                Official Artist
              </div>
            </div>
          </div>

          <textarea
            autoFocus
            value={body}
            onChange={(event) =>
              setBody(
                event.target.value,
              )
            }
            rows={7}
            maxLength={2000}
            placeholder={`What do you want people following ${artistName} to know?`}
            className="mt-4 min-h-[220px] w-full flex-1 resize-none border-0 bg-transparent p-0 text-[18px] font-medium leading-[1.55] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)] sm:min-h-[160px] sm:text-[17px]"
          />

          {showImage && (
            <div className="mt-4">
              <ArtistImageField
                artistId={artistId}
                label="Photo"
                value={imageUrl}
                onChange={setImageUrl}
                libraryUrls={availableMedia}
                variant="content"
                helper="Upload a new photo or choose media already used by this Artist."
              />
            </div>
          )}

          {showLink && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                  Link
                </span>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(event) =>
                    setLinkUrl(
                      event.target.value,
                    )
                  }
                  placeholder="https://"
                  className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                  Link Label
                </span>
                <input
                  value={linkLabel}
                  onChange={(event) =>
                    setLinkLabel(
                      event.target.value,
                    )
                  }
                  maxLength={120}
                  placeholder="Listen, read, RSVP"
                  className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)]"
                />
              </label>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--wk-divider)] px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowImage(
                  (current) => !current,
                )
              }
              className={`flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-black ${
                showImage
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
              }`}
            >
              <WkIcon
                name="Image"
                size={17}
              />
              Photo
            </button>

            <button
              type="button"
              onClick={() =>
                setShowLink(
                  (current) => !current,
                )
              }
              className={`flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-black ${
                showLink
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
              }`}
            >
              <WkIcon
                name="Link2"
                size={17}
              />
              Link
            </button>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={closeComposer}
              className="rounded-full px-4 py-2 text-[11px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                busy ||
                !body.trim()
              }
              className="rounded-full bg-[var(--wk-brand)] px-5 py-2 text-[11px] font-black text-[var(--wk-brand-on)] disabled:opacity-40"
            >
              {busy
                ? "Posting..."
                : isEditing
                  ? "Save Post"
                  : "Post"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
