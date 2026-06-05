import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WkIcon } from '@/components/design-system/Icon';
import { TIMED_LYRICS, type TimedLyricsSubmission, type TimedLyricLine } from '@/mocks/timedLyrics';

type AdminTab = 'pending' | 'approved' | 'all';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VoteBar({ submission }: { submission: TimedLyricsSubmission }) {
  const total = submission.upvotes + submission.downvotes || 1;
  const upPct = Math.round((submission.upvotes / total) * 100);
  const downPct = 100 - upPct;

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
        <WkIcon name="ArrowUp" size={12} /> {submission.upvotes}
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${upPct}%` }} />
      </div>
      <span className="flex items-center gap-1 text-[12px] text-red-500">
        <WkIcon name="ArrowDown" size={12} /> {submission.downvotes}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: TimedLyricsSubmission['status'] }) {
  const config = {
    approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    pending_review: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    draft: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  const label = {
    approved: 'Approved',
    pending_review: 'Pending Review',
    draft: 'Draft',
    rejected: 'Rejected',
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config[status]}`}>
      {label[status]}
    </span>
  );
}

export default function AdminLyricsPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('pending');
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);
  const [editingLines, setEditingLines] = useState<Map<number, TimedLyricLine[]>>(new Map());
  const [toast, setToast] = useState('');

  const allSubmissions = Object.values(TIMED_LYRICS);

  const filtered = activeTab === 'pending'
    ? allSubmissions.filter((s) => s.status === 'pending_review')
    : activeTab === 'approved'
      ? allSubmissions.filter((s) => s.status === 'approved')
      : allSubmissions;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleApprove = (submission: TimedLyricsSubmission) => {
    showToast(`Approved lyrics for "${submission.trackSlug}" — now live`);
  };

  const handleReject = (submission: TimedLyricsSubmission) => {
    showToast(`Rejected lyrics for "${submission.trackSlug}"`);
  };

  const toggleExpand = (id: number) => {
    setExpandedSubmission((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-[20px] font-black text-[var(--wk-text)]">Lyric Submissions</h1>
            <p className="mt-0.5 text-[12px] text-[var(--wk-text-muted)]">
              Community contributions under peer review. Admins can override any decision.
            </p>
          </div>
          <Link
            to="/admin"
            className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
          >
            <WkIcon name="ArrowLeft" size={14} />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="mx-auto flex max-w-[1200px] gap-0 px-6">
          {([
            { key: 'pending', label: 'Pending Review', count: allSubmissions.filter((s) => s.status === 'pending_review').length },
            { key: 'approved', label: 'Approved', count: allSubmissions.filter((s) => s.status === 'approved').length },
            { key: 'all', label: 'All', count: allSubmissions.length },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold transition-all ${
                activeTab === tab.key
                  ? 'border-b-[2px] border-[var(--wk-brand)] text-[var(--wk-brand)]'
                  : 'text-[var(--wk-text-faint)] hover:text-[var(--wk-text-muted)]'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === tab.key ? 'bg-[var(--wk-brand)]/10' : 'bg-[var(--wk-surface-raised)]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Submissions list */}
      <div className="mx-auto max-w-[1200px] px-6 py-6">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <WkIcon name="FileText" size={36} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
            <p className="text-[14px] text-[var(--wk-text-muted)]">No submissions in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((submission) => {
              const isExpanded = expandedSubmission === submission.id;
              return (
                <div
                  key={submission.id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded ? 'border-[var(--wk-brand)]/30 bg-[var(--wk-surface)]' : 'border-[var(--wk-border)] bg-[var(--wk-surface)]'
                  }`}
                >
                  {/* Row header */}
                  <button
                    onClick={() => toggleExpand(submission.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                  >
                    <StatusBadge status={submission.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-[var(--wk-text)]">
                        <Link
                          to={`/tracks/${submission.trackSlug}`}
                          className="hover:text-[var(--wk-brand)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {submission.trackSlug}
                        </Link>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--wk-text-muted)]">
                        <span>by <strong className="text-[var(--wk-text-soft)]">{submission.submitterName}</strong></span>
                        <span>{submission.lines.length} timed lines</span>
                        {submission.sourceDescription && <span className="text-[var(--wk-text-faint)]">· {submission.sourceDescription}</span>}
                      </div>
                    </div>

                    <VoteBar submission={submission} />

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {submission.status === 'pending_review' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(submission); }}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-emerald-600"
                          >
                            <WkIcon name="Check" size={12} /> Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(submission); }}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-500/5 px-3 py-1.5 text-[11px] font-bold text-red-600 transition-all hover:bg-red-500/10"
                          >
                            <WkIcon name="Close" size={12} /> Reject
                          </button>
                        </>
                      )}
                      {submission.status === 'approved' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(submission); }}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-500/5 px-3 py-1.5 text-[11px] font-bold text-red-600 transition-all hover:bg-red-500/10"
                        >
                          <WkIcon name="Close" size={12} /> Revoke
                        </button>
                      )}
                    </div>

                    <WkIcon name={isExpanded ? 'ArrowUp' : 'ArrowDown'} size={14} className="text-[var(--wk-text-faint)]" />
                  </button>

                  {/* Expanded lyric lines */}
                  {isExpanded && (
                    <div className="border-t border-[var(--wk-border)] px-5 py-4">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                          {submission.lines.length} timed lines
                        </span>
                        <span className="text-[11px] text-[var(--wk-text-faint)]">
                          Submitted {submission.createdAt}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {submission.lines.map((line, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-[var(--wk-surface-raised)]">
                            <span className="flex h-7 w-[52px] flex-shrink-0 items-center justify-center rounded-md bg-[var(--wk-brand-soft)] text-[11px] font-bold text-[var(--wk-brand)]">
                              {formatTime(line.timestampSeconds)}
                            </span>
                            <span className={`text-[13px] ${line.text.startsWith('—') || line.text.startsWith('♪') ? 'text-[var(--wk-text-faint)] font-semibold uppercase tracking-wider' : 'text-[var(--wk-text)]'}`}>
                              {line.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--wk-text)] px-6 py-3 text-[13px] font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}