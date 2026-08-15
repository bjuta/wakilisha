import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  uploadArtistImage,
} from "@/services/artists/artistMedia";

type ArtistImageFieldVariant =
  | "profile"
  | "cover"
  | "content";

export function ArtistImageField({
  artistId,
  label,
  value,
  onChange,
  libraryUrls = [],
  variant = "content",
  helper,
}: {
  artistId: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  libraryUrls?: string[];
  variant?: ArtistImageFieldVariant;
  helper?: string;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);
  const [uploading, setUploading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] =
    useState(false);

  const availableMedia = useMemo(
    () =>
      Array.from(
        new Set(
          [
            value,
            ...libraryUrls,
          ]
            .map((url) => url.trim())
            .filter(Boolean),
        ),
      ),
    [libraryUrls, value],
  );

  const previewClass =
    variant === "cover"
      ? "aspect-[8/3] min-h-[170px] w-full rounded-2xl"
      : variant === "profile"
        ? "h-32 w-32 rounded-2xl"
        : "aspect-video w-full max-w-xl rounded-2xl";

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const url =
        await uploadArtistImage(
          artistId,
          file,
        );

      onChange(url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Image upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
        {label}
      </div>

      <div className="flex flex-col gap-4">
        <div
          className={`${previewClass} relative overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]`}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[120px] w-full items-center justify-center">
              <WkIcon
                name="Image"
                size={30}
                className="text-[var(--wk-text-faint)]"
              />
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[12px] font-black text-white">
              Uploading...
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() =>
              inputRef.current?.click()
            }
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 text-[11px] font-black text-[var(--wk-brand-on)] disabled:opacity-50"
          >
            <WkIcon
              name="Upload"
              size={14}
            />
            {value
              ? "Change Image"
              : "Upload Image"}
          </button>

          {availableMedia.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setLibraryOpen(true)
              }
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 text-[11px] font-black text-[var(--wk-text)]"
            >
              <WkIcon
                name="Images"
                size={14}
              />
              Choose From Your Media
            </button>
          )}

          {value && (
            <button
              type="button"
              onClick={() =>
                onChange("")
              }
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-danger)]"
            >
              <WkIcon
                name="Trash2"
                size={14}
              />
              Remove
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          className="hidden"
        />

        <p className="text-[10px] leading-4 text-[var(--wk-text-faint)]">
          {helper ||
            "JPG, PNG, or WebP. Max 8MB."}
        </p>

        {error && (
          <p className="text-[11px] font-bold text-[var(--wk-danger)]">
            {error}
          </p>
        )}
      </div>

      {libraryOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
          onClick={() =>
            setLibraryOpen(false)
          }
        >
          <div
            className="w-full max-w-3xl rounded-t-3xl bg-[var(--wk-surface)] p-6 shadow-2xl sm:rounded-3xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">
                  Your Media
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--wk-text-muted)]">
                  Choose an image already used by this Artist.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setLibraryOpen(false)
                }
                aria-label="Close Media Picker"
                className="text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
              >
                <WkIcon
                  name="X"
                  size={20}
                />
              </button>
            </div>

            <div className="mt-5 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {availableMedia.map(
                (url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      onChange(url);
                      setLibraryOpen(false);
                    }}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      value === url
                        ? "border-[var(--wk-brand)] ring-2 ring-[var(--wk-brand)]/20"
                        : "border-[var(--wk-border)] hover:border-[var(--wk-brand)]"
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    <div className="px-3 py-2 text-[10px] font-bold text-[var(--wk-text-muted)]">
                      {value === url
                        ? "Selected"
                        : "Use Image"}
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
