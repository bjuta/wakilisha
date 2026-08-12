import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { MetaTags } from "@/components/seo/MetaTags";
import { PlaylistCoverPresentation } from "@/components/media/PlaylistCoverPresentation";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  followingFeedCursorFrom,
  getFollowingFeed,
  getUserFollowing,
  getUserSaves,
  setSavedState,
  type FollowingFeedItem,
  type FollowingFeedReason,
} from "@/services/community";
import {
  buildCommunityAuthUrl,
} from "@/services/community/authIntent";
import type {
  FollowingPresentationItem,
} from "@/services/community/followingPresentation";

const PAGE_SIZE = 12;
const PUBLIC_ORIGIN = "https://wakilisha.africa";

type MatureFollow =
  FollowingPresentationItem & {
    targetType: "person" | "artist";
  };

type ActivitySubject = {
  key: string;
  targetType: "person" | "artist";
  title: string;
  imageUrl: string | null;
  canonicalPath: string;
};

type ActivityAnchor =
  ActivitySubject & {
    count: number;
  };

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();
  return clean || null;
}

function subjectKey(
  type: "person" | "artist",
  id: string,
): string {
  return `${type}:${id}`;
}

function itemKey(
  item: FollowingFeedItem,
): string {
  return `${item.itemType}:${item.itemId}`;
}

function itemSlug(
  item: FollowingFeedItem,
): string {
  const segments =
    item.canonicalPath
      .split("/")
      .filter(Boolean);

  return (
    segments[segments.length - 1] ||
    item.itemKey
  );
}

function titleFromSlug(
  slug: string | null,
  fallback: string,
): string {
  if (!slug) {
    return fallback;
  }

  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    ) || fallback;
}

function fallbackSubject(
  reason: FollowingFeedReason,
): ActivitySubject {
  const title =
    titleFromSlug(
      reason.targetSlug,
      reason.targetType === "person"
        ? "Person you follow"
        : "Artist you follow",
    );

  return {
    key:
      subjectKey(
        reason.targetType,
        reason.targetId,
      ),
    targetType:
      reason.targetType,
    title,
    imageUrl: null,
    canonicalPath:
      reason.targetSlug
        ? reason.targetType === "person"
          ? `/people/${reason.targetSlug}`
          : `/artists/${reason.targetSlug}`
        : "#",
  };
}

function formatPublishedAt(
  publishedAt: string,
): string {
  const date =
    new Date(publishedAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year:
        date.getFullYear() ===
        new Date().getFullYear()
          ? undefined
          : "numeric",
    },
  );
}

function activityLabel(
  item: FollowingFeedItem,
): string {
  if (item.itemType === "article") {
    return "WAKILISHA Article";
  }

  if (item.itemType === "playlist") {
    return "WAKILISHA Playlist";
  }

  return "Release";
}

function readSavedKeys(
  rows: unknown[],
): Set<string> {
  const keys =
    rows.flatMap(
      (row) => {
        const record =
          asRecord(row);

        if (!record) {
          return [];
        }

        const type =
          readString(
            record,
            "entity_type",
          );

        const id =
          readString(
            record,
            "entity_id",
          );

        if (
          !type ||
          !id
        ) {
          return [];
        }

        return [
          `${type}:${id}`,
        ];
      },
    );

  return new Set(keys);
}

function initials(
  title: string,
): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) =>
        word[0]?.toUpperCase() || "",
    )
    .join("") || "WK";
}

function ActivitySubjectAvatar({
  subject,
}: {
  subject: ActivitySubject;
}) {
  if (subject.imageUrl) {
    return (
      <img
        src={subject.imageUrl}
        alt=""
        className="h-11 w-11 rounded-full object-cover md:h-12 md:w-12"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[12px] font-black text-[var(--wk-brand)] md:h-12 md:w-12">
      {initials(subject.title)}
    </div>
  );
}

function ActivityAnchorAvatar({
  subject,
  active,
}: {
  subject: ActivityAnchor;
  active: boolean;
}) {
  return (
    <div
      className={`relative rounded-full p-[3px] transition-colors ${
        active
          ? "bg-[var(--wk-brand)]"
          : "bg-[var(--wk-border)]"
      }`}
    >
      <div className="rounded-full bg-[var(--wk-bg)] p-[2px]">
        {subject.imageUrl ? (
          <img
            src={subject.imageUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover md:h-[60px] md:w-[60px]"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[12px] font-black text-[var(--wk-brand)] md:h-[60px] md:w-[60px]">
            {initials(subject.title)}
          </div>
        )}
      </div>

      {subject.count > 1 && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--wk-bg)] bg-[var(--wk-text)] px-1 text-[9px] font-black text-[var(--wk-bg)]">
          {subject.count}
        </span>
      )}
    </div>
  );
}

