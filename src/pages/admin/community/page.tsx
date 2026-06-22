import { useEffect, useState, useCallback } from 'react';
import { WkIcon } from '@/components/design-system/Icon';
import { AdminChartsPageHeader } from '@/pages/admin/charts/components/AdminChartsPageHeader';
import { AdminChartsKpiCard } from '@/pages/admin/charts/components/AdminChartsKpiCard';
import { AdminChartsLoadingState } from '@/pages/admin/charts/components/AdminChartsLoadingState';
import {
  listCommentsQueue,
  listReportsQueue,
  listContributionsQueue,
  listModerationLog,
  getModerationStats,
  hideComment,
  removeComment,
  restoreComment,
  pinComment,
  unpinComment,
  setEditorPick,
  lockThread,
  unlockThread,
  reviewReport,
  reviewContribution,
  mergeContribution,
  type CommentsQueueFilters,
  type ReportsQueueFilters,
  type ContributionsQueueFilters,
  type ModerationLogFilters,
  type ModerationStats,
} from '@/services/community/admin';
import type { CommunityComment, CommunityReport, CommunityContribution, CommunityModerationEvent } from '@/services/community/types';

// ── Status badge helpers ──────────────────────────────────────────

const COMMENT_STATUS_COLORS: Record<string, string> = {
  visible: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  hidden: 'bg-orange-100 text-orange-800',
  removed: 'bg-red-100 text-red-800',
  deleted: 'bg-gray-100 text-gray-600',
  spam: 'bg-fuchsia-100 text-fuchsia-800',
};

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_or_abuse: 'Hate / Abuse',
  misinformation: 'Misinformation',
  privacy: 'Privacy',
  copyright: 'Copyright',
  off_topic: 'Off Topic',
  other: 'Other',
};

const REPORT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

const CONTRIBUTION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  merged: 'bg-sky-100 text-sky-800',
};

function fmtTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncate(text: string, maxLen: number = 120): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

// ── Tab types ─────────────────────────────────────────────────────

type TabKey = 'comments' | 'reports' | 'contributions' | 'log';

interface TabDef { key: TabKey; label: string; icon: string; }

const TABS: TabDef[] = [
  { key: 'comments', label: 'Comments', icon: 'MessageSquare' },
  { key: 'reports', label: 'Reports', icon: 'Flag' },
  { key: 'contributions', label: 'Contributions', icon: 'GitPullRequest' },
  { key: 'log', label: 'Moderation Log', icon: 'ClipboardList' },
];

// ── Main Page ─────────────────────────────────────────────────────

