import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCommunityDigest } from '@/services/community';
import type { CommunityActivity } from '@/services/community';

interface DigestActivity extends CommunityActivity {
  actorName: string | null;
  actorUsername: string | null;
  actorAvatar: string | null;
}

const ACTIVITY_ICONS: Record<string, string> = {
  comment: 'ri-chat-1-line',
  vote: 'ri-arrow-up-line',
  react: 'ri-emotion-line',
  save: 'ri-bookmark-line',
  follow: 'ri-user-follow-line',
  report: 'ri-flag-line',
  contribute: 'ri-edit-line',
};

const ACTIVITY_PHRASES: Record<string, string> = {
  comment: 'commented on',
  vote: 'voted on',
  react: 'reacted to',
  save: 'saved',
  follow: 'started following',
  report: 'reported',
  contribute: 'suggested a correction to',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

function getEntityUrl(entityType: string | null, entitySlug: string | null): string {
  if (!recordType || !recordSlug) return '#';
  switch (entityType) {
    case 'article': return `/magazine/${recordSlug}`;
    case 'artist': return `/artists/${recordSlug}`;
    case 'track': return `/tracks/${recordSlug}`;
    case 'release': return `/releases/${recordSlug}`;
    case 'label': return `/labels/${recordSlug}`;
    case 'genre': return `/genres/${recordSlug}`;
    case 'chart': return `/charts/${recordSlug}`;
    case 'field_guide': return `/guides/${recordSlug}`;
    default: return '#';
  }
}

interface CommunityDigestProps {
  limit?: number;
  className?: string;
}

export function CommunityDigest({ limit = 8, className = '' }: CommunityDigestProps) {
  const [activities, setActivities] = useState<DigestActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const data = await getCommunityDigest(limit);
        if (!cancelled && data) {
          setActivities(data.map((row: CommunityActivity) => ({
            ...row,
            actorName: (row.metadata as any)?.actor_name || null,
            actorUsername: (row.metadata as any)?.actor_username || null,
            actorAvatar: (row.metadata as any)?.actor_avatar || null,
          })));
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    fetch();
    return () => { cancelled = true; };
  }, [limit]);

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--wk-surface)] animate-pulse" />
          <div className="h-5 w-36 bg-[var(--wk-surface)] rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[var(--wk-surface)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-5/6 bg-[var(--wk-surface)] rounded" />
                <div className="h-3 w-1/3 bg-[var(--wk-surface)] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) return null;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[var(--wk-accent-soft)] flex items-center justify-center">
          <i className="ri-pulse-line text-[15px] text-[var(--wk-accent)]" />
        </div>
        <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Community Activity</h3>
      </div>

      {/* Activity feed */}
      <div className="space-y-1">
        {activities.map((act) => {
          const icon = ACTIVITY_ICONS[act.activityType] || 'ri-arrow-right-line';
          const phrase = ACTIVITY_PHRASES[act.activityType] || act.activityType;
          const url = getEntityUrl(act.entityType, act.entitySlug);
          const title = act.recordTitle || (act.metadata as any)?.title || '';
          const displayName = act.actorName || act.actorUsername || 'Someone';

          return (
            <Link
              key={act.id}
              to={url}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--wk-surface)] transition-colors group cursor-pointer"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-[var(--wk-surface)] flex items-center justify-center shrink-0 overflow-hidden">
                {act.actorAvatar ? (
                  <img src={act.actorAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="ri-user-line text-[13px] text-[var(--wk-text-muted)]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--wk-text)] leading-snug">
                  <span className="font-semibold">{displayName}</span>
                  {' '}<span className="text-[var(--wk-text-muted)]">{phrase}</span>
                  {title && (
                    <span className="text-[var(--wk-text-muted)]"> &ldquo;{title}&rdquo;</span>
                  )}
                </p>
                <span className="text-[10px] text-[var(--wk-text-faint)]">{timeAgo(act.createdAt)}</span>
              </div>

              {/* Icon */}
              <div className="w-6 h-6 rounded-md bg-[var(--wk-surface)] flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <i className={`${icon} text-[11px] text-[var(--wk-text-muted)]`} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}