function ActivityMedia({
  item,
}: {
  item: FollowingFeedItem;
}) {
  const slug =
    itemSlug(item);

  if (item.itemType === "playlist") {
    return (
      <div className="mx-auto aspect-square w-full max-w-[680px] overflow-hidden bg-[var(--wk-surface-raised)] md:rounded-[28px]">
        <PlaylistCoverPresentation
          src={item.imageUrl}
          altText={item.title}
          slug={slug}
          title={item.title}
          loading="lazy"
        />
      </div>
    );
  }

  const shape =
    item.itemType === "release"
      ? "mx-auto aspect-square w-full max-w-[680px]"
      : "aspect-[4/3] w-full md:aspect-[16/10]";

  return (
    <div
      className={`${shape} overflow-hidden bg-[var(--wk-surface-raised)] md:rounded-[28px]`}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
        />
      ) : (
        <Ch19GradientImage
          slug={slug}
          name={item.title}
        />
      )}
    </div>
  );
}

function ActivityAction({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[12px] font-bold transition-colors ${
        active
          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
      } disabled:cursor-wait disabled:opacity-55`}
    >
      <i
        className={`${icon} text-[17px]`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}

function FollowingActivity({
  item,
  subjectLookup,
  saved,
  saving,
  shared,
  onToggleSave,
  onShare,
}: {
  item: FollowingFeedItem;
  subjectLookup: Map<string, MatureFollow>;
  saved: boolean;
  saving: boolean;
  shared: boolean;
  onToggleSave: (
    item: FollowingFeedItem,
    subject: ActivitySubject,
  ) => void;
  onShare: (
    item: FollowingFeedItem,
  ) => void;
}) {
  const subjects =
    item.matchedFollows.map(
      (reason) => {
        const presentation =
          subjectLookup.get(
            subjectKey(
              reason.targetType,
              reason.targetId,
            ),
          );

        if (!presentation) {
          return fallbackSubject(reason);
        }

        return {
          key:
            subjectKey(
              presentation.targetType,
              presentation.targetId,
            ),
          targetType:
            presentation.targetType,
          title:
            presentation.title,
          imageUrl:
            presentation.imageUrl,
          canonicalPath:
            presentation.canonicalPath,
        } satisfies ActivitySubject;
      },
    );

  const primarySubject =
    subjects[0] ?? {
      key: "unknown",
      targetType: "person" as const,
      title: "Someone you follow",
      imageUrl: null,
      canonicalPath: "#",
    };

  const extraSubjects =
    subjects.slice(1);

  return (
    <article
      data-following-activity
      data-following-subjects={subjects
        .map((subject) => subject.key)
        .join(" ")}
      className="scroll-mt-24 border-b border-[var(--wk-divider)] py-7 first:pt-0 md:py-11"
    >
      <div className="px-4 md:px-0">
        <div className="flex items-center gap-3">
          {primarySubject.canonicalPath === "#" ? (
            <ActivitySubjectAvatar
              subject={primarySubject}
            />
          ) : (
            <Link
              to={primarySubject.canonicalPath}
              aria-label={primarySubject.title}
              className="shrink-0"
            >
              <ActivitySubjectAvatar
                subject={primarySubject}
              />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {primarySubject.canonicalPath === "#" ? (
                <span className="truncate text-[14px] font-black text-[var(--wk-text)] md:text-[15px]">
                  {primarySubject.title}
                </span>
              ) : (
                <Link
                  to={primarySubject.canonicalPath}
                  className="truncate text-[14px] font-black text-[var(--wk-text)] transition-colors hover:text-[var(--wk-brand)] md:text-[15px]"
                >
                  {primarySubject.title}
                </Link>
              )}

              {extraSubjects.length > 0 && (
                <span className="text-[11px] font-bold text-[var(--wk-text-faint)]">
                  +{extraSubjects.length} more you follow
                </span>
              )}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)] md:text-[12px]">
              <span>{activityLabel(item)}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={item.publishedAt}>
                {formatPublishedAt(item.publishedAt)}
              </time>
            </div>
          </div>
        </div>
      </div>

      <Link
        to={item.canonicalPath}
        aria-label={item.title}
        className="group mt-4 block overflow-hidden md:mt-5"
      >
        <ActivityMedia item={item} />
      </Link>

      <div className="px-4 pt-4 md:px-0 md:pt-5">
        <h2 className="text-[22px] font-black leading-[1.02] tracking-[-0.035em] text-[var(--wk-text)] md:text-[30px]">
          <Link
            to={item.canonicalPath}
            className="transition-colors hover:text-[var(--wk-brand)]"
          >
            {item.title}
          </Link>
        </h2>

        {item.summary && (
          <p className="mt-2 line-clamp-2 max-w-[680px] text-[13px] leading-relaxed text-[var(--wk-text-muted)] md:mt-3 md:text-[14px] md:line-clamp-3">
            {item.summary}
          </p>
        )}

        <div
          data-following-actions
          className="mt-3 flex items-center gap-1 border-t border-[var(--wk-divider)] pt-2 md:mt-4"
        >
          <ActivityAction
            icon={
              saved
                ? "ri-bookmark-fill"
                : "ri-bookmark-line"
            }
            label={
              saved
                ? "Saved"
                : "Save"
            }
            active={saved}
            disabled={saving}
            onClick={() =>
              onToggleSave(
                item,
                primarySubject,
              )
            }
          />

          <ActivityAction
            icon={
              shared
                ? "ri-check-line"
                : "ri-share-forward-line"
            }
            label={
              shared
                ? "Copied"
                : "Share"
            }
            active={shared}
            onClick={() =>
              onShare(item)
            }
          />

          <span
            data-following-reaction-slot="reserved"
            className="sr-only"
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      {Array.from({ length: 3 }).map(
        (_, index) => (
          <div
            key={index}
            className="border-b border-[var(--wk-divider)] py-8 first:pt-0 md:py-11"
          >
            <div className="flex items-center gap-3 px-4 md:px-0">
              <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--wk-surface-raised)]" />
              <div className="space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--wk-surface-raised)]" />
                <div className="h-2.5 w-44 animate-pulse rounded bg-[var(--wk-surface-raised)]" />
              </div>
            </div>
            <div className="mt-4 aspect-[4/3] animate-pulse bg-[var(--wk-surface-raised)] md:mt-5 md:aspect-[16/10] md:rounded-[28px]" />
            <div className="space-y-3 px-4 pt-4 md:px-0">
              <div className="h-6 w-4/5 animate-pulse rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--wk-surface-raised)]" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export default function FollowingPage() {
  const authUser =
    useAuthUser();

  const [items, setItems] =
    useState<FollowingFeedItem[]>([]);

  const [follows, setFollows] =
    useState<FollowingPresentationItem[]>([]);

  const [savedKeys, setSavedKeys] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [savingKeys, setSavingKeys] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [sharedKey, setSharedKey] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [hasMore, setHasMore] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [reloadKey, setReloadKey] =
    useState(0);

  const [activeAnchorKey, setActiveAnchorKey] =
    useState<string | null>(null);

  const isSignedIn =
    !authUser.loading &&
    Boolean(authUser.id);

  useEffect(() => {
    let cancelled = false;

    if (authUser.loading) {
      return () => {
        cancelled = true;
      };
    }

    if (!authUser.id) {
      setItems([]);
      setFollows([]);
      setSavedKeys(new Set());
      setError(null);
      setActionError(null);
      setHasMore(false);
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    setActionError(null);

    Promise.all([
      getFollowingFeed({
        limit: PAGE_SIZE,
      }),
      getUserFollowing(
        authUser.id,
      ),
      getUserSaves(
        authUser.id,
      ),
    ])
      .then(([
        feed,
        nextFollows,
        nextSaves,
      ]) => {
        if (cancelled) {
          return;
        }

        setItems(feed.items);
        setFollows(nextFollows);
        setSavedKeys(
          readSavedKeys(
            nextSaves,
          ),
        );
        setHasMore(
          feed.items.length === PAGE_SIZE,
        );
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Could not load Following.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authUser.loading,
    authUser.id,
    reloadKey,
  ]);

  const matureFollows =
    useMemo(
      () =>
        follows.filter(
          (
            follow,
          ): follow is MatureFollow =>
            follow.targetType === "person" ||
            follow.targetType === "artist",
        ),
      [follows],
    );

  const subjectLookup =
    useMemo(
      () =>
        new Map(
          matureFollows.map(
            (follow) => [
              subjectKey(
                follow.targetType,
                follow.targetId,
              ),
              follow,
            ],
          ),
        ),
      [matureFollows],
    );

  const activityAnchors =
    useMemo(
      () => {
        const anchors =
          new Map<string, ActivityAnchor>();

        items.forEach((item) => {
          item.matchedFollows.forEach(
            (reason) => {
              const key =
                subjectKey(
                  reason.targetType,
                  reason.targetId,
                );

              const existing =
                anchors.get(key);

              if (existing) {
                existing.count += 1;
                return;
              }

              const presentation =
                subjectLookup.get(key);

              const subject =
                presentation
                  ? {
                      key,
                      targetType:
                        presentation.targetType,
                      title:
                        presentation.title,
                      imageUrl:
                        presentation.imageUrl,
                      canonicalPath:
                        presentation.canonicalPath,
                    } satisfies ActivitySubject
                  : fallbackSubject(reason);

              anchors.set(
                key,
                {
                  ...subject,
                  count: 1,
                },
              );
            },
          );
        });

        return Array.from(
          anchors.values(),
        );
      },
      [
        items,
        subjectLookup,
      ],
    );

  useEffect(() => {
    if (activityAnchors.length === 0) {
      setActiveAnchorKey(null);
      return;
    }

    setActiveAnchorKey((current) =>
      current &&
      activityAnchors.some(
        (anchorItem) =>
          anchorItem.key === current,
      )
        ? current
        : activityAnchors[0].key,
    );
  }, [activityAnchors]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined" ||
      items.length === 0
    ) {
      return;
    }

    const nodes =
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-following-activity]",
        ),
      );

    if (nodes.length === 0) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visible =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting,
              )
              .sort(
                (left, right) =>
                  left.boundingClientRect.top -
                  right.boundingClientRect.top,
              );

          const nearest =
            visible[0]?.target as
              | HTMLElement
              | undefined;

          const key =
            nearest?.dataset
              .followingSubjects
              ?.split(" ")
              .filter(Boolean)[0];

          if (key) {
            setActiveAnchorKey(key);
          }
        },
        {
          rootMargin:
            "-18% 0px -68% 0px",
          threshold: [
            0,
            0.15,
            0.5,
          ],
        },
      );

    nodes.forEach((node) =>
      observer.observe(node),
    );

    return () => {
      observer.disconnect();
    };
  }, [items]);

  const scrollToAnchor =
    useCallback(
      (key: string) => {
        if (typeof document === "undefined") {
          return;
        }

        const nodes =
          Array.from(
            document.querySelectorAll<HTMLElement>(
              "[data-following-activity]",
            ),
          );

        const target =
          nodes.find(
            (node) =>
              node.dataset
                .followingSubjects
                ?.split(" ")
                .includes(key),
          );

        if (!target) {
          return;
        }

        setActiveAnchorKey(key);

        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
      [],
    );

  const toggleSave =
    useCallback(
      async (
        item: FollowingFeedItem,
        subject: ActivitySubject,
      ) => {
        const key =
          itemKey(item);

        if (savingKeys.has(key)) {
          return;
        }

        const nextSaved =
          !savedKeys.has(key);

        setActionError(null);
        setSavingKeys(
          (current) => {
            const next =
              new Set(current);
            next.add(key);
            return next;
          },
        );

        setSavedKeys(
          (current) => {
            const next =
              new Set(current);

            if (nextSaved) {
              next.add(key);
            } else {
              next.delete(key);
            }

            return next;
          },
        );

        try {
          await setSavedState({
            entityType:
              item.itemType,
            entityId:
              item.itemId,
            entitySlug:
              itemSlug(item),
            entityUrl:
              item.canonicalPath,
            title:
              item.title,
            subtitle:
              subject.title,
            imageUrl:
              item.imageUrl || undefined,
            saved:
              nextSaved,
          });
        } catch (nextError) {
          setSavedKeys(
            (current) => {
              const next =
                new Set(current);

              if (nextSaved) {
                next.delete(key);
              } else {
                next.add(key);
              }

              return next;
            },
          );

          setActionError(
            nextError instanceof Error
              ? nextError.message
              : "Could not update this save.",
          );
        } finally {
          setSavingKeys(
            (current) => {
              const next =
                new Set(current);
              next.delete(key);
              return next;
            },
          );
        }
      },
      [
        savedKeys,
        savingKeys,
      ],
    );

  const shareItem =
    useCallback(
      async (
        item: FollowingFeedItem,
      ) => {
        if (
          typeof window === "undefined"
        ) {
          return;
        }

        const url =
          new URL(
            item.canonicalPath,
            PUBLIC_ORIGIN,
          ).toString();

        setActionError(null);

        try {
          if (navigator.share) {
            await navigator.share({
              title: item.title,
              url,
            });
            return;
          }

          await navigator.clipboard.writeText(
            url,
          );

          setSharedKey(
            item.itemKey,
          );

          window.setTimeout(
            () => {
              setSharedKey(
                (current) =>
                  current === item.itemKey
                    ? null
                    : current,
              );
            },
            1800,
          );
        } catch (nextError) {
          if (
            nextError instanceof DOMException &&
            nextError.name === "AbortError"
          ) {
            return;
          }

          setActionError(
            "Could not share this link.",
          );
        }
      },
      [],
    );

  const loadMore = async () => {
    if (
      loadingMore ||
      !hasMore
    ) {
      return;
    }

    const cursor =
      followingFeedCursorFrom(items);

    if (!cursor) {
      setHasMore(false);
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage =
        await getFollowingFeed({
          limit: PAGE_SIZE,
          cursor,
        });

      setItems((current) => {
        const byKey =
          new Map(
            current.map(
              (item) => [
                item.itemKey,
                item,
              ],
            ),
          );

        nextPage.items.forEach(
          (item) => {
            byKey.set(
              item.itemKey,
              item,
            );
          },
        );

        return Array.from(
          byKey.values(),
        );
      });

      setHasMore(
        nextPage.items.length === PAGE_SIZE,
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not load more Following items.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <MetaTags
        title="Following"
        description="What’s moving through your circle on WAKILISHA."
        robots="noindex,nofollow"
      />

      <div className="mx-auto w-full max-w-[760px] pb-10 pt-5 md:pb-16 md:pt-9">
        <header
          data-following-masthead
          className="px-4 pb-4 md:px-0 md:pb-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[38px] font-black leading-none tracking-[-0.05em] md:text-[50px]">
                Following
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)] md:text-[14px]">
                What’s moving through your circle.
              </p>
            </div>

            {isSignedIn && (
              <Link
                to="/profile"
                aria-label="Manage Following"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--wk-border)] px-3 py-2 text-[11px] font-black text-[var(--wk-text)] transition-colors hover:border-[var(--wk-border-2)] sm:px-4"
              >
                <i
                  className="ri-user-settings-line text-[15px]"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">
                  Manage Following
                </span>
                <span className="sm:hidden">
                  Manage
                </span>
              </Link>
            )}
          </div>

          {isSignedIn &&
            !loading &&
            activityAnchors.length > 0 && (
              <nav
                data-following-activity-anchors
                aria-label="Activity anchors"
                className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
              >
                <div className="flex w-max items-start gap-4 pr-2">
                  {activityAnchors.map(
                    (anchorItem) => {
                      const active =
                        anchorItem.key ===
                        activeAnchorKey;

                      return (
                        <button
                          key={anchorItem.key}
                          type="button"
                          onClick={() =>
                            scrollToAnchor(
                              anchorItem.key,
                            )
                          }
                          aria-current={
                            active
                              ? "true"
                              : undefined
                          }
                          className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 text-center"
                        >
                          <ActivityAnchorAvatar
                            subject={anchorItem}
                            active={active}
                          />
                          <span
                            className={`w-full truncate text-[10px] font-bold transition-colors ${
                              active
                                ? "text-[var(--wk-text)]"
                                : "text-[var(--wk-text-muted)] group-hover:text-[var(--wk-text)]"
                            }`}
                          >
                            {anchorItem.title}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </nav>
            )}
        </header>

        {authUser.loading || loading ? (
          <FeedSkeleton />
        ) : !isSignedIn ? (
          <section className="mx-4 rounded-3xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-16 text-center md:mx-0">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i
                className="ri-user-follow-line text-2xl"
                aria-hidden="true"
              />
            </div>
            <h2 className="mt-5 text-[22px] font-black tracking-[-0.03em]">
              Following Starts When You Do
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
              Sign in to keep up with people and artists you choose to follow.
            </p>
            <Link
              to={buildCommunityAuthUrl("/following")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-black text-[var(--wk-brand-on)]"
            >
              Sign In
              <i
                className="ri-arrow-right-line"
                aria-hidden="true"
              />
            </Link>
          </section>
        ) : error && items.length === 0 ? (
          <section className="mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-14 text-center md:mx-0">
            <i
              className="ri-error-warning-line text-2xl text-[var(--wk-text-faint)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-[13px] font-bold text-[var(--wk-text-muted)]">
              {error}
            </p>
            <button
              type="button"
              onClick={() =>
                setReloadKey(
                  (value) => value + 1,
                )
              }
              className="mt-4 cursor-pointer text-[12px] font-black text-[var(--wk-brand)] hover:underline"
            >
              Try Again
            </button>
          </section>
        ) : items.length === 0 ? (
          <section className="mx-4 rounded-3xl border border-dashed border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-14 text-center md:mx-0">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
              <i
                className="ri-radar-line text-2xl"
                aria-hidden="true"
              />
            </div>
            <h2 className="mt-5 text-[20px] font-black tracking-[-0.03em]">
              {matureFollows.length === 0
                ? "Build Your Circle"
                : "Nothing Here Yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
              {matureFollows.length === 0
                ? "Follow people whose work you value and artists you want to keep up with."
                : "The people and artists you follow do not have public work to show here yet."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                to="/artists"
                className="rounded-full bg-[var(--wk-brand)] px-4 py-2.5 text-[12px] font-black text-[var(--wk-brand-on)]"
              >
                Find Artists
              </Link>
              <Link
                to="/"
                className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[12px] font-black text-[var(--wk-text)]"
              >
                Read Stories
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section
              aria-label="Following activity"
              className="w-full"
            >
              {items.map((item) => {
                const key =
                  itemKey(item);

                return (
                  <FollowingActivity
                    key={item.itemKey}
                    item={item}
                    subjectLookup={subjectLookup}
                    saved={
                      savedKeys.has(key)
                    }
                    saving={
                      savingKeys.has(key)
                    }
                    shared={
                      sharedKey === item.itemKey
                    }
                    onToggleSave={toggleSave}
                    onShare={shareItem}
                  />
                );
              })}
            </section>

            {actionError && (
              <div className="mx-4 mt-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[12px] text-[var(--wk-text-muted)] md:mx-0">
                {actionError}
              </div>
            )}

            {error && (
              <div className="mx-4 mt-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[12px] text-[var(--wk-text-muted)] md:mx-0">
                {error}
              </div>
            )}

            {hasMore && (
              <div className="mt-7 flex justify-center px-4 md:px-0">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="cursor-pointer rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-3 text-[12px] font-black text-[var(--wk-text)] transition-colors hover:border-[var(--wk-border-2)] disabled:cursor-wait disabled:opacity-60"
                >
                  {loadingMore
                    ? "Loading..."
                    : "Show More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
