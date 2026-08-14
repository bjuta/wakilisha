import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import {
  MetaTags,
} from "@/components/seo/MetaTags";
import {
  WkButton,
} from "@/components/design-system/primitives/Button";
import {
  ShareSheet,
  type ShareObject,
} from "@/components/design-system/share/ShareSheet";
import {
  getArtistUpdate,
  type PublicArtistUpdate,
} from "@/services/artists/artistUpdates";

const PUBLIC_ORIGIN =
  "https://wakilisha.africa";

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}

export default function ArtistUpdatePage() {
  const {
    slug,
    updateId,
  } = useParams<{
    slug: string;
    updateId: string;
  }>();

  const [
    update,
    setUpdate,
  ] = useState<
    PublicArtistUpdate | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    shareOpen,
    setShareOpen,
  ] = useState(false);

  useEffect(() => {
    let alive = true;

    if (
      !slug ||
      !updateId
    ) {
      setError(
        "Artist Update not found.",
      );
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);

    getArtistUpdate(
      updateId,
    )
      .then(
        (nextUpdate) => {
          if (!alive) {
            return;
          }

          if (
            nextUpdate.artist.slug !==
            slug
          ) {
            setError(
              "Artist Update not found.",
            );
            setUpdate(null);
            return;
          }

          setUpdate(
            nextUpdate,
          );
        },
      )
      .catch(
        (nextError) => {
          if (!alive) {
            return;
          }

          setError(
            nextError instanceof Error
              ? nextError.message
              : "Artist Update not found.",
          );
          setUpdate(null);
        },
      )
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [
    slug,
    updateId,
  ]);

  const shareItem =
    useMemo<
      ShareObject | null
    >(
      () =>
        update
          ? {
              title:
                `Update from ${update.artist.displayName}`,
              subtitle:
                update.artist.displayName,
              description:
                update.body,
              imageUrl:
                update.imageUrl,
              url:
                new URL(
                  update.canonicalPath,
                  PUBLIC_ORIGIN,
                ).toString(),
              type:
                "artist_update",
            }
          : null,
      [update],
    );

  if (loading) {
    return (
      <main className="wk-container px-6 py-20">
        <p className="text-[14px] text-[var(--wk-text-muted)]">
          Loading Artist Update…
        </p>
      </main>
    );
  }

  if (
    error ||
    !update
  ) {
    return (
      <main className="wk-container px-6 py-20">
        <MetaTags
          title="Artist Update"
          robots="noindex,nofollow"
        />
        <h1 className="text-[28px] font-black text-[var(--wk-text)]">
          Artist Update Not Found
        </h1>
        <p className="mt-2 text-[14px] text-[var(--wk-text-muted)]">
          This update may have been withdrawn or is no longer available.
        </p>
        {slug && (
          <Link
            to={`/artists/${slug}`}
            className="mt-6 inline-block"
          >
            <WkButton variant="soft">
              Back to Artist
            </WkButton>
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <MetaTags
        title={`Update from ${update.artist.displayName}`}
        description={update.body}
        robots="noindex,follow"
      />

      <article className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-0 md:py-14">
        <header className="flex items-center gap-3">
          <Link
            to={`/artists/${update.artist.slug}`}
            className="shrink-0"
            aria-label={update.artist.displayName}
          >
            {update.artist.imageUrl ? (
              <img
                src={update.artist.imageUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[12px] font-black text-[var(--wk-brand)]">
                {update.artist.displayName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(
                    (part) =>
                      part[0]?.toUpperCase() ||
                      "",
                  )
                  .join("")}
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link
              to={`/artists/${update.artist.slug}`}
              className="truncate text-[15px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
            >
              {update.artist.displayName}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
              <span>
                Official Artist Update
              </span>
              <span aria-hidden="true">
                ·
              </span>
              <time dateTime={update.publishedAt}>
                {formatDate(
                  update.publishedAt,
                )}
              </time>
            </div>
          </div>

          <WkButton
            variant="soft"
            onClick={() =>
              setShareOpen(true)
            }
          >
            Share
          </WkButton>
        </header>

        {update.imageUrl && (
          <div className="mt-6 overflow-hidden rounded-[28px] bg-[var(--wk-surface-raised)]">
            <img
              src={update.imageUrl}
              alt=""
              className="max-h-[760px] w-full object-cover"
            />
          </div>
        )}

        <p className="mt-6 whitespace-pre-wrap text-[20px] font-semibold leading-[1.55] tracking-[-0.015em] text-[var(--wk-text)] md:text-[24px]">
          {update.body}
        </p>

        {update.linkUrl && (
          <a
            href={update.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 py-2.5 text-[12px] font-black text-[var(--wk-text)] transition-colors hover:border-[var(--wk-border-2)] hover:text-[var(--wk-brand)]"
          >
            <span>
              {update.linkLabel ||
                "Open Link"}
            </span>
            <i
              className="ri-external-link-line"
              aria-hidden="true"
            />
          </a>
        )}

        <div className="mt-10 border-t border-[var(--wk-divider)] pt-5">
          <Link
            to={`/artists/${update.artist.slug}`}
            className="text-[12px] font-black text-[var(--wk-brand)] hover:underline"
          >
            Back to {update.artist.displayName}
          </Link>
        </div>
      </article>

      {shareItem && (
        <ShareSheet
          open={shareOpen}
          onClose={() =>
            setShareOpen(false)
          }
          item={shareItem}
        />
      )}
    </main>
  );
}