export default function AdminCommunityPage() {
  const [tab, setTab] = useState<TabKey>('comments');
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Comments state
  const [commentFilter, setCommentFilter] = useState<CommentsQueueFilters>({ status: 'all', sort: 'newest', limit: 25 });
  const [comments, setComments] = useState<(CommunityComment & { threadTitle?: string; threadEntityType?: string | null; threadEntitySlug?: string | null })[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reports state
  const [reportFilter, setReportFilter] = useState<ReportsQueueFilters>({ status: 'pending', sort: 'newest', limit: 25 });
  const [reports, setReports] = useState<(CommunityReport & { comment?: any })[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Contributions state
  const [contribFilter, setContribFilter] = useState<ContributionsQueueFilters>({ status: 'pending', sort: 'newest', limit: 25 });
  const [contributions, setContributions] = useState<CommunityContribution[]>([]);
  const [contributionsTotal, setContributionsTotal] = useState(0);
  const [contributionsLoading, setContributionsLoading] = useState(false);

  // Moderation log state
  const [logFilter, setLogFilter] = useState<ModerationLogFilters>({ sort: 'newest', limit: 25 });
  const [logEvents, setLogEvents] = useState<(CommunityModerationEvent & { moderatorName?: string })[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load stats
  useEffect(() => {
    getModerationStats().then(setStats).catch(() => {}).finally(() => setStatsLoading(false));
  }, []);

  // Load comments
  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const result = await listCommentsQueue(commentFilter);
      setComments(result.comments);
      setCommentsTotal(result.total);
    } catch { /* silent */ }
    setCommentsLoading(false);
  }, [commentFilter]);

  useEffect(() => { loadComments(); }, [loadComments]);

  // Load reports
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const result = await listReportsQueue(reportFilter);
      setReports(result.reports);
      setReportsTotal(result.total);
    } catch { /* silent */ }
    setReportsLoading(false);
  }, [reportFilter]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Load contributions
  const loadContributions = useCallback(async () => {
    setContributionsLoading(true);
    try {
      const result = await listContributionsQueue(contribFilter);
      setContributions(result.contributions);
      setContributionsTotal(result.total);
    } catch { /* silent */ }
    setContributionsLoading(false);
  }, [contribFilter]);

  useEffect(() => { loadContributions(); }, [loadContributions]);

  // Load moderation log
  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const result = await listModerationLog(logFilter);
      setLogEvents(result.events);
      setLogTotal(result.total);
    } catch { /* silent */ }
    setLogLoading(false);
  }, [logFilter]);

  useEffect(() => { loadLog(); }, [loadLog]);

  // Quick action handler
  const handleAction = useCallback(async (action: () => Promise<void>, label: string) => {
    setActionLoading(label);
    try {
      await action();
      showToast(`${label} successful`);
      // Reload relevant tab + stats
      if (tab === 'comments') loadComments();
      if (tab === 'reports') loadReports();
      if (tab === 'contributions') loadContributions();
      getModerationStats().then(setStats);
    } catch (e: any) {
      showToast(e?.message || `${label} failed`, 'error');
    }
    setActionLoading(null);
  }, [tab, loadComments, loadReports, loadContributions, showToast]);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const confirm = (message: string, onConfirm: () => void) => {
    setConfirmAction({ message, onConfirm });
  };

  const reloadCurrentTab = useCallback(() => {
    if (tab === 'comments') loadComments();
    if (tab === 'reports') loadReports();
    if (tab === 'contributions') loadContributions();
    if (tab === 'log') loadLog();
  }, [tab, loadComments, loadReports, loadContributions, loadLog]);

  if (statsLoading) {
    return <AdminChartsLoadingState message="Loading community moderation…" />;
  }

  const isLoading = commentsLoading || reportsLoading || contributionsLoading || logLoading;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-semibold text-gray-900 mb-4">{confirmAction.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Community"
        title="Moderation Dashboard"
        description="Review and manage community content: comments, reports, contributions, and audit trail."
      />

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <AdminChartsKpiCard value={stats?.totalComments?.toLocaleString() ?? '—'} label="Total Comments" icon="MessageSquare" accent="brand" />
        <AdminChartsKpiCard value={stats?.flaggedComments?.toLocaleString() ?? '—'} label="Flagged" icon="Flag" accent="warning" />
        <AdminChartsKpiCard value={stats?.pendingReports?.toLocaleString() ?? '—'} label="Pending Reports" icon="AlertTriangle" accent="danger" />
        <AdminChartsKpiCard value={stats?.pendingContributions?.toLocaleString() ?? '—'} label="Pending Contribs" icon="GitPullRequest" accent="muted" />
        <AdminChartsKpiCard value={stats?.hiddenComments?.toLocaleString() ?? '—'} label="Hidden" icon="EyeOff" accent="warning" />
        <AdminChartsKpiCard value={stats?.removedComments?.toLocaleString() ?? '—'} label="Removed" icon="Trash2" accent="danger" />
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-0.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              tab === t.key
                ? 'bg-emerald-600 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <WkIcon name={t.icon as never} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'comments' && (
        <CommentsTab
          comments={comments}
          total={commentsTotal}
          loading={commentsLoading}
          filter={commentFilter}
          onFilterChange={setCommentFilter}
          actionLoading={actionLoading}
          onAction={handleAction}
          onConfirm={confirm}
          onRefresh={reloadCurrentTab}
        />
      )}

      {tab === 'reports' && (
        <ReportsTab
          reports={reports}
          total={reportsTotal}
          loading={reportsLoading}
          filter={reportFilter}
          onFilterChange={setReportFilter}
          actionLoading={actionLoading}
          onAction={handleAction}
          onConfirm={confirm}
          onRefresh={reloadCurrentTab}
        />
      )}

      {tab === 'contributions' && (
        <ContributionsTab
          contributions={contributions}
          total={contributionsTotal}
          loading={contributionsLoading}
          filter={contribFilter}
          onFilterChange={setContribFilter}
          actionLoading={actionLoading}
          onAction={handleAction}
          onConfirm={confirm}
          onRefresh={reloadCurrentTab}
        />
      )}

      {tab === 'log' && (
        <ModerationLogTab
          events={logEvents}
          total={logTotal}
          loading={logLoading}
          filter={logFilter}
          onFilterChange={setLogFilter}
          onRefresh={reloadCurrentTab}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Comments Tab
// ═══════════════════════════════════════════════════════════════════

function CommentsTab({
  comments, total, loading, filter, onFilterChange, actionLoading, onAction, onConfirm, onRefresh,
}: {
  comments: (CommunityComment & { threadTitle?: string; threadEntityType?: string | null; threadEntitySlug?: string | null })[];
  total: number;
  loading: boolean;
  filter: CommentsQueueFilters;
  onFilterChange: (f: CommentsQueueFilters) => void;
  actionLoading: string | null;
  onAction: (action: () => Promise<void>, label: string) => void;
  onConfirm: (message: string, onConfirm: () => void) => void;
  onRefresh: () => void;
}) {
  const statusOptions = ['all', 'visible', 'pending', 'hidden', 'removed', 'deleted', 'spam'];
  const sortOptions: { value: CommentsQueueFilters['sort']; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'most_reported', label: 'Most Reported' },
    { value: 'most_votes', label: 'Most Votes' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-0.5">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => onFilterChange({ ...filter, status: s as CommentsQueueFilters['status'], offset: 0 })}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
                filter.status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filter.sort || 'newest'}
            onChange={(e) => onFilterChange({ ...filter, sort: e.target.value as any, offset: 0 })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-semibold text-gray-600 bg-white cursor-pointer"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={onRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" title="Refresh">
            <WkIcon name="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <WkIcon name="Loader2" size={20} className="mx-auto mb-3 text-gray-400 animate-spin" />
          <p className="text-[12px] text-gray-500">Loading comments…</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="p-10 text-center">
          <WkIcon name="MessageSquare" size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-[13px] font-semibold text-gray-500">No comments found</p>
          <p className="text-[11px] text-gray-400 mt-1">Try changing the status filter</p>
        </div>
      ) : (
        <>
          {/* Comments table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-8">#</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Comment</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Author</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Thread</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-20">Status</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-16 text-right">Votes</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-16 text-right">Flags</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-56">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((c, i) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-[11px] font-bold text-gray-400">{i + 1 + (filter.offset || 0)}</td>
                    <td className="py-3 px-4 max-w-[320px]">
                      <p className="text-[13px] text-gray-900 line-clamp-2">{truncate(c.bodyPlain || c.bodyMarkdown)}</p>
                      <span className="text-[10px] text-gray-400">{fmtTimeAgo(c.createdAt)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-semibold text-gray-700">
                        {c.author?.displayName || c.author?.username || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-500 truncate max-w-[180px] block">
                        {c.threadTitle || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${COMMENT_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[12px] font-bold text-gray-700">{c.upvoteCount - c.downvoteCount}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.reportCount > 0 ? (
                        <span className="text-[12px] font-bold text-amber-600">{c.reportCount}</span>
                      ) : (
                        <span className="text-[11px] text-gray-300">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Hide / Restore */}
                        {c.status === 'visible' || c.status === 'pending' ? (
                          <ActionBtn icon="EyeOff" label="Hide" tone="warning" loading={actionLoading === `hide-${c.id}`} onClick={() => onConfirm(`Hide this comment?`, () => onAction(() => hideComment(c.id), `hide-${c.id}`))} />
                        ) : (
                          <ActionBtn icon="Eye" label="Restore" tone="success" loading={actionLoading === `restore-${c.id}`} onClick={() => onConfirm(`Restore this comment?`, () => onAction(() => restoreComment(c.id), `restore-${c.id}`))} />
                        )}

                        {/* Remove */}
                        {c.status !== 'removed' && (
                          <ActionBtn icon="Trash2" label="Remove" tone="danger" loading={actionLoading === `remove-${c.id}`} onClick={() => onConfirm(`Permanently remove this comment?`, () => onAction(() => removeComment(c.id), `remove-${c.id}`))} />
                        )}

                        {/* Pin / Unpin */}
                        {c.isPinned ? (
                          <ActionBtn icon="PinOff" label="Unpin" tone="muted" loading={actionLoading === `unpin-${c.id}`} onClick={() => onAction(() => unpinComment(c.id), `unpin-${c.id}`)} />
                        ) : (
                          <ActionBtn icon="Pin" label="Pin" tone="muted" loading={actionLoading === `pin-${c.id}`} onClick={() => onAction(() => pinComment(c.id), `pin-${c.id}`)} />
                        )}

                        {/* Editor Pick */}
                        <ActionBtn
                          icon="Star"
                          label={c.isEditorPick ? 'Unpick' : 'Pick'}
                          tone={c.isEditorPick ? 'warning' : 'muted'}
                          loading={actionLoading === `pick-${c.id}`}
                          onClick={() => onAction(() => setEditorPick(c.id, !c.isEditorPick), `pick-${c.id}`)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              Showing {comments.length > 0 ? (filter.offset || 0) + 1 : 0}–{(filter.offset || 0) + comments.length} of {total}
            </span>
            <div className="flex gap-1">
              <button
                disabled={!filter.offset || filter.offset === 0}
                onClick={() => onFilterChange({ ...filter, offset: Math.max(0, (filter.offset || 0) - (filter.limit || 25)) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={comments.length < (filter.limit || 25)}
                onClick={() => onFilterChange({ ...filter, offset: (filter.offset || 0) + (filter.limit || 25) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Reports Tab
// ═══════════════════════════════════════════════════════════════════

function ReportsTab({
  reports, total, loading, filter, onFilterChange, actionLoading, onAction, onConfirm, onRefresh,
}: {
  reports: (CommunityReport & { comment?: any })[];
  total: number;
  loading: boolean;
  filter: ReportsQueueFilters;
  onFilterChange: (f: ReportsQueueFilters) => void;
  actionLoading: string | null;
  onAction: (action: () => Promise<void>, label: string) => void;
  onConfirm: (message: string, onConfirm: () => void) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-0.5">
          {['pending', 'resolved', 'dismissed'].map((s) => (
            <button
              key={s}
              onClick={() => onFilterChange({ ...filter, status: s === filter.status ? undefined : s, offset: 0 })}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
                filter.status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={onRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" title="Refresh">
            <WkIcon name="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <WkIcon name="Loader2" size={20} className="mx-auto mb-3 text-gray-400 animate-spin" />
          <p className="text-[12px] text-gray-500">Loading reports…</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-10 text-center">
          <WkIcon name="Flag" size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-[13px] font-semibold text-gray-500">No reports found</p>
          <p className="text-[11px] text-gray-400 mt-1">Try changing the status filter</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-8">#</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Reason</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Details</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Comment</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-20">Status</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-16">Date</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-[11px] font-bold text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-semibold text-gray-700">
                        {REPORT_REASON_LABELS[r.reason] || r.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <p className="text-[11px] text-gray-500 line-clamp-2">{r.details || '—'}</p>
                    </td>
                    <td className="py-3 px-4 max-w-[240px]">
                      <p className="text-[11px] text-gray-600 line-clamp-2">{truncate(r.comment?.body_plain || '—')}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${REPORT_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-400">{fmtTimeAgo(r.createdAt)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {r.status === 'pending' ? (
                        <div className="flex items-center gap-1">
                          <ActionBtn icon="CheckCircle" label="Resolve" tone="success" loading={actionLoading === `resolve-${r.id}`} onClick={() => onConfirm('Resolve this report?', () => onAction(() => reviewReport(r.id, 'resolve'), `resolve-${r.id}`))} />
                          <ActionBtn icon="XCircle" label="Dismiss" tone="danger" loading={actionLoading === `dismiss-${r.id}`} onClick={() => onConfirm('Dismiss this report?', () => onAction(() => reviewReport(r.id, 'dismiss'), `dismiss-${r.id}`))} />
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {r.reviewedAt ? `Reviewed ${fmtTimeAgo(r.reviewedAt)}` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              Showing {reports.length > 0 ? (filter.offset || 0) + 1 : 0}–{(filter.offset || 0) + reports.length} of {total}
            </span>
            <div className="flex gap-1">
              <button
                disabled={!filter.offset || filter.offset === 0}
                onClick={() => onFilterChange({ ...filter, offset: Math.max(0, (filter.offset || 0) - (filter.limit || 25)) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={reports.length < (filter.limit || 25)}
                onClick={() => onFilterChange({ ...filter, offset: (filter.offset || 0) + (filter.limit || 25) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Contributions Tab
// ═══════════════════════════════════════════════════════════════════

function ContributionsTab({
  contributions, total, loading, filter, onFilterChange, actionLoading, onAction, onConfirm, onRefresh,
}: {
  contributions: CommunityContribution[];
  total: number;
  loading: boolean;
  filter: ContributionsQueueFilters;
  onFilterChange: (f: ContributionsQueueFilters) => void;
  actionLoading: string | null;
  onAction: (action: () => Promise<void>, label: string) => void;
  onConfirm: (message: string, onConfirm: () => void) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-0.5">
          {['pending', 'approved', 'rejected', 'merged'].map((s) => (
            <button
              key={s}
              onClick={() => onFilterChange({ ...filter, status: s === filter.status ? undefined : s, offset: 0 })}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
                filter.status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={onRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" title="Refresh">
            <WkIcon name="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <WkIcon name="Loader2" size={20} className="mx-auto mb-3 text-gray-400 animate-spin" />
          <p className="text-[12px] text-gray-500">Loading contributions…</p>
        </div>
      ) : contributions.length === 0 ? (
        <div className="p-10 text-center">
          <WkIcon name="GitPullRequest" size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-[13px] font-semibold text-gray-500">No contributions found</p>
          <p className="text-[11px] text-gray-400 mt-1">Try changing the status filter</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-8">#</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Type</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Entity</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">User</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-20">Status</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-16">Date</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c, i) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-[11px] font-bold text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-semibold text-gray-700 capitalize">
                        {c.contributionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-500">
                        {c.entityType} {c.entitySlug ? `· ${c.entitySlug}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-600">{c.userId?.slice(0, 8)}…</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${CONTRIBUTION_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-400">{fmtTimeAgo(c.createdAt)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {c.status === 'pending' ? (
                        <div className="flex items-center gap-1">
                          <ActionBtn icon="CheckCircle" label="Approve" tone="success" loading={actionLoading === `approve-${c.id}`} onClick={() => onConfirm('Approve this contribution?', () => onAction(() => reviewContribution(c.id, 'approve'), `approve-${c.id}`))} />
                          <ActionBtn icon="XCircle" label="Reject" tone="danger" loading={actionLoading === `reject-${c.id}`} onClick={() => onConfirm('Reject this contribution?', () => onAction(() => reviewContribution(c.id, 'reject'), `reject-${c.id}`))} />
                        </div>
                      ) : c.status === 'approved' ? (
                        <div className="flex items-center gap-1">
                          <ActionBtn icon="GitMerge" label="Merge" tone="success" loading={actionLoading === `merge-${c.id}`} onClick={() => onConfirm('Merge this contribution? It will be applied and the contributor will receive reputation.', () => onAction(() => mergeContribution(c.id), `merge-${c.id}`))} />
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          {c.reviewedAt ? `Reviewed ${fmtTimeAgo(c.reviewedAt)}` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              Showing {contributions.length > 0 ? (filter.offset || 0) + 1 : 0}–{(filter.offset || 0) + contributions.length} of {total}
            </span>
            <div className="flex gap-1">
              <button
                disabled={!filter.offset || filter.offset === 0}
                onClick={() => onFilterChange({ ...filter, offset: Math.max(0, (filter.offset || 0) - (filter.limit || 25)) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={contributions.length < (filter.limit || 25)}
                onClick={() => onFilterChange({ ...filter, offset: (filter.offset || 0) + (filter.limit || 25) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Moderation Log Tab
// ═══════════════════════════════════════════════════════════════════

function ModerationLogTab({
  events, total, loading, filter, onFilterChange, onRefresh,
}: {
  events: (CommunityModerationEvent & { moderatorName?: string })[];
  total: number;
  loading: boolean;
  filter: ModerationLogFilters;
  onFilterChange: (f: ModerationLogFilters) => void;
  onRefresh: () => void;
}) {
  const actionOptions = ['hide', 'remove', 'restore', 'pin', 'unpin', 'editor_pick', 'remove_editor_pick', 'lock', 'unlock', 'resolve', 'dismiss', 'approve', 'reject'];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-0.5">
          <button
            onClick={() => onFilterChange({ ...filter, action: undefined })}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
              !filter.action ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All
          </button>
          {actionOptions.map((a) => (
            <button
              key={a}
              onClick={() => onFilterChange({ ...filter, action: filter.action === a ? undefined : a, offset: 0 })}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
                filter.action === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={onRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer" title="Refresh">
            <WkIcon name="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <WkIcon name="Loader2" size={20} className="mx-auto mb-3 text-gray-400 animate-spin" />
          <p className="text-[12px] text-gray-500">Loading moderation log…</p>
        </div>
      ) : events.length === 0 ? (
        <div className="p-10 text-center">
          <WkIcon name="ClipboardList" size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-[13px] font-semibold text-gray-500">No moderation events yet</p>
          <p className="text-[11px] text-gray-400 mt-1">Actions will appear here as moderation happens</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-8">#</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Action</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Target</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Moderator</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Reason</th>
                  <th className="py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 w-16">Date</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-[11px] font-bold text-gray-400">{i + 1 + (filter.offset || 0)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize bg-gray-100 text-gray-700">
                        {e.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-500 capitalize">{e.targetType}</span>
                      <span className="text-[10px] text-gray-400 ml-1 font-mono">{e.targetId?.slice(0, 8)}…</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-semibold text-gray-700">{e.moderatorName || 'System'}</span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="text-[11px] text-gray-500">{e.reason || '—'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-gray-400">{fmtTimeAgo(e.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              Showing {events.length > 0 ? (filter.offset || 0) + 1 : 0}–{(filter.offset || 0) + events.length} of {total}
            </span>
            <div className="flex gap-1">
              <button
                disabled={!filter.offset || filter.offset === 0}
                onClick={() => onFilterChange({ ...filter, offset: Math.max(0, (filter.offset || 0) - (filter.limit || 25)) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={events.length < (filter.limit || 25)}
                onClick={() => onFilterChange({ ...filter, offset: (filter.offset || 0) + (filter.limit || 25) })}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared Action Button
// ═══════════════════════════════════════════════════════════════════

function ActionBtn({
  icon, label, tone, loading, onClick,
}: {
  icon: string;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
  loading?: boolean;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    success: 'text-emerald-600 hover:bg-emerald-50 border-emerald-200',
    warning: 'text-amber-600 hover:bg-amber-50 border-amber-200',
    danger: 'text-red-600 hover:bg-red-50 border-red-200',
    muted: 'text-gray-500 hover:bg-gray-100 border-gray-200',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 ${colors[tone]}`}
      title={label}
    >
      {loading ? (
        <WkIcon name="Loader2" size={11} className="animate-spin" />
      ) : (
        <WkIcon name={icon as never} size={11} />
      )}
      {label}
    </button>
  );
}