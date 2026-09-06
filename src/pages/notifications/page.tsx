import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  Navigate,
} from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  getNotificationsWithActors,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/community";
import type {
  CommunityNotification,
  CommunityProfile,
} from "@/services/community";
import { WkIcon } from "@/components/design-system/Icon";

type NotificationFilter =
  | "all"
  | "mentions";

interface NotificationWithActor
  extends CommunityNotification {
  actor: CommunityProfile | null;
}

const NOTIFICATION_LABELS: Record<
  string,
  string
> = {
  reply: "replied to your comment",
  new_comment: "commented on something you follow",
  mention: "mentioned you",
  post_mention: "mentioned you in a Post",
  pin: "pinned your comment",
  editor_pick: "made your comment an editor pick",
  contribution_approved: "approved your contribution",
  contribution_merged: "merged your contribution",
  follow: "started following you",
  post_repost: "reposted your Post",
  post_quote: "quoted your Post",
  direct_message: "sent you a message",
};

const NOTIFICATION_ICONS: Record<
  string,
  string
> = {
  reply: "ri-reply-line",
  new_comment: "ri-chat-1-line",
  mention: "ri-at-line",
  post_mention: "ri-at-line",
  pin: "ri-pushpin-line",
  editor_pick: "ri-star-line",
  contribution_approved: "ri-check-double-line",
  contribution_merged: "ri-git-merge-line",
  follow: "ri-user-follow-line",
  post_repost: "ri-repeat-2-line",
  post_quote: "ri-double-quotes-l",
  direct_message: "ri-mail-line",
};

function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  const diff = Math.max(
    0,
    Math.floor(
      (Date.now() - then) / 1000,
    ),
  );

  if (diff < 60) return "Now";
  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h`;
  }
  if (diff < 604800) {
    return `${Math.floor(diff / 86400)}d`;
  }

  return new Date(value).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  );
}

function notificationTarget(
  notification: NotificationWithActor,
): string | null {
  if (
    notification.notificationType
      === "direct_message"
  ) {
    const canonicalPath =
      (
        notification.metadata as
          | Record<string, unknown>
          | null
      )?.canonical_path;

    if (
      typeof canonicalPath === "string"
      && canonicalPath.startsWith(
        "/messages",
      )
    ) {
      return canonicalPath;
    }

    return "/messages";
  }

  if (notification.entityType === "post") {
    const canonicalPath =
      (
        notification.metadata as
          | Record<string, unknown>
          | null
      )?.canonical_path;

    if (
      typeof canonicalPath === "string"
      && canonicalPath.startsWith("/")
    ) {
      return canonicalPath;
    }
  }

  if (
    notification.commentId
    && notification.entitySlug
    && notification.entityType === "article"
  ) {
    return `/magazine/${notification.entitySlug}#community-section`;
  }

  if (
    notification.entityType === "profile"
    && notification.entitySlug
  ) {
    return `/u/${notification.entitySlug}`;
  }

  return null;
}

