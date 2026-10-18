import "@/styles/wakilisha-workbook-surface-fidelity.css";
import "@/styles/wakilisha-workbook-p1-p11-authority.css";
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
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import { supabase } from "@/lib/supabase";
import type { UserNotificationPrefs } from "@/hooks/useUserSettings";

type NotificationFilter = "all" | "mentions" | "releases" | "credits" | "live";

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
  credit_confirmation_request: "asked you to confirm a music credit",
  credit_confirmation_response: "responded to your music credit request",
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
  credit_confirmation_request: "ri-music-2-line",
  credit_confirmation_response: "ri-checkbox-circle-line",
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

  if (notification.entityType === "music_credit_invite") {
    const canonicalPath =
      (
        notification.metadata as
          | Record<string, unknown>
          | null
      )?.canonical_path;

    if (
      typeof canonicalPath === "string"
      && canonicalPath.startsWith("/credits")
    ) {
      return canonicalPath;
    }

    return "/credits";
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


/** Scoped preferences read/write. Never use Settings' profile-wide save here. */
function NotificationPreferencesSidebar({ userId }: { userId: string | null | undefined }) {
  const [prefs, setPrefs] = useState<UserNotificationPrefs | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void supabase.rpc("community_get_notification_prefs", { p_user_id: userId })
      .then(({ data, error: loadError }) => {
        if (!current) return;
        if (loadError || !data) {
          setError("Could not load notification settings.");
          return;
        }
        setPrefs({
          emailDigest: data.email_digest ?? true,
          chartAlerts: data.chart_alerts ?? true,
          artistDrops: data.artist_drops ?? true,
          replyNotifications: data.reply_notifications ?? true,
          mentionNotifications: data.mention_notifications ?? true,
          followNotifications: data.follow_notifications ?? false,
          contributionNotifications: data.contribution_notifications ?? false,
          marketingEmails: data.marketing_emails ?? false,
        });
      })
      .catch(() => { if (current) setError("Could not load notification settings."); });
    return () => { current = false; };
  }, [userId]);

  const updatePreference = useCallback(async (key: keyof UserNotificationPrefs, value: boolean) => {
    if (!userId || !prefs || pending) return;
    setPending(true);
    setError(null);
    const next = { ...prefs, [key]: value };
    try {
      const { error: saveError } = await supabase.rpc("community_update_notification_prefs", {
        p_user_id: userId,
        p_email_digest: next.emailDigest,
        p_chart_alerts: next.chartAlerts,
        p_artist_drops: next.artistDrops,
        p_reply_notifications: next.replyNotifications,
        p_mention_notifications: next.mentionNotifications,
        p_follow_notifications: next.followNotifications,
        p_contribution_notifications: next.contributionNotifications,
        p_marketing_emails: next.marketingEmails,
      });
      if (saveError) throw saveError;
      setPrefs(next);
      try { localStorage.setItem("wk-notifications-v2", JSON.stringify(next)); } catch { /* unavailable */ }
    } catch {
      setError("Could not save that preference. Try again.");
    } finally {
      setPending(false);
    }
  }, [userId, prefs, pending]);

  return (
    <aside className="hidden self-start border-l border-[var(--wk-border)] pl-8 pt-5 lg:block" aria-label="Notification preferences">
      <h2 className="text-[19px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--wk-text)]">Tell me about</h2>
      <p className="mt-2 text-[13px] leading-[1.6] text-[var(--wk-text-muted)]">
        Choose the updates that matter to you.
      </p>
      {prefs ? (
        <div className="mt-4 divide-y divide-[var(--wk-border)]">
          {([
            ["New releases from artists I follow", "artistDrops"],
            ["Replies to my comments", "replyNotifications"],
            ["Mentions", "mentionNotifications"],
            ["Contribution updates", "contributionNotifications"],
          ] as const).map(([label, key]) => (
            <div key={key} className="flex min-h-[58px] items-center justify-between gap-2 py-2">
              <span className="text-[13px] leading-[1.4] text-[var(--wk-text)]">{label}</span>
              <WakilishaToggle
                size="sm"
                ariaLabel={label}
                value={prefs[key]}
                onChange={(next) => void updatePreference(key, next)}
                disabled={pending}
              />
            </div>
          ))}
        </div>
      ) : null}
      {error && <p className="mt-3 text-[12px] leading-relaxed text-[var(--wk-danger)]" role="status">{error}</p>}
      {pending && <p className="mt-2 text-[12px] text-[var(--wk-text-muted)]" role="status">Saving...</p>}
      <Link
        to="/settings?section=Notifications"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 text-[13px] font-semibold text-[var(--wk-text)] transition-colors hover:border-[var(--wk-brand)]"
      >
        All notification settings <WkIcon name="ArrowUpRight" size={14} />
      </Link>
    </aside>
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

  const visibleNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((notification) => {
      const type = notification.notificationType;
      if (filter === "mentions") return type === "mention" || type === "post_mention";
      if (filter === "credits") return type.startsWith("credit_") || type.startsWith("contribution_");
      if (filter === "releases") return type.startsWith("release_") || type === "new_release";
      return type.startsWith("live_") || type === "live";
    });
  }, [filter, notifications]);

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
    <main data-wk-workbook-screen="notifications" className="min-h-[calc(100dvh-6rem)] bg-[var(--wk-bg)] pb-12">
      <div className="mx-auto grid w-full max-w-[1180px] gap-0 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-9 lg:px-8 lg:pt-9">
        <section className="min-h-[calc(100dvh-6rem)] min-w-0 border-x border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <header className="sticky top-0 z-20 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 sm:px-6">
            <div>
              <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.035em] text-[var(--wk-text)] sm:text-[34px]">
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
                  className="inline-flex min-h-11 items-center rounded-full px-3 text-[11px] font-bold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] disabled:opacity-50 sm:px-4 sm:text-[12px]"
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
            className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] lg:hidden"
            aria-label="Notification filters"
          >
            {(
              [
                ["all", "All"],
                ["mentions", "Mentions"],
                ["releases", "Releases"],
                ["credits", "Credits"],
                ["live", "Live"],
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
                  className={`relative min-h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                    active
                      ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  {label}
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
              (notification, index) => {
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

                const recent = Date.now() - new Date(notification.createdAt).getTime() < 24 * 60 * 60 * 1000;
                const previous = index > 0 ? visibleNotifications[index - 1] : null;
                const previousRecent = previous
                  ? Date.now() - new Date(previous.createdAt).getTime() < 24 * 60 * 60 * 1000
                  : null;
                const groupHeading = !previous || recent !== previousRecent
                  ? <h2 className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{recent ? "New" : "Earlier"}</h2>
                  : null;
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

                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" aria-hidden="true">
                      <i className={`${icon} text-[19px]`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-[1.5] text-[var(--wk-text)]">
                        <span className="font-bold">
                          {actorName}
                        </span>{" "}
                        <span className="font-medium">
                          {label}
                        </span>
                      </p>

                      <div className="mt-1.5 flex items-center gap-2 text-[12px] font-medium text-[var(--wk-text-muted)]">
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
                    <div key={notification.id}>
                      {groupHeading}
                    <button
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
                    </div>
                  );
                }

                return (
                  <div key={notification.id}>
                    {groupHeading}
                  <Link
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
                  </div>
                );
              },
            )}
          </div>
        )}

        </section>

        <NotificationPreferencesSidebar userId={authUser.id} />

      </div>
    </main>
  );
}
