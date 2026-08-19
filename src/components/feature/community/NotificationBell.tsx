import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  getUnreadNotificationCount,
} from "@/services/community";
import { WkIcon } from "@/components/design-system/Icon";

interface NotificationBellProps {
  userId: string;
  className?: string;
  placement?: "top" | "bottom" | "auto";
}

export function NotificationBell({
  userId,
  className = "",
}: NotificationBellProps) {
  const [unreadCount, setUnreadCount] =
    useState(0);

  const fetchUnread =
    useCallback(async () => {
      if (!userId) return;

      try {
        const count =
          await getUnreadNotificationCount();
        setUnreadCount(count);
      } catch {
        return;
      }
    }, [userId]);

  useEffect(() => {
    void fetchUnread();

    const timer =
      window.setInterval(
        () => void fetchUnread(),
        30000,
      );

    return () =>
      window.clearInterval(timer);
  }, [fetchUnread]);

  return (
    <Link
      to="/notifications"
      className={`relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] ${className}`}
      aria-label={`Notifications${
        unreadCount > 0
          ? ` (${unreadCount} unread)`
          : ""
      }`}
    >
      <WkIcon name="Bell" size={18} />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--wk-brand)] px-[3px] text-[8px] font-black leading-none text-[var(--wk-brand-on)]">
          {unreadCount > 99
            ? "99+"
            : unreadCount}
        </span>
      )}
    </Link>
  );
}
