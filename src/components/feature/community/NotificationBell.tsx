import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getUnreadNotificationCount,
  getNotificationsWithActors,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/community';
import type { CommunityNotification, CommunityProfile } from '@/services/community';
import { trackEvent } from '@/services/analytics';
import { WkIcon } from '@/components/design-system/Icon';
import { Portal } from '@/components/base/Portal';
import { useUserSettings } from '@/hooks/useUserSettings';
import {
  dismissFullPlaybackNotice,
  FULL_PLAYBACK_NOTICE_EVENT,
  isAppleMusicPlaybackConnected,
} from '@/services/playback/fullPlaybackNotice';

interface NotificationWithActor extends CommunityNotification {
  actor: CommunityProfile | null;
}

interface NotificationBellProps {
  userId: string;
  className?: string;
  placement?: 'top' | 'bottom' | 'auto';
}

const NOTIFICATION_ICONS: Record<string, string> = {
  reply: 'ri-reply-line',
  new_comment: 'ri-chat-1-line',
  mention: 'ri-at-line',
  pin: 'ri-pushpin-line',
  editor_pick: 'ri-star-line',
  contribution_approved: 'ri-check-double-line',
  contribution_merged: 'ri-git-merge-line',
  follow: 'ri-user-follow-line',
};

const NOTIFICATION_LABELS: Record<string, string> = {
  reply: 'replied to your comment',
  new_comment: 'commented on',
  mention: 'mentioned you',
  pin: 'pinned your comment',
  editor_pick: 'made your comment an editor pick',
  contribution_approved: 'approved your contribution',
  contribution_merged: 'merged your contribution',
  follow: 'started following',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationBell({ userId, className = '', placement = 'auto' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productNoticeVersion, setProductNoticeVersion] = useState(0);
  const { playback } = useUserSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const isMobileNav = className.includes('phn-nav-tab');
  const stopDropdownEvent = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const syncProductNotices = () => setProductNoticeVersion((v) => v + 1);

    window.addEventListener(FULL_PLAYBACK_NOTICE_EVENT, syncProductNotices);
    window.addEventListener("wk-playback-changed", syncProductNotices);
    window.addEventListener("wk-apple-music-connected", syncProductNotices);

    return () => {
      window.removeEventListener(FULL_PLAYBACK_NOTICE_EVENT, syncProductNotices);
      window.removeEventListener("wk-playback-changed", syncProductNotices);
      window.removeEventListener("wk-apple-music-connected", syncProductNotices);
    };
  }, []);

  const showFullPlaybackAlert = !isAppleMusicPlaybackConnected(playback);

  const renderFullPlaybackAlert = () => {
    if (!showFullPlaybackAlert) return null;

    return (
      <div className="border-b border-[var(--wk-border)]/50 bg-[var(--wk-brand-soft)]/25 px-5 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)]/15 text-[var(--wk-brand)]">
            <WkIcon name="Music" size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-black text-[var(--wk-text)]">Full playback is available</div>
            <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[var(--wk-text-muted)]">
              Connect Apple Music from the player whenever you want full tracks on WAKILISHA.
            </p>
            <button
              type="button"
              onClick={dismissFullPlaybackNotice}
              className="mt-2 text-[11px] font-black text-[var(--wk-brand)] hover:text-[var(--wk-brand-hi)]"
            >
              Hide this notice on pages
            </button>
          </div>
        </div>
      </div>
    );
  };

  void productNoticeVersion;

  // Fetch unread count
  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch { /* silent */ }
  }, [userId]);

  // Fetch notification list
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await getNotificationsWithActors(userId, 30);
      setNotifications(list);
      const count = list.filter((n) => !n.readAt).length;
      setUnreadCount(count);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [userId]);

  // Poll for new notifications
  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchUnread]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = useCallback(() => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      fetchNotifications();
      trackEvent('notification_bell_open', { context: { unread_count: unreadCount } });
    }
  }, [open, fetchNotifications, unreadCount]);

  const handleMarkAll = useCallback(async () => {
    if (!userId || unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      trackEvent('notification_mark_all_read', { context: { count: unreadCount } });
    } catch { /* silent */ }
  }, [userId, unreadCount]);

  const handleNotificationClick = useCallback(async (notif: NotificationWithActor) => {
    if (!notif.readAt) {
      try {
        await markNotificationRead(notif.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      } catch { /* silent */ }
    }
    setOpen(false);
    trackEvent('notification_click', {
      context: { notification_type: notif.notificationType, entity_type: notif.entityType },
    });
  }, []);

  const getNotificationLink = (notif: NotificationWithActor): string | null => {
    if (notif.commentId && notif.entitySlug) {
      if (notif.entityType === 'article') {
        return `/magazine/${notif.entitySlug}#community-section`;
      }
      return `#comment-${notif.commentId}`;
    }
    if (notif.entityType === 'profile' && notif.entitySlug) {
      return `/u/${notif.entitySlug}`;
    }
    return null;
  };

  const getDropdownClasses = () => {
    if (placement === 'top') return 'top-full mt-2';
    if (placement === 'bottom') return 'bottom-full mb-2';
    if (isMobileNav) return 'bottom-full mb-2';
    return 'bottom-full mb-2 md:bottom-auto md:top-full md:mt-2 md:mb-0';
  };

  const getDropdownWidth = () => {
    if (isMobileNav) return 'w-[340px]';
    return 'w-[340px] md:w-[380px]';
  };

  const getDropdownMaxHeight = () => {
    if (isMobileNav) return 'max-h-[340px]';
    return 'max-h-[408px]';
  };

  // Mobile nav button style
  if (isMobileNav) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          onClick={handleToggle}
          className="flex flex-col items-center justify-center gap-[2px] w-full h-full text-[var(--wk-text-faint)] cursor-pointer"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <div className="relative">
            <WkIcon name="Bell" size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center px-[2px] text-[8px] font-bold text-[var(--wk-brand-on)] bg-[var(--wk-brand)] rounded-full leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="pnl">Alerts</span>
        </button>

        {/* Dropdown - opens upward on mobile nav, full-width within viewport */}
        {open && (
          <Portal>
            <div
              className="fixed left-3 right-3 z-[95] rounded-t-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)] shadow-[0_-4px_24px_rgba(0,0,0,.12)] overflow-hidden animate-[slideUp_0.2s_cubic-bezier(.16,1,.3,1)]"
              onMouseDown={stopDropdownEvent}
              onClick={stopDropdownEvent}
              style={{
                bottom: 'calc(52px + max(env(safe-area-inset-bottom), 8px) + 8px)',
                maxHeight: 'min(60vh, 420px)',
              }}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--wk-border)]">
              <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[12px] font-semibold text-[var(--wk-brand)] hover:text-[var(--wk-brand-hi)] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 'min(52vh, 340px)' }}>
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <i className="ri-loader-4-line animate-spin text-[20px] text-[var(--wk-text-muted)]" />
                </div>
              ) : notifications.length === 0 && !showFullPlaybackAlert ? (
                <div className="text-center py-12 px-5">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--wk-surface)] flex items-center justify-center">
                    <i className="ri-notification-off-line text-[18px] text-[var(--wk-text-faint)]" />
                  </div>
                  <p className="text-[13px] font-medium text-[var(--wk-text-muted)]">No notifications yet</p>
                  <p className="text-[11px] text-[var(--wk-text-faint)] mt-1">When someone replies or comments on threads you follow, it will show up here.</p>
                </div>
              ) : (
                <>
                  {renderFullPlaybackAlert()}
                  {notifications.map((notif) => {
                  const link = getNotificationLink(notif);
                  const icon = NOTIFICATION_ICONS[notif.notificationType] || 'ri-notification-line';
                  const label = NOTIFICATION_LABELS[notif.notificationType] || notif.notificationType;
                  const isUnread = !notif.readAt;
                  const threadTitle = (notif.metadata as any)?.thread_title || '';

                  const content = (
                    <div
                      className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${isUnread ? 'bg-[var(--wk-brand-soft)]/30' : 'hover:bg-[var(--wk-surface-raised)]'} cursor-pointer`}
                    >
                      {/* Actor avatar */}
                      <div className="w-9 h-9 rounded-full bg-[var(--wk-surface)] flex items-center justify-center shrink-0 overflow-hidden">
                        {notif.actor?.avatarUrl ? (
                          <img src={notif.actor.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <i className="ri-user-line text-[15px] text-[var(--wk-text-muted)]" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--wk-text)] leading-snug">
                          {notif.actor ? (
                            <span className="font-semibold">{notif.actor.displayName || notif.actor.username}</span>
                          ) : (
                            <span className="font-semibold">Someone</span>
                          )}
                          {' '}{label}
                          {threadTitle && (
                            <> <span className="text-[var(--wk-text-muted)] font-normal">&ldquo;{threadTitle}&rdquo;</span></>
                          )}
                        </p>
                        <span className="text-[11px] text-[var(--wk-text-faint)] mt-1 block">{timeAgo(notif.createdAt)}</span>
                      </div>

                      {/* Icon + unread dot */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-[var(--wk-surface)] flex items-center justify-center">
                          <i className={`${icon} text-[13px] text-[var(--wk-text-muted)]`} />
                        </div>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[var(--wk-brand)]" />
                        )}
                      </div>
                    </div>
                  );

                  if (link) {
                    return (
                      <Link
                        key={notif.id}
                        to={link}
                        onClick={() => handleNotificationClick(notif)}
                        className="block border-b border-[var(--wk-border)]/50 last:border-b-0"
                      >
                        {content}
                      </Link>
                    );
                  }
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="block border-b border-[var(--wk-border)]/50 last:border-b-0"
                    >
                      {content}
                    </div>
                  );
                })}
                </>
              )}
            </div>
            </div>
          </Portal>
        )}
      </div>
    );
  }

  // Desktop / top-bar style
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <WkIcon name="Bell" size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-[var(--wk-brand-on)] bg-[var(--wk-brand)] rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute right-0 ${getDropdownClasses()} ${getDropdownWidth()} ${getDropdownMaxHeight()} rounded-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)] shadow-lg overflow-hidden z-[70] animate-[fadeIn_0.15s_ease-out]`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--wk-border)]">
            <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-[12px] font-semibold text-[var(--wk-brand)] hover:text-[var(--wk-brand-hi)] transition-colors cursor-pointer whitespace-nowrap"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[408px]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <i className="ri-loader-4-line animate-spin text-[20px] text-[var(--wk-text-muted)]" />
              </div>
            ) : notifications.length === 0 && !showFullPlaybackAlert ? (
              <div className="text-center py-12 px-5">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--wk-surface)] flex items-center justify-center">
                  <i className="ri-notification-off-line text-[18px] text-[var(--wk-text-faint)]" />
                </div>
                <p className="text-[13px] font-medium text-[var(--wk-text-muted)]">No notifications yet</p>
                <p className="text-[11px] text-[var(--wk-text-faint)] mt-1">When someone replies or comments on threads you follow, it will show up here.</p>
              </div>
            ) : (
              <>
                {renderFullPlaybackAlert()}
                {notifications.map((notif) => {
                const link = getNotificationLink(notif);
                const icon = NOTIFICATION_ICONS[notif.notificationType] || 'ri-notification-line';
                const label = NOTIFICATION_LABELS[notif.notificationType] || notif.notificationType;
                const isUnread = !notif.readAt;
                const threadTitle = (notif.metadata as any)?.thread_title || '';

                const content = (
                  <div
                    className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${isUnread ? 'bg-[var(--wk-brand-soft)]/30' : 'hover:bg-[var(--wk-surface-raised)]'} cursor-pointer`}
                  >
                    {/* Actor avatar */}
                    <div className="w-9 h-9 rounded-full bg-[var(--wk-surface)] flex items-center justify-center shrink-0 overflow-hidden">
                      {notif.actor?.avatarUrl ? (
                        <img src={notif.actor.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="ri-user-line text-[15px] text-[var(--wk-text-muted)]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--wk-text)] leading-snug">
                        {notif.actor ? (
                          <span className="font-semibold">{notif.actor.displayName || notif.actor.username}</span>
                        ) : (
                          <span className="font-semibold">Someone</span>
                        )}
                        {' '}{label}
                        {threadTitle && (
                          <> <span className="text-[var(--wk-text-muted)] font-normal">&ldquo;{threadTitle}&rdquo;</span></>
                        )}
                      </p>
                      <span className="text-[11px] text-[var(--wk-text-faint)] mt-1 block">{timeAgo(notif.createdAt)}</span>
                    </div>

                    {/* Icon + unread dot */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-[var(--wk-surface)] flex items-center justify-center">
                        <i className={`${icon} text-[13px] text-[var(--wk-text-muted)]`} />
                      </div>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[var(--wk-brand)]" />
                      )}
                    </div>
                  </div>
                );

                if (link) {
                  return (
                    <Link
                      key={notif.id}
                      to={link}
                      onClick={() => handleNotificationClick(notif)}
                      className="block border-b border-[var(--wk-border)]/50 last:border-b-0"
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className="block border-b border-[var(--wk-border)]/50 last:border-b-0"
                  >
                    {content}
                  </div>
                );
              })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}