function NotificationSkeleton() {
  return (
    <div
      className="divide-y divide-[var(--wk-border)]"
      aria-label="Loading Notifications"
      aria-busy="true"
    >
      {[0, 1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="flex gap-4 px-5 py-5 sm:px-6"
        >
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[var(--wk-surface-raised)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--wk-surface-raised)]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--wk-surface-raised)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const authUser = useAuthUser();
  const [filter, setFilter] =
    useState<NotificationFilter>("all");
  const [notifications, setNotifications] =
    useState<NotificationWithActor[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [markingAll, setMarkingAll] =
    useState(false);

  const loadNotifications =
    useCallback(async () => {
      if (!authUser.id) return;

      setLoading(true);
      try {
        const rows =
          await getNotificationsWithActors(
            authUser.id,
            100,
          );
        setNotifications(rows);
      } finally {
        setLoading(false);
      }
    }, [authUser.id]);

  useEffect(() => {
    if (!authUser.loading && authUser.id) {
      void loadNotifications();
    }
  }, [
    authUser.id,
    authUser.loading,
    loadNotifications,
  ]);

  const visibleNotifications =
    useMemo(
      () =>
        filter === "mentions"
          ? notifications.filter(
              (notification) =>
                notification.notificationType
                  === "mention"
                || notification.notificationType
                  === "post_mention",
            )
          : notifications,
      [filter, notifications],
    );

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.readAt,
    ).length;

  const handleMarkAll =
    useCallback(async () => {
      if (unreadCount === 0 || markingAll) {
        return;
      }

      setMarkingAll(true);
      try {
        await markAllNotificationsRead();
        const readAt =
          new Date().toISOString();
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            readAt:
              notification.readAt
              || readAt,
          })),
        );
      } finally {
        setMarkingAll(false);
      }
    }, [markingAll, unreadCount]);

  const handleOpen =
    useCallback(
      async (
        notification:
          NotificationWithActor,
      ) => {
        if (notification.readAt) return;

        try {
          await markNotificationRead(
            notification.id,
          );
          const readAt =
            new Date().toISOString();
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? {
                    ...item,
                    readAt,
                  }
                : item,
            ),
          );
        } catch {
          return;
        }
      },
      [],
    );

  if (authUser.loading) {
    return (
      <main className="min-h-[70dvh] bg-[var(--wk-bg)]">
        <div className="mx-auto w-full max-w-[760px] border-x border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="h-20 animate-pulse border-b border-[var(--wk-border)] bg-[var(--wk-surface)]" />
          <NotificationSkeleton />
        </div>
      </main>
    );
  }

  if (!authUser.id) {
    return (
      <Navigate
        to="/auth?returnTo=%2Fnotifications"
        replace
      />
    );
  }

  return (
    <main className="min-h-[calc(100dvh-6rem)] bg-[var(--wk-bg)] pb-28 md:pb-12">
      <section className="mx-auto min-h-[calc(100dvh-6rem)] w-full max-w-[760px] border-x border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <header className="sticky top-0 z-20 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 sm:px-6">
            <div>
              <h1 className="text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)] sm:text-[28px]">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="mt-0.5 text-[11px] font-bold text-[var(--wk-text-muted)]">
                  {unreadCount} unread
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={markingAll}
                  onClick={() =>
                    void handleMarkAll()
                  }
                  className="hidden min-h-10 rounded-full px-4 text-[12px] font-black text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] disabled:opacity-50 sm:inline-flex sm:items-center"
                >
                  {markingAll
                    ? "Marking..."
                    : "Mark All Read"}
                </button>
              )}

              <Link
                to="/settings?section=Notifications"
                aria-label="Notification Settings"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)]"
              >
                <WkIcon
                  name="Settings"
                  size={18}
                />
              </Link>
            </div>
          </div>

          <nav
            className="grid grid-cols-2"
            aria-label="Notification filters"
          >
            {(
              [
                ["all", "All"],
                ["mentions", "Mentions"],
              ] as const
            ).map(([value, label]) => {
              const active =
                filter === value;

              return (
                <button
                  key={value}
                  type="button"
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    setFilter(value)
                  }
                  className={`relative min-h-12 text-[13px] font-black transition-colors ${
                    active
                      ? "text-[var(--wk-text)]"
                      : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 h-[3px] w-14 -translate-x-1/2 rounded-full bg-[var(--wk-brand)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {loading ? (
          <NotificationSkeleton />
        ) : visibleNotifications.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-8 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <WkIcon
                name={
                  filter === "mentions"
                    ? "AtSign"
                    : "Bell"
                }
                size={22}
              />
            </div>
            <h2 className="mt-5 text-[18px] font-black text-[var(--wk-text)]">
              {filter === "mentions"
                ? "No mentions yet."
                : "Nothing here yet."}
            </h2>
            <p className="mt-2 max-w-[38ch] text-[13px] leading-6 text-[var(--wk-text-muted)]">
              {filter === "mentions"
                ? "When someone mentions you in a Post or conversation, it will appear here."
                : "Activity around your Posts, conversations, and People will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--wk-border)]">
            {visibleNotifications.map(
              (notification) => {
                const target =
                  notificationTarget(
                    notification,
                  );
                const unread =
                  !notification.readAt;
                const label =
                  NOTIFICATION_LABELS[
                    notification.notificationType
                  ]
                  || notification.notificationType;
                const icon =
                  NOTIFICATION_ICONS[
                    notification.notificationType
                  ]
                  || "ri-notification-3-line";
                const metadata =
                  notification.metadata as
                    | Record<string, unknown>
                    | null;
                const metadataSenderName =
                  typeof metadata?.sender_display_name
                    === "string"
                    ? metadata.sender_display_name
                    : null;
                const actorName =
                  notification.actor?.displayName
                  || notification.actor?.username
                  || metadataSenderName
                  || "Someone";

                const row = (
                  <div
                    className={`relative flex gap-4 px-5 py-5 transition-colors sm:px-6 ${
                      unread
                        ? "bg-[var(--wk-brand-soft)]/30"
                        : "hover:bg-[var(--wk-surface-raised)]"
                    }`}
                  >
                    {unread && (
                      <span
                        className="absolute left-0 top-0 h-full w-[3px] bg-[var(--wk-brand)]"
                        aria-label="Unread"
                      />
                    )}

                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                      {notification.actor?.avatarUrl ? (
                        <img
                          src={
                            notification.actor.avatarUrl
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[var(--wk-text-muted)]">
                          <i
                            className={`${icon} text-[18px]`}
                          />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-5 text-[var(--wk-text)]">
                        <span className="font-black">
                          {actorName}
                        </span>{" "}
                        <span className="font-medium">
                          {label}
                        </span>
                      </p>

                      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-faint)]">
                        <span>
                          {timeAgo(
                            notification.createdAt,
                          )}
                        </span>
                        <span aria-hidden="true">
                          ·
                        </span>
                        <i
                          className={`${icon} text-[13px]`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {unread && (
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--wk-brand)]" />
                    )}
                  </div>
                );

                if (!target) {
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() =>
                        void handleOpen(
                          notification,
                        )
                      }
                      className="block w-full text-left"
                    >
                      {row}
                    </button>
                  );
                }

                return (
                  <Link
                    key={notification.id}
                    to={target}
                    onClick={() =>
                      void handleOpen(
                        notification,
                      )
                    }
                    className="block"
                  >
                    {row}
                  </Link>
                );
              },
            )}
          </div>
        )}

        {unreadCount > 0 && (
          <div className="border-t border-[var(--wk-border)] px-5 py-4 sm:hidden">
            <button
              type="button"
              disabled={markingAll}
              onClick={() =>
                void handleMarkAll()
              }
              className="min-h-11 w-full rounded-full border border-[var(--wk-border)] text-[12px] font-black text-[var(--wk-brand)] disabled:opacity-50"
            >
              {markingAll
                ? "Marking..."
                : "Mark All Read"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
