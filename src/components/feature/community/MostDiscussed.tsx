import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMostDiscussed } from '@/services/community';
import type { CommunityEntityType } from '@/services/community';

interface MostDiscussedThread {
  id: string;
  entityType: CommunityEntityType;
  entitySlug: string | null;
  entityUrl: string | null;
  title: string;
  commentCount: number;
  lastCommentAt: string | null;
}

const ENTITY_ICONS: Record<string, string> = {
  article: 'ri-article-line',
  artist: 'ri-mic-line',
  track: 'ri-music-line',
  release: 'ri-album-line',
  label: 'ri-building-line',
  genre: 'ri-price-tag-3-line',
  chart: 'ri-bar-chart-line',
  chart_edition: 'ri-trophy-line',
  magazine_issue: 'ri-book-open-line',
  field_guide: 'ri-map-line',
  briefing_issue: 'ri-mail-line',
};

const ENTITY_LABELS: Record<string, string> = {
  article: 'Article',
  artist: 'Artist',
  track: 'Track',
  release: 'Release',
  label: 'Label',
  genre: 'Genre',
  chart: 'Chart',
  chart_edition: 'Edition',
  magazine_issue: 'Issue',
  field_guide: 'Guide',
  briefing_issue: 'Briefing',
};

function getEntityUrl(thread: MostDiscussedThread): string {
  if (thread.entityUrl) return thread.entityUrl;
  if (thread.entitySlug) {
    switch (thread.entityType) {
      case 'article': return `/magazine/${thread.recordSlug}`;
      case 'artist': return `/artists/${thread.recordSlug}`;
      case 'track': return `/tracks/${thread.recordSlug}`;
      case 'release': return `/releases/${thread.recordSlug}`;
      case 'label': return `/labels/${thread.recordSlug}`;
      case 'genre': return `/genres/${thread.recordSlug}`;
      case 'chart': return `/charts/${thread.recordSlug}`;
      case 'chart_edition': return `/charts/${thread.recordSlug}`;
      case 'field_guide': return `/guides/${thread.recordSlug}`;
      default: return '#';
    }
  }
  return '#';
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

interface MostDiscussedProps {
  limit?: number;
  className?: string;
}

export function MostDiscussed({ limit = 6, className = '' }: MostDiscussedProps) {
  const [threads, setThreads] = useState<MostDiscussedThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const data = await getMostDiscussed(limit);
        if (!cancelled && data) {
          setThreads(data.map((row: any) => ({
            id: row.id,
            entityType: row.entity_type,
            entitySlug: row.entity_slug,
            entityUrl: row.entity_url,
            title: row.title,
            commentCount: row.comment_count,
            lastCommentAt: row.last_comment_at,
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
          <div className="h-5 w-40 bg-[var(--wk-surface)] rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--wk-surface)] animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-[var(--wk-surface-raised)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-[var(--wk-surface-raised)] rounded" />
                <div className="h-3 w-1/2 bg-[var(--wk-surface-raised)] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (threads.length === 0) return null;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[var(--wk-brand-soft)] flex items-center justify-center">
          <i className="ri-fire-line text-[15px] text-[var(--wk-brand)]" />
        </div>
        <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Most Discussed</h3>
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {threads.map((thread, idx) => {
          const url = getEntityUrl(thread);
          const icon = ENTITY_ICONS[thread.recordType] || 'ri-chat-1-line';
          const label = ENTITY_LABELS[thread.entityType] || thread.entityType;

          return (
            <Link
              key={thread.id}
              to={url}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--wk-surface)] hover:bg-[var(--wk-surface-raised)] transition-colors group cursor-pointer"
            >
              {/* Rank */}
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                idx === 0 ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)]' :
                idx === 1 ? 'bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]' :
                idx === 2 ? 'bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]' :
                'text-[var(--wk-text-faint)]'
              }`}>
                {idx + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
                    {thread.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-[var(--wk-text-faint)]">
                    <i className={`${icon} text-[10px]`} />
                    <span>{label}</span>
                  </div>
                  <span className="text-[11px] text-[var(--wk-text-faint)]">·</span>
                  <span className="text-[11px] text-[var(--wk-text-faint)] whitespace-nowrap">
                    <i className="ri-chat-3-line mr-0.5" />{thread.commentCount}
                  </span>
                  {thread.lastCommentAt && (
                    <>
                      <span className="text-[11px] text-[var(--wk-text-faint)]">·</span>
                      <span className="text-[11px] text-[var(--wk-text-faint)] whitespace-nowrap">{timeAgo(thread.lastCommentAt)}</span>
                    </>
                  )}
                </div>
              </div>

              <i className="ri-arrow-right-s-line text-[14px] text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)] transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}